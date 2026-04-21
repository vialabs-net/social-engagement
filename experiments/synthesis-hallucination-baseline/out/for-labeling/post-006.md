# Post 006 — Sonnet declinó anclar

Sonnet recibió este grupo y devolvió `<no_post/>`. No hay claims.

## Commits de origen

### Commit 1: 14df489
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

## Evaluación del rechazo

¿El rechazo fue correcto?
- [ ] sí, estos commits no eran un arco real — Sonnet acertó en declinar
- [ ] no, había material válido para síntesis — Sonnet fue demasiado conservador
- [ ] ambiguo — explicar abajo

Razón: _______
