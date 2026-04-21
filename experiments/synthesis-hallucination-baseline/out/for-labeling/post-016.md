# Post 016

## Post generado

> Seven days. Four commits. One integration shipped from stub to production.
> 
> The idauto-crm work started with the honest marker every real integration has: a TODO in the env config. Placeholder endpoint, placeholder secret, 8-second timeout already baked in. Phase 2 wasn't pretending the backend contract was settled — it shipped the HTTP notifier abstraction and delivery history UI anyway, with real timeout discipline already enforced before the upstream was even finalized.
> 
> Phase 3 layered in the CRM muscle. FollowUp and TransactionNote models with explicit OPEN/COMPLETED/CANCELED status vocabulary. Notes and follow-ups hanging off transaction detail. Summary metrics surfaced where they belong. The domain model got opinions.
> 
> Then the deployment pipeline arrived — containerized, GCP Artifact Registry, Helm charts for Kubernetes orchestration, CI/CD separated from runtime secret management. The .dockerignore tells the whole story: node_modules, .next, .turbo, .github all excluded. What ships is exactly what should ship, nothing that shouldn't.
> 
> The final commit is the one that ties the room together. DashboardPageFrame, a proper sidebar/navbar/content layout, modal transaction creation, numbered timeline for workflow visualization — and session error handling that actually catches failures instead of assuming auth always works. That try/catch around getSession isn't defensive noise; it's the difference between a blank page and a recoverable error state.
> 
> Stub to Helm chart in a week. The TODOs are honest about what's left. Everything else is done.
> 
> #lilicurl #codingWithHumor

## Commits de origen

### Commit 1: 1164614
**Message:** feat: add phase 3 crm enhancements

**Diff:**
```diff
--- apps/bff/src/modules/transactions/demo-data.ts
diff --git a/apps/bff/src/modules/transactions/demo-data.ts b/apps/bff/src/modules/transactions/demo-data.ts
index 6724482..bed0075 100644
--- a/apps/bff/src/modules/transactions/demo-data.ts
+++ b/apps/bff/src/modules/transactions/demo-data.ts
@@ -1,7 +1,10 @@
 import type {
+  FollowUpStatus,
   TransactionDetail,
   TransactionDocumentItem,
+  TransactionFollowUpItem,
   TransactionListItem,
+  TransactionNoteItem,
   TransactionStatus,
   WorkflowEventItem,
 } from "./transactions.service.js";
@@ -152,6 +155,102 @@ function buildWorkflowEvents(
   );
 }
 
+function buildNotes(transactionId: string): TransactionNoteItem[] {
+  if (transactionId === "demo-tx-1") {
+    return [
+      {
+        id: `${transactionId}-note-1`,
+        body: "Cliente listo para recibir documentos apenas se confirme la entrega en app.",
+        author: {
+          id: "demo-salesman",
+          name: "Michel",
+          email: "michel@vialabs.net",
+        },
+        createdAt: isoHoursAgo(5),
+        updatedAt: isoHoursAgo(5),
+      },
+    ];
+  }
+
+  if (transactionId === "demo-tx-2") {
+    return [
+      {
+        id: `${transactionId}-note-1`,
+        body: "Falta confirmar con broker el permiso de circulacion antes de cerrar la venta.",
+        author: {
+          id: "demo-salesman",
+          name: "Michel",
+          email: "michel@vialabs.net",
+        },
+        createdAt: isoHoursAgo(20),
+        updatedAt: isoHoursAgo(20),
+      },
+    ];
+  }
+
+  return [];
+}
+
+function buildFollowUps(
+  transactionId: string,
+  status: TransactionStatus,
+): TransactionFollowUpItem[] {
+  const author = {
+    id: "demo-salesman",
+    name: "Michel",
+    email: "michel@vialabs.net",
+  };
+
+  const items: Array<{
+    id: string;
+    title: string;
+    description: string | null;
+    dueAt: string;
+    status: FollowUpStatus;
+    completedAt: string | null;
+  }> = [];
+
+  if (transactionId === "demo-tx-1") {
+    items.push({
+      id: `${transactionId}-follow-up-1`,
+      title: "Confirmar recepcion con la clienta",
+      description: "Llamar si en 24h no abre los documentos en la app.",
+      dueAt: isoHoursAgo(-6),
+      status: "OPEN",
+      completedAt: null,
+    });
+  }
+
+  if (transactionId === "demo-tx-2") {
+    items.push({
+      id: `${transactionId}-follow-up-1`,
+      title: "Pedir actualizacion al broker",
+      description: "Revisar estado de documentacion pendiente.",
+      dueAt: isoHoursAgo(2),
+      status: "OPEN",
+      completedAt: null,
+    });
+  }
+
+  if (status === "DELIVERED") {
+    items.push({
+      id: `${transactionId}-follow-up-1`,
+      title: "Venta ya cerrada",
+      description: "Follow-up historico para registro comercial.",
+      dueAt: isoHoursAgo(12),
+      status: "COMPLETED",
+      completedAt: isoHoursAgo(4),
+    });
+  }
+
+  return items.map((item) => ({
+    ...item,
+    author,
+    createdAt: isoHoursAgo(24),
+    updatedAt: item.completedAt ?? isoHoursAgo(24),
+  }));
+}
+
 const items: TransactionListItem[] = [
   {
     id: "demo-tx-1",
@@ -230,6 +329,8 @@ export function getDemoTransactionDetail(
   return {
     ...transaction,
     documents: buildDocuments(transaction.saleId, transaction.status),
+    notes: buildNotes(transaction.id),
+    followUps: buildFollowUps(transaction.id, transaction.status),
   };
 }
 


--- apps/bff/src/modules/transactions/transactions.routes.ts
diff --git a/apps/bff/src/modules/transactions/transactions.routes.ts b/apps/bff/src/modules/transactions/transactions.routes.ts
index 539ab94..6bdd7cb 100644
--- a/apps/bff/src/modules/transactions/transactions.routes.ts
+++ b/apps/bff/src/modules/transactions/transactions.routes.ts
@@ -1,9 +1,16 @@
 import type { FastifyPluginAsync } from "fastify";
 import { requireSession } from "../../http/require-session.js";
 import {
+  createFollowUp,
+  createTransactionNote,
   getTransactionDetail,
   getTransactionWorkflowEvents,
   listTransactions,
+  completeFollowUp,
+  FollowUpNotFoundError,
+  FollowUpValidationError,
+  TransactionActivityNotFoundError,
+  TransactionNoteValidationError,
   transactionStatuses,
   type TransactionStatus,
 } from "./transactions.service.js";
@@ -14,9 +21,14 @@ import {
   conflictResponseSchema,
   deliverTransactionBodySchema,
   deliverTransactionResponseSchema,
+  followUpBodySchema,
+  followUpParamsSchema,
+  followUpResponseSchema,
   notFoundResponseSchema,
   transactionDetailResponseSchema,
   transactionListQuerySchema,
+  transactionNoteBodySchema,
+  transactionNoteResponseSchema,
   transactionParamsSchema,
   transactionsListResponseSchema,
   unauthorizedResponseSchema,
@@ -40,6 +52,7 @@ interface TransactionsQuerystring {
   status?: string;
   from?: string;
   to?: string;
+  search?: string;
   page?: number;
   size?: number;
 }
@@ -65,6 +78,16 @@ interface DeliverTransactionBody {
   clientRut?: string;
 }
 
+interface TransactionNoteBody {
+  body: string;
+}
+
+interface FollowUpBody {
+  title: string;
+  description?: string;
+  dueAt: string;
+}
+
 function getWebhookSecret(headers: WorkflowWebhookHeaders) {
   return headers["x-webhook-secret"] ?? headers["x-idauto-webhook-secret"];
 }
@@ -112,6 +135,7 @@ export const transactionsRoutes: FastifyPluginAsync = async (app) => {
         status,
         from: request.query.from,
         to: request.query.to,
+        search: request.query.search,
       });
     },
   );
@@ -224,6 +248,140 @@ export const transactionsRoutes: FastifyPluginAsync = async (app) => {
     },
   );
 
+  app.post<{
+    Params: TransactionParams;
+    Body: TransactionNoteBody;
+  }>(
+    "/api/crm/transactions/:id/notes",
+    {
+      schema: {
+        tags: ["crm", "transactions"],
+        summary: "Create a note for a CRM transaction",
+        params: transactionParamsSchema,
+        body: transactionNoteBodySchema,
+        response: {
+          200: transactionNoteResponseSchema,
+          400: badRequestResponseSchema,
+          401: unauthorizedResponseSchema,
+          404: notFoundResponseSchema,
+        },
+      },
+    },
+    async (request, reply) => {
+      const user = await requireSession(request, reply);
+      if (!user) {
+        return;
+      }
+
+      try {
+        return await createTransactionNote({
+          salesmanId: user.id,
+          transactionId: request.params.id,
+          body: request.body.body,
+        });
+      } catch (error) {
+        if (error instanceof TransactionNoteValidationError) {
+          reply.code(400).send({ message: error.message });
+          return;
+        }
+
+        if (error instanceof TransactionActivityNotFoundError) {
+          reply.code(404).send({ message: error.message });
+          return;
+        }
+
+        throw error;
+      }
+    },
+  );
+
+  app.post<{
+    Params: TransactionParams;
+    Body: FollowUpBody;
+  }>(
+    "/api/crm/transactions/:id/follow-ups",
+    {
+      schema: {
+        tags: ["crm", "transactions"],
+        summary: "Create a follow-up for a CRM transaction",
+        params: transactionParamsSchema,
+        body: followUpBodySchema,
+        response: {
+          200: followUpResponseSchema,
+          400: badRequestResponseSchema,
+          401: unauthorizedResponseSchema,
+          404: notFoundResponseSchema,
+        },
+      },
+    },
+    async (request, reply) => {
+      const user = await requireSession(request, reply);
+      if (!user) {
+        return;
+      }
+
+      try {
+        return await createFollowUp({
+          salesmanId: user.id,
+          transactionId: request.params.id,
+          title: request.body.title,

--- apps/bff/src/modules/transactions/transactions.schemas.ts
diff --git a/apps/bff/src/modules/transactions/transactions.schemas.ts b/apps/bff/src/modules/transactions/transactions.schemas.ts
index d106462..bace10f 100644
--- a/apps/bff/src/modules/transactions/transactions.schemas.ts
+++ b/apps/bff/src/modules/transactions/transactions.schemas.ts
@@ -1,4 +1,7 @@
-import { transactionStatuses } from "./transactions.service.js";
+import {
+  followUpStatuses,
+  transactionStatuses,
+} from "./transactions.service.js";
 
 export const transactionListQuerySchema = {
   type: "object",
@@ -15,6 +18,9 @@ export const transactionListQuerySchema = {
       type: "string",
       format: "date",
     },
+    search: {
+      type: "string",
+    },
     page: {
       type: "integer",
       minimum: 1,
@@ -88,12 +94,43 @@ export const transactionsListResponseSchema = {
     total: { type: "integer" },
     page: { type: "integer" },
     size: { type: "integer" },
+    summary: {
+      type: "object",
+      properties: {
+        byStatus: {
+          type: "object",
+          properties: {
+            SUBMITTED: { type: "integer" },
+            PROCESSING: { type: "integer" },
+            READY: { type: "integer" },
+            DELIVERED: { type: "integer" },
+            VIEWED: { type: "integer" },
+          },
+          required: [
+            "SUBMITTED",
+            "PROCESSING",
+            "READY",
+            "DELIVERED",
+            "VIEWED",
+          ],
+        },
+        readyToDeliver: { type: "integer" },
+        openFollowUps: { type: "integer" },
+        overdueFollowUps: { type: "integer" },
+      },
+      required: [
+        "byStatus",
+        "readyToDeliver",
+        "openFollowUps",
+        "overdueFollowUps",
+      ],
+    },
     source: {
       type: "string",
       enum: ["database", "demo"],
     },
   },
-  required: ["items", "total", "page", "size", "source"],
+  required: ["items", "total", "page", "size", "summary", "source"],
 } as const;
 
 export const unauthorizedResponseSchema = {
@@ -166,6 +203,60 @@ const workflowEventSchema = {
   required: ["id", "eventType", "eventStatus", "payload", "occurredAt", "createdAt"],
 } as const;
 
+const transactionNoteSchema = {
+  type: "object",
+  properties: {
+    id: { type: "string" },
+    body: { type: "string" },
+    author: {
+      type: "object",
+      properties: {
+        id: { type: "string" },
+        name: { type: "string" },
+        email: { type: "string" },
+      },
+      required: ["id", "name", "email"],
+    },
+    createdAt: { type: "string", format: "date-time" },
+    updatedAt: { type: "string", format: "date-time" },
+  },
+  required: ["id", "body", "author", "createdAt", "updatedAt"],
+} as const;
+
+const followUpSchema = {
+  type: "object",
+  properties: {
+    id: { type: "string" },
+    title: { type: "string" },
+    description: { type: ["string", "null"] },
+    dueAt: { type: "string", format: "date-time" },
+    status: { type: "string", enum: [...followUpStatuses] },
+    completedAt: { type: ["string", "null"], format: "date-time" },
+    author: {
+      type: "object",
+      properties: {
+        id: { type: "string" },
+        name: { type: "string" },
+        email: { type: "string" },
+      },
+      required: ["id", "name", "email"],
+    },
+    createdAt: { type: "string", format: "date-time" },
+    updatedAt: { type: "string", format: "date-time" },
+  },
+  required: [
+    "id",
+    "title",
+    "description",
+    "dueAt",
+    "status",
+    "completedAt",
+    "author",
+    "createdAt",
+    "updatedAt",
+  ],
+} as const;
+
 export const transactionDetailResponseSchema = {
   type: "object",
   properties: {
@@ -198,6 +289,14 @@ export const transactionDetailResponseSchema = {
       type: "array",
       items: transactionDocumentSchema,
     },
+    notes: {
+      type: "array",
+      items: transactionNoteSchema,
+    },
+    followUps: {
+      type: "array",
+      items: followUpSchema,
+    },
   },
   required: [
     "id",
@@ -209,9 +308,43 @@ export const transactionDetailResponseSchema = {
     "client",
     "vehicle",
     "documents",
+    "notes",
+    "followUps",

--- apps/bff/src/modules/transactions/transactions.service.ts
diff --git a/apps/bff/src/modules/transactions/transactions.service.ts b/apps/bff/src/modules/transactions/transactions.service.ts
index 16d3a26..38b8d8a 100644
--- a/apps/bff/src/modules/transactions/transactions.service.ts
+++ b/apps/bff/src/modules/transactions/transactions.service.ts
@@ -1,3 +1,4 @@
+import { randomUUID } from "node:crypto";
 import { prisma } from "@repo/db";
 import {
   getDemoTransactionDetail,
@@ -15,6 +16,10 @@ export const transactionStatuses = [
 
 export type TransactionStatus = (typeof transactionStatuses)[number];
 
+export const followUpStatuses = ["OPEN", "COMPLETED", "CANCELED"] as const;
+
+export type FollowUpStatus = (typeof followUpStatuses)[number];
+
 export interface TransactionListItem {
   id: string;
   saleId: string;
@@ -58,8 +63,45 @@ export interface WorkflowEventItem {
   createdAt: string;
 }
 
+export interface TransactionNoteItem {
+  id: string;
+  body: string;
+  author: {
+    id: string;
+    name: string;
+    email: string;
+  };
+  createdAt: string;
+  updatedAt: string;
+}
+
+export interface TransactionFollowUpItem {
+  id: string;
+  title: string;
+  description: string | null;
+  dueAt: string;
+  status: FollowUpStatus;
+  completedAt: string | null;
+  author: {
+    id: string;
+    name: string;
+    email: string;
+  };
+  createdAt: string;
+  updatedAt: string;
+}
+
+export interface TransactionsSummary {
+  byStatus: Record<TransactionStatus, number>;
+  readyToDeliver: number;
+  openFollowUps: number;
+  overdueFollowUps: number;
+}
+
 export interface TransactionDetail extends Omit<TransactionListItem, "documents"> {
   documents: TransactionDocumentItem[];
+  notes: TransactionNoteItem[];
+  followUps: TransactionFollowUpItem[];
 }
 
 export interface TransactionsListResult {
@@ -67,6 +109,7 @@ export interface TransactionsListResult {
   total: number;
   page: number;
   size: number;
+  summary: TransactionsSummary;
   source: "database" | "demo";
 }
 
@@ -77,6 +120,7 @@ interface ListTransactionsParams {
   status?: TransactionStatus;
   from?: string;
   to?: string;
+  search?: string;
 }
 
 interface TransactionRow {
@@ -132,6 +176,35 @@ interface WorkflowEventRow {
   createdAt: Date | string;
 }
 
+interface TransactionNoteRow {
+  id: string;
+  body: string;
+  authorId: string;
+  authorName: string;
+  authorEmail: string;
+  createdAt: Date | string;
+  updatedAt: Date | string;
+}
+
+interface TransactionFollowUpRow {
+  id: string;
+  title: string;
+  description: string | null;
+  dueAt: Date | string;
+  status: FollowUpStatus;
+  completedAt: Date | string | null;
+  authorId: string;
+  authorName: string;
+  authorEmail: string;
+  createdAt: Date | string;
+  updatedAt: Date | string;
+}
+
+interface TransactionsSummaryRow {
+  status: TransactionStatus;
+  count: number | string;
+}
+
 function normalizeDate(value: Date | string) {
   return value instanceof Date ? value.toISOString() : value;
 }
@@ -144,6 +217,11 @@ function normalizeOptionalDate(value: Date | string | null) {
   return value instanceof Date ? value.toISOString() : value;
 }
 
+function normalizeSearchTerm(value?: string) {
+  const trimmed = value?.trim();
+  return trimmed ? trimmed : null;
+}
+
 function isTransactionStatus(value: unknown): value is TransactionStatus {
   return typeof value === "string" && transactionStatuses.includes(value as TransactionStatus);
 }
@@ -222,9 +300,11 @@ function filterDemoTransactions(params: {
   status?: TransactionStatus;
   from?: string;
   to?: string;
+  search?: string;
 }) {
   const from = normalizeDateFilter(params.from);
   const to = normalizeDateFilter(params.to);
+  const search = normalizeSearchTerm(params.search)?.toLowerCase();
 
   return getDemoTransactions().filter((item) => {
     if (params.status && item.status !== params.status) {
@@ -246,6 +326,25 @@ function filterDemoTransactions(params: {
       }
     }
 
+    if (search) {
+      const haystack = [
+        item.saleId,
+        item.automotoraName ?? "",

--- apps/web/app/transactions/[id]/transaction-detail-live.tsx
diff --git a/apps/web/app/transactions/[id]/transaction-detail-live.tsx b/apps/web/app/transactions/[id]/transaction-detail-live.tsx
index d30563c..df3e2fa 100644
--- a/apps/web/app/transactions/[id]/transaction-detail-live.tsx
+++ b/apps/web/app/transactions/[id]/transaction-detail-live.tsx
@@ -2,7 +2,7 @@
 
 import Link from "next/link";
 import { Toast } from "flowbite-react";
-import { useEffect, useRef, useState } from "react";
+import { useEffect, useRef, useState, useTransition } from "react";
 import { DeliveryPanel } from "./delivery-panel";
 
 type TransactionStatus =
@@ -12,6 +12,8 @@ type TransactionStatus =
   | "DELIVERED"
   | "VIEWED";
 
+type FollowUpStatus = "OPEN" | "COMPLETED" | "CANCELED";
+
 interface TransactionDocumentItem {
   id: string;
   type: string;
@@ -41,6 +43,36 @@ interface TransactionDetailResponse {
     year: number | null;
   };
   documents: TransactionDocumentItem[];
+  notes: TransactionNoteItem[];
+  followUps: TransactionFollowUpItem[];
+}
+
+interface TransactionNoteItem {
+  id: string;
+  body: string;
+  author: {
+    id: string;
+    name: string;
+    email: string;
+  };
+  createdAt: string;
+  updatedAt: string;
+}
+
+interface TransactionFollowUpItem {
+  id: string;
+  title: string;
+  description: string | null;
+  dueAt: string;
+  status: FollowUpStatus;
+  completedAt: string | null;
+  author: {
+    id: string;
+    name: string;
+    email: string;
+  };
+  createdAt: string;
+  updatedAt: string;
 }
 
 const statusLabels: Record<TransactionStatus, string> = {
@@ -69,6 +101,18 @@ const documentTypeLabels: Record<string, string> = {
   OTHER: "Otro documento",
 };
 
+const followUpStatusLabels: Record<FollowUpStatus, string> = {
+  OPEN: "Abierto",
+  COMPLETED: "Completado",
+  CANCELED: "Cancelado",
+};
+
+const followUpStatusClasses: Record<FollowUpStatus, string> = {
+  OPEN: "bg-amber-100 text-amber-800",
+  COMPLETED: "bg-emerald-100 text-emerald-800",
+  CANCELED: "bg-slate-100 text-slate-700",
+};
+
 function formatDate(value: string) {
   return new Intl.DateTimeFormat("es-CL", {
     dateStyle: "medium",
@@ -117,6 +161,350 @@ async function fetchTransactionDetail(
   }
 }
 
+function isOverdue(followUp: TransactionFollowUpItem) {
+  return followUp.status === "OPEN" && new Date(followUp.dueAt) < new Date();
+}
+
+function ActivityPanel({
+  detail,
+  bffUrl,
+  onUpdated,
+}: {
+  detail: TransactionDetailResponse;
+  bffUrl?: string;
+  onUpdated: (detail: TransactionDetailResponse) => void;
+}) {
+  const [noteBody, setNoteBody] = useState("");
+  const [followUpTitle, setFollowUpTitle] = useState("");
+  const [followUpDescription, setFollowUpDescription] = useState("");
+  const [followUpDueAt, setFollowUpDueAt] = useState("");
+  const [feedback, setFeedback] = useState<{
+    tone: "success" | "error" | "neutral";
+    message: string;
+  } | null>(null);
+  const [isNotePending, startNoteTransition] = useTransition();
+  const [isFollowUpPending, startFollowUpTransition] = useTransition();
+  const [isCompletingId, setIsCompletingId] = useState<string | null>(null);
+
+  const refreshDetail = async () => {
+    if (!bffUrl) {
+      setFeedback({
+        tone: "error",
+        message: "NEXT_PUBLIC_BFF_URL no esta configurado en la web.",
+      });
+      return;
+    }
+
+    const nextDetail = await fetchTransactionDetail(detail.id, bffUrl);
+    if (nextDetail) {
+      onUpdated(nextDetail);
+    }
+  };
+
+  const submitNote = () => {
+    startNoteTransition(async () => {
+      if (!bffUrl) {
+        setFeedback({
+          tone: "error",
+          message: "NEXT_PUBLIC_BFF_URL no esta configurado en la web.",
+        });
+        return;
+      }
+
+      try {
+        const response = await fetch(
+          `${bffUrl}/api/crm/transactions/${encodeURIComponent(detail.id)}/notes`,
+          {
+            method: "POST",
+            credentials: "include",
+            headers: {
+              "content-type": "application/json",
+            },
+            body: JSON.stringify({ body: noteBody }),
+          },
+        );
+
+        if (!response.ok) {
+          setFeedback({
+            tone: "error",
+            message: `No pudimos guardar la nota (${response.status}).`,
+          });

--- apps/web/app/transactions/page.tsx
diff --git a/apps/web/app/transactions/page.tsx b/apps/web/app/transactions/page.tsx
index e2d6e46..218f47e 100644
--- a/apps/web/app/transactions/page.tsx
+++ b/apps/web/app/transactions/page.tsx
@@ -63,11 +63,13 @@ export default async function TransactionsPage({
   const statusParam = readFirstQueryValue(resolvedSearchParams.status);
   const fromParam = readFirstQueryValue(resolvedSearchParams.from);
   const toParam = readFirstQueryValue(resolvedSearchParams.to);
+  const searchParam = readFirstQueryValue(resolvedSearchParams.search);
 
   const filters = {
     status: isTransactionStatus(statusParam) ? statusParam : undefined,
     from: fromParam || undefined,
     to: toParam || undefined,
+    search: searchParam || undefined,
   };
 
   const result = await getTransactions(filters);
@@ -124,8 +126,10 @@ export default async function TransactionsPage({
     );
   }
 
-  const { items, total, source } = result.data;
-  const hasActiveFilters = Boolean(filters.status || filters.from || filters.to);
+  const { items, total, source, summary } = result.data;
+  const hasActiveFilters = Boolean(
+    filters.status || filters.from || filters.to || filters.search,
+  );
 
   return (
     <div className="min-h-screen bg-gray-50 px-4 py-10">
@@ -138,12 +142,12 @@ export default async function TransactionsPage({
               </p>
               <h1 className="mt-2 text-3xl font-bold">Mis transacciones</h1>
               <p className="mt-3 max-w-2xl text-sm text-primary-100">
-                Vista inicial de Fase 1: estado documental, cliente, vehiculo y
-                progreso de documentos por venta.
+                Vista CRM de Fase 3: estado documental, busqueda operativa,
+                reporting basico y seguimiento comercial por venta.
               </p>
             </div>
 
-            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
+            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
               <div className="rounded-2xl border border-primary-800 bg-primary-900/70 px-4 py-3">
                 <p className="text-xs uppercase tracking-wide text-primary-200">
                   Total
@@ -160,10 +164,26 @@ export default async function TransactionsPage({
               </div>
               <div className="rounded-2xl border border-primary-800 bg-primary-900/70 px-4 py-3">
                 <p className="text-xs uppercase tracking-wide text-primary-200">
-                  Proximo paso
+                  Ready
+                </p>
+                <p className="mt-1 text-sm font-semibold">
+                  {summary.readyToDeliver} para entregar
+                </p>
+              </div>
+              <div className="rounded-2xl border border-primary-800 bg-primary-900/70 px-4 py-3">
+                <p className="text-xs uppercase tracking-wide text-primary-200">
+                  Follow-ups abiertos
+                </p>
+                <p className="mt-1 text-sm font-semibold">
+                  {summary.openFollowUps}
+                </p>
+              </div>
+              <div className="rounded-2xl border border-primary-800 bg-primary-900/70 px-4 py-3">
+                <p className="text-xs uppercase tracking-wide text-primary-200">
+                  Atrasados
                 </p>
                 <p className="mt-1 text-sm font-semibold">
-                  Detalle y timeline
+                  {summary.overdueFollowUps}
                 </p>
               </div>
             </div>
@@ -177,8 +197,9 @@ export default async function TransactionsPage({
                 Filtros de transacciones
               </h2>
               <p className="mt-1 text-sm text-gray-500">
-                Filtra por estado o rango de fechas para revisar tu cola de trabajo.
+                Filtra, busca por cliente o patente y revisa el estado general de tu cartera.
               </p>
+              {/* TODO: agregar selector de automotora y vendedor cuando entre el milestone multi-automotora/multi-vendedor. */}
             </div>
             {hasActiveFilters ? (
               <Link
@@ -190,7 +211,18 @@ export default async function TransactionsPage({
             ) : null}
           </div>
 
-          <form className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
+          <form className="mt-5 grid gap-4 md:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
+            <label className="text-sm text-gray-600 md:col-span-2">
+              Busqueda
+              <input
+                type="search"
+                name="search"
+                defaultValue={filters.search ?? ""}
+                placeholder="Patente, cliente, email, telefono o saleId"
+                className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
+              />
+            </label>
+
             <label className="text-sm text-gray-600">
               Estado
               <select
@@ -247,7 +279,7 @@ export default async function TransactionsPage({
             }
             description={
               hasActiveFilters
-                ? "Prueba otro estado o un rango de fechas mas amplio."
+                ? "Prueba otra busqueda, estado o un rango de fechas mas amplio."
                 : "Cuando lleguen ventas del broker o cargues datos de prueba, apareceran aqui."
             }
           />


--- apps/web/lib/crm-client.ts
diff --git a/apps/web/lib/crm-client.ts b/apps/web/lib/crm-client.ts
index 39b764f..a6935c1 100644
--- a/apps/web/lib/crm-client.ts
+++ b/apps/web/lib/crm-client.ts
@@ -7,6 +7,8 @@ export type TransactionStatus =
   | "DELIVERED"
   | "VIEWED";
 
+export type FollowUpStatus = "OPEN" | "COMPLETED" | "CANCELED";
+
 export interface TransactionListItem {
   id: string;
   saleId: string;
@@ -36,6 +38,12 @@ export interface TransactionsResponse {
   total: number;
   page: number;
   size: number;
+  summary: {
+    byStatus: Record<TransactionStatus, number>;
+    readyToDeliver: number;
+    openFollowUps: number;
+    overdueFollowUps: number;
+  };
   source: "database" | "demo";
 }
 
@@ -68,6 +76,36 @@ export interface TransactionDetailResponse {
     year: number | null;
   };
   documents: TransactionDocumentItem[];
+  notes: TransactionNoteItem[];
+  followUps: TransactionFollowUpItem[];
+}
+
+export interface TransactionNoteItem {
+  id: string;
+  body: string;
+  author: {
+    id: string;
+    name: string;
+    email: string;
+  };
+  createdAt: string;
+  updatedAt: string;
+}
+
+export interface TransactionFollowUpItem {
+  id: string;
+  title: string;
+  description: string | null;
+  dueAt: string;
+  status: FollowUpStatus;
+  completedAt: string | null;
+  author: {
+    id: string;
+    name: string;
+    email: string;
+  };
+  createdAt: string;
+  updatedAt: string;
 }
 
 export interface WorkflowEventItem {
@@ -87,6 +125,7 @@ interface TransactionsFilters {
   status?: TransactionStatus;
   from?: string;
   to?: string;
+  search?: string;
   page?: number;
   size?: number;
 }
@@ -178,6 +217,10 @@ export async function getTransactions(
     params.set("to", filters.to);
   }
 
+  if (filters.search) {
+    params.set("search", filters.search);
+  }
+
   if (filters.page) {
     params.set("page", String(filters.page));
   }


--- packages/db/prisma/migrations/20260414113000_phase3_crm_enhancements/migration.sql
diff --git a/packages/db/prisma/migrations/20260414113000_phase3_crm_enhancements/migration.sql b/packages/db/prisma/migrations/20260414113000_phase3_crm_enhancements/migration.sql
new file mode 100644
index 0000000..2ba6467
--- /dev/null
+++ b/packages/db/prisma/migrations/20260414113000_phase3_crm_enhancements/migration.sql
@@ -0,0 +1,57 @@
+-- CreateEnum
+CREATE TYPE "FollowUpStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELED');
+
+-- CreateTable
+CREATE TABLE "TransactionNote" (
+    "id" TEXT NOT NULL,
+    "transactionId" TEXT NOT NULL,
+    "authorId" TEXT NOT NULL,
+    "body" TEXT NOT NULL,
+    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "updatedAt" TIMESTAMP(3) NOT NULL,
+
+    CONSTRAINT "TransactionNote_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateTable
+CREATE TABLE "FollowUp" (
+    "id" TEXT NOT NULL,
+    "transactionId" TEXT NOT NULL,
+    "authorId" TEXT NOT NULL,
+    "title" TEXT NOT NULL,
+    "description" TEXT,
+    "dueAt" TIMESTAMP(3) NOT NULL,
+    "status" "FollowUpStatus" NOT NULL DEFAULT 'OPEN',
+    "completedAt" TIMESTAMP(3),
+    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "updatedAt" TIMESTAMP(3) NOT NULL,
+
+    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateIndex
+CREATE INDEX "TransactionNote_transactionId_createdAt_idx" ON "TransactionNote"("transactionId", "createdAt");
+
+-- CreateIndex
+CREATE INDEX "TransactionNote_authorId_createdAt_idx" ON "TransactionNote"("authorId", "createdAt");
+
+-- CreateIndex
+CREATE INDEX "FollowUp_transactionId_dueAt_idx" ON "FollowUp"("transactionId", "dueAt");
+
+-- CreateIndex
+CREATE INDEX "FollowUp_authorId_status_dueAt_idx" ON "FollowUp"("authorId", "status", "dueAt");
+
+-- CreateIndex
+CREATE INDEX "FollowUp_status_dueAt_idx" ON "FollowUp"("status", "dueAt");
+
+-- AddForeignKey
+ALTER TABLE "TransactionNote" ADD CONSTRAINT "TransactionNote_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
+
+-- AddForeignKey
+ALTER TABLE "TransactionNote" ADD CONSTRAINT "TransactionNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
+
+-- AddForeignKey
+ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
+
+-- AddForeignKey
+ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


--- packages/db/prisma/schema.prisma
diff --git a/packages/db/prisma/schema.prisma b/packages/db/prisma/schema.prisma
index 0a7d29a..4758fbd 100644
--- a/packages/db/prisma/schema.prisma
+++ b/packages/db/prisma/schema.prisma
@@ -22,6 +22,8 @@ model User {
   accounts Account[]
   transactions Transaction[] @relation("SalesmanTransactions")
   deliveries  Delivery[]    @relation("SalesmanDeliveries")
+  transactionNotes TransactionNote[] @relation("TransactionNoteAuthor")
+  followUps FollowUp[] @relation("FollowUpAuthor")
 }
 
 model Session {
@@ -87,6 +89,12 @@ enum DocumentStatus {
   COMPLETED
 }
 
+enum FollowUpStatus {
+  OPEN
+  COMPLETED
+  CANCELED
+}
+
 model Client {
   id           String        @id @default(cuid())
   name         String
@@ -133,6 +141,8 @@ model Transaction {
   documents      Document[]
   workflowEvents WorkflowEvent[]
   deliveries     Delivery[]
+  notes          TransactionNote[]
+  followUps      FollowUp[]
 
   @@index([salesmanId, status, createdAt])
   @@index([clientId])
@@ -190,6 +200,41 @@ model Delivery {
   @@index([deliveredById, deliveredAt])
 }
 
+model TransactionNote {
+  id            String   @id @default(cuid())
+  transactionId String
+  authorId      String
+  body          String
+  createdAt     DateTime @default(now())
+  updatedAt     DateTime @updatedAt
+
+  transaction   Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
+  author        User        @relation("TransactionNoteAuthor", fields: [authorId], references: [id], onDelete: Restrict)
+
+  @@index([transactionId, createdAt])
+  @@index([authorId, createdAt])
+}
+
+model FollowUp {
+  id            String         @id @default(cuid())
+  transactionId String
+  authorId      String
+  title         String
+  description   String?
+  dueAt         DateTime
+  status        FollowUpStatus @default(OPEN)
+  completedAt   DateTime?
+  createdAt     DateTime       @default(now())
+  updatedAt     DateTime       @updatedAt
+
+  transaction   Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
+  author        User        @relation("FollowUpAuthor", fields: [authorId], references: [id], onDelete: Restrict)
+
+  @@index([transactionId, dueAt])
+  @@index([authorId, status, dueAt])
+  @@index([status, dueAt])
+}
+
 model WebhookIdempotency {
   id          String   @id @default(cuid())
   source      String

```

### Commit 2: b8805c6
**Message:** feat(crm): ship deployment pipeline and transaction UX fixes

**Diff:**
```diff
--- .dockerignore
diff --git a/.dockerignore b/.dockerignore
new file mode 100644
index 0000000..2d5e3e7
--- /dev/null
+++ b/.dockerignore
@@ -0,0 +1,13 @@
+node_modules
+.git
+.github
+.turbo
+.next
+dist
+coverage
+*.log
+.env
+.env.local
+.env.development.local
+.env.test.local
+.env.production.local


--- .env.example
diff --git a/.env.example b/.env.example
index 7910411..3a817e5 100644
--- a/.env.example
+++ b/.env.example
@@ -6,7 +6,8 @@ BETTER_AUTH_SECRET=your-secret-min-32-chars-here-change-me
 BETTER_AUTH_URL=http://localhost:3100
 
 # Apps
-NEXT_PUBLIC_BFF_URL=http://localhost:3100
+# Optional when web and BFF share the same origin via ingress/path routing.
+# NEXT_PUBLIC_BFF_URL=http://localhost:3100
 NEXTJS_ORIGIN=http://localhost:3000
 
 # Webhooks


--- .github/workflows/deploy-crm.yml
diff --git a/.github/workflows/deploy-crm.yml b/.github/workflows/deploy-crm.yml
new file mode 100644
index 0000000..06bd36f
--- /dev/null
+++ b/.github/workflows/deploy-crm.yml
@@ -0,0 +1,90 @@
+name: CI
+
+on:
+  push:
+    branches: ["main", "trunk"]
+    paths:
+      - .github/workflows/deploy-crm.yml
+      - .dockerignore
+      - docker/**
+      - apps/bff/**
+      - apps/web/**
+      - packages/**
+      - package.json
+      - package-lock.json
+      - turbo.json
+  workflow_dispatch:
+  pull_request:
+    types: [opened, synchronize]
+
+permissions:
+  contents: read
+
+env:
+  REGION: ${{ vars.GCP_DEFAULT_REGION }}
+  PROJECT_ID: ${{ vars.GCP_PROJECT_ID }}
+  WEB_GAR_LOCATION: ${{ vars.GCP_DEFAULT_REGION }}-docker.pkg.dev/${{ vars.GCP_PROJECT_ID }}/docker-images/idauto-crm-web
+  BFF_GAR_LOCATION: ${{ vars.GCP_DEFAULT_REGION }}-docker.pkg.dev/${{ vars.GCP_PROJECT_ID }}/docker-images/idauto-crm-bff
+  BRANCH_NAME: ${{ github.head_ref || github.ref_name }}
+
+jobs:
+  build:
+    name: Build and Push Images
+    timeout-minutes: 30
+    runs-on: ubuntu-latest
+
+    steps:
+      - name: Check out code
+        uses: actions/checkout@v4
+        with:
+          fetch-depth: 2
+
+      - name: Setup Node.js environment
+        uses: actions/setup-node@v4
+        with:
+          node-version: 20
+          cache: npm
+
+      - name: Install dependencies
+        run: npm ci
+
+      - name: Generate Prisma Client
+        run: npm run db:generate --workspace @repo/db
+
+      - name: Type check
+        run: npm run check-types
+
+      - name: Build project
+        run: npx turbo run build --filter=@repo/bff --filter=web
+
+      - name: Auth
+        uses: google-github-actions/auth@v2
+        with:
+          credentials_json: "${{ secrets.GCP_SA_KEY }}"
+
+      - name: Set up Cloud SDK
+        uses: google-github-actions/setup-gcloud@v2
+
+      - name: Use gcloud CLI
+        run: gcloud info
+
+      - name: Docker auth
+        run: gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev --quiet
+
+      - name: Build and Push Web Docker image
+        run: |
+          SHORT_SHA=${GITHUB_SHA::7}
+          BRANCH=$(echo "${{ env.BRANCH_NAME }}" | tr / - | tr '[:upper:]' '[:lower:]' | xargs)
+          docker build . \
+            -f docker/web.Dockerfile \
+            -t ${{ env.WEB_GAR_LOCATION }}:$BRANCH-$SHORT_SHA
+          docker push ${{ env.WEB_GAR_LOCATION }}:$BRANCH-$SHORT_SHA
+
+      - name: Build and Push BFF Docker image
+        run: |
+          SHORT_SHA=${GITHUB_SHA::7}
+          BRANCH=$(echo "${{ env.BRANCH_NAME }}" | tr / - | tr '[:upper:]' '[:lower:]' | xargs)
+          docker build . \
+            -f docker/bff.Dockerfile \
+            -t ${{ env.BFF_GAR_LOCATION }}:$BRANCH-$SHORT_SHA
+          docker push ${{ env.BFF_GAR_LOCATION }}:$BRANCH-$SHORT_SHA


--- apps/bff/src/modules/alberto/alberto-api.ts
diff --git a/apps/bff/src/modules/alberto/alberto-api.ts b/apps/bff/src/modules/alberto/alberto-api.ts
index d3c932d..9180006 100644
--- a/apps/bff/src/modules/alberto/alberto-api.ts
+++ b/apps/bff/src/modules/alberto/alberto-api.ts
@@ -13,6 +13,29 @@ function normalizeAlbertoBaseUrl(raw: string): string {
   return raw.replace(/\/+$/, "");
 }
 
+function readAlbertoBaseUrl(): string | null {
+  const configured = process.env.ALBERTO_BASE_URL?.trim();
+  if (configured) {
+    return configured;
+  }
+
+  const legacyAlias = process.env.ALB_BASE_URL?.trim();
+  if (legacyAlias) {
+    return legacyAlias;
+  }
+
+  return null;
+}
+
+function requireAlbertoBaseUrl(): string {
+  const baseUrl = readAlbertoBaseUrl();
+  if (!baseUrl) {
+    throw new Error("Missing ALBERTO_BASE_URL.");
+  }
+
+  return normalizeAlbertoBaseUrl(baseUrl);
+}
+
 export function rutNumericBodyForAlberto(fullRut: string): string {
   const cleared = fullRut.replace(/[.\s-]/g, "").toUpperCase();
   if (cleared.length < 2) {
@@ -22,19 +45,28 @@ export function rutNumericBodyForAlberto(fullRut: string): string {
   return cleared.slice(0, -1);
 }
 
+/**
+ * RUT digits + verifier, no separators (legacy adminweb `formatAlbRut`).
+ * Some Alberto deployments expect this shape instead of body-only.
+ */
+export function rutDigitsWithDvForAlbertoLegacy(fullRut: string): string {
+  return fullRut.replace(/[.\s-]/g, "").replace(/k$/i, "K");
+}
+
 export function normalizePlate(value: string): string {
   return value.replace(/[.\s-]/g, "").toUpperCase();
 }
 
 export function isAlbertoApiConfigured(): boolean {
   return Boolean(
-    process.env.ALBERTO_BASE_URL?.trim() &&
+    readAlbertoBaseUrl() &&
       process.env.FIREBASE_WEB_API_KEY?.trim() &&
       process.env.FIREBASE_ENRICHMENT_UID?.trim() &&
       process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
   );
 }
 
+/** Custom token for FIREBASE_ENRICHMENT_UID — Alberto ticket may be scoped to that user, not arbitrary RUTs. */
 export async function mintFirebaseIdTokenForEnrichment(): Promise<string> {
   const apiKey = process.env.FIREBASE_WEB_API_KEY?.trim();
   const uid = process.env.FIREBASE_ENRICHMENT_UID?.trim();
@@ -65,7 +97,7 @@ export async function mintFirebaseIdTokenForEnrichment(): Promise<string> {
 }
 
 export async function exchangeIdTokenForAlbertoTicket(idToken: string): Promise<string> {
-  const base = normalizeAlbertoBaseUrl(process.env.ALBERTO_BASE_URL!.trim());
+  const base = requireAlbertoBaseUrl();
   const response = await fetch(`${base}/auth/by-token`, {
     method: "GET",
     headers: {
@@ -101,22 +133,38 @@ interface GetInscriptionsResponse {
   success: boolean;
   result?: {
     total: number;
-    data: AlbertoVehicleRow[];
+    data?: AlbertoVehicleRow[];
   };
 }
 
-export async function fetchAlbertoVehicles(
+function parseGetInscriptionsRows(data: GetInscriptionsResponse): AlbertoVehicleRow[] {
+  if (!data.success) {
+    throw new Error("Alberto get_inscriptions returned success=false.");
+  }
+
+  const raw = data.result?.data;
+  if (Array.isArray(raw)) {
+    return raw;
+  }
+
+  if (data.result && typeof data.result.total === "number" && data.result.total === 0) {
+    return [];
+  }
+
+  throw new Error("Alberto get_inscriptions response missing result.data array.");
+}
+
+async function postGetInscriptions(
   ticket: string,
-  rutFull: string,
+  rutPayload: string,
 ): Promise<AlbertoVehicleRow[]> {
-  const base = normalizeAlbertoBaseUrl(process.env.ALBERTO_BASE_URL!.trim());
-  const rutBody = rutNumericBodyForAlberto(rutFull);
+  const base = requireAlbertoBaseUrl();
   const response = await fetch(
     `${base}/idai-service/get_inscriptions?ticket=${encodeURIComponent(ticket)}`,
     {
       method: "POST",
       headers: { "Content-Type": "application/json" },
-      body: JSON.stringify({ rut: rutBody }),
+      body: JSON.stringify({ rut: rutPayload }),
       signal: AbortSignal.timeout(30_000),
     },
   );
@@ -126,11 +174,38 @@ export async function fetchAlbertoVehicles(
   }
 
   const data = (await response.json()) as GetInscriptionsResponse;
-  if (!data.success || !data.result?.data) {
-    throw new Error("Alberto get_inscriptions returned unsuccessful payload.");
+  return parseGetInscriptionsRows(data);
+}
+
+export interface AlbertoVehiclesFetchResult {
+  readonly rows: AlbertoVehicleRow[];
+  /** Payload sent in JSON `{ rut }` for the attempt that produced `rows`. */
+  readonly rutPayloadUsed: string;
+}
+
+/**
+ * Loads inscriptions from Alberto. Tries numeric body (Bruno / adminweb restClient),
+ * then full digits+DV (legacy AlbIntegration) when the first response is empty.
+ */
+export async function fetchAlbertoVehicles(
+  ticket: string,
+  rutFull: string,
+): Promise<AlbertoVehiclesFetchResult> {
+  const bodyOnly = rutNumericBodyForAlberto(rutFull);
+  const rowsBody = await postGetInscriptions(ticket, bodyOnly);
+  if (rowsBody.length > 0) {
+    return { rows: rowsBody, rutPayloadUsed: bodyOnly };
+  }
+
+  const legacyFull = rutDigitsWithDvForAlbertoLegacy(rutFull).toUpperCase();
+  if (legacyFull !== bodyOnly) {
+    const rowsLegacy = await postGetInscriptions(ticket, legacyFull);

--- apps/bff/src/modules/alberto/enrich.service.ts
diff --git a/apps/bff/src/modules/alberto/enrich.service.ts b/apps/bff/src/modules/alberto/enrich.service.ts
index 45146d1..601443c 100644
--- a/apps/bff/src/modules/alberto/enrich.service.ts
+++ b/apps/bff/src/modules/alberto/enrich.service.ts
@@ -14,8 +14,13 @@ import {
   pickVehicleForPlate,
   shouldFillVehicleString,
 } from "./alberto-api.js";
+
+/** Shown when Alberto returns an empty inscription list for a known-good RUT. */
+const ALBERTO_EMPTY_VEHICLES_HINT =
+  "Alberto devolvio 0 vehiculos. El CRM usa un ticket generado con FIREBASE_ENRICHMENT_UID (no la sesion del cliente en la app). Si Alberto filtra get_inscriptions por titular del token, la lista queda vacia aunque el cliente tenga inscripciones. Revisa permisos del UID de enriquecimiento o el contrato del endpoint.";
 import {
   findFirestoreUserByRut,
+  FirestoreAccessError,
   getPortadoxFirestore,
 } from "./firestore-client.js";
 import {
@@ -46,6 +51,10 @@ export interface AlbertoFirestoreUserPreview {
 export interface AlbertoApiPreview {
   configured: boolean;
   error?: string;
+  /** Last `{ rut }` payload sent to get_inscriptions (numeric body or full digits+DV). */
+  rutPayloadUsed?: string;
+  /** Present when configured, no transport error, and vehicle list is empty. */
+  emptyVehiclesNote?: string;
   vehicles: Array<{
     make: string;
     plate: string;
@@ -74,6 +83,49 @@ export interface AlbertoEnrichPreviewResult {
   alberto: AlbertoApiPreview;
 }
 
+function toEnrichConfigError(error: unknown): EnrichConfigError {
+  return new EnrichConfigError(
+    error instanceof Error ? error.message : "Firestore access failed.",
+  );
+}
+
+function requireFirestoreForEnrichment() {
+  try {
+    const db = getPortadoxFirestore();
+    if (!db) {
+      throw new EnrichConfigError(
+        "GOOGLE_APPLICATION_CREDENTIALS is not configured for Firestore access.",
+      );
+    }
+
+    return db;
+  } catch (error) {
+    if (error instanceof EnrichConfigError) {
+      throw error;
+    }
+
+    if (error instanceof FirestoreAccessError) {
+      throw toEnrichConfigError(error);
+    }
+
+    throw toEnrichConfigError(error);
+  }
+}
+
+async function findFirestoreUserByRutForEnrichment(rut: string) {
+  const db = requireFirestoreForEnrichment();
+
+  try {
+    return await findFirestoreUserByRut(db, rut);
+  } catch (error) {
+    if (error instanceof FirestoreAccessError) {
+      throw toEnrichConfigError(error);
+    }
+
+    throw error;
+  }
+}
+
 function str(v: unknown): string | null {
   if (typeof v !== "string") {
     return null;
@@ -116,7 +168,7 @@ async function buildAlbertoPreviewLayer(
   try {
     const idToken = await mintFirebaseIdTokenForEnrichment();
     const ticket = await exchangeIdTokenForAlbertoTicket(idToken);
-    const rows = await fetchAlbertoVehicles(ticket, rut);
+    const { rows, rutPayloadUsed } = await fetchAlbertoVehicles(ticket, rut);
     const vehicles = rows.map((row) => ({
       make: row.marca,
       plate: row.placa_patente,
@@ -141,6 +193,11 @@ async function buildAlbertoPreviewLayer(
 
     return {
       configured: true,
+      rutPayloadUsed,
+      emptyVehiclesNote:
+        vehicles.length === 0
+          ? `${ALBERTO_EMPTY_VEHICLES_HINT} Rut enviado a get_inscriptions: ${rutPayloadUsed}.`
+          : undefined,
       vehicles,
       matchedVehicle: match
         ? {
@@ -167,12 +224,7 @@ export async function previewAlbertoEnrich(
   rut: string,
   plate?: string,
 ): Promise<AlbertoEnrichPreviewResult> {
-  const db = getPortadoxFirestore();
-  if (!db) {
-    throw new EnrichConfigError(
-      "GOOGLE_APPLICATION_CREDENTIALS is not configured for Firestore access.",
-    );
-  }
+  requireFirestoreForEnrichment();
 
   const trimmedRut = rut.trim();
   const plateForMatch = (plate ?? "").trim();
@@ -183,7 +235,7 @@ export async function previewAlbertoEnrich(
     };
   }
 
-  const raw = await findFirestoreUserByRut(db, trimmedRut);
+  const raw = await findFirestoreUserByRutForEnrichment(trimmedRut);
   const alberto = await buildAlbertoPreviewLayer(trimmedRut, plateForMatch);
 
   if (!raw) {
@@ -210,15 +262,8 @@ export async function enrichTransactionFromAlberto(params: {
   rut: string;
   plate?: string;
 }): Promise<{ detail: TransactionDetail; appliedFields: string[] }> {
-  const db = getPortadoxFirestore();
-  if (!db) {
-    throw new EnrichConfigError(
-      "GOOGLE_APPLICATION_CREDENTIALS is not configured for Firestore access.",
-    );
-  }
-
   const trimmedRut = params.rut.trim();
-  const raw = await findFirestoreUserByRut(db, trimmedRut);
+  const raw = await findFirestoreUserByRutForEnrichment(trimmedRut);
   if (!raw) {
     throw new EnrichNotFoundError("No Firestore user matches this RUT.");
   }
@@ -268,7 +313,7 @@ export async function enrichTransactionFromAlberto(params: {
     try {
       const idToken = await mintFirebaseIdTokenForEnrichment();
       const albertoTicket = await exchangeIdTokenForAlbertoTicket(idToken);
-      const rows = await fetchAlbertoVehicles(albertoTicket, trimmedRut);
+      const { rows } = await fetchAlbertoVehicles(albertoTicket, trimmedRut);
       const plateForMatch = (params.plate ?? "").trim() || vehicle.plate;
       albertoMatch = pickVehicleForPlate(rows, plateForMatch);
 


--- apps/bff/src/modules/alberto/firestore-client.ts
diff --git a/apps/bff/src/modules/alberto/firestore-client.ts b/apps/bff/src/modules/alberto/firestore-client.ts
index fc867b4..9752c79 100644
--- a/apps/bff/src/modules/alberto/firestore-client.ts
+++ b/apps/bff/src/modules/alberto/firestore-client.ts
@@ -1,3 +1,4 @@
+import { existsSync } from "node:fs";
 import { getApps, initializeApp } from "firebase-admin/app";
 import type { App } from "firebase-admin/app";
 import { getFirestore } from "firebase-admin/firestore";
@@ -6,12 +7,15 @@ import type { Firestore } from "firebase-admin/firestore";
 let adminApp: App | null = null;
 let firestore: Firestore | null = null;
 
+export class FirestoreAccessError extends Error {}
+
 /**
  * Returns Firestore when GOOGLE_APPLICATION_CREDENTIALS points to a service account
  * with access to the Portadox Firebase project.
  */
 export function getPortadoxFirestore(): Firestore | null {
-  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
+  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
+  if (!credentialsPath) {
     return null;
   }
 
@@ -19,9 +23,23 @@ export function getPortadoxFirestore(): Firestore | null {
     return firestore;
   }
 
-  adminApp = getApps()[0] ?? initializeApp();
-  firestore = getFirestore(adminApp);
-  return firestore;
+  if (!existsSync(credentialsPath)) {
+    throw new FirestoreAccessError(
+      `GOOGLE_APPLICATION_CREDENTIALS points to a missing file: ${credentialsPath}`,
+    );
+  }
+
+  try {
+    adminApp = getApps()[0] ?? initializeApp();
+    firestore = getFirestore(adminApp);
+    return firestore;
+  } catch (error) {
+    throw new FirestoreAccessError(
+      error instanceof Error
+        ? `Failed to initialize Firestore Admin SDK: ${error.message}`
+        : "Failed to initialize Firestore Admin SDK.",
+    );
+  }
 }
 
 /**
@@ -53,28 +71,43 @@ export interface RawFirestoreUser {
   readonly data: Record<string, unknown>;
 }
 
+function resolveUsersCollectionName(raw?: string): string {
+  const trimmed = raw?.trim();
+  return trimmed && trimmed.length > 0 ? trimmed : "users";
+}
+
 export async function findFirestoreUserByRut(
   db: Firestore,
   rut: string,
-  usersCollection = process.env.FIRESTORE_USERS_COLLECTION ?? "users",
+  usersCollection = resolveUsersCollectionName(
+    process.env.FIRESTORE_USERS_COLLECTION,
+  ),
 ): Promise<RawFirestoreUser | null> {
-  const candidates = buildRutQueryCandidates(rut);
-  for (const candidate of candidates) {
-    const snap = await db
-      .collection(usersCollection)
-      .where("rut", "==", candidate)
-      .limit(1)
-      .get();
-
-    if (!snap.empty) {
-      const first = snap.docs[0];
-      if (!first) {
-        continue;
-      }
+  try {
+    const candidates = buildRutQueryCandidates(rut);
+    for (const candidate of candidates) {
+      const snap = await db
+        .collection(usersCollection)
+        .where("rut", "==", candidate)
+        .limit(1)
+        .get();
+
+      if (!snap.empty) {
+        const first = snap.docs[0];
+        if (!first) {
+          continue;
+        }
 
-      return { id: first.id, data: first.data() as Record<string, unknown> };
+        return { id: first.id, data: first.data() as Record<string, unknown> };
+      }
     }
-  }
 
-  return null;
+    return null;
+  } catch (error) {
+    throw new FirestoreAccessError(
+      error instanceof Error
+        ? `Failed to query Firestore collection "${usersCollection}": ${error.message}`
+        : `Failed to query Firestore collection "${usersCollection}".`,
+    );
+  }
 }


--- apps/bff/src/modules/transactions/delivery.service.ts
diff --git a/apps/bff/src/modules/transactions/delivery.service.ts b/apps/bff/src/modules/transactions/delivery.service.ts
index 03c8501..317f6a0 100644
--- a/apps/bff/src/modules/transactions/delivery.service.ts
+++ b/apps/bff/src/modules/transactions/delivery.service.ts
@@ -158,18 +158,18 @@ function buildDeliveryMessage(params: {
   }
 
   if (!params.clientFound) {
-    return "No encontramos una cuenta Id Auto para este cliente. Puedes invitarlo a registrarse y reintentar.";
+    return "No encontramos una cuenta activa para este cliente. Puedes invitarlo a registrarse y volver a intentar.";
   }
 
   if (params.deliveryStatus === "DELIVERED_TO_APP") {
-    return "Los documentos fueron entregados a la app Id Auto del cliente.";
+    return "Los documentos quedaron disponibles en la app del cliente.";
   }
 
   if (params.deliveryStatus === "PENDING_IDAUTO_DELIVERY") {
-    return "La entrega quedo pendiente hacia Id Auto. Revisa la configuracion del conector y vuelve a intentar.";
+    return "La entrega fue registrada y se esta procesando.";
   }
 
-  return "No pudimos completar la entrega en Id Auto. Revisa el detalle e intenta nuevamente.";
+  return "No pudimos completar la entrega. Intenta nuevamente en unos minutos.";
 }
 
 async function lookupClientInDatabase(
@@ -180,9 +180,9 @@ async function lookupClientInDatabase(
     `
       SELECT c."id", c."name"
       FROM "Client" c
-      WHERE ($1 IS NOT NULL AND LOWER(c."email") = LOWER($1))
-         OR ($2 IS NOT NULL AND c."phone" = $2)
-         OR ($3 IS NOT NULL AND c."rut" = $3)
+      WHERE ($1::text IS NOT NULL AND LOWER(c."email") = LOWER($1::text))
+         OR ($2::text IS NOT NULL AND c."phone" = $2::text)
+         OR ($3::text IS NOT NULL AND c."rut" = $3::text)
       LIMIT 1
     `,
     params.email,
@@ -262,7 +262,7 @@ export async function lookupClient(
 
   if (!hasLookupCriteria(normalized)) {
     throw new DeliveryValidationError(
-      "Provide email, phone or rut to search for a client.",
+      "Ingresa email, telefono o RUT para buscar al cliente.",
     );
   }
 
@@ -407,12 +407,12 @@ function deliverInDemo(
   );
 
   if (!transaction) {
-    throw new DeliveryNotFoundError("Transaction not found.");
+    throw new DeliveryNotFoundError("No encontramos esta venta.");
   }
 
   if (transaction.status !== "READY") {
     throw new DeliveryConflictError(
-      "Only READY transactions can be delivered to the client.",
+      "La entrega solo esta disponible cuando la venta esta lista para enviar.",
     );
   }
 
@@ -451,19 +451,19 @@ export async function deliverTransaction(
       );
 
       if (!transaction) {
-        throw new DeliveryNotFoundError("Transaction not found.");
+        throw new DeliveryNotFoundError("No encontramos esta venta.");
       }
 
       if (transaction.status !== "READY") {
         throw new DeliveryConflictError(
-          "Only READY transactions can be delivered to the client.",
+          "La entrega solo esta disponible cuando la venta esta lista para enviar.",
         );
       }
 
       const deliveryContact = buildDeliveryContact(transaction, input);
       if (!hasLookupCriteria(deliveryContact)) {
         throw new DeliveryValidationError(
-          "Delivery requires at least one client contact field.",
+          "Necesitamos al menos un dato de contacto para entregar los documentos.",
         );
       }
 


--- apps/bff/src/modules/transactions/transactions.routes.ts
diff --git a/apps/bff/src/modules/transactions/transactions.routes.ts b/apps/bff/src/modules/transactions/transactions.routes.ts
index 32e3164..344789c 100644
--- a/apps/bff/src/modules/transactions/transactions.routes.ts
+++ b/apps/bff/src/modules/transactions/transactions.routes.ts
@@ -242,7 +242,7 @@ export const transactionsRoutes: FastifyPluginAsync = async (app) => {
 
       if (!request.query.email && !request.query.phone && !request.query.rut) {
         reply.code(400).send({
-          message: "Provide email, phone or rut to search for a client.",
+          message: "Ingresa email, telefono o RUT para buscar al cliente.",
         });
         return;
       }


--- apps/bff/src/modules/transactions/workflow-webhook.service.ts
diff --git a/apps/bff/src/modules/transactions/workflow-webhook.service.ts b/apps/bff/src/modules/transactions/workflow-webhook.service.ts
index f954284..0a62aab 100644
--- a/apps/bff/src/modules/transactions/workflow-webhook.service.ts
+++ b/apps/bff/src/modules/transactions/workflow-webhook.service.ts
@@ -267,9 +267,9 @@ async function resolveClientId(db: SqlClient, input: WorkflowWebhookInput) {
     `
       SELECT c."id"
       FROM "Client" c
-      WHERE ($1 IS NOT NULL AND c."email" = $1)
-         OR ($2 IS NOT NULL AND c."phone" = $2)
-         OR ($3 IS NOT NULL AND c."rut" = $3)
+      WHERE ($1::text IS NOT NULL AND c."email" = $1::text)
+         OR ($2::text IS NOT NULL AND c."phone" = $2::text)
+         OR ($3::text IS NOT NULL AND c."rut" = $3::text)
       LIMIT 1
     `,
     client?.email ?? null,


--- apps/docs/app/docs/[[...slug]]/page.tsx
diff --git a/apps/docs/app/docs/[[...slug]]/page.tsx b/apps/docs/app/docs/[[...slug]]/page.tsx
index fd19091..a8c7549 100644
--- a/apps/docs/app/docs/[[...slug]]/page.tsx
+++ b/apps/docs/app/docs/[[...slug]]/page.tsx
@@ -1,5 +1,5 @@
 import { generateStaticParamsFor, importPage } from "nextra/pages";
-import { useMDXComponents } from "../../../mdx-components.js";
+import { useMDXComponents } from "../../../mdx-components";
 
 export const generateStaticParams = generateStaticParamsFor("slug");
 


--- apps/web/app/transactions/[id]/delivery-panel.tsx
diff --git a/apps/web/app/transactions/[id]/delivery-panel.tsx b/apps/web/app/transactions/[id]/delivery-panel.tsx
index e16cb09..b4723ca 100644
--- a/apps/web/app/transactions/[id]/delivery-panel.tsx
+++ b/apps/web/app/transactions/[id]/delivery-panel.tsx
@@ -1,7 +1,7 @@
 "use client";
 
 import { useRouter } from "next/navigation";
-import { useState, useTransition } from "react";
+import { useEffect, useState, useTransition } from "react";
 
 // TODO: replace with real App Store / Play Store links when available.
 const APP_STORE_URL = "#";
@@ -74,22 +74,23 @@ interface DeliveryPanelProps {
   clientName: string;
   defaultEmail: string | null;
   defaultPhone: string | null;
+  defaultRut: string | null;
   deliveries: TransactionDeliveryItem[];
 }
 
 function statusMessage(status: TransactionStatus) {
   if (status === "DELIVERED" || status === "VIEWED") {
-    return "Esta transaccion ya fue entregada al cliente.";
+    return "Esta venta ya fue enviada al cliente.";
   }
 
-  return "La entrega se habilita cuando la transaccion llega a estado READY.";
+  return "La entrega se habilita cuando la venta esta lista para enviar.";
 }
 
 const deliveryStatusLabels: Record<DeliveryStatus, string> = {
-  PENDING_CLIENT_MATCH: "Pendiente por matching",
-  PENDING_IDAUTO_DELIVERY: "Pendiente en Id Auto",
-  DELIVERED_TO_APP: "Entregado a la app",
-  DELIVERY_FAILED: "Error de entrega",
+  PENDING_CLIENT_MATCH: "Cliente por confirmar",
+  PENDING_IDAUTO_DELIVERY: "En proceso",
+  DELIVERED_TO_APP: "Disponible en la app",
+  DELIVERY_FAILED: "No se pudo enviar",
 };
 
 const deliveryStatusClasses: Record<DeliveryStatus, string> = {
@@ -103,13 +104,40 @@ const deliveryStatusClasses: Record<DeliveryStatus, string> = {
     "bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-200",
 };
 
-async function readErrorMessage(response: Response) {
+function isTechnicalError(message: string) {
+  const normalized = message.toLowerCase();
+  return (
+    normalized.includes("prisma") ||
+    normalized.includes("$queryrawunsafe") ||
+    normalized.includes("raw query failed") ||
+    normalized.includes("parameter $") ||
+    normalized.includes("code:") ||
+    normalized.includes("invalid `")
+  );
+}
+
+async function readErrorMessage(response: Response, fallback: string) {
   try {
     const data = (await response.json()) as ErrorResponse;
-    return data.message ?? `El BFF respondió con ${response.status}.`;
+    const raw = data.message?.trim();
+    if (!raw || response.status >= 500 || isTechnicalError(raw)) {
+      return fallback;
+    }
+
+    return raw;
   } catch {
-    return `El BFF respondió con ${response.status}.`;
+    return fallback;
+  }
+}
+
+function sanitizeDeliveryDetail(message: string | null) {
+  if (!message) {
+    return null;
   }
+
+  return isTechnicalError(message)
+    ? "No pudimos completar el envio. Intenta nuevamente."
+    : message;
 }
 
 export function DeliveryPanel({
@@ -118,12 +146,13 @@ export function DeliveryPanel({
   clientName,
   defaultEmail,
   defaultPhone,
+  defaultRut,
   deliveries,
 }: DeliveryPanelProps) {
   const router = useRouter();
   const [email, setEmail] = useState(defaultEmail ?? "");
   const [phone, setPhone] = useState(defaultPhone ?? "");
-  const [rut, setRut] = useState("");
+  const [rut, setRut] = useState(defaultRut ?? "");
   const [lookupResult, setLookupResult] = useState<ClientLookupResponse | null>(
     null,
   );
@@ -133,21 +162,19 @@ export function DeliveryPanel({
   } | null>(null);
   const [isLookupPending, startLookupTransition] = useTransition();
   const [isDeliveryPending, startDeliveryTransition] = useTransition();
-  const bffUrl = process.env.NEXT_PUBLIC_BFF_URL;
+  const bffUrl = process.env.NEXT_PUBLIC_BFF_URL ?? "";
 
   const canDeliver = status === "READY";
   const latestDelivery = deliveries[0] ?? null;
 
+  useEffect(() => {
+    setEmail(defaultEmail ?? "");
+    setPhone(defaultPhone ?? "");
+    setRut(defaultRut ?? "");
+  }, [defaultEmail, defaultPhone, defaultRut, transactionId]);
+
   const lookupClient = () => {
     startLookupTransition(async () => {
-      if (!bffUrl) {
-        setFeedback({
-          tone: "error",
-          message: "NEXT_PUBLIC_BFF_URL no esta configurado en la web.",
-        });
-        return;
-      }
-
       const query = new URLSearchParams();
       if (email.trim()) {
         query.set("email", email.trim());
@@ -180,7 +207,10 @@ export function DeliveryPanel({
         if (!response.ok) {
           setFeedback({
             tone: "error",
-            message: await readErrorMessage(response),
+            message: await readErrorMessage(
+              response,
+              "No pudimos validar los datos del cliente. Intenta nuevamente.",
+            ),
           });
           return;
         }
@@ -190,16 +220,13 @@ export function DeliveryPanel({
         setFeedback({
           tone: data.found ? "success" : "neutral",
           message: data.found
-            ? `Cliente encontrado en modo ${data.source}.`
-            : "No encontramos una cuenta coincidente con esos datos.",
+            ? "Encontramos datos del cliente."

--- apps/web/app/transactions/[id]/page.tsx
diff --git a/apps/web/app/transactions/[id]/page.tsx b/apps/web/app/transactions/[id]/page.tsx
index de92fcc..3946f3a 100644
--- a/apps/web/app/transactions/[id]/page.tsx
+++ b/apps/web/app/transactions/[id]/page.tsx
@@ -25,17 +25,26 @@ const statusClasses: Record<TransactionStatus, string> = {
     "bg-primary-100 text-primary-800 ring-1 ring-inset ring-primary-200",
 };
 
+const documentTypeLabels: Record<string, string> = {
+  FACTURA: "Factura",
+  NOTA_VENTA: "Nota de venta",
+  SOAP: "SOAP",
+  PERMISO_CIRCULACION: "Permiso de circulacion",
+  REVISION_TECNICA: "Revision tecnica",
+  PADRON: "Padron",
+  OTHER: "Otro documento",
+};
+
 const eventTypeLabels: Record<string, string> = {
-  "transaction.submitted": "Documentos enviados al broker",
-  "transaction.processing": "Workflow documental en proceso",
-  "transaction.ready": "Documentacion lista para entregar",
-  "transaction.delivered": "Entrega al cliente confirmada",
-  "transaction.delivery.pending-client-match":
-    "Entrega pendiente por matching de cliente",
-  "transaction.delivery.pending-idauto":
-    "Entrega pendiente de sincronizacion con Id Auto",
-  "transaction.delivery.failed": "Intento de entrega con error",
-  "transaction.viewed": "Cliente abrio los documentos",
+  "transaction.submitted": "Venta recibida",
+  "transaction.processing": "Documentacion en revision",
+  "transaction.ready": "Documentacion lista",
+  "transaction.delivered": "Documentos enviados al cliente",
+  "transaction.delivery.pending-client-match": "Cliente por confirmar",
+  "transaction.delivery.pending-idauto": "Entrega en proceso",
+  "transaction.delivery.failed": "No se pudo enviar",
+  "transaction.viewed": "Documentos revisados por el cliente",
+  "transaction.manual_alberto_import": "Venta creada manualmente",
 };
 
 function formatDate(value: string) {
@@ -64,6 +73,83 @@ function EmptyState({
   );
 }
 
+function isRecord(value: unknown): value is Record<string, unknown> {
+  return Boolean(value && typeof value === "object" && !Array.isArray(value));
+}
+
+function readString(value: unknown): string | null {
+  return typeof value === "string" && value.trim().length > 0 ? value : null;
+}
+
+function readStringArray(value: unknown): string[] {
+  if (!Array.isArray(value)) {
+    return [];
+  }
+
+  return value.filter(
+    (item): item is string => typeof item === "string" && item.trim().length > 0,
+  );
+}
+
+function formatDocumentList(documents: string[]) {
+  return documents
+    .map((document) => documentTypeLabels[document] ?? document)
+    .join(", ");
+}
+
+function describeWorkflowEvent(event: WorkflowEventItem) {
+  if (!isRecord(event.payload)) {
+    return [] as string[];
+  }
+
+  const payload = event.payload;
+
+  if (event.eventType === "transaction.submitted") {
+    const source = readString(payload.source);
+    return source === "broker" ? ["La venta ingreso automaticamente."] : [];
+  }
+
+  if (event.eventType === "transaction.processing") {
+    return ["La documentacion esta en revision."];
+  }
+
+  if (event.eventType === "transaction.ready") {
+    const documents = readStringArray(payload.documents);
+    return documents.length > 0
+      ? [`Documentos listos: ${formatDocumentList(documents)}.`]
+      : ["La documentacion quedo lista para entregar."];
+  }
+
+  if (event.eventType === "transaction.delivered") {
+    return ["Los documentos fueron enviados al cliente."];
+  }
+
+  if (event.eventType === "transaction.viewed") {
+    return ["El cliente ya reviso sus documentos."];
+  }
+
+  if (event.eventType === "transaction.delivery.pending-client-match") {
+    return ["Todavia no encontramos una cuenta activa para este cliente."];
+  }
+
+  if (event.eventType === "transaction.delivery.pending-idauto") {
+    return ["La entrega fue registrada y se esta procesando."];
+  }
+
+  if (event.eventType === "transaction.delivery.failed") {
+    return ["No pudimos completar la entrega. Intenta nuevamente."];
+  }
+
+  if (event.eventType === "transaction.manual_alberto_import") {
+    const plate = readString(payload.plate);
+    return plate
+      ? [`Venta creada manualmente con la patente ${plate}.`]
+      : ["Venta creada manualmente desde esta pantalla."];
+  }
+
+  return [];
+}
+
 function SummaryCard({
   title,
   children,
@@ -90,7 +176,7 @@ function WorkflowPanel({
 }) {
   if (errorMessage) {
     return (
-      <SummaryCard title="Timeline workflow">
+      <SummaryCard title="Historial de la venta">
         <p className="text-sm text-gray-600">{errorMessage}</p>
       </SummaryCard>
     );
@@ -98,47 +184,53 @@ function WorkflowPanel({
 
   if (!items || items.length === 0) {
     return (
-      <SummaryCard title="Timeline workflow">
+      <SummaryCard title="Historial de la venta">
         <p className="text-sm text-gray-600">
-          Aun no hay eventos de workflow para esta transaccion.
+          Aun no hay movimientos registrados en esta venta.
         </p>
       </SummaryCard>
     );
   }
 
   return (
-    <SummaryCard title="Timeline workflow">

--- apps/web/app/transactions/[id]/transaction-detail-live.tsx
diff --git a/apps/web/app/transactions/[id]/transaction-detail-live.tsx b/apps/web/app/transactions/[id]/transaction-detail-live.tsx
index 25fd95e..65e8776 100644
--- a/apps/web/app/transactions/[id]/transaction-detail-live.tsx
+++ b/apps/web/app/transactions/[id]/transaction-detail-live.tsx
@@ -145,10 +145,10 @@ const followUpStatusClasses: Record<FollowUpStatus, string> = {
 };
 
 const deliveryStatusLabels: Record<DeliveryStatus, string> = {
-  PENDING_CLIENT_MATCH: "Pendiente por matching",
-  PENDING_IDAUTO_DELIVERY: "Pendiente en Id Auto",
-  DELIVERED_TO_APP: "Entregado a la app",
-  DELIVERY_FAILED: "Error de entrega",
+  PENDING_CLIENT_MATCH: "Cliente por confirmar",
+  PENDING_IDAUTO_DELIVERY: "En proceso",
+  DELIVERED_TO_APP: "Disponible en la app",
+  DELIVERY_FAILED: "No se pudo enviar",
 };
 
 const deliveryStatusClasses: Record<DeliveryStatus, string> = {
@@ -169,6 +169,53 @@ function formatDate(value: string) {
   }).format(new Date(value));
 }
 
+const appliedFieldLabels: Record<string, string> = {
+  "client.name": "nombre del cliente",
+  "client.email": "email del cliente",
+  "client.phone": "telefono del cliente",
+  "client.rut": "RUT del cliente",
+  "vehicle.make": "marca del vehiculo",
+  "vehicle.model": "modelo del vehiculo",
+  "vehicle.year": "año del vehiculo",
+  "transaction.created": "venta creada",
+  "document.FACTURA": "factura",
+  "document.NOTA_VENTA": "nota de venta",
+  "document.SOAP": "SOAP",
+  "document.PERMISO_CIRCULACION": "permiso de circulacion",
+  "document.REVISION_TECNICA": "revision tecnica",
+  "document.PADRON": "padron",
+};
+
+function isTechnicalMessage(message: string) {
+  const normalized = message.toLowerCase();
+  return (
+    normalized.includes("firestore") ||
+    normalized.includes("firebase") ||
+    normalized.includes("alberto") ||
+    normalized.includes("google_application_credentials") ||
+    normalized.includes("custom token") ||
+    normalized.includes("uid")
+  );
+}
+
+function formatVehicleYear(year: number | null) {
+  return year != null ? String(year) : "Año por confirmar";
+}
+
+function formatAppliedFields(appliedFields: string[]) {
+  return appliedFields.map((field) => appliedFieldLabels[field] ?? field);
+}
+
+function sanitizeDeliveryDetail(message: string | null) {
+  if (!message) {
+    return null;
+  }
+
+  return isTechnicalMessage(message)
+    ? "No pudimos completar el envio. Intenta nuevamente."
+    : message;
+}
+
 function SummaryCard({
   title,
   children,
@@ -192,10 +239,10 @@ function DeliveryHistory({
   deliveries: TransactionDeliveryItem[];
 }) {
   return (
-    <SummaryCard title="Intentos de entrega">
+    <SummaryCard title="Historial de entregas">
       {deliveries.length === 0 ? (
         <p className="text-sm text-gray-600">
-          Aun no hay intentos registrados hacia Id Auto para esta transaccion.
+          Aun no hay envios registrados para esta venta.
         </p>
       ) : (
         <div className="space-y-3">
@@ -211,10 +258,10 @@ function DeliveryHistory({
                     {formatDate(delivery.deliveredAt)}
                   </p>
                   <p className="mt-1 text-xs text-gray-600">
-                    Canal {delivery.channel} ·{" "}
+                    Canal app del cliente ·{" "}
                     {delivery.clientFound
-                      ? "cuenta Id Auto encontrada"
-                      : "cuenta Id Auto no encontrada"}
+                      ? "cliente identificado"
+                      : "cliente pendiente de validacion"}
                   </p>
                 </div>
                 <span
@@ -232,14 +279,11 @@ function DeliveryHistory({
 
               {delivery.providerError ? (
                 <p className="mt-2 text-sm text-rose-700">
-                  Error: {delivery.providerError}
+                  {sanitizeDeliveryDetail(delivery.providerError)}
                 </p>
               ) : null}
 
               <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
-                {delivery.providerDeliveryId ? (
-                  <span>Id externo: {delivery.providerDeliveryId}</span>
-                ) : null}
                 {delivery.notifiedAt ? (
                   <span>Notificado {formatDate(delivery.notifiedAt)}</span>
                 ) : null}
@@ -281,7 +325,6 @@ function isOverdue(followUp: TransactionFollowUpItem) {
 }
 
 interface AlbertoPreviewUser {
-  firestoreUserId: string;
   rut: string | null;
   name: string | null;
   email: string | null;
@@ -295,14 +338,11 @@ interface AlbertoApiPreview {
     make: string;
     plate: string;
     year: number | null;
-    uniqueId: string;
-    estado: string;
   }>;
   matchedVehicle: {
     make: string;
     plate: string;
     year: number | null;
-    uniqueId: string;
   } | null;
   documents: Array<{
     albertoType: string;
@@ -319,7 +359,7 @@ function AlbertoEnrichPanel({
   onUpdated,
 }: {
   detail: TransactionDetailResponse;
-  bffUrl?: string;
+  bffUrl: string;
   onUpdated: (next: TransactionDetailResponse) => void;
 }) {
   const [rutInput, setRutInput] = useState(detail.client.rut ?? "");
@@ -340,11 +380,6 @@ function AlbertoEnrichPanel({
 

--- apps/web/app/transactions/import-from-alberto-panel.tsx
diff --git a/apps/web/app/transactions/import-from-alberto-panel.tsx b/apps/web/app/transactions/import-from-alberto-panel.tsx
index 3fe21f9..3e3ea48 100644
--- a/apps/web/app/transactions/import-from-alberto-panel.tsx
+++ b/apps/web/app/transactions/import-from-alberto-panel.tsx
@@ -4,7 +4,6 @@ import { useRouter } from "next/navigation";
 import { useState, useTransition } from "react";
 
 interface AlbertoPreviewUser {
-  firestoreUserId: string;
   rut: string | null;
   name: string | null;
   email: string | null;
@@ -18,14 +17,11 @@ interface AlbertoApiPreview {
     make: string;
     plate: string;
     year: number | null;
-    uniqueId: string;
-    estado: string;
   }>;
   matchedVehicle: {
     make: string;
     plate: string;
     year: number | null;
-    uniqueId: string;
   } | null;
   documents: Array<{
     albertoType: string;
@@ -40,7 +36,7 @@ const inputClass =
   "mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200";
 
 export function ImportFromAlbertoPanel() {
-  const bffUrl = process.env.NEXT_PUBLIC_BFF_URL;
+  const bffUrl = process.env.NEXT_PUBLIC_BFF_URL ?? "";
   const router = useRouter();
   const [rut, setRut] = useState("");
   const [plate, setPlate] = useState("");
@@ -53,18 +49,6 @@ export function ImportFromAlbertoPanel() {
   const [isPreviewPending, startPreview] = useTransition();
   const [isCreatePending, startCreate] = useTransition();
 
-  if (!bffUrl) {
-    return (
-      <section className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
-        Define{" "}
-        <code className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
-          NEXT_PUBLIC_BFF_URL
-        </code>{" "}
-        para cargar ventas desde Alberto.
-      </section>
-    );
-  }
-
   const runPreview = () => {
     startPreview(async () => {
       const r = rut.trim();
@@ -84,18 +68,16 @@ export function ImportFromAlbertoPanel() {
         });
 
         if (response.status === 503) {
-          const body = (await response.json()) as { message?: string };
           setPreview(null);
           setFeedback(
-            body.message ??
-              "Firestore no disponible (revisa GOOGLE_APPLICATION_CREDENTIALS en el BFF).",
+            "No pudimos consultar los datos en este momento. Intenta nuevamente.",
           );
           return;
         }
 
         if (!response.ok) {
           setPreview(null);
-          setFeedback(`No se pudo previsualizar (${response.status}).`);
+          setFeedback("No pudimos revisar los datos. Intenta nuevamente.");
           return;
         }
 
@@ -106,25 +88,17 @@ export function ImportFromAlbertoPanel() {
         };
         setPreview(body);
         if (!body.found) {
-          setFeedback(
-            body.alberto.configured && body.alberto.error
-              ? `Sin usuario Firestore. Alberto: ${body.alberto.error}`
-              : "No se encontro un usuario en Firestore con ese RUT.",
-          );
+          setFeedback("No encontramos datos del cliente con ese RUT.");
         } else {
           setFeedback(
             body.alberto.configured && body.alberto.error
-              ? `Firestore OK. Alberto: ${body.alberto.error}`
-              : null,
+              ? "Encontramos al cliente, pero no pudimos traer informacion adicional del vehiculo."
+              : "Encontramos datos para crear la venta.",
           );
         }
-      } catch (error) {
+      } catch {
         setPreview(null);
-        setFeedback(
-          error instanceof Error
-            ? error.message
-            : "Error al consultar Firestore/Alberto.",
-        );
+        setFeedback("No pudimos consultar los datos en este momento.");
       }
     });
   };
@@ -156,10 +130,7 @@ export function ImportFromAlbertoPanel() {
         }
 
         if (response.status === 404) {
-          const body = (await response.json()) as { message?: string };
-          setFeedback(
-            body.message ?? "No se encontro usuario Firestore para ese RUT.",
-          );
+          setFeedback("No encontramos datos para ese RUT.");
           return;
         }
 
@@ -170,8 +141,9 @@ export function ImportFromAlbertoPanel() {
         }
 
         if (response.status === 503) {
-          const body = (await response.json()) as { message?: string };
-          setFeedback(body.message ?? "Configuracion del BFF incompleta.");
+          setFeedback(
+            "No pudimos completar los datos ahora. Intenta nuevamente.",
+          );
           return;
         }
 
@@ -183,12 +155,8 @@ export function ImportFromAlbertoPanel() {
         const body = (await response.json()) as { detail: { id: string } };
         router.push(`/transactions/${encodeURIComponent(body.detail.id)}`);
         router.refresh();
-      } catch (error) {
-        setFeedback(
-          error instanceof Error
-            ? error.message
-            : "Error al crear la transaccion.",
-        );
+      } catch {
+        setFeedback("No pudimos crear la venta. Intenta nuevamente.");
       }
     });
   };
@@ -198,12 +166,11 @@ export function ImportFromAlbertoPanel() {
       <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
         <div>
           <h2 className="text-sm font-semibold tracking-tight text-gray-900">

--- apps/web/app/transactions/page.tsx
diff --git a/apps/web/app/transactions/page.tsx b/apps/web/app/transactions/page.tsx
index 694a844..3f1d2e7 100644
--- a/apps/web/app/transactions/page.tsx
+++ b/apps/web/app/transactions/page.tsx
@@ -86,8 +86,8 @@ export default async function TransactionsPage({
     return (
       <div className="mx-auto max-w-6xl px-4">
         <EmptyState
-          title="Falta configurar el BFF"
-          description="Define NEXT_PUBLIC_BFF_URL para que la web pueda consultar el backend CRM."
+          title="No pudimos cargar las ventas"
+          description="Intenta nuevamente en unos minutos."
         />
       </div>
     );
@@ -98,7 +98,7 @@ export default async function TransactionsPage({
       <div className="mx-auto max-w-6xl px-4">
         <EmptyState
           title="Tu sesion no esta disponible"
-          description="Inicia sesion desde el flujo de Better Auth para ver tus transacciones asignadas."
+          description="Inicia sesion para ver tus ventas asignadas."
         />
       </div>
     );
@@ -108,8 +108,8 @@ export default async function TransactionsPage({
     return (
       <div className="mx-auto max-w-6xl px-4">
         <EmptyState
-          title="No encontramos transacciones"
-          description="No se encontraron transacciones para el vendedor autenticado."
+          title="No encontramos ventas"
+          description="No encontramos ventas asignadas para tu usuario."
         />
       </div>
     );
@@ -119,7 +119,7 @@ export default async function TransactionsPage({
     return (
       <div className="mx-auto max-w-6xl px-4">
         <EmptyState
-          title="No pudimos cargar las transacciones"
+          title="No pudimos cargar las ventas"
           description={result.message}
         />
       </div>
@@ -143,7 +143,7 @@ export default async function TransactionsPage({
               ID Auto CRM
             </p>
             <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
-              Mis transacciones
+              Mis ventas
             </h1>
             <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
               Estado documental, busqueda operativa y seguimiento por venta.
@@ -161,7 +161,7 @@ export default async function TransactionsPage({
             </div>
             <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
               <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
-                Ready
+                Listas
               </p>
               <p className="mt-0.5 text-sm font-medium text-gray-800">
                 {summary.readyToDeliver} para entregar
@@ -169,7 +169,7 @@ export default async function TransactionsPage({
             </div>
             <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
               <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
-                Follow-ups
+                Seguimientos
               </p>
               <p className="mt-0.5 text-sm font-medium text-gray-800">
                 {summary.openFollowUps} abiertos
@@ -273,12 +273,12 @@ export default async function TransactionsPage({
           title={
             hasActiveFilters
               ? "No hay resultados para esos filtros"
-              : "Aun no hay transacciones"
+              : "Aun no hay ventas"
           }
           description={
             hasActiveFilters
               ? "Prueba otra busqueda, estado o un rango de fechas mas amplio."
-              : "Registra una venta con RUT y patente arriba (enriquecimiento Alberto), o espera al webhook del broker."
+              : "Registra una venta con RUT y patente arriba o espera la sincronizacion automatica."
           }
         />
       ) : (
@@ -341,7 +341,7 @@ export default async function TransactionsPage({
                         {transaction.vehicle.make} {transaction.vehicle.model}
                       </p>
                       <p className="mt-0.5 text-xs text-gray-600">
-                        {transaction.vehicle.year ?? "Ano sin registrar"}
+                        {transaction.vehicle.year ?? "Año por confirmar"}
                       </p>
                     </td>
                     <td className="px-5 py-3">


--- apps/web/lib/auth-client.ts
diff --git a/apps/web/lib/auth-client.ts b/apps/web/lib/auth-client.ts
index 8ca6424..3109014 100644
--- a/apps/web/lib/auth-client.ts
+++ b/apps/web/lib/auth-client.ts
@@ -1,5 +1,5 @@
 import { createAuthClient } from "better-auth/react";
 
 export const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
-  baseURL: process.env.NEXT_PUBLIC_BFF_URL,
+  baseURL: process.env.NEXT_PUBLIC_BFF_URL?.trim() || undefined,
 });


--- apps/web/lib/crm-client.ts
diff --git a/apps/web/lib/crm-client.ts b/apps/web/lib/crm-client.ts
index 2683759..86026d9 100644
--- a/apps/web/lib/crm-client.ts
+++ b/apps/web/lib/crm-client.ts
@@ -177,8 +177,34 @@ export type ApiResult<T> =
       message: string;
     };
 
+function normalizeBaseUrl(value: string) {
+  return value.replace(/\/+$/, "");
+}
+
+async function resolveBffBaseUrl() {
+  const configuredBaseUrl = process.env.NEXT_PUBLIC_BFF_URL?.trim();
+  if (configuredBaseUrl) {
+    return normalizeBaseUrl(configuredBaseUrl);
+  }
+
+  const requestHeaders = await headers();
+  const host =
+    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
+  if (!host) {
+    return null;
+  }
+
+  const protocol =
+    requestHeaders.get("x-forwarded-proto") ??
+    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
+      ? "http"
+      : "https");
+
+  return `${protocol}://${host}`;
+}
+
 async function fetchFromBff<T>(path: string): Promise<ApiResult<T>> {
-  const baseUrl = process.env.NEXT_PUBLIC_BFF_URL;
+  const baseUrl = await resolveBffBaseUrl();
   if (!baseUrl) {
     return {
       kind: "missing-config",


--- deploy/README.md
diff --git a/deploy/README.md b/deploy/README.md
new file mode 100644
index 0000000..9dfdbf4
--- /dev/null
+++ b/deploy/README.md
@@ -0,0 +1,48 @@
+# Deploy
+
+`idauto-crm` now follows the same split as `scrappers` and `conciliador`:
+
+- this repo only builds and publishes Docker images
+- Kubernetes deploys live in `helm-idauto-gcr`
+- runtime secrets are hydrated from GCP Secret Manager through `helm-idauto-gcr/.activate`
+
+## CI in this repo
+
+The workflow in `.github/workflows/deploy-crm.yml` now does only:
+
+- install dependencies
+- generate Prisma client
+- type-check and build
+- push `idauto-crm-web` and `idauto-crm-bff` images to Artifact Registry
+
+Required GitHub configuration in `idauto-crm`:
+
+- secret: `GCP_SA_KEY`
+- variable: `GCP_PROJECT_ID`
+- variable: `GCP_DEFAULT_REGION`
+
+No runtime application secrets should live in this repository's GitHub configuration anymore.
+
+## Runtime source of truth
+
+Deployment now belongs in `helm-idauto-gcr`:
+
+- `packages/idauto-crm-web`
+- `packages/idauto-crm-bff`
+- `packages/idauto-secrets`
+
+Recommended cluster secret:
+
+- `prod-idauto-secrets-crm`
+
+Expected CRM runtime keys:
+
+- required: `DATABASE_URL`, `BETTER_AUTH_SECRET`
+- probable: `WEBHOOK_SECRET`
+- optional integrations: `IDAUTO_DELIVERY_SECRET`, `IDAUTO_DELIVERY_ENDPOINT`, `IDAUTO_DELIVERY_TIMEOUT_MS`, `ALBERTO_BASE_URL`, `FIREBASE_WEB_API_KEY`, `FIREBASE_ENRICHMENT_UID`, `FIRESTORE_USERS_COLLECTION`
+
+`prod-idauto-secrets-firebase-sa` can keep backing `GOOGLE_APPLICATION_CREDENTIALS` for Firestore/Alberto enrichment.
+
+## Legacy note
+
+`deploy/helm/crm-stack` remains only as bootstrap reference. It should no longer be treated as the production deployment source of truth.


--- deploy/helm/crm-stack/Chart.yaml
diff --git a/deploy/helm/crm-stack/Chart.yaml b/deploy/helm/crm-stack/Chart.yaml
new file mode 100644
index 0000000..d163279
--- /dev/null
+++ b/deploy/helm/crm-stack/Chart.yaml
@@ -0,0 +1,6 @@
+apiVersion: v2
+name: crm-stack
+description: Portable web plus BFF deployment for the CRM stack.
+type: application
+version: 0.1.0
+appVersion: "0.1.0"


--- deploy/helm/crm-stack/templates/_helpers.tpl
diff --git a/deploy/helm/crm-stack/templates/_helpers.tpl b/deploy/helm/crm-stack/templates/_helpers.tpl
new file mode 100644
index 0000000..3c4196d
--- /dev/null
+++ b/deploy/helm/crm-stack/templates/_helpers.tpl
@@ -0,0 +1,34 @@
+{{- define "crm-stack.name" -}}
+{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
+{{- end -}}
+
+{{- define "crm-stack.fullname" -}}
+{{- if .Values.fullnameOverride -}}
+{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
+{{- else -}}
+{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
+{{- end -}}
+{{- end -}}
+
+{{- define "crm-stack.labels" -}}
+app.kubernetes.io/managed-by: {{ .Release.Service }}
+app.kubernetes.io/instance: {{ .Release.Name }}
+app.kubernetes.io/part-of: {{ include "crm-stack.name" . }}
+helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
+{{- end -}}
+
+{{- define "crm-stack.webName" -}}
+{{- printf "%s-web" (include "crm-stack.fullname" .) -}}
+{{- end -}}
+
+{{- define "crm-stack.bffName" -}}
+{{- printf "%s-bff" (include "crm-stack.fullname" .) -}}
+{{- end -}}
+
+{{- define "crm-stack.publicUrl" -}}
+{{- printf "%s://%s" .Values.ingress.scheme .Values.ingress.host -}}
+{{- end -}}
+
+{{- define "crm-stack.tlsSecretName" -}}
+{{- default (printf "%s-tls" (include "crm-stack.fullname" .)) .Values.ingress.tls.secretName -}}
+{{- end -}}


--- deploy/helm/crm-stack/templates/bff-deployment.yaml
diff --git a/deploy/helm/crm-stack/templates/bff-deployment.yaml b/deploy/helm/crm-stack/templates/bff-deployment.yaml
new file mode 100644
index 0000000..8fc042e
--- /dev/null
+++ b/deploy/helm/crm-stack/templates/bff-deployment.yaml
@@ -0,0 +1,93 @@
+apiVersion: apps/v1
+kind: Deployment
+metadata:
+  name: {{ include "crm-stack.bffName" . }}
+  labels:
+    {{- include "crm-stack.labels" . | nindent 4 }}
+    app.kubernetes.io/name: bff
+    app.kubernetes.io/component: api
+spec:
+  replicas: {{ .Values.bff.replicaCount }}
+  selector:
+    matchLabels:
+      app.kubernetes.io/instance: {{ .Release.Name }}
+      app.kubernetes.io/name: bff
+      app.kubernetes.io/component: api
+  template:
+    metadata:
+      labels:
+        {{- include "crm-stack.labels" . | nindent 8 }}
+        app.kubernetes.io/name: bff
+        app.kubernetes.io/component: api
+        {{- with .Values.bff.podLabels }}
+        {{- toYaml . | nindent 8 }}
+        {{- end }}
+      {{- with .Values.bff.podAnnotations }}
+      annotations:
+        {{- toYaml . | nindent 8 }}
+      {{- end }}
+    spec:
+      {{- with .Values.imagePullSecrets }}
+      imagePullSecrets:
+        {{- range . }}
+        - name: {{ . }}
+        {{- end }}
+      {{- end }}
+      containers:
+        - name: bff
+          image: "{{ required "bff.image.repository is required" .Values.bff.image.repository }}:{{ required "bff.image.tag is required" .Values.bff.image.tag }}"
+          imagePullPolicy: {{ .Values.bff.image.pullPolicy }}
+          ports:
+            - name: http
+              containerPort: {{ .Values.bff.service.port }}
+          env:
+            - name: NODE_ENV
+              value: production
+            - name: HOST
+              value: "0.0.0.0"
+            - name: PORT
+              value: {{ .Values.bff.service.port | quote }}
+            - name: NEXTJS_ORIGIN
+              value: {{ include "crm-stack.publicUrl" . | quote }}
+            - name: BETTER_AUTH_URL
+              value: {{ include "crm-stack.publicUrl" . | quote }}
+            {{- if .Values.bff.firebaseCredentials.secretName }}
+            - name: GOOGLE_APPLICATION_CREDENTIALS
+              value: {{ printf "%s/%s" .Values.bff.firebaseCredentials.mountPath .Values.bff.firebaseCredentials.fileName | quote }}
+            {{- end }}
+            {{- with .Values.bff.extraEnv }}
+            {{- range . }}
+            - name: {{ .name }}
+              value: {{ .value | quote }}
+            {{- end }}
+            {{- end }}
+          {{- if .Values.bff.existingEnvSecret }}
+          envFrom:
+            - secretRef:
+                name: {{ .Values.bff.existingEnvSecret }}
+          {{- end }}
+          {{- if .Values.bff.firebaseCredentials.secretName }}
+          volumeMounts:
+            - name: firebase-credentials
+              mountPath: {{ .Values.bff.firebaseCredentials.mountPath }}
+              readOnly: true
+          {{- end }}
+          readinessProbe:
+            httpGet:
+              path: /health
+              port: http
+          livenessProbe:
+            httpGet:
+              path: /health
+              port: http
+          resources:
+            {{- toYaml .Values.bff.resources | nindent 12 }}
+      {{- if .Values.bff.firebaseCredentials.secretName }}
+      volumes:
+        - name: firebase-credentials
+          secret:
+            secretName: {{ .Values.bff.firebaseCredentials.secretName }}
+            items:
+              - key: credentials.json
+                path: {{ .Values.bff.firebaseCredentials.fileName }}
+      {{- end }}


--- deploy/helm/crm-stack/templates/bff-service.yaml
diff --git a/deploy/helm/crm-stack/templates/bff-service.yaml b/deploy/helm/crm-stack/templates/bff-service.yaml
new file mode 100644
index 0000000..f96b56a
--- /dev/null
+++ b/deploy/helm/crm-stack/templates/bff-service.yaml
@@ -0,0 +1,18 @@
+apiVersion: v1
+kind: Service
+metadata:
+  name: {{ include "crm-stack.bffName" . }}
+  labels:
+    {{- include "crm-stack.labels" . | nindent 4 }}
+    app.kubernetes.io/name: bff
+    app.kubernetes.io/component: api
+spec:
+  type: ClusterIP
+  selector:
+    app.kubernetes.io/instance: {{ .Release.Name }}
+    app.kubernetes.io/name: bff
+    app.kubernetes.io/component: api
+  ports:
+    - name: http
+      port: {{ .Values.bff.service.port }}
+      targetPort: http


--- deploy/helm/crm-stack/templates/ingress.yaml
diff --git a/deploy/helm/crm-stack/templates/ingress.yaml b/deploy/helm/crm-stack/templates/ingress.yaml
new file mode 100644
index 0000000..939adb5
--- /dev/null
+++ b/deploy/helm/crm-stack/templates/ingress.yaml
@@ -0,0 +1,38 @@
+{{- if .Values.ingress.enabled }}
+apiVersion: networking.k8s.io/v1
+kind: Ingress
+metadata:
+  name: {{ include "crm-stack.fullname" . }}
+  labels:
+    {{- include "crm-stack.labels" . | nindent 4 }}
+  {{- with .Values.ingress.annotations }}
+  annotations:
+    {{- toYaml . | nindent 4 }}
+  {{- end }}
+spec:
+  ingressClassName: {{ .Values.ingress.className }}
+  rules:
+    - host: {{ required "ingress.host is required" .Values.ingress.host }}
+      http:
+        paths:
+          - path: /api
+            pathType: Prefix
+            backend:
+              service:
+                name: {{ include "crm-stack.bffName" . }}
+                port:
+                  number: {{ .Values.bff.service.port }}
+          - path: /
+            pathType: Prefix
+            backend:
+              service:
+                name: {{ include "crm-stack.webName" . }}
+                port:
+                  number: {{ .Values.web.service.port }}
+  {{- if .Values.ingress.tls.enabled }}
+  tls:
+    - hosts:
+        - {{ required "ingress.host is required" .Values.ingress.host }}
+      secretName: {{ include "crm-stack.tlsSecretName" . }}
+  {{- end }}
+{{- end }}


--- deploy/helm/crm-stack/templates/web-deployment.yaml
diff --git a/deploy/helm/crm-stack/templates/web-deployment.yaml b/deploy/helm/crm-stack/templates/web-deployment.yaml
new file mode 100644
index 0000000..7e70cf7
--- /dev/null
+++ b/deploy/helm/crm-stack/templates/web-deployment.yaml
@@ -0,0 +1,64 @@
+apiVersion: apps/v1
+kind: Deployment
+metadata:
+  name: {{ include "crm-stack.webName" . }}
+  labels:
+    {{- include "crm-stack.labels" . | nindent 4 }}
+    app.kubernetes.io/name: web
+    app.kubernetes.io/component: web
+spec:
+  replicas: {{ .Values.web.replicaCount }}
+  selector:
+    matchLabels:
+      app.kubernetes.io/instance: {{ .Release.Name }}
+      app.kubernetes.io/name: web
+      app.kubernetes.io/component: web
+  template:
+    metadata:
+      labels:
+        {{- include "crm-stack.labels" . | nindent 8 }}
+        app.kubernetes.io/name: web
+        app.kubernetes.io/component: web
+        {{- with .Values.web.podLabels }}
+        {{- toYaml . | nindent 8 }}
+        {{- end }}
+      {{- with .Values.web.podAnnotations }}
+      annotations:
+        {{- toYaml . | nindent 8 }}
+      {{- end }}
+    spec:
+      {{- with .Values.imagePullSecrets }}
+      imagePullSecrets:
+        {{- range . }}
+        - name: {{ . }}
+        {{- end }}
+      {{- end }}
+      containers:
+        - name: web
+          image: "{{ required "web.image.repository is required" .Values.web.image.repository }}:{{ required "web.image.tag is required" .Values.web.image.tag }}"
+          imagePullPolicy: {{ .Values.web.image.pullPolicy }}
+          ports:
+            - name: http
+              containerPort: {{ .Values.web.service.port }}
+          {{- if .Values.web.existingEnvSecret }}
+          envFrom:
+            - secretRef:
+                name: {{ .Values.web.existingEnvSecret }}
+          {{- end }}
+          {{- with .Values.web.extraEnv }}
+          env:
+            {{- range . }}
+            - name: {{ .name }}
+              value: {{ .value | quote }}
+            {{- end }}
+          {{- end }}
+          readinessProbe:
+            httpGet:
+              path: /
+              port: http
+          livenessProbe:
+            httpGet:
+              path: /
+              port: http
+          resources:
+            {{- toYaml .Values.web.resources | nindent 12 }}


--- deploy/helm/crm-stack/templates/web-service.yaml
diff --git a/deploy/helm/crm-stack/templates/web-service.yaml b/deploy/helm/crm-stack/templates/web-service.yaml
new file mode 100644
index 0000000..979881e
--- /dev/null
+++ b/deploy/helm/crm-stack/templates/web-service.yaml
@@ -0,0 +1,18 @@
+apiVersion: v1
+kind: Service
+metadata:
+  name: {{ include "crm-stack.webName" . }}
+  labels:
+    {{- include "crm-stack.labels" . | nindent 4 }}
+    app.kubernetes.io/name: web
+    app.kubernetes.io/component: web
+spec:
+  type: ClusterIP
+  selector:
+    app.kubernetes.io/instance: {{ .Release.Name }}
+    app.kubernetes.io/name: web
+    app.kubernetes.io/component: web
+  ports:
+    - name: http
+      port: {{ .Values.web.service.port }}
+      targetPort: http


--- deploy/helm/crm-stack/values.yaml
diff --git a/deploy/helm/crm-stack/values.yaml b/deploy/helm/crm-stack/values.yaml
new file mode 100644
index 0000000..4264fda
--- /dev/null
+++ b/deploy/helm/crm-stack/values.yaml
@@ -0,0 +1,52 @@
+imagePullSecrets: []
+
+ingress:
+  enabled: true
+  className: nginx
+  scheme: https
+  host: ""
+  annotations:
+    cert-manager.io/cluster-issuer: letsencrypt
+    kubernetes.io/tls-acme: "true"
+    nginx.ingress.kubernetes.io/ssl-redirect: "true"
+  tls:
+    enabled: true
+    secretName: ""
+
+web:
+  replicaCount: 1
+  image:
+    repository: ""
+    tag: ""
+    pullPolicy: IfNotPresent
+  service:
+    port: 3000
+  existingEnvSecret: ""
+  extraEnv: []
+  podAnnotations: {}
+  podLabels: {}
+  resources:
+    requests:
+      cpu: 100m
+      memory: 256Mi
+
+bff:
+  replicaCount: 1
+  image:
+    repository: ""
+    tag: ""
+    pullPolicy: IfNotPresent
+  service:
+    port: 3100
+  existingEnvSecret: ""
+  extraEnv: []
+  firebaseCredentials:
+    secretName: ""
+    mountPath: /var/secrets/firebase
+    fileName: credentials.json
+  podAnnotations: {}
+  podLabels: {}
+  resources:
+    requests:
+      cpu: 100m
+      memory: 256Mi


--- docker/bff.Dockerfile
diff --git a/docker/bff.Dockerfile b/docker/bff.Dockerfile
new file mode 100644
index 0000000..1c8a330
--- /dev/null
+++ b/docker/bff.Dockerfile
@@ -0,0 +1,26 @@
+FROM node:20-bookworm-slim
+
+WORKDIR /app
+
+COPY package.json package-lock.json .npmrc ./
+COPY apps/bff/package.json apps/bff/package.json
+COPY apps/docs/package.json apps/docs/package.json
+COPY apps/web/package.json apps/web/package.json
+COPY packages/db/package.json packages/db/package.json
+COPY packages/eslint-config/package.json packages/eslint-config/package.json
+COPY packages/typescript-config/package.json packages/typescript-config/package.json
+COPY packages/ui/package.json packages/ui/package.json
+
+RUN npm ci --include=dev
+
+COPY . .
+
+RUN npm run db:generate --workspace @repo/db
+
+WORKDIR /app/apps/bff
+
+ENV NODE_ENV=production
+
+EXPOSE 3100
+
+CMD ["../../node_modules/.bin/tsx", "src/server.ts"]


--- docker/web.Dockerfile
diff --git a/docker/web.Dockerfile b/docker/web.Dockerfile
new file mode 100644
index 0000000..19581a8
--- /dev/null
+++ b/docker/web.Dockerfile
@@ -0,0 +1,27 @@
+FROM node:20-bookworm-slim
+
+ENV NEXT_TELEMETRY_DISABLED=1
+
+WORKDIR /app
+
+COPY package.json package-lock.json .npmrc ./
+COPY apps/bff/package.json apps/bff/package.json
+COPY apps/docs/package.json apps/docs/package.json
+COPY apps/web/package.json apps/web/package.json
+COPY packages/db/package.json packages/db/package.json
+COPY packages/eslint-config/package.json packages/eslint-config/package.json
+COPY packages/typescript-config/package.json packages/typescript-config/package.json
+COPY packages/ui/package.json packages/ui/package.json
+
+RUN npm ci --include=dev
+
+COPY . .
+
+RUN npm run db:generate --workspace @repo/db
+RUN npm run build --workspace web
+
+ENV NODE_ENV=production
+
+EXPOSE 3000
+
+CMD ["npm", "run", "start", "--workspace", "web", "--", "--hostname", "0.0.0.0", "--port", "3000"]


--- packages/db/prisma.config.ts
diff --git a/packages/db/prisma.config.ts b/packages/db/prisma.config.ts
index 7d68bd2..7849f08 100644
--- a/packages/db/prisma.config.ts
+++ b/packages/db/prisma.config.ts
@@ -1,19 +1,25 @@
 import { config } from "dotenv";
 import { dirname, resolve } from "node:path";
 import { fileURLToPath } from "node:url";
-import { defineConfig, env } from "prisma/config";
+import { defineConfig } from "prisma/config";
 
 const packageDir = dirname(fileURLToPath(import.meta.url));
 const repoRoot = resolve(packageDir, "../..");
 config({ path: resolve(repoRoot, ".env") });
 config({ path: resolve(repoRoot, ".env.local"), override: true });
 
+// Prisma client generation only needs a syntactically valid URL during image
+// builds. The real DATABASE_URL is injected at runtime from Kubernetes.
+const buildTimeDatabaseUrl =
+  process.env.DATABASE_URL ??
+  "postgresql://placeholder:placeholder@localhost:5432/idauto_crm";
+
 export default defineConfig({
   schema: "prisma/schema.prisma",
   migrations: {
     path: "prisma/migrations",
   },
   datasource: {
-    url: env("DATABASE_URL"),
+    url: buildTimeDatabaseUrl,
   },
 });

```

### Commit 3: d45c0e7
**Message:** refresh transactions dashboard and detail

**Diff:**
```diff
--- apps/bff/src/http/require-session.ts
diff --git a/apps/bff/src/http/require-session.ts b/apps/bff/src/http/require-session.ts
index 7d50951..1c3b19c 100644
--- a/apps/bff/src/http/require-session.ts
+++ b/apps/bff/src/http/require-session.ts
@@ -12,9 +12,15 @@ export async function requireSession(
   request: FastifyRequest,
   reply: FastifyReply,
 ): Promise<SessionUser | null> {
-  const session = await auth.api.getSession({
-    headers: fromNodeHeaders(request.headers),
-  });
+  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
+
+  try {
+    session = await auth.api.getSession({
+      headers: fromNodeHeaders(request.headers),
+    });
+  } catch (error) {
+    request.log.warn({ err: error }, "getSession failed");
+  }
 
   if (!session?.user) {
     reply.code(401).send({


--- apps/web/.flowbite-react/class-list.json
diff --git a/apps/web/.flowbite-react/class-list.json b/apps/web/.flowbite-react/class-list.json
index e47fcd3..3b8fb5d 100644
--- a/apps/web/.flowbite-react/class-list.json
+++ b/apps/web/.flowbite-react/class-list.json
@@ -1,5 +1,17 @@
 [
+  "-4px",
+  "-bottom-1",
+  "-left-1",
   "-m-1.5",
+  "-right-1",
+  "-space-x-4",
+  "-top-1",
+  "2xl",
+  "3xl",
+  "4xl",
+  "5xl",
+  "6xl",
+  "7xl",
   "absolute",
   "animate-spin",
   "bg-blue-100",
@@ -9,10 +21,14 @@
   "bg-cyan-700",
   "bg-gray-100",
   "bg-gray-200",
+  "bg-gray-400",
   "bg-gray-50",
   "bg-gray-700",
   "bg-gray-800",
+  "bg-gray-900",
+  "bg-gray-900/50",
   "bg-green-100",
+  "bg-green-400",
   "bg-green-50",
   "bg-green-700",
   "bg-indigo-100",
@@ -25,16 +41,21 @@
   "bg-purple-100",
   "bg-purple-700",
   "bg-red-100",
+  "bg-red-400",
   "bg-red-50",
   "bg-red-700",
   "bg-teal-100",
   "bg-teal-700",
+  "bg-transparent",
   "bg-white",
   "bg-yellow-100",
   "bg-yellow-400",
   "bg-yellow-50",
   "block",
   "border",
+  "border-2",
+  "border-b",
+  "border-b-0",
   "border-blue-500",
   "border-blue-700",
   "border-cyan-500",
@@ -61,11 +82,19 @@
   "border-r-0",
   "border-red-500",
   "border-red-700",
+  "border-t",
   "border-t-4",
   "border-teal-500",
   "border-teal-700",
+  "border-white",
   "border-yellow-400",
   "border-yellow-500",
+  "bottom-center",
+  "bottom-left",
+  "bottom-right",
+  "center-left",
+  "center-right",
+  "cursor-pointer",
   "dark:bg-blue-200",
   "dark:bg-blue-600",
   "dark:bg-cyan-100",
@@ -77,6 +106,7 @@
   "dark:bg-gray-700",
   "dark:bg-gray-800",
   "dark:bg-gray-900",
+  "dark:bg-gray-900/80",
   "dark:bg-green-100",
   "dark:bg-green-200",
   "dark:bg-green-600",
@@ -101,10 +131,12 @@
   "dark:border-cyan-400",
   "dark:border-cyan-500",
   "dark:border-gray-600",
+  "dark:border-gray-800",
   "dark:border-green-400",
   "dark:border-green-600",
   "dark:border-indigo-600",
   "dark:border-lime-600",
+  "dark:border-none",
   "dark:border-pink-600",
   "dark:border-primary-600",
   "dark:border-purple-600",
@@ -114,6 +146,7 @@
   "dark:border-yellow-300",
   "dark:border-yellow-400",
   "dark:fill-gray-300",
+  "dark:focus:bg-gray-600",
   "dark:focus:border-cyan-500",
   "dark:focus:border-green-500",
   "dark:focus:border-primary-500",
@@ -137,6 +170,7 @@
   "dark:focus:ring-teal-800",
   "dark:focus:ring-yellow-500",
   "dark:focus:ring-yellow-900",
+  "dark:focus:text-white",
   "dark:hover:bg-blue-300",
   "dark:hover:bg-blue-700",
   "dark:hover:bg-cyan-300",
@@ -177,6 +211,15 @@
   "dark:hover:border-yellow-400",
   "dark:hover:text-white",
   "dark:placeholder-gray-400",
+  "dark:ring-cyan-800",
+  "dark:ring-gray-400",
+  "dark:ring-gray-500",
+  "dark:ring-gray-800",
+  "dark:ring-green-500",
+  "dark:ring-pink-500",
+  "dark:ring-purple-600",
+  "dark:ring-red-700",
+  "dark:ring-yellow-500",
   "dark:shadow-sm-light",
   "dark:text-blue-500",
   "dark:text-blue-600",
@@ -217,6 +260,8 @@
   "dark:text-yellow-800",
   "disabled:cursor-not-allowed",
   "disabled:opacity-50",
+  "divide-gray-100",
+  "divide-y",
   "ease-out",
   "fill-cyan-600",
   "fill-gray-600",
@@ -228,8 +273,11 @@
   "fill-yellow-400",
   "first:border-l",
   "first:rounded-s-lg",
+  "fixed",
   "flex",
+  "flex-1",
   "flex-col",
+  "focus:bg-gray-100",

--- apps/web/app/clients/page.tsx
diff --git a/apps/web/app/clients/page.tsx b/apps/web/app/clients/page.tsx
new file mode 100644
index 0000000..109d2aa
--- /dev/null
+++ b/apps/web/app/clients/page.tsx
@@ -0,0 +1,14 @@
+import { DashboardPageFrame } from "../components/dashboard/dashboard-page-frame";
+import { PlaceholderPage } from "../components/dashboard/placeholder-page";
+
+export default function ClientsPage() {
+  return (
+    <DashboardPageFrame>
+      <PlaceholderPage
+        eyebrow="CRM"
+        title="Clientes"
+        description="Este módulo todavía no está conectado al CRM real. Lo dejamos visible para conservar la navegación del dashboard que venía en new."
+      />
+    </DashboardPageFrame>
+  );
+}


--- apps/web/app/components/dashboard/dashboard-content.tsx
diff --git a/apps/web/app/components/dashboard/dashboard-content.tsx b/apps/web/app/components/dashboard/dashboard-content.tsx
new file mode 100644
index 0000000..844c93c
--- /dev/null
+++ b/apps/web/app/components/dashboard/dashboard-content.tsx
@@ -0,0 +1,13 @@
+"use client";
+
+export function DashboardContent({
+  children,
+}: {
+  children: React.ReactNode;
+}) {
+  return (
+    <main className="min-h-screen bg-gray-50 px-4 pb-10 pt-20 lg:ml-[280px] lg:px-6">
+      {children}
+    </main>
+  );
+}


--- apps/web/app/components/dashboard/dashboard-navbar.tsx
diff --git a/apps/web/app/components/dashboard/dashboard-navbar.tsx b/apps/web/app/components/dashboard/dashboard-navbar.tsx
new file mode 100644
index 0000000..4829401
--- /dev/null
+++ b/apps/web/app/components/dashboard/dashboard-navbar.tsx
@@ -0,0 +1,75 @@
+"use client";
+
+import { useState } from "react";
+import { useRouter } from "next/navigation";
+import { Avatar, Button, Dropdown, DropdownDivider, DropdownItem } from "flowbite-react";
+import { authClient } from "../../../lib/auth-client";
+import { Logo } from "../logo";
+import { useNewTransaction } from "./new-transaction-context";
+import { useSidebar } from "./sidebar-context";
+
+function MenuIcon() {
+  return (
+    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
+      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
+    </svg>
+  );
+}
+
+function PlusIcon() {
+  return (
+    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
+      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
+    </svg>
+  );
+}
+
+export function DashboardNavbar() {
+  const router = useRouter();
+  const { toggleSidebar } = useSidebar();
+  const { openNewTransaction } = useNewTransaction();
+  const [isSigningOut, setIsSigningOut] = useState(false);
+
+  const handleSignOut = async () => {
+    setIsSigningOut(true);
+    await authClient.signOut();
+    router.push("/login");
+  };
+
+  return (
+    <header className="fixed inset-x-0 top-0 z-50 border-b border-gray-200 bg-white">
+      <div className="flex h-16 items-center justify-between px-4">
+        <div className="flex items-center gap-3">
+          <button
+            type="button"
+            onClick={toggleSidebar}
+            className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 lg:hidden"
+            aria-label="Abrir menú"
+          >
+            <MenuIcon />
+          </button>
+          <Logo variant="dark" />
+        </div>
+
+        <div className="flex items-center gap-3">
+          <Button color="blue" pill size="sm" onClick={openNewTransaction}>
+            <PlusIcon />
+            <span className="ml-1">Nueva venta</span>
+          </Button>
+
+          <Dropdown
+            inline
+            arrowIcon={false}
+            label={<Avatar rounded size="sm" placeholderInitials="VE" />}
+          >
+            <DropdownItem disabled>Vendedor</DropdownItem>
+            <DropdownDivider />
+            <DropdownItem onClick={handleSignOut} disabled={isSigningOut}>
+              {isSigningOut ? "Cerrando..." : "Cerrar sesión"}
+            </DropdownItem>
+          </Dropdown>
+        </div>
+      </div>
+    </header>
+  );
+}


--- apps/web/app/components/dashboard/dashboard-page-frame.tsx
diff --git a/apps/web/app/components/dashboard/dashboard-page-frame.tsx b/apps/web/app/components/dashboard/dashboard-page-frame.tsx
new file mode 100644
index 0000000..4bbfbce
--- /dev/null
+++ b/apps/web/app/components/dashboard/dashboard-page-frame.tsx
@@ -0,0 +1,25 @@
+"use client";
+
+import { DashboardContent } from "./dashboard-content";
+import { DashboardNavbar } from "./dashboard-navbar";
+import { DashboardSidebar } from "./dashboard-sidebar";
+import { NewTransactionModal } from "./new-transaction-modal";
+import { NewTransactionProvider } from "./new-transaction-context";
+import { SidebarProvider } from "./sidebar-context";
+
+export function DashboardPageFrame({
+  children,
+}: {
+  children: React.ReactNode;
+}) {
+  return (
+    <SidebarProvider>
+      <NewTransactionProvider>
+        <DashboardNavbar />
+        <DashboardSidebar />
+        <DashboardContent>{children}</DashboardContent>
+        <NewTransactionModal />
+      </NewTransactionProvider>
+    </SidebarProvider>
+  );
+}


--- apps/web/app/components/dashboard/dashboard-sidebar.tsx
diff --git a/apps/web/app/components/dashboard/dashboard-sidebar.tsx b/apps/web/app/components/dashboard/dashboard-sidebar.tsx
new file mode 100644
index 0000000..29a13f1
--- /dev/null
+++ b/apps/web/app/components/dashboard/dashboard-sidebar.tsx
@@ -0,0 +1,130 @@
+"use client";
+
+import Link from "next/link";
+import { usePathname } from "next/navigation";
+import { useSidebar } from "./sidebar-context";
+
+function DocumentIcon({ className }: { className?: string }) {
+  return (
+    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
+      <path d="M8 4.5h6l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 7 19V6a1.5 1.5 0 0 1 1-1.5Z" strokeLinecap="round" strokeLinejoin="round" />
+      <path d="M14 4.5V9h4" strokeLinecap="round" strokeLinejoin="round" />
+    </svg>
+  );
+}
+
+function UsersIcon({ className }: { className?: string }) {
+  return (
+    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
+      <path d="M16 19.5v-1a3.5 3.5 0 0 0-3.5-3.5h-1A3.5 3.5 0 0 0 8 18.5v1" strokeLinecap="round" />
+      <circle cx="12" cy="9" r="3" />
+      <path d="M18.5 19.5v-.5a2.5 2.5 0 0 0-1.5-2.3M5.5 19.5v-.5a2.5 2.5 0 0 1 1.5-2.3" strokeLinecap="round" />
+    </svg>
+  );
+}
+
+function ChartIcon({ className }: { className?: string }) {
+  return (
+    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
+      <path d="M5 19.5h14" strokeLinecap="round" />
+      <path d="M8 16V9M12 16V5.5M16 16v-7" strokeLinecap="round" />
+    </svg>
+  );
+}
+
+function CogIcon({ className }: { className?: string }) {
+  return (
+    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
+      <circle cx="12" cy="12" r="3" />
+      <path d="M12 4.5v2M12 17.5v2M19.5 12h-2M6.5 12h-2M17.3 6.7l-1.4 1.4M8.1 15.9l-1.4 1.4M17.3 17.3l-1.4-1.4M8.1 8.1 6.7 6.7" strokeLinecap="round" />
+    </svg>
+  );
+}
+
+function CloseIcon({ className }: { className?: string }) {
+  return (
+    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
+      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
+    </svg>
+  );
+}
+
+const navItems = [
+  { label: "Transacciones", href: "/transactions", icon: DocumentIcon },
+  { label: "Clientes", href: "/clients", icon: UsersIcon },
+  { label: "Reportes", href: "/reports", icon: ChartIcon },
+  { label: "Configuración", href: "/settings", icon: CogIcon },
+];
+
+function NavItem({
+  href,
+  label,
+  active,
+  icon: Icon,
+}: {
+  href: string;
+  label: string;
+  active: boolean;
+  icon: React.ComponentType<{ className?: string }>;
+}) {
+  return (
+    <Link
+      href={href}
+      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
+        active
+          ? "bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-200"
+          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
+      }`}
+    >
+      <Icon className="h-5 w-5 shrink-0" />
+      <span>{label}</span>
+    </Link>
+  );
+}
+
+export function DashboardSidebar() {
+  const pathname = usePathname();
+  const { sidebarOpen, closeSidebar } = useSidebar();
+
+  return (
+    <>
+      {sidebarOpen ? (
+        <div
+          className="fixed inset-0 z-30 bg-slate-900/35 lg:hidden"
+          onClick={closeSidebar}
+        />
+      ) : null}
+
+      <aside
+        className={`fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-[280px] border-r border-gray-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
+          sidebarOpen ? "translate-x-0" : "-translate-x-full"
+        }`}
+      >
+        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 lg:hidden">
+          <span className="text-sm font-medium text-gray-600">Menú</span>
+          <button
+            type="button"
+            onClick={closeSidebar}
+            className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
+            aria-label="Cerrar menú"
+          >
+            <CloseIcon className="h-5 w-5" />
+          </button>
+        </div>
+
+        <nav className="space-y-1 p-4">
+          {navItems.map((item) => (
+            <div key={item.href} onClick={closeSidebar}>
+              <NavItem
+                href={item.href}
+                label={item.label}
+                icon={item.icon}
+                active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
+              />
+            </div>
+          ))}
+        </nav>
+      </aside>
+    </>
+  );
+}


--- apps/web/app/components/dashboard/new-transaction-context.tsx
diff --git a/apps/web/app/components/dashboard/new-transaction-context.tsx b/apps/web/app/components/dashboard/new-transaction-context.tsx
new file mode 100644
index 0000000..9b9736c
--- /dev/null
+++ b/apps/web/app/components/dashboard/new-transaction-context.tsx
@@ -0,0 +1,48 @@
+"use client";
+
+import { createContext, useCallback, useContext, useState } from "react";
+
+interface NewTransactionContextValue {
+  isOpen: boolean;
+  openNewTransaction: () => void;
+  closeNewTransaction: () => void;
+}
+
+const NewTransactionContext = createContext<NewTransactionContextValue | null>(
+  null,
+);
+
+export function NewTransactionProvider({
+  children,
+}: {
+  children: React.ReactNode;
+}) {
+  const [isOpen, setIsOpen] = useState(false);
+
+  const openNewTransaction = useCallback(() => {
+    setIsOpen(true);
+  }, []);
+
+  const closeNewTransaction = useCallback(() => {
+    setIsOpen(false);
+  }, []);
+
+  return (
+    <NewTransactionContext.Provider
+      value={{ isOpen, openNewTransaction, closeNewTransaction }}
+    >
+      {children}
+    </NewTransactionContext.Provider>
+  );
+}
+
+export function useNewTransaction() {
+  const context = useContext(NewTransactionContext);
+  if (!context) {
+    throw new Error(
+      "useNewTransaction must be used within NewTransactionProvider",
+    );
+  }
+
+  return context;
+}


--- apps/web/app/components/dashboard/new-transaction-modal.tsx
diff --git a/apps/web/app/components/dashboard/new-transaction-modal.tsx b/apps/web/app/components/dashboard/new-transaction-modal.tsx
new file mode 100644
index 0000000..2c0b495
--- /dev/null
+++ b/apps/web/app/components/dashboard/new-transaction-modal.tsx
@@ -0,0 +1,21 @@
+"use client";
+
+import { Modal, ModalBody, ModalHeader } from "flowbite-react";
+import { ImportFromAlbertoPanel } from "../../transactions/import-from-alberto-panel";
+import { useNewTransaction } from "./new-transaction-context";
+
+export function NewTransactionModal() {
+  const { isOpen, closeNewTransaction } = useNewTransaction();
+
+  return (
+    <Modal show={isOpen} onClose={closeNewTransaction} size="3xl" dismissible>
+      <ModalHeader>Nueva venta</ModalHeader>
+      <ModalBody>
+        <ImportFromAlbertoPanel
+          variant="modal"
+          onCreated={closeNewTransaction}
+        />
+      </ModalBody>
+    </Modal>
+  );
+}


--- apps/web/app/components/dashboard/placeholder-page.tsx
diff --git a/apps/web/app/components/dashboard/placeholder-page.tsx b/apps/web/app/components/dashboard/placeholder-page.tsx
new file mode 100644
index 0000000..591facb
--- /dev/null
+++ b/apps/web/app/components/dashboard/placeholder-page.tsx
@@ -0,0 +1,23 @@
+export function PlaceholderPage({
+  eyebrow,
+  title,
+  description,
+}: {
+  eyebrow: string;
+  title: string;
+  description: string;
+}) {
+  return (
+    <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 shadow-sm">
+      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
+        {eyebrow}
+      </p>
+      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">
+        {title}
+      </h1>
+      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
+        {description}
+      </p>
+    </section>
+  );
+}


--- apps/web/app/components/dashboard/sidebar-context.tsx
diff --git a/apps/web/app/components/dashboard/sidebar-context.tsx b/apps/web/app/components/dashboard/sidebar-context.tsx
new file mode 100644
index 0000000..1dc8512
--- /dev/null
+++ b/apps/web/app/components/dashboard/sidebar-context.tsx
@@ -0,0 +1,38 @@
+"use client";
+
+import { createContext, useCallback, useContext, useState } from "react";
+
+interface SidebarContextValue {
+  sidebarOpen: boolean;
+  toggleSidebar: () => void;
+  closeSidebar: () => void;
+}
+
+const SidebarContext = createContext<SidebarContextValue | null>(null);
+
+export function SidebarProvider({ children }: { children: React.ReactNode }) {
+  const [sidebarOpen, setSidebarOpen] = useState(false);
+
+  const toggleSidebar = useCallback(() => {
+    setSidebarOpen((value) => !value);
+  }, []);
+
+  const closeSidebar = useCallback(() => {
+    setSidebarOpen(false);
+  }, []);
+
+  return (
+    <SidebarContext.Provider value={{ sidebarOpen, toggleSidebar, closeSidebar }}>
+      {children}
+    </SidebarContext.Provider>
+  );
+}
+
+export function useSidebar() {
+  const context = useContext(SidebarContext);
+  if (!context) {
+    throw new Error("useSidebar must be used within SidebarProvider");
+  }
+
+  return context;
+}


--- apps/web/app/reports/page.tsx
diff --git a/apps/web/app/reports/page.tsx b/apps/web/app/reports/page.tsx
new file mode 100644
index 0000000..9cbcb74
--- /dev/null
+++ b/apps/web/app/reports/page.tsx
@@ -0,0 +1,14 @@
+import { DashboardPageFrame } from "../components/dashboard/dashboard-page-frame";
+import { PlaceholderPage } from "../components/dashboard/placeholder-page";
+
+export default function ReportsPage() {
+  return (
+    <DashboardPageFrame>
+      <PlaceholderPage
+        eyebrow="CRM"
+        title="Reportes"
+        description="Aquí podemos aterrizar más adelante métricas de cartera, ventas listas para entregar y seguimiento comercial."
+      />
+    </DashboardPageFrame>
+  );
+}


--- apps/web/app/settings/page.tsx
diff --git a/apps/web/app/settings/page.tsx b/apps/web/app/settings/page.tsx
new file mode 100644
index 0000000..af074f3
--- /dev/null
+++ b/apps/web/app/settings/page.tsx
@@ -0,0 +1,14 @@
+import { DashboardPageFrame } from "../components/dashboard/dashboard-page-frame";
+import { PlaceholderPage } from "../components/dashboard/placeholder-page";
+
+export default function SettingsPage() {
+  return (
+    <DashboardPageFrame>
+      <PlaceholderPage
+        eyebrow="CRM"
+        title="Configuración"
+        description="Este espacio queda reservado para preferencias y configuración operativa del dashboard."
+      />
+    </DashboardPageFrame>
+  );
+}


--- apps/web/app/transactions/[id]/delivery-panel.tsx
diff --git a/apps/web/app/transactions/[id]/delivery-panel.tsx b/apps/web/app/transactions/[id]/delivery-panel.tsx
index b4723ca..c4fefc9 100644
--- a/apps/web/app/transactions/[id]/delivery-panel.tsx
+++ b/apps/web/app/transactions/[id]/delivery-panel.tsx
@@ -140,6 +140,23 @@ function sanitizeDeliveryDetail(message: string | null) {
     : message;
 }
 
+async function requiresLogin(response: Response) {
+  if (response.status === 401) {
+    return true;
+  }
+
+  if (response.status !== 500) {
+    return false;
+  }
+
+  try {
+    const data = (await response.clone().json()) as ErrorResponse;
+    return data.message?.includes("Failed to get session") ?? false;
+  } catch {
+    return false;
+  }
+}
+
 export function DeliveryPanel({
   transactionId,
   status,
@@ -204,6 +221,12 @@ export function DeliveryPanel({
           },
         );
 
+        if (await requiresLogin(response)) {
+          router.push("/login");
+          router.refresh();
+          return;
+        }
+
         if (!response.ok) {
           setFeedback({
             tone: "error",
@@ -251,6 +274,12 @@ export function DeliveryPanel({
           },
         );
 
+        if (await requiresLogin(response)) {
+          router.push("/login");
+          router.refresh();
+          return;
+        }
+
         if (!response.ok) {
           setFeedback({
             tone: "error",


--- apps/web/app/transactions/[id]/page.tsx
diff --git a/apps/web/app/transactions/[id]/page.tsx b/apps/web/app/transactions/[id]/page.tsx
index 3946f3a..d4a1ebe 100644
--- a/apps/web/app/transactions/[id]/page.tsx
+++ b/apps/web/app/transactions/[id]/page.tsx
@@ -1,3 +1,4 @@
+import { redirect } from "next/navigation";
 import { TransactionDetailLive } from "./transaction-detail-live";
 import {
   getTransactionDetail,
@@ -158,7 +159,7 @@ function SummaryCard({
   children: React.ReactNode;
 }) {
   return (
-    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
+    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
       <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
         {title}
       </h2>
@@ -176,7 +177,7 @@ function WorkflowPanel({
 }) {
   if (errorMessage) {
     return (
-      <SummaryCard title="Historial de la venta">
+      <SummaryCard title="Proceso de la venta">
         <p className="text-sm text-gray-600">{errorMessage}</p>
       </SummaryCard>
     );
@@ -184,7 +185,7 @@ function WorkflowPanel({
 
   if (!items || items.length === 0) {
     return (
-      <SummaryCard title="Historial de la venta">
+      <SummaryCard title="Proceso de la venta">
         <p className="text-sm text-gray-600">
           Aun no hay movimientos registrados en esta venta.
         </p>
@@ -193,41 +194,47 @@ function WorkflowPanel({
   }
 
   return (
-    <SummaryCard title="Historial de la venta">
+    <SummaryCard title="Proceso de la venta">
       <div className="space-y-4">
-        {items.map((event) => {
+        {items.map((event, index) => {
           const details = describeWorkflowEvent(event);
+          const isLast = index === items.length - 1;
 
           return (
-            <div
-              key={event.id}
-              className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4"
-            >
-              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
-                <div>
-                  <p className="font-semibold text-gray-900">
-                    {eventTypeLabels[event.eventType] ?? "Actualizacion registrada"}
-                  </p>
-                  <p className="mt-1 text-xs text-gray-500">
-                    {formatDate(event.occurredAt)}
-                  </p>
+            <div key={event.id} className="relative pl-12">
+              {!isLast ? (
+                <span className="absolute left-[15px] top-8 h-[calc(100%-0.5rem)] w-px bg-gray-200" />
+              ) : null}
+              <span className="absolute left-0 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary-200 bg-primary-50 text-xs font-semibold text-primary-700">
+                {index + 1}
+              </span>
+              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
+                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
+                  <div>
+                    <p className="font-semibold text-gray-900">
+                      {eventTypeLabels[event.eventType] ?? "Actualizacion registrada"}
+                    </p>
+                    <p className="mt-1 text-xs text-gray-500">
+                      {formatDate(event.occurredAt)}
+                    </p>
+                  </div>
+                  {event.eventStatus ? (
+                    <span
+                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[event.eventStatus]}`}
+                    >
+                      {statusLabels[event.eventStatus]}
+                    </span>
+                  ) : null}
                 </div>
-                {event.eventStatus ? (
-                  <span
-                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[event.eventStatus]}`}
-                  >
-                    {statusLabels[event.eventStatus]}
-                  </span>
+
+                {details.length > 0 ? (
+                  <div className="mt-3 space-y-2 text-sm text-gray-700">
+                    {details.map((detail) => (
+                      <p key={`${event.id}-${detail}`}>{detail}</p>
+                    ))}
+                  </div>
                 ) : null}
               </div>
-
-              {details.length > 0 ? (
-                <div className="mt-3 space-y-1 text-sm text-gray-700">
-                  {details.map((detail) => (
-                    <p key={`${event.id}-${detail}`}>{detail}</p>
-                  ))}
-                </div>
-              ) : null}
             </div>
           );
         })}
@@ -259,14 +266,7 @@ export default async function TransactionDetailPage({
   }
 
   if (detailResult.kind === "unauthorized") {
-    return (
-      <div className="mx-auto max-w-6xl px-4">
-        <EmptyState
-          title="Tu sesion no esta disponible"
-          description="Inicia sesion para consultar esta venta."
-        />
-      </div>
-    );
+    redirect("/login");
   }
 
   if (detailResult.kind === "not-found") {
@@ -309,7 +309,9 @@ export default async function TransactionDetailPage({
   return (
     <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-10">
       <TransactionDetailLive initialDetail={detailResult.data} />
-      <WorkflowPanel items={workflowItems} errorMessage={workflowError} />
+      <section id="proceso-venta" className="scroll-mt-24">
+        <WorkflowPanel items={workflowItems} errorMessage={workflowError} />
+      </section>
     </div>
   );
 }


--- apps/web/app/transactions/[id]/transaction-detail-live.tsx
diff --git a/apps/web/app/transactions/[id]/transaction-detail-live.tsx b/apps/web/app/transactions/[id]/transaction-detail-live.tsx
index 65e8776..55a3513 100644
--- a/apps/web/app/transactions/[id]/transaction-detail-live.tsx
+++ b/apps/web/app/transactions/[id]/transaction-detail-live.tsx
@@ -224,7 +224,7 @@ function SummaryCard({
   children: React.ReactNode;
 }) {
   return (
-    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
+    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
       <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
         {title}
       </h2>
@@ -233,6 +233,132 @@ function SummaryCard({
   );
 }
 
+function SectionPill({
+  href,
+  label,
+}: {
+  href: string;
+  label: string;
+}) {
+  return (
+    <a
+      href={href}
+      className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
+    >
+      {label}
+    </a>
+  );
+}
+
+function OverviewMetric({
+  label,
+  value,
+  supporting,
+}: {
+  label: string;
+  value: string;
+  supporting?: string;
+}) {
+  return (
+    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
+      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
+        {label}
+      </p>
+      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
+      {supporting ? (
+        <p className="mt-1 text-xs leading-relaxed text-slate-500">{supporting}</p>
+      ) : null}
+    </div>
+  );
+}
+
+function InfoLine({
+  label,
+  value,
+  href,
+}: {
+  label: string;
+  value: string;
+  href?: string;
+}) {
+  const content = href ? (
+    <a
+      href={href}
+      className="font-medium text-gray-900 transition hover:text-primary-700"
+    >
+      {value}
+    </a>
+  ) : (
+    <span className="font-medium text-gray-900">{value}</span>
+  );
+
+  return (
+    <div className="flex items-start justify-between gap-4 text-sm">
+      <span className="text-gray-500">{label}</span>
+      <span className="text-right">{content}</span>
+    </div>
+  );
+}
+
+function getNextActionMessage(
+  status: TransactionStatus,
+  latestDelivery: TransactionDeliveryItem | null,
+  openFollowUps: number,
+) {
+  if (latestDelivery?.status === "DELIVERY_FAILED") {
+    return "Revisa los datos del cliente y vuelve a intentar la entrega.";
+  }
+
+  if (status === "READY") {
+    return "La venta ya esta lista. Confirma los datos del cliente y envía los documentos desde Entrega.";
+  }
+
+  if (status === "PROCESSING") {
+    return openFollowUps > 0
+      ? "Mantén el seguimiento activo mientras termina la documentacion."
+      : "Crea un seguimiento para mantener informado al cliente mientras termina la documentacion.";
+  }
+
+  if (status === "SUBMITTED") {
+    return "Revisa los datos base y deja el primer seguimiento para no perder la venta.";
+  }
+
+  if (status === "DELIVERED") {
+    return "Confirma con el cliente que recibió los documentos y deja una nota de cierre si corresponde.";
+  }
+
+  if (status === "VIEWED") {
+    return "El cliente ya revisó sus documentos. Solo queda cerrar el seguimiento comercial.";
+  }
+
+  return "Revisa el resumen de la venta y define el siguiente paso comercial.";
+}
+
+function getPrimaryAction(
+  status: TransactionStatus,
+  latestDelivery: TransactionDeliveryItem | null,
+  openFollowUps: number,
+) {
+  if (latestDelivery?.status === "DELIVERY_FAILED" || status === "READY") {
+    return {
+      href: "#entrega-venta",
+      label: "Ir a entrega",
+    };
+  }
+
+  if (status === "SUBMITTED" || status === "PROCESSING" || openFollowUps > 0) {
+    return {
+      href: "#seguimiento-venta",
+      label: "Ver seguimiento",
+    };
+  }
+
+  return {
+    href: "#proceso-venta",
+    label: "Ver proceso",
+  };
+}
+
 function DeliveryHistory({
   deliveries,
 }: {
@@ -663,6 +789,15 @@ function ActivityPanel({
   const [isNotePending, startNoteTransition] = useTransition();
   const [isFollowUpPending, startFollowUpTransition] = useTransition();
   const [isCompletingId, setIsCompletingId] = useState<string | null>(null);

--- apps/web/app/transactions/import-from-alberto-panel.tsx
diff --git a/apps/web/app/transactions/import-from-alberto-panel.tsx b/apps/web/app/transactions/import-from-alberto-panel.tsx
index 3e3ea48..caf9fb1 100644
--- a/apps/web/app/transactions/import-from-alberto-panel.tsx
+++ b/apps/web/app/transactions/import-from-alberto-panel.tsx
@@ -35,7 +35,13 @@ interface AlbertoApiPreview {
 const inputClass =
   "mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200";
 
-export function ImportFromAlbertoPanel() {
+export function ImportFromAlbertoPanel({
+  variant = "page",
+  onCreated,
+}: {
+  variant?: "page" | "modal";
+  onCreated?: () => void;
+}) {
   const bffUrl = process.env.NEXT_PUBLIC_BFF_URL ?? "";
   const router = useRouter();
   const [rut, setRut] = useState("");
@@ -49,6 +55,23 @@ export function ImportFromAlbertoPanel() {
   const [isPreviewPending, startPreview] = useTransition();
   const [isCreatePending, startCreate] = useTransition();
 
+  const requiresLogin = async (response: Response) => {
+    if (response.status === 401) {
+      return true;
+    }
+
+    if (response.status !== 500) {
+      return false;
+    }
+
+    try {
+      const body = (await response.clone().json()) as { message?: string };
+      return body.message?.includes("Failed to get session") ?? false;
+    } catch {
+      return false;
+    }
+  };
+
   const runPreview = () => {
     startPreview(async () => {
       const r = rut.trim();
@@ -67,6 +90,12 @@ export function ImportFromAlbertoPanel() {
           body: JSON.stringify({ rut: r, plate: plate.trim() || undefined }),
         });
 
+        if (await requiresLogin(response)) {
+          router.push("/login");
+          router.refresh();
+          return;
+        }
+
         if (response.status === 503) {
           setPreview(null);
           setFeedback(
@@ -123,6 +152,12 @@ export function ImportFromAlbertoPanel() {
           },
         );
 
+        if (await requiresLogin(response)) {
+          router.push("/login");
+          router.refresh();
+          return;
+        }
+
         if (response.status === 400) {
           const body = (await response.json()) as { message?: string };
           setFeedback(body.message ?? "Patente requerida o invalida.");
@@ -153,6 +188,7 @@ export function ImportFromAlbertoPanel() {
         }
 
         const body = (await response.json()) as { detail: { id: string } };
+        onCreated?.();
         router.push(`/transactions/${encodeURIComponent(body.detail.id)}`);
         router.refresh();
       } catch {
@@ -161,9 +197,9 @@ export function ImportFromAlbertoPanel() {
     });
   };
 
-  return (
-    <section className="rounded-lg border border-primary-200 bg-white p-5 shadow-sm">
-      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
+  const content = (
+    <>
+      {variant === "page" ? (
         <div>
           <h2 className="text-sm font-semibold tracking-tight text-gray-900">
             Nueva venta
@@ -173,7 +209,18 @@ export function ImportFromAlbertoPanel() {
             posible de datos.
           </p>
         </div>
-      </div>
+      ) : (
+        <div>
+          <p className="text-sm font-medium text-gray-900">
+            Busca por RUT y patente para crear una venta con la mayor cantidad
+            posible de datos.
+          </p>
+          <p className="mt-1 text-xs leading-relaxed text-gray-600">
+            Si el cliente tiene más de un vehículo, usa la patente para traer la
+            venta correcta.
+          </p>
+        </div>
+      )}
 
       <div className="mt-5 grid gap-3 sm:grid-cols-2">
         <label className="block text-xs font-medium text-gray-600">
@@ -246,6 +293,16 @@ export function ImportFromAlbertoPanel() {
           </ul>
         </div>
       ) : null}
-    </section>
+    </>
+  );
+
+  return (
+    variant === "page" ? (
+      <section className="rounded-lg border border-primary-200 bg-white p-5 shadow-sm">
+        {content}
+      </section>
+    ) : (
+      <div>{content}</div>
+    )
   );
 }


--- apps/web/app/transactions/layout.tsx
diff --git a/apps/web/app/transactions/layout.tsx b/apps/web/app/transactions/layout.tsx
index aeb3441..6073657 100644
--- a/apps/web/app/transactions/layout.tsx
+++ b/apps/web/app/transactions/layout.tsx
@@ -1,32 +1,9 @@
-import Link from "next/link";
+import { DashboardPageFrame } from "../components/dashboard/dashboard-page-frame";
 
 export default function TransactionsLayout({
   children,
 }: {
   children: React.ReactNode;
 }) {
-  return (
-    <div className="min-h-screen bg-gray-50 text-gray-900">
-      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur-md">
-        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4">
-          <Link
-            href="/"
-            className="text-xs font-medium text-gray-500 transition hover:text-gray-900"
-          >
-            Inicio
-          </Link>
-          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
-            Sales Front
-          </span>
-          <Link
-            href="/transactions"
-            className="text-xs font-medium text-primary-600 transition hover:text-primary-700"
-          >
-            Transacciones
-          </Link>
-        </div>
-      </header>
-      <div className="pb-12 pt-6">{children}</div>
-    </div>
-  );
+  return <DashboardPageFrame>{children}</DashboardPageFrame>;
 }


--- apps/web/app/transactions/page.tsx
diff --git a/apps/web/app/transactions/page.tsx b/apps/web/app/transactions/page.tsx
index 3f1d2e7..708e8a6 100644
--- a/apps/web/app/transactions/page.tsx
+++ b/apps/web/app/transactions/page.tsx
@@ -1,6 +1,16 @@
+import { redirect } from "next/navigation";
 import Link from "next/link";
-import { ImportFromAlbertoPanel } from "./import-from-alberto-panel";
-import { getTransactions, type TransactionStatus } from "../../lib/crm-client";
+import {
+  getTransactions,
+  type TransactionListItem,
+  type TransactionStatus,
+} from "../../lib/crm-client";
+
+type GroupByKey = "status" | "date" | "plate" | "brand" | "model" | "rut";
+
+type IconProps = {
+  className?: string;
+};
 
 const statusLabels: Record<TransactionStatus, string> = {
   SUBMITTED: "Enviado a procesar",
@@ -11,14 +21,191 @@ const statusLabels: Record<TransactionStatus, string> = {
 };
 
 const statusClasses: Record<TransactionStatus, string> = {
-  SUBMITTED: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
+  SUBMITTED: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
   PROCESSING:
-    "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200",
+    "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200",
   READY:
-    "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200",
-  DELIVERED: "bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-200",
+    "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200",
+  DELIVERED: "bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-200",
   VIEWED:
-    "bg-primary-100 text-primary-800 ring-1 ring-inset ring-primary-200",
+    "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
+};
+
+const statusGroups: Array<{
+  status: TransactionStatus;
+  title: string;
+  description: string;
+}> = [
+  {
+    status: "SUBMITTED",
+    title: "Enviadas",
+    description: "Ventas recién recibidas, esperando gestión inicial.",
+  },
+  {
+    status: "PROCESSING",
+    title: "Procesando",
+    description: "Ventas con documentación o tareas operativas en curso.",
+  },
+  {
+    status: "READY",
+    title: "Listas",
+    description: "Ventas que ya pueden enviarse al cliente.",
+  },
+  {
+    status: "DELIVERED",
+    title: "Entregadas",
+    description: "Ventas con documentos ya enviados.",
+  },
+  {
+    status: "VIEWED",
+    title: "Vistas",
+    description: "Clientes que ya revisaron sus documentos.",
+  },
+];
+
+const groupByOptions: Array<{ value: GroupByKey; label: string }> = [
+  { value: "status", label: "Estado" },
+  { value: "date", label: "Fecha" },
+  { value: "plate", label: "Patente" },
+  { value: "brand", label: "Marca" },
+  { value: "model", label: "Modelo" },
+  { value: "rut", label: "RUT cliente" },
+];
+
+function SearchIcon({ className }: IconProps) {
+  return (
+    <svg
+      viewBox="0 0 24 24"
+      fill="none"
+      stroke="currentColor"
+      strokeWidth="1.8"
+      className={className}
+      aria-hidden
+    >
+      <circle cx="11" cy="11" r="6" />
+      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
+    </svg>
+  );
+}
+
+function FiltersIcon({ className }: IconProps) {
+  return (
+    <svg
+      viewBox="0 0 24 24"
+      fill="none"
+      stroke="currentColor"
+      strokeWidth="1.8"
+      className={className}
+      aria-hidden
+    >
+      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
+    </svg>
+  );
+}
+
+function CalendarIcon({ className }: IconProps) {
+  return (
+    <svg
+      viewBox="0 0 24 24"
+      fill="none"
+      stroke="currentColor"
+      strokeWidth="1.8"
+      className={className}
+      aria-hidden
+    >
+      <rect x="4" y="5" width="16" height="15" rx="2" />
+      <path d="M8 3v4M16 3v4M4 10h16" strokeLinecap="round" />
+    </svg>
+  );
+}
+
+function PlateIcon({ className }: IconProps) {
+  return (
+    <svg
+      viewBox="0 0 24 24"
+      fill="none"
+      stroke="currentColor"
+      strokeWidth="1.8"
+      className={className}
+      aria-hidden
+    >
+      <rect x="3.5" y="6" width="17" height="12" rx="2" />
+      <path d="M8 10h8M7 14h2m6 0h2" strokeLinecap="round" />
+    </svg>
+  );
+}
+
+function TagIcon({ className }: IconProps) {
+  return (
+    <svg
+      viewBox="0 0 24 24"

--- apps/web/lib/crm-client.ts
diff --git a/apps/web/lib/crm-client.ts b/apps/web/lib/crm-client.ts
index 86026d9..0f617a0 100644
--- a/apps/web/lib/crm-client.ts
+++ b/apps/web/lib/crm-client.ts
@@ -237,6 +237,21 @@ async function fetchFromBff<T>(path: string): Promise<ApiResult<T>> {
     }
 
     if (!response.ok) {
+      try {
+        const body = JSON.parse(raw) as { message?: string };
+        if (
+          response.status === 500 &&
+          typeof body.message === "string" &&
+          body.message.includes("Failed to get session")
+        ) {
+          return {
+            kind: "unauthorized",
+          };
+        }
+      } catch {
+        // Ignore JSON parsing failures here and build the generic error below.
+      }
+
       let detail = `El BFF respondió con ${response.status}.`;
       try {
         const body = JSON.parse(raw) as { message?: string };

```

### Commit 4: fd381e7
**Message:** feat: implement phase 2 idauto delivery

**Diff:**
```diff
--- .env.example
diff --git a/.env.example b/.env.example
index 4687d29..221b759 100644
--- a/.env.example
+++ b/.env.example
@@ -11,3 +11,9 @@ NEXTJS_ORIGIN=http://localhost:3000
 
 # Webhooks
 WEBHOOK_SECRET=your-webhook-secret
+
+# Id Auto delivery integration
+# TODO: replace with the real Id Auto backend endpoint and auth contract.
+IDAUTO_DELIVERY_ENDPOINT=http://localhost:3200/api/deliveries
+IDAUTO_DELIVERY_SECRET=your-idauto-delivery-secret
+IDAUTO_DELIVERY_TIMEOUT_MS=8000


--- apps/bff/src/modules/transactions/delivery.service.ts
diff --git a/apps/bff/src/modules/transactions/delivery.service.ts b/apps/bff/src/modules/transactions/delivery.service.ts
index 558edc9..03c8501 100644
--- a/apps/bff/src/modules/transactions/delivery.service.ts
+++ b/apps/bff/src/modules/transactions/delivery.service.ts
@@ -1,6 +1,10 @@
 import { randomUUID } from "node:crypto";
 import { prisma } from "@repo/db";
 import { findDemoClient, getDemoTransactions } from "./demo-data.js";
+import {
+  idAutoNotifier,
+  type NotifyDeliveryInput,
+} from "./idauto-notifier.js";
 import type { TransactionStatus } from "./transactions.service.js";
 
 interface SqlClient {
@@ -30,10 +34,23 @@ interface DeliveryTransactionRow {
   id: string;
   saleId: string;
   status: TransactionStatus;
+  automotoraName: string | null;
   clientName: string;
   clientEmail: string | null;
   clientPhone: string | null;
   clientRut: string | null;
+  vehiclePlate: string;
+  vehicleMake: string;
+  vehicleModel: string;
+  vehicleYear: number | null;
+}
+
+interface DeliveryDocumentRow {
+  id: string;
+  type: string;
+  status: "PENDING" | "COMPLETED";
+  fileUrl: string | null;
+  completedAt: Date | string | null;
 }
 
 export interface ClientLookupVehicle {
@@ -64,6 +81,8 @@ export interface DeliverTransactionResult {
   deliveryId: string;
   clientFound: boolean;
   clientNotified: boolean;
+  deliveryStatus: DeliveryStatus;
+  message: string;
   source: "database" | "demo";
 }
 
@@ -71,27 +90,14 @@ export class DeliveryValidationError extends Error {}
 export class DeliveryConflictError extends Error {}
 export class DeliveryNotFoundError extends Error {}
 
-interface NotifyDeliveryInput {
-  transactionId: string;
-  saleId: string;
-  clientUserId: string | null;
-  clientName: string;
-  clientEmail: string | null;
-  clientPhone: string | null;
-  clientRut: string | null;
-}
-
-export interface IIdAutoNotifier {
-  notifyDelivery(input: NotifyDeliveryInput): Promise<boolean>;
-}
-
-class StubIdAutoNotifier implements IIdAutoNotifier {
-  async notifyDelivery(_input: NotifyDeliveryInput) {
-    return false;
-  }
-}
+export const deliveryStatuses = [
+  "PENDING_CLIENT_MATCH",
+  "PENDING_IDAUTO_DELIVERY",
+  "DELIVERED_TO_APP",
+  "DELIVERY_FAILED",
+] as const;
 
-const idAutoNotifier: IIdAutoNotifier = new StubIdAutoNotifier();
+export type DeliveryStatus = (typeof deliveryStatuses)[number];
 
 function normalizeEmail(value?: string | null) {
   const trimmed = value?.trim();
@@ -103,6 +109,14 @@ function normalizeText(value?: string | null) {
   return trimmed ? trimmed : null;
 }
 
+function normalizeIsoDate(value: Date | string | null) {
+  if (!value) {
+    return null;
+  }
+
+  return value instanceof Date ? value.toISOString() : value;
+}
+
 function normalizeLookupParams(params: DeliveryLookupParams) {
   return {
     email: normalizeEmail(params.email),
@@ -134,6 +148,30 @@ function shouldFallbackToDemoData(error: unknown) {
   );
 }
 
+function buildDeliveryMessage(params: {
+  clientFound: boolean;
+  deliveryStatus: DeliveryStatus;
+  providerMessage: string | null;
+}) {
+  if (params.providerMessage) {
+    return params.providerMessage;
+  }
+
+  if (!params.clientFound) {
+    return "No encontramos una cuenta Id Auto para este cliente. Puedes invitarlo a registrarse y reintentar.";
+  }
+
+  if (params.deliveryStatus === "DELIVERED_TO_APP") {
+    return "Los documentos fueron entregados a la app Id Auto del cliente.";
+  }
+
+  if (params.deliveryStatus === "PENDING_IDAUTO_DELIVERY") {
+    return "La entrega quedo pendiente hacia Id Auto. Revisa la configuracion del conector y vuelve a intentar.";
+  }
+
+  return "No pudimos completar la entrega en Id Auto. Revisa el detalle e intenta nuevamente.";
+}
+
 async function lookupClientInDatabase(
   db: SqlClient,
   params: ReturnType<typeof normalizeLookupParams>,
@@ -254,12 +292,18 @@ async function findTransactionForDelivery(
         t."id",
         t."saleId",
         t."status",
+        t."automotoraName",
         c."name" AS "clientName",
         c."email" AS "clientEmail",
         c."phone" AS "clientPhone",
-        c."rut" AS "clientRut"
+        c."rut" AS "clientRut",
+        v."plate" AS "vehiclePlate",
+        v."make" AS "vehicleMake",
+        v."model" AS "vehicleModel",
+        v."year" AS "vehicleYear"
       FROM "Transaction" t
       INNER JOIN "Client" c ON c."id" = t."clientId"
+      INNER JOIN "Vehicle" v ON v."id" = t."vehicleId"
       WHERE t."id" = $1
         AND t."salesmanId" = $2
       LIMIT 1
@@ -272,6 +316,26 @@ async function findTransactionForDelivery(

--- apps/bff/src/modules/transactions/demo-data.ts
diff --git a/apps/bff/src/modules/transactions/demo-data.ts b/apps/bff/src/modules/transactions/demo-data.ts
index 6724482..a75d616 100644
--- a/apps/bff/src/modules/transactions/demo-data.ts
+++ b/apps/bff/src/modules/transactions/demo-data.ts
@@ -1,5 +1,6 @@
 import type {
   TransactionDetail,
+  TransactionDeliveryItem,
   TransactionDocumentItem,
   TransactionListItem,
   TransactionStatus,
@@ -152,6 +153,36 @@ function buildWorkflowEvents(
   );
 }
 
+function buildDeliveries(
+  transactionId: string,
+  status: TransactionStatus,
+): TransactionDeliveryItem[] {
+  if (status !== "DELIVERED" && status !== "VIEWED") {
+    return [];
+  }
+
+  return [
+    {
+      id: `${transactionId}-delivery-1`,
+      status: "DELIVERED_TO_APP",
+      channel: "idauto-app",
+      clientFound: true,
+      clientNotified: true,
+      clientName: items.find((item) => item.id === transactionId)?.client.name ?? null,
+      clientEmail: items.find((item) => item.id === transactionId)?.client.email ?? null,
+      clientPhone: items.find((item) => item.id === transactionId)?.client.phone ?? null,
+      clientRut: null,
+      providerDeliveryId: `idauto-${transactionId}`,
+      providerMessage: "Entrega demo confirmada en Id Auto.",
+      providerError: null,
+      deliveredAt: isoHoursAgo(3),
+      notifiedAt: isoHoursAgo(3),
+      createdAt: isoHoursAgo(3),
+      updatedAt: isoHoursAgo(3),
+    },
+  ];
+}
+
 const items: TransactionListItem[] = [
   {
     id: "demo-tx-1",
@@ -230,6 +261,7 @@ export function getDemoTransactionDetail(
   return {
     ...transaction,
     documents: buildDocuments(transaction.saleId, transaction.status),
+    deliveries: buildDeliveries(transaction.id, transaction.status),
   };
 }
 


--- apps/bff/src/modules/transactions/idauto-notifier.ts
diff --git a/apps/bff/src/modules/transactions/idauto-notifier.ts b/apps/bff/src/modules/transactions/idauto-notifier.ts
new file mode 100644
index 0000000..63c167a
--- /dev/null
+++ b/apps/bff/src/modules/transactions/idauto-notifier.ts
@@ -0,0 +1,177 @@
+interface IdAutoDeliveryDocument {
+  id: string;
+  type: string;
+  status: "PENDING" | "COMPLETED";
+  fileUrl: string | null;
+  completedAt: string | null;
+}
+
+interface IdAutoDeliveryVehicle {
+  plate: string;
+  make: string;
+  model: string;
+  year: number | null;
+}
+
+export interface NotifyDeliveryInput {
+  crmDeliveryId: string;
+  transactionId: string;
+  saleId: string;
+  automotoraName: string | null;
+  clientUserId: string | null;
+  clientName: string;
+  clientEmail: string | null;
+  clientPhone: string | null;
+  clientRut: string | null;
+  vehicle: IdAutoDeliveryVehicle;
+  documents: IdAutoDeliveryDocument[];
+  deliveredAt: string;
+}
+
+export interface IdAutoNotifyResult {
+  kind: "delivered" | "pending" | "failed";
+  externalDeliveryId: string | null;
+  message: string | null;
+  error: string | null;
+}
+
+export interface IIdAutoNotifier {
+  notifyDelivery(input: NotifyDeliveryInput): Promise<IdAutoNotifyResult>;
+}
+
+interface IdAutoDeliveryResponse {
+  deliveryId?: string | null;
+  message?: string | null;
+  error?: string | null;
+}
+
+function clampTimeout(value: string | undefined) {
+  const parsed = Number(value);
+  if (!Number.isFinite(parsed)) {
+    return 8_000;
+  }
+
+  return Math.min(Math.max(Math.trunc(parsed), 1_000), 30_000);
+}
+
+function readConfig() {
+  const endpoint = process.env.IDAUTO_DELIVERY_ENDPOINT?.trim();
+  const secret = process.env.IDAUTO_DELIVERY_SECRET?.trim();
+  const timeoutMs = clampTimeout(process.env.IDAUTO_DELIVERY_TIMEOUT_MS);
+
+  return {
+    endpoint,
+    secret,
+    timeoutMs,
+  };
+}
+
+function buildRequestPayload(input: NotifyDeliveryInput) {
+  return {
+    crmDeliveryId: input.crmDeliveryId,
+    transactionId: input.transactionId,
+    saleId: input.saleId,
+    automotoraName: input.automotoraName,
+    deliveredAt: input.deliveredAt,
+    client: {
+      userId: input.clientUserId,
+      name: input.clientName,
+      email: input.clientEmail,
+      phone: input.clientPhone,
+      rut: input.clientRut,
+    },
+    vehicle: input.vehicle,
+    documents: input.documents,
+    metadata: {
+      source: "idauto-crm",
+      channel: "idauto-app",
+    },
+  };
+}
+
+async function readJsonSafely(response: Response) {
+  try {
+    return (await response.json()) as IdAutoDeliveryResponse;
+  } catch {
+    return null;
+  }
+}
+
+export class HttpIdAutoNotifier implements IIdAutoNotifier {
+  async notifyDelivery(input: NotifyDeliveryInput): Promise<IdAutoNotifyResult> {
+    const config = readConfig();
+
+    if (!config.endpoint) {
+      return {
+        kind: "pending",
+        externalDeliveryId: null,
+        message:
+          "La integracion Id Auto no esta configurada todavia en el BFF.",
+        error: null,
+      };
+    }
+
+    const controller = new AbortController();
+    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
+
+    try {
+      const response = await fetch(config.endpoint, {
+        method: "POST",
+        headers: {
+          "content-type": "application/json",
+          ...(config.secret
+            ? {
+                // TODO: replace this provisional shared-secret header with the
+                // real authentication contract exposed by the Id Auto backend.
+                "x-idauto-delivery-secret": config.secret,
+              }
+            : {}),
+        },
+        body: JSON.stringify(buildRequestPayload(input)),
+        signal: controller.signal,
+      });
+
+      const body = await readJsonSafely(response);
+
+      if (response.status === 202) {
+        return {
+          kind: "pending",
+          externalDeliveryId: body?.deliveryId ?? null,
+          message:
+            body?.message ??
+            "Id Auto acepto la entrega para procesamiento asincrono.",
+          error: null,
+        };

--- apps/bff/src/modules/transactions/transactions.schemas.ts
diff --git a/apps/bff/src/modules/transactions/transactions.schemas.ts b/apps/bff/src/modules/transactions/transactions.schemas.ts
index a19f757..609ba59 100644
--- a/apps/bff/src/modules/transactions/transactions.schemas.ts
+++ b/apps/bff/src/modules/transactions/transactions.schemas.ts
@@ -1,4 +1,5 @@
 import { transactionStatuses } from "./transactions.service.js";
+import { deliveryStatuses } from "./delivery.service.js";
 
 export const transactionListQuerySchema = {
   type: "object",
@@ -145,6 +146,46 @@ const transactionDocumentSchema = {
   required: ["id", "type", "status", "fileUrl", "completedAt", "createdAt", "updatedAt"],
 } as const;
 
+const deliveryRecordSchema = {
+  type: "object",
+  properties: {
+    id: { type: "string" },
+    status: { type: "string", enum: [...deliveryStatuses] },
+    channel: { type: "string" },
+    clientFound: { type: "boolean" },
+    clientNotified: { type: "boolean" },
+    clientName: { type: ["string", "null"] },
+    clientEmail: { type: ["string", "null"] },
+    clientPhone: { type: ["string", "null"] },
+    clientRut: { type: ["string", "null"] },
+    providerDeliveryId: { type: ["string", "null"] },
+    providerMessage: { type: ["string", "null"] },
+    providerError: { type: ["string", "null"] },
+    deliveredAt: { type: "string", format: "date-time" },
+    notifiedAt: { type: ["string", "null"], format: "date-time" },
+    createdAt: { type: "string", format: "date-time" },
+    updatedAt: { type: "string", format: "date-time" },
+  },
+  required: [
+    "id",
+    "status",
+    "channel",
+    "clientFound",
+    "clientNotified",
+    "clientName",
+    "clientEmail",
+    "clientPhone",
+    "clientRut",
+    "providerDeliveryId",
+    "providerMessage",
+    "providerError",
+    "deliveredAt",
+    "notifiedAt",
+    "createdAt",
+    "updatedAt",
+  ],
+} as const;
+
 const workflowEventSchema = {
   type: "object",
   properties: {
@@ -190,6 +231,10 @@ export const transactionDetailResponseSchema = {
       type: "array",
       items: transactionDocumentSchema,
     },
+    deliveries: {
+      type: "array",
+      items: deliveryRecordSchema,
+    },
   },
   required: [
     "id",
@@ -201,6 +246,7 @@ export const transactionDetailResponseSchema = {
     "client",
     "vehicle",
     "documents",
+    "deliveries",
   ],
 } as const;
 
@@ -271,6 +317,8 @@ export const deliverTransactionResponseSchema = {
     deliveryId: { type: "string" },
     clientFound: { type: "boolean" },
     clientNotified: { type: "boolean" },
+    deliveryStatus: { type: "string", enum: [...deliveryStatuses] },
+    message: { type: "string" },
     source: {
       type: "string",
       enum: ["database", "demo"],
@@ -281,6 +329,8 @@ export const deliverTransactionResponseSchema = {
     "deliveryId",
     "clientFound",
     "clientNotified",
+    "deliveryStatus",
+    "message",
     "source",
   ],
 } as const;


--- apps/bff/src/modules/transactions/transactions.service.ts
diff --git a/apps/bff/src/modules/transactions/transactions.service.ts b/apps/bff/src/modules/transactions/transactions.service.ts
index dc5ea27..1681aea 100644
--- a/apps/bff/src/modules/transactions/transactions.service.ts
+++ b/apps/bff/src/modules/transactions/transactions.service.ts
@@ -4,6 +4,10 @@ import {
   getDemoTransactions,
   getDemoWorkflowEvents,
 } from "./demo-data.js";
+import {
+  deliveryStatuses,
+  type DeliveryStatus,
+} from "./delivery.service.js";
 
 export const transactionStatuses = [
   "SUBMITTED",
@@ -58,8 +62,28 @@ export interface WorkflowEventItem {
   createdAt: string;
 }
 
+export interface TransactionDeliveryItem {
+  id: string;
+  status: DeliveryStatus;
+  channel: string;
+  clientFound: boolean;
+  clientNotified: boolean;
+  clientName: string | null;
+  clientEmail: string | null;
+  clientPhone: string | null;
+  clientRut: string | null;
+  providerDeliveryId: string | null;
+  providerMessage: string | null;
+  providerError: string | null;
+  deliveredAt: string;
+  notifiedAt: string | null;
+  createdAt: string;
+  updatedAt: string;
+}
+
 export interface TransactionDetail extends Omit<TransactionListItem, "documents"> {
   documents: TransactionDocumentItem[];
+  deliveries: TransactionDeliveryItem[];
 }
 
 export interface TransactionsListResult {
@@ -121,6 +145,25 @@ interface TransactionDocumentRow {
   updatedAt: Date | string;
 }
 
+interface TransactionDeliveryRow {
+  id: string;
+  status: DeliveryStatus;
+  channel: string;
+  clientFound: boolean;
+  clientNotified: boolean;
+  clientName: string | null;
+  clientEmail: string | null;
+  clientPhone: string | null;
+  clientRut: string | null;
+  providerDeliveryId: string | null;
+  providerMessage: string | null;
+  providerError: string | null;
+  deliveredAt: Date | string;
+  notifiedAt: Date | string | null;
+  createdAt: Date | string;
+  updatedAt: Date | string;
+}
+
 interface WorkflowEventRow {
   id: string;
   eventType: string;
@@ -236,6 +279,27 @@ function toWorkflowEventItem(row: WorkflowEventRow): WorkflowEventItem {
   };
 }
 
+function toDeliveryItem(row: TransactionDeliveryRow): TransactionDeliveryItem {
+  return {
+    id: row.id,
+    status: row.status,
+    channel: row.channel,
+    clientFound: row.clientFound,
+    clientNotified: row.clientNotified,
+    clientName: row.clientName,
+    clientEmail: row.clientEmail,
+    clientPhone: row.clientPhone,
+    clientRut: row.clientRut,
+    providerDeliveryId: row.providerDeliveryId,
+    providerMessage: row.providerMessage,
+    providerError: row.providerError,
+    deliveredAt: normalizeDate(row.deliveredAt),
+    notifiedAt: normalizeOptionalDate(row.notifiedAt),
+    createdAt: normalizeDate(row.createdAt),
+    updatedAt: normalizeDate(row.updatedAt),
+  };
+}
+
 export async function listTransactions(
   params: ListTransactionsParams,
 ): Promise<TransactionsListResult> {
@@ -377,6 +441,39 @@ export async function getTransactionDetail(params: {
       params.transactionId,
     );
 
+    let deliveryRows: TransactionDeliveryRow[] = [];
+    try {
+      deliveryRows = await prisma.$queryRawUnsafe<TransactionDeliveryRow[]>(
+        `
+          SELECT
+            d."id",
+            d."status",
+            d."channel",
+            d."clientFound",
+            d."clientNotified",
+            d."clientName",
+            d."clientEmail",
+            d."clientPhone",
+            d."clientRut",
+            d."providerDeliveryId",
+            d."providerMessage",
+            d."providerError",
+            d."deliveredAt",
+            d."notifiedAt",
+            d."createdAt",
+            d."updatedAt"
+          FROM "Delivery" d
+          WHERE d."transactionId" = $1
+          ORDER BY d."deliveredAt" DESC
+        `,
+        params.transactionId,
+      );
+    } catch (error) {
+      if (!shouldFallbackToDemoData(error)) {
+        throw error;
+      }
+    }
+
     return {
       id: detailRow.id,
       saleId: detailRow.saleId,
@@ -396,6 +493,7 @@ export async function getTransactionDetail(params: {
         year: detailRow.vehicleYear,
       },
       documents: documentRows.map(toDocumentItem),
+      deliveries: deliveryRows.map(toDeliveryItem),
     };
   } catch (error) {
     if (!shouldFallbackToDemoData(error)) {


--- apps/web/app/transactions/[id]/delivery-panel.tsx
diff --git a/apps/web/app/transactions/[id]/delivery-panel.tsx b/apps/web/app/transactions/[id]/delivery-panel.tsx
index a65b550..2b87ad5 100644
--- a/apps/web/app/transactions/[id]/delivery-panel.tsx
+++ b/apps/web/app/transactions/[id]/delivery-panel.tsx
@@ -14,6 +14,12 @@ type TransactionStatus =
   | "DELIVERED"
   | "VIEWED";
 
+type DeliveryStatus =
+  | "PENDING_CLIENT_MATCH"
+  | "PENDING_IDAUTO_DELIVERY"
+  | "DELIVERED_TO_APP"
+  | "DELIVERY_FAILED";
+
 interface ClientLookupVehicle {
   plate: string;
   make: string;
@@ -34,9 +40,30 @@ interface DeliverTransactionResponse {
   deliveryId: string;
   clientFound: boolean;
   clientNotified: boolean;
+  deliveryStatus: DeliveryStatus;
+  message: string;
   source: "database" | "demo";
 }
 
+interface TransactionDeliveryItem {
+  id: string;
+  status: DeliveryStatus;
+  channel: string;
+  clientFound: boolean;
+  clientNotified: boolean;
+  clientName: string | null;
+  clientEmail: string | null;
+  clientPhone: string | null;
+  clientRut: string | null;
+  providerDeliveryId: string | null;
+  providerMessage: string | null;
+  providerError: string | null;
+  deliveredAt: string;
+  notifiedAt: string | null;
+  createdAt: string;
+  updatedAt: string;
+}
+
 interface ErrorResponse {
   message?: string;
 }
@@ -47,6 +74,7 @@ interface DeliveryPanelProps {
   clientName: string;
   defaultEmail: string | null;
   defaultPhone: string | null;
+  deliveries: TransactionDeliveryItem[];
 }
 
 function statusMessage(status: TransactionStatus) {
@@ -57,6 +85,20 @@ function statusMessage(status: TransactionStatus) {
   return "La entrega se habilita cuando la transaccion llega a estado READY.";
 }
 
+const deliveryStatusLabels: Record<DeliveryStatus, string> = {
+  PENDING_CLIENT_MATCH: "Pendiente por matching",
+  PENDING_IDAUTO_DELIVERY: "Pendiente en Id Auto",
+  DELIVERED_TO_APP: "Entregado a la app",
+  DELIVERY_FAILED: "Error de entrega",
+};
+
+const deliveryStatusClasses: Record<DeliveryStatus, string> = {
+  PENDING_CLIENT_MATCH: "bg-amber-100 text-amber-800",
+  PENDING_IDAUTO_DELIVERY: "bg-sky-100 text-sky-800",
+  DELIVERED_TO_APP: "bg-emerald-100 text-emerald-800",
+  DELIVERY_FAILED: "bg-rose-100 text-rose-800",
+};
+
 async function readErrorMessage(response: Response) {
   try {
     const data = (await response.json()) as ErrorResponse;
@@ -72,6 +114,7 @@ export function DeliveryPanel({
   clientName,
   defaultEmail,
   defaultPhone,
+  deliveries,
 }: DeliveryPanelProps) {
   const router = useRouter();
   const [email, setEmail] = useState(defaultEmail ?? "");
@@ -89,6 +132,7 @@ export function DeliveryPanel({
   const bffUrl = process.env.NEXT_PUBLIC_BFF_URL;
 
   const canDeliver = status === "READY";
+  const latestDelivery = deliveries[0] ?? null;
 
   const lookupClient = () => {
     startLookupTransition(async () => {
@@ -194,10 +238,12 @@ export function DeliveryPanel({
 
         const data = (await response.json()) as DeliverTransactionResponse;
         setFeedback({
-          tone: "success",
-          message: data.clientFound
-            ? `Entrega registrada (${data.source}). Encontramos la cuenta del cliente, pero la notificacion a Id Auto aun no esta integrada.`
-            : `Entrega registrada (${data.source}). No encontramos una cuenta Id Auto coincidente para el cliente.`,
+          tone: data.deliveryStatus === "DELIVERED_TO_APP"
+            ? "success"
+            : data.deliveryStatus === "DELIVERY_FAILED"
+              ? "error"
+              : "neutral",
+          message: `${data.message} (${data.source === "database" ? "base CRM" : "demo local"})`,
         });
 
         if (data.source === "database") {
@@ -234,9 +280,32 @@ export function DeliveryPanel({
           <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
             {statusMessage(status)}
           </span>
+        ) : latestDelivery ? (
+          <span
+            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${deliveryStatusClasses[latestDelivery.status]}`}
+          >
+            {deliveryStatusLabels[latestDelivery.status]}
+          </span>
         ) : null}
       </div>
 
+      {latestDelivery ? (
+        <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
+          <p className="text-sm font-semibold text-gray-900">
+            Ultimo intento: {deliveryStatusLabels[latestDelivery.status]}
+          </p>
+          <p className="mt-1 text-sm text-gray-600">
+            {latestDelivery.providerMessage ??
+              "Sin mensaje adicional desde la integracion."}
+          </p>
+          {latestDelivery.providerError ? (
+            <p className="mt-2 text-sm text-rose-700">
+              Error: {latestDelivery.providerError}
+            </p>
+          ) : null}
+        </div>
+      ) : null}
+
       <div className="mt-6 grid gap-4 md:grid-cols-3">
         <label className="text-sm text-gray-600">
           Email


--- apps/web/app/transactions/[id]/page.tsx
diff --git a/apps/web/app/transactions/[id]/page.tsx b/apps/web/app/transactions/[id]/page.tsx
index e1305d9..1a64264 100644
--- a/apps/web/app/transactions/[id]/page.tsx
+++ b/apps/web/app/transactions/[id]/page.tsx
@@ -27,6 +27,11 @@ const eventTypeLabels: Record<string, string> = {
   "transaction.processing": "Workflow documental en proceso",
   "transaction.ready": "Documentacion lista para entregar",
   "transaction.delivered": "Entrega al cliente confirmada",
+  "transaction.delivery.pending-client-match":
+    "Entrega pendiente por matching de cliente",
+  "transaction.delivery.pending-idauto":
+    "Entrega pendiente de sincronizacion con Id Auto",
+  "transaction.delivery.failed": "Intento de entrega con error",
   "transaction.viewed": "Cliente abrio los documentos",
 };
 


--- apps/web/app/transactions/[id]/transaction-detail-live.tsx
diff --git a/apps/web/app/transactions/[id]/transaction-detail-live.tsx b/apps/web/app/transactions/[id]/transaction-detail-live.tsx
index d30563c..855c294 100644
--- a/apps/web/app/transactions/[id]/transaction-detail-live.tsx
+++ b/apps/web/app/transactions/[id]/transaction-detail-live.tsx
@@ -12,6 +12,12 @@ type TransactionStatus =
   | "DELIVERED"
   | "VIEWED";
 
+type DeliveryStatus =
+  | "PENDING_CLIENT_MATCH"
+  | "PENDING_IDAUTO_DELIVERY"
+  | "DELIVERED_TO_APP"
+  | "DELIVERY_FAILED";
+
 interface TransactionDocumentItem {
   id: string;
   type: string;
@@ -22,6 +28,25 @@ interface TransactionDocumentItem {
   updatedAt: string;
 }
 
+interface TransactionDeliveryItem {
+  id: string;
+  status: DeliveryStatus;
+  channel: string;
+  clientFound: boolean;
+  clientNotified: boolean;
+  clientName: string | null;
+  clientEmail: string | null;
+  clientPhone: string | null;
+  clientRut: string | null;
+  providerDeliveryId: string | null;
+  providerMessage: string | null;
+  providerError: string | null;
+  deliveredAt: string;
+  notifiedAt: string | null;
+  createdAt: string;
+  updatedAt: string;
+}
+
 interface TransactionDetailResponse {
   id: string;
   saleId: string;
@@ -41,6 +66,7 @@ interface TransactionDetailResponse {
     year: number | null;
   };
   documents: TransactionDocumentItem[];
+  deliveries: TransactionDeliveryItem[];
 }
 
 const statusLabels: Record<TransactionStatus, string> = {
@@ -69,6 +95,20 @@ const documentTypeLabels: Record<string, string> = {
   OTHER: "Otro documento",
 };
 
+const deliveryStatusLabels: Record<DeliveryStatus, string> = {
+  PENDING_CLIENT_MATCH: "Pendiente por matching",
+  PENDING_IDAUTO_DELIVERY: "Pendiente en Id Auto",
+  DELIVERED_TO_APP: "Entregado a la app",
+  DELIVERY_FAILED: "Error de entrega",
+};
+
+const deliveryStatusClasses: Record<DeliveryStatus, string> = {
+  PENDING_CLIENT_MATCH: "bg-amber-100 text-amber-800",
+  PENDING_IDAUTO_DELIVERY: "bg-sky-100 text-sky-800",
+  DELIVERED_TO_APP: "bg-emerald-100 text-emerald-800",
+  DELIVERY_FAILED: "bg-rose-100 text-rose-800",
+};
+
 function formatDate(value: string) {
   return new Intl.DateTimeFormat("es-CL", {
     dateStyle: "medium",
@@ -93,6 +133,72 @@ function SummaryCard({
   );
 }
 
+function DeliveryHistory({
+  deliveries,
+}: {
+  deliveries: TransactionDeliveryItem[];
+}) {
+  return (
+    <SummaryCard title="Intentos de entrega">
+      {deliveries.length === 0 ? (
+        <p className="text-sm text-gray-500">
+          Aun no hay intentos registrados hacia Id Auto para esta transaccion.
+        </p>
+      ) : (
+        <div className="space-y-3">
+          {deliveries.map((delivery) => (
+            <div
+              key={delivery.id}
+              className="rounded-2xl border border-gray-200 px-4 py-4"
+            >
+              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
+                <div>
+                  <p className="font-medium text-gray-900">
+                    {delivery.clientName ?? "Cliente sin nombre"} ·{" "}
+                    {formatDate(delivery.deliveredAt)}
+                  </p>
+                  <p className="mt-1 text-xs text-gray-500">
+                    Canal {delivery.channel} ·{" "}
+                    {delivery.clientFound
+                      ? "cuenta Id Auto encontrada"
+                      : "cuenta Id Auto no encontrada"}
+                  </p>
+                </div>
+                <span
+                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${deliveryStatusClasses[delivery.status]}`}
+                >
+                  {deliveryStatusLabels[delivery.status]}
+                </span>
+              </div>
+
+              {delivery.providerMessage ? (
+                <p className="mt-3 text-sm text-gray-600">
+                  {delivery.providerMessage}
+                </p>
+              ) : null}
+
+              {delivery.providerError ? (
+                <p className="mt-2 text-sm text-rose-700">
+                  Error: {delivery.providerError}
+                </p>
+              ) : null}
+
+              <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
+                {delivery.providerDeliveryId ? (
+                  <span>Id externo: {delivery.providerDeliveryId}</span>
+                ) : null}
+                {delivery.notifiedAt ? (
+                  <span>Notificado {formatDate(delivery.notifiedAt)}</span>
+                ) : null}
+              </div>
+            </div>
+          ))}
+        </div>
+      )}
+    </SummaryCard>
+  );
+}
+
 async function fetchTransactionDetail(
   transactionId: string,
   baseUrl: string,
@@ -247,8 +353,11 @@ export function TransactionDetailLive({
         clientName={detail.client.name}
         defaultEmail={detail.client.email}
         defaultPhone={detail.client.phone}
+        deliveries={detail.deliveries}

--- apps/web/lib/crm-client.ts
diff --git a/apps/web/lib/crm-client.ts b/apps/web/lib/crm-client.ts
index 831d87e..6f5a204 100644
--- a/apps/web/lib/crm-client.ts
+++ b/apps/web/lib/crm-client.ts
@@ -7,6 +7,12 @@ export type TransactionStatus =
   | "DELIVERED"
   | "VIEWED";
 
+export type DeliveryStatus =
+  | "PENDING_CLIENT_MATCH"
+  | "PENDING_IDAUTO_DELIVERY"
+  | "DELIVERED_TO_APP"
+  | "DELIVERY_FAILED";
+
 export interface TransactionListItem {
   id: string;
   saleId: string;
@@ -68,6 +74,26 @@ export interface TransactionDetailResponse {
     year: number | null;
   };
   documents: TransactionDocumentItem[];
+  deliveries: TransactionDeliveryItem[];
+}
+
+export interface TransactionDeliveryItem {
+  id: string;
+  status: DeliveryStatus;
+  channel: string;
+  clientFound: boolean;
+  clientNotified: boolean;
+  clientName: string | null;
+  clientEmail: string | null;
+  clientPhone: string | null;
+  clientRut: string | null;
+  providerDeliveryId: string | null;
+  providerMessage: string | null;
+  providerError: string | null;
+  deliveredAt: string;
+  notifiedAt: string | null;
+  createdAt: string;
+  updatedAt: string;
 }
 
 export interface WorkflowEventItem {


--- packages/db/prisma/migrations/20260413170000_phase2_delivery_integration/migration.sql
diff --git a/packages/db/prisma/migrations/20260413170000_phase2_delivery_integration/migration.sql b/packages/db/prisma/migrations/20260413170000_phase2_delivery_integration/migration.sql
new file mode 100644
index 0000000..1d17847
--- /dev/null
+++ b/packages/db/prisma/migrations/20260413170000_phase2_delivery_integration/migration.sql
@@ -0,0 +1,38 @@
+-- CreateEnum
+CREATE TYPE "DeliveryStatus" AS ENUM (
+    'PENDING_CLIENT_MATCH',
+    'PENDING_IDAUTO_DELIVERY',
+    'DELIVERED_TO_APP',
+    'DELIVERY_FAILED'
+);
+
+-- AlterTable
+ALTER TABLE "Delivery"
+ADD COLUMN "clientFound" BOOLEAN NOT NULL DEFAULT false,
+ADD COLUMN "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING_CLIENT_MATCH',
+ADD COLUMN "providerDeliveryId" TEXT,
+ADD COLUMN "providerMessage" TEXT,
+ADD COLUMN "providerError" TEXT,
+ADD COLUMN "notifiedAt" TIMESTAMP(3);
+
+-- Backfill
+UPDATE "Delivery"
+SET
+    "clientFound" = COALESCE("clientUserId" IS NOT NULL, false),
+    "status" = CASE
+        WHEN "clientNotified" = true THEN 'DELIVERED_TO_APP'::"DeliveryStatus"
+        WHEN "clientUserId" IS NOT NULL THEN 'PENDING_IDAUTO_DELIVERY'::"DeliveryStatus"
+        ELSE 'PENDING_CLIENT_MATCH'::"DeliveryStatus"
+    END,
+    "notifiedAt" = CASE
+        WHEN "clientNotified" = true THEN "deliveredAt"
+        ELSE NULL
+    END,
+    "providerMessage" = CASE
+        WHEN "clientNotified" = true THEN 'Migrated delivery record from phase 1.'
+        WHEN "clientUserId" IS NOT NULL THEN 'TODO: replay this delivery through the real Id Auto integration.'
+        ELSE 'TODO: client matching is still pending for this delivery.'
+    END;
+
+-- CreateIndex
+CREATE INDEX "Delivery_status_deliveredAt_idx" ON "Delivery"("status", "deliveredAt");


--- packages/db/prisma/schema.prisma
diff --git a/packages/db/prisma/schema.prisma b/packages/db/prisma/schema.prisma
index 0a7d29a..3f96056 100644
--- a/packages/db/prisma/schema.prisma
+++ b/packages/db/prisma/schema.prisma
@@ -87,6 +87,13 @@ enum DocumentStatus {
   COMPLETED
 }
 
+enum DeliveryStatus {
+  PENDING_CLIENT_MATCH
+  PENDING_IDAUTO_DELIVERY
+  DELIVERED_TO_APP
+  DELIVERY_FAILED
+}
+
 model Client {
   id           String        @id @default(cuid())
   name         String
@@ -177,9 +184,15 @@ model Delivery {
   clientEmail    String?
   clientPhone    String?
   clientRut      String?
+  clientFound    Boolean  @default(false)
   channel        String   @default("idauto-app")
+  status         DeliveryStatus
   clientNotified Boolean  @default(false)
+  providerDeliveryId String?
+  providerMessage String?
+  providerError  String?
   deliveredAt    DateTime @default(now())
+  notifiedAt     DateTime?
   createdAt      DateTime @default(now())
   updatedAt      DateTime @updatedAt
 
@@ -188,6 +201,7 @@ model Delivery {
 
   @@index([transactionId, deliveredAt])
   @@index([deliveredById, deliveredAt])
+  @@index([status, deliveredAt])
 }
 
 model WebhookIdempotency {

```

## Claims a labelar

Opciones: `grounded` | `plausible_unsupported` | `contradicted` | `irrelevant` | `frame`

| # | Claim | Pre-label (LLM) | Tu label | Notas |
|---|-------|-----------------|----------|-------|
| 0 | One integration shipped from stub to production. | needs_human | | |
| 1 | The idauto-crm work started with the honest marker every real integration has: a TODO in the env config. | needs_human | | |
| 2 | Placeholder endpoint, placeholder secret, 8-second timeout already baked in. | needs_human | | |
| 3 | Phase 2 wasn't pretending the backend contract was settled — it shipped the HTTP notifier abstraction and delivery history UI anyway, with real timeout discipline already enforced before the upstream  | needs_human | | |
| 4 | Phase 3 layered in the CRM muscle. | needs_human | | |
| 5 | FollowUp and TransactionNote models with explicit OPEN/COMPLETED/CANCELED status vocabulary. | needs_human | | |
| 6 | Notes and follow-ups hanging off transaction detail. | needs_human | | |
| 7 | Summary metrics surfaced where they belong. | needs_human | | |
| 8 | The domain model got opinions. | needs_human | | |
| 9 | Then the deployment pipeline arrived — containerized, GCP Artifact Registry, Helm charts for Kubernetes orchestration, CI/CD separated from runtime secret management. | needs_human | | |
| 10 | The .dockerignore tells the whole story: node_modules, .next, .turbo, .github all excluded. | needs_human | | |
| 11 | What ships is exactly what should ship, nothing that shouldn't. | needs_human | | |
| 12 | The final commit is the one that ties the room together. | needs_human | | |
| 13 | DashboardPageFrame, a proper sidebar/navbar/content layout, modal transaction creation, numbered timeline for workflow visualization — and session error handling that actually catches failures instead | needs_human | | |
| 14 | That try/catch around getSession isn't defensive noise; it's the difference between a blank page and a recoverable error state. | needs_human | | |
| 15 | Stub to Helm chart in a week. | needs_human | | |
| 16 | The TODOs are honest about what's left. | needs_human | | |
| 17 | Everything else is done. | needs_human | | |

## Post-level

- **Publish readiness:** [ ] publish_asis [ ] light_edit [ ] rewrite [ ] discard
- **¿Qué te haría desconfiar del post?** _______
