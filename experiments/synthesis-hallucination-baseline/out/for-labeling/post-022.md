# Post 022

## Post generado

> Three commits, one afternoon, one system that went from "show me what happened" to "tell me when it's done and actually deliver it."
> 
> The day started with a static transaction detail view. Static means: load once, show what's there, done. That's fine until "what's there" isn't the final state yet. The refactor to TransactionDetailLive added polling, client-side state, and a toast notification that fires specifically when status hits READY. The UI now tracks the transaction, not just displays it.
> 
> From there: date range filters on the transaction list API. From and to query params, validation schema, service-layer date normalization, UI form controls. Phase 1 of filtering. The contract change is visible in the API surface — the list endpoint now accepts temporal scope, not just "give me everything."
> 
> Then phase 2: actual delivery. A new HTTP-based Id Auto notifier with four delivery statuses — PENDING_CLIENT_MATCH, PENDING_IDAUTO_DELIVERY, DELIVERED_TO_APP, DELIVERY_FAILED. Environment-configured endpoint, secret-based auth, and an explicit timeout bound (8000ms). The TODO in the env file is honest: the real backend contract isn't locked yet, but the integration shape is committed. Statuses, timeout, auth pattern — all wired before the other side is final.
> 
> One day of work built a feedback loop (poll + notify), a query scope (date filters), and an outbound delivery pipeline with failure tracking. The system went from passive display to active participant.
> 
> #lilicurl #codingWithHumor

## Commits de origen

### Commit 1: 8a82d15
**Message:** feat: add phase 1 transaction filters

**Diff:**
```diff
--- apps/bff/src/modules/transactions/transactions.routes.ts
diff --git a/apps/bff/src/modules/transactions/transactions.routes.ts b/apps/bff/src/modules/transactions/transactions.routes.ts
index 1cbb3e5..539ab94 100644
--- a/apps/bff/src/modules/transactions/transactions.routes.ts
+++ b/apps/bff/src/modules/transactions/transactions.routes.ts
@@ -38,6 +38,8 @@ import {
 
 interface TransactionsQuerystring {
   status?: string;
+  from?: string;
+  to?: string;
   page?: number;
   size?: number;
 }
@@ -108,6 +110,8 @@ export const transactionsRoutes: FastifyPluginAsync = async (app) => {
         page,
         size,
         status,
+        from: request.query.from,
+        to: request.query.to,
       });
     },
   );


--- apps/bff/src/modules/transactions/transactions.schemas.ts
diff --git a/apps/bff/src/modules/transactions/transactions.schemas.ts b/apps/bff/src/modules/transactions/transactions.schemas.ts
index a19f757..d106462 100644
--- a/apps/bff/src/modules/transactions/transactions.schemas.ts
+++ b/apps/bff/src/modules/transactions/transactions.schemas.ts
@@ -7,6 +7,14 @@ export const transactionListQuerySchema = {
       type: "string",
       enum: [...transactionStatuses],
     },
+    from: {
+      type: "string",
+      format: "date",
+    },
+    to: {
+      type: "string",
+      format: "date",
+    },
     page: {
       type: "integer",
       minimum: 1,


--- apps/bff/src/modules/transactions/transactions.service.ts
diff --git a/apps/bff/src/modules/transactions/transactions.service.ts b/apps/bff/src/modules/transactions/transactions.service.ts
index dc5ea27..16d3a26 100644
--- a/apps/bff/src/modules/transactions/transactions.service.ts
+++ b/apps/bff/src/modules/transactions/transactions.service.ts
@@ -75,6 +75,8 @@ interface ListTransactionsParams {
   page: number;
   size: number;
   status?: TransactionStatus;
+  from?: string;
+  to?: string;
 }
 
 interface TransactionRow {
@@ -203,14 +205,49 @@ function shouldFallbackToDemoData(error: unknown) {
   );
 }
 
-function filterDemoTransactions(status?: TransactionStatus) {
-  const items = getDemoTransactions();
+function normalizeDateFilter(value?: string) {
+  if (!value) {
+    return null;
+  }
 
-  if (!status) {
-    return items;
+  const parsed = new Date(`${value}T00:00:00.000Z`);
+  if (Number.isNaN(parsed.valueOf())) {
+    return null;
   }
 
-  return items.filter((item) => item.status === status);
+  return parsed;
+}
+
+function filterDemoTransactions(params: {
+  status?: TransactionStatus;
+  from?: string;
+  to?: string;
+}) {
+  const from = normalizeDateFilter(params.from);
+  const to = normalizeDateFilter(params.to);
+
+  return getDemoTransactions().filter((item) => {
+    if (params.status && item.status !== params.status) {
+      return false;
+    }
+
+    const createdAt = new Date(item.createdAt);
+
+    if (from && createdAt < from) {
+      return false;
+    }
+
+    if (to) {
+      const toInclusive = new Date(to);
+      toInclusive.setUTCDate(toInclusive.getUTCDate() + 1);
+
+      if (createdAt >= toInclusive) {
+        return false;
+      }
+    }
+
+    return true;
+  });
 }
 
 function toDocumentItem(row: TransactionDocumentRow): TransactionDocumentItem {
@@ -242,17 +279,31 @@ export async function listTransactions(
   const page = clampPage(params.page);
   const size = clampSize(params.size);
   const status = isTransactionStatus(params.status) ? params.status : undefined;
+  const from = normalizeDateFilter(params.from);
+  const to = normalizeDateFilter(params.to);
   const offset = (page - 1) * size;
 
   try {
     const whereClauses = ['t."salesmanId" = $1'];
-    const whereArgs: Array<string> = [params.salesmanId];
+    const whereArgs: unknown[] = [params.salesmanId];
 
     if (status) {
       whereClauses.push(`t."status" = $${whereArgs.length + 1}`);
       whereArgs.push(status);
     }
 
+    if (from) {
+      whereClauses.push(`t."createdAt" >= $${whereArgs.length + 1}::timestamp`);
+      whereArgs.push(from.toISOString());
+    }
+
+    if (to) {
+      const toExclusive = new Date(to);
+      toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
+      whereClauses.push(`t."createdAt" < $${whereArgs.length + 1}::timestamp`);
+      whereArgs.push(toExclusive.toISOString());
+    }
+
     const whereSql = `WHERE ${whereClauses.join(" AND ")}`;
     const paginationStart = whereArgs.length + 1;
     const listQuery = `
@@ -310,7 +361,11 @@ export async function listTransactions(
       throw error;
     }
 
-    const demoItems = filterDemoTransactions(status);
+    const demoItems = filterDemoTransactions({
+      status,
+      from: params.from,
+      to: params.to,
+    });
     return {
       items: demoItems.slice(offset, offset + size),
       total: demoItems.length,


--- apps/web/app/transactions/page.tsx
diff --git a/apps/web/app/transactions/page.tsx b/apps/web/app/transactions/page.tsx
index 9c021c0..e2d6e46 100644
--- a/apps/web/app/transactions/page.tsx
+++ b/apps/web/app/transactions/page.tsx
@@ -25,6 +25,20 @@ function formatDate(value: string) {
   }).format(new Date(value));
 }
 
+function readFirstQueryValue(
+  value: string | string[] | undefined,
+): string | undefined {
+  if (Array.isArray(value)) {
+    return value[0];
+  }
+
+  return value;
+}
+
+function isTransactionStatus(value?: string): value is TransactionStatus {
+  return Boolean(value && value in statusLabels);
+}
+
 function EmptyState({
   title,
   description,
@@ -40,8 +54,23 @@ function EmptyState({
   );
 }
 
-export default async function TransactionsPage() {
-  const result = await getTransactions();
+export default async function TransactionsPage({
+  searchParams,
+}: {
+  searchParams: Promise<Record<string, string | string[] | undefined>>;
+}) {
+  const resolvedSearchParams = await searchParams;
+  const statusParam = readFirstQueryValue(resolvedSearchParams.status);
+  const fromParam = readFirstQueryValue(resolvedSearchParams.from);
+  const toParam = readFirstQueryValue(resolvedSearchParams.to);
+
+  const filters = {
+    status: isTransactionStatus(statusParam) ? statusParam : undefined,
+    from: fromParam || undefined,
+    to: toParam || undefined,
+  };
+
+  const result = await getTransactions(filters);
 
   if (result.kind === "missing-config") {
     return (
@@ -96,6 +125,7 @@ export default async function TransactionsPage() {
   }
 
   const { items, total, source } = result.data;
+  const hasActiveFilters = Boolean(filters.status || filters.from || filters.to);
 
   return (
     <div className="min-h-screen bg-gray-50 px-4 py-10">
@@ -140,10 +170,86 @@ export default async function TransactionsPage() {
           </div>
         </section>
 
+        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
+          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
+            <div>
+              <h2 className="text-lg font-semibold text-gray-900">
+                Filtros de transacciones
+              </h2>
+              <p className="mt-1 text-sm text-gray-500">
+                Filtra por estado o rango de fechas para revisar tu cola de trabajo.
+              </p>
+            </div>
+            {hasActiveFilters ? (
+              <Link
+                href="/transactions"
+                className="text-sm font-medium text-primary-600 hover:underline"
+              >
+                Limpiar filtros
+              </Link>
+            ) : null}
+          </div>
+
+          <form className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
+            <label className="text-sm text-gray-600">
+              Estado
+              <select
+                name="status"
+                defaultValue={filters.status ?? ""}
+                className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
+              >
+                <option value="">Todos los estados</option>
+                {Object.entries(statusLabels).map(([status, label]) => (
+                  <option key={status} value={status}>
+                    {label}
+                  </option>
+                ))}
+              </select>
+            </label>
+
+            <label className="text-sm text-gray-600">
+              Desde
+              <input
+                type="date"
+                name="from"
+                defaultValue={filters.from ?? ""}
+                className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
+              />
+            </label>
+
+            <label className="text-sm text-gray-600">
+              Hasta
+              <input
+                type="date"
+                name="to"
+                defaultValue={filters.to ?? ""}
+                className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
+              />
+            </label>
+
+            <div className="flex items-end">
+              <button
+                type="submit"
+                className="inline-flex w-full items-center justify-center rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
+              >
+                Aplicar filtros
+              </button>
+            </div>
+          </form>
+        </section>
+
         {items.length === 0 ? (
           <EmptyState
-            title="Aun no hay transacciones"
-            description="Cuando lleguen ventas del broker o cargues datos de prueba, apareceran aqui."
+            title={
+              hasActiveFilters
+                ? "No hay resultados para esos filtros"
+                : "Aun no hay transacciones"
+            }
+            description={
+              hasActiveFilters
+                ? "Prueba otro estado o un rango de fechas mas amplio."
+                : "Cuando lleguen ventas del broker o cargues datos de prueba, apareceran aqui."
+            }
           />
         ) : (
           <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">


--- apps/web/lib/crm-client.ts
diff --git a/apps/web/lib/crm-client.ts b/apps/web/lib/crm-client.ts
index 831d87e..39b764f 100644
--- a/apps/web/lib/crm-client.ts
+++ b/apps/web/lib/crm-client.ts
@@ -83,6 +83,14 @@ export interface WorkflowEventsResponse {
   items: WorkflowEventItem[];
 }
 
+interface TransactionsFilters {
+  status?: TransactionStatus;
+  from?: string;
+  to?: string;
+  page?: number;
+  size?: number;
+}
+
 export type ApiResult<T> =
   | {
       kind: "success";
@@ -153,8 +161,35 @@ async function fetchFromBff<T>(path: string): Promise<ApiResult<T>> {
   }
 }
 
-export async function getTransactions(): Promise<ApiResult<TransactionsResponse>> {
-  return fetchFromBff<TransactionsResponse>("/api/crm/transactions");
+export async function getTransactions(
+  filters: TransactionsFilters = {},
+): Promise<ApiResult<TransactionsResponse>> {
+  const params = new URLSearchParams();
+
+  if (filters.status) {
+    params.set("status", filters.status);
+  }
+
+  if (filters.from) {
+    params.set("from", filters.from);
+  }
+
+  if (filters.to) {
+    params.set("to", filters.to);
+  }
+
+  if (filters.page) {
+    params.set("page", String(filters.page));
+  }
+
+  if (filters.size) {
+    params.set("size", String(filters.size));
+  }
+
+  const query = params.toString();
+  return fetchFromBff<TransactionsResponse>(
+    query ? `/api/crm/transactions?${query}` : "/api/crm/transactions",
+  );
 }
 
 export async function getTransactionDetail(

```

### Commit 2: 8d2c02c
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

### Commit 3: fd381e7
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
| 0 | Three commits, one afternoon, one system that went from "show me what happened" to "tell me when it's done and actually deliver it." | needs_human | | |
| 1 | The day started with a static transaction detail view. | needs_human | | |
| 2 | Static means: load once, show what's there, done. | needs_human | | |
| 3 | That's fine until "what's there" isn't the final state yet. | needs_human | | |
| 4 | The refactor to TransactionDetailLive added polling, client-side state, and a toast notification that fires specifically when status hits READY. | needs_human | | |
| 5 | The UI now tracks the transaction, not just displays it. | needs_human | | |
| 6 | From there: date range filters on the transaction list API. | needs_human | | |
| 7 | From and to query params, validation schema, service-layer date normalization, UI form controls. | needs_human | | |
| 8 | Phase 1 of filtering. | needs_human | | |
| 9 | The contract change is visible in the API surface — the list endpoint now accepts temporal scope, not just "give me everything." | needs_human | | |
| 10 | Then phase 2: actual delivery. | needs_human | | |
| 11 | A new HTTP-based Id Auto notifier with four delivery statuses — PENDING_CLIENT_MATCH, PENDING_IDAUTO_DELIVERY, DELIVERED_TO_APP, DELIVERY_FAILED. | needs_human | | |
| 12 | Environment-configured endpoint, secret-based auth, and an explicit timeout bound (8000ms). | needs_human | | |
| 13 | The TODO in the env file is honest: the real backend contract isn't locked yet, but the integration shape is committed. | needs_human | | |
| 14 | Statuses, timeout, auth pattern — all wired before the other side is final. | needs_human | | |
| 15 | One day of work built a feedback loop (poll + notify), a query scope (date filters), and an outbound delivery pipeline with failure tracking. | needs_human | | |
| 16 | The system went from passive display to active participant. | needs_human | | |

## Post-level

- **Publish readiness:** [ ] publish_asis [ ] light_edit [ ] rewrite [ ] discard
- **¿Qué te haría desconfiar del post?** _______
