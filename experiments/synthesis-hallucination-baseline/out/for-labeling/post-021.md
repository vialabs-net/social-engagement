# Post 021

## Post generado

> Six days, three commits, one CRM going from zero to alive.
> 
> Commit one lays the full foundation: Prisma schema with enums, transaction listing and detail views, delivery workflow, client lookup, demo data, API routes, and a web UI with status tracking. That's not scaffolding — that's a working system on day one.
> 
> But "working" had a problem. The transaction detail page was static. You'd load it, see whatever status existed at render time, and stare at it while the world moved on without you. Fine for a prototype. Not fine for a delivery workflow where the whole point is watching something become ready.
> 
> Commit two fixes exactly that. The static TransactionDetailView gets replaced by TransactionDetailLive — a client component with polling, a latestStatusRef tracking state across renders, and a toast notification that fires when status hits READY. The page now watches the transaction so the user doesn't have to refresh and wonder.
> 
> Commit three adds the relational layer that turns transaction tracking into actual sales management. TransactionNote and FollowUp entities land with their own schemas, routes, and demo data builders. Notes can be created against a transaction. Follow-ups have their own status enum. The demo data builder checks for "demo-tx-1" specifically — which means the seeding strategy is deliberate, not throwaway.
> 
> The arc here is clean: model the domain, make the UI reactive to state changes, then add the relational context that makes records useful to humans over time. Notes and follow-ups aren't features bolted on — they're the difference between a transaction log and a CRM.
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

### Commit 2: 14df489
**Message:** Implement CRM phase 1 foundation

**Diff:**
```diff
--- apps/bff/src/app.ts
diff --git a/apps/bff/src/app.ts b/apps/bff/src/app.ts
index 8ab30c4..fa6455b 100644
--- a/apps/bff/src/app.ts
+++ b/apps/bff/src/app.ts
@@ -3,6 +3,7 @@ import cors from "@fastify/cors";
 import swagger from "@fastify/swagger";
 import swaggerUi from "@fastify/swagger-ui";
 import { auth } from "./auth.js";
+import { transactionsRoutes } from "./modules/transactions/transactions.routes.js";
 
 export async function buildApp() {
   const app = Fastify({ logger: true });
@@ -53,5 +54,7 @@ export async function buildApp() {
   // Health check
   app.get("/health", async () => ({ status: "ok" }));
 
+  await app.register(transactionsRoutes);
+
   return app;
 }


--- apps/bff/src/auth.ts
diff --git a/apps/bff/src/auth.ts b/apps/bff/src/auth.ts
index 9e83c0f..00d1149 100644
--- a/apps/bff/src/auth.ts
+++ b/apps/bff/src/auth.ts
@@ -4,6 +4,12 @@ import { prisma } from "@repo/db";
 
 export const auth = betterAuth({
   database: prismaAdapter(prisma, { provider: "postgresql" }),
-  emailAndPassword: { enabled: true },
+  emailAndPassword: {
+    enabled: true,
+    sendResetPassword: async ({ user, url }) => {
+      // Temporary dev implementation until transactional email is wired in.
+      console.info(`Password reset requested for ${user.email}: ${url}`);
+    },
+  },
   trustedOrigins: [process.env.NEXTJS_ORIGIN || "http://localhost:3000"],
 });


--- apps/bff/src/http/request-headers.ts
diff --git a/apps/bff/src/http/request-headers.ts b/apps/bff/src/http/request-headers.ts
new file mode 100644
index 0000000..30495ba
--- /dev/null
+++ b/apps/bff/src/http/request-headers.ts
@@ -0,0 +1,22 @@
+export function fromNodeHeaders(
+  nodeHeaders: Record<string, string | string[] | undefined>,
+): Headers {
+  const headers = new Headers();
+
+  for (const [key, value] of Object.entries(nodeHeaders)) {
+    if (!value) {
+      continue;
+    }
+
+    if (Array.isArray(value)) {
+      for (const item of value) {
+        headers.append(key, item);
+      }
+      continue;
+    }
+
+    headers.append(key, value);
+  }
+
+  return headers;
+}


--- apps/bff/src/http/require-session.ts
diff --git a/apps/bff/src/http/require-session.ts b/apps/bff/src/http/require-session.ts
new file mode 100644
index 0000000..7d50951
--- /dev/null
+++ b/apps/bff/src/http/require-session.ts
@@ -0,0 +1,31 @@
+import type { FastifyReply, FastifyRequest } from "fastify";
+import { auth } from "../auth.js";
+import { fromNodeHeaders } from "./request-headers.js";
+
+export interface SessionUser {
+  id: string;
+  name: string;
+  email: string;
+}
+
+export async function requireSession(
+  request: FastifyRequest,
+  reply: FastifyReply,
+): Promise<SessionUser | null> {
+  const session = await auth.api.getSession({
+    headers: fromNodeHeaders(request.headers),
+  });
+
+  if (!session?.user) {
+    reply.code(401).send({
+      message: "Unauthorized",
+    });
+    return null;
+  }
+
+  return {
+    id: session.user.id,
+    name: session.user.name,
+    email: session.user.email,
+  };
+}


--- apps/bff/src/modules/transactions/delivery.service.ts
diff --git a/apps/bff/src/modules/transactions/delivery.service.ts b/apps/bff/src/modules/transactions/delivery.service.ts
new file mode 100644
index 0000000..616f65d
--- /dev/null
+++ b/apps/bff/src/modules/transactions/delivery.service.ts
@@ -0,0 +1,440 @@
+import { randomUUID } from "node:crypto";
+import { prisma } from "@repo/db";
+import { findDemoClient, getDemoTransactions } from "./demo-data.js";
+import type { TransactionStatus } from "./transactions.service.js";
+
+interface SqlClient {
+  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
+  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
+}
+
+interface DeliveryLookupParams {
+  email?: string;
+  phone?: string;
+  rut?: string;
+}
+
+interface DatabaseClientRow {
+  id: string;
+  name: string;
+}
+
+interface DatabaseVehicleRow {
+  plate: string;
+  make: string;
+  model: string;
+  year: number | null;
+}
+
+interface DeliveryTransactionRow {
+  id: string;
+  saleId: string;
+  status: TransactionStatus;
+  clientName: string;
+  clientEmail: string | null;
+  clientPhone: string | null;
+  clientRut: string | null;
+}
+
+export interface ClientLookupVehicle {
+  plate: string;
+  make: string;
+  model: string;
+  year: number | null;
+}
+
+export interface ClientLookupResult {
+  found: boolean;
+  userId: string | null;
+  name: string | null;
+  vehicles: ClientLookupVehicle[];
+  source: "database" | "demo";
+}
+
+export interface DeliverTransactionInput {
+  transactionId: string;
+  salesmanId: string;
+  clientEmail?: string;
+  clientPhone?: string;
+  clientRut?: string;
+}
+
+export interface DeliverTransactionResult {
+  success: boolean;
+  deliveryId: string;
+  clientNotified: boolean;
+  source: "database" | "demo";
+}
+
+export class DeliveryValidationError extends Error {}
+export class DeliveryConflictError extends Error {}
+export class DeliveryNotFoundError extends Error {}
+
+function normalizeEmail(value?: string | null) {
+  const trimmed = value?.trim();
+  return trimmed ? trimmed.toLowerCase() : null;
+}
+
+function normalizeText(value?: string | null) {
+  const trimmed = value?.trim();
+  return trimmed ? trimmed : null;
+}
+
+function normalizeLookupParams(params: DeliveryLookupParams) {
+  return {
+    email: normalizeEmail(params.email),
+    phone: normalizeText(params.phone),
+    rut: normalizeText(params.rut),
+  };
+}
+
+function hasLookupCriteria(params: {
+  email?: string | null;
+  phone?: string | null;
+  rut?: string | null;
+}) {
+  return Boolean(params.email || params.phone || params.rut);
+}
+
+function shouldFallbackToDemoData(error: unknown) {
+  const message =
+    error instanceof Error
+      ? error.message.toLowerCase()
+      : String(error).toLowerCase();
+
+  return (
+    message.includes("relation") ||
+    message.includes("does not exist") ||
+    message.includes("table") ||
+    message.includes("column") ||
+    message.includes("database_url")
+  );
+}
+
+async function lookupClientInDatabase(
+  db: SqlClient,
+  params: ReturnType<typeof normalizeLookupParams>,
+): Promise<Omit<ClientLookupResult, "source">> {
+  const clientRows = await db.$queryRawUnsafe<DatabaseClientRow[]>(
+    `
+      SELECT c."id", c."name"
+      FROM "Client" c
+      WHERE ($1 IS NOT NULL AND LOWER(c."email") = LOWER($1))
+         OR ($2 IS NOT NULL AND c."phone" = $2)
+         OR ($3 IS NOT NULL AND c."rut" = $3)
+      LIMIT 1
+    `,
+    params.email,
+    params.phone,
+    params.rut,
+  );
+
+  const client = clientRows[0];
+  if (!client) {
+    return {
+      found: false,
+      userId: null,
+      name: null,
+      vehicles: [],
+    };
+  }
+
+  const vehicleRows = await db.$queryRawUnsafe<DatabaseVehicleRow[]>(
+    `
+      SELECT DISTINCT

--- apps/bff/src/modules/transactions/demo-data.ts
diff --git a/apps/bff/src/modules/transactions/demo-data.ts b/apps/bff/src/modules/transactions/demo-data.ts
new file mode 100644
index 0000000..6724482
--- /dev/null
+++ b/apps/bff/src/modules/transactions/demo-data.ts
@@ -0,0 +1,280 @@
+import type {
+  TransactionDetail,
+  TransactionDocumentItem,
+  TransactionListItem,
+  TransactionStatus,
+  WorkflowEventItem,
+} from "./transactions.service.js";
+
+const now = new Date("2026-04-08T12:00:00.000Z");
+
+function daysAgo(days: number) {
+  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
+}
+
+function buildDocumentSummary(status: TransactionStatus) {
+  if (status === "READY" || status === "DELIVERED" || status === "VIEWED") {
+    return {
+      completed: 5,
+      total: 5,
+    };
+  }
+
+  if (status === "PROCESSING") {
+    return {
+      completed: 3,
+      total: 5,
+    };
+  }
+
+  return {
+    completed: 2,
+    total: 5,
+  };
+}
+
+function isoHoursAgo(hours: number) {
+  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
+}
+
+function buildDocuments(
+  saleId: string,
+  status: TransactionStatus,
+): TransactionDocumentItem[] {
+  const completedTypes =
+    status === "READY" || status === "DELIVERED" || status === "VIEWED"
+      ? [
+          "FACTURA",
+          "NOTA_VENTA",
+          "SOAP",
+          "PERMISO_CIRCULACION",
+          "REVISION_TECNICA",
+        ]
+      : status === "PROCESSING"
+        ? ["FACTURA", "NOTA_VENTA", "SOAP"]
+        : ["FACTURA", "NOTA_VENTA"]
+;
+
+  const orderedTypes = [
+    "FACTURA",
+    "NOTA_VENTA",
+    "SOAP",
+    "PERMISO_CIRCULACION",
+    "REVISION_TECNICA",
+  ] as const;
+
+  return orderedTypes.map((type, index) => {
+    const completed = completedTypes.includes(type);
+
+    return {
+      id: `${saleId}-${type.toLowerCase()}`,
+      type,
+      status: completed ? "COMPLETED" : "PENDING",
+      fileUrl: completed ? `https://files.idauto.dev/${saleId}/${type}.pdf` : null,
+      completedAt: completed ? isoHoursAgo(index + 3) : null,
+      createdAt: isoHoursAgo(index + 12),
+      updatedAt: completed ? isoHoursAgo(index + 2) : isoHoursAgo(index + 12),
+    };
+  });
+}
+
+function buildWorkflowEvents(
+  transactionId: string,
+  status: TransactionStatus,
+): WorkflowEventItem[] {
+  const events: WorkflowEventItem[] = [
+    {
+      id: `${transactionId}-submitted`,
+      eventType: "transaction.submitted",
+      eventStatus: "SUBMITTED",
+      payload: {
+        source: "broker",
+      },
+      occurredAt: isoHoursAgo(30),
+      createdAt: isoHoursAgo(30),
+    },
+  ];
+
+  if (status === "PROCESSING" || status === "READY" || status === "DELIVERED" || status === "VIEWED") {
+    events.push({
+      id: `${transactionId}-processing`,
+      eventType: "transaction.processing",
+      eventStatus: "PROCESSING",
+      payload: {
+        queue: "total-check",
+      },
+      occurredAt: isoHoursAgo(22),
+      createdAt: isoHoursAgo(22),
+    });
+  }
+
+  if (status === "READY" || status === "DELIVERED" || status === "VIEWED") {
+    events.push({
+      id: `${transactionId}-ready`,
+      eventType: "transaction.ready",
+      eventStatus: "READY",
+      payload: {
+        documents: ["SOAP", "PERMISO_CIRCULACION", "REVISION_TECNICA"],
+      },
+      occurredAt: isoHoursAgo(6),
+      createdAt: isoHoursAgo(6),
+    });
+  }
+
+  if (status === "DELIVERED" || status === "VIEWED") {
+    events.push({
+      id: `${transactionId}-delivered`,
+      eventType: "transaction.delivered",
+      eventStatus: "DELIVERED",
+      payload: {
+        channel: "idauto-app",
+      },
+      occurredAt: isoHoursAgo(3),
+      createdAt: isoHoursAgo(3),
+    });
+  }
+
+  if (status === "VIEWED") {
+    events.push({
+      id: `${transactionId}-viewed`,
+      eventType: "transaction.viewed",
+      eventStatus: "VIEWED",
+      payload: {
+        firstOpenAt: isoHoursAgo(1),
+      },

--- apps/bff/src/modules/transactions/transactions.routes.ts
diff --git a/apps/bff/src/modules/transactions/transactions.routes.ts b/apps/bff/src/modules/transactions/transactions.routes.ts
new file mode 100644
index 0000000..1cbb3e5
--- /dev/null
+++ b/apps/bff/src/modules/transactions/transactions.routes.ts
@@ -0,0 +1,321 @@
+import type { FastifyPluginAsync } from "fastify";
+import { requireSession } from "../../http/require-session.js";
+import {
+  getTransactionDetail,
+  getTransactionWorkflowEvents,
+  listTransactions,
+  transactionStatuses,
+  type TransactionStatus,
+} from "./transactions.service.js";
+import {
+  badRequestResponseSchema,
+  clientLookupQuerySchema,
+  clientLookupResponseSchema,
+  conflictResponseSchema,
+  deliverTransactionBodySchema,
+  deliverTransactionResponseSchema,
+  notFoundResponseSchema,
+  transactionDetailResponseSchema,
+  transactionListQuerySchema,
+  transactionParamsSchema,
+  transactionsListResponseSchema,
+  unauthorizedResponseSchema,
+  workflowWebhookBodySchema,
+  workflowWebhookResponseSchema,
+  workflowEventsResponseSchema,
+} from "./transactions.schemas.js";
+import {
+  deliverTransaction,
+  DeliveryConflictError,
+  DeliveryNotFoundError,
+  DeliveryValidationError,
+  lookupClient,
+} from "./delivery.service.js";
+import {
+  processWorkflowWebhook,
+  type WorkflowWebhookInput,
+} from "./workflow-webhook.service.js";
+
+interface TransactionsQuerystring {
+  status?: string;
+  page?: number;
+  size?: number;
+}
+
+interface TransactionParams {
+  id: string;
+}
+
+interface WorkflowWebhookHeaders {
+  "x-webhook-secret"?: string;
+  "x-idauto-webhook-secret"?: string;
+}
+
+interface ClientLookupQuerystring {
+  email?: string;
+  phone?: string;
+  rut?: string;
+}
+
+interface DeliverTransactionBody {
+  clientEmail?: string;
+  clientPhone?: string;
+  clientRut?: string;
+}
+
+function getWebhookSecret(headers: WorkflowWebhookHeaders) {
+  return headers["x-webhook-secret"] ?? headers["x-idauto-webhook-secret"];
+}
+
+function parseStatus(value?: string): TransactionStatus | undefined {
+  if (!value) {
+    return undefined;
+  }
+
+  if (transactionStatuses.includes(value as TransactionStatus)) {
+    return value as TransactionStatus;
+  }
+
+  return undefined;
+}
+
+export const transactionsRoutes: FastifyPluginAsync = async (app) => {
+  app.get<{ Querystring: TransactionsQuerystring }>(
+    "/api/crm/transactions",
+    {
+      schema: {
+        tags: ["crm", "transactions"],
+        summary: "List CRM transactions for the authenticated salesperson",
+        querystring: transactionListQuerySchema,
+        response: {
+          200: transactionsListResponseSchema,
+          401: unauthorizedResponseSchema,
+        },
+      },
+    },
+    async (request, reply) => {
+      const user = await requireSession(request, reply);
+      if (!user) {
+        return;
+      }
+
+      const page = Number(request.query.page ?? 1);
+      const size = Number(request.query.size ?? 10);
+      const status = parseStatus(request.query.status);
+
+      return listTransactions({
+        salesmanId: user.id,
+        page,
+        size,
+        status,
+      });
+    },
+  );
+
+  app.get<{ Params: TransactionParams }>(
+    "/api/crm/transactions/:id",
+    {
+      schema: {
+        tags: ["crm", "transactions"],
+        summary: "Get CRM transaction detail",
+        params: transactionParamsSchema,
+        response: {
+          200: transactionDetailResponseSchema,
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
+      const detail = await getTransactionDetail({
+        salesmanId: user.id,
+        transactionId: request.params.id,
+      });
+
+      if (!detail) {
+        reply.code(404).send({
+          message: "Transaction not found",
+        });
+        return;

--- apps/bff/src/modules/transactions/transactions.schemas.ts
diff --git a/apps/bff/src/modules/transactions/transactions.schemas.ts b/apps/bff/src/modules/transactions/transactions.schemas.ts
new file mode 100644
index 0000000..d2d9889
--- /dev/null
+++ b/apps/bff/src/modules/transactions/transactions.schemas.ts
@@ -0,0 +1,366 @@
+import { transactionStatuses } from "./transactions.service.js";
+
+export const transactionListQuerySchema = {
+  type: "object",
+  properties: {
+    status: {
+      type: "string",
+      enum: [...transactionStatuses],
+    },
+    page: {
+      type: "integer",
+      minimum: 1,
+      default: 1,
+    },
+    size: {
+      type: "integer",
+      minimum: 1,
+      maximum: 50,
+      default: 10,
+    },
+  },
+  additionalProperties: false,
+} as const;
+
+export const transactionsListResponseSchema = {
+  type: "object",
+  properties: {
+    items: {
+      type: "array",
+      items: {
+        type: "object",
+        properties: {
+          id: { type: "string" },
+          saleId: { type: "string" },
+          status: { type: "string", enum: [...transactionStatuses] },
+          createdAt: { type: "string", format: "date-time" },
+          updatedAt: { type: "string", format: "date-time" },
+          automotoraName: { type: ["string", "null"] },
+          client: {
+            type: "object",
+            properties: {
+              name: { type: "string" },
+              email: { type: ["string", "null"] },
+              phone: { type: ["string", "null"] },
+            },
+            required: ["name", "email", "phone"],
+          },
+          vehicle: {
+            type: "object",
+            properties: {
+              plate: { type: "string" },
+              make: { type: "string" },
+              model: { type: "string" },
+              year: { type: ["integer", "null"] },
+            },
+            required: ["plate", "make", "model", "year"],
+          },
+          documents: {
+            type: "object",
+            properties: {
+              completed: { type: "integer" },
+              total: { type: "integer" },
+            },
+            required: ["completed", "total"],
+          },
+        },
+        required: [
+          "id",
+          "saleId",
+          "status",
+          "createdAt",
+          "updatedAt",
+          "automotoraName",
+          "client",
+          "vehicle",
+          "documents",
+        ],
+      },
+    },
+    total: { type: "integer" },
+    page: { type: "integer" },
+    size: { type: "integer" },
+    source: {
+      type: "string",
+      enum: ["database", "demo"],
+    },
+  },
+  required: ["items", "total", "page", "size", "source"],
+} as const;
+
+export const unauthorizedResponseSchema = {
+  type: "object",
+  properties: {
+    message: { type: "string" },
+  },
+  required: ["message"],
+} as const;
+
+export const badRequestResponseSchema = {
+  type: "object",
+  properties: {
+    message: { type: "string" },
+  },
+  required: ["message"],
+} as const;
+
+export const conflictResponseSchema = {
+  type: "object",
+  properties: {
+    message: { type: "string" },
+  },
+  required: ["message"],
+} as const;
+
+export const notFoundResponseSchema = {
+  type: "object",
+  properties: {
+    message: { type: "string" },
+  },
+  required: ["message"],
+} as const;
+
+export const transactionParamsSchema = {
+  type: "object",
+  properties: {
+    id: { type: "string" },
+  },
+  required: ["id"],
+} as const;
+
+const transactionDocumentSchema = {
+  type: "object",
+  properties: {
+    id: { type: "string" },
+    type: { type: "string" },
+    status: {
+      type: "string",
+      enum: ["PENDING", "COMPLETED"],
+    },
+    fileUrl: { type: ["string", "null"] },
+    completedAt: { type: ["string", "null"], format: "date-time" },
+    createdAt: { type: "string", format: "date-time" },
+    updatedAt: { type: "string", format: "date-time" },
+  },

--- apps/bff/src/modules/transactions/transactions.service.ts
diff --git a/apps/bff/src/modules/transactions/transactions.service.ts b/apps/bff/src/modules/transactions/transactions.service.ts
new file mode 100644
index 0000000..dc5ea27
--- /dev/null
+++ b/apps/bff/src/modules/transactions/transactions.service.ts
@@ -0,0 +1,454 @@
+import { prisma } from "@repo/db";
+import {
+  getDemoTransactionDetail,
+  getDemoTransactions,
+  getDemoWorkflowEvents,
+} from "./demo-data.js";
+
+export const transactionStatuses = [
+  "SUBMITTED",
+  "PROCESSING",
+  "READY",
+  "DELIVERED",
+  "VIEWED",
+] as const;
+
+export type TransactionStatus = (typeof transactionStatuses)[number];
+
+export interface TransactionListItem {
+  id: string;
+  saleId: string;
+  status: TransactionStatus;
+  createdAt: string;
+  updatedAt: string;
+  automotoraName: string | null;
+  client: {
+    name: string;
+    email: string | null;
+    phone: string | null;
+  };
+  vehicle: {
+    plate: string;
+    make: string;
+    model: string;
+    year: number | null;
+  };
+  documents: {
+    completed: number;
+    total: number;
+  };
+}
+
+export interface TransactionDocumentItem {
+  id: string;
+  type: string;
+  status: "PENDING" | "COMPLETED";
+  fileUrl: string | null;
+  completedAt: string | null;
+  createdAt: string;
+  updatedAt: string;
+}
+
+export interface WorkflowEventItem {
+  id: string;
+  eventType: string;
+  eventStatus: TransactionStatus | null;
+  payload: unknown;
+  occurredAt: string;
+  createdAt: string;
+}
+
+export interface TransactionDetail extends Omit<TransactionListItem, "documents"> {
+  documents: TransactionDocumentItem[];
+}
+
+export interface TransactionsListResult {
+  items: TransactionListItem[];
+  total: number;
+  page: number;
+  size: number;
+  source: "database" | "demo";
+}
+
+interface ListTransactionsParams {
+  salesmanId: string;
+  page: number;
+  size: number;
+  status?: TransactionStatus;
+}
+
+interface TransactionRow {
+  id: string;
+  saleId: string;
+  status: TransactionStatus;
+  createdAt: Date | string;
+  updatedAt: Date | string;
+  automotoraName: string | null;
+  clientName: string;
+  clientEmail: string | null;
+  clientPhone: string | null;
+  vehiclePlate: string;
+  vehicleMake: string;
+  vehicleModel: string;
+  vehicleYear: number | null;
+  documentCompletedCount: number;
+  documentTotalCount: number;
+}
+
+interface TransactionDetailRow {
+  id: string;
+  saleId: string;
+  status: TransactionStatus;
+  createdAt: Date | string;
+  updatedAt: Date | string;
+  automotoraName: string | null;
+  clientName: string;
+  clientEmail: string | null;
+  clientPhone: string | null;
+  vehiclePlate: string;
+  vehicleMake: string;
+  vehicleModel: string;
+  vehicleYear: number | null;
+}
+
+interface TransactionDocumentRow {
+  id: string;
+  type: string;
+  status: "PENDING" | "COMPLETED";
+  fileUrl: string | null;
+  completedAt: Date | string | null;
+  createdAt: Date | string;
+  updatedAt: Date | string;
+}
+
+interface WorkflowEventRow {
+  id: string;
+  eventType: string;
+  eventStatus: TransactionStatus | null;
+  payload: unknown;
+  occurredAt: Date | string;
+  createdAt: Date | string;
+}
+
+function normalizeDate(value: Date | string) {
+  return value instanceof Date ? value.toISOString() : value;
+}
+
+function normalizeOptionalDate(value: Date | string | null) {
+  if (!value) {
+    return null;
+  }
+
+  return value instanceof Date ? value.toISOString() : value;
+}
+

--- apps/bff/src/modules/transactions/workflow-webhook.service.ts
diff --git a/apps/bff/src/modules/transactions/workflow-webhook.service.ts b/apps/bff/src/modules/transactions/workflow-webhook.service.ts
new file mode 100644
index 0000000..e1809c5
--- /dev/null
+++ b/apps/bff/src/modules/transactions/workflow-webhook.service.ts
@@ -0,0 +1,673 @@
+import { createHash, randomUUID } from "node:crypto";
+import { prisma } from "@repo/db";
+import { transactionStatuses, type TransactionStatus } from "./transactions.service.js";
+
+interface WorkflowWebhookDocumentInput {
+  type?: string;
+  status?: "PENDING" | "COMPLETED";
+  fileUrl?: string | null;
+  completedAt?: string | null;
+}
+
+interface WorkflowWebhookPayloadBody {
+  status?: TransactionStatus;
+  documents?: Array<string | WorkflowWebhookDocumentInput>;
+  [key: string]: unknown;
+}
+
+interface WorkflowWebhookActor {
+  id?: string;
+  email?: string;
+  name?: string;
+}
+
+interface WorkflowWebhookClient {
+  name?: string;
+  email?: string;
+  phone?: string;
+  rut?: string;
+}
+
+interface WorkflowWebhookVehicle {
+  plate?: string;
+  vin?: string;
+  make?: string;
+  model?: string;
+  year?: number;
+}
+
+export interface WorkflowWebhookInput {
+  id?: string;
+  transactionId: string;
+  saleId?: string;
+  eventType: string;
+  timestamp: string;
+  automotoraName?: string | null;
+  salesman?: WorkflowWebhookActor;
+  client?: WorkflowWebhookClient;
+  vehicle?: WorkflowWebhookVehicle;
+  payload?: WorkflowWebhookPayloadBody;
+}
+
+export interface WorkflowWebhookResult {
+  processed: boolean;
+  duplicate: boolean;
+  transactionId: string | null;
+  status: TransactionStatus | null;
+}
+
+type DocumentStatus = "PENDING" | "COMPLETED";
+
+interface ExistingTransactionRow {
+  id: string;
+}
+
+interface ExistingUserRow {
+  id: string;
+}
+
+interface ExistingClientRow {
+  id: string;
+}
+
+interface ExistingVehicleRow {
+  id: string;
+}
+
+interface SqlClient {
+  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
+  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
+}
+
+function isTransactionStatus(value: unknown): value is TransactionStatus {
+  return typeof value === "string" && transactionStatuses.includes(value as TransactionStatus);
+}
+
+function mapEventTypeToStatus(eventType: string): TransactionStatus | null {
+  const normalized = eventType.toLowerCase();
+
+  if (normalized === "transaction.submitted") {
+    return "SUBMITTED";
+  }
+
+  if (normalized === "transaction.processing" || normalized === "document.completed") {
+    return "PROCESSING";
+  }
+
+  if (normalized === "transaction.ready") {
+    return "READY";
+  }
+
+  if (normalized === "transaction.delivered") {
+    return "DELIVERED";
+  }
+
+  if (normalized === "transaction.viewed") {
+    return "VIEWED";
+  }
+
+  return null;
+}
+
+function resolveNextStatus(input: WorkflowWebhookInput): TransactionStatus | null {
+  if (isTransactionStatus(input.payload?.status)) {
+    return input.payload.status;
+  }
+
+  return mapEventTypeToStatus(input.eventType);
+}
+
+function normalizeDocumentStatus(value?: string): DocumentStatus {
+  return value === "COMPLETED" ? "COMPLETED" : "PENDING";
+}
+
+function normalizeDocumentType(value?: string) {
+  if (!value) {
+    return "OTHER";
+  }
+
+  const normalized = value
+    .trim()
+    .toUpperCase()
+    .replace(/[^A-Z0-9]+/g, "_")
+    .replace(/^_+|_+$/g, "");
+
+  const knownTypes = new Set([
+    "FACTURA",
+    "NOTA_VENTA",
+    "SOAP",
+    "PERMISO_CIRCULACION",
+    "REVISION_TECNICA",
+    "PADRON",
+    "OTHER",
+  ]);
+

--- apps/web/app/(auth)/forgot-password/page.tsx
diff --git a/apps/web/app/(auth)/forgot-password/page.tsx b/apps/web/app/(auth)/forgot-password/page.tsx
index 7f0e275..848dcf8 100644
--- a/apps/web/app/(auth)/forgot-password/page.tsx
+++ b/apps/web/app/(auth)/forgot-password/page.tsx
@@ -21,7 +21,7 @@ export default function ForgotPasswordPage() {
     }
 
     setLoading(true);
-    const { error: authError } = await authClient.forgetPassword({
+    const { error: authError } = await authClient.requestPasswordReset({
       email,
       redirectTo: "/reset-password",
     });


--- apps/web/app/transactions/[id]/delivery-panel.tsx
diff --git a/apps/web/app/transactions/[id]/delivery-panel.tsx b/apps/web/app/transactions/[id]/delivery-panel.tsx
new file mode 100644
index 0000000..cb59344
--- /dev/null
+++ b/apps/web/app/transactions/[id]/delivery-panel.tsx
@@ -0,0 +1,324 @@
+"use client";
+
+import { useRouter } from "next/navigation";
+import { useState, useTransition } from "react";
+
+type TransactionStatus =
+  | "SUBMITTED"
+  | "PROCESSING"
+  | "READY"
+  | "DELIVERED"
+  | "VIEWED";
+
+interface ClientLookupVehicle {
+  plate: string;
+  make: string;
+  model: string;
+  year: number | null;
+}
+
+interface ClientLookupResponse {
+  found: boolean;
+  userId: string | null;
+  name: string | null;
+  vehicles: ClientLookupVehicle[];
+  source: "database" | "demo";
+}
+
+interface DeliverTransactionResponse {
+  success: boolean;
+  deliveryId: string;
+  clientNotified: boolean;
+  source: "database" | "demo";
+}
+
+interface ErrorResponse {
+  message?: string;
+}
+
+interface DeliveryPanelProps {
+  transactionId: string;
+  status: TransactionStatus;
+  clientName: string;
+  defaultEmail: string | null;
+  defaultPhone: string | null;
+}
+
+function statusMessage(status: TransactionStatus) {
+  if (status === "DELIVERED" || status === "VIEWED") {
+    return "Esta transaccion ya fue entregada al cliente.";
+  }
+
+  return "La entrega se habilita cuando la transaccion llega a estado READY.";
+}
+
+async function readErrorMessage(response: Response) {
+  try {
+    const data = (await response.json()) as ErrorResponse;
+    return data.message ?? `El BFF respondio con ${response.status}.`;
+  } catch {
+    return `El BFF respondio con ${response.status}.`;
+  }
+}
+
+export function DeliveryPanel({
+  transactionId,
+  status,
+  clientName,
+  defaultEmail,
+  defaultPhone,
+}: DeliveryPanelProps) {
+  const router = useRouter();
+  const [email, setEmail] = useState(defaultEmail ?? "");
+  const [phone, setPhone] = useState(defaultPhone ?? "");
+  const [rut, setRut] = useState("");
+  const [lookupResult, setLookupResult] = useState<ClientLookupResponse | null>(
+    null,
+  );
+  const [feedback, setFeedback] = useState<{
+    tone: "success" | "error" | "neutral";
+    message: string;
+  } | null>(null);
+  const [isLookupPending, startLookupTransition] = useTransition();
+  const [isDeliveryPending, startDeliveryTransition] = useTransition();
+  const bffUrl = process.env.NEXT_PUBLIC_BFF_URL;
+
+  const canDeliver = status === "READY";
+
+  const lookupClient = () => {
+    startLookupTransition(async () => {
+      if (!bffUrl) {
+        setFeedback({
+          tone: "error",
+          message: "NEXT_PUBLIC_BFF_URL no esta configurado en la web.",
+        });
+        return;
+      }
+
+      const query = new URLSearchParams();
+      if (email.trim()) {
+        query.set("email", email.trim());
+      }
+      if (phone.trim()) {
+        query.set("phone", phone.trim());
+      }
+      if (rut.trim()) {
+        query.set("rut", rut.trim());
+      }
+
+      if (![email, phone, rut].some((value) => value.trim().length > 0)) {
+        setFeedback({
+          tone: "error",
+          message: "Ingresa al menos email, telefono o RUT para buscar.",
+        });
+        return;
+      }
+
+      try {
+        const response = await fetch(
+          `${bffUrl}/api/crm/clients/lookup?${query.toString()}`,
+          {
+            method: "GET",
+            credentials: "include",
+            cache: "no-store",
+          },
+        );
+
+        if (!response.ok) {
+          setFeedback({
+            tone: "error",
+            message: await readErrorMessage(response),
+          });
+          return;
+        }
+
+        const data = (await response.json()) as ClientLookupResponse;
+        setLookupResult(data);
+        setFeedback({
+          tone: data.found ? "success" : "neutral",
+          message: data.found
+            ? `Cliente encontrado en modo ${data.source}.`
+            : "No encontramos una cuenta coincidente con esos datos.",
+        });
+      } catch (error) {
+        setFeedback({

--- apps/web/app/transactions/[id]/page.tsx
diff --git a/apps/web/app/transactions/[id]/page.tsx b/apps/web/app/transactions/[id]/page.tsx
new file mode 100644
index 0000000..5765034
--- /dev/null
+++ b/apps/web/app/transactions/[id]/page.tsx
@@ -0,0 +1,347 @@
+import Link from "next/link";
+import { DeliveryPanel } from "./delivery-panel";
+import {
+  getTransactionDetail,
+  getTransactionWorkflowEvents,
+  type TransactionDetailResponse,
+  type TransactionStatus,
+  type WorkflowEventItem,
+} from "../../../lib/crm-client";
+
+const statusLabels: Record<TransactionStatus, string> = {
+  SUBMITTED: "Enviado a procesar",
+  PROCESSING: "En proceso",
+  READY: "Listo para entregar",
+  DELIVERED: "Entregado",
+  VIEWED: "Cliente ha visto",
+};
+
+const statusClasses: Record<TransactionStatus, string> = {
+  SUBMITTED: "bg-slate-100 text-slate-700",
+  PROCESSING: "bg-amber-100 text-amber-800",
+  READY: "bg-emerald-100 text-emerald-800",
+  DELIVERED: "bg-sky-100 text-sky-800",
+  VIEWED: "bg-violet-100 text-violet-800",
+};
+
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
+const eventTypeLabels: Record<string, string> = {
+  "transaction.submitted": "Documentos enviados al broker",
+  "transaction.processing": "Workflow documental en proceso",
+  "transaction.ready": "Documentacion lista para entregar",
+  "transaction.delivered": "Entrega al cliente confirmada",
+  "transaction.viewed": "Cliente abrio los documentos",
+};
+
+function formatDate(value: string) {
+  return new Intl.DateTimeFormat("es-CL", {
+    dateStyle: "medium",
+    timeStyle: "short",
+  }).format(new Date(value));
+}
+
+function EmptyState({
+  title,
+  description,
+}: {
+  title: string;
+  description: string;
+}) {
+  return (
+    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
+      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
+      <p className="mt-3 text-sm text-gray-500">{description}</p>
+    </div>
+  );
+}
+
+function SummaryCard({
+  title,
+  children,
+}: {
+  title: string;
+  children: React.ReactNode;
+}) {
+  return (
+    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
+      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
+        {title}
+      </h2>
+      <div className="mt-4">{children}</div>
+    </section>
+  );
+}
+
+function WorkflowPanel({
+  items,
+  errorMessage,
+}: {
+  items: WorkflowEventItem[] | null;
+  errorMessage?: string;
+}) {
+  if (errorMessage) {
+    return (
+      <SummaryCard title="Timeline workflow">
+        <p className="text-sm text-gray-500">{errorMessage}</p>
+      </SummaryCard>
+    );
+  }
+
+  if (!items || items.length === 0) {
+    return (
+      <SummaryCard title="Timeline workflow">
+        <p className="text-sm text-gray-500">
+          Aun no hay eventos de workflow para esta transaccion.
+        </p>
+      </SummaryCard>
+    );
+  }
+
+  return (
+    <SummaryCard title="Timeline workflow">
+      <div className="space-y-4">
+        {items.map((event) => (
+          <div
+            key={event.id}
+            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"
+          >
+            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
+              <div>
+                <p className="font-semibold text-gray-900">
+                  {eventTypeLabels[event.eventType] ?? event.eventType}
+                </p>
+                <p className="mt-1 text-xs text-gray-500">
+                  {formatDate(event.occurredAt)}
+                </p>
+              </div>
+              {event.eventStatus ? (
+                <span
+                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[event.eventStatus]}`}
+                >
+                  {statusLabels[event.eventStatus]}
+                </span>
+              ) : null}
+            </div>
+
+            {event.payload ? (
+              <pre className="mt-3 overflow-x-auto rounded-xl bg-white p-3 text-xs text-gray-600">
+                {JSON.stringify(event.payload, null, 2)}
+              </pre>
+            ) : null}
+          </div>
+        ))}
+      </div>
+    </SummaryCard>
+  );

--- apps/web/app/transactions/page.tsx
diff --git a/apps/web/app/transactions/page.tsx b/apps/web/app/transactions/page.tsx
index b06d175..9c021c0 100644
--- a/apps/web/app/transactions/page.tsx
+++ b/apps/web/app/transactions/page.tsx
@@ -1,11 +1,250 @@
-export default function TransactionsPage() {
+import Link from "next/link";
+import { getTransactions, type TransactionStatus } from "../../lib/crm-client";
+
+const statusLabels: Record<TransactionStatus, string> = {
+  SUBMITTED: "Enviado a procesar",
+  PROCESSING: "En proceso",
+  READY: "Listo para entregar",
+  DELIVERED: "Entregado",
+  VIEWED: "Cliente ha visto",
+};
+
+const statusClasses: Record<TransactionStatus, string> = {
+  SUBMITTED: "bg-slate-100 text-slate-700",
+  PROCESSING: "bg-amber-100 text-amber-800",
+  READY: "bg-emerald-100 text-emerald-800",
+  DELIVERED: "bg-sky-100 text-sky-800",
+  VIEWED: "bg-violet-100 text-violet-800",
+};
+
+function formatDate(value: string) {
+  return new Intl.DateTimeFormat("es-CL", {
+    day: "2-digit",
+    month: "short",
+    year: "numeric",
+  }).format(new Date(value));
+}
+
+function EmptyState({
+  title,
+  description,
+}: {
+  title: string;
+  description: string;
+}) {
+  return (
+    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
+      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
+      <p className="mt-3 text-sm text-gray-500">{description}</p>
+    </div>
+  );
+}
+
+export default async function TransactionsPage() {
+  const result = await getTransactions();
+
+  if (result.kind === "missing-config") {
+    return (
+      <div className="min-h-screen bg-gray-50 px-4 py-10">
+        <div className="mx-auto max-w-5xl">
+          <EmptyState
+            title="Falta configurar el BFF"
+            description="Define NEXT_PUBLIC_BFF_URL para que la web pueda consultar el backend CRM."
+          />
+        </div>
+      </div>
+    );
+  }
+
+  if (result.kind === "unauthorized") {
+    return (
+      <div className="min-h-screen bg-gray-50 px-4 py-10">
+        <div className="mx-auto max-w-5xl">
+          <EmptyState
+            title="Tu sesion no esta disponible"
+            description="Inicia sesion desde el flujo de Better Auth para ver tus transacciones asignadas."
+          />
+        </div>
+      </div>
+    );
+  }
+
+  if (result.kind === "not-found") {
+    return (
+      <div className="min-h-screen bg-gray-50 px-4 py-10">
+        <div className="mx-auto max-w-5xl">
+          <EmptyState
+            title="No encontramos transacciones"
+            description="No se encontraron transacciones para el vendedor autenticado."
+          />
+        </div>
+      </div>
+    );
+  }
+
+  if (result.kind === "error") {
+    return (
+      <div className="min-h-screen bg-gray-50 px-4 py-10">
+        <div className="mx-auto max-w-5xl">
+          <EmptyState
+            title="No pudimos cargar las transacciones"
+            description={result.message}
+          />
+        </div>
+      </div>
+    );
+  }
+
+  const { items, total, source } = result.data;
+
   return (
-    <div className="flex min-h-screen items-center justify-center bg-gray-50">
-      <div className="text-center">
-        <h1 className="mb-2 text-2xl font-bold text-gray-900">
-          Transacciones
-        </h1>
-        <p className="text-gray-500">Dashboard — Coming soon</p>
+    <div className="min-h-screen bg-gray-50 px-4 py-10">
+      <div className="mx-auto flex max-w-6xl flex-col gap-6">
+        <section className="rounded-3xl bg-primary-950 px-6 py-7 text-white shadow-sm">
+          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
+            <div>
+              <p className="text-sm font-medium text-primary-200">
+                Sales Front CRM
+              </p>
+              <h1 className="mt-2 text-3xl font-bold">Mis transacciones</h1>
+              <p className="mt-3 max-w-2xl text-sm text-primary-100">
+                Vista inicial de Fase 1: estado documental, cliente, vehiculo y
+                progreso de documentos por venta.
+              </p>
+            </div>
+
+            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
+              <div className="rounded-2xl border border-primary-800 bg-primary-900/70 px-4 py-3">
+                <p className="text-xs uppercase tracking-wide text-primary-200">
+                  Total
+                </p>
+                <p className="mt-1 text-2xl font-semibold">{total}</p>
+              </div>
+              <div className="rounded-2xl border border-primary-800 bg-primary-900/70 px-4 py-3">
+                <p className="text-xs uppercase tracking-wide text-primary-200">
+                  Fuente
+                </p>
+                <p className="mt-1 text-sm font-semibold">
+                  {source === "database" ? "Base de datos" : "Datos demo"}
+                </p>
+              </div>
+              <div className="rounded-2xl border border-primary-800 bg-primary-900/70 px-4 py-3">
+                <p className="text-xs uppercase tracking-wide text-primary-200">
+                  Proximo paso
+                </p>
+                <p className="mt-1 text-sm font-semibold">
+                  Detalle y timeline
+                </p>
+              </div>

--- apps/web/lib/crm-client.ts
diff --git a/apps/web/lib/crm-client.ts b/apps/web/lib/crm-client.ts
new file mode 100644
index 0000000..831d87e
--- /dev/null
+++ b/apps/web/lib/crm-client.ts
@@ -0,0 +1,174 @@
+import { headers } from "next/headers";
+
+export type TransactionStatus =
+  | "SUBMITTED"
+  | "PROCESSING"
+  | "READY"
+  | "DELIVERED"
+  | "VIEWED";
+
+export interface TransactionListItem {
+  id: string;
+  saleId: string;
+  status: TransactionStatus;
+  createdAt: string;
+  updatedAt: string;
+  automotoraName: string | null;
+  client: {
+    name: string;
+    email: string | null;
+    phone: string | null;
+  };
+  vehicle: {
+    plate: string;
+    make: string;
+    model: string;
+    year: number | null;
+  };
+  documents: {
+    completed: number;
+    total: number;
+  };
+}
+
+export interface TransactionsResponse {
+  items: TransactionListItem[];
+  total: number;
+  page: number;
+  size: number;
+  source: "database" | "demo";
+}
+
+export interface TransactionDocumentItem {
+  id: string;
+  type: string;
+  status: "PENDING" | "COMPLETED";
+  fileUrl: string | null;
+  completedAt: string | null;
+  createdAt: string;
+  updatedAt: string;
+}
+
+export interface TransactionDetailResponse {
+  id: string;
+  saleId: string;
+  status: TransactionStatus;
+  createdAt: string;
+  updatedAt: string;
+  automotoraName: string | null;
+  client: {
+    name: string;
+    email: string | null;
+    phone: string | null;
+  };
+  vehicle: {
+    plate: string;
+    make: string;
+    model: string;
+    year: number | null;
+  };
+  documents: TransactionDocumentItem[];
+}
+
+export interface WorkflowEventItem {
+  id: string;
+  eventType: string;
+  eventStatus: TransactionStatus | null;
+  payload: unknown;
+  occurredAt: string;
+  createdAt: string;
+}
+
+export interface WorkflowEventsResponse {
+  items: WorkflowEventItem[];
+}
+
+export type ApiResult<T> =
+  | {
+      kind: "success";
+      data: T;
+    }
+  | {
+      kind: "unauthorized";
+    }
+  | {
+      kind: "missing-config";
+    }
+  | {
+      kind: "not-found";
+    }
+  | {
+      kind: "error";
+      message: string;
+    };
+
+async function fetchFromBff<T>(path: string): Promise<ApiResult<T>> {
+  const baseUrl = process.env.NEXT_PUBLIC_BFF_URL;
+  if (!baseUrl) {
+    return {
+      kind: "missing-config",
+    };
+  }
+
+  const requestHeaders = await headers();
+  const cookie = requestHeaders.get("cookie");
+  const url = new URL(path, baseUrl);
+
+  try {
+    const response = await fetch(url, {
+      method: "GET",
+      headers: cookie ? { cookie } : undefined,
+      cache: "no-store",
+    });
+
+    if (response.status === 401) {
+      return {
+        kind: "unauthorized",
+      };
+    }
+
+    if (response.status === 404) {
+      return {
+        kind: "not-found",
+      };
+    }
+
+    if (!response.ok) {
+      return {
+        kind: "error",
+        message: `El BFF respondio con ${response.status}.`,
+      };
+    }
+
+    const data = (await response.json()) as T;
+    return {

--- package.json
diff --git a/package.json b/package.json
index 213fe49..4a89066 100644
--- a/package.json
+++ b/package.json
@@ -4,9 +4,13 @@
   "scripts": {
     "build": "turbo run build",
     "dev": "turbo run dev",
+    "dev:tunnel": "bash ./scripts/with-db-tunnel.sh npm run dev",
     "lint": "turbo run lint",
     "format": "prettier --write \"**/*.{ts,tsx,md}\"",
-    "check-types": "turbo run check-types"
+    "check-types": "turbo run check-types",
+    "db:tunnel": "bash ./scripts/with-db-tunnel.sh",
+    "db:deploy:tunnel": "bash ./scripts/with-db-tunnel.sh npm run db:deploy --workspace @repo/db",
+    "db:generate:tunnel": "bash ./scripts/with-db-tunnel.sh npm run db:generate --workspace @repo/db"
   },
   "devDependencies": {
     "prettier": "^3.7.4",


--- packages/db/prisma/migrations/20260408180000_init_crm/migration.sql
diff --git a/packages/db/prisma/migrations/20260408180000_init_crm/migration.sql b/packages/db/prisma/migrations/20260408180000_init_crm/migration.sql
new file mode 100644
index 0000000..ec657fc
--- /dev/null
+++ b/packages/db/prisma/migrations/20260408180000_init_crm/migration.sql
@@ -0,0 +1,250 @@
+-- CreateSchema
+CREATE SCHEMA IF NOT EXISTS "public";
+
+-- CreateEnum
+CREATE TYPE "TransactionStatus" AS ENUM ('SUBMITTED', 'PROCESSING', 'READY', 'DELIVERED', 'VIEWED');
+
+-- CreateEnum
+CREATE TYPE "DocumentType" AS ENUM ('FACTURA', 'NOTA_VENTA', 'SOAP', 'PERMISO_CIRCULACION', 'REVISION_TECNICA', 'PADRON', 'OTHER');
+
+-- CreateEnum
+CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'COMPLETED');
+
+-- CreateTable
+CREATE TABLE "User" (
+    "id" TEXT NOT NULL,
+    "name" TEXT NOT NULL,
+    "email" TEXT NOT NULL,
+    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
+    "image" TEXT,
+    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "updatedAt" TIMESTAMP(3) NOT NULL,
+
+    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateTable
+CREATE TABLE "Session" (
+    "id" TEXT NOT NULL,
+    "expiresAt" TIMESTAMP(3) NOT NULL,
+    "token" TEXT NOT NULL,
+    "ipAddress" TEXT,
+    "userAgent" TEXT,
+    "userId" TEXT NOT NULL,
+    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "updatedAt" TIMESTAMP(3) NOT NULL,
+
+    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateTable
+CREATE TABLE "Account" (
+    "id" TEXT NOT NULL,
+    "accountId" TEXT NOT NULL,
+    "providerId" TEXT NOT NULL,
+    "userId" TEXT NOT NULL,
+    "accessToken" TEXT,
+    "refreshToken" TEXT,
+    "idToken" TEXT,
+    "accessTokenExpiresAt" TIMESTAMP(3),
+    "refreshTokenExpiresAt" TIMESTAMP(3),
+    "scope" TEXT,
+    "password" TEXT,
+    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "updatedAt" TIMESTAMP(3) NOT NULL,
+
+    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateTable
+CREATE TABLE "Verification" (
+    "id" TEXT NOT NULL,
+    "identifier" TEXT NOT NULL,
+    "value" TEXT NOT NULL,
+    "expiresAt" TIMESTAMP(3) NOT NULL,
+    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
+    "updatedAt" TIMESTAMP(3),
+
+    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateTable
+CREATE TABLE "Client" (
+    "id" TEXT NOT NULL,
+    "name" TEXT NOT NULL,
+    "email" TEXT,
+    "phone" TEXT,
+    "rut" TEXT,
+    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "updatedAt" TIMESTAMP(3) NOT NULL,
+
+    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateTable
+CREATE TABLE "Vehicle" (
+    "id" TEXT NOT NULL,
+    "plate" TEXT NOT NULL,
+    "vin" TEXT,
+    "make" TEXT NOT NULL,
+    "model" TEXT NOT NULL,
+    "year" INTEGER,
+    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "updatedAt" TIMESTAMP(3) NOT NULL,
+
+    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateTable
+CREATE TABLE "Transaction" (
+    "id" TEXT NOT NULL,
+    "brokerTransactionId" TEXT,
+    "saleId" TEXT NOT NULL,
+    "automotoraName" TEXT,
+    "status" "TransactionStatus" NOT NULL DEFAULT 'SUBMITTED',
+    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "updatedAt" TIMESTAMP(3) NOT NULL,
+    "readyAt" TIMESTAMP(3),
+    "deliveredAt" TIMESTAMP(3),
+    "viewedAt" TIMESTAMP(3),
+    "clientId" TEXT NOT NULL,
+    "vehicleId" TEXT NOT NULL,
+    "salesmanId" TEXT NOT NULL,
+
+    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateTable
+CREATE TABLE "WorkflowEvent" (
+    "id" TEXT NOT NULL,
+    "transactionId" TEXT NOT NULL,
+    "eventType" TEXT NOT NULL,
+    "eventStatus" "TransactionStatus",
+    "payload" JSONB,
+    "occurredAt" TIMESTAMP(3) NOT NULL,
+    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+
+    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateTable
+CREATE TABLE "Document" (
+    "id" TEXT NOT NULL,
+    "transactionId" TEXT NOT NULL,
+    "type" "DocumentType" NOT NULL,
+    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
+    "fileUrl" TEXT,
+    "completedAt" TIMESTAMP(3),
+    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "updatedAt" TIMESTAMP(3) NOT NULL,
+
+    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateTable

--- packages/db/prisma/migrations/migration_lock.toml
diff --git a/packages/db/prisma/migrations/migration_lock.toml b/packages/db/prisma/migrations/migration_lock.toml
new file mode 100644
index 0000000..2fe25d8
--- /dev/null
+++ b/packages/db/prisma/migrations/migration_lock.toml
@@ -0,0 +1 @@
+provider = "postgresql"


--- packages/db/prisma/schema.prisma
diff --git a/packages/db/prisma/schema.prisma b/packages/db/prisma/schema.prisma
index a30cf63..0a7d29a 100644
--- a/packages/db/prisma/schema.prisma
+++ b/packages/db/prisma/schema.prisma
@@ -20,6 +20,8 @@ model User {
 
   sessions Session[]
   accounts Account[]
+  transactions Transaction[] @relation("SalesmanTransactions")
+  deliveries  Delivery[]    @relation("SalesmanDeliveries")
 }
 
 model Session {
@@ -62,4 +64,138 @@ model Verification {
   updatedAt  DateTime? @updatedAt
 }
 
-// ─── CRM Models (placeholder — expand per 03-Transaction-Management) ──
+enum TransactionStatus {
+  SUBMITTED
+  PROCESSING
+  READY
+  DELIVERED
+  VIEWED
+}
+
+enum DocumentType {
+  FACTURA
+  NOTA_VENTA
+  SOAP
+  PERMISO_CIRCULACION
+  REVISION_TECNICA
+  PADRON
+  OTHER
+}
+
+enum DocumentStatus {
+  PENDING
+  COMPLETED
+}
+
+model Client {
+  id           String        @id @default(cuid())
+  name         String
+  email        String?       @unique
+  phone        String?       @unique
+  rut          String?       @unique
+  createdAt    DateTime      @default(now())
+  updatedAt    DateTime      @updatedAt
+
+  transactions Transaction[]
+}
+
+model Vehicle {
+  id           String        @id @default(cuid())
+  plate        String        @unique
+  vin          String?       @unique
+  make         String
+  model        String
+  year         Int?
+  createdAt    DateTime      @default(now())
+  updatedAt    DateTime      @updatedAt
+
+  transactions Transaction[]
+}
+
+model Transaction {
+  id             String            @id @default(cuid())
+  brokerTransactionId String?      @unique
+  saleId         String            @unique
+  automotoraName String?
+  status         TransactionStatus @default(SUBMITTED)
+  createdAt      DateTime          @default(now())
+  updatedAt      DateTime          @updatedAt
+  readyAt        DateTime?
+  deliveredAt    DateTime?
+  viewedAt       DateTime?
+  clientId       String
+  vehicleId      String
+  salesmanId     String
+
+  client         Client            @relation(fields: [clientId], references: [id], onDelete: Restrict)
+  vehicle        Vehicle           @relation(fields: [vehicleId], references: [id], onDelete: Restrict)
+  salesman       User              @relation("SalesmanTransactions", fields: [salesmanId], references: [id], onDelete: Restrict)
+  documents      Document[]
+  workflowEvents WorkflowEvent[]
+  deliveries     Delivery[]
+
+  @@index([salesmanId, status, createdAt])
+  @@index([clientId])
+  @@index([vehicleId])
+}
+
+model WorkflowEvent {
+  id            String      @id @default(cuid())
+  transactionId String
+  eventType     String
+  eventStatus   TransactionStatus?
+  payload       Json?
+  occurredAt    DateTime
+  createdAt     DateTime    @default(now())
+
+  transaction   Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
+
+  @@index([transactionId, occurredAt])
+}
+
+model Document {
+  id            String         @id @default(cuid())
+  transactionId String
+  type          DocumentType
+  status        DocumentStatus @default(PENDING)
+  fileUrl       String?
+  completedAt   DateTime?
+  createdAt     DateTime       @default(now())
+  updatedAt     DateTime       @updatedAt
+
+  transaction   Transaction    @relation(fields: [transactionId], references: [id], onDelete: Cascade)
+
+  @@unique([transactionId, type])
+}
+
+model Delivery {
+  id             String   @id @default(cuid())
+  transactionId  String
+  deliveredById  String
+  clientUserId   String?
+  clientName     String?
+  clientEmail    String?
+  clientPhone    String?
+  clientRut      String?
+  channel        String   @default("idauto-app")
+  clientNotified Boolean  @default(false)
+  deliveredAt    DateTime @default(now())
+  createdAt      DateTime @default(now())
+  updatedAt      DateTime @updatedAt
+
+  transaction    Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
+  deliveredBy    User        @relation("SalesmanDeliveries", fields: [deliveredById], references: [id], onDelete: Restrict)
+
+  @@index([transactionId, deliveredAt])
+  @@index([deliveredById, deliveredAt])
+}
+
+model WebhookIdempotency {
+  id          String   @id @default(cuid())
+  source      String
+  externalId  String
+  payloadHash String?
+  receivedAt  DateTime @default(now())

--- scripts/with-db-tunnel.sh
diff --git a/scripts/with-db-tunnel.sh b/scripts/with-db-tunnel.sh
new file mode 100644
index 0000000..d11d5e6
--- /dev/null
+++ b/scripts/with-db-tunnel.sh
@@ -0,0 +1,90 @@
+#!/usr/bin/env bash
+
+set -euo pipefail
+
+ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
+cd "$ROOT_DIR"
+
+if [ -f .env.local ]; then
+  set -a
+  . ./.env.local
+  set +a
+fi
+
+PG_TUNNEL_HOST="${PG_TUNNEL_HOST:-localhost}"
+PG_TUNNEL_PORT="${PG_TUNNEL_PORT:-7432}"
+PG_REMOTE_PORT="${PG_REMOTE_PORT:-5432}"
+PG_TUNNEL_NAMESPACE="${PG_TUNNEL_NAMESPACE:-default}"
+PG_TUNNEL_SERVICE="${PG_TUNNEL_SERVICE:-svc/prod-idauto-cloudsql-proxy}"
+PG_TUNNEL_LOG="${PG_TUNNEL_LOG:-/tmp/idauto-crm-pg-tunnel.log}"
+
+PG_PID=""
+STARTED_TUNNEL=0
+
+is_port_open() {
+  nc -z "$PG_TUNNEL_HOST" "$PG_TUNNEL_PORT" >/dev/null 2>&1
+}
+
+wait_for_tunnel() {
+  local attempts=20
+
+  for _ in $(seq 1 "$attempts"); do
+    if [ -n "$PG_PID" ] && ! kill -0 "$PG_PID" 2>/dev/null; then
+      echo "❌ PostgreSQL tunnel failed to stay up."
+      echo "   Revisa $PG_TUNNEL_LOG para mas detalle."
+      cat "$PG_TUNNEL_LOG" || true
+      exit 1
+    fi
+
+    if is_port_open; then
+      return 0
+    fi
+
+    sleep 1
+  done
+
+  echo "❌ PostgreSQL tunnel was not ready on ${PG_TUNNEL_HOST}:${PG_TUNNEL_PORT}."
+  echo "   Revisa $PG_TUNNEL_LOG para mas detalle."
+  cat "$PG_TUNNEL_LOG" || true
+  exit 1
+}
+
+cleanup() {
+  if [ "$STARTED_TUNNEL" -eq 1 ] && [ -n "$PG_PID" ]; then
+    echo ""
+    echo "🛑 Closing PostgreSQL tunnel..."
+    kill "$PG_PID" 2>/dev/null || true
+    wait "$PG_PID" 2>/dev/null || true
+    echo "✅ Tunnel closed"
+  fi
+}
+
+trap cleanup EXIT INT TERM
+
+if is_port_open; then
+  echo "🔌 Reusing existing PostgreSQL tunnel on ${PG_TUNNEL_HOST}:${PG_TUNNEL_PORT}"
+else
+  echo "🚀 Starting PostgreSQL tunnel (${PG_TUNNEL_PORT} -> ${PG_REMOTE_PORT})..."
+  kubectl port-forward \
+    -n "$PG_TUNNEL_NAMESPACE" \
+    "$PG_TUNNEL_SERVICE" \
+    "${PG_TUNNEL_PORT}:${PG_REMOTE_PORT}" >"$PG_TUNNEL_LOG" 2>&1 &
+  PG_PID=$!
+  STARTED_TUNNEL=1
+  echo "   Tunnel PID: $PG_PID"
+  wait_for_tunnel
+fi
+
+echo "✅ PostgreSQL available at ${PG_TUNNEL_HOST}:${PG_TUNNEL_PORT}"
+echo "   Database: ${DATABASE_URL:-DATABASE_URL not set}"
+echo ""
+
+if [ "$#" -eq 0 ]; then
+  echo "Tunnel ready. Press Ctrl+C to close it."
+  while true; do
+    sleep 3600
+  done
+fi
+
+echo "▶️  Running: $*"
+"$@"

```

### Commit 3: 8d2c02c
**Message:** fix: poll transaction detail and notify when ready

**Diff:**
```diff
--- apps/web/app/transactions/[id]/page.tsx
diff --git a/apps/web/app/transactions/[id]/page.tsx b/apps/web/app/transactions/[id]/page.tsx
index 5765034..e1305d9 100644
--- a/apps/web/app/transactions/[id]/page.tsx
+++ b/apps/web/app/transactions/[id]/page.tsx
@@ -1,9 +1,7 @@
-import Link from "next/link";
-import { DeliveryPanel } from "./delivery-panel";
+import { TransactionDetailLive } from "./transaction-detail-live";
 import {
   getTransactionDetail,
   getTransactionWorkflowEvents,
-  type TransactionDetailResponse,
   type TransactionStatus,
   type WorkflowEventItem,
 } from "../../../lib/crm-client";
@@ -24,16 +22,6 @@ const statusClasses: Record<TransactionStatus, string> = {
   VIEWED: "bg-violet-100 text-violet-800",
 };
 
-const documentTypeLabels: Record<string, string> = {
-  FACTURA: "Factura",
-  NOTA_VENTA: "Nota de venta",
-  SOAP: "SOAP",
-  PERMISO_CIRCULACION: "Permiso de circulacion",
-  REVISION_TECNICA: "Revision tecnica",
-  PADRON: "Padron",
-  OTHER: "Otro documento",
-};
-
 const eventTypeLabels: Record<string, string> = {
   "transaction.submitted": "Documentos enviados al broker",
   "transaction.processing": "Workflow documental en proceso",
@@ -144,120 +132,6 @@ function WorkflowPanel({
   );
 }
 
-function TransactionDetailView({
-  detail,
-}: {
-  detail: TransactionDetailResponse;
-}) {
-  return (
-    <>
-      <section className="rounded-3xl bg-primary-950 px-6 py-7 text-white shadow-sm">
-        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
-          <div>
-            <Link
-              href="/transactions"
-              className="text-sm font-medium text-primary-200 hover:text-white"
-            >
-              Volver a transacciones
-            </Link>
-            <h1 className="mt-3 text-3xl font-bold">{detail.saleId}</h1>
-            <p className="mt-2 text-sm text-primary-100">
-              {detail.automotoraName ?? "Automotora sin nombre"} · ultima
-              actualizacion {formatDate(detail.updatedAt)}
-            </p>
-          </div>
-          <span
-            className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusClasses[detail.status]}`}
-          >
-            {statusLabels[detail.status]}
-          </span>
-        </div>
-      </section>
-
-      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
-        <SummaryCard title="Cliente">
-          <div className="space-y-2 text-sm text-gray-700">
-            <p className="text-lg font-semibold text-gray-900">
-              {detail.client.name}
-            </p>
-            <p>{detail.client.email ?? "Sin email registrado"}</p>
-            <p>{detail.client.phone ?? "Sin telefono registrado"}</p>
-          </div>
-        </SummaryCard>
-
-        <SummaryCard title="Vehiculo">
-          <div className="space-y-2 text-sm text-gray-700">
-            <p className="text-lg font-semibold text-gray-900">
-              {detail.vehicle.plate}
-            </p>
-            <p>
-              {detail.vehicle.make} {detail.vehicle.model}
-            </p>
-            <p>{detail.vehicle.year ?? "Ano sin registrar"}</p>
-          </div>
-        </SummaryCard>
-      </div>
-
-      <DeliveryPanel
-        transactionId={detail.id}
-        status={detail.status}
-        clientName={detail.client.name}
-        defaultEmail={detail.client.email}
-        defaultPhone={detail.client.phone}
-      />
-
-      <SummaryCard title="Documentos">
-        <div className="space-y-3">
-          {detail.documents.length === 0 ? (
-            <p className="text-sm text-gray-500">
-              No hay documentos registrados para esta transaccion.
-            </p>
-          ) : (
-            detail.documents.map((document) => (
-              <div
-                key={document.id}
-                className="flex flex-col gap-2 rounded-2xl border border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
-              >
-                <div>
-                  <p className="font-medium text-gray-900">
-                    {documentTypeLabels[document.type] ?? document.type}
-                  </p>
-                  <p className="mt-1 text-xs text-gray-500">
-                    {document.completedAt
-                      ? `Completado ${formatDate(document.completedAt)}`
-                      : "Pendiente de generacion"}
-                  </p>
-                </div>
-                <div className="flex items-center gap-3">
-                  <span
-                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
-                      document.status === "COMPLETED"
-                        ? "bg-emerald-100 text-emerald-800"
-                        : "bg-slate-100 text-slate-700"
-                    }`}
-                  >
-                    {document.status === "COMPLETED" ? "Completado" : "Pendiente"}
-                  </span>
-                  {document.fileUrl ? (
-                    <a
-                      href={document.fileUrl}
-                      target="_blank"
-                      rel="noreferrer"
-                      className="text-sm font-medium text-primary-600 hover:underline"
-                    >
-                      Ver archivo
-                    </a>
-                  ) : null}
-                </div>
-              </div>
-            ))
-          )}
-        </div>
-      </SummaryCard>
-    </>
-  );
-}
-

--- apps/web/app/transactions/[id]/transaction-detail-live.tsx
diff --git a/apps/web/app/transactions/[id]/transaction-detail-live.tsx b/apps/web/app/transactions/[id]/transaction-detail-live.tsx
new file mode 100644
index 0000000..d30563c
--- /dev/null
+++ b/apps/web/app/transactions/[id]/transaction-detail-live.tsx
@@ -0,0 +1,302 @@
+"use client";
+
+import Link from "next/link";
+import { Toast } from "flowbite-react";
+import { useEffect, useRef, useState } from "react";
+import { DeliveryPanel } from "./delivery-panel";
+
+type TransactionStatus =
+  | "SUBMITTED"
+  | "PROCESSING"
+  | "READY"
+  | "DELIVERED"
+  | "VIEWED";
+
+interface TransactionDocumentItem {
+  id: string;
+  type: string;
+  status: "PENDING" | "COMPLETED";
+  fileUrl: string | null;
+  completedAt: string | null;
+  createdAt: string;
+  updatedAt: string;
+}
+
+interface TransactionDetailResponse {
+  id: string;
+  saleId: string;
+  status: TransactionStatus;
+  createdAt: string;
+  updatedAt: string;
+  automotoraName: string | null;
+  client: {
+    name: string;
+    email: string | null;
+    phone: string | null;
+  };
+  vehicle: {
+    plate: string;
+    make: string;
+    model: string;
+    year: number | null;
+  };
+  documents: TransactionDocumentItem[];
+}
+
+const statusLabels: Record<TransactionStatus, string> = {
+  SUBMITTED: "Enviado a procesar",
+  PROCESSING: "En proceso",
+  READY: "Listo para entregar",
+  DELIVERED: "Entregado",
+  VIEWED: "Cliente ha visto",
+};
+
+const statusClasses: Record<TransactionStatus, string> = {
+  SUBMITTED: "bg-slate-100 text-slate-700",
+  PROCESSING: "bg-amber-100 text-amber-800",
+  READY: "bg-emerald-100 text-emerald-800",
+  DELIVERED: "bg-sky-100 text-sky-800",
+  VIEWED: "bg-violet-100 text-violet-800",
+};
+
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
+function formatDate(value: string) {
+  return new Intl.DateTimeFormat("es-CL", {
+    dateStyle: "medium",
+    timeStyle: "short",
+  }).format(new Date(value));
+}
+
+function SummaryCard({
+  title,
+  children,
+}: {
+  title: string;
+  children: React.ReactNode;
+}) {
+  return (
+    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
+      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
+        {title}
+      </h2>
+      <div className="mt-4">{children}</div>
+    </section>
+  );
+}
+
+async function fetchTransactionDetail(
+  transactionId: string,
+  baseUrl: string,
+): Promise<TransactionDetailResponse | null> {
+  try {
+    const response = await fetch(
+      `${baseUrl}/api/crm/transactions/${encodeURIComponent(transactionId)}`,
+      {
+        method: "GET",
+        credentials: "include",
+        cache: "no-store",
+      },
+    );
+
+    if (!response.ok) {
+      return null;
+    }
+
+    return (await response.json()) as TransactionDetailResponse;
+  } catch {
+    return null;
+  }
+}
+
+export function TransactionDetailLive({
+  initialDetail,
+}: {
+  initialDetail: TransactionDetailResponse;
+}) {
+  const [detail, setDetail] = useState(initialDetail);
+  const [showReadyToast, setShowReadyToast] = useState(false);
+  const bffUrl = process.env.NEXT_PUBLIC_BFF_URL;
+  const latestStatusRef = useRef(initialDetail.status);
+
+  useEffect(() => {
+    latestStatusRef.current = detail.status;
+  }, [detail.status]);
+
+  useEffect(() => {
+    if (!showReadyToast) {
+      return;
+    }
+
+    const timeoutId = window.setTimeout(() => {
+      setShowReadyToast(false);
+    }, 7000);
+
+    return () => {
+      window.clearTimeout(timeoutId);
```

## Claims a labelar

Opciones: `grounded` | `plausible_unsupported` | `contradicted` | `irrelevant` | `frame`

| # | Claim | Pre-label (LLM) | Tu label | Notas |
|---|-------|-----------------|----------|-------|
| 0 | Six days, three commits, one CRM going from zero to alive. | needs_human | | |
| 1 | Commit one lays the full foundation: Prisma schema with enums, transaction listing and detail views, delivery workflow, client lookup, demo data, API routes, and a web UI with status tracking. | needs_human | | |
| 2 | That's not scaffolding — that's a working system on day one. | needs_human | | |
| 3 | But "working" had a problem. | needs_human | | |
| 4 | The transaction detail page was static. | needs_human | | |
| 5 | You'd load it, see whatever status existed at render time, and stare at it while the world moved on without you. | needs_human | | |
| 6 | Fine for a prototype. | needs_human | | |
| 7 | Not fine for a delivery workflow where the whole point is watching something become ready. | needs_human | | |
| 8 | Commit two fixes exactly that. | needs_human | | |
| 9 | The static TransactionDetailView gets replaced by TransactionDetailLive — a client component with polling, a latestStatusRef tracking state across renders, and a toast notification that fires when sta | needs_human | | |
| 10 | The page now watches the transaction so the user doesn't have to refresh and wonder. | needs_human | | |
| 11 | Commit three adds the relational layer that turns transaction tracking into actual sales management. | needs_human | | |
| 12 | TransactionNote and FollowUp entities land with their own schemas, routes, and demo data builders. | needs_human | | |
| 13 | Notes can be created against a transaction. | needs_human | | |
| 14 | Follow-ups have their own status enum. | needs_human | | |
| 15 | The demo data builder checks for "demo-tx-1" specifically — which means the seeding strategy is deliberate, not throwaway. | needs_human | | |
| 16 | The arc here is clean: model the domain, make the UI reactive to state changes, then add the relational context that makes records useful to humans over time. | needs_human | | |
| 17 | Notes and follow-ups aren't features bolted on — they're the difference between a transaction log and a CRM. | needs_human | | |

## Post-level

- **Publish readiness:** [ ] publish_asis [ ] light_edit [ ] rewrite [ ] discard
- **¿Qué te haría desconfiar del post?** _______
