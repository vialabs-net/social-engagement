# Post 010

## Post generado

> Five days. Six commits. One system that went from scraping text to handling LinkedIn tokens with KMS encryption, triggering live corpus fetches, and generating posts that don't accidentally cite articles the author never read.
> 
> Let me trace the arc.
> 
> It started with extraction hardening — Puppeteer fallback policies for hosts that block standard HTTP (Discord, Stripe), protected source lifecycles, and embedded match strength tracking baked into the corpus itself. The data layer got opinions.
> 
> Then the security layer got rebuilt. Tenant tokens — LinkedIn OAuth, buffer credentials — moved from plaintext Supabase rows to envelope encryption backed by GCP KMS. New tokens encrypt before write. Workers decrypt at runtime. A rotation script re-encrypts the legacy rows that already exist. That's not a future plan. That's a migration with a backfill.
> 
> CI caught up next. Hardcoded values moved to env vars, typecheck added to the deploy pipeline, secrets and env bindings wired into Cloud Run deploys properly.
> 
> Then matching got three thresholds (0.45, 0.3, 0) and a richer query layer built from technical detail, retrieval text, and retrieval terms — plus an audit mode to surface gaps before they become invisible signal loss.
> 
> The content corpus finally went live: a post-discovery fetch job now runs automatically after source discovery, with priority-sorted promotion and batch ID hashing for classifier stability.
> 
> And then the hardest part — prompt constraints. A structured `buildIndustryContextBlock()` function replaced raw connection injection. It enforces convergence language, explicitly bans citation and derivation patterns, and can surface inferred source-family labels from URLs.
> 
> The goal: articles inform tone without implying the author read them. That's a product contract, not just a prompt tweak.
> 
> #lilicurl #codingWithHumor

## Commits de origen

### Commit 1: 1591f42
**Message:** feat: add kms-backed tenant token encryption

**Diff:**
```diff
--- docs/adr/ADR-002-envelope-encryption-kms.md
diff --git a/docs/adr/ADR-002-envelope-encryption-kms.md b/docs/adr/ADR-002-envelope-encryption-kms.md
index 00ebec2..8e21e22 100644
--- a/docs/adr/ADR-002-envelope-encryption-kms.md
+++ b/docs/adr/ADR-002-envelope-encryption-kms.md
@@ -2,7 +2,7 @@
 
 | Field | Value |
 |-------|-------|
-| Status | Accepted |
+| Status | Accepted, implemented on `feat/content-intelligence` |
 | Date | 2026-04-08 |
 | Deciders | Liliana Castellanos |
 
@@ -42,7 +42,49 @@ Two options were considered:
 in the DB contract. Only the storage adapter and a decryption step in `processJob` change.
 `TenantRow` interface in `process-job.ts` is unchanged.
 
-**Not yet implemented.** Required before paid tier launch.
+**Implementation status:** The envelope encryption flow now exists in the app code:
+- new tokens are encrypted before being written from onboarding / OAuth callbacks
+- worker and scanner decrypt tokens at runtime using GCP KMS
+- a rotation script exists to re-encrypt legacy plaintext rows already stored in Supabase
+
+Rollout is still required before paid tier launch.
+
+## Why Rotation Is Required
+
+Rotation is needed because existing tenants were created before envelope encryption was added.
+Those rows already contain plaintext tokens in:
+
+- `tenants.buffer_access_token`
+- `tenants.linkedin_access_token`
+
+After the new code is deployed:
+- new or reconnected tenants will be stored encrypted automatically
+- old tenants would continue working temporarily only because the runtime keeps a legacy
+  fallback for plaintext rows during rollout
+
+That fallback is deliberate and temporary. Rotation is what removes the remaining plaintext
+secrets from the database without forcing every tenant to reconnect manually.
+
+So the purpose of rotation is:
+- eliminate pre-existing plaintext tokens from Supabase
+- make the database consistent: all tenants have `encrypted_dek` + ciphertext tokens
+- let us remove the legacy plaintext fallback later with confidence
+- satisfy the "required before launch" security requirement in the master spec
+
+## Rollout Shape
+
+Safe rollout order:
+
+1. Apply the DB migration that adds `tenants.encrypted_dek`
+2. Create the KMS key and grant runtime IAM permissions
+3. Deploy the new code with `GCP_KMS_KEY_NAME`
+4. Run the rotation script against existing tenants
+5. Smoke-test publish + scanner with a real tenant
+
+This order avoids downtime:
+- pre-rotation tenants still work because the runtime tolerates plaintext rows
+- post-deploy writes are encrypted immediately
+- rotation backfills the rest in place
 
 ## Consequences
 
@@ -62,3 +104,12 @@ in the DB contract. Only the storage adapter and a decryption step in `processJo
   a key deletion policy (30-day scheduled deletion minimum in GCP KMS).
 - `encrypted_dek` is a new column in `tenants` — requires a migration that also
   re-encrypts any existing plaintext tokens during rollout.
+
+## Operational Notes
+
+- The runtime expects `GCP_KMS_KEY_NAME` (or legacy alias `KMS_KEY_NAME`) to contain the full
+  crypto key resource name, for example:
+  `projects/<project>/locations/<location>/keyRings/<keyring>/cryptoKeys/<key>`
+- The local rotation script uses the same env var and Google Application Default Credentials.
+- Rotation should be run first with `--dry-run`, then without it once the candidate set looks
+  correct.


--- docs/phase2-launch-runbook.md
diff --git a/docs/phase2-launch-runbook.md b/docs/phase2-launch-runbook.md
new file mode 100644
index 0000000..99479fb
--- /dev/null
+++ b/docs/phase2-launch-runbook.md
@@ -0,0 +1,254 @@
+# Phase 2 Launch Runbook
+
+Step-by-step commands to close Phase 2 and deploy `feat/content-intelligence` safely.
+
+This runbook assumes:
+- GCP project: `lilicurl`
+- Cloud Run region: `us-central1`
+- Supabase migration for Phase 2 is already applied
+- seed corpus is already loaded
+
+## 1. Prepare local variables
+
+```bash
+cd /Users/Lilicurl/Documents/git/social-engagement
+
+export PROJECT_ID="lilicurl"
+export REGION="us-central1"
+export KMS_LOCATION="global"
+export KMS_KEYRING="devcast"
+export KMS_KEY="tenant-secrets"
+export GCP_KMS_KEY_NAME="projects/${PROJECT_ID}/locations/${KMS_LOCATION}/keyRings/${KMS_KEYRING}/cryptoKeys/${KMS_KEY}"
+```
+
+If you already use a different KMS location or key name, replace the variables above.
+
+## 2. Create the KMS key (skip if it already exists)
+
+```bash
+gcloud kms keyrings create "${KMS_KEYRING}" \
+  --location="${KMS_LOCATION}" \
+  --project="${PROJECT_ID}"
+
+gcloud kms keys create "${KMS_KEY}" \
+  --location="${KMS_LOCATION}" \
+  --keyring="${KMS_KEYRING}" \
+  --purpose="encryption" \
+  --project="${PROJECT_ID}"
+```
+
+Verify:
+
+```bash
+gcloud kms keys describe "${KMS_KEY}" \
+  --location="${KMS_LOCATION}" \
+  --keyring="${KMS_KEYRING}" \
+  --project="${PROJECT_ID}"
+```
+
+## 3. Discover which service accounts are running the app
+
+```bash
+export WEBHOOK_SA="$(gcloud run services describe getdevcast-webhook \
+  --region="${REGION}" \
+  --project="${PROJECT_ID}" \
+  --format='value(spec.template.spec.serviceAccountName)')"
+
+export WORKER_SA="$(gcloud run jobs describe devcast-worker \
+  --region="${REGION}" \
+  --project="${PROJECT_ID}" \
+  --format='value(spec.template.template.spec.serviceAccountName)')"
+
+export SCANNER_SA="$(gcloud run jobs describe devcast-scanner \
+  --region="${REGION}" \
+  --project="${PROJECT_ID}" \
+  --format='value(spec.template.template.spec.serviceAccountName)')"
+
+printf 'webhook=%s\nworker=%s\nscanner=%s\n' "$WEBHOOK_SA" "$WORKER_SA" "$SCANNER_SA"
+```
+
+If `WORKER_SA` or `SCANNER_SA` prints empty / `null`, the job is not using an explicit
+service account and will typically inherit the project's default Compute Engine service
+account. In that case, granting KMS access to the same default service account used by
+the webhook is sufficient.
+
+## 4. Grant KMS permissions
+
+Grant runtime access to each Cloud Run service account:
+
+```bash
+for SA in "$WEBHOOK_SA" "$WORKER_SA" "$SCANNER_SA"; do
+  gcloud kms keys add-iam-policy-binding "${KMS_KEY}" \
+    --location="${KMS_LOCATION}" \
+    --keyring="${KMS_KEYRING}" \
+    --project="${PROJECT_ID}" \
+    --member="serviceAccount:${SA}" \
+    --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"
+done
+```
+
+If the worker/scanner variables are empty, run the binding only for the non-empty service
+account instead of looping over blank values.
+
+Grant the same role to the identity that will run the local rotation script.
+If you run it with your own user credentials:
+
+```bash
+gcloud kms keys add-iam-policy-binding "${KMS_KEY}" \
+  --location="${KMS_LOCATION}" \
+  --keyring="${KMS_KEYRING}" \
+  --project="${PROJECT_ID}" \
+  --member="user:<your-google-email>" \
+  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"
+```
+
+## 5. Authenticate local ADC for the rotation script
+
+```bash
+gcloud auth application-default login
+```
+
+If you use a service account key locally instead, export `GOOGLE_APPLICATION_CREDENTIALS`.
+
+## 6. Set the KMS env var on Cloud Run
+
+Webhook service:
+
+```bash
+gcloud run services update getdevcast-webhook \
+  --region="${REGION}" \
+  --project="${PROJECT_ID}" \
+  --update-env-vars="GCP_KMS_KEY_NAME=${GCP_KMS_KEY_NAME}"
+```
+
+Worker job:
+
+```bash
+gcloud run jobs update devcast-worker \
+  --region="${REGION}" \
+  --project="${PROJECT_ID}" \
+  --update-env-vars="GCP_KMS_KEY_NAME=${GCP_KMS_KEY_NAME}"
+```
+
+Scanner job:
+
+```bash
+gcloud run jobs update devcast-scanner \
+  --region="${REGION}" \
+  --project="${PROJECT_ID}" \
+  --update-env-vars="GCP_KMS_KEY_NAME=${GCP_KMS_KEY_NAME}"
+```
+
+## 7. Verify launch-critical env vars
+
+Worker:

--- package-lock.json
diff --git a/package-lock.json b/package-lock.json
index 4d648e9..5264309 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -11,6 +11,7 @@
         "@anthropic-ai/sdk": "^0.36.3",
         "@extractus/article-extractor": "^8.0.20",
         "@extractus/feed-extractor": "^7.1.7",
+        "@google-cloud/kms": "^5.4.0",
         "@octokit/rest": "^21.0.2",
         "@supabase/supabase-js": "^2.47.10",
         "better-sqlite3": "^11.7.0",
@@ -562,6 +563,145 @@
         "node": ">= 20"
       }
     },
+    "node_modules/@google-cloud/kms": {
+      "version": "5.4.0",
+      "resolved": "https://registry.npmjs.org/@google-cloud/kms/-/kms-5.4.0.tgz",
+      "integrity": "sha512-+06zUCaJM+wyZISM3F6u/jSqoBs0iZ8Aj9rqOJFePoWkNN7FbR4mQpV7okGHA+Y7caVgq+4QtIDKiFd17SZT+A==",
+      "license": "Apache-2.0",
+      "dependencies": {
+        "google-gax": "^5.0.0"
+      },
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@grpc/grpc-js": {
+      "version": "1.14.3",
+      "resolved": "https://registry.npmjs.org/@grpc/grpc-js/-/grpc-js-1.14.3.tgz",
+      "integrity": "sha512-Iq8QQQ/7X3Sac15oB6p0FmUg/klxQvXLeileoqrTRGJYLV+/9tubbr9ipz0GKHjmXVsgFPo/+W+2cA8eNcR+XA==",
+      "license": "Apache-2.0",
+      "dependencies": {
+        "@grpc/proto-loader": "^0.8.0",
+        "@js-sdsl/ordered-map": "^4.4.2"
+      },
+      "engines": {
+        "node": ">=12.10.0"
+      }
+    },
+    "node_modules/@grpc/proto-loader": {
+      "version": "0.8.0",
+      "resolved": "https://registry.npmjs.org/@grpc/proto-loader/-/proto-loader-0.8.0.tgz",
+      "integrity": "sha512-rc1hOQtjIWGxcxpb9aHAfLpIctjEnsDehj0DAiVfBlmT84uvR0uUtN2hEi/ecvWVjXUGf5qPF4qEgiLOx1YIMQ==",
+      "license": "Apache-2.0",
+      "dependencies": {
+        "lodash.camelcase": "^4.3.0",
+        "long": "^5.0.0",
+        "protobufjs": "^7.5.3",
+        "yargs": "^17.7.2"
+      },
+      "bin": {
+        "proto-loader-gen-types": "build/bin/proto-loader-gen-types.js"
+      },
+      "engines": {
+        "node": ">=6"
+      }
+    },
+    "node_modules/@isaacs/cliui": {
+      "version": "8.0.2",
+      "resolved": "https://registry.npmjs.org/@isaacs/cliui/-/cliui-8.0.2.tgz",
+      "integrity": "sha512-O8jcjabXaleOG9DQ0+ARXWZBTfnP4WNAqzuiJK7ll44AmxGKv/J2M4TPjxjY3znBCfvBXFzucm1twdyFybFqEA==",
+      "license": "ISC",
+      "dependencies": {
+        "string-width": "^5.1.2",
+        "string-width-cjs": "npm:string-width@^4.2.0",
+        "strip-ansi": "^7.0.1",
+        "strip-ansi-cjs": "npm:strip-ansi@^6.0.1",
+        "wrap-ansi": "^8.1.0",
+        "wrap-ansi-cjs": "npm:wrap-ansi@^7.0.0"
+      },
+      "engines": {
+        "node": ">=12"
+      }
+    },
+    "node_modules/@isaacs/cliui/node_modules/ansi-regex": {
+      "version": "6.2.2",
+      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-6.2.2.tgz",
+      "integrity": "sha512-Bq3SmSpyFHaWjPk8If9yc6svM8c56dB5BAtW4Qbw5jHTwwXXcTLoRMkpDJp6VL0XzlWaCHTXrkFURMYmD0sLqg==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=12"
+      },
+      "funding": {
+        "url": "https://github.com/chalk/ansi-regex?sponsor=1"
+      }
+    },
+    "node_modules/@isaacs/cliui/node_modules/ansi-styles": {
+      "version": "6.2.3",
+      "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-6.2.3.tgz",
+      "integrity": "sha512-4Dj6M28JB+oAH8kFkTLUo+a2jwOFkuqb3yucU0CANcRRUbxS0cP0nZYCGjcc3BNXwRIsUVmDGgzawme7zvJHvg==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=12"
+      },
+      "funding": {
+        "url": "https://github.com/chalk/ansi-styles?sponsor=1"
+      }
+    },
+    "node_modules/@isaacs/cliui/node_modules/emoji-regex": {
+      "version": "9.2.2",
+      "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-9.2.2.tgz",
+      "integrity": "sha512-L18DaJsXSUk2+42pv8mLs5jJT2hqFkFE4j21wOmgbUqsZ2hL72NsUU785g9RXgo3s0ZNgVl42TiHp3ZtOv/Vyg==",
+      "license": "MIT"
+    },
+    "node_modules/@isaacs/cliui/node_modules/string-width": {
+      "version": "5.1.2",
+      "resolved": "https://registry.npmjs.org/string-width/-/string-width-5.1.2.tgz",
+      "integrity": "sha512-HnLOCR3vjcY8beoNLtcjZ5/nxn2afmME6lhrDrebokqMap+XbeW8n9TXpPDOqdGK5qcI3oT0GKTW6wC7EMiVqA==",
+      "license": "MIT",
+      "dependencies": {
+        "eastasianwidth": "^0.2.0",
+        "emoji-regex": "^9.2.2",
+        "strip-ansi": "^7.0.1"
+      },
+      "engines": {
+        "node": ">=12"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/sindresorhus"
+      }
+    },
+    "node_modules/@isaacs/cliui/node_modules/strip-ansi": {
+      "version": "7.2.0",
+      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-7.2.0.tgz",
+      "integrity": "sha512-yDPMNjp4WyfYBkHnjIRLfca1i6KMyGCtsVgoKe/z1+6vukgaENdgGBZt+ZmKPc4gavvEZ5OgHfHdrazhgNyG7w==",
+      "license": "MIT",
+      "dependencies": {
+        "ansi-regex": "^6.2.2"
+      },
+      "engines": {
+        "node": ">=12"
+      },
+      "funding": {
+        "url": "https://github.com/chalk/strip-ansi?sponsor=1"
+      }
+    },
+    "node_modules/@isaacs/cliui/node_modules/wrap-ansi": {
+      "version": "8.1.0",
+      "resolved": "https://registry.npmjs.org/wrap-ansi/-/wrap-ansi-8.1.0.tgz",
+      "integrity": "sha512-si7QWI6zUMq56bESFvagtmzMdGOtoxfR+Sez11Mobfc7tm+VkUckk9bW2UeffTGVUbOksxmSw0AA2gs8g71NCQ==",
+      "license": "MIT",
+      "dependencies": {
+        "ansi-styles": "^6.1.0",
+        "string-width": "^5.0.1",
+        "strip-ansi": "^7.0.1"
+      },
+      "engines": {
+        "node": ">=12"

--- package.json
diff --git a/package.json b/package.json
index 6c0f04f..eb0cd31 100644
--- a/package.json
+++ b/package.json
@@ -17,6 +17,7 @@
     "seed-corpus:extract": "tsx --env-file=.env.local scripts/seed-corpus/extract-text.ts",
     "seed-corpus:validate": "tsx --env-file=.env.local scripts/seed-corpus/validate.ts",
     "seed-corpus:seed": "tsx --env-file=.env.local scripts/seed-corpus/seed.ts",
+    "rotate-tenant-tokens": "tsx --env-file=.env.local scripts/rotate-tenant-tokens.ts",
     "test": "vitest run",
     "typecheck": "tsc --noEmit"
   },
@@ -24,6 +25,7 @@
     "@anthropic-ai/sdk": "^0.36.3",
     "@extractus/article-extractor": "^8.0.20",
     "@extractus/feed-extractor": "^7.1.7",
+    "@google-cloud/kms": "^5.4.0",
     "@octokit/rest": "^21.0.2",
     "@supabase/supabase-js": "^2.47.10",
     "better-sqlite3": "^11.7.0",


--- scripts/rotate-tenant-tokens.ts
diff --git a/scripts/rotate-tenant-tokens.ts b/scripts/rotate-tenant-tokens.ts
new file mode 100644
index 0000000..e0334fa
--- /dev/null
+++ b/scripts/rotate-tenant-tokens.ts
@@ -0,0 +1,120 @@
+/**
+ * Re-encrypt legacy tenant tokens in Supabase using envelope encryption with GCP KMS.
+ *
+ * Usage:
+ *   tsx --env-file=.env.local scripts/rotate-tenant-tokens.ts
+ *   tsx --env-file=.env.local scripts/rotate-tenant-tokens.ts --dry-run
+ *   tsx --env-file=.env.local scripts/rotate-tenant-tokens.ts --tenant-id <uuid>
+ */
+
+import { createClient } from '@supabase/supabase-js';
+import {
+  isEncryptedToken,
+  sealTenantSecrets,
+} from '../src/security/tenant-secrets.js';
+
+interface TenantRow {
+  readonly id: string;
+  readonly github_username: string;
+  readonly buffer_access_token: string | null;
+  readonly linkedin_access_token: string | null;
+  readonly encrypted_dek: string | null;
+}
+
+function getArgValue(flag: string): string | null {
+  const index = process.argv.indexOf(flag);
+  if (index === -1) return null;
+  return process.argv[index + 1] ?? null;
+}
+
+function shouldRotateToken(token: string | null, encryptedDek: string | null): boolean {
+  if (!token) return false;
+  if (!encryptedDek) return true;
+  return !isEncryptedToken(token);
+}
+
+async function main(): Promise<void> {
+  const supabaseUrl = process.env['SUPABASE_URL'];
+  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
+
+  if (!supabaseUrl || !supabaseKey) {
+    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
+  }
+
+  const dryRun = process.argv.includes('--dry-run');
+  const tenantId = getArgValue('--tenant-id');
+  const db = createClient(supabaseUrl, supabaseKey);
+
+  let query = db
+    .from('tenants')
+    .select('id, github_username, buffer_access_token, linkedin_access_token, encrypted_dek')
+    .or('buffer_access_token.not.is.null,linkedin_access_token.not.is.null')
+    .order('created_at', { ascending: true });
+
+  if (tenantId) {
+    query = query.eq('id', tenantId);
+  }
+
+  const { data, error } = await query;
+  if (error) {
+    throw new Error(`Failed to fetch tenants: ${error.message}`);
+  }
+
+  const rows = (data ?? []) as TenantRow[];
+  let rotated = 0;
+  let skipped = 0;
+
+  for (const row of rows) {
+    const rotateBuffer = shouldRotateToken(row.buffer_access_token, row.encrypted_dek);
+    const rotateLinkedIn = shouldRotateToken(row.linkedin_access_token, row.encrypted_dek);
+
+    if (!rotateBuffer && !rotateLinkedIn) {
+      skipped++;
+      console.log(`SKIP ${row.github_username} (${row.id})`);
+      continue;
+    }
+
+    const sealed = await sealTenantSecrets({
+      ...(rotateBuffer ? { bufferAccessToken: row.buffer_access_token } : {}),
+      ...(rotateLinkedIn ? { linkedinAccessToken: row.linkedin_access_token } : {}),
+    }, row.encrypted_dek);
+
+    const updates: Record<string, string> = {
+      encrypted_dek: sealed.encryptedDek,
+    };
+
+    if (rotateBuffer && sealed.bufferAccessToken) {
+      updates['buffer_access_token'] = sealed.bufferAccessToken;
+    }
+    if (rotateLinkedIn && sealed.linkedinAccessToken) {
+      updates['linkedin_access_token'] = sealed.linkedinAccessToken;
+    }
+
+    if (dryRun) {
+      console.log(`DRY RUN ${row.github_username} (${row.id})`);
+      continue;
+    }
+
+    const { error: updateError } = await db
+      .from('tenants')
+      .update(updates)
+      .eq('id', row.id);
+
+    if (updateError) {
+      throw new Error(`Failed to rotate tenant ${row.id}: ${updateError.message}`);
+    }
+
+    rotated++;
+    console.log(`ROTATED ${row.github_username} (${row.id})`);
+  }
+
+  console.log('');
+  console.log(`Rotated: ${rotated}`);
+  console.log(`Skipped: ${skipped}`);
+  console.log(`Dry run: ${dryRun ? 'yes' : 'no'}`);
+}
+
+main().catch((err) => {
+  console.error(err);
+  process.exit(1);
+});


--- src/security/tenant-secrets.ts
diff --git a/src/security/tenant-secrets.ts b/src/security/tenant-secrets.ts
new file mode 100644
index 0000000..f5e8564
--- /dev/null
+++ b/src/security/tenant-secrets.ts
@@ -0,0 +1,181 @@
+import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
+import { KeyManagementServiceClient } from '@google-cloud/kms';
+
+const DEK_BYTES = 32;
+const GCM_IV_BYTES = 12;
+const ENCRYPTED_TOKEN_PREFIX = 'enc-v1';
+
+interface TenantSecretsInput {
+  readonly bufferAccessToken?: string | null;
+  readonly linkedinAccessToken?: string | null;
+}
+
+interface LoadedDek {
+  readonly encryptedDek: string;
+  readonly plaintextDek: Buffer;
+}
+
+export interface TenantSecretsRow {
+  readonly encrypted_dek: string | null;
+  readonly buffer_access_token: string | null;
+  readonly linkedin_access_token?: string | null;
+}
+
+export interface ResolvedTenantSecrets {
+  readonly bufferAccessToken: string | null;
+  readonly linkedinAccessToken: string | null;
+}
+
+export interface SealedTenantSecrets {
+  readonly encryptedDek: string;
+  bufferAccessToken?: string | null;
+  linkedinAccessToken?: string | null;
+}
+
+let kmsClient: KeyManagementServiceClient | null = null;
+
+function getKmsClient(): KeyManagementServiceClient {
+  if (!kmsClient) kmsClient = new KeyManagementServiceClient();
+  return kmsClient;
+}
+
+function getKmsKeyName(): string {
+  const keyName = process.env['GCP_KMS_KEY_NAME'] ?? process.env['KMS_KEY_NAME'] ?? '';
+  if (!keyName) {
+    throw new Error('GCP_KMS_KEY_NAME is required to encrypt tenant tokens');
+  }
+  return keyName;
+}
+
+function encode(value: Uint8Array): string {
+  return Buffer.from(value).toString('base64url');
+}
+
+function decode(value: string): Buffer {
+  return Buffer.from(value, 'base64url');
+}
+
+export function isEncryptedToken(token: string): boolean {
+  return token.startsWith(`${ENCRYPTED_TOKEN_PREFIX}:`);
+}
+
+function encryptWithDek(plaintextDek: Buffer, token: string): string {
+  const iv = randomBytes(GCM_IV_BYTES);
+  const cipher = createCipheriv('aes-256-gcm', plaintextDek, iv);
+  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
+  const authTag = cipher.getAuthTag();
+  return [
+    ENCRYPTED_TOKEN_PREFIX,
+    encode(iv),
+    encode(authTag),
+    encode(ciphertext),
+  ].join(':');
+}
+
+function decryptWithDek(plaintextDek: Buffer, token: string): string {
+  const [prefix, ivRaw, authTagRaw, ciphertextRaw] = token.split(':');
+  if (
+    prefix !== ENCRYPTED_TOKEN_PREFIX ||
+    !ivRaw ||
+    !authTagRaw ||
+    !ciphertextRaw
+  ) {
+    throw new Error('Invalid encrypted token format');
+  }
+
+  const decipher = createDecipheriv('aes-256-gcm', plaintextDek, decode(ivRaw));
+  decipher.setAuthTag(decode(authTagRaw));
+  const plaintext = Buffer.concat([
+    decipher.update(decode(ciphertextRaw)),
+    decipher.final(),
+  ]);
+  return plaintext.toString('utf8');
+}
+
+async function wrapDek(plaintextDek: Buffer): Promise<string> {
+  const [response] = await getKmsClient().encrypt({
+    name: getKmsKeyName(),
+    plaintext: plaintextDek,
+  });
+
+  if (!response.ciphertext) {
+    throw new Error('KMS encrypt returned no ciphertext for tenant DEK');
+  }
+
+  return typeof response.ciphertext === 'string'
+    ? encode(Buffer.from(response.ciphertext, 'base64'))
+    : encode(response.ciphertext);
+}
+
+async function unwrapDek(encryptedDek: string): Promise<Buffer> {
+  const [response] = await getKmsClient().decrypt({
+    name: getKmsKeyName(),
+    ciphertext: decode(encryptedDek),
+  });
+
+  if (!response.plaintext) {
+    throw new Error('KMS decrypt returned no plaintext for tenant DEK');
+  }
+
+  return Buffer.from(response.plaintext);
+}
+
+async function loadDek(existingEncryptedDek: string | null): Promise<LoadedDek> {
+  if (existingEncryptedDek) {
+    return {
+      encryptedDek: existingEncryptedDek,
+      plaintextDek: await unwrapDek(existingEncryptedDek),
+    };
+  }
+
+  const plaintextDek = randomBytes(DEK_BYTES);
+  return {
+    encryptedDek: await wrapDek(plaintextDek),
+    plaintextDek,
+  };
+}
+
+export async function sealTenantSecrets(
+  secrets: TenantSecretsInput,
+  existingEncryptedDek: string | null,
+): Promise<SealedTenantSecrets> {
+  const dek = await loadDek(existingEncryptedDek);
+  const sealed: SealedTenantSecrets = { encryptedDek: dek.encryptedDek };
+

--- src/webhook/handlers/linkedin-oauth.ts
diff --git a/src/webhook/handlers/linkedin-oauth.ts b/src/webhook/handlers/linkedin-oauth.ts
index 1046a28..f5267e3 100644
--- a/src/webhook/handlers/linkedin-oauth.ts
+++ b/src/webhook/handlers/linkedin-oauth.ts
@@ -2,6 +2,7 @@ import { createHmac, timingSafeEqual } from 'crypto';
 import { logger } from '../../utils/logger.js';
 import { LinkedInClient } from '../../linkedin/client.js';
 import type { SupabaseClient } from '@supabase/supabase-js';
+import { sealTenantSecrets } from '../../security/tenant-secrets.js';
 
 const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
 const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
@@ -114,13 +115,36 @@ export async function handleLinkedInCallback(
     return { status: 302, location: `/onboard?installation_id=${installationId}&error=linkedin_profile_failed` };
   }
 
+  const { data: tenant, error: tenantError } = await db
+    .from('tenants')
+    .select('encrypted_dek')
+    .eq('github_installation_id', installationId)
+    .single();
+
+  if (tenantError || !tenant) {
+    logger.error('linkedin.callback.tenant_fetch_failed', { installationId, error: tenantError?.message ?? 'no data' });
+    return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
+  }
+
+  let sealed;
+  try {
+    sealed = await sealTenantSecrets(
+      { linkedinAccessToken: tokenData.access_token },
+      (tenant as { encrypted_dek: string | null }).encrypted_dek,
+    );
+  } catch (err) {
+    logger.error('linkedin.callback.token_encrypt_failed', { installationId, error: String(err) });
+    return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
+  }
+
   // Store in tenant
   const { error } = await db
     .from('tenants')
     .update({
-      linkedin_access_token: tokenData.access_token,
+      linkedin_access_token: sealed.linkedinAccessToken ?? null,
       linkedin_member_id: memberUrn,
       linkedin_token_expires_at: expiresAt,
+      encrypted_dek: sealed.encryptedDek,
     })
     .eq('github_installation_id', installationId);
 


--- src/webhook/handlers/onboard.ts
diff --git a/src/webhook/handlers/onboard.ts b/src/webhook/handlers/onboard.ts
index 919d5fc..565f8b5 100644
--- a/src/webhook/handlers/onboard.ts
+++ b/src/webhook/handlers/onboard.ts
@@ -1,10 +1,12 @@
 import { logger } from '../../utils/logger.js';
 import type { SupabaseClient } from '@supabase/supabase-js';
+import { sealTenantSecrets } from '../../security/tenant-secrets.js';
 
 interface TenantRow {
   readonly id: string;
   readonly github_username: string;
   readonly buffer_access_token: string | null;
+  readonly encrypted_dek: string | null;
   readonly linkedin_member_id: string | null;
   readonly config: Record<string, unknown>;
   readonly voice_bootstrap: string | null;
@@ -12,7 +14,7 @@ interface TenantRow {
 
 function maskToken(token: string | null): string {
   if (!token) return '';
-  return token.slice(0, 6) + '••••••••';
+  return 'configured••••••••';
 }
 
 function html(tenant: TenantRow, installationId: number, linkedinClientId: string, appBaseUrl: string, saved: boolean): string {
@@ -138,7 +140,7 @@ export async function handleOnboardGet(
 ): Promise<{ status: number; body: string; contentType: string }> {
   const { data, error } = await db
     .from('tenants')
-    .select('id, github_username, buffer_access_token, linkedin_member_id, config, voice_bootstrap')
+    .select('id, github_username, buffer_access_token, encrypted_dek, linkedin_member_id, config, voice_bootstrap')
     .eq('github_installation_id', installationId)
     .single();
 
@@ -180,7 +182,7 @@ export async function handleOnboardPost(
   // Fetch current tenant to merge config
   const { data: tenant, error: fetchError } = await db
     .from('tenants')
-    .select('id, config')
+    .select('id, config, encrypted_dek')
     .eq('github_installation_id', installationId)
     .single();
 
@@ -207,7 +209,17 @@ export async function handleOnboardPost(
 
   // Only update buffer_access_token if a new one was provided (not the masked placeholder)
   if (bufferToken && !bufferToken.includes('••')) {
-    updates['buffer_access_token'] = bufferToken;
+    try {
+      const sealed = await sealTenantSecrets(
+        { bufferAccessToken: bufferToken },
+        (tenant as { encrypted_dek: string | null }).encrypted_dek,
+      );
+      updates['buffer_access_token'] = sealed.bufferAccessToken ?? null;
+      updates['encrypted_dek'] = sealed.encryptedDek;
+    } catch (err) {
+      logger.error('onboard.buffer_token_encrypt_failed', { installationId, error: String(err) });
+      return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
+    }
   }
 
   // Save voice bootstrap if provided


--- src/worker/main-scan-tenants.ts
diff --git a/src/worker/main-scan-tenants.ts b/src/worker/main-scan-tenants.ts
index eb1f241..fce3990 100644
--- a/src/worker/main-scan-tenants.ts
+++ b/src/worker/main-scan-tenants.ts
@@ -14,6 +14,7 @@ import { scanSentPosts } from '../buffer/sent-scanner.js';
 import { SupabaseStorage } from '../voice/supabase-storage.js';
 import { ConfigSchema } from '../config/schema.js';
 import type { Config } from '../config/schema.js';
+import { resolveTenantSecrets } from '../security/tenant-secrets.js';
 
 const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
 const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
@@ -28,7 +29,8 @@ const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
 interface TenantRow {
   readonly id: string;
   readonly github_username: string;
-  readonly buffer_access_token: string;
+  readonly buffer_access_token: string | null;
+  readonly encrypted_dek: string | null;
   readonly config: Record<string, unknown>;
 }
 
@@ -60,7 +62,7 @@ async function main(): Promise<void> {
 
   const { data: tenants, error } = await db
     .from('tenants')
-    .select('id, github_username, buffer_access_token, config')
+    .select('id, github_username, buffer_access_token, encrypted_dek, config')
     .eq('active', true)
     .not('buffer_access_token', 'is', null);
 
@@ -78,8 +80,13 @@ async function main(): Promise<void> {
   for (const tenant of rows) {
     try {
       const config = buildConfig(tenant);
+      const secrets = await resolveTenantSecrets(tenant);
       const storage = new SupabaseStorage(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, tenant.id);
-      const bufferClient = new BufferClient(tenant.buffer_access_token);
+      if (!secrets.bufferAccessToken) {
+        logger.warn('scanner.tenant.skip_missing_buffer_token', { tenantId: tenant.id, username: tenant.github_username });
+        continue;
+      }
+      const bufferClient = new BufferClient(secrets.bufferAccessToken);
 
       await scanSentPosts(bufferClient, storage, config);
       scanned++;


--- src/worker/process-job.ts
diff --git a/src/worker/process-job.ts b/src/worker/process-job.ts
index 00e308c..22ae3f8 100644
--- a/src/worker/process-job.ts
+++ b/src/worker/process-job.ts
@@ -17,6 +17,7 @@ import { logger } from '../utils/logger.js';
 import { ConfigSchema } from '../config/schema.js';
 import type { Config } from '../config/schema.js';
 import type { SaveDraftInput } from '../voice/storage.js';
+import { resolveTenantSecrets } from '../security/tenant-secrets.js';
 
 interface TenantRow {
   readonly id: string;
@@ -24,6 +25,7 @@ interface TenantRow {
   readonly github_username: string;
   readonly buffer_access_token: string | null;
   readonly linkedin_access_token: string | null;
+  readonly encrypted_dek: string | null;
   readonly linkedin_member_id: string | null;
   readonly config: Record<string, unknown>;
 }
@@ -100,7 +102,7 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
 
   const { data: tenantData, error: tenantError } = await deps.db
     .from('tenants')
-    .select('id, github_installation_id, github_username, buffer_access_token, linkedin_access_token, linkedin_member_id, config')
+    .select('id, github_installation_id, github_username, buffer_access_token, linkedin_access_token, encrypted_dek, linkedin_member_id, config')
     .eq('id', job.tenant_id)
     .eq('active', true)
     .single();
@@ -110,6 +112,7 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
   }
   const tenant = tenantData as TenantRow;
   const config = buildConfig(tenant);
+  const secrets = await resolveTenantSecrets(tenant);
 
   logger.info('worker.job.tenant', {
     jobId,
@@ -244,9 +247,9 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
       );
 
       // Post directly to LinkedIn if connected
-      if (tenant.linkedin_access_token && tenant.linkedin_member_id) {
+      if (secrets.linkedinAccessToken && tenant.linkedin_member_id) {
         try {
-          const linkedinClient = new LinkedInClient(tenant.linkedin_access_token);
+          const linkedinClient = new LinkedInClient(secrets.linkedinAccessToken);
           await linkedinClient.post(tenant.linkedin_member_id, linkedinPost);
           await storage.updatePublished({
             id: draftId,
@@ -268,8 +271,8 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
       }
 
       // Create Buffer Idea if configured (for Instagram or as backup)
-      if (tenant.buffer_access_token) {
-        const bufferClient = new BufferClient(tenant.buffer_access_token);
+      if (secrets.bufferAccessToken) {
+        const bufferClient = new BufferClient(secrets.bufferAccessToken);
         const publishResult = await publishToBuffer(
           bufferClient, storage, config, draftId, bufferText, commit.message,
         );

```

### Commit 2: 2edec1b
**Message:** ci: sync cloud run deploy configuration

**Diff:**
```diff
--- .github/workflows/deploy.yml
diff --git a/.github/workflows/deploy.yml b/.github/workflows/deploy.yml
index 3a285f6..cbca72e 100644
--- a/.github/workflows/deploy.yml
+++ b/.github/workflows/deploy.yml
@@ -11,10 +11,29 @@ permissions:
 jobs:
   deploy:
     runs-on: ubuntu-latest
+    env:
+      PROJECT_ID: lilicurl
+      REGION: us-central1
+      IMAGE: gcr.io/lilicurl/devcast:${{ github.sha }}
+      SUPABASE_URL: https://wxejktojaeqrieczzcnk.supabase.co
+      GITHUB_APP_ID: "3243238"
+      GCP_KMS_KEY_NAME: projects/lilicurl/locations/global/keyRings/devcast/cryptoKeys/tenant-secrets
 
     steps:
       - uses: actions/checkout@v4
 
+      - name: Set up Node
+        uses: actions/setup-node@v4
+        with:
+          node-version: 20
+          cache: npm
+
+      - name: Install dependencies
+        run: npm ci
+
+      - name: Typecheck
+        run: npm run typecheck
+
       - id: auth
         name: Authenticate to GCP
         uses: google-github-actions/auth@v2
@@ -30,30 +49,35 @@ jobs:
 
       - name: Build and push image
         run: |
-          IMAGE="gcr.io/lilicurl/devcast:${{ github.sha }}"
           docker build -t "$IMAGE" .
           docker push "$IMAGE"
 
       - name: Deploy webhook service
         run: |
-          IMAGE="gcr.io/lilicurl/devcast:${{ github.sha }}"
           gcloud run services update getdevcast-webhook \
             --image "$IMAGE" \
-            --region us-central1 \
-            --project lilicurl
+            --region "$REGION" \
+            --project "$PROJECT_ID" \
+            --update-env-vars "SUPABASE_URL=$SUPABASE_URL,GCP_KMS_KEY_NAME=$GCP_KMS_KEY_NAME" \
+            --update-secrets "GITHUB_APP_PRIVATE_KEY=github-app-private-key:latest,GITHUB_WEBHOOK_SECRET=github-webhook-secret:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,LINKEDIN_CLIENT_ID=LINKEDIN_CLIENT_ID:latest,LINKEDIN_CLIENT_SECRET=LINKEDIN_CLIENT_SECRET:latest,APP_BASE_URL=APP_BASE_URL:latest,GITHUB_APP_CLIENT_ID=GITHUB_APP_CLIENT_ID:latest,GITHUB_APP_CLIENT_SECRET=GITHUB_APP_CLIENT_SECRET:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest" \
+            --quiet
 
       - name: Deploy worker job
         run: |
-          IMAGE="gcr.io/lilicurl/devcast:${{ github.sha }}"
           gcloud run jobs update devcast-worker \
             --image "$IMAGE" \
-            --region us-central1 \
-            --project lilicurl
+            --region "$REGION" \
+            --project "$PROJECT_ID" \
+            --update-env-vars "SUPABASE_URL=$SUPABASE_URL,GITHUB_APP_ID=$GITHUB_APP_ID,GCP_KMS_KEY_NAME=$GCP_KMS_KEY_NAME" \
+            --update-secrets "SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,GITHUB_APP_PRIVATE_KEY=github-app-private-key:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest" \
+            --quiet
 
       - name: Deploy scanner job
         run: |
-          IMAGE="gcr.io/lilicurl/devcast:${{ github.sha }}"
           gcloud run jobs update devcast-scanner \
             --image "$IMAGE" \
-            --region us-central1 \
-            --project lilicurl
+            --region "$REGION" \
+            --project "$PROJECT_ID" \
+            --update-env-vars "SUPABASE_URL=$SUPABASE_URL,GCP_KMS_KEY_NAME=$GCP_KMS_KEY_NAME" \
+            --update-secrets "SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest" \
+            --quiet

```

### Commit 3: 40e2507
**Message:** feat: add convergent industry context prompts

**Diff:**
```diff
--- docs/industry-context-convergence-spec.md
diff --git a/docs/industry-context-convergence-spec.md b/docs/industry-context-convergence-spec.md
new file mode 100644
index 0000000..d5d98da
--- /dev/null
+++ b/docs/industry-context-convergence-spec.md
@@ -0,0 +1,132 @@
+# Industry Context Convergence Spec
+
+## Goal
+
+Keep article matches visible enough to add value, without implying the author read the
+article, borrowed the idea from it, or is citing it as authority.
+
+The post must continue to speak from the developer's own code and judgment.
+Industry context exists to position the post, not to source it.
+
+## Problem
+
+The current `industry_context` contract is too thin:
+
+- the worker injects a raw `Connection: ...` string
+- the prompt only says "Use this only if it strengthens the post naturally"
+- the model has no explicit rule separating `parallel validation` from `citation`
+
+That leaves too much room for two failure modes:
+
+1. The match becomes invisible, so the article adds little value.
+2. The match becomes too direct, so the copy sounds like the author read the piece or
+   learned the idea from it.
+
+## Desired Behavior
+
+When an article match is used in a post, it should behave like one of these:
+
+- external validation: the author's point is reinforced by the fact that similar
+  tradeoffs are appearing in industry writing
+- conceptual parallel: the author's change belongs to a broader technical conversation
+
+It must **not** behave like:
+
+- source attribution
+- proof of the author's claim
+- a claim that the author read the matched article
+- a citation of a specific article title
+
+## Core Rules
+
+1. The post speaks from the code and the author's decision-making.
+2. Industry context may only reinforce an idea that already exists in the commit and the
+   selected findings.
+3. The industry reference must remain subordinate to the author's own argument.
+   If it is removed, the post should still work.
+4. Use language of convergence, not derivation.
+5. If explicit naming appears, it should name a broader source family or brand as an
+   example of the conversation, never a specific article title.
+6. Never imply direct reading, borrowing, or dependence.
+
+## Allowed Language
+
+Good patterns:
+
+- "This kind of tradeoff is showing up more and more in platform tooling."
+- "It is the same direction other engineering teams are taking as they make these
+  controls more explicit."
+- "This is the kind of pattern that keeps resurfacing in engineering blogs across the
+  industry."
+- "Even though this change is local, it lines up with a broader shift toward ..."
+
+Good explicit-parallel patterns:
+
+- "It is the same kind of operational concern you see in engineering blogs like Uber's."
+- "This sits in the same conversation that architecture newsletters like ByteByteGo keep
+  returning to."
+
+## Forbidden Language
+
+Never generate phrases like:
+
+- "According to this article ..."
+- "As the article explains ..."
+- "After reading ..."
+- "Inspired by ..."
+- "This proves ..."
+- article-title citations
+
+## Prompt Contract
+
+`industry_context` should become a structured instruction block, not a raw sentence.
+
+The block must tell the generator:
+
+- this is parallel industry signal, not citation
+- the author did not necessarily read the matched piece
+- the connection must stay secondary to the post's own argument
+- naming, if used, must be broad and optional
+- the article title must never appear in the post
+
+## Matching Contract
+
+The cross-encoder should return a connection sentence that describes the shared technical
+pattern or tradeoff in neutral language.
+
+Example shape:
+
+- "Both the code change and the article deal with turning hidden operational constraints
+  into explicit controls."
+
+Not:
+
+- "This article explains why ..."
+
+## Source Naming Heuristic
+
+When possible, infer a broad source-family label from the matched article URL.
+
+Examples:
+
+- `uber.com` -> `engineering blogs like Uber's`
+- `bytebytego.com` -> `architecture newsletters like ByteByteGo`
+- `blog.cloudflare.com` -> `engineering blogs like Cloudflare's`
+
+If no clean label is available, default to implicit industry language only.
+
+## Non-Goals
+
+- We are not turning posts into reading lists.
+- We are not asking the model to cite or summarize the matched article.
+- We are not letting industry context replace the primary finding.
+
+## Implementation
+
+1. Change matcher guidance so the returned `connection` sentence is phrased as a shared
+   pattern/tradeoff, not as a citation.
+2. Replace raw `Connection: ...` injection with a structured `industry_context` prompt
+   block.
+3. Add prompt rules that explicitly ban derivation language and article-title mentions.
+4. Optionally expose a broad source-family label when one can be inferred from the article
+   URL.


--- src/ai/prompt-builder.ts
diff --git a/src/ai/prompt-builder.ts b/src/ai/prompt-builder.ts
index 60a95d3..084826d 100644
--- a/src/ai/prompt-builder.ts
+++ b/src/ai/prompt-builder.ts
@@ -62,6 +62,11 @@ export interface VoicePromptContext {
   varietyConstraint?: string;
 }
 
+export interface IndustryContextPromptInput {
+  connection: string;
+  articleUrl?: string | null;
+}
+
 export function buildSystemPrompt(
   config: Config,
   voiceProfile: VoiceProfile,
@@ -201,7 +206,6 @@ export function buildUserPrompt(
     parts.push('');
     parts.push('<industry_context>');
     parts.push(industryContext);
-    parts.push('Use this only if it strengthens the post naturally.');
     parts.push('</industry_context>');
   }
 
@@ -213,6 +217,7 @@ export function buildUserPrompt(
   parts.push('Describe what changed in the system behavior, control surface, reliability, cost, or operational flexibility.');
   parts.push('Use concrete implementation details. Do not invent files, numbers, or project context.');
   parts.push('If a finding touches AI, translate that into the human-made constraint, interface, or behavior change. Do not give the model authorship credit for the commit.');
+  parts.push('If <industry_context> is used, treat it as parallel validation from the industry, never as a citation or proof of the argument.');
   parts.push('The main post must stay at or under the configured character cap.');
   parts.push('Keep the main post under the configured hard cap. If needed, prefer fewer points and cleaner sentences over extra explanation.');
   parts.push('If <voice_exposure> exists, match its level of directness and structure without copying phrases literally.');
@@ -229,6 +234,29 @@ export function buildUserPrompt(
   return parts.join('\n');
 }
 
+export function buildIndustryContextBlock(input: IndustryContextPromptInput): string {
+  const sourceFamily = inferIndustrySourceFamily(input.articleUrl);
+  const lines = [
+    'This is parallel industry signal, not source attribution.',
+    'The author is speaking from their own code and judgment. Do not imply they read the matched article.',
+    'Only use this if it reinforces a point already present in the commit and findings.',
+    'Keep it subordinate to the main argument. If removed, the post should still work.',
+    'Use language of convergence, not derivation.',
+    `Shared pattern: ${input.connection}`,
+    'Prefer lines like "this kind of tradeoff is showing up more and more in engineering conversations" or "this sits in the same broader shift other teams are moving toward."',
+    'Never mention the article title.',
+    'Never write "according to", "as this article explains", "after reading", or "inspired by".',
+  ];
+
+  if (sourceFamily) {
+    lines.push(`If explicit naming helps, mention only the broader source family as an example: ${sourceFamily}.`);
+  } else {
+    lines.push('Prefer implicit industry language over naming any specific source.');
+  }
+
+  return lines.join('\n');
+}
+
 export function buildVarietyConstraint(
   recentOpeningSequence: string[],
   draftIndexToday: number,
@@ -491,14 +519,34 @@ function formatPreferenceLines(voiceProfile: VoiceProfile): string[] {
   }
 
   if (preferences.industry_context_preference === 'avoid') {
-    lines.push('Industry context has often been edited out. Only use it when it is essential and natural.');
+    lines.push('Industry context has often been edited out. Only use it when it adds clear value without competing with the main point.');
   } else if (preferences.industry_context_preference === 'prefer') {
-    lines.push('Industry context has historically survived editing well. Use it when the match is strong.');
+    lines.push('Industry context has historically survived editing well. Use it as secondary validation when the match is strong.');
   }
 
   return lines;
 }
 
+function inferIndustrySourceFamily(articleUrl?: string | null): string | null {
+  if (!articleUrl) return null;
+
+  try {
+    const hostname = new URL(articleUrl).hostname.toLowerCase().replace(/^www\./, '');
+
+    if (hostname.includes('uber.com')) return "engineering blogs like Uber's";
+    if (hostname.includes('bytebytego.com')) return 'architecture newsletters like ByteByteGo';
+    if (hostname.includes('cloudflare.com')) return "engineering blogs like Cloudflare's";
+    if (hostname.includes('linkedin.com')) return "engineering blogs like LinkedIn's";
+    if (hostname.includes('netflix.com')) return "engineering blogs like Netflix's";
+    if (hostname.includes('stripe.com')) return "engineering blogs like Stripe's";
+    if (hostname.includes('aws.amazon.com')) return 'engineering writing like the AWS Builders Library';
+  } catch {
+    return null;
+  }
+
+  return null;
+}
+
 function formatHashtagInstructions(voiceProfile: VoiceProfile): string {
   const manualHashtags = voiceProfile.hashtags.join(' ');
   if (voiceProfile.hashtags_mode === 'always' && manualHashtags) {


--- src/content/matcher.ts
diff --git a/src/content/matcher.ts b/src/content/matcher.ts
index f12b2b9..61baafa 100644
--- a/src/content/matcher.ts
+++ b/src/content/matcher.ts
@@ -20,6 +20,7 @@ interface CandidateArticle {
   main_thesis: string;
   key_insights: string[];
   source_id: string;
+  url: string;
   match_strength: number;
 }
 
@@ -27,8 +28,9 @@ export interface MatchedContext {
   readonly articleId: string;
   readonly sourceId: string;
   readonly matchStrength: number;
-  readonly connection: string;   // one sentence from cross-encoder
+  readonly connection: string;   // one shared-pattern sentence from cross-encoder
   readonly articleTitle: string;
+  readonly articleUrl: string;
 }
 
 interface FindingInput {
@@ -97,7 +99,7 @@ async function fetchCandidateArticles(
 
   const { data: articles, error: articleError } = await db
     .from('content_items')
-    .select('id, title, main_thesis, key_insights, source_id')
+    .select('id, title, main_thesis, key_insights, source_id, url')
     .in('id', topArticleIds);
 
   if (articleError) {
@@ -163,7 +165,7 @@ async function stage2CrossEncoder(
   finding: FindingInput,
   candidates: CandidateArticle[],
   aiClient: IAIClient,
-): Promise<{ articleId: string; sourceId: string; matchStrength: number; connection: string; title: string } | null> {
+): Promise<{ articleId: string; sourceId: string; matchStrength: number; connection: string; title: string; url: string } | null> {
   if (candidates.length === 0) return null;
 
   const candidateList = candidates
@@ -187,7 +189,9 @@ ${candidateList}
 
 For each candidate, respond with:
 - strength: "strong" (direct connection), "weak" (tangential), or "none"
-- connection: one sentence explaining how the code relates to the article (only if strong, else null)
+- connection: one sentence naming the shared technical pattern or tradeoff in neutral language (only if strong, else null)
+- the connection must work as industry validation later without implying the author read the article
+- never write it like a citation, recommendation, or summary of the article
 
 Respond as JSON array:
 [
@@ -221,7 +225,7 @@ Respond as JSON array:
 function findStrongMatch(
   results: Array<{ candidate: number; strength: string; connection: string | null }>,
   candidates: CandidateArticle[],
-): { articleId: string; sourceId: string; matchStrength: number; connection: string; title: string } | null {
+): { articleId: string; sourceId: string; matchStrength: number; connection: string; title: string; url: string } | null {
   for (const result of results) {
     if (result.strength === 'strong' && result.connection) {
       const idx = result.candidate - 1;
@@ -233,6 +237,7 @@ function findStrongMatch(
           matchStrength: article.match_strength,
           connection: result.connection,
           title: article.title,
+          url: article.url,
         };
       }
     }
@@ -331,6 +336,7 @@ export async function matchFindingsToArticles(
         matchStrength: match.matchStrength,
         connection: match.connection,
         articleTitle: match.title,
+        articleUrl: match.url,
       };
     } catch (err) {
       logger.warn('content.match.finding_error', { moduleId: finding.moduleId, error: String(err) });


--- src/worker/process-job.ts
diff --git a/src/worker/process-job.ts b/src/worker/process-job.ts
index a761108..7812928 100644
--- a/src/worker/process-job.ts
+++ b/src/worker/process-job.ts
@@ -8,7 +8,7 @@ import type { Finding } from '../analysis/types.js';
 import { MODULE_REGISTRY } from '../analysis/modules/index.js';
 import { createAIClient, createEmbedder } from '../ai/factory.js';
 import { generatePosts } from '../ai/post-generator.js';
-import { buildChapterContext, buildVarietyConstraint } from '../ai/prompt-builder.js';
+import { buildChapterContext, buildIndustryContextBlock, buildVarietyConstraint } from '../ai/prompt-builder.js';
 import { matchFindingsToArticles } from '../content/matcher.js';
 import { BufferClient } from '../buffer/client.js';
 import { publishToBuffer } from '../buffer/publisher.js';
@@ -430,7 +430,10 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
                 similarityThreshold,
               });
               if (match) {
-                industryContext = `Connection: ${match.connection}`;
+                industryContext = buildIndustryContextBlock({
+                  connection: match.connection,
+                  articleUrl: match.articleUrl,
+                });
                 draftMetadata = {
                   ...draftMetadata,
                   context_status: 'matched',

```

### Commit 4: a667cc0
**Message:** fix: unblock live content corpus activation

**Diff:**
```diff
--- .github/workflows/discover-sources.yml
diff --git a/.github/workflows/discover-sources.yml b/.github/workflows/discover-sources.yml
index a5ff4ba..74305e0 100644
--- a/.github/workflows/discover-sources.yml
+++ b/.github/workflows/discover-sources.yml
@@ -33,3 +33,30 @@ jobs:
           SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
           DRY_RUN: ${{ inputs.dry_run || 'false' }}
         run: npx tsx src/content/scripts/discover-sources-main.ts
+
+  fetch_after_discover:
+    needs: discover
+    if: ${{ success() && (github.event_name != 'workflow_dispatch' || inputs.dry_run == false) }}
+    runs-on: ubuntu-latest
+    timeout-minutes: 360
+
+    steps:
+      - uses: actions/checkout@v4
+
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '20'
+          cache: 'npm'
+
+      - run: npm ci
+
+      - name: Install Chrome for Puppeteer
+        run: npx puppeteer browsers install chrome
+
+      - name: Run content fetch pipeline after discovery
+        env:
+          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
+          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
+          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
+          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
+        run: npx tsx src/content/scripts/content-fetch-main.ts


--- src/content/classifier.ts
diff --git a/src/content/classifier.ts b/src/content/classifier.ts
index 9ee9daf..b920552 100644
--- a/src/content/classifier.ts
+++ b/src/content/classifier.ts
@@ -1,4 +1,5 @@
 import Anthropic from '@anthropic-ai/sdk';
+import { createHash } from 'crypto';
 import { logger } from '../utils/logger.js';
 import type { ClassifierResult } from './types.js';
 
@@ -26,7 +27,7 @@ Respond ONLY as JSON:
 }`;
 
 export interface ArticleToClassify {
-  readonly id: string;  // used as custom_id in batch
+  readonly id: string;
   readonly title: string;
   readonly text: string;
 }
@@ -63,10 +64,15 @@ export async function classifyArticlesBatch(
     messages: [{ role: 'user', content: buildClassifierUserPrompt(article) }],
   }));
 
-  const batchRequests = articles.map((article, i) => ({
-    custom_id: article.id,
-    params: requests[i]!,
-  }));
+  const idMap = new Map<string, string>();
+  const batchRequests = articles.map((article, i) => {
+    const customId = buildBatchCustomId(article.id, i);
+    idMap.set(customId, article.id);
+    return {
+      custom_id: customId,
+      params: requests[i]!,
+    };
+  });
 
   logger.info('content.classify.batch_submit', { count: articles.length, model });
 
@@ -95,8 +101,9 @@ export async function classifyArticlesBatch(
   let jsonErrors = 0;
 
   for await (const result of await client.messages.batches.results(batch.id)) {
+    const originalId = idMap.get(result.custom_id) ?? result.custom_id;
     if (result.result.type !== 'succeeded') {
-      logger.warn('content.classify.item_failed', { id: result.custom_id, type: result.result.type });
+      logger.warn('content.classify.item_failed', { id: originalId, type: result.result.type });
       continue;
     }
 
@@ -106,11 +113,11 @@ export async function classifyArticlesBatch(
     const parsed = parseClassifierResponse(block.text);
     if (parsed) {
       if (parsed.quality_score >= QUALITY_GATE) {
-        classified.push({ id: result.custom_id, result: parsed });
+        classified.push({ id: originalId, result: parsed });
       }
     } else {
       jsonErrors++;
-      logger.warn('content.classify.json_error', { id: result.custom_id });
+      logger.warn('content.classify.json_error', { id: originalId });
     }
   }
 
@@ -205,6 +212,11 @@ function buildClassifierUserPrompt(article: ArticleToClassify): string {
   return `Title: ${article.title}\n\n${article.text}`;
 }
 
+function buildBatchCustomId(articleId: string, index: number): string {
+  const digest = createHash('sha256').update(articleId).digest('hex').slice(0, 16);
+  return `article-${index}-${digest}`;
+}
+
 function buildJsonCandidates(raw: string): string[] {
   const cleaned = stripMarkdownFences(raw);
   const candidates = new Set<string>();


--- src/content/content-storage.ts
diff --git a/src/content/content-storage.ts b/src/content/content-storage.ts
index d0e8006..30ab257 100644
--- a/src/content/content-storage.ts
+++ b/src/content/content-storage.ts
@@ -149,7 +149,11 @@ export async function recordFetchFailure(db: SupabaseClient, sourceId: string):
 export async function recordFetchSuccess(db: SupabaseClient, sourceId: string): Promise<void> {
   await db
     .from('content_sources')
-    .update({ fetch_failures: 0, last_fetch_ok_at: new Date().toISOString() })
+    .update({
+      fetch_failures: 0,
+      last_fetch_ok_at: new Date().toISOString(),
+      status: 'active',
+    })
     .eq('id', sourceId);
 }
 
@@ -201,6 +205,21 @@ export async function loadActiveSources(db: SupabaseClient): Promise<ContentSour
   return (data ?? []) as ContentSource[];
 }
 
+export async function countSourcesByStatus(db: SupabaseClient): Promise<Record<string, number>> {
+  const { data, error } = await db
+    .from('content_sources')
+    .select('status, is_protected');
+
+  if (error) throw new Error(`Failed to count content sources: ${error.message}`);
+
+  const counts: Record<string, number> = {};
+  for (const row of (data ?? []) as Array<{ status: string; is_protected: boolean }>) {
+    const key = row.status + (row.is_protected ? ':protected' : '');
+    counts[key] = (counts[key] ?? 0) + 1;
+  }
+  return counts;
+}
+
 /**
  * Promotes up to 20 queued sources to active.
  * Priority: discovered_from='both' first, then oldest.
@@ -208,15 +227,28 @@ export async function loadActiveSources(db: SupabaseClient): Promise<ContentSour
 export async function promoteQueuedSources(db: SupabaseClient, limit = 20): Promise<number> {
   const { data } = await db
     .from('content_sources')
-    .select('id')
+    .select('id, discovered_from, added_at')
     .eq('status', 'queued')
-    .order('discovered_from', { ascending: false })  // 'both' sorts before others alphabetically — OK
-    .order('added_at', { ascending: true })
     .limit(limit);
 
   if (!data?.length) return 0;
 
-  const ids = (data as Array<{ id: string }>).map((r) => r.id);
+  const priority = new Map<string, number>([
+    ['both', 0],
+    ['manual', 1],
+    ['engineering-blogs', 2],
+    ['awesome-tech-rss', 3],
+  ]);
+
+  const ids = [...(data as Array<{ id: string; discovered_from: string | null; added_at: string }>) ]
+    .sort((left, right) => {
+      const leftPriority = priority.get(left.discovered_from ?? '') ?? 99;
+      const rightPriority = priority.get(right.discovered_from ?? '') ?? 99;
+      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
+      return new Date(left.added_at).getTime() - new Date(right.added_at).getTime();
+    })
+    .slice(0, limit)
+    .map((row) => row.id);
   await db.from('content_sources').update({ status: 'active' }).in('id', ids);
   return ids.length;
 }


--- src/content/scripts/content-fetch-main.ts
diff --git a/src/content/scripts/content-fetch-main.ts b/src/content/scripts/content-fetch-main.ts
index 883201f..b9672b3 100644
--- a/src/content/scripts/content-fetch-main.ts
+++ b/src/content/scripts/content-fetch-main.ts
@@ -20,6 +20,7 @@ import { classifyArticlesBatch } from '../classifier.js';
 import { chunkArticle } from '../chunker.js';
 import { embedChunksBatch } from '../embedder.js';
 import {
+  countSourcesByStatus,
   promoteQueuedSources,
   loadDedupData,
   storeArticle,
@@ -54,15 +55,22 @@ async function main(): Promise<void> {
     classify_json_errors: 0, embed_failures: 0,
   };
 
+  const sourceCountsBefore = await countSourcesByStatus(db);
+  stats.sources_queued = sourceCountsBefore['queued'] ?? 0;
+  stats.sources_active = (sourceCountsBefore['active'] ?? 0) + (sourceCountsBefore['active:protected'] ?? 0);
+
   // ── A. Promote queued sources ──────────────────────────────────────────────
   const promoted = await promoteQueuedSources(db, 20);
   stats.sources_promoted = promoted;
-  logger.info('content.fetch.promoted', { count: promoted });
+  logger.info('content.fetch.promoted', {
+    count: promoted,
+    queued_before: stats.sources_queued,
+    active_before: stats.sources_active,
+  });
 
   // ── B. Fetch RSS feeds ─────────────────────────────────────────────────────
   const sources = await loadActiveSources(db) as unknown as ContentSource[];
-  stats.sources_active = sources.filter((s) => s.status === 'active').length;
-  stats.sources_queued = sources.filter((s) => s.status === 'queued').length;
+  stats.sources_active = sources.filter((s) => s.status === 'active').length + (sourceCountsBefore['active:protected'] ?? 0);
 
   const feedResults = await fetchAllFeeds(sources);
 

```

### Commit 5: a9507ed
**Message:** feat: add seed corpus tooling and extraction hardening

**Diff:**
```diff
--- config.example.yaml
diff --git a/config.example.yaml b/config.example.yaml
index 7ecddd5..f050a21 100644
--- a/config.example.yaml
+++ b/config.example.yaml
@@ -38,6 +38,12 @@ ai:
   model: "claude-sonnet-4-6"
   max_tokens: 1600
 
+content:
+  extraction:
+    puppeteer_fallback_hosts:             # optional; can also use CONTENT_PUPPETEER_FALLBACK_HOSTS env var
+      - "discord.com"
+      - "stripe.com"
+
 # Optional: npm packages that extend devcast with custom analysis modules.
 # Each package must export a named `module` implementing CodeAnalyzer (devcast-sdk).
 # Install them first: npm install devcast-module-rust


--- database/migrations/2026-04-08-phase2-seed-readiness-verify.sql
diff --git a/database/migrations/2026-04-08-phase2-seed-readiness-verify.sql b/database/migrations/2026-04-08-phase2-seed-readiness-verify.sql
new file mode 100644
index 0000000..22add34
--- /dev/null
+++ b/database/migrations/2026-04-08-phase2-seed-readiness-verify.sql
@@ -0,0 +1,56 @@
+-- Post-migration verification for Phase 2 + seed corpus readiness
+
+-- 1. voice_posts match metadata columns exist
+SELECT column_name
+FROM information_schema.columns
+WHERE table_schema = 'public'
+  AND table_name = 'voice_posts'
+  AND column_name IN (
+    'top_module_id',
+    'edit_analysis',
+    'context_status',
+    'has_industry_context',
+    'matched_article_id',
+    'matched_source_id',
+    'match_strength',
+    'match_connection',
+    'last_reactions_fetch_at',
+    'publish_source',
+    'author_login'
+  )
+ORDER BY column_name;
+
+-- 2. content corpus support columns exist
+SELECT table_name, column_name
+FROM information_schema.columns
+WHERE table_schema = 'public'
+  AND (
+    (table_name = 'content_sources' AND column_name = 'is_protected')
+    OR
+    (table_name = 'content_items' AND column_name = 'seed_modules')
+  )
+ORDER BY table_name, column_name;
+
+-- 3. job_queue / pending_batch / pipeline-run gaps exist
+SELECT table_name, column_name
+FROM information_schema.columns
+WHERE table_schema = 'public'
+  AND (
+    (table_name = 'job_queue' AND column_name IN ('leased_until', 'idempotency_key'))
+    OR
+    (table_name = 'pending_batch' AND column_name IN ('tenant_id', 'author_login'))
+    OR
+    (table_name = 'content_pipeline_runs' AND column_name IN ('classify_batch_id', 'embed_batch_id'))
+    OR
+    (table_name = 'tenants' AND column_name = 'encrypted_dek')
+  )
+ORDER BY table_name, column_name;
+
+-- 4. unique partial index for idempotency_key exists
+SELECT indexname, indexdef
+FROM pg_indexes
+WHERE schemaname = 'public'
+  AND indexname = 'idx_job_queue_idempotency';
+
+-- 5. matcher function exists with protected-source clause
+SELECT pg_get_functiondef('match_article_chunks(vector,double precision,integer,integer,date)'::regprocedure);


--- database/migrations/2026-04-08-phase2-seed-readiness.sql
diff --git a/database/migrations/2026-04-08-phase2-seed-readiness.sql b/database/migrations/2026-04-08-phase2-seed-readiness.sql
new file mode 100644
index 0000000..6bc4493
--- /dev/null
+++ b/database/migrations/2026-04-08-phase2-seed-readiness.sql
@@ -0,0 +1,66 @@
+-- Phase 2 + seed corpus readiness migration
+-- Safe to run manually in Supabase SQL Editor.
+-- Idempotent: uses IF NOT EXISTS / CREATE OR REPLACE.
+
+-- voice_posts gaps
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS top_module_id            TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS edit_analysis            JSONB;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS context_status           TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS has_industry_context     BOOLEAN NOT NULL DEFAULT FALSE;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_article_id       UUID REFERENCES content_items(id);
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_source_id        UUID REFERENCES content_sources(id);
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_strength           REAL;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection         TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at  TIMESTAMPTZ;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source           TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS author_login             TEXT;
+
+-- job_queue gaps
+ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS leased_until TIMESTAMPTZ;
+ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
+CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_idempotency
+  ON job_queue(idempotency_key)
+  WHERE idempotency_key IS NOT NULL;
+
+-- content_pipeline_runs gaps
+ALTER TABLE content_pipeline_runs ADD COLUMN IF NOT EXISTS classify_batch_id TEXT;
+ALTER TABLE content_pipeline_runs ADD COLUMN IF NOT EXISTS embed_batch_id    TEXT;
+
+-- pending_batch gaps
+ALTER TABLE pending_batch ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
+ALTER TABLE pending_batch ADD COLUMN IF NOT EXISTS author_login TEXT;
+
+-- content_sources / content_items gaps for protected seed corpus support
+ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT FALSE;
+ALTER TABLE content_items ADD COLUMN IF NOT EXISTS seed_modules TEXT[];
+
+-- tenants gaps
+ALTER TABLE tenants ADD COLUMN IF NOT EXISTS encrypted_dek TEXT;
+
+-- matcher Stage 1 must include protected sources even if their week_of is backdated
+CREATE OR REPLACE FUNCTION match_article_chunks(
+  query_embedding      vector(1536),
+  similarity_threshold FLOAT,
+  match_count          INT,
+  min_quality_score    INT,
+  week_of_cutoff       DATE
+)
+RETURNS TABLE (content_item_id UUID, similarity FLOAT)
+LANGUAGE sql STABLE
+AS $$
+  SELECT
+    ac.content_item_id,
+    1 - (ac.embedding <=> query_embedding) AS similarity
+  FROM article_chunks ac
+  JOIN content_items ci ON ci.id = ac.content_item_id
+  LEFT JOIN content_sources cs ON cs.id = ci.source_id
+  WHERE
+    1 - (ac.embedding <=> query_embedding) >= similarity_threshold
+    AND ci.quality_score >= min_quality_score
+    AND (
+      ci.week_of >= week_of_cutoff
+      OR COALESCE(cs.is_protected, FALSE) = TRUE
+    )
+  ORDER BY ac.embedding <=> query_embedding
+  LIMIT match_count;
+$$;


--- database/schema.sql
diff --git a/database/schema.sql b/database/schema.sql
index ff6f9fd..ca27011 100644
--- a/database/schema.sql
+++ b/database/schema.sql
@@ -187,6 +187,36 @@ CREATE TABLE IF NOT EXISTS content_pipeline_runs (
   embed_failures        INTEGER NOT NULL DEFAULT 0
 );
 
+-- Schema gaps backfilled here so the full contract is available on both
+-- fresh installs and existing databases that were created before Phase 2 landed.
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS top_module_id            TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS edit_analysis            JSONB;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS context_status           TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS has_industry_context     BOOLEAN NOT NULL DEFAULT FALSE;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_article_id       UUID REFERENCES content_items(id);
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_source_id        UUID REFERENCES content_sources(id);
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_strength           REAL;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection         TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at  TIMESTAMPTZ;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source           TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS author_login             TEXT;
+
+ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS leased_until               TIMESTAMPTZ;
+ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS idempotency_key            TEXT;
+CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_idempotency
+  ON job_queue(idempotency_key)
+  WHERE idempotency_key IS NOT NULL;
+
+ALTER TABLE content_pipeline_runs ADD COLUMN IF NOT EXISTS classify_batch_id TEXT;
+ALTER TABLE content_pipeline_runs ADD COLUMN IF NOT EXISTS embed_batch_id    TEXT;
+
+ALTER TABLE pending_batch ADD COLUMN IF NOT EXISTS tenant_id    UUID REFERENCES tenants(id);
+ALTER TABLE pending_batch ADD COLUMN IF NOT EXISTS author_login TEXT;
+
+ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT FALSE;
+ALTER TABLE content_items ADD COLUMN IF NOT EXISTS seed_modules   TEXT[];
+ALTER TABLE tenants ADD COLUMN IF NOT EXISTS encrypted_dek        TEXT;
+
 -- Indexes
 CREATE INDEX IF NOT EXISTS idx_title_hash ON content_items(title_hash);
 
@@ -214,10 +244,14 @@ AS $$
     1 - (ac.embedding <=> query_embedding) AS similarity
   FROM article_chunks ac
   JOIN content_items ci ON ci.id = ac.content_item_id
+  LEFT JOIN content_sources cs ON cs.id = ci.source_id
   WHERE
     1 - (ac.embedding <=> query_embedding) >= similarity_threshold
     AND ci.quality_score >= min_quality_score
-    AND ci.week_of >= week_of_cutoff
+    AND (
+      ci.week_of >= week_of_cutoff
+      OR COALESCE(cs.is_protected, FALSE) = TRUE
+    )
   ORDER BY ac.embedding <=> query_embedding
   LIMIT match_count;
 $$;


--- package.json
diff --git a/package.json b/package.json
index 771a1c7..6c0f04f 100644
--- a/package.json
+++ b/package.json
@@ -14,6 +14,9 @@
     "poll": "tsx --env-file=.env.local src/main-poll.ts",
     "scan": "tsx --env-file=.env.local src/main-scan.ts",
     "gen-image-prompt": "tsx --env-file=.env.local scripts/gen-image-prompt.ts",
+    "seed-corpus:extract": "tsx --env-file=.env.local scripts/seed-corpus/extract-text.ts",
+    "seed-corpus:validate": "tsx --env-file=.env.local scripts/seed-corpus/validate.ts",
+    "seed-corpus:seed": "tsx --env-file=.env.local scripts/seed-corpus/seed.ts",
     "test": "vitest run",
     "typecheck": "tsc --noEmit"
   },


--- scripts/seed-corpus/extract-text.ts
diff --git a/scripts/seed-corpus/extract-text.ts b/scripts/seed-corpus/extract-text.ts
new file mode 100644
index 0000000..a82de69
--- /dev/null
+++ b/scripts/seed-corpus/extract-text.ts
@@ -0,0 +1,110 @@
+/**
+ * Generate seed-articles.json from the frozen CSV by extracting full article text.
+ *
+ * Usage:
+ *   npm run seed-corpus:extract
+ *   npm run seed-corpus:extract -- --input path/to/seed-articles-frozen.csv --output path/to/seed-articles.json
+ */
+
+import { writeFileSync } from 'fs';
+import { extractArticle } from '../../src/content/article-extractor.js';
+import {
+  DEFAULT_FAILURES_JSON_PATH,
+  DEFAULT_FROZEN_CSV_PATH,
+  DEFAULT_SEED_JSON_PATH,
+  assertKnownModules,
+  getArgValue,
+  modulesFromRow,
+  parseInteger,
+  readFrozenCsv,
+  resolveCliPath,
+  type SeedArticle,
+  type SeedExtractionFailure,
+} from './shared.js';
+
+const MIN_WORD_COUNT = 300;
+const DEFAULT_DELAY_MS = 2_000;
+
+async function main(): Promise<void> {
+  const args = process.argv.slice(2);
+  const inputPath = resolveCliPath(getArgValue(args, '--input'), DEFAULT_FROZEN_CSV_PATH);
+  const outputPath = resolveCliPath(getArgValue(args, '--output'), DEFAULT_SEED_JSON_PATH);
+  const failuresPath = resolveCliPath(getArgValue(args, '--failures'), DEFAULT_FAILURES_JSON_PATH);
+  const delayMs = parseInteger(getArgValue(args, '--delay-ms') ?? String(DEFAULT_DELAY_MS), '--delay-ms');
+  const limit = getArgValue(args, '--limit');
+  const limitCount = limit ? parseInteger(limit, '--limit') : null;
+
+  const rows = readFrozenCsv(inputPath)
+    .filter((row) => row.status === 'kept' || row.status === 'text_extracted');
+  const selectedRows = limitCount === null ? rows : rows.slice(0, limitCount);
+
+  const out: SeedArticle[] = [];
+  const failures: SeedExtractionFailure[] = [];
+
+  console.log(`Extracting full text for ${selectedRows.length} curated rows from ${inputPath}`);
+
+  for (let index = 0; index < selectedRows.length; index++) {
+    const row = selectedRows[index]!;
+    const modules = modulesFromRow(row);
+    const qualityScore = parseInteger(row.quality_score, `quality_score for row ${row.id}`);
+
+    if (!row.url || !row.title || !row.source_name) {
+      throw new Error(`Row ${row.id} is missing url, title, or source_name`);
+    }
+    if (qualityScore < 7 || qualityScore > 10) {
+      throw new Error(`Row ${row.id} has invalid quality_score ${qualityScore}; expected 7-10`);
+    }
+    if (modules.length === 0) {
+      throw new Error(`Row ${row.id} has no module tags`);
+    }
+    assertKnownModules(modules, `row ${row.id}`);
+
+    process.stdout.write(`[${index + 1}/${selectedRows.length}] ${row.title} ... `);
+
+    try {
+      const article = await extractArticle(row.url, null, true);
+      if (!article) {
+        failures.push({ id: row.id, url: row.url, reason: 'extractor_returned_null' });
+        console.log('FAIL (extractor returned null)');
+      } else if (article.wordCount < MIN_WORD_COUNT) {
+        failures.push({ id: row.id, url: row.url, reason: `word_count_${article.wordCount}` });
+        console.log(`FAIL (${article.wordCount} words)`);
+      } else {
+        out.push({
+          url: row.url,
+          title: row.title,
+          source_name: row.source_name,
+          text: article.text,
+          quality_score: qualityScore,
+          modules,
+        });
+        console.log(`OK (${article.wordCount} words)`);
+      }
+    } catch (err) {
+      failures.push({ id: row.id, url: row.url, reason: String(err) });
+      console.log(`ERROR (${String(err).slice(0, 120)})`);
+    }
+
+    if (index < selectedRows.length - 1 && delayMs > 0) {
+      await sleep(delayMs);
+    }
+  }
+
+  writeFileSync(outputPath, `${JSON.stringify(out, null, 2)}\n`);
+  writeFileSync(failuresPath, `${JSON.stringify(failures, null, 2)}\n`);
+
+  console.log('');
+  console.log(`Extracted: ${out.length}/${selectedRows.length}`);
+  console.log(`Failures:  ${failures.length}`);
+  console.log(`JSON:      ${outputPath}`);
+  console.log(`Failures:  ${failuresPath}`);
+}
+
+function sleep(ms: number): Promise<void> {
+  return new Promise((resolve) => setTimeout(resolve, ms));
+}
+
+main().catch((err) => {
+  console.error('Seed extraction failed:', err);
+  process.exit(1);
+});


--- scripts/seed-corpus/seed.ts
diff --git a/scripts/seed-corpus/seed.ts b/scripts/seed-corpus/seed.ts
new file mode 100644
index 0000000..fcd1a1d
--- /dev/null
+++ b/scripts/seed-corpus/seed.ts
@@ -0,0 +1,226 @@
+/**
+ * Insert the curated seed corpus into Supabase and generate embeddings in real time.
+ *
+ * Usage:
+ *   npm run seed-corpus:seed
+ *   npm run seed-corpus:seed -- --input path/to/seed-articles.json --limit 10
+ */
+
+import Anthropic from '@anthropic-ai/sdk';
+import { createClient, type SupabaseClient } from '@supabase/supabase-js';
+import OpenAI from 'openai';
+import { articleFingerprint, titleHash } from '../../src/content/dedup.js';
+import { classifyArticleRealtimeWithClient } from '../../src/content/classifier.js';
+import { chunkArticle } from '../../src/content/chunker.js';
+import { storeArticle, storeChunks } from '../../src/content/content-storage.js';
+import {
+  DEFAULT_CLASSIFIER_MODEL,
+  DEFAULT_EMBEDDING_MODEL,
+  DEFAULT_SEED_JSON_PATH,
+  DEFAULT_SEED_SOURCE_NAME,
+  DEFAULT_SEED_WEEK_OF,
+  getArgValue,
+  loadSeedArticles,
+  parseInteger,
+  resolveCliPath,
+} from './shared.js';
+
+const SEED_SOURCE_URL = 'https://devcast.lilicurl.com/seed';
+const SEED_SOURCE_RSS_URL = 'https://devcast.lilicurl.com/seed.rss';
+
+async function main(): Promise<void> {
+  const args = process.argv.slice(2);
+  const inputPath = resolveCliPath(getArgValue(args, '--input'), DEFAULT_SEED_JSON_PATH);
+  const classifierModel = getArgValue(args, '--classifier-model') ?? DEFAULT_CLASSIFIER_MODEL;
+  const embeddingModel = getArgValue(args, '--embedding-model') ?? DEFAULT_EMBEDDING_MODEL;
+  const limitArg = getArgValue(args, '--limit');
+  const limit = limitArg ? parseInteger(limitArg, '--limit') : null;
+
+  const supabaseUrl = process.env['SUPABASE_URL'];
+  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
+  const openaiApiKey = process.env['OPENAI_API_KEY'];
+  const anthropicApiKey = process.env['ANTHROPIC_API_KEY'];
+
+  if (!supabaseUrl || !supabaseKey || !openaiApiKey || !anthropicApiKey) {
+    throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, and ANTHROPIC_API_KEY are required');
+  }
+
+  const articles = loadSeedArticles(inputPath);
+  const selectedArticles = limit === null ? articles : articles.slice(0, limit);
+  const db = createClient(supabaseUrl, supabaseKey);
+  const anthropic = new Anthropic({ apiKey: anthropicApiKey });
+  const openai = new OpenAI({ apiKey: openaiApiKey });
+
+  const sourceId = await ensureSeedSource(db);
+
+  let inserted = 0;
+  let skipped = 0;
+  let failed = 0;
+
+  console.log(`Seeding ${selectedArticles.length} article(s) from ${inputPath}`);
+  console.log(`Seed source: ${DEFAULT_SEED_SOURCE_NAME} (${sourceId})`);
+
+  for (let index = 0; index < selectedArticles.length; index++) {
+    const article = selectedArticles[index]!;
+    process.stdout.write(`[${index + 1}/${selectedArticles.length}] ${article.title} ... `);
+
+    const { data: existing, error: existingError } = await db
+      .from('content_items')
+      .select('id')
+      .eq('url', article.url)
+      .maybeSingle();
+
+    if (existingError) {
+      throw new Error(`Failed to check existing article ${article.url}: ${existingError.message}`);
+    }
+
+    if (existing) {
+      skipped++;
+      console.log('SKIP (already exists)');
+      continue;
+    }
+
+    try {
+      const classification = await classifyArticleRealtimeWithClient(
+        { id: article.url, title: article.title, text: article.text },
+        anthropic,
+        classifierModel,
+      );
+
+      const contentItemId = await storeArticle(db, {
+        sourceId,
+        weekOf: DEFAULT_SEED_WEEK_OF,
+        url: article.url,
+        title: article.title,
+        contentText: article.text,
+        summary: classification.summary,
+        mainThesis: classification.main_thesis,
+        keyInsights: classification.key_insights,
+        techConcepts: classification.tech_concepts,
+        seedModules: article.modules,
+        qualityScore: article.quality_score,
+        titleHash: titleHash(article.title),
+        fingerprint: articleFingerprint(article.text),
+      });
+
+      if (!contentItemId) {
+        failed++;
+        console.log('FAIL (content_items insert failed)');
+        continue;
+      }
+
+      try {
+        const chunks = chunkArticle(article.text);
+        if (chunks.length === 0) {
+          throw new Error('Chunker returned 0 chunks');
+        }
+
+        const embeddingResponse = await openai.embeddings.create({
+          model: embeddingModel,
+          input: chunks,
+        });
+
+        if (embeddingResponse.data.length !== chunks.length) {
+          throw new Error(`Embedding count mismatch: expected ${chunks.length}, received ${embeddingResponse.data.length}`);
+        }
+
+        await storeChunks(
+          db,
+          chunks.map((chunkText, chunkIndex) => {
+            const embedding = embeddingResponse.data[chunkIndex]?.embedding;
+            if (!embedding) {
+              throw new Error(`Missing embedding for chunk ${chunkIndex}`);
+            }
+
+            return {
+              contentItemId,
+              chunkIndex,
+              chunkText,
+              embedding,
+            };
+          }),
+        );
+
+        inserted++;

--- scripts/seed-corpus/shared.ts
diff --git a/scripts/seed-corpus/shared.ts b/scripts/seed-corpus/shared.ts
new file mode 100644
index 0000000..af00804
--- /dev/null
+++ b/scripts/seed-corpus/shared.ts
@@ -0,0 +1,262 @@
+import { readFileSync } from 'fs';
+import { resolve } from 'path';
+import { MODULE_REGISTRY } from '../../src/analysis/modules/index.js';
+
+export const DEFAULT_FROZEN_CSV_PATH = 'seed-articles-frozen.csv';
+export const DEFAULT_SEED_JSON_PATH = 'seed-articles.json';
+export const DEFAULT_FAILURES_JSON_PATH = 'seed-extraction-failures.json';
+export const DEFAULT_SEED_SOURCE_NAME = 'curated-seed';
+export const DEFAULT_SEED_WEEK_OF = '2026-01-01';
+export const DEFAULT_CLASSIFIER_MODEL = 'claude-haiku-4-5';
+export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
+
+export interface FrozenCsvRow {
+  readonly id: string;
+  readonly track: string;
+  readonly module_primary: string;
+  readonly module_secondary: string;
+  readonly url: string;
+  readonly title: string;
+  readonly source_name: string;
+  readonly author: string;
+  readonly published_date: string;
+  readonly quality_score: string;
+  readonly why_kept: string;
+  readonly status: string;
+  readonly reject_reason: string;
+  readonly notes: string;
+}
+
+export interface SeedArticle {
+  readonly url: string;
+  readonly title: string;
+  readonly source_name: string;
+  readonly text: string;
+  readonly quality_score: number;
+  readonly modules: string[];
+}
+
+export interface SeedExtractionFailure {
+  readonly id: string;
+  readonly url: string;
+  readonly reason: string;
+}
+
+const REQUIRED_CSV_HEADERS = [
+  'id',
+  'track',
+  'module_primary',
+  'module_secondary',
+  'url',
+  'title',
+  'source_name',
+  'author',
+  'published_date',
+  'quality_score',
+  'why_kept',
+  'status',
+  'reject_reason',
+  'notes',
+] as const;
+
+export const MODULE_IDS = MODULE_REGISTRY.map((module) => module.id).sort();
+const MODULE_ID_SET = new Set(MODULE_IDS);
+
+export function resolveCliPath(flagValue: string | undefined, fallbackPath: string): string {
+  return resolve(process.cwd(), flagValue ?? fallbackPath);
+}
+
+export function getArgValue(args: string[], flag: string): string | undefined {
+  const index = args.indexOf(flag);
+  if (index === -1) return undefined;
+  return args[index + 1];
+}
+
+export function parseInteger(value: string, label: string): number {
+  const parsed = Number.parseInt(value, 10);
+  if (!Number.isInteger(parsed)) {
+    throw new Error(`${label} must be an integer, received "${value}"`);
+  }
+  return parsed;
+}
+
+export function readFrozenCsv(filePath: string): FrozenCsvRow[] {
+  const csv = readFileSync(filePath, 'utf8');
+  const rows = parseCsv(csv);
+  const headerRow = rows[0];
+  if (!headerRow) {
+    throw new Error(`CSV is empty: ${filePath}`);
+  }
+
+  const headers = headerRow.map((header, index) => {
+    const cleanHeader = header.trim();
+    return index === 0 ? cleanHeader.replace(/^\uFEFF/, '') : cleanHeader;
+  });
+
+  for (const header of REQUIRED_CSV_HEADERS) {
+    if (!headers.includes(header)) {
+      throw new Error(`CSV is missing required header "${header}"`);
+    }
+  }
+
+  return rows
+    .slice(1)
+    .filter((row) => row.some((cell) => cell.trim().length > 0))
+    .map((row) => {
+      const record = Object.fromEntries(
+        headers.map((header, index) => [header, row[index]?.trim() ?? '']),
+      ) as Record<string, string>;
+
+      return {
+        id: record['id'] ?? '',
+        track: record['track'] ?? '',
+        module_primary: record['module_primary'] ?? '',
+        module_secondary: record['module_secondary'] ?? '',
+        url: record['url'] ?? '',
+        title: record['title'] ?? '',
+        source_name: record['source_name'] ?? '',
+        author: record['author'] ?? '',
+        published_date: record['published_date'] ?? '',
+        quality_score: record['quality_score'] ?? '',
+        why_kept: record['why_kept'] ?? '',
+        status: record['status'] ?? '',
+        reject_reason: record['reject_reason'] ?? '',
+        notes: record['notes'] ?? '',
+      };
+    });
+}
+
+export function loadSeedArticles(filePath: string): SeedArticle[] {
+  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
+  if (!Array.isArray(raw)) {
+    throw new Error(`Seed JSON must be an array: ${filePath}`);
+  }
+
+  return raw.map((item, index) => normalizeSeedArticle(item, index));
+}
+
+export function parseModuleList(value: string): string[] {
+  return value
+    .split(',')
+    .map((moduleId) => moduleId.trim())
+    .filter((moduleId) => moduleId.length > 0);
+}
+

--- scripts/seed-corpus/validate.ts
diff --git a/scripts/seed-corpus/validate.ts b/scripts/seed-corpus/validate.ts
new file mode 100644
index 0000000..9cd1d99
--- /dev/null
+++ b/scripts/seed-corpus/validate.ts
@@ -0,0 +1,119 @@
+/**
+ * Validate seed-articles.json before writing anything to Supabase.
+ *
+ * Usage:
+ *   npm run seed-corpus:validate
+ *   npm run seed-corpus:validate -- --input path/to/seed-articles.json
+ */
+
+import {
+  DEFAULT_SEED_JSON_PATH,
+  MODULE_IDS,
+  assertKnownModules,
+  buildCoverageCounts,
+  getArgValue,
+  loadSeedArticles,
+  normalizeModules,
+  resolveCliPath,
+} from './shared.js';
+
+const MIN_TEXT_LENGTH = 1_500;
+const MAX_TEXT_LENGTH = 50_000;
+const MAX_ARTICLES_PER_SOURCE = 25;
+const MIN_ARTICLES_PER_MODULE = 3;
+
+async function main(): Promise<void> {
+  const args = process.argv.slice(2);
+  const inputPath = resolveCliPath(getArgValue(args, '--input'), DEFAULT_SEED_JSON_PATH);
+  const articles = loadSeedArticles(inputPath);
+
+  const issues: string[] = [];
+  const seenUrls = new Set<string>();
+  const sourceCounts = new Map<string, number>();
+
+  for (let index = 0; index < articles.length; index++) {
+    const article = articles[index]!;
+    const label = `article[${index}]`;
+
+    if (!article.url.trim()) issues.push(`${label} is missing url`);
+    if (!article.title.trim()) issues.push(`${label} is missing title`);
+    if (!article.source_name.trim()) issues.push(`${label} is missing source_name`);
+    if (!article.text.trim()) issues.push(`${label} is missing text`);
+
+    try {
+      void new URL(article.url);
+    } catch {
+      issues.push(`${label} has invalid URL: ${article.url}`);
+    }
+
+    if (!Number.isInteger(article.quality_score) || article.quality_score < 7 || article.quality_score > 10) {
+      issues.push(`${label} has invalid quality_score ${article.quality_score}; expected 7-10`);
+    }
+
+    if (article.text.length < MIN_TEXT_LENGTH) {
+      issues.push(`${label} text is too short (${article.text.length} chars)`);
+    }
+    if (article.text.length > MAX_TEXT_LENGTH) {
+      issues.push(`${label} text is too long (${article.text.length} chars)`);
+    }
+
+    const normalizedModules = normalizeModules(article.modules);
+    if (normalizedModules.length === 0) {
+      issues.push(`${label} has no modules`);
+    }
+    try {
+      assertKnownModules(normalizedModules, label);
+    } catch (err) {
+      issues.push(String(err));
+    }
+
+    if (seenUrls.has(article.url)) {
+      issues.push(`Duplicate URL detected: ${article.url}`);
+    } else {
+      seenUrls.add(article.url);
+    }
+
+    sourceCounts.set(article.source_name, (sourceCounts.get(article.source_name) ?? 0) + 1);
+  }
+
+  const coverage = buildCoverageCounts(articles);
+  for (const moduleId of MODULE_IDS) {
+    const count = coverage.get(moduleId) ?? 0;
+    if (count < MIN_ARTICLES_PER_MODULE) {
+      issues.push(`Coverage gap: module "${moduleId}" has ${count} article(s); expected at least ${MIN_ARTICLES_PER_MODULE}`);
+    }
+  }
+
+  for (const [sourceName, count] of sourceCounts.entries()) {
+    if (count > MAX_ARTICLES_PER_SOURCE) {
+      issues.push(`Source cap exceeded: "${sourceName}" has ${count} articles; max is ${MAX_ARTICLES_PER_SOURCE}`);
+    }
+  }
+
+  const weakestModules = [...coverage.entries()]
+    .sort((a, b) => a[1] - b[1])
+    .slice(0, 5)
+    .map(([moduleId, count]) => `${moduleId}=${count}`)
+    .join(', ');
+
+  console.log(`Validated ${articles.length} seed article(s) from ${inputPath}`);
+  console.log(`Unique URLs: ${seenUrls.size}`);
+  console.log(`Weakest modules: ${weakestModules}`);
+  console.log(`Largest source bucket: ${Math.max(...sourceCounts.values(), 0)}`);
+
+  if (issues.length > 0) {
+    console.error('');
+    console.error(`Validation failed with ${issues.length} issue(s):`);
+    for (const issue of issues) {
+      console.error(`- ${issue}`);
+    }
+    process.exit(1);
+  }
+
+  console.log('Validation passed.');
+}
+
+main().catch((err) => {
+  console.error('Seed validation failed:', err);
+  process.exit(1);
+});


--- seed-articles-frozen.csv
diff --git a/seed-articles-frozen.csv b/seed-articles-frozen.csv
new file mode 100644
index 0000000..f0a82a3
--- /dev/null
+++ b/seed-articles-frozen.csv
@@ -0,0 +1,49 @@
+id,track,module_primary,module_secondary,url,title,source_name,author,published_date,quality_score,why_kept,status,reject_reason,notes
+1,track2,devops,dx,https://github.blog/engineering/engineering-principles/how-github-uses-merge-queue-to-ship-hundreds-of-changes-every-day/,"How GitHub uses merge queue to ship hundreds of changes every day","The GitHub Blog","Will Smythe; Lawrence Gripper",2024-03-06,8,"Explains why GitHub replaced older merge and deploy flow with merge queue and shares scale-specific tradeoffs for hundreds of pull requests per day.",kept,,
+2,track2,dx,devops,https://discord.com/blog/how-discord-moved-engineering-to-cloud-development-environments,"How Discord Moved Engineering to Cloud Development Environments","Discord Engineering","Denbeigh Stevens",2024-02-22,8,"Detailed developer-experience migration from local Macs to cloud dev environments, with concrete tradeoffs around latency, reproducibility, tooling, and org adoption.",kept,,
+3,track2,observability,architecture_patterns,https://discord.com/blog/how-discord-uses-open-source-tools-for-scalable-data-orchestration-transformation,"How Discord Uses Open-Source Tools for Scalable Data Orchestration & Transformation","Discord Engineering","Zach Bluhm",2024-07-12,8,"Production data-platform rebuild with lessons on observability and self-service, including the move that now powers more than 2,000 dbt tables.",kept,,
+4,track2,ai_assisted,"integration,dx",https://discord.com/blog/developing-rapidly-with-generative-ai,"Developing Rapidly with Generative AI","Discord Engineering","Shannon Phu",2024-04-12,8,"Real GenAI product-engineering post covering staged rollout, prototyping, and deployment tradeoffs instead of generic LLM tutorials.",kept,,
+5,track2,error_resilience,"observability,security",https://blog.cloudflare.com/cloudflare-incident-on-june-20-2024/,"Cloudflare incident on June 20, 2024","Cloudflare Blog","Lloyd Wallis; Julien Desgats; Manish Arora",2024-06-26,9,"Strong incident write-up with named systems, a 114-minute outage, 2.1% error peak, and nearly 3x p99 TTFB during failure.",kept,,
+6,track2,observability,devops,https://blog.cloudflare.com/adopting-opentelemetry-for-our-logging-pipeline/,"Adopting OpenTelemetry for our logging pipeline","Cloudflare Blog","Colin Douch; Jayson Cena",2024-06-03,8,"Large-scale observability migration from syslog-ng to OpenTelemetry Collector with custom components, rollout details, and what went wrong.",kept,,
+7,track2,go_patterns,performance,https://blog.cloudflare.com/reclaiming-cpu-for-free-with-pgo/,"Reclaiming CPU for free with Go's Profile Guided Optimization","Cloudflare Blog","Colin Douch",2024-05-14,8,"Production Go optimization story using PGO with measured savings of roughly 71 to 97 CPU cores and a clear build and deploy methodology.",kept,,
+8,track2,architecture_patterns,"performance,concurrency,design_patterns",https://blog.cloudflare.com/how-we-built-cloudflare-queues/,"Durable Objects aren't just durable, they're fast: a 10x speedup for Cloudflare Queues","Cloudflare Blog","Josh Wheeler; Siddhant Sinha; Todd Mantell; Pranshu Maheshwari",2024-10-24,9,"Distributed-systems refactor with before and after metrics: latency from about 200ms to 60ms, throughput from 400 to 5,000 messages per second, and concurrency from 20 to 250.",kept,,
+9,track2,architecture_patterns,"performance,ai_assisted",https://www.linkedin.com/blog/engineering/search/reimagining-linkedins-search-stack,"Reimagining LinkedIn's search tech stack","LinkedIn Engineering Blog","Fedor Borisyuk",2026-01-21,8,"Deep architecture post on LinkedIn's search stack redesign with system-level tradeoffs and large-scale query-serving context.",kept,,
+10,track2,architecture_patterns,"concurrency,performance",https://www.linkedin.com/blog/engineering/infrastructure/introducing-northguard-and-xinfra,"Introducing Northguard and Xinfra: scalable log storage at LinkedIn","LinkedIn Engineering Blog","Onur Karaman; Xiongqi Wu",2025-06-25,9,"New distributed log-storage architecture motivated by Kafka scaling pain at 32T records per day and 17 PB per day, with clear protocol and operability tradeoffs.",kept,,
+11,track2,ai_assisted,"integration,python_patterns,dx",https://www.linkedin.com/blog/engineering/generative-ai/behind-the-platform-the-journey-to-create-the-linkedin-genai-application-tech-stack,"Behind the platform: the journey to create the LinkedIn GenAI application tech stack","LinkedIn Engineering Blog","Karthik Ramgopal; Xiaofeng Wang; Sandeep Jha",2024-11-26,9,"Rare candid GenAI platform post about Python versus Java, LangChain adoption, memory and tooling, and long-term leverage decisions at LinkedIn scale.",kept,,
+12,track2,error_resilience,"performance,concurrency",https://www.uber.com/blog/from-static-rate-limiting-to-intelligent-load-management/,"How Uber Conquered Database Overload: The Journey from Static Rate-Limiting to Intelligent Load Management","Uber Engineering","Dhyanam Vaidya; Prathamesh Deshpande; Mike Ma; Chaitanya Yalamanchili",2026-01-13,9,"Excellent resilience case study with measured wins: 80% higher throughput, about 70% lower p99 latency, about 93% fewer goroutines, and about 60% lower heap under overload.",kept,,
+13,track2,performance,"architecture_patterns,error_resilience",https://www.uber.com/blog/how-uber-serves-over-150-million-reads/,"How Uber Serves over 150 Million Reads per Second from Integrated Cache with Stronger Consistency Guarantees","Uber Engineering","Preetham Narayanareddy; Eli Pozniansky",2025-08-26,9,"Cache-consistency architecture post at extreme scale, covering more than 150 million reads per second and tradeoffs between hit rate, invalidation, and correctness.",kept,,
+14,track2,ai_assisted,"security,testing",https://www.uber.com/blog/ureview/,"uReview: Scalable, Trustworthy GenAI for Code Review at Uber","Uber Engineering","Shauvik Roy Choudhary; Sonal Mahajan; Will Bond",2025-08-12,9,"High-signal AI-assisted engineering post with real adoption numbers: 90% of weekly about 65,000 diffs analyzed, 75% useful comments, and 1,500 hours saved per week.",kept,,
+15,track2,go_patterns,"performance,ai_assisted",https://www.uber.com/blog/perfinsights/,"PerfInsights: Detecting Performance Optimization Opportunities in Go Code using Generative AI","Uber Engineering","Ryan Hang; Sung Whang; Joseph Wang",2025-07-22,9,"Go-specific performance tooling post with production profiles, LLM validation layers, and measurable reductions in false positives and engineering effort.",kept,,
+16,track2,testing,"integration,dx",https://github.blog/engineering/engineering-principles/how-githubs-developer-experience-team-improved-innerloop-development/,"How GitHub's Developer Experience team improved innerloop development","The GitHub Blog","Belal Taher",2024-01-24,8,"Good production post on integration testing in a distributed microservice ecosystem, including the tooling tradeoffs GitHub made to speed the inner loop.",kept,,
+17,track2,testing,"performance,devops",https://github.blog/2024-06-03-how-github-reduced-testing-time-for-ios-apps-with-new-runner-features/,"How GitHub reduced testing time for iOS apps with new runner features","The GitHub Blog","Eli Perkins",2024-06-03,8,"Concrete CI and runner story about build and test acceleration for a real mobile app, grounded in measurable workflow improvements.",kept,,
+18,track2,api_design,"integration,dx",https://stripe.com/blog/introducing-stripes-new-api-release-process,"Introducing Stripe's new API release process","Stripe Blog","Michael Glukhovsky; Wissam Abirached",2024-10-01,8,"Strong API-evolution piece with explicit versioning and release-cadence tradeoffs aimed at making large integrations safer and more predictable.",kept,,
+19,track2,security,"observability,error_resilience",https://engineering.fb.com/2024/11/12/security/how-meta-built-large-scale-cryptographic-monitoring/,"How Meta built large-scale cryptographic monitoring","Engineering at Meta","Hussain Humadi; Sasha Frolov; Rafael Misoczki; Siddhartha Khetawat; Dong Wu",2024-11-12,9,"Detailed security engineering post on monitoring cryptography use at fleet scale to catch weak algorithms, support migrations, and protect reliability.",kept,,
+20,track2,java_patterns,"type_system,evolutionary",https://engineering.fb.com/2024/12/18/android/translating-java-to-kotlin-at-scale/,"Translating Java to Kotlin at Scale","Engineering at Meta","Jocelyn Luizzi; Jingbo Yang; Eve Matthaey",2024-12-18,9,"Large migration story covering roughly ten million lines of Java, null-safety tradeoffs, custom tooling, and the realities of incremental modernization.",kept,,
+21,track2,python_patterns,"type_system,dx",https://engineering.fb.com/2025/05/15/developer-tools/introducing-pyrefly-a-new-type-checker-and-ide-experience-for-python/,"Introducing Pyrefly: A new type checker and IDE experience for Python","Engineering at Meta","Meta Engineering",2025-05-15,8,"Python tooling article with real scale constraints, showing why Meta rebuilt its type-checking stack for IDE speed, incrementality, and large codebases.",kept,,
+22,track2,react_patterns,"performance,dx",https://react.dev/blog/2024/10/21/react-compiler-beta-release,"React Compiler Beta Release","React Blog","Lauren Tan",2024-10-21,8,"Relevant React production write-up because it includes rollout details from Meta apps, a 100k-plus component monorepo context, and practical adoption guidance.",kept,,
+23,track2,design_patterns,"concurrency,python_patterns",https://www.linkedin.com/blog/engineering/infrastructure/how-design-patterns-power-linkedin-infrastructure,"Navigating the scale: how design patterns power LinkedIn's infrastructure","LinkedIn Engineering Blog","Saira Khanum",2024-11-07,9,"Exactly the kind of production design-pattern article we need: producer-consumer at LinkedIn scale with tradeoffs, queues, workers, and locking behavior.",kept,,
+24,track2,dependency_health,"dx,security",https://engineering.fb.com/2024/02/06/developer-tools/dotslash-simplified-executable-deployment/,"DotSlash: Simplified executable deployment","Engineering at Meta","Michael Bolin; Andres Suarez",2024-02-06,9,"Useful supply-chain and tool-distribution post about versioned executable delivery, provenance, cache behavior, and reducing heavy dependency deployment pain.",kept,,
+25,track2,evolutionary,"devops,security,dependency_health",https://www.linkedin.com/blog/engineering/architecture/navigating-the-transition-adopting-azure-linux-as-linkedins-operatingsystem,"Navigating the transition: adopting Azure Linux as LinkedIn's operating system","LinkedIn Engineering Blog","Ievgen Priadka; Sweekar Pinto; Bubby Rayber",2024-08-19,9,"High-signal migration case study covering fleetwide OS evolution, security-update constraints, and bootstrap time dropping from over an hour to 10-30 minutes.",kept,,
+26,track2,evolutionary,"integration,design_patterns",https://www.linkedin.com/blog/engineering/infrastructure/journey-of-next-generation-control-plane-for-data-systems,"Journey of next generation control plane for data systems","LinkedIn Engineering Blog","Aashish Nagpal; Nishant Satya Lakshmikanth; Ramnik Bhatia; Vivek Subramaniam",2025-03-21,9,"Strong platformization story about evolving Nuage into a control plane, with measurable latency gains and clear resource-management tradeoffs.",kept,,
+27,track2,complexity,"dx,architecture_patterns",https://engineering.fb.com/2024/12/19/developer-tools/glean-open-source-code-indexing/,"Indexing code at scale with Glean","Engineering at Meta","Simon Marlow; Pepe Iborra",2024-12-19,8,"Valuable article on reducing codebase comprehension complexity through centralized indexing, shared facts, and distributed query architecture.",kept,,
+28,track2,security,"integration,performance",https://discord.com/blog/meet-dave-e2ee-for-audio-video,"Meet DAVE: Discord's New End-to-End Encryption for Audio & Video","Discord Engineering","Stephen Birarda",2024-09-17,9,"Security architecture deep dive with explicit protocol goals, scalability constraints, rollout mechanics, and tradeoffs for real-time encrypted media at Discord.",kept,,
+29,track2,type_system,"python_patterns,dx",https://engineering.fb.com/2024/12/09/developer-tools/typed-python-2024-survey-meta/,"Typed Python in 2024: Well adopted, yet usability challenges persist","Engineering at Meta","Aaron Pollack",2024-12-09,8,"Survey-backed practitioner piece with more than 1,000 responses on why teams use Python typing, where tooling hurts, and what blocks broader adoption.",kept,,
+30,track2,react_patterns,"performance,complexity,js_advanced",https://react.dev/blog/2024/02/15/react-labs-what-we-have-been-working-on-february-2024,"React Labs: What We've Been Working On - February 2024","React Blog","Joseph Savona; Ricky Hanlon; Andrew Clark; Matt Carroll; Dan Abramov",2024-02-15,8,"High-signal React engineering update that grounds compiler adoption in real production rollout, and explicitly frames manual memoization as a complexity and performance tradeoff.",kept,,
+31,track2,react_patterns,"performance,clean_code,js_advanced",https://react.dev/blog/2025/10/07/react-compiler-1,"React Compiler v1.0","React Blog","Lauren Tan; Joe Savona; Mofei Zhang",2025-10-07,9,"Production-focused React article with concrete wins up to 12% faster loads and 2.5x faster interactions, while reducing memoization boilerplate and catching rules violations.",kept,,
+32,track2,react_patterns,"performance,dx",https://engineering.fb.com/2024/10/02/android/react-at-meta-connect-2024/,"React at Meta Connect 2024","Engineering at Meta","Blair Vanderhoof; Jesse Watts-Russell; Fernando Gorodscy; Matt Galloway; Eli White",2024-10-02,8,"Strong multi-product React case study covering code sharing, performance tuning, and cross-platform delivery across Quest, Horizon, and desktop tools at Meta scale.",kept,,
+33,track2,clean_code,"testing,complexity",https://github.blog/developer-skills/github/how-to-review-code-effectively-a-github-staff-engineers-philosophy/,"How to review code effectively: A GitHub staff engineer's philosophy","The GitHub Blog","Sarah Vessels",2024-07-23,8,"Practical clean-code article from a staff engineer who reviewed more than 7,000 pull requests, with concrete tradeoffs around blockers, tests, and review quality.",kept,,
+34,track2,clean_code,"testing,complexity",https://github.blog/news-insights/research/does-github-copilot-improve-code-quality-heres-what-the-data-says/,"Does GitHub Copilot improve code quality? Here's what the data says","The GitHub Blog","Jared Bauer",2024-11-18,9,"Evidence-backed code-quality study: Copilot users had a 53.2% higher likelihood of passing all tests and produced 13.6% more lines per readability error.",kept,,
+35,track2,clean_code,"testing,complexity,ai_assisted",https://github.blog/ai-and-ml/github-copilot/60-million-copilot-code-reviews-and-counting/,"60 million Copilot code reviews and counting","The GitHub Blog","Ria Gopu; David Apirian",2026-03-05,8,"Shows how GitHub tuned AI code review for signal over noise, including 71% of reviews surfacing actionable feedback and explicit tradeoffs between latency and review quality.",kept,,
+36,track2,elixir_patterns,"concurrency,architecture_patterns",https://fly.io/phoenix-files/world-page-speed-test-elastic-scale-with-flame/,"World Page Speed Test - planet-wide elastic scale with FLAME","The Phoenix Files","Chris McCord",2024-05-08,8,"Elixir-specific production article on using FLAME and the BEAM for elastic multi-region execution, with concrete concurrency and scaling design lessons.",kept,,
+37,track2,elixir_patterns,"integration,python_patterns",https://dashbit.co/blog/running-python-in-elixir-its-fine,"Embedding Python in Elixir, it's Fine","Dashbit Blog","Jonatan Klosko",2025-02-21,8,"Candid language-integration post that explains why Dashbit embedded Python into Elixir, including the safety and interoperability tradeoffs around NIFs versus other approaches.",kept,,
+38,track2,elixir_patterns,"type_system,evolutionary",https://dashbit.co/blog/data-evolution-with-set-theoretic-types,"Data evolution with set-theoretic types","Dashbit Blog","Jose Valim",2025-01-14,8,"Language-design article that tackles backward-compatible data evolution with explicit type-system tradeoffs, useful seed material for Elixir-specific reasoning.",kept,,
+39,track2,go_patterns,performance,https://www.uber.com/blog/automating-efficiency-of-go-programs-with-pgo/,"Automating Efficiency of Go programs with Profile-Guided Optimizations","Uber Engineering","Yufan Xu; Shauvik Roy Choudhary; Chris Zhang; Milind Chabbi",2025-03-13,9,"Excellent Go performance post with fleet-scale deployment details, about 4% gains, and a reduction of 24,000 CPU cores across top services.",kept,,
+40,track2,java_patterns,"dx,performance",https://engineering.fb.com/2025/08/26/open-source/enabling-kotlin-incremental-compilation-on-buck2/,"Enabling Kotlin incremental compilation on Buck2","Engineering at Meta","Iveta Kovalenko",2025-08-26,9,"Great JVM-tooling article on bringing Kotlin incremental compilation to Buck2, with critical modules building up to 3x faster and average developer builds improving about 30%.",kept,,
+41,track1,api_design,"integration,design_patterns",https://slack.engineering/how-we-design-our-apis-at-slack/,"How We Design Our APIs at Slack","Engineering at Slack","Saurabh Sahni; Taylor Singletary",2021-08-11,9,"Still one of the clearest production API-design articles around, with concrete scale pain from large payloads and explicit principles for evolving developer-facing APIs.",kept,,classic pre-2024 exception; keep unless we find a fresher official equivalent
+42,track1,api_design,"integration,evolutionary",https://slack.engineering/evolving-the-slack-api/,"Evolving the Slack API","Engineering at Slack","Brenda Jin",2018-01-25,9,"Canonical API-evolution write-up showing how Slack redesigned its Conversations API to preserve backwards compatibility while fixing old platform constraints.",kept,,classic pre-2024 exception; keep unless we find a fresher official equivalent
+43,track2,dependency_health,"design_patterns,evolutionary",https://engineering.fb.com/2025/10/16/developer-tools/branching-in-a-sapling-monorepo/,"Branching in a Sapling Monorepo","Engineering at Meta","Meta Engineering",2025-10-16,8,"Useful monorepo article on balancing branching strategy with unified dependency management, large-scale refactoring, and version drift in a huge codebase.",kept,,
+44,track2,java_patterns,"performance,devops",https://quarkus.io/blog/mmaler-blogpost-1-intro/,"Optimizing Java for the Cloud-Native Era with Quarkus","Quarkus Blog","Michal Mickey Maler",2025-04-10,8,"Strong cloud-native Java article that explains why teams adopt Quarkus for fast startup, lighter footprint, and Kubernetes-friendly operations, backed by real user-story tradeoffs.",kept,,
+45,track2,js_advanced,performance,https://discord.com/blog/how-discord-seamlessly-upgraded-millions-of-users-to-64-bit-architecture,"How Discord Seamlessly Upgraded Millions of Users to 64-bit Architecture","Discord Engineering","Jesse O'Brien",2024-12-13,8,"Useful low-level JavaScript platform story about Electron and V8 migration tradeoffs, memory ceilings, native-module constraints, and real user-impact at Discord scale.",kept,,
+46,track2,go_patterns,error_resilience,https://blog.cloudflare.com/go-and-enhance-your-calm/,"Go and enhance your calm: demolishing an HTTP/2 interop problem","Cloudflare Blog","Lucas Pardue; Zak Cutner",2025-10-31,8,"Go production debugging story about HTTP/2 interoperability, with a concrete failure mode that triggered Cloudflare defenses and a precise remediation in the client.",kept,,
+47,track2,error_resilience,"go_patterns,devops",https://blog.cloudflare.com/improving-platform-resilience-at-cloudflare/,"Improving platform resilience at Cloudflare through automation","Cloudflare Blog","Opeyemi Onikute",2024-10-09,8,"Production reliability post on self-healing infrastructure, auto-remediation, and how Cloudflare reduces toil while recovering from predictable failures at scale.",kept,,
+48,track2,go_patterns,performance,https://blog.cloudflare.com/how-we-found-a-bug-in-gos-arm64-compiler/,"How we found a bug in Go's arm64 compiler","Cloudflare Blog","Thea Heinen",2025-10-08,9,"Excellent Go incident-analysis article where Cloudflare's fleet scale exposed a rare compiler race condition and drove a root-cause investigation down to assembly.",kept,,


--- seed-articles.json
diff --git a/seed-articles.json b/seed-articles.json
new file mode 100644
index 0000000..ecbab5a
--- /dev/null
+++ b/seed-articles.json
@@ -0,0 +1,491 @@
+[
+  {
+    "url": "https://github.blog/engineering/engineering-principles/how-github-uses-merge-queue-to-ship-hundreds-of-changes-every-day/",
+    "title": "How GitHub uses merge queue to ship hundreds of changes every day",
+    "source_name": "The GitHub Blog",
+    "text": "Here’s how merge queue transformed the way GitHub deploys changes to production at scale, so you can do the same for your organization. March 6, 2024 | 7 minutes Share: At GitHub, we use merge queue to merge hundreds of pull requests every day. Developing this feature and rolling it out internally did not happen overnight, but the journey was worth it—both because of how it has transformed the way we deploy changes to production at scale, but also how it has helped improve the velocity of customers too. Let’s take a look at how this feature was developed and how you can use it, too. Why we needed merge queue In 2020, engineers from across GitHub came together with a goal: improve the process for deploying and merging pull requests across the GitHub service, and specifically within our largest monorepo. This process was becoming overly complex to manage, required special GitHub-only logic in the codebase, and required developers to learn external tools, which meant the engineers developing for GitHub weren’t actually using GitHub in the same way as our customers. To understand how we got to this point in 2020, it’s important to look even further back. By 2016, nearly 1,000 pull requests were merging into our large monorepo every month. GitHub was growing both in the number of services deployed and in the number of changes shipping to those services. And because we deploy changes prior to merging them, we needed a more efficient way to group and deploy multiple pull requests at the same time. Our solution at this time was trains . A train was a special pull request that grouped together multiple pull requests (passengers) that would be tested, deployed, and eventually merged at the same time. A user (called a conductor) was responsible for handling most aspects of the process, such as starting a deployment of the train and handling conflicts that arose. Pipelines were added to help manage the rollout path. Both these systems (trains and pipelines) were only used on our largest monorepo and were implemented in our internal deployment system. Trains helped improve velocity at first, but over time started to negatively impact developer satisfaction and increase the time to land a pull request. Our internal Developer Experience (DX) team regularly polls our developers to learn about pain points to help inform where to invest in improvements. These surveys consistently rated deployment as the most painful part of the developer’s daily experience, highlighting the complexity and friction involved with building and shepherding trains in particular. This qualitative data was backed by our quantitative metrics. These showed a steady increase in the time it took from pull request to shipped code. Trains could also grow large, containing the changes of 15 pull requests. Large trains frequently “derailed” due to a deployment issue, conflicts, or the need for an engineer to remove their change. On painful occasions, developers could wait 8+ hours after joining a train for it to ship, only for it to be removed due to a conflict between two pull requests in the train. Trains were also not used on every repository, meaning the developer experience varied significantly between different services. This led to confusion when engineers moved between services or contributed to services they didn’t own, which is fairly frequent due to our inner source model. In short, our process was significantly impacting the productivity of our engineering teams—both in our large monorepo and service repositories. Building a better solution for us and eventually for customers By 2020, it was clear that our internal tools and processes for deploying and merging across our repositories were limiting our ability to land pull requests as often as we needed. Beyond just improving velocity, it became clear that our new solution needed to: Improve the developer experience of shipping. Engineers wanted to express two simple intents: “I want to ship this change” and “I want to shift to other work;” the system should handle the rest. Avoid having problematic pull requests impact everyone. Those causing conflicts or build failures should not impact all other pull requests waiting to merge. The throughput of the overall system should be favored over fairness to an individual pull request. Be consistent and as automated as possible across our services and repositories. Manual toil by engineers should be removed wherever possible. The merge queue project began as part of an overall effort within GitHub to improve availability and remove friction that was preventing developers from shipping at the frequency and level of quality that was needed. Initially, it was only focused on providing a solution for us, but was built with the expectation that it would eventually be made available to customers. By mid-2021, a few small, internal repositories started testing merge queue, but moving our large monorepo would not happen until the next year for a few reasons. For one, we could not stop deploying for days or weeks in order to swap systems. At every stage of the project we had to have a working system to ship changes. At a maximum, we could block deployments for an hour or so to run a test or transition. GitHub is remote-first and we have engineers throughout the world, so there are quieter times but never a free pass to take the system offline. Changing the way thousands of developers deploy and merge changes also requires lots of communication to ensure teams are able to maintain velocity throughout the transition. Training 1,000 engineers on a new system overnight is difficult, to say the least. By rolling out changes to the process in phases (and sometimes testing and rolling back changes early in the morning before most developers started working) we were able to slowly transition our large monorepo and all of our repositories responsible for production services onto merge queue by 2023. How we use merge queue today Merge queue has become the single entry point for shipping code changes at GitHub. It was designed and tested at scale, shipping 30,000+ pull requests with their associated 4.5 million CI runs, for GitHub.com before merge queue was made generally available . For GitHub and our “deploy the merge process,” merge queue dynamically forms groups of pull requests that are candidates for deployment, kicks off builds and tests via GitHub Actions, and ensures our main branch is never updated to a failing commit by enforcing branch protection rules. Pull requests in the queue that conflict with one another are automatically detected and removed, with the queue automatically re-forming groups as needed. Because merge queue is integrated into the pull request workflow (and does not require knowledge of special ChatOps commands, or use of labels or special syntax in comments to manage state), our developer experience is also greatly improved. Developers can add their pull request to the queue and, if they spot an issue with their change, leave the queue with a single click. We can now ship larger groups without the pitfalls and frictions of trains. Trains (our old system) previously limited our ability to deploy more than 15 changes at once, but now we can now safely deploy 30 or more if needed. Every month, over 500 engineers merge 2,500 pull requests into our large monorepo with merge queue, more than double the volume from a few years ago. The average wait time to ship a change has also been reduced by 33% . And it’s not just numbers that have improved. On one of our periodic developer satisfaction surveys, an engineer called merge queue “one of the best quality-of-life improvements to shipping changes that I’ve seen a GitHub!” It’s not a stretch to say that merge queue has transformed the way GitHub deploys changes to production at scale. How to get started Merge queue is available to public repositories on GitHub.com owned by organizations and to all repositories on GitHub Enterprise (Cloud or Server). To learn more about merge queue and how it can help velocity and developer satisfaction on your busiest repositories, see our blog post, GitHub merge queue is generally available . Tags: Collaboration Core productivity developer experience GitHub Enterprise How GitHub builds GitHub pull requests Related posts We do newsletters, too Discover tips, technical guides, and best practices in our biweekly newsletter just for devs. Your email address",
+    "quality_score": 8,
+    "modules": [
+      "devops",
+      "dx"
+    ]
+  },
+  {
+    "url": "https://discord.com/blog/how-discord-moved-engineering-to-cloud-development-environments",
+    "title": "How Discord Moved Engineering to Cloud Development Environments",
+    "source_name": "Discord Engineering",
+    "text": "Engineering & Developers Denbeigh Stevens February 22, 2024 Introduction If you've been following our previous engineering blog posts , you'll know that building and maintaining Discord is a complex task. Our software development takes place in a polyglot mono-repo, where Python, Typescript, Rust, Elixir, and C/C++ are the most actively developed languages. We also develop and ship products for all major platforms including Android, iOS, MacOS, Windows, and Linux. The Internal Developer Experience team is responsible for roughly the first third of the Software Development Life Cycle. Our main tasks include building and maintaining IDE experiences, managing development environments, shipping tools for building, developing, and testing code, scaling and maintaining CI infrastructure, and owning the change management process and supporting tooling infrastructure. While we could delve deeper into any of these topics, this blog post focuses on how we transitioned all backend and infrastructure development to a Linux-based Cloud Development Environment, thanks to the team over at Coder . Background Over the past few years, Discord's engineering organization has gone through rapid growth and more than tripled in size. Discord operates as a hybrid company with a physical office in San Francisco and the Netherlands, but our engineering team primarily operates remotely. Most of our developers use MacBooks. Before transitioning to remote development machines, we ensured that engineers could fully stand up Discord on both Mac and Ubuntu machines, and created custom tools to provision laptops using Homebrew. However, we encountered several issues where a brew upgrade could halt a developer in their tracks. We resolved many of these issues by hard-pinning every software package and transitive dependency, although this made it more difficult to install arbitrary software packages. We have since moved from Homebrew to Nix for installing system dependencies, allowing engineers to use Homebrew as needed. Our local service orchestration tools have also evolved. We began with Makefiles and procfiles, but quickly outgrew this system. We experimented with Docker and docker-compose, but for various reasons, this did not work for us. At that time, the performance on docker-for-Mac performance was subpar, and the added friction in the (re)-build loop led us to seek faster, simpler solutions. We eventually moved to a supervisor -based system and developed tools to easily define and run services and dependencies. However, not using containers in the development loop comes with trade-offs. Managing two non-reproducible environments became a significant burden for the tooling teams. We often found ourselves debugging niche and unique issues to unblock engineers. As the company continued to grow, it became clear that we needed to focus on a single Linux-based development environment. This led us to explore Cloud Developer Environments (CDEs) and eventually evaluate Coder. Cloud Development Environments Shifting development to VMs hosted on a cloud provider yields numerous benefits, such as immutability, reproducibility, configurability, enhanced security, and built-in IAM. Additionally, it provides access to a broader range of tooling and automation options to manage and maintain the environments. A core requirement for CDEs to even be viable is a good editor and dev loop experience. Fortunately, VS Code’s remote development extension was stable and offered a robust experience. Most engineers at Discord used VSCode, so we felt the experience was good enough to embark on this journey. Reproducible and consistent environments are critical for a stable experience. Although a completely immutable environment would be theoretically ideal, it's just not practical. We chose to mount and preserve the /home directory across restarts, allowing developers to pick up exactly where they left off. This provides a space for storing repos, dotfiles, personal tools, and for customizing their workspace. While this approach deviates from some immutability principles and can introduce potential issues, we can still update the template and image without needing a full workspace rebuild, giving us the best of both worlds. While there are many benefits to CDEs, it's important to acknowledge the drawbacks. Notably, no solution can rival the performance of working on localhost, and the added latency from working over SSH can be substantial. In unstable network conditions, latency, connection drops, and a generally degraded experience were reported. Sending large HTML and JavaScript bundles over the network adds significant time to critical save and rebuild loops. Consequently, many engineers prefer to do their frontend work on their local laptops and backend work on their remote machines. This approach necessitates a \"split-brain\" repository or code syncing between the laptop and remote machine when changes to both API and UI code are necessary. This increases cognitive load and is certainly not an ideal situation. Still, even with these tradeoffs, we firmly believed the benefits outweigh the negatives! Coder Our initial engagement with Coder began in late 2020. At the time, Coder was a small engineering team, and they were avid Discord users. Their early product was entirely Kubernetes native, which appealed to us as Discord is a heavy Kubernetes user. Considering the time and effort to build a similar solution with the features we needed, evaluating Coder’s product was an obvious decision. Feature-wise, Coder provides all the bells and whistles you'd expect and the team recently rebuilt their product from the ground up, addressing many of the issues we had experienced in our early engagement. Notably, we encountered many issues using Kubernetes and containers as the main development environment. Developing Discord requires a highly complex environment with many moving parts, and as we found, developing in a Sysbox environment made it challenging to maintain and debug the various issues across the many layers of virtualization. Additionally, we saw issues with noisy neighbors, lag spikes, and higher-than-expected latency. In 2023, we moved to Coder’s V2 product which gives us the power to deliver VMs to developers, largely solving most of our problems. Another notable change in their V2 product was a rewrite of their networking stack, which now leverages Tailscale & WireGuard for much more stable, secure, and performant networking. Moving to VMs gives us full access to the host and has drastically simplified the architecture, resulting in a stable and fast environment. After the migration to V2, we received a ton of feedback from engineers that development generally felt faster and smoother. Additionally, we no longer see support tickets and questions about high latency and connection drops. These are huge wins across the board. So, how did the migration go? Our transition from local development on MacBooks to using Coder was a journey full of learning and adaptation. Here's a detailed account of our migration process, the lessons we learned, and what we would do differently if we were to do it again. The Migration The (very) simplified migration plan looked like this: Solidify the experience - default experience should “just work” Increase broader adoption - small tests with developers, collect representative feedback, then move to open beta Hard cutoff - solid docs, wider training, support channels, and fully deprecate backend dev on MacBooks Our migration started with the “easy” work of creating the dev container, installing system dependencies, setting up user accounts, permissions, and any pre-existing software that needed to be installed. Investing a little into our own automation to make our feedback loops fast was important for velocity during this time. I said “easy” work above, because these types of migrations are not just technical problems, but largely people problems. It’s easy to miss how much work it takes to execute a large migration impacting the entire engineering org. We needed to understand what kinds of experiences people would be missing, what they would need to learn, and where they would feel the most pain. We conducted interviews, got early feedback, and of course, dogfooded the environment ourselves. To gain widespread adoption within the company, we identified and recruited \"champions\" from various departments who were enthusiastic about tooling. These individuals helped test the new environment and provided regular feedback. The diversity in day-to-day loops and needs was crucial, as it allowed us to identify a wide range of issues that could arise during daily development. We found numerous issues through this process and collaborated closely with these early beta testers to address their concerns. We benchmarked different build tools, conducted network load tests, and ensured that the most common development loops remained functional and efficient. We believe that if we develop and deliver tools that enhance engineering experiences, developers will be naturally incentivized to adopt the new functionality. We understood a hard cutover date would be required since there will always be some who resist change, but we strived to offer such a compelling experience that people would opt to transition independently. Of course, we nudged people to try Coder when their MacBooks had issues, but we saw a reassuring number of individuals willing to experiment with the remote environment. With the arrival of Apple’s M1 ARM-based silicon, we accelerated our timeline and decided to move quicker on the cutoff date. New M1 laptops were starting to ship to developers and we found several issues running our backend stack on the new hardware. Rosetta emulation worked for some applications, but not all. When we discovered that the only new hardware available was Apple Silicon, we decided to fast-track milestone 3, deprecate MacOS-based backend development, and choose an accelerated timeline for the transition. Lessons Learned We learned that emulating a development machine in a container running in Kubernetes is challenging. For instance, running privileged containers was not an option for us, so we had to find unique solutions for changing kernel parameters in development. This posed difficulties in running applications like Scylla, which required kernel modules or kernel parameter updates. We solved this by having a privileged daemon on each node to set kernel parameters for the underlying host. However, we faced other issues and, in retrospect, could have identified these problems and planned for them in advance. It's a given, but we also learned how much developers value responsiveness. If developers can type faster than the system can render, it can disrupt their workflow. We also recognized the importance of a smooth onboarding process, especially for developers not comfortable with the command line. We added documentation, training materials, recorded videos, and created rich default dotfiles for those that don’t come with many years of highly tuned tools. We spent a considerable amount of time on this “last-mile” work, but it still felt insufficient to meet everyone's needs. What We Would Do Differently The primary issue that emerged after the migration was around networking latency and connection drops. Given our highly-distributed environment with engineers working across the US and in various other locations, it was challenging to anticipate the worst-case scenarios. Although we leveraged Coder's early satellite feature to establish Kubernetes clusters in different regions and reduce latency, some developers still encountered significant performance issues. In retrospect, we should have developed better tooling to understand, diagnose, and troubleshoot these issues under different networking conditions as they occurred. While we did eventually create these tools, they came after the migration, leaving us somewhat in the dark. Most of these issues have been resolved thanks to a rebuilt networking stack and the switch to VMs. However, an early focus on these issues would have equipped us with the knowledge to better understand the user experience. For any large-scale migrations, it's crucial to significantly invest in communication and documentation. Requesting all of your engineers to overhaul their entire development workflow is a major ask. Although we communicated the change in all-hands meetings, signaled the change in advance, and held an extensive beta testing period, we still feel we could have done more to ensure a smoother transition. Despite the challenges and the need for two migrations (Mac→V1→V2), our move to remote dev machines using Coder has been remarkably successful. The timing was fortuitous, as we embarked on this journey before the pandemic began. Now, with a highly distributed Discord engineering team across the US, we are incredibly grateful for our partnership with Coder. It has provided our developers with a more consistent and reliable development environment and while it was a significant investment for the company, it’s one we would make again. Denbeigh Stevens Build, Dev, Test, and the Kitchen Sink at Discord related articles . Search",
+    "quality_score": 8,
+    "modules": [
+      "dx",
+      "devops"
+    ]
+  },
+  {
+    "url": "https://discord.com/blog/how-discord-uses-open-source-tools-for-scalable-data-orchestration-transformation",
+    "title": "How Discord Uses Open-Source Tools for Scalable Data Orchestration & Transformation",
+    "source_name": "Discord Engineering",
+    "text": "Engineering & Developers Zach Bluhm July 12, 2024 At Discord, we take pride in making data-driven decisions to deliver a great experience for users around the world. As our platform and user base have grown over the years, so have the demands on our data orchestration system. Until recently, we’ve been using Derived , an in-house orchestration system that’s provided the foundation for Discord’s data analytics over the last five years. As our data organization grew, it became apparent that both self-service and top-notch observability would be key for our ability to effectively scale as a team. To continue delivering seamless service and insightful data analytics, we embraced an ambitious project: to overhaul our data orchestration infrastructure using modern, open-source tools . Keep reading to learn about how we embarked on this journey, the candid lessons we learned along the way, and how our new system is powering over 2000 dbt tables today. Reflecting on Derived Derived was originally engineered in-house to fulfill our requirements when we used to have a relatively smaller user base and a more manageable data volume. It played its part well during our earlier days, but our flexibility and observability requirements have substantially increased over time. Similarly, where we previously relied on software engineers to manage the system, the intent now is to foster greater self-service and maintain a more user-friendly design. While Derived was instrumental in providing advanced features and setting a foundation of expectations for data transformation systems at Discord, it missed the mark in offering usability and flexibility. We had outgrown our system, which led us to the next iteration of our data transformation journey. If you’d like to learn about Derived and how it worked, check out a previous blog post written here Dagster & dbt: a match made in heaven There’s been a lot of innovation in the data orchestration space since Airflow, an orchestration platform created by Airbnb, was open-sourced back in 2015. Today, a Google search for “open source data orchestration tool” will net you things like Argo, Prefect, Dagster, Kestra, and Mage to name a few. On the modeling side, you’ll find tools like dbt, Coalesce, and SQLMesh. The breadth of functionality around dbt made it a straightforward pick for our data modeling tool. However, our team had to spend a bit of extra time to find the right data orchestrator that would help solve the pain points that both our customers and our team were experiencing with Derived. There were a few key criteria we felt were imperative during our search: Declarative automation: there was conviction around this being a necessary component of our self-service model. It helped enable the types of flexibility our users were accustomed to in our old system. A modern UI that provided a “single pane of glass” for our data engineers and data scientists. In the ideal world, this would allow for total data asset self-service, from observability to operations. Reliability and scalability: running orchestration workloads on Kubernetes is tried and true, and we felt strongly that any serious contender needed to work with Kubernetes to be considered. Integration with existing tooling: How quickly and easily can our existing Airflow jobs, CI/CD scaffolds and data quality solutions be migrated over without too much disruption? Ultimately, our team landed on a combination of Dagster and dbt . While Dagster was a newer kid on the block and was less battle-proven than airflow, it hit the mark on our four criteria above: It provided out-of-the-box support for deployment and execution on Kubernetes , had built-in support for declarative automation , and provided a UI that allowed data producers and consumers to quickly understand the state of their data assets. Plus, its airflow integration and Python APIs meant migrating over existing jobs would be less of a burden. Although it wasn't part of our initial requirements, we were pleasantly surprised by how straightforward it was to run Dagster locally. Our developers and pilot testers were able to create a mock environment locally that enabled them to get a good sense of how the Dagster API functioned and how our use case would fit into it. There is some inherent risk with betting on newer technologies, but Discord is no stranger to moving fast and leveraging the bleeding edge . Dagster’s openness to work with us and build out new functionality to handle our scale gave us the confidence to ultimately move forward and break ground on the new system. Breaking ground on our new data transformation system Building out our new system was a journey — one that had a healthy balance of both technical challenges and “aha” moments as things “just worked”. Thanks to Dagster’s out-of-the-box support for deploying to Kubernetes, we were able to get things running quickly. Integrating dbt with Dagster using software-defined assets felt natural and quickly became a standard part of our team’s nomenclature: off-the-bat, our team made the crucial decision to utilize dbt mainly for SQL templating, managing data quality tests, configuring asset metadata, and execution of queries. Dagster would be the true “brain” behind the orchestration and would be responsible for things running in the correct order. We decided to schedule our entire DAG using Dagster's declarative automation mechanism, triggered by scheduled runs that monitored our raw data layer. The declarative nature of this scheduling allows our data producers to easily create dependencies between wildly varying partition definitions (think “hourly → daily”) without having to implement custom logic. Learn more about declarative automation and how it differs from cron-based scheduling here . With these decisions in place, we focused on building out a minimum lovable product to enable our data engineering crew to begin modeling our new data architecture in parallel as soon as possible. This allowed for fast feedback on the new mechanisms we were building into the system, including components such as custom partition mappings, dbt test execution, and custom dbt model configurations. It took a couple of tries to get right from both a user interface and functionality perspective, but ultimately we engineered a system that combined the advanced modeling capabilities of dbt with the cutting-edge scheduling and out-of-the-box visibility provided by Dagster. Hourly data maps to daily models with ease, requiring no additional effort from data producers We eventually realized that we could leverage Dagster Labs' Hybrid Cloud offering, Dagster+ , to enable our small and mighty team to move faster. This decision offloaded a lot of the time we spent on correctly configuring infrastructure and debugging behind-the-scenes issues, letting us focus on what mattered most: data orchestration. Plus, features included in Dagster+, such as SSO and branch deployments, gave our new system a final layer of polish that enhanced both our productivity and the overall quality of our data workflows. Lessons learned While we were getting our new systems established, there were a couple of issues we identified early on that we knew would have to be solved before we could enable the system in production. For one, dbt did not support parallelism well . For incremental models, dbt stores data in a temporary table before merging the processed partitions in its production location. This created a race condition when multiple instances of dbt run were initiated for the same model, as dbt would try to delete the temporary table once it was completed. We solved this by adjusting dbt’s logic for storing temporary data, which enabled us to run multiple partitions of the same asset in parallel. Second, backfilling assets partition-by-partition did not play well with our data warehouse (BigQuery) and led to extremely lengthy backfill times. We worked closely with the Dagster team to push an open-source commit , which resulted in us being able to configure how many partitions could be backfilled at once for each asset. One more challenge we faced stemmed from a constraint that we felt was critical for the high bar of data quality that our data consumers expect: atomicity and data consistency. In essence, the code-version for an asset needed to remain consistent across partitions, even while backfilling. While not supported out of the box, Dagster provides a flexible graphQL interface which, in combination with a series of sensors and jobs , enabled us to bring this functionality to life! How users are benefiting from the new system Once the core pieces were in place, it didn’t take long for our data teams to benefit from the new tools at their disposal. For one, answering the very simple, yet important, question “Why isn’t my data asset updating?” is now a self-serve, at-a-glance feature: The automation tab indicates exactly why or why not a given asset is being queued up for materialization Empowered by Dagster's asset definition pages, asset owners now seamlessly manage the lifecycles of their data assets, from backfilling to incremental updates. This interface provides comprehensive, real-time insights into every activity related to an asset. One asset owner has been quoted as enjoying the UI so much that they feel confident doing things like “launching backfills from my phone.” (We don’t recommend trying this at home) The lineage view allows anyone to quickly determine table landing times and identify blockages that prevent downstream execution. Data quality is at the heart of this new system — our engineers can now write point-in-time quality checks that can be tuned to “warn,” or even “block,” downstream runs on failure. This allows us to quickly catch, alert, and fix issues before impacting critical downstream use cases like company dashboards. We alert our table owners by utilizing a notification system called DAN (Data Asset Notifications) that informs users of table failures via a Discord app . (Who uses email nowadays?) On the dbt side, we’ve been able to standardize complex metric calculations using macros , which has played a key role in removing discrepancies across the business and streamlined the way data practitioners are transforming and consuming data. To boost developer productivity, we created an internal suite of custom dbt CLI commands One of these, dubbed autogen-schema, automatically generates the boilerplate dbt YAML files a new model requires, which can often be verbose when creating from scratch. We also implemented a robust CI/CD process to prevent disruptive changes across table logic, macros, dbt tests, and more. Our advanced dbt table configurations and custom materializations are tailored to meet business demands while effortlessly integrating with our Dagster orchestration system and maintaining parity with the previous Derived system. Last but not least, we were able to leverage and contribute to the wide range of dbt packages, such as great-expectations and elementary , to quickly enable new features and functionality in our project. Where we’ve arrived post-Derived Today, our new system (internally referred to as “Transformation 2.0,” or “T2”) powers over 2000 dbt tables, covered by over 12000 dbt tests. On a typical day we will see roughly ~4000 materializations automatically triggered across both hourly and daily assets. Our migration effort has seen petabytes of data churned through as we’ve moved off of Derived and onto Transformation 2.0. A typical 6-hour overview of our system in its current state As Dagster continues to evolve, our data producers and consumers have been able to take advantage of new functionality, including column level lineage and other catalog-like features, that accentuate data discovery. We have strong conviction that Dagster will be the heart of many of Discord’s future Data Platform developments, and hope to soon open up the platform to be the place for orchestration at Discord. We greatly appreciate our partners over at Dagster, and we’re looking forward to staying on the cutting edge of orchestration with their support! If you’re interested in working on technologies like those mentioned today ( without launching backfills from your phone), be sure to check out our open roles on Discord’s mighty Data Platform team and others at our jobs page . Zach Bluhm Engineering manager on Discord’s Data Platform. Big data enjoyer. related articles . Search",
+    "quality_score": 8,
+    "modules": [
+      "observability",
+      "architecture_patterns"
+    ]
+  },
+  {
+    "url": "https://discord.com/blog/developing-rapidly-with-generative-ai",
+    "title": "Developing Rapidly with Generative AI",
+    "source_name": "Discord Engineering",
+    "text": "Engineering & Developers Shannon Phu April 12, 2024 Generative AI is attracting attention as the technology has progressed in leaps and bounds in recent years, offering fresh ways to solve user problems. Since it's a relatively new area in terms of its practical application, figuring out how to start building with LLMs (large language models) can be challenging. We're excited to share our approach for solving problems with generative AI, along with insights on rapidly launching new features leveraging this technology. We break down the process of building with LLMs into a few stages. Starting with product ideation and defining requirements, we first need to figure out what we’re building and how it can benefit users. Next, we develop a prototype of our idea, learn from small-scale experiments, and repeat that process until our feature is in a good state. Finally, we fully launch and deploy our product at scale. In this post, we will dive deeper into each stage of this process. The different stages of building an LLM-powered feature How we identify use cases for generative AI We start by having empathy for our users and for our staff - what are the opportunities that generative AI can help address? Like machine learning in general, generative AI is a tool — and one that shouldn’t be applied when other tools are a better fit. When it comes to identifying where generative AI can make an impact, we dig into challenges that commonly: Involve analysis, interpretation, or review of unstructured content (e.g. text) at scale Require massive scaling that may be otherwise prohibitive due to limited resources Would be challenging for rules-based or traditional ML approaches Defining product requirements Once we've identified a potential use case for a generative AI application, the next step involves defining the product requirements. This phase requires a thoughtful analysis to select the best-suited LLM and to frame our problem as a prompt to an LLM. We consider these aspects of our problem: Latency : How fast does the system need to respond to user input? Task Complexity : What level of understanding is required from the LLM? Is the input context and prompt super domain-specific? Prompt Length : How much context needs to be provided for the LLM to do its task? Quality : What is the acceptable level of accuracy for the generated content? Safety : How important is it to sanitize user input or prevent the generation of harmful content and prompt hacking ? Language Support : Which languages does the application need to support? Estimated QPS : What throughput does our system eventually need to handle? Several factors, such as complexity, prompt length, and quality, often conflict with the need for low latency, primarily because a bigger, more capable LLM usually delivers better outcomes but operates more slowly during inference owing to the model’s larger size. Consequently, if minimizing response time is critical, we can consider either incurring higher costs (e.g. by having more available compute) or accepting a drop in quality by using smaller models. Prototyping AI applications: From Idea to MVP The product requirements we define then play into our selection of which off-the-shelf LLM we'll use for our prototype. We generally lean towards picking more advanced commercial LLMs to quickly validate our ideas and obtain early feedback from users. Although they may be expensive, the general idea is that if problems can't be adequately solved with state-of-the-art foundational models like GPT-4, then more often than not, those problems may not be addressable using current generative AI tech. If an off-the-shelf LLM can address our problem, then we can step into the learning stage and concentrate on iterating on our product rather than diverting engineering resources towards building and maintaining machine learning infrastructure. Evaluating Prompts The key step at this stage is to create the right prompt. We start with a basic prompt that tells ChatGPT (or whatever LLM we selected for our prototype) what we want it to do. Then, we make adjustments to this prompt, changing the wording to make the task clearer. However, after a lot of adjustments, it's often difficult to tell if these changes are actually improving our results. That's where evaluating the prompts becomes crucial. By using metrics to guide our changes, we know we are moving the needle on the quality of our results. To do this, we employ a technique known as AI-assisted evaluation , alongside traditional metrics for measuring performance. This helps us pick the prompts that lead to better quality outputs, making the end product more appealing to users. AI-assisted evaluation uses best-in-class LLMs (like GPT-4) to automatically critique how well the AI's outputs match what we expected or how they score against a set of criteria. This method uses GPT-4 in a way that’s similar to the critic model found in the actor-critic algorithm in reinforcement learning where a separate model is used to evaluate how well the model used for inference performed. Automating evaluation allows us to quickly see what's working well and what needs to be tweaked in our prompts, without having to manually check everything. When evaluating, we design prompts that ask for simple yes or no answers or rate the outputs on a scale, making the evaluation process straightforward. AI-assisted evaluation consists of 2 separate prompts: one for your task and another to evaluate your results. The task prompt is passed to the inference model whereas the critic prompt is passed to the more advanced critic model. Launch and Learn Once we are sufficiently confident in the quality of the results our prompt generates, we roll out a limited release (e.g. A/B test) of our product and observe the system’s performance in situ. The exact metrics we use depend on the application — our main goal is to understand how users use the feature and quickly make improvements to better meet their needs. For internal applications, this might mean measuring efficiency and sentiment. For consumer-facing applications, we similarly focus on measures of user satisfaction - direct user feedback, user engagement measures, etc. This feedback is critical to identify areas for improvement, including highlighting incorrect answers or instances where LLM hallucinations might be causing a strange user experience. Beyond user satisfaction, we also pay attention to system health metrics, such as response speed (latency), throughput (tokens per second), and error rates. LLMs sometimes have trouble generating output in a consistently structured format, which is crucial for minimizing data parsing errors and ensuring the output is robustly usable in our services. Insights here can inform how much post-hoc processing might be needed to fully productionize this capability at scale. Keeping an eye on costs is equally important for understanding how much we will spend when we fully scale up the feature. We look at how many tokens per second we're using in our initial limited release to predict the costs of a complete launch if we were to use the same technology that’s powering our prototype. All of the above information is critical to understanding if our product is working as intended and providing value to users. If it is, then we can proceed to the next step: deploying at scale. If not, then we look to take our learnings, iterate on the system, and try again. Deploying at Scale LLM Application Architecture A high-level architecture for an LLM application The basic setup for apps using LLMs consists of several essential parts. Inputs to the inference server are prepared into a prompt that we’ve tested and evaluated on a robust set of examples. At the heart of the architecture lies the LLM inference server, tasked with the job of operating the LLM to produce answers from the inputs it gets. Examples of such servers commercially include ChatGPT or other OpenAI GPT APIs, which are specialized in generating content with low latency. Because we care deeply about the user experience, privacy, and safety, we work with cross-functional partners like Legal and other Safety teams to ensure we’ve implemented thoughtful mitigations, while adhering to privacy principles such as data minimization. For example, we chose to incorporate content safety filters to the output of the inference server to identify undesired material before it reaches the user. We can leverage in-house or third-party trust and safety ML models to detect inappropriate content. All these elements put together form a system that taps into the capabilities of LLMs efficiently while monitoring the content's quality and safety to ensure that we’re delivering a quality end product. Self-hosted LLMs When we're thinking about adding a feature that uses LLMs, we consider many tradeoffs when designing our LLM inference server such as balancing the costs and the amount of engineering effort. Using commercial LLMs is great because it gives us access to top-notch models and we don't have to worry about setting up the tech ourselves, but the expenses can add up quickly. For privacy reasons, we may also prefer to process full-scale data completely in-house. A solution is to self-host an open-sourced or custom fine-tuned LLM. Opting for a self-hosted model can reduce costs dramatically - but with additional development time, maintenance overhead, and possible performance implications. Considering self-hosted solutions requires weighing these different trade-offs carefully. Recent open-source models, like Llama and Mistral , are making high-quality results possible right out of the gate, even for complex tasks that traditionally required a model to be trained specifically for them. However, for domain-specific or complex tasks, we might still need to fine-tune the model to achieve excellent performance. We've found it's best to start with smaller models and only move up to bigger ones if needed for quality reasons. Setting up the necessary machine learning infrastructure to run these big models is another challenge. We need a dedicated model server for running model inference (using frameworks like Triton or vLLM ), powerful GPUs to run everything robustly, and configurability in our servers to make sure they're high throughput and low latency. Tuning the inference servers for optimal performance is task-specific - the best configuration depends on the models we’re using, as well as the input and output token lengths, and ultimately impacts how efficiently the server can batch input requests to maximize throughput. Self-hosted inference server Closing Thoughts Looking ahead, there’s little doubt that generative AI will only grow more important as a means of solving massive-scale business-critical problems. Balancing cost, engineering effort, and performance will remain challenging, and we’re excited to see (and contribute to) the rapid development of novel technology and tools to more effectively do so in the coming years! Shannon Phu Senior Machine Learning Engineer, Applied Machine Learning. related articles . Search",
+    "quality_score": 8,
+    "modules": [
+      "ai_assisted",
+      "integration",
+      "dx"
+    ]
+  },
+  {
+    "url": "https://blog.cloudflare.com/cloudflare-incident-on-june-20-2024/",
+    "title": "Cloudflare incident on June 20, 2024",
+    "source_name": "Cloudflare Blog",
+    "text": "2024-06-26 10 min read On Thursday, June 20, 2024, two independent events caused an increase in latency and error rates for Internet properties and Cloudflare services that lasted 114 minutes. During the 30-minute peak of the impact, we saw that 1.4 - 2.1% of HTTP requests to our CDN received a generic error page, and observed a 3x increase for the 99th percentile Time To First Byte (TTFB) latency. These events occurred because: Automated network monitoring detected performance degradation, re-routing traffic suboptimally and causing backbone congestion between 17:33 and 17:50 UTC A new Distributed Denial-of-Service (DDoS) mitigation mechanism deployed between 14:14 and 17:06 UTC triggered a latent bug in our rate limiting system that allowed a specific form of HTTP request to cause a process handling it to enter an infinite loop between 17:47 and 19:27 UTC Impact from these events were observed in many Cloudflare data centers around the world. With respect to the backbone congestion event, we were already working on expanding backbone capacity in the affected data centers, and improving our network mitigations to use more information about the available capacity on alternative network paths when taking action. In the remainder of this blog post, we will go into more detail on the second and more impactful of these events. As part of routine updates to our protection mechanisms, we created a new DDoS rule to prevent a specific type of abuse that we observed on our infrastructure. This DDoS rule worked as expected, however in a specific suspect traffic case it exposed a latent bug in our existing rate-limiting component. To be absolutely clear, we have no reason to believe this suspect traffic was intentionally exploiting this bug, and there is no evidence of a breach of any kind. We are sorry for the impact and have already made changes to help prevent these problems from occurring again. Background Rate-limiting suspicious traffic Depending on the profile of an HTTP request and the configuration of the requested Internet property, Cloudflare may protect our network and our customer’s origins by applying a limit to the number of requests a visitor can make within a certain time window. These rate limits can activate through customer configuration or in response to DDoS rules detecting suspicious activity. Usually, these rate limits will be applied based on the IP address of the visitor. As many institutions and Internet Service Providers (ISPs) can have many devices and individual users behind a single IP address , rate limiting based on the IP address is a broad brush that can unintentionally block legitimate traffic. Balancing traffic across our network Cloudflare has several systems that together provide continuous real-time capacity monitoring and rebalancing to ensure we serve as much traffic as we can as quickly and efficiently as we can. The first of these is Unimog, Cloudflare’s edge load balancer . Every packet that reaches our anycast network passes through Unimog, which delivers it to an appropriate server to process that packet. That server may be in a different location from where the packet originally arrived into our network, depending on the availability of compute capacity. Within each data center, Unimog aims to keep the CPU load uniform across all active servers. For a global view of our network, we rely on Traffic Manager . Across all of our data center locations, it takes in a variety of signals, such as overall CPU utilization, HTTP request latency, and bandwidth utilization to instruct rebalancing decisions. It has built-in safety limits to prevent causing outsized traffic shifts, and also considers the expected resulting load in destination locations when making any decisions. Incident timeline and impact All timestamps are UTC on 2024-06-20. 14:14 DDoS rule gradual deployment starts 17:06 DDoS rule deployed globally 17:47 First HTTP request handling process is poisoned 18:04 Incident declared automatically based on detected high CPU load 18:34 Service restart shown to recover on a server, full restart tested in one data center 18:44 CPU load normalized in data center after service restart 18:51 Continual global reloads of all servers with many stuck processes begin 19:05 Global eyeball HTTP error rate peaks at 2.1% service unavailable / 3.45% total 19:05 First Traffic Manager actions recovering service 19:11 Global eyeball HTTP error rate halved to 1% service unavailable / 1.96% total 19:27 Global eyeball HTTP error rate reduced to baseline levels 19:29 DDoS rule deployment identified as likely cause of process poisoning 19:34 DDoS rule is fully disabled 19:43 Engineers stop routine restarts of services on servers with many stuck processes 20:16 Incident response stood down Below, we provide a view of the impact from some of Cloudflare’s internal metrics. The first graph illustrates the percentage of all eyeball (inbound from external devices) HTTP requests that were served an error response because the service suffering poisoning could not be reached. We saw an initial increase to 0.5% of requests, and then later a larger one reaching as much as 2.1% before recovery started due to our service reloads. For a broader view of errors, we can see all 5xx responses our network returned to eyeballs during the same window, including those from origin servers. These peaked at 3.45%, and you can more clearly see the gradual recovery between 19:25 and 20:00 UTC as Traffic Manager finished its re-routing activities. The dip at 19:25 UTC aligns with the last large reload, with the error increase afterwards primarily consisting of upstream DNS timeouts and connection limits which are consistent with high and unbalanced load. And here’s what our TTFB measurements looked like at the 50th, 90th and 99th percentiles, showing an almost 3x increase in latency at p99: Technical description of the error and how it happened Global percentage of HTTP Request handling processes that were using excessive CPU during the event Earlier on June 20, between 14:14 - 17:06 UTC, we gradually activated a new DDoS rule on our network. Cloudflare has recently been building a new way of mitigating HTTP DDoS attacks. This method is using a combination of rate-limits and cookies in order to allow legitimate clients that were falsely identified as being part of an attack to proceed anyway. With this new method, an HTTP request that is considered suspicious runs through these key steps: Check for the presence of a valid cookie, otherwise block the request If a valid cookie is found, add a rate-limit rule based on the cookie value to be evaluated at a later point Once all the currently applied DDoS mitigation are run, apply rate-limit rules We use this \"asynchronous\" workflow because it is more efficient to block a request without a rate-limit rule, so it gives a chance for other rule types to be applied. So overall, the flow can be summarized with this pseudocode: for (rule in active_mitigations) { // ... (ignore other rule types) if (rule.match_current_request()) { if (!has_valid_cookie()) { // no cookie: serve error page return serve_error_page(); } else { // add a rate-limit rule to be evaluated later add_rate_limit_rule(rule); } } } evaluate_rate_limit_rules(); When evaluating rate-limit rules, we need to make a key for each client that is used to look up the correct counter and compare it with the target rate. Typically, this key is the client IP address, but other options are available, such as the value of a cookie as used here. We actually reused an existing portion of the rate-limit logic to achieve this. In pseudocode, it looks like: function get_cookie_key() { // Validate that the cookie is valid before taking its value. // Here the cookie has been checked before already, but this code is // also used for \"standalone\" rate-limit rules. if (!has_valid_cookie_broken()) { // more on the \"broken\" part later return cookie_value; } else { return parent_key_generator(); } } This simple key generation function had two issues that, combined with a specific form of client request, caused an infinite loop in the process handling the HTTP request: The rate-limit rules generated by the DDoS logic are using internal APIs in ways that haven't been anticipated. This caused the parent_key_generator in the pseudocode above to point to the get_cookie_key function itself, meaning that if that code path was taken, the function would call itself indefinitely As these rate-limit rules are added only after validating the cookie, validating it a second time should give the same result. The problem is that the has_valid_cookie_broken function used here is actually different and both can disagree if the client sends multiple cookies where some are valid but not others So, combining these two issues: the broken validation function tells get_cookie_key that the cookie is invalid, causing the else branch to be taken and calling the same function over and over. A protection many programming languages have in place to help prevent loops like this is a run-time protection limit on how deep the stack of function calls can get. An attempt to call a function once already at this limit will result in a runtime error. When reading the logic above, an initial analysis might suggest we were reaching the limit in this case, and so requests eventually resulted in an error, with a stack containing those same function calls over and over. However, this isn’t the case here. Some languages, including Lua, in which this logic is written, also implement an optimization called proper tail calls. A tail call is when the final action a function takes is to execute another function. Instead of adding that function as another layer in the stack, as we know for sure that we will not be returning execution context to the parent function afterwards, nor using any of its local variables, we can replace the top frame in the stack with this function call instead. The end result is a loop in the request processing logic which never increases the size of the stack. Instead, it simply consumes 100% of available CPU resources, and never terminates. Once a process handling HTTP requests receives a single request on which the action should be applied and has a mixture of valid and invalid cookies, that process is poisoned and is never able to process any further requests. Every Cloudflare server has dozens of such processes, so a single poisoned process does not have much of an impact. However, then some other things start happening: The increase in CPU utilization for the server causes Unimog to lower the amount of new traffic that server receives, moving traffic to other servers, so at a certain point, more new connections are directed away from servers with a subset of their processes poisoned to those with fewer or no poisoned processes, and therefore lower CPU utilization. The gradual increase in CPU utilization in the data center starts to cause Traffic Manager to redirect traffic to other data centers. As this movement does not fix the poisoned processes, CPU utilization remains high, and so Traffic Manager continues to redirect more and more traffic away. The redirected traffic in both cases includes the requests that are poisoning processes, causing the servers and data centers to which this redirected traffic was sent to start failing in the same way. Within a few minutes, multiple data centers had many poisoned processes, and Traffic Manager had redirected as much traffic away from them as possible, but was restricted from doing more. This was partly due to its built-in automation safety limits, but also because it was becoming more difficult to find a data center with sufficient available capacity to use as a target. The first case of a poisoned process was at 17:47 UTC, and by 18:09 UTC – five minutes after the incident was declared – Traffic Manager was re-routing a lot of traffic out of Europe: A summary map of Traffic Manager capacity actions as of 18:09 UTC. Each circle represents a data center that traffic is being re-routed towards or away from. The color of the circle indicates the CPU load of that data center. The orange ribbons between them show how much traffic is re-routed, and where from/to. It’s obvious to see why, if we look at the percentage of the HTTP request service’s processes that were saturating their CPUs. 10% of our capacity in Western Europe was already gone, and 4% in Eastern Europe, during peak traffic time for those timezones: Percentage of all the HTTP request handling processes saturating their CPU, by geographic region Partially poisoned servers in many locations struggled with the request load, and the remaining processes could not keep up, resulting in Cloudflare returning minimal HTTP error responses. Cloudflare engineers were automatically notified at 18:04 UTC, once our global CPU utilization reached a certain sustained level, and started to investigate. Many of our on-duty incident responders were already working on the open incident caused by backbone network congestion, and in the early minutes we looked into likely correlation with the network congestion events. It took some time for us to realize that locations where the CPU was highest is where traffic was the lowest, drawing the investigation away from a network event being the trigger. At this point, the focus moved to two main streams: Evaluating if restarting poisoned processes allowed them to recover, and if so, instigating mass-restarts of the service on affected servers Identifying the trigger of processes entering this CPU saturation state It was 25 minutes after the initial incident was declared when we validated that restarts helped on one sample server. Five minutes after this, we started executing wider restarts – initially to entire data centers at once, and then as the identification method was refined, on servers with a large number of poisoned processes. Some engineers continued regular routine restarts of the affected service on impacted servers, whilst others moved to join the ongoing parallel effort to identify the trigger. At 19:36 UTC, the new DDoS rule was disabled globally, and the incident was declared resolved after executing one more round of mass restarts and monitoring. At the same time, conditions presented by the incident triggered a latent bug in Traffic Manager. When triggered, the system would attempt to recover from the exception by initiating a graceful restart, halting its activity. The bug was first triggered at 18:17 UTC, then numerous times between 18:35 and 18:57 UTC. During two periods in this window (18:35-18:52 UTC and 18:56-19:05 UTC) the system did not issue any new traffic routing actions. This meant whilst we had recovered service in the most affected data centers, almost all traffic was still being re-routed away from them. Alerting notified on-call engineers of the issue at 18:34 UTC. By 19:05 UTC the Traffic team had written, tested, and deployed a fix. The first actions following restoration showed a positive impact on restoring service. To resolve the immediate impact to our network from the request poisoning, Cloudflare instigated mass rolling restarts of the affected service until the change that triggered the condition was identified and rolled back. The change, which was the activation of a new type of DDoS rule, remains fully rolled back, and the rule will not be reactivated until we have fixed the broken cookie validation check and are fully confident this situation cannot recur. We take these incidents very seriously, and recognize the magnitude of impact they had. We have identified several steps we can take to address these specific situations, and the risk of these sorts of problems from recurring in the future. Design: The rate limiting implementation in use for our DDoS module is a legacy component, and rate limiting rules customers configure for their Internet properties use a newer engine with more modern technologies and protections. Design: We are exploring options within and around the service which experienced process poisoning to limit the ability to loop forever through tail calls. Longer term, Cloudflare is entering the early implementation stages of replacing this service entirely. The design of this replacement service will allow us to apply limits on the non-interrupted and total execution time of a single request. Process: The activation of the new rule for the first time was staged in a handful of production data centers for validation, and then to all data centers a few hours later. We will continue to enhance our staging and rollout procedures to minimize the potential change-related blast radius. Conclusion Cloudflare experienced two back-to-back incidents that affected a significant set of customers using our CDN and network services. The first was network backbone congestion that our systems automatically remediated. We mitigated the second by regularly restarting the faulty service whilst we identified and deactivated the DDoS rule that was triggering the fault. We are sorry for any disruption this caused our customers and to end users trying to access services. The conditions necessary to activate the latent bug in the faulty service are no longer possible in our production environment, and we are putting further fixes and detections in place as soon as possible. Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . Post Mortem Outage",
+    "quality_score": 9,
+    "modules": [
+      "error_resilience",
+      "observability",
+      "security"
+    ]
+  },
+  {
+    "url": "https://blog.cloudflare.com/adopting-opentelemetry-for-our-logging-pipeline/",
+    "title": "Adopting OpenTelemetry for our logging pipeline",
+    "source_name": "Cloudflare Blog",
+    "text": "2024-06-03 8 min read Cloudflare’s logging pipeline is one of the largest data pipelines that Cloudflare has, serving millions of log events per second globally, from every server we run. Recently, we undertook a project to migrate the underlying systems of our logging pipeline from syslog-ng to OpenTelemetry Collector and in this post we want to share how we managed to swap out such a significant piece of our infrastructure, why we did it, what went well, what went wrong, and how we plan to improve the pipeline even more going forward. Background A full breakdown of our existing infrastructure can be found in our previous post An overview of Cloudflare's logging pipeline , but to quickly summarize here: We run a syslog-ng daemon on every server, reading from the local systemd-journald journal, and a set of named pipes. We forward those logs to a set of centralized “log-x receivers”, in one of our core data centers. We have a dead letter queue destination in another core data center, which receives messages that could not be sent to the primary receiver, and which get mirrored across to the primary receivers when possible. The goal of this project was to replace those syslog-ng instances as transparently as possible. That means we needed to implement all these behaviors as precisely as possible, so that we didn’t need to modify any downstream systems. There were a few reasons for wanting to make this shift, and enduring the difficulties of overhauling such a large part of our infrastructure: syslog-ng is written in C, which is not a core competency of our team. While we have made upstream contributions to the project in the past, and the experience was great, having the OpenTelemetry collector in Go allows much more of our team to be able to contribute improvements to the system. Building syslog-ng against our internal Post-Quantum cryptography libraries was difficult, due to having to maintain an often brittle C build chain, whereas our engineering teams have optimized the Go build model to make this as simple as possible. OpenTelemetry Collectors have built in support for Prometheus metrics, which allows us to gather much deeper levels of telemetry data around what the collectors are doing, and surface these insights as “meta-observability” to our engineering teams. We already use OpenTelemetry Collectors for some of our tracing infrastructure, so unifying onto one daemon rather than having separate collectors for all our different types of telemetry reduces the cognitive load on the team. The Migration Process What we needed to build While the upstream contrib repository contains a wealth of useful components, all packaged into its own distribution, it became clear early on that we would need our own internal components. Having our own internal components would require us to build our own distribution, so one of the first things we did was turn to OCB (OpenTelemetry Collector Builder) to provide us a way to build an internal distribution of an OpenTelemetry Collector. We eventually ended up templating our OCB configuration file to automatically include all the internal components we have built, so that we didn’t have to add them manually. In total, we built four internal components for our initial version of the collector. cfjs1exporter Internally, our logging pipeline uses a line format we call “cfjs1”. This format describes a JSON encoded log, with two fields: a format field, that decides the type of the log, and a “wrapper” field which contains the log body (which is a structured JSON object in and of itself), with a field name that changes depending on the format field. These two fields decide which Kafka topic our receivers will end up placing the log message in. Because we didn’t want to make changes to other parts of the pipeline, we needed to support this format in our collector. To do this, we took inspiration from the contrib repository’s syslogexporter , building our cfjs1 format into it. Ultimately, we would like to move towards using OTLP (OpenTelemetry Protocol) as our line format. This would allow us to remove our custom exporter, and utilize open standards, enabling easier migrations in the future. fileexporter While the upstream contrib repo does have a file exporter component, it only supports two formats: JSON and Protobuf. We needed to support two other formats, plain text and syslog, so we ended up forking the file exporter internally. Our plain text formatter simply outputs the body of the log message into a file, with newlines as a delimiter. Our syslog format outputs RFC 5424 formatted syslog messages into a file. The other feature we implemented on our internal fork was custom permissions. The upstream file exporter is a bit of a mess, in that it actually has two different modes of operation – a standard mode, not utilizing any of the compression or rotation features, and a more advanced mode which uses those features. Crucially, if you want to use any of the rotation features, you end up using lumberjack , whereas without those features you use a more native file handling. This leads to strange issues where some features of the exporter are supported in one mode, but not the other. In the case of permissions, the community seems open to the idea in the native handling, but lumberjack seems against the idea . This dichotomy is what led us to implement it ourselves internally. Ultimately, we would love to upstream these improvements should the community be open to them. Having support for custom marshallers ( https://github.com/open-telemetry/opentelemetry-collector-contrib/issues/30331 ) would have made this a bit easier, however it’s not clear how that would work with OCB. Either that, or we could open source them in the Cloudflare organization , but we would love to remove the need to maintain our own fork in the future. externaljsonprocessor We want to set the value of an attribute/field that comes from external sources: either from an HTTP endpoint or an output from running a specific command. In syslog-ng, we have a sidecar service that generates a syslog-ng configuration to achieve this. In replacing syslog-ng with our OpenTelemetry Collector, we thought it would be easier to implement this feature as a custom component of our collector instead. To that end, we implemented an “external JSON processor”, which is able to periodically query external data sources and add those fields to all the logs that flow through the processor. Cloudflare has many internal tools and APIs, and we use this processor to fetch data like the status of a data center, or the status of a systemd unit. This enables our engineers to have more filtering options, such as to exclude logs from data centers that are not supposed to receive customer traffic, or servers that are disabled for maintenance. Crucially, this allows us to update these values much faster than the standard three-hour cadence of other configuration updates through salt, allowing more rapid updates to these fields that may change quickly as we operate our network. ratelimit processor The last component we needed to implement was a replacement for the syslog-ng ratelimit filter , also contributed by us upstream. The ratelimit filter allows applying rate limits based on a specific field of a log message, dropping messages that exceed some limit (with an optional burst limit). In our case, we apply rate limits over the service field, ensuring that no individual service can degrade the log collection for any other. While there has been some upstream discussion of similar components , we couldn’t find anything that explicitly fit our needs. This was especially true when you consider that in our case the data loss during the rate limiting process is intentional, something that might be hard to sell when trying to build something more generally applicable. How we migrated Once we had an OpenTelemetry Collector binary, we had to deploy it. Our deployment process took two forks: Deploying to our core data centers, and deploying to our edge data centers. For those unfamiliar, Cloudflare’s core data centers contain a small number of servers with a very diverse set of workloads, from Postgresql, to ElasticSearch, to Kubernetes, and everything in between. Our edge data centers, on the other hand, are much more homogenous. They contain a much larger number of servers, each one running the same set of services. Both edge and core use salt to configure the services running on their servers. This meant that the first step was to write salt states that would install the OpenTelemetry collector, and write the appropriate configurations to disk. Once we had those in place, we also needed to write some temporary migration pieces that would disable syslog-ng and start the OpenTelemetry collector, as well as the inverse in the case of a roll back. For the edge data centers, once we had a set of configurations written, it mostly came down to rolling the changes out gradually across the edge servers. Because edge servers run the same set of services, once we had gained confidence in our set of configurations, it became a matter of rolling out the changes slowly and monitoring the logging pipelines along the way. We did have a few false starts here, and needed to instrument our cfjs1exporter a bit more to work around issues surrounding some of our more niche services and general Internet badness which we’ll detail below in our lessons learned. The core data centers required a more hands-on approach. Many of our services in core have custom syslog-ng configurations. For example, our Postgresql servers have custom handling for their audit logs, and our Kubernetes servers have custom handling for contour ingress and error logs. This meant that each role with a custom config had to be manually onboarded, with extensive testing on the designated canary nodes of each role to validate the configurations. Lessons Learned Failover At Cloudflare, we regularly schedule chaos testing on our core data centers which contain our centralized log receivers. During one of these chaos tests, our cfjs1 exporter did not notice that it could not send to the primary central logging server. This caused our collector to not failover to the secondary central logging server and its log buffer to fill up, which resulted in the collector failing to consume logs from its receivers. This is not a problem with journal receivers since logs are buffered by journald before they get consumed by the collector, but it is a different case with named pipe receivers. Due to this bug, our collectors stopped consuming logs from named pipes, and services writing to these named pipes started blocking threads waiting to write to them. Our syslog-ng deployment solved this issue using a monit script to periodically kill the connections between syslog-ng and the central receivers, however we opted to solve this more explicitly in our exporter by building in much tighter timeouts, and modifying the upstream failover receiver to better respond to these partial failures. Cutover delays As we’ve previously blogged about , at Cloudflare, we use Nomad for running dynamic tasks in our edge data centers. We use a custom driver to run containers and this custom driver handles the shipping of logs from the container to a named pipe. We did the migration from syslog-ng to OpenTelemetry Collectors while servers were live and running production services. During the migration, there was a gap when syslog-ng was stopped by our configuration management and our OpenTelemetry collector was started on the server. This gap caused the logs in the named pipe to not get consumed and similar to the previous named pipe, the services writing to the named pipe receiver in blocking mode got affected. Similar to NGINX and Postgresql, Cloudflare’s driver for Nomad also writes logs to the named pipe driver in blocking mode. Because of this delay, the driver timed out sending logs and rescheduled the containers. We ultimately caught this pretty early on in testing, and changed our approach to the rollout. Instead of using Salt to separately stop syslog-ng and start the collector, we instead used salt to schedule a systemd “one shot” service that simultaneously stopped syslog-ng and started the collector, minimizing the downtime between the two. What’s next? Migrating such a critical part of our infrastructure is never easy, especially when it has remained largely untouched for nearly half a decade. Even with the issues we hit during our rollout, migrating to an OpenTelemetry Collector unlocks so many more improvements to our logging pipeline going forward. With the initial deployment complete, there are a number of changes we’re excited to work on next, including: Better handling for log sampling, including tail sampling Better insights for our engineering teams on their telemetry production Migration to OTLP as our line protocol Upstreaming of some of our custom components If that sounds interesting to you, we’re hiring engineers to come work on our logging pipeline , so please reach out! Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . Observability Engineering",
+    "quality_score": 8,
+    "modules": [
+      "observability",
+      "devops"
+    ]
+  },
+  {
+    "url": "https://blog.cloudflare.com/reclaiming-cpu-for-free-with-pgo/",
+    "title": "Reclaiming CPU for free with Go's Profile Guided Optimization",
+    "source_name": "Cloudflare Blog",
+    "text": "2024-05-14 4 min read Golang 1.20 introduced support for Profile Guided Optimization (PGO) to the go compiler. This allows guiding the compiler to introduce optimizations based on the real world behaviour of your system. In the Observability Team at Cloudflare, we maintain a few Go-based services that use thousands of cores worldwide, so even the 2-7% savings advertised would drastically reduce our CPU footprint, effectively for free. This would reduce the CPU usage for our internal services, freeing up those resources to serve customer requests, providing measurable improvements to our customer experience. In this post, I will cover the process we created for experimenting with PGO – collecting representative profiles across our production infrastructure and then deploying new PGO binaries and measuring the CPU savings. How does PGO work? PGO itself is not a Go-specific tool, although it is relatively new. PGO allows you to take CPU profiles from a program running in production and use that to optimise the generated assembly for that program. This includes a bunch of different optimisations such as inlining heavily used functions more aggressively, reworking branch prediction to favour the more common branches, and rearranging the generated code to lump hot paths together to save on CPU cache swapping. The general flow for using PGO is to compile a non-PGO binary and deploy it to production, collect CPU profiles from the binary in production, and then compile a second binary using that CPU profile. CPU Profiles contain samples of what the CPU was spending the most time on when executing a program, which provides valuable context to the compiler when it’s making decisions about optimising a program. For example, the compiler may choose to inline a function that is called many times to reduce the function call overhead, or it might choose to unroll a particularly jump-heavy loop. Crucially, using a profile from production can guide the compiler much more efficiently than any upfront heuristics. A practical example In the Observability team, we operate a system we call “wshim”. Wshim is a service that runs on every one of our edge servers, providing a push gateway for telemetry sourced from our internal Cloudflare Workers. Because this service runs on every server, and is called every time an internal worker is called, wshim requires a lot of CPU time to run. In order to track exactly how much, we put wshim into its own cgroup , and use cadvisor to expose Prometheus metrics pertaining to the resources that it uses. Before deploying PGO, wshim was using over 3000 cores globally: container_cpu_time_seconds is our internal metric that tracks the amount of time a CPU has spent running wshim across the world. Even a 2% saving would return 60 cores to our customers, making the Cloudflare network even more efficient. The first step in deploying PGO was to collect representative profiles from our servers worldwide. The first problem we run into is that we run thousands of servers, each with different usage patterns at given points in time – a datacenter serving lots of requests during daytime hours will have a different usage pattern than a different data center that locally is in the middle of the night. As such, selecting exactly which servers to profile is paramount to collecting good profiles for PGO to use. In the end, we decided that the best samples would be from those datacenters experiencing heavy load – those are the ones where the slowest parts of wshim would be most obvious. Even further, we will only collect profiles from our Tier 1 data centers. These are data centers that serve our most heavily populated regions, are generally our largest, and are generally under very heavy loads during peak hours. Concretely, we can get a list of high CPU servers by querying our Thanos infrastructure: num_profiles=\"1000\" # Fetch the top n CPU users for wshim across the edge using Thanos. cloudflared access curl \"https://thanos/api/v1/query?query=topk%28${num_profiles}%2Cinstance%3Acontainer_cpu_time_seconds_total%3Arate2m%7Bapp_name%3D%22wshim.service%22%7D%29&dedup=true&partial_response=true\" --compressed | jq '.data.result[].metric.instance' -r > \"${instances_file}\" Go makes actually fetching CPU profiles trivial with pprof . In order for our engineers to debug their systems in production, we provide a method to easily retrieve production profiles that we can use here. Wshim provides a pprof interface that we can use to retrieve profiles, and we can collect these again with bash: # For every instance, attempt to pull a CPU profile. Note that due to the transient nature of some data centers # a certain percentage of these will fail, which is fine, as long as we get enough nodes to form a representative sample. while read instance; do fetch-pprof $instance –port 8976 –seconds 30' > \"${working_dir}/${instance}.pprof\" & done < \"${instances_file}\" wait $(jobs -p) And then merge all the gathered profiles into one, with go tool: # Merge the fetched profiles into one. go tool pprof -proto \"${working_dir}/\"*.pprof > profile.pprof It’s this merged profile that we will use to compile our pprof binary. As such, we commit it to our repo so that it lives alongside all the other deployment components of wshim: ~/cf-repos/wshim ± master 23/01/2024 10:49:08 AEDT❯ tree pgo pgo ├── README.md ├── fetch-profiles.sh └── profile.pprof And update our Makefile to pass in the -pgo flag to the go build command: build: go build -pgo ./pgo/profile.pprof -o /tmp/wshim ./cmd/wshim After that, we can build and deploy our new PGO optimized version of wshim, like any other version. Results Once our new version is deployed, we can review our CPU metrics to see if we have any meaningful savings. Resource usages are notoriously hard to compare. Because wshim’s CPU usage scales with the amount of traffic that any given server is receiving, it has a lot of potentially confounding variables, including the time of day, day of the year, and whether there are any active attacks affecting the datacenter. That being said, we can take a couple of numbers that might give us a good indication of any potential savings. Firstly, we can look at the CPU usage of wshim immediately before and after the deployment. This may be confounded by the time difference between the sets, but it shows a decent improvement. Because our release takes just under two hours to roll to every tier 1 datacenter, we can use PromQLs `offset` operator to measure the difference: This indicates that following the release, we’re using ~97 cores fewer than before the release, a ~3.5% reduction. This seems to be inline with the upstream documentation that gives numbers between 2% and 14%. The second number we can look at is the usage at the same time of day on different days of the week. The average usage for the 7 days prior to the release was 3067.83 cores, whereas the 7 days after the release were 2996.78, a savings of 71 CPUs. Not quite as good as our 97 CPU savings, but still pretty substantial! This seems to prove the benefits of PGO – without changing the code at all, we managed to save ourselves several servers worth of CPU time. Future work Looking at these initial results certainly seems to prove the case for PGO – saving multiple servers worth of CPU without any code changes is a big win for freeing up resources to better serve customer requests. However, there is definitely more work to be done here. In particular: Automating the collection of profiles, perhaps using continuous profiling Refining the deployment process to handle the new “two-step deployment”, deploying a non PGO binary, and then a PGO one Refining our techniques to derive representative profiling samples Implementing further improvements with BOLT , or other Link Time Optimization (LTO) techniques If that sounds interesting to you, we’re hiring in both the USA and EMEA ! Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . Observability Performance Related posts March 23, 2026 1:00 PM Launching Cloudflare’s Gen 13 servers: trading cache for cores for 2x edge compute performance Cloudflare’s Gen 13 servers double our compute throughput by rethinking the balance between cache and cores. Moving to high-core-count AMD EPYC ™ Turin CPUs, we traded large L3 cache for raw compute density. By running our new Rust-based FL2 stack, we completely mitigated the latency penalty to unlock twice the performance.... By February 27, 2026 6:00 AM We deserve a better streams API for JavaScript The Web streams API has become ubiquitous in JavaScript runtimes but was designed for a different era. Here's what a modern streaming API could (should?) look like.... By February 24, 2026 8:00 PM How we rebuilt Next.js with AI in one week One engineer used AI to rebuild Next.js on Vite in a week. vinext builds up to 4x faster, produces 57% smaller bundles, and deploys to Cloudflare Workers with a single command.... By February 03, 2026 2:00 PM Improve global upload performance with R2 Local Uploads Local Uploads on R2 reduces request duration for uploads by up to 75%. It writes object data to a nearby location and asynchronously copies it to your bucket, all while data is available immediately. ... By",
+    "quality_score": 8,
+    "modules": [
+      "go_patterns",
+      "performance"
+    ]
+  },
+  {
+    "url": "https://blog.cloudflare.com/how-we-built-cloudflare-queues/",
+    "title": "Durable Objects aren't just durable, they're fast: a 10x speedup for Cloudflare Queues",
+    "source_name": "Cloudflare Blog",
+    "text": "2024-10-24 8 min read Cloudflare Queues let a developer decouple their Workers into event-driven services. Producer Workers write events to a Queue, and consumer Workers are invoked to take actions on the events. For example, you can use a Queue to decouple an e-commerce website from a service which sends purchase confirmation emails to users. During 2024’s Birthday Week, we announced that Cloudflare Queues is now Generally Available , with significant performance improvements that enable larger workloads. To accomplish this, we switched to a new architecture for Queues that enabled the following improvements: Median latency for sending messages has dropped from ~200ms to ~60ms Maximum throughput for each Queue has increased over 10x, from 400 to 5000 messages per second Maximum Consumer concurrency for each Queue has increased from 20 to 250 concurrent invocations Median latency drops from ~200ms to ~60ms as Queues are migrated to the new architecture In this blog post, we'll share details about how we built Queues using Durable Objects and the Cloudflare Developer Platform, and how we migrated from an initial Beta architecture to a geographically-distributed, horizontally-scalable architecture for General Availability. v1 Beta architecture When initially designing Cloudflare Queues, we decided to build something simple that we could get into users' hands quickly. First, we considered leveraging an off-the-shelf messaging system such as Kafka or Pulsar. However, we decided that it would be too challenging to operate these systems at scale with the large number of isolated tenants that we wanted to support. Instead of investing in new infrastructure, we decided to build on top of one of Cloudflare's existing developer platform building blocks: Durable Objects. Durable Objects are a simple, yet powerful building block for coordination and storage in a distributed system. In our initial v1 architecture, each Queue was implemented using a single Durable Object. As shown below, clients would send messages to a Worker running in their region, which would be forwarded to the single Durable Object hosted in the WNAM (Western North America) region. We used a single Durable Object for simplicity, and hosted it in WNAM for proximity to our centralized configuration API service. One of a Queue's main responsibilities is to accept and store incoming messages. Sending a message to a v1 Queue used the following flow: A client sends a POST request containing the message body to the Queues API at /accounts/:accountID/queues/:queueID/messages The request is handled by an instance of the Queue Broker Worker in a Cloudflare data center running near the client. The Worker performs authentication, and then uses Durable Objects idFromName API to route the request to the Queue Durable Object for the given queueID The Queue Durable Object persists the message to storage before returning a success back to the client. Durable Objects handled most of the heavy-lifting here: we did not need to set up any new servers, storage, or service discovery infrastructure. To route requests, we simply provided a queueID and the platform handled the rest. To store messages, we used the Durable Object storage API to put each message, and the platform handled reliably storing the data redundantly. Consuming messages The other main responsibility of a Queue is to deliver messages to a Consumer. Delivering messages in a v1 Queue used the following process: Each Queue Durable Object maintained an alarm that was always set when there were undelivered messages in storage. The alarm guaranteed that the Durable Object would reliably wake up to deliver any messages in storage, even in the presence of failures. The alarm time was configured to fire after the user's selected max wait time , if only a partial batch of messages was available. Whenever one or more full batches were available in storage, the alarm was scheduled to fire immediately. The alarm would wake the Durable Object, which continually looked for batches of messages in storage to deliver. Each batch of messages was sent to a \"Dispatcher Worker\" that used Workers for Platforms dynamic dispatch to pass the messages to the queue() function defined in a user's Consumer Worker This v1 architecture let us flesh out the initial version of the Queues Beta product and onboard users quickly. Using Durable Objects allowed us to focus on building application logic, instead of complex low-level systems challenges such as global routing and guaranteed durability for storage. Using a separate Durable Object for each Queue allowed us to host an essentially unlimited number of Queues, and provided isolation between them. However, using only one Durable Object per queue had some significant limitations: Latency: we created all of our v1 Queue Durable Objects in Western North America. Messages sent from distant regions incurred significant latency when traversing the globe. Throughput: A single Durable Object is not scalable: it is single-threaded and has a fixed capacity for how many requests per second it can process. This is where the previous 400 messages per second limit came from. Consumer Concurrency: Due to concurrent subrequest limits , a single Durable Object was limited in how many concurrent subrequests it could make to our Dispatcher Worker. This limited the number of queue() handler invocations that it could run simultaneously. To solve these issues, we created a new v2 architecture that horizontally scales across multiple Durable Objects to implement each single high-performance Queue. v2 Architecture In the new v2 architecture for Queues, each Queue is implemented using multiple Durable Objects, instead of just one. Instead of a single region, we place Storage Shard Durable Objects in all available regions to enable lower latency. Within each region, we create multiple Storage Shards and load balance incoming requests amongst them. Just like that, we’ve multiplied message throughput. Sending a message to a v2 Queue uses the following flow: A client sends a POST request containing the message body to the Queues API at /accounts/:accountID/queues/:queueID/messages The request is handled by an instance of the Queue Broker Worker running in a Cloudflare data center near the client. The Worker: Performs authentication Reads from Workers KV to obtain a Shard Map that lists available storage shards for the given region and queueID Picks one of the region's Storage Shards at random, and uses Durable Objects idFromName API to route the request to the chosen shard The Storage Shard persists the message to storage before returning a success back to the client. In this v2 architecture, messages are stored in the closest available Durable Object storage cluster near the user, greatly reducing latency since messages don't need to be shipped all the way to WNAM. Using multiple shards within each region removes the bottleneck of a single Durable Object, and allows us to scale each Queue horizontally to accept even more messages per second. Workers KV acts as a fast metadata store: our Worker can quickly look up the shard map to perform load balancing across shards. To improve the Consumer side of v2 Queues, we used a similar \"scale out\" approach. A single Durable Object can only perform a limited number of concurrent subrequests. In v1 Queues, this limited the number of concurrent subrequests we could make to our Dispatcher Worker. To work around this, we created a new Consumer Shard Durable Object class that we can scale horizontally, enabling us to execute many more concurrent instances of our users' queue() handlers. Consumer Durable Objects in v2 Queues use the following approach: Each Consumer maintains an alarm that guarantees it will wake up to process any pending messages. v2 Consumers are notified by the Queue's Coordinator (introduced below) when there are messages ready for consumption. Upon notification, the Consumer sets an alarm to go off immediately. The Consumer looks at the shard map, which contains information about the storage shards that exist for the Queue, including the number of available messages on each shard. The Consumer picks a random storage shard with available messages, and asks for a batch. The Consumer sends the batch to the Dispatcher Worker, just like for v1 Queues. After processing the messages, the Consumer sends another request to the Storage Shard to either \"acknowledge\" or \"retry\" the messages. This scale-out approach enabled us to work around the subrequest limits of a single Durable Object, and increase the maximum supported concurrency level of a Queue from 20 to 250. The Coordinator and “Control Plane” So far, we have primarily discussed the \"Data Plane\" of a v2 Queue: how messages are load balanced amongst Storage Shards, and how Consumer Shards read and deliver messages. The other main piece of a v2 Queue is the \"Control Plane\", which handles creating and managing all the individual Durable Objects in the system. In our v2 architecture, each Queue has a single Coordinator Durable Object that acts as the brain of the Queue. Requests to create a Queue, or change its settings, are sent to the Queue's Coordinator. The Coordinator maintains a Shard Map for the Queue, which includes metadata about all the Durable Objects in the Queue (including their region, number of available messages, current estimated load, etc.). The Coordinator periodically writes a fresh copy of the Shard Map into Workers KV, as pictured in step 1 of the diagram. Placing the shard map into Workers KV ensures that it is globally cached and available for our Worker to read quickly, so that it can pick a shard to accept the message. Every shard in the system periodically sends a heartbeat to the Coordinator as shown in steps 2 and 3 of the diagram. Both Storage Shards and Consumer Shards send heartbeats, including information like the number of messages stored locally, and the current load (requests per second) that the shard is handling. The Coordinator uses this information to perform autoscaling. When it detects that the shards in a particular region are overloaded, it creates additional shards in the region, and adds them to the shard map in Workers KV. Our Worker sees the updated shard map and naturally load balances messages across the freshly added shards. Similarly, the Coordinator looks at the backlog of available messages in the Queue, and decides to add more Consumer shards to increase Consumer throughput when the backlog is growing. Consumer Shards pull messages from Storage Shards for processing as shown in step 4 of the diagram. Switching to a new scalable architecture allowed us to meet our performance goals and take Queues to GA. As a recap, this new architecture delivered these significant improvements: P50 latency for writing to a Queue has dropped from ~200ms to ~60ms. Maximum throughput for a Queue has increased from 400 to 5000 messages per second. Maximum consumer concurrency has increased from 20 to 250 invocations. What's next for Queues We plan on leveraging the performance improvements in the new beta version of Durable Objects which use SQLite to continue to improve throughput/latency in Queues. We will soon be adding message management features to Queues so that you can take actions to purge messages in a queue, pause consumption of messages, or “redrive”/move messages from one queue to another (for example messages that have been sent to a Dead Letter Queue could be “redriven” or moved back to the original queue). Work to make Queues the \"event hub\" for the Cloudflare Developer Platform: Create a low-friction way for events emitted from other Cloudflare services with event schemas to be sent to Queues. Build multi-Consumer support for Queues so that Queues are no longer limited to one Consumer per queue. To start using Queues, head over to our Getting Started guide. Do distributed systems like Cloudflare Queues and Durable Objects interest you? Would you like to help build them at Cloudflare? We're Hiring! Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . Product News Cloudflare Queues Cloudflare Workers Durable Objects Developers Developer Platform",
+    "quality_score": 9,
+    "modules": [
+      "architecture_patterns",
+      "performance",
+      "concurrency",
+      "design_patterns"
+    ]
+  },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/search/reimagining-linkedins-search-stack",
+    "title": "Reimagining LinkedIn's search tech stack",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "Co-authors: Jiahao Xu , Xiaojing Ma , Sriram Vasudevan , Muchen Wu , Rachel Zheng , Benjamin Le , Shaobo Zhang , Sarang Metkar , Rupesh Gupta , Qianqi Kay Shen , Ali Hooshmand , David Nicolás Racca , Vivek Katarya , Kayhan Behdin , Igor Lapchuk , Xueying Lu , Lingyu(Claire) Zhang , Gokulraj Mohanasundaram , Juan Pablo Bottaro , Lily(Jiayu) Li , Yanbo Li , Guoyao L. , Caleb Johnson , and Sundara Raman Ramachandran At LinkedIn, our mission is to connect professionals to opportunity. Search plays a central role in this by helping members discover jobs, people, and knowledge that move their careers forward. As the professional landscape evolves, we strive to deliver search experiences that feel relevant, intuitive, personalized, and predictive of what truly matters, from applying to the right job to forming the right connection. That’s why we’ve recently introduced AI Job Search and AI-powered People Search , which go beyond keyword matching and better understand member intent. These products reimagine LinkedIn search, using large language models (LLMs) to create a semantic search experience. Instead of relying on exact word overlap between queries and postings, it interprets natural language to infer user goals and preferences. This semantic representation allows for more flexible and accurate retrieval, overcoming vocabulary gaps and aligning search results with how members naturally express their career ambitions. Deploying LLMs at LinkedIn’s scale—serving millions of real-time queries per second—requires innovation that balances quality and efficiency. In this blog, we’ll share how we transformed our overarching search experience at LinkedIn, including the challenges and decisions that went into creating a scalable LLM-based stack and how the technology is powering a smarter, faster, and more personalized experience that helps every member find the most relevant opportunities and connections. Semantic search’s high level infrastructure When a member submits a query in the search bar, a query understanding module processes the input text, creates a query embedding, and performs embedding-based retrieval (EBR) on CUDA-enabled GPUs using exhaustive vector search ( paper on GPU CUDA-based Search , paper on GPU PyTorch-based Search ) to assemble a broad set of candidate documents. The ranking stage then refines these candidates through a Cross-Encoder Small Language Model (SLM) deployed on SGLang, which combines the query, job, and member features to generate relevance and engagement scores for final ranking. To maintain scalability and efficiency, the ranking pipeline integrates several optimization techniques ( paper on efficient LLM inference infrastructure , context compression paper ): score caching, a ranking-depth controller to manage how many candidates progress to deeper ranking, and traffic shaping to balance load during peak times—all designed to enhance latency and result quality. The features and concise job representations consumed by the SLM are produced through a hybrid inference pipeline: a large-scale offline workflow using Spark and Flyte, and a low-latency nearline system using Flink. These embeddings and summaries are stored in distributed storage and retrieved on demand with minimal latency. In the final stage, the auction layer applies budget and pacing strategies to balance user relevance, engagement, and business metrics, ensuring a healthy equilibrium between recall and precision while maximizing member satisfaction. Figure 1 below provides an overview of the system architecture. Figure 1. Overall pipeline of LinkedIn’s semantic search Product policy relevance measurement Measuring relevance quality is essential to delivering a great search experience on LinkedIn. We define product policies that specify how to rate each query–document pair on a five-point scale and use LLM judges to apply these ratings at a massive scale, far beyond what manual evaluation can achieve. These judges are tightly aligned with product managers and engineers through iterative feedback to ensure high agreement. They not only grade tens of millions of query–document pairs daily for relevance measurement but also generate labeled data for training our retrieval and ranking systems, ensuring we optimize search quality according to product policy. Defining product policy and golden product manager grades A strong LLM judge begins with a clear product policy and high-quality product manager “golden” grades that demonstrate how that policy should be applied. Product managers act as a “Supreme Court,” regularly calibrating to resolve judgment differences and maintain a shared definition of what constitutes a good query–document match. These discussions refine the policy, making it clearer and less subjective. Once product managers reach high agreement (weighted Cohen’s Kappa ≥ 0.8), their labels are considered reliable ground truth. To build a comprehensive golden dataset across diverse user queries, we first categorize queries by attributes (e.g., title–company, name–company, title–skill). Each category is then split into existing user queries and aspirational queries that represent strategic areas we want to excel in. We stratify-sample query–document pairs from each bucket to ensure broad coverage before sending them to product managers for grading. Training the LLM judge Our LLM judge must meet two requirements: high agreement with product managers and the ability to grade tens of millions of query–document pairs daily. To maximize agreement, we collaborate with product managers to prompt-engineer state-of-the-art LLMs, optimizing the weighted Cohen’s Kappa Score on golden data. The prompt encodes product-policy guidelines and few-shot examples to drive consistency. While these large models produce high-quality judgments, they cannot meet our throughput needs. To scale, we distill them into a smaller 8B-parameter evaluator LLM. Through supervised fine-tuning on a diverse dataset spanning all query categories and grades, we maintain only small drops in agreement—verified via the Kappa Score on the golden set—while achieving massive efficiency gains. Continuously measuring quality of search system Once we have our scalable LLM judge, we can finally build continuous relevance measurement of our system. On a regular basis, we build workflows that perform the following steps: Stratify sample or synthesize a diverse set of queries based on the query categories defined earlier Retrieve the documents returned from executing those queries Decorate documents with additional information required for the correct evaluation/judgement Grade the documents returned using our LLM judge Calculate aggregate precision, recall, and NDCG metrics Figure 2. Flow of the evaluation process This workflow serves three primary functions: Continuously monitoring the relevance of the overall system Evaluating experiments involving underlying ranking and retrieval subsystems Distilling student ranking and retrieval models by leveraging evaluation results Search quality modeling Search quality is a fundamental requirement for any search product, and achieving it depends on building the core components of a modern search engine. Below, we describe how we leveraged LLMs to enable query understanding, semantic embedding–based retrieval, and cross-encoder ranking. Embedding-based retrieval Retrieval is the stage of a search system that identifies a broad set of potentially relevant results from a large corpus. Because no search engine can score every document for every query in real time, we need an efficient retrieval layer to narrow the search space before ranking. Our retrieval sits on top of our GPU-enabled embedding-based retrieval (EBR) system. We built the EBR model by fine-tuning an open-source LLM embedding model to encode queries and jobs into dense vectors. We train on millions of real query–job pairs sampled from production logs, with relevance labels provided by an LLM-based judge. Each query includes its natural language text and query-understanding tags (e.g. workplace type or company), and each job is represented by structured metadata (title, company) plus its description. Importantly, this work also demonstrates a practical path for deploying LLM-based components in real production search systems. The semantic search can directly understand human language as queries, enabling much more intuitive search experiences. This has been a particularly inspiring aspect of the project: bringing modern LLM capabilities into a high-scale, real-time application that serves millions of users. EBR relevance modeling To ensure consistency between training and serving, every query is formatted using a lightweight prompt template: Instruct: Given a job search query, retrieve relevant job postings Query: {query} {Optional Aspect eg. Company}: {company} The model uses a dual-tower (bi-encoder) architecture: one encoder maps queries to embeddings and the other maps jobs, projecting them into a shared semantic space. Training is end-to-end: we fine-tune all model parameters using Hugging Face Accelerate (with PyTorch FSDP) across multiple GPUs. We optimize a contrastive InfoNCE loss combined with a margin-based ranking loss. For example, given a query q, a positive job d+ , and negatives {d-k} , we define: where sim(·, ·) is the dot-product similarity of embeddings and τ is a temperature parameter. We also enhance training with hard positives and hard negatives mined from LLM-judged data. Hard positives are LLM-labeled relevant jobs that the current EBR model ranks low, and hard negatives are non-relevant jobs that the model ranks high. These examples reveal exactly where the model struggles. We then build targeted positive–negative pairs. A pairwise margin loss is applied to these curated cases to explicitly lift hard positives and suppress hard negatives, improving ranking where it matters most: which encourages sim(q,d+) to exceed sim(q,d-) by a margin γ. The total loss is a weighted sum, e.g.: combining the benefits of contrastive and pairwise ranking. We use multiple evaluation pipelines. First, we leverage production logs for counterfactual evaluation: re-ranking the historical candidate list for each query and computing precision, recall and NDCG against true labels. Second, we run offline KNN simulations: we embed held-out queries and job corpus, retrieve nearest neighbors, and directly measure retrieval metrics on this test set. Finally, we integrate the new model into our online serving stack on a subset of traffic to collect end-to-end metrics. These offline metrics provide quick feedback, and the counterfactual log analysis helps estimate the model’s user impact without a full live experiment. Productionization of retrieval In production, we precompute and store all job embeddings in GPU-backed indexes. At runtime, the incoming query is encoded by the LLM with the prompt aligned with the LLM pre-training to produce its embedding. We then perform an exhaustive k-nearest-neighbor search over the job embedding index using dot-product similarity, returning the top‑K jobs. This offline indexing and fast online query encoding makes retrieval extremely efficient, enabling low-latency serving of industry-scale semantic search products. Query understanding At the moment a member enters a query into the search bar—the entry point of semantic search—we apply a unified LLM-based understanding layer that interprets intent and converts free text into structured signals. For both AI Job Search and AI-powered People Search, this layer uses fine-tuned 1.5–4B parameter models that meet LinkedIn’s latency requirements while delivering high-precision structured outputs ( paper ). A single model handles intent classification, facet extraction, and profile-aware rewriting, replacing multiple brittle NER and heuristic components. The resulting attributes (e.g., title, company, school, location) feed directly into retrieval and ranking. An intelligent routing layer works alongside this. A lightweight encoder classifies query types at high QPS and performs policy-based safety checks before sending the query down the appropriate path—LLM-powered semantic interpretation for ambiguous inputs or efficient keyword retrieval for precise name and entity lookups. Together, these components provide a consistent, centrally governed semantic interface for People and Job Search, boosting relevance, simplifying the system, and enabling Semantic Search to scale across LinkedIn’s global traffic. Small language model ranking The ranking module of semantic search utilizes a Small Language Model (SLM) to estimate how relevant a user’s search query q is to each retrieved job_i. The SLM follows a decoder-only architecture. For example, for job search we represent the structured attributes of a job — including its title, company, location, employment type, and remote-work status. Meanwhile people search uses information from the member’s profile including their name, company information, position information, educational information and location. For each query–job pair (q,i), we build a structured prompt defined as Here, the system prefix and suffix contain chat-template tags and explicit instructions guiding the model to determine whether the given job matches the query. When this prompt is passed through the decoder, it produces logits corresponding to the next token. Let logit yes and logit no represent the logits for the tokens “yes” and “no,” respectively. Following prior studies, we compute: which yields probabilities used to rank job items by their relevance to the user’s query. SLM training pipeline for relevance quality Training of the SLM follows a multi-stage process. First, we distill the 7B-parameter teacher model into a compact 0.6B model that can generate graded relevance labels along with rationales. Next, the teacher’s ordinal grades are converted into “soft labels” ( p yes ,p no ), representing probabilistic supervision. We then perform supervised fine-tuning (SFT) to minimize the Kullback–Leibler (KL) divergence between the teacher’s soft targets and the SLM’s predicted probabilities—effectively converting the reasoning-oriented model into a binary relevance classifier: We construct training labels by sampling real query–item pairs from user interaction logs and annotating them using a full-scale Large Language Model (LLM). Each pair is evaluated through a structured prompt of the following format: [CRITERIA]: <matching guidelines> [EXAMPLES]: <reasoning and output format> [QUERY]: <query text> [CANDIDATE]: <item text> Analyze the query–candidate pair and assess how well they align.Provide a single matching score (0, 1, 2, 3, or 4) along with a brief explanation of your reasoning. The LLM’s response includes both a graded relevance score and an accompanying rationale, ensuring that the generated labels are interpretable and consistent with the defined matching criteria. The model is trained on logged pairs query–job pairs for up to five epochs using the prompt structure. Since job descriptions dominate the input and vary substantially in length (median ≈ 900 tokens; maximum > 2300), we truncate them to ensure the total prompt length does not exceed 2048 tokens during both training and inference. For evaluation, we use a holdout dataset labeled by the teacher model. The SLM ranks job candidates based on p yes ,p no , and system performance is measured using Normalized Discounted Cumulative Gain at rank 10 (NDCG@10). Training for multiple objectives We extend the training paradigm to predict both relevance and engagement within the model, we train a smaller cross-encoder language model (the SLM) using multi-teacher, multi-task distillation. The teachers include: The product policy LLM for relevance scoring. Other large models that predict member actions—such as job views, applies, recruiter accepts, or (in people search) view profile, connecting, messaging, or following. For training at scale, we use multiple 1.7B teacher models. To make this feasible, we first distilled our 7B product policy model into a smaller 1.7B version, which serves as a strong but efficient teacher alongside others. During the training process, these teachers run in real time on sampled production query–document pairs, producing soft probability scores that act as supervision targets. The student SLM is trained with KL divergence loss to align its output distribution with the ensemble of teachers. This setup lets us train on real-world data at scale: teacher models provide rich, nuanced probability signals, and the distilled student captures much of their reasoning capacity while remaining lightweight enough to serve millions of queries per second in production. We have multiple steps of distillation to SLM described in Figure 3, and we show the metrics after distillation in Table 1. Figure 3. Multi-teacher distillation of SLM NDCG@10 Apply AUC Click AUC Relevance Teacher 1.7B 0.9484 - - Engagement Teacher 1.7B - 0.8049 0.6772 SLM 0.6B (distilled) 0.9239 0.8007 0.6704 Explainability in search To make LinkedIn’s AI-powered People Search more transparent, we introduced semantic, context-aware snippets that show why a result matches a member’s query. Snippets highlight the most relevant terms and maintain low latency through lazy loading, caching. The approach uses semantic similarity between the query embedding and precomputed phrase embeddings (unigrams/bigrams) from profile text, surfacing the highest-scoring phrases as natural, human-readable snippets. In the offline pipeline, we extract phrases from each profile section (e.g., summary, experience, education), encode them into embeddings in a Venice key-value store . This index is refreshed periodically to capture profile updates, with evaluation workflows ensuring quality and readability. At search time, the snippetting midtier receives the query embedding and candidate profiles, fetches stored phrase embeddings, computes cosine similarity, selects top phrases, and expands them into readable snippets using simple heuristics. The final output is a ranked list of profiles paired with snippets and highlighting metadata. Reasoning To improve transparency in search results, we introduced a lightweight reasoning module that explains how LinkedIn interprets a member’s query. When a query is submitted, the LLM-based understanding model extracts facets, classifies intent, and—using predefined guidelines—produces a concise “thinking state” describing how the query is parsed, along with a brief summary of the types of profiles retrieved. For unsupported or negatively intended queries, the module instead provides a clear explanation of why results may be limited. For example, “berkeley community development specialist msa professional services” becomes “Searching for community development specialist at MSA Professional Services affiliated with Berkeley.” To keep latency low, reasoning outputs are cached in Couchbase and reused for repeated or semantically similar queries. SLM ranking model inference efficiency We employed multiple techniques to improve efficiency of the inference system at LinkedIn including: Model pruning, where we remove Fully Connected Layers and remove whole transformer layers. Context pruning, by summarization or embedding compression ( paper on AI modeling techniques for efficiency of SLM inference ). Model pruning To boost inference throughput, we apply model compression via structured pruning—a technique that removes redundant components to reduce model size and computation with minimal quality loss. Because our models run on GPU infrastructure, we focus on structured pruning, which removes entire neurons, attention heads, or transformer layers so the resulting model can run efficiently on standard GPU kernels. This yields real throughput and latency gains, unlike unstructured pruning, which drops individual weights but often provides no meaningful speedup without specialized hardware. We prune hidden neurons in Multi-layer Perceptron (MLP) blocks and attention heads in self-attention modules, and we remove full transformer layers to study trade-offs between size, efficiency, and performance ( paper ). Pruning MLP neurons shrinks intermediate activations, while pruning layers reduces network depth—both producing lighter, faster models. After pruning, we fine-tune the model to recover any accuracy loss, ensuring efficiency improvements do not compromise quality. Context pruning Item descriptions are long (median ~900 tokens and up to 2,300) making them over 94% of the SLM prompt and causing ~10% of inputs to be truncated at the 2,048-token limit. Removing descriptions severely degrades relevance quality, confirming they carry essential semantic information. To handle this, we use a slightly larger 1.7B LLM to summarize descriptions offline, where item-specific inference can be precomputed and refreshed via streaming updates. Because job descriptions include verbose, often irrelevant details, we train the summarizer with a semantics-preserving loss and a length-aware reward ( paper ). We fine-tune the model using RL to produce concise summaries, balancing (1) reduced input length and (2) preserved model quality. The reward combines: a semantic consistency term, measured via KL divergence between the SLM’s output distributions on summarized vs. raw text, and a length penalty that discourages overly long summaries. The weighting factor w controls the trade-off between brevity and fidelity, enabling summaries that retain meaning while reducing inference cost. Embedding compression Since the computational cost of LLM inference increases quadratically with input length, reducing the number of tokens can greatly decrease overall inference expense. On top of model pruning and summarization, we invented a text–embedding hybrid interaction architecture that condenses each item’s text into a single-token embedding generated by an encoder LLM ( paper ). These embeddings are then merged with other textual signals and passed to a ranker LLM for relevance estimation. Because the item embeddings are precomputed and stored in a nearline cache, the volume of text processed during online inference is significantly reduced, resulting in notable improvements in efficiency. We jointly train the hierarchy of two language models, where one model is producing embedding of the item description and the other model does the ranking of the candidates. On the figure below we show we use two 0.6B models trained jointly. As a result we could replace most of the job description with just a single embedding. We may keep important raw fields with a limited number of text tokens such as title of the job, company name, location or member name in the input. Figure 4. Hierarchy of SLMs trained and served in production Overall modeling quality and throughput In the table below we show how quality and inference throughput changed as we improved the modeling technology. As part of the modeling improvement we introduced multitask learning with over 6 tasks of member actions to the model output predictions including relevance, and, for example, were able to improve Click AUC of the model from 0.61 ( baseline ) to 0.67 for Job Ranking. Setup NDCG@10 Throughput (ITEMS/SEC/GPU) SLM with raw-text 0.9432 290 Pruned SLM and SUMMARIZED TEXT 0.9218 2200 SLM with EMBEDDING COMPRESSION 0.9239 22000 Embedding based retrieval (EBR) baseline 0.838 >1.6B, exhaustive search on GPU Looking ahead We built a modern semantic search system by first establishing an LLM-based quality evaluation framework grounded in product policy. On top of this foundation, we introduced LLM-powered query understanding, semantic retrieval, and ranking models—driving double-digit improvements in search quality and member engagement. Just as importantly, we achieved this while keeping inference costs comparable to traditional RecSys models previously running in production. As we continue refining Semantic Search, our focus remains on empowering every member to discover the right opportunity, connection, or insight—at the right time. Acknowledgements To the more than 100 team members who’ve contributed to AI-powered job search and people search across infrastructure, AI modeling, user experience, and data science: thank you for your creativity, grit, and teamwork. This milestone belongs to all of us.",
+    "quality_score": 8,
+    "modules": [
+      "architecture_patterns",
+      "performance",
+      "ai_assisted"
+    ]
+  },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/infrastructure/introducing-northguard-and-xinfra",
+    "title": "Introducing Northguard and Xinfra: scalable log storage at LinkedIn",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "Data is at the heart of our thousands of services at LinkedIn. Services want to subscribe to data published by other services. These subscribers need to process all the data from the originating services, or publishers, not just the latest updates. But these subscribers can have bugs, so it's desirable for these services to be able to reprocess the data as well. This allows for them to fix their bugs, reprocess the data, and verify their service is working correctly. To make this possible, 15 years ago we developed Kafka, a centralized pipeline for these publishers and subscribers. Kafka solved common problems in distributed systems such as storing large amounts of data in a consistent, replayable, and fault-tolerant way. It became the backbone of our infrastructure, supporting not just user activity events but also logging, metrics, tracing, application-to-application messaging, near real-time applications, stream processing, data lake import/export, AI features, and even database replication. This ordered data pipeline is known as a log, and the pattern of separating data producers from data consumers is called the Pub/Sub pattern. However, as LinkedIn grew and our use cases became more demanding, it became increasingly difficult to scale and operate Kafka. That’s why we’re moving to the next step on our journey with Northguard, a log storage system with improved scalability and operability. In this blog, we’ll discuss how we built Northguard and its benefits. We'll also introduce Xinfra, a virtualized Pub/Sub layer over Northguard, and explain how we transitioned from Kafka to Northguard. Why we needed a new solution In 2010, LinkedIn had 90 million members. Today, we serve over 1.2 billion members on LinkedIn. Unsurprisingly, this increase has created some challenges over the years, making it difficult to keep up with the rapid growth in the number, volume, and complexity of Kafka use cases. Supporting these use-cases meant running Kafka at a scale of over 32T records/day at 17 PB/day on 400K topics distributed across 10K+ machines within 150 clusters. Some of the main challenges: Scalability – Onboarding more use cases not only resulted in more traffic, but also more metadata, and more machines to support the added traffic. Metadata and cluster size bottlenecks were getting harder to tackle and meant setting up more clusters. Operability – Added traffic led to load balancing challenges, and with the over 100 clusters we were now running, we now needed an ecosystem of services just to manage all the clusters. Availability – limited by partitions being a heavyweight unit for replication. Consistency – was often traded off in favor of availability due to the availability impact of partitions being the unit of replication. Durability – Relatively weak guarantees were insufficient for our more critical applications. We needed a system that scales well not just in terms of data, but also in terms of its metadata and cluster size, all while supporting lights-out operations with even load distribution by design and fast cluster deployments, regardless of scale. Additionally, we required strong consistency in both our data and metadata, along with high throughput, low latency, highly available, high durability, low cost, compatibility with various types of hardware, pluggability, and testability. Introducing Northguard Northguard is a log storage system with a focus on scalability and operability. To achieve high scalability, Northguard shards its data and metadata, maintains minimal global state, and uses a decentralized group membership protocol. Its operability leans on log striping to distribute load across the cluster evenly by design. Northguard is run as a cluster of brokers which only interact with clients that connect to them and other brokers within the cluster. Let's delve into the foundational elements that power Northguard: its data model, metadata model, and protocols that underpin it. Data model Clients produce and consume records, the most granular unit of data to be read or written. Records (figure 1) are composed of a key, a value, as well as user-defined headers, all of which are just a sequence of bytes. Figure 1. a lone record A segment (figure 2) is a sequence of records. Segments are the unit of replication. They can either be active or sealed, where an active one can have records appended to it and a sealed one is immutable. Records in a segment are stamped with a logical offset relative to the start of the segment. A segment can be sealed either due to replica failure, the segment reaching a size limit of 1GB, or from the segment being active for over an hour. Figure 2. A segment with multiple records A range (figure 3) acts as Northguard's log abstraction. It's a sequence of segments associated with a contiguous range of a keyspace. Ranges can either be active or sealed. An active range could potentially have no segments at all, could have only sealed segments, or could potentially have its most recent segment be active. A sealed range could potentially have no segments at all, or could have only sealed segments, but cannot have an active segment. Figure 3. A range containing three segments A topic (figure 4) is a named collection of ranges that covers the full keyspace when combined. A topic's ranges can be split or merged. Splitting a range seals that range and creates two new ranges. Merging two ranges seals those two ranges and creates a new child range. A range can only be merged with its unique buddy range, exactly the same way that the buddy memory allocator algorithm works. A topic can be sealed or deleted. Sealing a topic seals all of its ranges. Deleting a topic deletes all of its ranges. Figure 4. A topic with a few ranges that have been split and merged A topic is configured with a storage policy. Storage policies are provided by administrators of the cluster. A storage policy has a name, a retention period that defines when segments should be deleted, as well as a set of constraints. A constraint has an expression that defines which brokers are allowed to be chosen as a replica of a segment, and how many. These expressions are based on keys and values bound to brokers called attributes. These attributes are bound to a broker process by administrators. Policies and attributes are a powerful abstraction. For example, Northguard itself has no native understanding of racks, datacenters, etc. Administrators at LinkedIn just encode this state in the policies and attributes on the brokers we deploy, making policies and attributes a generalized solution to rack-aware replica assignment. We even use policies and attributes to distribute replicas in a way that allows us to safely deploy builds and configs to clusters in constant time regardless of cluster size. Log striping The more coarse-grained your unit of replication, the more you need to worry about resource skew in your cluster. Balancing out the resource skew is difficult, and you might even rely on an entire system, like LinkedIn’s Cruise Control , just to balance resource distribution across the cluster. When your unit of replication is as coarse-grained as the log, each replica is responsible for storing a copy of the entire log. This causes a number of resource skew problems: Resource skew if brokers have more logs than other brokers. New brokers added to the cluster will remain unused until new logs are assigned onto it or move existing logs onto it. Logs are created infrequently, and moving existing logs causes operability pain. Resource skew if an unlucky broker has more resource intensive logs than other brokers. Northguard ranges avoid these issues by implementing log striping, meaning that it breaks a log into smaller chunks for balancing IO load. These chunks have their own replica sets as opposed to the log. Ranges and segments are the Northguard analog of logs and chunks. Since segments are created relatively often, we don’t need to move existing segments onto new brokers. New brokers just organically start becoming segment replicas of new segments. This also means that unlucky combinations of segments landing on a broker aren’t an issue, as it will sort itself out when new segments are created and assigned to other brokers. The cluster balances on its own. Figure 5. A cluster with a newly added Broker 5 Figure 6. A new segment gets added to the range and gets assigned to Broker 5 Ranges vs. indexed partitions When deciding how to scale throughput to topics with these striped logs, we wanted to: have correct record-to-log placement by clients minimize interruption to unrelated logs maintain some level of ordering guarantees facilitate stream processing frameworks in avoiding shuffles Ranges checked all the boxes for us. Whereas indexed partitions would’ve required a “stop-the-world” synchronization barrier for producing clients to continue to send records to the right log, ranges only interrupt clients producing to the range being split. This range split acts as the synchronization barrier, and forces clients to react to the changes made to the topic before continuing to produce. On top of that, you get some nice ordering guarantees, with range splits and merges still offering a total ordering: if a range R1 is split into R2 and R3: all records in R1 happens-before records in R2 all records in R1 happens-before records in R3 if ranges R2 and R3 are merged into R4: all records in R2 happens-before records in R4 all records in R3 happens-before records in R4 Stream processing jobs often involve joining multiple streams. To perform the join, records with the same join key across these streams need to be processed together. We can do this effortlessly by leveraging the key partitioning provided by the log storage system, as long as the partitioning of the join keys across these streams is aligned. However, if the streams being joined have unaligned partitioning of the join keys (e.g., one stream with 10 partitions and another with 16 partitions), the stream processing jobs may need to introduce a shuffle stage to repartition the records, which can be costly. Ranges offer a better solution for stream processing, as Northguard’s buddy-style ranges of different topics inherently align. We can avoid the shuffle step entirely. Metadata model Northguard has metadata for managing topics, ranges, and segments. A cluster has one or more vnodes, each storing a shard of the cluster's metadata. A vnode is a fault-tolerant replicated state machine backed by Raft and acts as the core building block behind Northguard's distributed metadata storage and metadata management. Figure 7. A vnode’s Raft group A coordinator is the leader of a given vnode. It manages all the metadata owned by a vnode. This is where the “business logic” of the metadata lives. When the vnode's state machine elects a new leader, the coordinator of the vnode moves to the new leader as well. The coordinator persists state in the vnode state machine so that a newly elected coordinator can pick up from where the previous one left off. For topics owned by a vnode, the coordinator tracks changes such as sealing or deleting the topic and splitting or merging ranges from that topic. For ranges owned by a vnode, the coordinator tracks metadata like the range's active/sealed/deleting state, the creation time, the retention, and the topic name. It also stores metadata on the segments like the segment's replica set, the active/sealed/reassigning state of the segment, the start offset and length of the segment, the create time, and seal time of the segment. The coordinator uses this segment state to initiate sealed segment replication for under-replicated segments, making Northguard self-healing. The Dynamically-Sharded Replicated State Machine (DS-RSM) is a collection of vnodes covering a hash ring. Metadata is sharded across vnodes using consistent hashing. Topic metadata is hashed by topic name, while range and segment metadata is hashed by range ID. This minimizes metadata hotspots. Figure 8. A DS-RSM with 3 vnodes A cluster can be configured with a metadata policy provided by administrators of the cluster. A metadata policy has a name and one or more constraints. These constraints behave exactly the same as the ones in storage policies, where its expressions are once again based on the attribute keys and values bound to brokers by administrators. The metadata policy defines how replicas of the vnodes are chosen. Cluster state and membership Northguard uses SWIM as its scalable group membership protocol. SWIM employs random probing for failure detection but infection-style dissemination for membership changes and broadcasts. We use this broadcast mechanism to distribute minimal global cluster state such as basic host, port, and attributes of the brokers in the cluster as well as minimal information about this DS-RSM hash ring such as each vnode's hash ring start and end boundaries, the vnode leader, vnode current term, and vnode replicas. This facilitates routing of certain requests to the appropriate vnode leader. Figure 9. The SWIM protocol in action Protocols Northguard’s metadata protocols are unary: one request results in one response. Examples include CreateTopicRequest, DeleteTopicRequest, TopicMetadataRequest, and SegmentMetadataRequest. Clients send these requests to any broker in the cluster, which acts as a proxy. The broker uses its local copy of gossipped global state to determine which vnode can serve the request and relays it to the leader of that vnode. The response follows the same path back to the client. While metadata protocols are unary, Northguard’s produce, consume, and replication protocols are all sessionized streaming protocols. We sessionize state to the stream to avoid protocol overhead. These protocols use pipelining to keep data moving and windowing to control how much can be pipelined at any time. Let’s take produce streams as an example. The producing client generates a stream ID and initiates a handshake with the active segment leader, learning the initial window size accepted by the broker. The producer sends multiple Appends to the broker as long as the records haven’t exceeded the window. Each append contains the stream ID, sequence number, and one or more records. The broker can send M Acks for N Appends and is only allowed to send the producer an Ack for records that have been committed. These Acks include an acknowledgement number correlating with the sequence number from Append and an updated window for more Appends. Figure 10. A producer sending records and getting acknowledgements over a produce stream Consume streams are very similar to produce streams but with records flowing in the reverse direction and the client determining the window size. After the handshake, the consumer sends Reads telling the broker their progression of the stream and potentially updated window size. Brokers send Pushes as long as the records being pushed haven’t exceeded the window. Figure 11. A consumer receiving records and asking for more over a consume stream Active segment replication works similarly to produce streams, using record offsets instead of sequence numbers. ReplicaAppends also include a committed state for followers to track progress of what’s been committed. Figure 12. An active segment follower receiving records and asking for more over a replica stream Sealed segment replication replenishes under-replicated segments, and is literally the consume protocol, but between two brokers. Segment storage Segment storage in Northguard is pluggable, but the primary implementation, called the “fps store,” has a write-ahead-log (WAL), creates a file-per-segment, uses Direct I/O, and maintains a sparse index in RocksDB. Appends are accumulated in a batch until sufficient time has passed (ex: 10 ms), the batch exceeds a configurable size, or the batch exceeds a configurable number of appends. Once ready to flush the batch, the store synchronously writes to the WAL, appends records to one or more segment files, fsyncs these files, and updates the index. With Direct I/O, Northguard avoids double buffering, and instead uses application-level caching that leverages its knowledge of established consume streams to populate the cache. Direct I/O also enhances Northguard's durability by maintaining consistent state across fsync failures. It helps us avoid cache degradation issues we might’ve otherwise seen in the page cache on replicas that clients aren’t consuming from, or when, for example, consumers or sealed segment replication wants to consume old segments. Testing On top of having thousands of tests, microbenchmarks, and a rigorous certification pipeline, we also run Northguard under deterministic simulation. This means we run a cluster as well as clients under a single thread and swap out nondeterministic components with deterministic versions of them. We simulate years of activity under various scenarios every day, where the scenarios are injecting many kinds of faults into the simulation: broker shutdown rolling restarts network partition packet loss packet corruption disk corruption disk io errors config deployments We can easily share, replay, and step through failed runs, and this helps us catch bugs before they happen in production. Evaluation Let’s recap some of the key points: Kafka Northguard Scalability: Data logs bounded by machine disk capacity logs bounded by cluster disk capacity Scalability: Metadata Control Plane Bottlenecked by: 1 controller 1 replicated state machine Stressed at millions of partition replicas. N (128+) coordinators N (128+) sharded replicated state machines Does fine with millions of segment replicas. Scalability: Metadata Distribution Global topic metadata state Minimal global state Scalability: Cluster Size Centralized group membership heartbeating to controller Scalable gossip group membership Operability: Cluster Count 80%+ fewer Operability: Balanced Data Distribution External service to keep the cluster balanced. Balanced by design Operability: Metadata Distribution N/A (metadata isn’t sharded) Balanced by design Operability: Adding Brokers External service to move existing data onto the new broker to keep the cluster balanced. No need to move existing data onto new brokers. Operability: Replenish Replication Factor External service to restore replication factor while keeping the cluster balanced. Self-healing Availability Produce availability degrades as replicas fail Striping gives us higher availability. Producers move onto new segments when a segment replica fails. Consistency Partitions as the unit of replication means long periods to replenish. We configured topics to sacrifice consistency for produce availability. Segments as the unit of replication and log striping means that we don't need to sacrifice consistency in order to preserve produce availability when brokers start to fail. Durability Lazy syncs: 10 seconds 20k records Fsync on all replicas before produce ack: 10 milliseconds 20k records 10 MB Performance Meets LinkedIn’s SLOs for Kafka with better durability. Migrating from Kafka to Northguard Migrating user topics from one Kafka cluster to another is difficult, and migrating users from one Pub/Sub system (Kafka) to another (Northguard) is even harder. Thousands of applications, including mission-critical ones, need to be migrated. We’re talking about migrating several hundreds of thousands of topics and hundreds of clusters. Application downtime is unacceptable during migration, and handling individual applications separately is not scalable. Part of the migration challenge comes from users relying on the Kafka client, which talks to a single Kafka cluster at a time. The lack of virtualization complicates the transition to a new system with a different data model and protocols. Another challenge in LinkedIn’s infrastructure is that adding a new cluster to handle traffic growth is often not transparent to the users. Pub/Sub Virtualization can help by hiding physical aspects of a Pub/Sub cluster, making it possible to virtually grow a cluster without requiring changes from applications. Introducing Xinfra Xinfra (pronounced as ZIN-frah) is a virtualized Pub/Sub layer supporting both Northguard and Kafka. It offers a unified Pub/Sub experience for customers. With virtualization, a Xinfra topic is no longer tied to a single Kafka cluster. A Xinfra topic has epochs (which captures the topic change history), allowing it to have an epoch in a Kafka cluster and another in a Northguard cluster, as seen below in figure 13. Figure 13. An example Xinfra topic with multiple epochs This means users don't need to change the topic when it is migrated between clusters at runtime. Topic virtualization also allows grouping topics located in different physical clusters under the same virtualized cluster. This enables Xinfra to federate multiple physical clusters to support large use cases that would otherwise be infeasible with a single physical cluster. Figure 14. An example use case where a consumer subscribes to three topics under the same virtual cluster, with each topic located in different clusters Users interact with Northguard and Kafka via Xinfra clients, which provide a unified API for accessing pub/sub infrastructure at LinkedIn. Each epoch in a Xinfra topic contains a list of shards (similar to topic partition in Kafka). Xinfra producers offer \"produce to a topic\" and \"produce to a shard\" APIs. Xinfra consumers provide both manual shard assignment-based consumption and consumer group management-based consumption. The Xinfra-metadata-service is a robust Pub/Sub ecosystem management system for Xinfra clients. It provides a virtualized and unified view across multiple Pub/Sub systems, streamlining operations and abstracting away the complexities of underlying infrastructure. Additionally, it offers essential Pub/Sub capabilities, such as consumer group management and checkpoint storage, at the virtual layer—ensuring a seamless and consistent experience for the users. Xinfra-metadata-service handles virtual topics and clusters, including mapping between virtual and physical topics/shards. It also enables essential operations such as creating, updating, deleting, and migrating topics at the virtual layer. To ensure persistence, all metadata for both virtual and physical topics/clusters is stored in MySQL. Xinfra-metadata-service also keeps track of all connected Xinfra producers and consumers, providing consumer group management and checkpoint storage over the virtual layer, ensuring a seamless experience for users. Xinfra-metadata-service leverages Zookeeper to maintain cluster consistency, handling membership, leadership, and group allocation during consumer group management. It ensures incremental group rebalancing, fair shard allocation within consumer groups, and resilience against network partitions or crashes. For checkpoint storage, Xinfra-metadata-service utilizes Vitess, a sharded MySQL solution, along with a coalescing buffer for efficiency. Additionally, it integrates Couchbase as a caching layer to achieve low-latency checkpoint reads and writes. The Xinfra-metadata-service Xinfra-based pub/sub migration Xinfra natively supports topic migration from one cluster to another and from one Pub/Sub system to another. It leverages dual-write approaches and staged migration steps to migrate user topics. At a high level, the migration process begins by creating a new topic epoch in the target cluster. Producers are migrated first, followed by consumers. Producers perform dual writes during the migration period to allow a safe rollback in case of migration failure. Ordering guarantees are maintained through the migration process. The migration is transparent to users, and the migration state is delivered via Xinfra topic metadata update to the client. Producers and consumers continue to work throughout the migration process. The final stage of migration involves turning off dual writes. Post-migration, consumers can still read through epochs, including data in the previous epoch, until the data is deleted by retention policy. Current state and what’s next Xinfra has been widely adopted within LinkedIn, with over 90% applications running Xinfra clients. We have successfully migrated thousands of topics from Kafka to Northguard, accounting for trillions of records per day. Looking ahead, our focus will be on driving even greater adoption of Northguard and Xinfra, adding features such as auto-scaling topics based on traffic growth, and enhancing fault tolerance for virtualized topic operations. We are thrilled to continue this journey!",
+    "quality_score": 9,
+    "modules": [
+      "architecture_patterns",
+      "concurrency",
+      "performance"
+    ]
+  },
+  {
+    "url": "https://github.blog/engineering/engineering-principles/how-githubs-developer-experience-team-improved-innerloop-development/",
+    "title": "How GitHub's Developer Experience team improved innerloop development",
+    "source_name": "The GitHub Blog",
+    "text": "Our latest solution to the ubiquitous engineering problem of integration testing in a distributed service ecosystem here at GitHub. January 24, 2024 | Updated January 29, 2024 | 8 minutes Share: Building confidence in new code before deploying is a crucial part of any good development loop. This is especially challenging when working in a distributed or microservice system with multiple teams operating on different services. This modular team structure gives rise to an important question: how can we provide teams with fast and reliable development cycles when testing and shipping requires them to test inside an ecosystem of other services? Optimizing the solution to this problem greatly improves engineering efficiency and can contribute to more successful outcomes for the organization as a whole. This problem is one the Developer Experience (DX) team at GitHub grappled with again and again, ultimately delivering a solution we call “Hubber Codespace” (HCS). HCS is a tool that Hubbers (people who work at GitHub) can use to locally stand up the entire distributed GitHub ecosystem in any environment by simply querying an endpoint or adding a couple lines of configuration to their development containers. In this post, we’ll tell you how we landed on the HCS solution to this common problem over some possible alternatives, and you’ll get a first-hand look at how GitHub’s developer-first mindset helped us deliver the best tool for Hubbers to ship code quickly and safely in our own distributed environment. One big (un)-happy environment To understand the problem we were trying to solve, we have to go back in time. There was a point at which GitHub was just a couple teams and a much simpler product. Back then, having a monorepo in which everyone iterated and built confidence in their changes made sense. Splitting responsibilities up across repositories would have added overhead that bogged down early Hubbers. Fast forward to today, and GitHub has grown into a big organization with hundreds of different teams. Now, the balancing act of evaluating between velocity vs. complexity can look very different. Let’s consider these complexities a bit further. Different services can have entirely different sets of dependencies and even have dependencies on different versions of the same software (for example, one service requires Ruby 2.2 while another requires Ruby 2.4). In smaller collaborative settings, the engineers can easily reconcile these needs. But this complexity grows exponentially as more teams are introduced. Trying to provide a single environment in which these kinds of disparate services can run and interact in development becomes difficult to do. It can result in ad-hoc “hacks” in development loops like deleting a .ruby-version file depending on which service’s development loop you’re working through. These are the kinds of problems that you encounter when trying to work with a monorepo that contains the codebases for a set of disparate services. So, we decided to design a new solution. Instead of bringing the developers to the ecosystem, what if we brought the ecosystem to the developers? Enter HCS This line of thinking led us to build HCS, a Docker-Compose project that does exactly that. In the post “ How we build containerized services at GitHub using GitHub ,” we detailed how we build containerized services that power microservices on the GitHub.com platform and many internal tools. Our task now was to take these containers and wire them up such that partner teams could spin up a full GitHub ecosystem on demand. This would allow them to test their changes in an integrated environment. Developers could see how their code behaves when introduced to GitHub’s distributed system, rather than only observing it in the isolated environment of the application being developed before deploying within the full system. In this way, developers could gain confidence that the services they were changing behaved correctly when interacting with their up and downstream dependencies. When considering how to orchestrate all the required containers, a few solutions came to mind: Docker-Compose, an internal tool called Codespace-Compose that allows us to SSH tunnel between multiple codespaces, and Minikube. Any of these three solutions could solve the ecosystem problem and would have unique tradeoffs. Let’s look at some of those tradeoffs now. Minikube offers a robust Kubernetes architecture, but we had concerns about the overall user experience. We ultimately decided against it as the issues we identified, such as networking complexity and long cycle times, could bog down development speed. Codespace-Compose allows us to easily connect teams’ everyday development environments, but we reasoned that, since Codespace-Compose is an internal experiment without any SLA, we’d incur a maintenance cost on our own team by adopting this. Docker-Compose seemed to fit our needs the best. It didn’t incur any additional maintenance burden since it’s publicly available and actively managed. It offers all the same benefits of Minikube without the long cycle time. Most importantly, using Docker in Docker in a codespace, which allows us to create docker containers on a host which is a docker container itself, is a well-paved path that has lots of prior art. Given all these considerations, we decided on orchestrating our containers using Docker-Compose. After deciding on Docker-Compose as our orchestrator, the next steps were to figure out the interface. Docker-Compose already supplies end users with commands, but we wanted to optimize the UX around HCS. To do this, we built a user-friendly CLI in Golang with parallel versioning to HCS. This abstracted away all the complexity of using the two together. Simply download a specific release version for HCS, get the same version of the CLI binary, and you’re good to go! CLI and release automation Ensuring HCS is useful means ensuring a couple of things. One important goal is ease of use. Docker-Compose already offers an interface for end users, but considering some of the built in commands are long and use predictable options, we decided to wrap it in a custom Golang CLI. This abstracted many of the underlying details away, such as static file locations, formatting options, entrypoint commands, etc. to improve end-user experience. The code below shows this by juxtaposing the Docker-Compose commands with their equivalent HCS CLI command. The following example compares the commands to start up the integrated environment provided by HCS. # Start using Docker-Compose docker compose --project-name hcs \\ --file /workspaces/hubber-codespace-dist/docker-compose-hcs-actions.yml \\ --file /workspaces/hubber-codespace-dist/docker-compose-hcs-base.yml \\ --file /workspaces/hubber-codespace-dist/docker-compose-hcs-bg.yml \\ --file /workspaces/hubber-codespace-dist/docker-compose-hcs-core.yml \\ --file /workspaces/hubber-codespace-dist/docker-compose-hcs-volume.yml \\ --file /workspaces/hubber-codespace-dist/docker-compose-hcs-test.yml \\ --file /workspaces/hubber-codespace-dist/docker-compose-hcs-vendor.yml \\ --profile full up -d --remove-orphans # Start using CLI hcs start This next example compares how to get a shell to run commands from inside the various containers in GitHub’s distributed ecosystem. This allows developers to modularly interact with and make ephemeral changes to the system. # Run command from inside a container in the system using Docker-Compose docker compose --project-name hcs exec bash # Run from inside a container using CLI hcs shell This example compares how to check the status of the containers in the project so end-users can easily see the health of the entire system. # Status using Docker-Compose docker compose --project-name hcs ps --format json # Status using CLI hcs status In addition to this easy-to-use and ergonomic CLI, we had to ensure that HCS runs an up-to-date version of the GitHub ecosystem. GitHub is made up of so many different moving pieces that testing new changes on code that’s even a couple days old would not be sufficient to build confidence. When iterating directly on the monorepo, this was a non-issue since folks just fetched the main branch. For HCS, this required us to build automation that cuts releases on a frequent cron schedule. A release of HCS is a software artifact containing the compiled Golang binary for HCS and its CLI that can be pulled using the gh CLI. The diagram below illustrates how this process works. End-user experience Using HCS directly in your codespace We’ve recently made efforts to push all development at GitHub onto GitHub Codespaces . A codespace is a custom development container , or devcontainer, based on a configuration file in a repository. A repository can have multiple codespaces associated with it as long as each has a unique configuration file. On top of the obvious benefits of having a reproducible environment on demand to develop and iterate in, devcontainers offer features . This abstraction allows developers to easily add software to their environments. HCS is also consumable this way. The code block below shows the couple lines needed to bring this entire ecosystem to a partner team’s preferred environment (that is, their codespace). { … \"features\": { … \"ghcr.io/devcontainers/features/github-cli:1\": { \"version\": \"latest\" }, //docker-in-docker required for hcs \"ghcr.io/devcontainers/features/docker-in-docker:2\": {}, // Include the hubber-codespace feature \"ghcr.io/github/hubber-codespace/hcs:1\": {}, \"ghcr.io/devcontainers/features/go:1\": {} … } } Now, teams can perform integration testing against the many other services in GitHub’s ecosystem from directly in the codespace where they were doing local development. Release binary Even with the push towards codespaces, not every context that requires an ecosystem will be a devcontainer. In light of this, we also gave end users the option to download the release directly from the GitHub API. The commands to do so can be seen below. With a couple simple commands, Hubbers now have everything they need to bring the entire GitHub ecosystem to whatever environment they want. gh release download --repo github/hubber-codespace -p hcs -D /tmp/ chmod +x /tmp/hcs sudo mv /tmp/hcs /usr/local/bin hcs init hcs pull hcs start Testimonials But don’t just take my word for it. Check out what our partner teams have had to say about HCS improving their development loop: “HCS has improved our dev loop for [our service] by making it simple to test [it] against [the rest of GitHub’s ecosystem]. It’s turned what used to be a number of manual steps to clone our repository into the [monorepo environment] into two simple commands in our own codespace. This has made it much easier to validate our changes without having to deploy to a staging environment.” “Given that we are a service operating outside GitHub but with a heavy reliance on the services running within GitHub, we’ve had to go through a lot of bells and whistles to ensure we can have a smooth development experience. In my four years working on [our service], HCS has been the most seamless experience in going from a blank devbox to breakpointing live running code for our service.” Conclusion Solving the ecosystem problem is always a balancing act. Luckily, thanks to GitHub’s push towards containerization, and tooling such as repository automation and publishing/consuming releases through the GitHub CLI, we were adequately equipped to develop a solution with HCS. Hubbers can now leverage a development loop that allows them to deploy with confidence, having tested their changes within GitHub’s complex multi-service system. Written by Related posts We do newsletters, too Discover tips, technical guides, and best practices in our biweekly newsletter just for devs. Your email address",
+    "quality_score": 8,
+    "modules": [
+      "testing",
+      "integration",
+      "dx"
+    ]
+  },
+  {
+    "url": "https://github.blog/2024-06-03-how-github-reduced-testing-time-for-ios-apps-with-new-runner-features/",
+    "title": "How GitHub reduced testing time for iOS apps with new runner features",
+    "source_name": "The GitHub Blog",
+    "text": "Learn how GitHub used macOS and Apple Silicon runners for GitHub Actions to build, test, and deploy our iOS app faster. June 3, 2024 | Updated July 23, 2024 | 4 minutes Share: GitHub Actions 🤝 GitHub for iOS The GitHub iOS and GitHub Actions macOS runner teams are integral parts of each other’s development inner loop. Each team partners on testing new runner images and hardware long before the features land in the hands of developers. GitHub Actions has been working hard at bringing the latest Mac hardware to the community. Apple silicon (M1) macOS runners are available for free in public repositories, along with larger options available for those jobs that need more performance. The GitHub iOS team has been busy improving the user experience in the app, recently shipping such as GitHub Copilot Chat , code search, localization for German and Korean, and making it easier to work with issues and projects. In this blog, we will discuss how the GitHub iOS team brings the app to developers around the world, the benefits of Apple silicon, and building on GitHub Actions using macOS runners. How GitHub reduced testing time for iOS apps with new runner features The GitHub iOS team previously used a single workflow with one job to build and test the entire codebase on GitHub Actions that took 38 minutes to complete with the prior generation runners. The GitHub iOS app consists of about 60 first-party modules, consisting of various targets, such as dynamic frameworks, static libraries, app extensions, or the GitHub app itself. These modules range from networking layers to design system components to entire features or products, helping us maintain the app. Breaking down the monolith We decided to leverage the power of Apple silicon to speed up their testing process. We switched to M1 macOS runners (macos-14-xlarge YAML label) on GitHub Actions and split their test suite into separate jobs for each module. This way, they could build and test each module independently and get faster feedback. Some of the smallest modules completed their tests in as little as 2-3 minutes on M1 macOS runners, getting feedback to developers on their pull requests faster than ever before. This also made it easier to identify and fix failures on specific modules without waiting for a monolithic build to finish. By using Apple silicon, we reduced their testing time by 60%, from 38 minutes to 15 minutes, and improved our productivity and efficiency. The figure below demonstrates how we broke down the monolith into small modules in order to improve our build times. As each build is kicked off, GitHub Actions is behind the scenes preparing the required number of machines to execute the workflow. Each request is sent to the GitHub Actions service where it picks up a freshly reimaged virtual machine to execute the required number of jobs. The figure below shows how a request travels from our repository to the Actions Mac servers in Azure. With shorter build times and a scaling CI fleet, Apple silicon hosts allowed the GitHub iOS team to scale their jobs out across many shorter, faster steps, with GitHub Actions abstracting over the complexity of distributing CI jobs. Analyzing CI performance We further investigated the CI performance and divided each module’s CI into two separate steps, build and test, using xcodebuild’s build-without-testing and test-without-building. This helped us identify unit tests that ran for a long time or highlighted fast unit tests that finished in seconds. Native development and test environments With Apple silicon powering GitHub Actions runners and the developers’ laptops, our CI now had the same architecture as local development machines. Engineers could identify patterns that took a long time to compile or tests that failed due to the architecture from CI and fix them locally with confidence. Benefits of Apple silicon Apple silicon improves build performance, increases reliability, and lets iOS teams test natively for all Apple platforms throughout the software development lifecycle. They can avoid problems from cross-compilation or emulation and use the latest simulators on our GitHub Actions runner image. This ensures that their apps work well with the newest versions of iOS, iPadOS, watchOS, and tvOS. Our GitHub Actions M1 macOS runners help iOS teams leverage these benefits and deliver high-quality apps to their users faster and more efficiently. Additionally, GitHub Actions offers 50 concurrent runners for enterprise accounts and five for GitHub Free and Team plans. The GitHub for iOS team takes full advantage of these concurrent runners and initiates 50 jobs for every pull request to perform modular testing on the app in parallel. Get started building on GitHub Actions using macOS runners GitHub-hosted macOS runners are YAML-driven, meaning they are accessed by updating the runs on: key in your workflow file. Standard GitHub-hosted runners for Public repositories Standard GitHub-hosted runners for Private repositories macOS larger runners Written by Senior Product Manager Related posts We do newsletters, too Discover tips, technical guides, and best practices in our biweekly newsletter just for devs. Your email address",
+    "quality_score": 8,
+    "modules": [
+      "testing",
+      "performance",
+      "devops"
+    ]
+  },
+  {
+    "url": "https://stripe.com/blog/introducing-stripes-new-api-release-process",
+    "title": "Introducing Stripe's new API release process",

--- src/ai/post-generator.ts
diff --git a/src/ai/post-generator.ts b/src/ai/post-generator.ts
index a5f8af8..49c2127 100644
--- a/src/ai/post-generator.ts
+++ b/src/ai/post-generator.ts
@@ -3,7 +3,7 @@ import { buildSystemPrompt, buildUserPrompt } from './prompt-builder.js';
 import { computeEditRatio } from '../voice/similarity.js';
 import type { IAIClient } from './types.js';
 import type { Finding } from '../analysis/types.js';
-import type { IVoiceStorage, VoicePost } from '../voice/storage.js';
+import type { IVoiceStorage, SaveDraftInput, VoicePost } from '../voice/storage.js';
 import type { EnrichedCommit } from '../github/commit-enricher.js';
 import type { Config } from '../config/schema.js';
 
@@ -27,6 +27,7 @@ export async function generatePosts(
   config: Config,
   recentModuleIds: string[] = [],
   industryContext?: string,
+  draftMetadata: Partial<SaveDraftInput> = {},
 ): Promise<GeneratedPosts> {
   if (findings.length === 0) {
     throw new Error('generatePosts called with 0 findings — caller should skip this call');
@@ -64,6 +65,7 @@ export async function generatePosts(
     top_finding: topFinding,
     top_module_id: topModuleId,
     findings_count: findingsCount,
+    ...draftMetadata,
   });
 
   // Buffer Idea text includes both variants so Liliana can copy per platform in the UI


--- src/buffer/sent-scanner.ts
diff --git a/src/buffer/sent-scanner.ts b/src/buffer/sent-scanner.ts
index f28dab6..c8ad9a5 100644
--- a/src/buffer/sent-scanner.ts
+++ b/src/buffer/sent-scanner.ts
@@ -87,6 +87,7 @@ async function scanPlatform(
         edit_ratio: bestScore,
         published_at: publishedAt,
         linkedin_urn: linkedinUrn,
+        publish_source: 'buffer',
       });
       logger.info('sent_scanner.matched', {
         draftId: bestDraft.id,


--- src/content/article-extractor.ts
diff --git a/src/content/article-extractor.ts b/src/content/article-extractor.ts
index c76c246..beb790a 100644
--- a/src/content/article-extractor.ts
+++ b/src/content/article-extractor.ts
@@ -1,11 +1,26 @@
+import { existsSync, readFileSync } from 'fs';
 import { extract } from '@extractus/article-extractor';
+import { parse } from 'yaml';
 import { logger } from '../utils/logger.js';
 import type { ArticleText } from './types.js';
 
 const EXTRACT_TIMEOUT_MS = 30_000;
+const PUPPETEER_LAUNCH_TIMEOUT_MS = 20_000;
+const PUPPETEER_TOTAL_TIMEOUT_MS = 45_000;
 const MIN_WORD_COUNT_RESULT = 100;   // below this = extraction failed
 const MIN_WORD_COUNT_ACCEPT = 300;   // below this = use Puppeteer fallback for curated
 const USER_AGENT = 'devcast/1.0 (+https://devcast.lilicurl.com)';
+const DEFAULT_PUPPETEER_FALLBACK_HOSTS = [
+  'discord.com',
+  'stripe.com',
+] as const;
+
+interface ExtractionPolicy {
+  readonly puppeteerFallbackHosts: Set<string>;
+  readonly source: 'default' | 'env' | 'config';
+}
+
+let cachedExtractionPolicy: ExtractionPolicy | null = null;
 
 /**
  * Three-layer extraction strategy:
@@ -28,10 +43,21 @@ export async function extractArticle(
   rssText: string | null,
   isCurated: boolean,
 ): Promise<ArticleText | null> {
+  const host = getHostname(url);
+  const extractionPolicy = getExtractionPolicy();
+  const allowPuppeteerFallback = isCurated && shouldUsePuppeteerFallback(url, extractionPolicy);
+
   // Layer 1: RSS content
   if (rssText) {
     const rssResult = parseRssText(rssText);
     if (rssResult && rssResult.wordCount >= MIN_WORD_COUNT_ACCEPT) {
+      logger.info('content.extract.success', {
+        url,
+        host,
+        layer: 'rss',
+        wordCount: rssResult.wordCount,
+        isCurated,
+      });
       return rssResult;
     }
   }
@@ -39,18 +65,44 @@ export async function extractArticle(
   // Layer 2: URL fetch
   const urlResult = await extractFromUrl(url);
   if (urlResult && urlResult.wordCount >= MIN_WORD_COUNT_ACCEPT) {
+    logger.info('content.extract.success', {
+      url,
+      host,
+      layer: 'url',
+      wordCount: urlResult.wordCount,
+      isCurated,
+    });
     return urlResult;
   }
 
   // Layer 3: Puppeteer — curated sources only
-  if (isCurated) {
-    logger.info('content.extract.puppeteer', { url });
+  if (allowPuppeteerFallback) {
+    logger.info('content.extract.puppeteer', {
+      url,
+      host,
+      policySource: extractionPolicy.source,
+    });
     const puppeteerResult = await extractWithPuppeteer(url);
     if (puppeteerResult && puppeteerResult.wordCount >= MIN_WORD_COUNT_RESULT) {
+      logger.info('content.extract.success', {
+        url,
+        host,
+        layer: 'puppeteer',
+        wordCount: puppeteerResult.wordCount,
+        isCurated,
+      });
       return puppeteerResult;
     }
   }
 
+  logger.warn('content.extract.fail', {
+    url,
+    host,
+    isCurated,
+    attemptedPuppeteer: allowPuppeteerFallback,
+    policySource: extractionPolicy.source,
+  });
+
   return null;
 }
 
@@ -77,51 +129,110 @@ async function extractFromUrl(url: string): Promise<ArticleText | null> {
       wordCount,
       publishedAt: article.published ? new Date(article.published) : null,
     };
-  } catch {
+  } catch (err) {
+    logger.debug('content.extract.url.fail', {
+      url,
+      host: getHostname(url),
+      error: String(err),
+    });
     return null;
   }
 }
 
 async function extractWithPuppeteer(url: string): Promise<ArticleText | null> {
   // Dynamic import to avoid loading Puppeteer when it is not needed
-  let browser;
+  let browser: {
+    close(): Promise<void>;
+    newPage(): Promise<{
+      setDefaultNavigationTimeout(timeout: number): void;
+      setDefaultTimeout(timeout: number): void;
+      setUserAgent(userAgent: string): Promise<void>;
+      goto(url: string, options: { waitUntil: 'domcontentloaded'; timeout: number }): Promise<unknown>;
+      waitForSelector(selector: string, options: { timeout: number }): Promise<unknown>;
+      waitForNetworkIdle(options: { idleTime: number; timeout: number }): Promise<unknown>;
+      evaluate(script: string): Promise<unknown>;
+      title(): Promise<string>;
+    }>;
+    process(): { kill(signal?: NodeJS.Signals | number): boolean } | null;
+  } | undefined;
+  let skipBrowserClose = false;
   try {
-    const { launch } = await import('puppeteer-core');
-    const puppeteerFull = await import('puppeteer');
-    const executablePath = puppeteerFull.executablePath as () => string;
-
-    browser = await launch({
-      executablePath: executablePath(),
-      headless: true,
-      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
-    });
+    return await withTimeout(
+      (async () => {
+        const { launch } = await import('puppeteer-core');
+        const puppeteerFull = await import('puppeteer');
+        const executablePath = puppeteerFull.executablePath as () => string;
 
-    const page = await browser.newPage();

--- src/content/classifier.ts
diff --git a/src/content/classifier.ts b/src/content/classifier.ts
index a92cdaf..3fa2ed9 100644
--- a/src/content/classifier.ts
+++ b/src/content/classifier.ts
@@ -6,7 +6,7 @@ const QUALITY_GATE = 6;
 const BATCH_POLL_INTERVAL_MS = 30_000;   // 30s between polls
 const BATCH_TIMEOUT_MS = 2 * 60 * 60 * 1000;  // 2 hours max wait
 
-const SYSTEM_PROMPT = `You are evaluating a technical article for depth and originality.
+export const CONTENT_CLASSIFIER_SYSTEM_PROMPT = `You are evaluating a technical article for depth and originality.
 
 Rate the article on a scale of 1-10:
 - 1-3: tutorial, rehash of documentation, or surface-level overview
@@ -56,8 +56,8 @@ export async function classifyArticlesBatch(
   const requests: Anthropic.MessageCreateParamsNonStreaming[] = articles.map((article) => ({
     model,
     max_tokens: 512,
-    system: SYSTEM_PROMPT,
-    messages: [{ role: 'user', content: `Title: ${article.title}\n\n${article.text}` }],
+    system: CONTENT_CLASSIFIER_SYSTEM_PROMPT,
+    messages: [{ role: 'user', content: buildClassifierUserPrompt(article) }],
   }));
 
   const batchRequests = articles.map((article, i) => ({
@@ -120,7 +120,45 @@ export async function classifyArticlesBatch(
   return classified;
 }
 
-function parseClassifierResponse(raw: string): ClassifierResult | null {
+export async function classifyArticleRealtime(
+  article: ArticleToClassify,
+  apiKey: string,
+  model: string,
+): Promise<ClassifierResult> {
+  const client = new Anthropic({ apiKey });
+  return classifyArticleRealtimeWithClient(article, client, model);
+}
+
+export async function classifyArticleRealtimeWithClient(
+  article: ArticleToClassify,
+  client: Anthropic,
+  model: string,
+): Promise<ClassifierResult> {
+  const userPrompt = buildClassifierUserPrompt(article);
+
+  for (let attempt = 0; attempt < 2; attempt++) {
+    const response = await client.messages.create({
+      model,
+      max_tokens: 512,
+      system: CONTENT_CLASSIFIER_SYSTEM_PROMPT,
+      messages: [{ role: 'user', content: userPrompt }],
+    });
+
+    const block = response.content[0];
+    if (block?.type !== 'text') {
+      throw new Error('Classifier returned a non-text response');
+    }
+
+    const parsed = parseClassifierResponse(block.text);
+    if (parsed) {
+      return parsed;
+    }
+  }
+
+  throw new Error(`Classifier returned invalid JSON for article ${article.id}`);
+}
+
+export function parseClassifierResponse(raw: string): ClassifierResult | null {
   // Strip markdown code fences if present
   const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
   try {
@@ -145,6 +183,10 @@ function toStringArray(val: unknown): string[] {
   return val.map(String);
 }
 
+function buildClassifierUserPrompt(article: ArticleToClassify): string {
+  return `Title: ${article.title}\n\n${article.text}`;
+}
+
 function sleep(ms: number): Promise<void> {
   return new Promise((resolve) => setTimeout(resolve, ms));
 }


--- src/content/content-storage.ts
diff --git a/src/content/content-storage.ts b/src/content/content-storage.ts
index 0201d29..d0e8006 100644
--- a/src/content/content-storage.ts
+++ b/src/content/content-storage.ts
@@ -1,6 +1,6 @@
 import type { SupabaseClient } from '@supabase/supabase-js';
 import { logger } from '../utils/logger.js';
-import type { ContentItem } from './types.js';
+import type { ContentSource } from './types.js';
 
 export interface ArticleToStore {
   readonly sourceId: string;
@@ -12,6 +12,7 @@ export interface ArticleToStore {
   readonly mainThesis: string;
   readonly keyInsights: string[];
   readonly techConcepts: string[];
+  readonly seedModules?: string[] | null;
   readonly qualityScore: number;
   readonly titleHash: string;
   readonly fingerprint: string;
@@ -44,6 +45,7 @@ export async function storeArticle(
       main_thesis: article.mainThesis,
       key_insights: article.keyInsights,
       tech_concepts: article.techConcepts,
+      seed_modules: article.seedModules ?? null,
       quality_score: article.qualityScore,
       title_hash: article.titleHash,
       fingerprint: article.fingerprint,
@@ -185,17 +187,18 @@ export async function updateSourceStats(
 }
 
 /**
- * Returns all active sources (status IN active, probation).
- * Also returns unreachable sources for retry attempt.
+ * Returns fetchable sources for the weekly pipeline.
+ * Protected sources are static corpus anchors and are never re-fetched.
  */
-export async function loadActiveSources(db: SupabaseClient): Promise<ContentItem[]> {
+export async function loadActiveSources(db: SupabaseClient): Promise<ContentSource[]> {
   const { data, error } = await db
     .from('content_sources')
     .select('*')
-    .in('status', ['active', 'probation', 'unreachable']);
+    .in('status', ['active', 'probation', 'unreachable'])
+    .eq('is_protected', false);
 
   if (error) throw new Error(`Failed to load active sources: ${error.message}`);
-  return (data ?? []) as ContentItem[];
+  return (data ?? []) as ContentSource[];
 }
 
 /**


--- src/content/matcher.ts
diff --git a/src/content/matcher.ts b/src/content/matcher.ts
index ed817da..37aaaff 100644
--- a/src/content/matcher.ts
+++ b/src/content/matcher.ts
@@ -19,11 +19,13 @@ interface CandidateArticle {
   main_thesis: string;
   key_insights: string[];
   source_id: string;
+  match_strength: number;
 }
 
 export interface MatchedContext {
   readonly articleId: string;
   readonly sourceId: string;
+  readonly matchStrength: number;
   readonly connection: string;   // one sentence from cross-encoder
   readonly articleTitle: string;
 }
@@ -72,10 +74,11 @@ async function stage1BiEncoder(
   }
 
   // Sort by similarity DESC, take top 3 unique articles
-  const topArticleIds = [...bestByArticle.entries()]
+  const topMatches = [...bestByArticle.entries()]
     .sort((a, b) => b[1] - a[1])
     .slice(0, TOP_CANDIDATES)
-    .map(([id]) => id);
+    .map(([id, similarity]) => ({ id, matchStrength: similarity }));
+  const topArticleIds = topMatches.map((match) => match.id);
 
   if (topArticleIds.length === 0) return [];
 
@@ -88,7 +91,14 @@ async function stage1BiEncoder(
     throw new Error(`Failed to fetch candidate articles: ${articleError.message}`);
   }
 
-  return (articles ?? []) as CandidateArticle[];
+  const matchStrengthByArticleId = new Map(topMatches.map((match) => [match.id, match.matchStrength]));
+
+  return ((articles ?? []) as Array<Omit<CandidateArticle, 'match_strength'>>)
+    .map((article) => ({
+      ...article,
+      match_strength: matchStrengthByArticleId.get(article.id) ?? 0,
+    }))
+    .sort((a, b) => b.match_strength - a.match_strength);
 }
 
 /**
@@ -100,7 +110,7 @@ async function stage2CrossEncoder(
   finding: FindingInput,
   candidates: CandidateArticle[],
   aiClient: IAIClient,
-): Promise<{ articleId: string; sourceId: string; connection: string; title: string } | null> {
+): Promise<{ articleId: string; sourceId: string; matchStrength: number; connection: string; title: string } | null> {
   if (candidates.length === 0) return null;
 
   const candidateList = candidates
@@ -157,7 +167,7 @@ Respond as JSON array:
 function findStrongMatch(
   results: Array<{ candidate: number; strength: string; connection: string | null }>,
   candidates: CandidateArticle[],
-): { articleId: string; sourceId: string; connection: string; title: string } | null {
+): { articleId: string; sourceId: string; matchStrength: number; connection: string; title: string } | null {
   for (const result of results) {
     if (result.strength === 'strong' && result.connection) {
       const idx = result.candidate - 1;
@@ -166,6 +176,7 @@ function findStrongMatch(
         return {
           articleId: article.id,
           sourceId: article.source_id,
+          matchStrength: article.match_strength,
           connection: result.connection,
           title: article.title,
         };
@@ -231,12 +242,14 @@ export async function matchFindingsToArticles(
       logger.info('content.match.result', {
         finding: finding.moduleId,
         article: match.title,
+        match_strength: Number(match.matchStrength.toFixed(4)),
         connection: match.connection.slice(0, 80),
       });
 
       return {
         articleId: match.articleId,
         sourceId: match.sourceId,
+        matchStrength: match.matchStrength,
         connection: match.connection,
         articleTitle: match.title,
       };


--- src/content/scripts/content-cleanup-main.ts
diff --git a/src/content/scripts/content-cleanup-main.ts b/src/content/scripts/content-cleanup-main.ts
index 7ca4058..b3ff046 100644
--- a/src/content/scripts/content-cleanup-main.ts
+++ b/src/content/scripts/content-cleanup-main.ts
@@ -23,17 +23,60 @@ async function main(): Promise<void> {
 
   const db = createClient(supabaseUrl, supabaseKey);
 
-  // 1. Expire old content (45-day window, cascades to article_chunks)
+  // 1. Expire old content (45-day window, cascades to article_chunks).
+  // Protected sources are permanent corpus anchors and must survive cleanup.
   const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
-  const { error: expireError, count } = await db
+  const { data: protectedSources, error: protectedError } = await db
+    .from('content_sources')
+    .select('id')
+    .eq('is_protected', true);
+
+  if (protectedError) {
+    throw new Error(`Failed to load protected sources before cleanup: ${protectedError.message}`);
+  }
+
+  const protectedSourceIds = new Set(
+    (protectedSources ?? []).map((row) => (row as { id: string }).id),
+  );
+
+  const { data: oldRows, error: oldRowsError } = await db
     .from('content_items')
-    .delete({ count: 'exact' })
+    .select('id, source_id')
     .lt('week_of', cutoff);
 
-  if (expireError) {
-    logger.warn('content.cleanup.expire_error', { error: expireError.message });
+  if (oldRowsError) {
+    throw new Error(`Failed to load old content rows before cleanup: ${oldRowsError.message}`);
+  }
+
+  const expiredRows = (oldRows ?? []) as Array<{ id: string; source_id: string | null }>;
+  const idsToDelete = expiredRows
+    .filter((row) => row.source_id === null || !protectedSourceIds.has(row.source_id))
+    .map((row) => row.id);
+  const retainedProtected = expiredRows.length - idsToDelete.length;
+
+  if (idsToDelete.length === 0) {
+    logger.info('content.cleanup.expired', {
+      articles_deleted: 0,
+      retained_protected: retainedProtected,
+      protected_sources: protectedSourceIds.size,
+      cutoff,
+    });
   } else {
-    logger.info('content.cleanup.expired', { articles_deleted: count ?? 0, cutoff });
+    const { error: expireError } = await db
+      .from('content_items')
+      .delete()
+      .in('id', idsToDelete);
+
+    if (expireError) {
+      logger.warn('content.cleanup.expire_error', { error: expireError.message });
+    } else {
+      logger.info('content.cleanup.expired', {
+        articles_deleted: idsToDelete.length,
+        retained_protected: retainedProtected,
+        protected_sources: protectedSourceIds.size,
+        cutoff,
+      });
+    }
   }
 
   // 2. Source lifecycle evaluation
@@ -46,16 +89,16 @@ async function main(): Promise<void> {
     .eq('status', 'published')
     .not('edit_ratio', 'is', null);
 
-  const rows = (engagementData ?? []) as Array<{
+  const engagementRows = (engagementData ?? []) as Array<{
     ai_draft: string;
     edit_ratio: number | null;
     engagement_score: number | null;
   }>;
 
-  const withContext = rows.filter((r) => r.ai_draft.includes('<industry_context>'));
-  const withoutContext = rows.filter((r) => !r.ai_draft.includes('<industry_context>'));
+  const withContext = engagementRows.filter((r) => r.ai_draft.includes('<industry_context>'));
+  const withoutContext = engagementRows.filter((r) => !r.ai_draft.includes('<industry_context>'));
 
-  const avgEditRatio = (arr: typeof rows): number | null => {
+  const avgEditRatio = (arr: typeof engagementRows): number | null => {
     const vals = arr.map((r) => r.edit_ratio).filter((v): v is number => v !== null);
     return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
   };


--- src/content/source-evaluator.ts
diff --git a/src/content/source-evaluator.ts b/src/content/source-evaluator.ts
index af9d24e..ec42818 100644
--- a/src/content/source-evaluator.ts
+++ b/src/content/source-evaluator.ts
@@ -5,6 +5,7 @@ interface SourceRow {
   id: string;
   name: string;
   status: string;
+  is_protected: boolean;
   articles_evaluated: number;
   articles_passed: number;
   best_score_30d: number;
@@ -33,7 +34,7 @@ const MAX_FETCH_FAILURES = 5;
 export async function evaluateSourceLifecycle(db: SupabaseClient): Promise<void> {
   const { data, error } = await db
     .from('content_sources')
-    .select('id, name, status, articles_evaluated, articles_passed, best_score_30d, matched_count, added_at, fetch_failures')
+    .select('id, name, status, is_protected, articles_evaluated, articles_passed, best_score_30d, matched_count, added_at, fetch_failures')
     .in('status', ['active', 'probation', 'unreachable']);
 
   if (error) {
@@ -48,8 +49,14 @@ export async function evaluateSourceLifecycle(db: SupabaseClient): Promise<void>
   let toProbation = 0;
   let toDisabled = 0;
   let toUnreachable = 0;
+  let protectedSkipped = 0;
 
   for (const source of sources) {
+    if (source.is_protected) {
+      protectedSkipped++;
+      continue;
+    }
+
     const ageMs = now - new Date(source.added_at).getTime();
     const ageDays = ageMs / (1000 * 60 * 60 * 24);
     const hitRate = source.articles_evaluated > 0
@@ -108,7 +115,13 @@ export async function evaluateSourceLifecycle(db: SupabaseClient): Promise<void>
   // Expire old disabled sources back to active if they're still in reference repos
   // (implemented as manual override via sources.yml — not automated here)
 
-  logger.info('content.evaluator.done', { toActive, toProbation, toDisabled, toUnreachable });
+  logger.info('content.evaluator.done', {
+    toActive,
+    toProbation,
+    toDisabled,
+    toUnreachable,
+    protectedSkipped,
+  });
 }
 
 async function setStatus(


--- src/content/types.ts
diff --git a/src/content/types.ts b/src/content/types.ts
index d02a8ed..868543d 100644
--- a/src/content/types.ts
+++ b/src/content/types.ts
@@ -19,6 +19,7 @@ export interface ContentSource {
   readonly added_at: string;
   readonly disabled_at: string | null;
   readonly discovered_from: DiscoveredFrom | null;
+  readonly is_protected: boolean;
 }
 
 export interface ContentItem {
@@ -33,6 +34,7 @@ export interface ContentItem {
   readonly main_thesis: string;
   readonly key_insights: string[];
   readonly tech_concepts: string[];
+  readonly seed_modules: string[] | null;
   readonly quality_score: number;
   readonly times_matched: number;
   readonly title_hash: string;


--- src/main-poll.ts
diff --git a/src/main-poll.ts b/src/main-poll.ts
index 25a58bc..941d3e0 100644
--- a/src/main-poll.ts
+++ b/src/main-poll.ts
@@ -118,7 +118,14 @@ async function main(): Promise<void> {
 
       // Generate post (ONE Claude call — returns full post + Twitter short variant)
       const { bufferText, draftId } = await generatePosts(
-        anthropic, commit, findings, storage, config, recentModuleIds,
+        anthropic,
+        commit,
+        findings,
+        storage,
+        config,
+        recentModuleIds,
+        undefined,
+        { author_login: commit.authorLogin },
       );
 
       // Publish ONE Buffer Idea with both variants in the text


--- src/voice/sqlite-storage.ts
diff --git a/src/voice/sqlite-storage.ts b/src/voice/sqlite-storage.ts
index a846a82..4670180 100644
--- a/src/voice/sqlite-storage.ts
+++ b/src/voice/sqlite-storage.ts
@@ -42,16 +42,38 @@ export class SqliteStorage implements IVoiceStorage {
         scheduled_at    TEXT,
         status          TEXT NOT NULL DEFAULT 'pending',
         top_finding     TEXT,
+        top_module_id   TEXT,
         findings_count  INTEGER NOT NULL DEFAULT 0,
+        author_login    TEXT,
+        edit_analysis   TEXT,
+        context_status  TEXT,
+        has_industry_context INTEGER NOT NULL DEFAULT 0,
+        matched_article_id   TEXT,
+        matched_source_id    TEXT,
+        match_strength       REAL,
+        match_connection     TEXT,
         linkedin_urn    TEXT,
+        last_reactions_fetch_at TEXT,
         reactions_count INTEGER NOT NULL DEFAULT 0,
-        engagement_score REAL
+        engagement_score REAL,
+        publish_source  TEXT,
+        tenant_id       TEXT
       );
 
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS linkedin_urn     TEXT;
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS reactions_count  INTEGER NOT NULL DEFAULT 0;
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS engagement_score REAL;
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS top_module_id    TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS author_login     TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS edit_analysis    TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS context_status   TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS has_industry_context INTEGER NOT NULL DEFAULT 0;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_article_id   TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_source_id    TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_strength       REAL;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection     TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source   TEXT;
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS tenant_id        TEXT;
 
       CREATE UNIQUE INDEX IF NOT EXISTS idx_sha_platform
@@ -85,11 +107,30 @@ export class SqliteStorage implements IVoiceStorage {
   saveDraft(input: SaveDraftInput): Promise<string> {
     const id = randomUUID();
     this.db.prepare(`
-      INSERT INTO voice_posts (id, commit_sha, repo, platform, ai_draft, top_finding, top_module_id, findings_count, status, tenant_id)
-      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
-    `).run(id, input.commit_sha, input.repo, input.platform, input.ai_draft,
-           input.top_finding ?? null, input.top_module_id ?? null, input.findings_count ?? 0,
-           this.tenantId);
+      INSERT INTO voice_posts (
+        id, commit_sha, repo, platform, ai_draft, top_finding, top_module_id, findings_count,
+        author_login, context_status, has_industry_context, matched_article_id, matched_source_id,
+        match_strength, match_connection, status, tenant_id
+      )
+      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
+    `).run(
+      id,
+      input.commit_sha,
+      input.repo,
+      input.platform,
+      input.ai_draft,
+      input.top_finding ?? null,
+      input.top_module_id ?? null,
+      input.findings_count ?? 0,
+      input.author_login ?? null,
+      input.context_status ?? null,
+      input.has_industry_context ? 1 : 0,
+      input.matched_article_id ?? null,
+      input.matched_source_id ?? null,
+      input.match_strength ?? null,
+      input.match_connection ?? null,
+      this.tenantId,
+    );
     return Promise.resolve(id);
   }
 
@@ -107,10 +148,17 @@ export class SqliteStorage implements IVoiceStorage {
     this.db.prepare(`
       UPDATE voice_posts
       SET published = ?, edit_ratio = ?, published_at = ?, status = 'published',
-          linkedin_urn = COALESCE(?, linkedin_urn)
+          linkedin_urn = COALESCE(?, linkedin_urn),
+          publish_source = COALESCE(?, publish_source)
       WHERE id = ?
-    `).run(input.published, input.edit_ratio, input.published_at,
-           input.linkedin_urn ?? null, input.id);
+    `).run(
+      input.published,
+      input.edit_ratio,
+      input.published_at,
+      input.linkedin_urn ?? null,
+      input.publish_source ?? null,
+      input.id,
+    );
     return Promise.resolve();
   }
 


--- src/voice/storage.ts
diff --git a/src/voice/storage.ts b/src/voice/storage.ts
index 3ff82f6..a5cf513 100644
--- a/src/voice/storage.ts
+++ b/src/voice/storage.ts
@@ -1,5 +1,7 @@
 export type Platform = 'linkedin' | 'instagram';
 export type PostStatus = 'pending' | 'scheduled' | 'published' | 'queued';
+export type ContextStatus = 'skipped' | 'no_match' | 'matched';
+export type PublishSource = 'buffer' | 'linkedin_direct';
 
 export interface VoicePost {
   id: string;
@@ -15,10 +17,21 @@ export interface VoicePost {
   scheduled_at: string | null;
   status: PostStatus;
   top_finding: string | null;
+  top_module_id: string | null;
   findings_count: number;
+  author_login: string | null;
+  edit_analysis: Record<string, unknown> | null;
+  context_status: ContextStatus | null;
+  has_industry_context: boolean;
+  matched_article_id: string | null;
+  matched_source_id: string | null;
+  match_strength: number | null;
+  match_connection: string | null;
   linkedin_urn: string | null;
   reactions_count: number;
+  last_reactions_fetch_at: string | null;
   engagement_score: number | null;
+  publish_source: PublishSource | null;
 }
 
 export interface SaveDraftInput {
@@ -29,6 +42,13 @@ export interface SaveDraftInput {
   top_finding?: string;
   top_module_id?: string;
   findings_count?: number;
+  author_login?: string | null;
+  context_status?: ContextStatus | null;
+  has_industry_context?: boolean;
+  matched_article_id?: string | null;
+  matched_source_id?: string | null;
+  match_strength?: number | null;
+  match_connection?: string | null;
 }
 
 export interface UpdatePublishedInput {
@@ -37,6 +57,7 @@ export interface UpdatePublishedInput {
   edit_ratio: number;
   published_at: string;
   linkedin_urn?: string;  // extracted from Buffer externalLink when available
+  publish_source?: PublishSource;
 }
 
 export interface UpdateScheduledInput {


--- src/voice/supabase-storage.ts
diff --git a/src/voice/supabase-storage.ts b/src/voice/supabase-storage.ts
index 0a936a2..ba3de9a 100644
--- a/src/voice/supabase-storage.ts
+++ b/src/voice/supabase-storage.ts
@@ -31,6 +31,13 @@ export class SupabaseStorage implements IVoiceStorage {
         top_finding: input.top_finding ?? null,
         top_module_id: input.top_module_id ?? null,
         findings_count: input.findings_count ?? 0,
+        author_login: input.author_login ?? null,
+        context_status: input.context_status ?? null,
+        has_industry_context: input.has_industry_context ?? false,
+        matched_article_id: input.matched_article_id ?? null,
+        matched_source_id: input.matched_source_id ?? null,
+        match_strength: input.match_strength ?? null,
+        match_connection: input.match_connection ?? null,
         status: 'pending' satisfies PostStatus,
         tenant_id: this.tenantId,
       })
@@ -50,6 +57,7 @@ export class SupabaseStorage implements IVoiceStorage {
         published_at: input.published_at,
         status: 'published' satisfies PostStatus,
         ...(input.linkedin_urn !== undefined && { linkedin_urn: input.linkedin_urn }),
+        ...(input.publish_source !== undefined && { publish_source: input.publish_source }),
       })
       .eq('id', input.id);
 


--- src/worker/process-job.ts
diff --git a/src/worker/process-job.ts b/src/worker/process-job.ts
index 3762a9a..00e308c 100644
--- a/src/worker/process-job.ts
+++ b/src/worker/process-job.ts
@@ -16,6 +16,7 @@ import { getInstallationToken } from './github-app-auth.js';
 import { logger } from '../utils/logger.js';
 import { ConfigSchema } from '../config/schema.js';
 import type { Config } from '../config/schema.js';
+import type { SaveDraftInput } from '../voice/storage.js';
 
 interface TenantRow {
   readonly id: string;
@@ -195,19 +196,52 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
       // Content matching — inject industry context when a strong match is found.
       // Graceful degradation: any failure skips context, post generated normally.
       let industryContext: string | undefined;
+      let draftMetadata: Partial<SaveDraftInput> = {
+        author_login: commit.authorLogin,
+      };
       if (embedder) {
         try {
           const match = await matchFindingsToArticles(findings, embedder, anthropic, deps.db);
           if (match) {
             industryContext = `Connection: ${match.connection}`;
+            draftMetadata = {
+              ...draftMetadata,
+              context_status: 'matched',
+              has_industry_context: true,
+              matched_article_id: match.articleId,
+              matched_source_id: match.sourceId,
+              match_strength: match.matchStrength,
+              match_connection: match.connection,
+            };
             logger.info('content.match.injected', { sha: commit.sha, article: match.articleTitle });
+          } else {
+            draftMetadata = {
+              ...draftMetadata,
+              context_status: 'no_match',
+              has_industry_context: false,
+              matched_article_id: null,
+              matched_source_id: null,
+              match_strength: null,
+              match_connection: null,
+            };
           }
         } catch (err) {
           logger.warn('content.match.skipped', { sha: commit.sha, error: String(err) });
         }
+      } else {
+        logger.info('content.match.skipped', { sha: commit.sha, reason: 'no_embedder' });
       }
 
-      const { linkedinPost, bufferText, draftId } = await generatePosts(anthropic, commit, findings, storage, config, recentModuleIds, industryContext);
+      const { linkedinPost, bufferText, draftId } = await generatePosts(
+        anthropic,
+        commit,
+        findings,
+        storage,
+        config,
+        recentModuleIds,
+        industryContext,
+        draftMetadata,
+      );
 
       // Post directly to LinkedIn if connected
       if (tenant.linkedin_access_token && tenant.linkedin_member_id) {
@@ -219,6 +253,7 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
             published: linkedinPost,
             edit_ratio: 1.0,
             published_at: new Date().toISOString(),
+            publish_source: 'linkedin_direct',
           });
           logger.info('worker.commit.linkedin_posted', { sha: commit.sha });
         } catch (err) {

```

### Commit 6: da0b16c
**Message:** feat: harden article matching and add audit mode

**Diff:**
```diff
--- docs/article-match-hardening-spec.md
diff --git a/docs/article-match-hardening-spec.md b/docs/article-match-hardening-spec.md
new file mode 100644
index 0000000..6cae26c
--- /dev/null
+++ b/docs/article-match-hardening-spec.md
@@ -0,0 +1,566 @@
+# Article Match Hardening Spec
+
+Status: Draft
+Date: 2026-04-11
+Owner: devcast
+
+## Problem
+
+The content-matching system is working end to end, but it is under-matching strong commits.
+
+Observed behavior:
+
+- interesting commits are successfully analyzed and ranked
+- the article matcher usually returns `no_match`
+- no historical `voice_posts` rows currently contain `context_status`
+- representative commits with strong findings still fail retrieval
+
+The issue is not a single bug. It is a system design mismatch across:
+
+1. commit analysis output
+2. retrieval query construction
+3. retrieval calibration
+4. corpus freshness
+5. match timing
+
+## What We Learned From The Code
+
+### 1. KMS commits are not described as security work
+
+The `security` module only recognizes:
+
+- hardcoded secrets
+- SQL injection
+- input validation
+- auth/authz
+- security headers
+
+Source: [security.ts](/Users/Lilicurl/Documents/git/social-engagement/src/analysis/modules/security.ts)
+
+It does not recognize:
+
+- KMS
+- envelope encryption
+- key wrapping / unwrapping
+- DEK / KEK patterns
+- AES-GCM token sealing
+- secret storage boundary hardening
+
+So the KMS commit is free to be claimed by other modules first:
+
+- `integration` sees `@supabase/supabase-js` or generic client setup and emits a generic integration finding
+- `dependency_health` sees `@google-cloud/kms` and emits `new dependency added`
+- `type_system` sees utility types / type guards and emits a generic type-system finding
+
+Source: [integration.ts](/Users/Lilicurl/Documents/git/social-engagement/src/analysis/modules/integration.ts), [dependency-health.ts](/Users/Lilicurl/Documents/git/social-engagement/src/analysis/modules/dependency-health.ts), [type-system.ts](/Users/Lilicurl/Documents/git/social-engagement/src/analysis/modules/type-system.ts)
+
+### 2. Progressive voice is being described as extraction + config validation
+
+The `evolutionary` module heavily rewards module extraction:
+
+- any added file with >= 30 lines
+- any modified file with >= 30 deletions
+- same directory or same extension
+
+That is enough for large refactors and doc/spec extraction work to be labeled as `module extraction`.
+
+Source: [evolutionary.ts](/Users/Lilicurl/Documents/git/social-engagement/src/analysis/modules/evolutionary.ts)
+
+The same commit also modified `src/config/schema.ts`, so both `security` and `dx` detected schema validation.
+
+This produced findings that are valid, but incomplete:
+
+- they describe visible structural moves
+- they do not capture the central narrative of the commit
+- they are weak retrieval queries for industry context
+
+### 3. The match query is too abstract
+
+Today Stage 1 embeds only `finding.plainLanguage`.
+
+Source: [matcher.ts](/Users/Lilicurl/Documents/git/social-engagement/src/content/matcher.ts)
+
+That is a problem because `plainLanguage` is optimized for social explanation, not semantic retrieval.
+
+Examples:
+
+- `Extracting code into its own module is a sign of a codebase maturing`
+- `Validating input at the boundary catches bad data early`
+
+These are good post-writing sentences.
+They are bad retrieval queries because they lose critical terms:
+
+- `KMS`
+- `envelope encryption`
+- `tenant token`
+- `AES-256-GCM`
+- `DEK`
+- `wrap/unwrap`
+- `voice system`
+- `progressive voice`
+- `opening_move`
+- `exposure examples`
+
+### 4. Retrieval is calibrated too aggressively
+
+Today the worker uses:
+
+- `0.75` similarity by default
+- `0.72` when the voice profile prefers industry context
+
+Source: [process-job.ts](/Users/Lilicurl/Documents/git/social-engagement/src/worker/process-job.ts)
+
+But manual inspection of representative findings showed top similarities like:
+
+- voice-system style finding: ~`0.42`
+- observability style finding: ~`0.44`
+- KMS/security style finding: ~`0.34`
+
+So Stage 1 is rejecting most reasonable candidates before Stage 2 can judge them.
+
+### 5. The corpus is varied, but not fresh
+
+The stored corpus is not empty and not monolithic by topic.
+It includes coverage for performance, evolutionary, dx, security, architecture, observability, AI, and more.
+
+But operationally it is still mostly static:
+
+- `content_items`: 200
+- `article_chunks`: 587
+- only one active source: `curated-seed`
+- most sources remain `queued`
+
+The seed corpus is intentionally stored with:
+
+- `DEFAULT_SEED_WEEK_OF = 2026-01-01`
+
+Source: [shared.ts](/Users/Lilicurl/Documents/git/social-engagement/scripts/seed-corpus/shared.ts)
+
+The SQL matcher allows seed articles to bypass freshness cutoff because `is_protected = true`.
+
+Source: [schema.sql](/Users/Lilicurl/Documents/git/social-engagement/database/schema.sql)
+
+That means the system currently matches mostly against a frozen anchor corpus, not a living stream of recent engineering writing.
+

--- package.json
diff --git a/package.json b/package.json
index 6457090..735ea0d 100644
--- a/package.json
+++ b/package.json
@@ -10,6 +10,7 @@
     "bootstrap": "tsx --env-file=.env.local scripts/bootstrap-voice.ts",
     "voice:analyze": "tsx --env-file=.env.local scripts/analyze-voice.ts",
     "voice:validate-registry": "tsx --env-file=.env.local scripts/validate-registry.ts",
+    "audit:match": "tsx --env-file=.env.local scripts/audit-content-match.ts",
     "test-analyze": "tsx --env-file=.env.local scripts/test-analyze.ts",
     "webhook": "tsx --env-file=.env.local src/webhook/server.ts",
     "worker": "tsx --env-file=.env.local src/worker/main-worker.ts",


--- scripts/audit-content-match.ts
diff --git a/scripts/audit-content-match.ts b/scripts/audit-content-match.ts
new file mode 100644
index 0000000..2ea9337
--- /dev/null
+++ b/scripts/audit-content-match.ts
@@ -0,0 +1,335 @@
+import { createClient, type SupabaseClient } from '@supabase/supabase-js';
+import { createAIClient, createEmbedder } from '../src/ai/factory.js';
+import { runPipeline } from '../src/analysis/pipeline.js';
+import type { Finding } from '../src/analysis/types.js';
+import { matchFindingsToArticles } from '../src/content/matcher.js';
+import { enrichCommit } from '../src/github/commit-enricher.js';
+import { GitHubClient } from '../src/github/client.js';
+import { getInstallationToken } from '../src/worker/github-app-auth.js';
+
+type AuditMode = 'commit' | 'draft' | 'published';
+
+interface TenantRow {
+  readonly id: string;
+  readonly github_username: string;
+  readonly github_installation_id: number;
+  readonly config: Record<string, unknown> | null;
+}
+
+interface AuditPostRow {
+  readonly id: string;
+  readonly commit_sha: string;
+  readonly repo: string;
+  readonly ai_draft: string;
+  readonly published: string | null;
+  readonly created_at: string;
+  readonly published_at: string | null;
+  readonly status: string;
+  readonly top_finding: string | null;
+  readonly top_module_id: string | null;
+  readonly author_login: string | null;
+}
+
+interface AuditResult {
+  readonly mode: AuditMode;
+  readonly sourceId: string;
+  readonly repo: string;
+  readonly commitSha: string;
+  readonly authorLogin: string | null;
+  readonly timestamp: string | null;
+  readonly findingHeadline: string;
+  readonly matched: boolean;
+  readonly matchedArticleTitle: string | null;
+  readonly matchStrength: number | null;
+  readonly connection: string | null;
+  readonly textPreview: string;
+}
+
+function getArg(name: string): string | undefined {
+  const idx = process.argv.indexOf(name);
+  return idx >= 0 ? process.argv[idx + 1] : undefined;
+}
+
+function getRequiredEnv(name: string): string {
+  const value = process.env[name];
+  if (!value) throw new Error(`${name} is required.`);
+  return value;
+}
+
+function getTenantId(): string {
+  return getArg('--tenant') ?? process.env['TENANT_ID'] ?? '';
+}
+
+function getMode(): AuditMode {
+  const mode = (getArg('--mode') ?? 'published') as AuditMode;
+  if (mode !== 'commit' && mode !== 'draft' && mode !== 'published') {
+    throw new Error(`Unsupported mode "${mode}". Use commit, draft, or published.`);
+  }
+  return mode;
+}
+
+function getLimit(): number {
+  const raw = getArg('--limit');
+  if (!raw) return 10;
+  const parsed = Number(raw);
+  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('--limit must be a positive number.');
+  return parsed;
+}
+
+function getStringConfig(
+  config: Record<string, unknown> | null,
+  section: string,
+  key: string,
+  fallback: string,
+): string {
+  const parent = config?.[section];
+  if (!parent || typeof parent !== 'object') return fallback;
+  const value = (parent as Record<string, unknown>)[key];
+  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
+}
+
+function trimPreview(text: string, maxLength = 180): string {
+  const normalized = text.replace(/\s+/g, ' ').trim();
+  if (normalized.length <= maxLength) return normalized;
+  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
+}
+
+function tokenizeText(value: string): string[] {
+  return [...new Set(value
+    .toLowerCase()
+    .split(/[^a-z0-9]+/)
+    .map((part) => part.trim())
+    .filter((part) => part.length >= 3 && part.length <= 30)
+  )].slice(0, 16);
+}
+
+function getPostText(post: AuditPostRow, mode: AuditMode): string {
+  if (mode === 'published') return post.published ?? '';
+  return post.ai_draft ?? '';
+}
+
+function buildAuditFindingFromPost(post: AuditPostRow, mode: AuditMode): Finding {
+  const text = getPostText(post, mode);
+  const headline = post.top_finding ?? `${mode} post for ${post.repo}`;
+  const retrievalTerms = [
+    ...tokenizeText(post.repo),
+    ...tokenizeText(post.top_module_id ?? ''),
+    ...tokenizeText(post.top_finding ?? ''),
+  ].slice(0, 18);
+
+  return {
+    moduleId: post.top_module_id ?? `${mode}_post`,
+    aspect: `${mode} post audit`,
+    finding: headline,
+    technicalDetail: `Post audit for ${post.repo} commit ${post.commit_sha}. Original status: ${post.status}.`,
+    plainLanguage: text,
+    interestScore: 10,
+    contextHint: `${mode} post ${post.id}`,
+    retrievalTerms,
+    retrievalText: [
+      `Audit mode: ${mode}`,
+      `Repository: ${post.repo}`,
+      `Commit SHA: ${post.commit_sha}`,
+      `Top module: ${post.top_module_id ?? 'unknown'}`,
+      `Top finding: ${headline}`,
+      `Post text: ${text}`,
+    ].join('\n'),
+  };
+}
+
+async function loadTenant(db: SupabaseClient, tenantId: string): Promise<TenantRow> {
+  const { data, error } = await db
+    .from('tenants')
+    .select('id, github_username, github_installation_id, config')
+    .eq('id', tenantId)

--- scripts/test-analyze.ts
diff --git a/scripts/test-analyze.ts b/scripts/test-analyze.ts
index 5246a0e..6238fbf 100644
--- a/scripts/test-analyze.ts
+++ b/scripts/test-analyze.ts
@@ -44,6 +44,7 @@ async function main(): Promise<void> {
   const findings = await runPipeline({
     diffs: commit.diffs,
     commitMessage: commit.message,
+    commitBody: commit.body,
     languages: commit.languages,
     repo: commit.repo,
     sha: commit.sha,
@@ -62,6 +63,8 @@ async function main(): Promise<void> {
     console.log(`  Finding:   ${finding.finding}`);
     console.log(`  Technical: ${finding.technicalDetail}`);
     console.log(`  Plain:     ${finding.plainLanguage.slice(0, 120)}...`);
+    if (finding.retrievalText) console.log(`  Retrieval: ${finding.retrievalText.slice(0, 160)}...`);
+    if (finding.retrievalTerms?.length) console.log(`  Terms:     ${finding.retrievalTerms.join(', ')}`);
     if (finding.evidence) {
       if (finding.evidence.before) console.log(`  Before:    ${finding.evidence.before}`);
       if (finding.evidence.after)  console.log(`  After:     ${finding.evidence.after}`);


--- src/analysis/modules/evolutionary.ts
diff --git a/src/analysis/modules/evolutionary.ts b/src/analysis/modules/evolutionary.ts
index b4c060e..0a16ae1 100644
--- a/src/analysis/modules/evolutionary.ts
+++ b/src/analysis/modules/evolutionary.ts
@@ -14,9 +14,17 @@ function getDirectory(filename: string): string {
   return slash === -1 ? '' : filename.slice(0, slash);
 }
 
-function detectModuleExtraction(diffs: readonly FileDiff[], repo: string): Finding | null {
-  const addedFiles = diffs.filter((d) => d.status === 'added' && d.additions >= MIN_EXTRACTION_LINES);
-  const modifiedWithDeletions = diffs.filter((d) => d.status === 'modified' && d.deletions >= MIN_EXTRACTION_LINES);
+function getRetrievalTerms(...values: string[]): string[] {
+  return [...new Set(values
+    .flatMap((value) => value.split(/[^A-Za-z0-9]+/))
+    .map((part) => part.trim().toLowerCase())
+    .filter((part) => part.length >= 3 && part.length <= 30)
+  )].slice(0, 12);
+}
+
+function detectModuleExtraction(ctx: AnalysisContext): Finding | null {
+  const addedFiles = ctx.diffs.filter((d) => d.status === 'added' && d.additions >= MIN_EXTRACTION_LINES);
+  const modifiedWithDeletions = ctx.diffs.filter((d) => d.status === 'modified' && d.deletions >= MIN_EXTRACTION_LINES);
 
   for (const added of addedFiles) {
     for (const modified of modifiedWithDeletions) {
@@ -26,11 +34,12 @@ function detectModuleExtraction(diffs: readonly FileDiff[], repo: string): Findi
         return {
           moduleId: 'evolutionary',
           aspect: 'module extraction',
-          finding: `module extraction: ${modified.filename} -> ${added.filename}`,
-          technicalDetail: 'Module extraction — splitting a large file into smaller, focused modules with single responsibilities.',
-          plainLanguage: 'Extracting code into its own module is a sign of a codebase maturing. A file that does too much gets split into focused pieces — each easier to test, read, and change independently.',
+          finding: `module extraction: responsibilities moved from ${modified.filename} into ${added.filename}`,
+          technicalDetail: `Module extraction — splitting responsibilities from ${modified.filename} into ${added.filename} to create a smaller, more focused boundary.`,
+          plainLanguage: 'Extracting code into its own module is a sign of a codebase maturing. A file that does too much gets split into focused pieces so each one is easier to test, reason about, and evolve independently.',
           interestScore: 9,
-          contextHint: `${added.filename} in ${repo}`,
+          contextHint: `${added.filename} in ${ctx.repo}`,
+          retrievalTerms: getRetrievalTerms('module extraction', modified.filename, added.filename, ctx.commitMessage),
         };
       }
     }
@@ -39,8 +48,8 @@ function detectModuleExtraction(diffs: readonly FileDiff[], repo: string): Findi
   return null;
 }
 
-function detectFileRename(diffs: readonly FileDiff[], repo: string): Finding | null {
-  const renamed = diffs.find((d) => d.status === 'renamed');
+function detectFileRename(ctx: AnalysisContext): Finding | null {
+  const renamed = ctx.diffs.find((d) => d.status === 'renamed');
   if (!renamed) return null;
   return {
     moduleId: 'evolutionary',
@@ -49,12 +58,13 @@ function detectFileRename(diffs: readonly FileDiff[], repo: string): Finding | n
     technicalDetail: 'File rename — improving naming to better reflect the module\'s responsibility and make the codebase more navigable.',
     plainLanguage: 'Renaming a file signals that the team is investing in clarity. Good names reduce the time it takes a new developer to find what they are looking for.',
     interestScore: 5,
-    contextHint: `${renamed.filename} in ${repo}`,
+    contextHint: `${renamed.filename} in ${ctx.repo}`,
+    retrievalTerms: getRetrievalTerms('file rename', renamed.filename, ctx.commitMessage),
   };
 }
 
-function detectMigration(diffs: readonly FileDiff[], repo: string): Finding | null {
-  const migration = diffs.find((d) => d.status === 'added' && MIGRATION_REGEX.test(d.filename));
+function detectMigration(ctx: AnalysisContext): Finding | null {
+  const migration = ctx.diffs.find((d) => d.status === 'added' && MIGRATION_REGEX.test(d.filename));
   if (!migration) return null;
   return {
     moduleId: 'evolutionary',
@@ -63,12 +73,13 @@ function detectMigration(diffs: readonly FileDiff[], repo: string): Finding | nu
     technicalDetail: 'Database migration — a versioned schema change that evolves the database structure alongside application code.',
     plainLanguage: 'Migrations keep the database in sync with the code. Each migration is a reversible step — if something breaks, you roll back one version, not the entire schema.',
     interestScore: 8,
-    contextHint: `${migration.filename} in ${repo}`,
+    contextHint: `${migration.filename} in ${ctx.repo}`,
+    retrievalTerms: getRetrievalTerms('database migration', migration.filename, ctx.commitMessage),
   };
 }
 
-function detectDeprecation(diffs: readonly FileDiff[], repo: string): Finding | null {
-  for (const diff of diffs) {
+function detectDeprecation(ctx: AnalysisContext): Finding | null {
+  for (const diff of ctx.diffs) {
     if (!diff.patch || diff.status === 'removed') continue;
     const addedLines = diff.patch
       .split('\n')
@@ -83,15 +94,16 @@ function detectDeprecation(diffs: readonly FileDiff[], repo: string): Finding |
         technicalDetail: 'Deprecation — marking code as obsolete with a clear signal to stop using it before it is removed.',
         plainLanguage: 'Deprecation warnings give consumers time to migrate. Instead of a breaking removal, you mark it deprecated, document the replacement, and remove it in the next major version.',
         interestScore: 7,
-        contextHint: `${diff.filename} in ${repo}`,
+        contextHint: `${diff.filename} in ${ctx.repo}`,
+        retrievalTerms: getRetrievalTerms('deprecation', diff.filename, ctx.commitMessage),
       };
     }
   }
   return null;
 }
 
-function detectLargeDeletion(diffs: readonly FileDiff[], repo: string): Finding | null {
-  const large = diffs.find((d) => d.status === 'modified' && d.deletions >= MIN_LARGE_DELETION);
+function detectLargeDeletion(ctx: AnalysisContext): Finding | null {
+  const large = ctx.diffs.find((d) => d.status === 'modified' && d.deletions >= MIN_LARGE_DELETION);
   if (!large) return null;
   return {
     moduleId: 'evolutionary',
@@ -100,7 +112,8 @@ function detectLargeDeletion(diffs: readonly FileDiff[], repo: string): Finding
     technicalDetail: 'Large-scale deletion — significant code removal indicating simplification, dead code cleanup, or responsibility transfer.',
     plainLanguage: 'Deleting code is underrated. Every line removed is a line that no longer needs tests, reviews, or maintenance. The best refactor often makes the codebase smaller, not bigger.',
     interestScore: 7,
-    contextHint: `${large.filename} in ${repo}`,
+    contextHint: `${large.filename} in ${ctx.repo}`,
+    retrievalTerms: getRetrievalTerms('simplification', large.filename, ctx.commitMessage),
   };
 }
 
@@ -110,10 +123,10 @@ export class EvolutionaryModule implements CodeAnalyzer {
   readonly category = 'evolutionary' as const;
 
   async analyze(ctx: AnalysisContext): Promise<Finding | null> {
-    return detectModuleExtraction(ctx.diffs, ctx.repo)
-      ?? detectFileRename(ctx.diffs, ctx.repo)
-      ?? detectMigration(ctx.diffs, ctx.repo)
-      ?? detectDeprecation(ctx.diffs, ctx.repo)
-      ?? detectLargeDeletion(ctx.diffs, ctx.repo);
+    return detectModuleExtraction(ctx)
+      ?? detectFileRename(ctx)
+      ?? detectMigration(ctx)
+      ?? detectDeprecation(ctx)
+      ?? detectLargeDeletion(ctx);
   }
 }


--- src/analysis/modules/integration.ts
diff --git a/src/analysis/modules/integration.ts b/src/analysis/modules/integration.ts
index 55276dd..e6d96ed 100644
--- a/src/analysis/modules/integration.ts
+++ b/src/analysis/modules/integration.ts
@@ -6,18 +6,28 @@ interface ServiceSignature {
   category: string;
   explanation: string;
   score: number;
+  retrievalTerms?: string[];
 }
 
 // AI integrations are covered by AiAssistedModule — skip here to avoid duplicate findings
 const AI_CATEGORY = 'AI / large language model';
 
 const KNOWN_SERVICES: ServiceSignature[] = [
+  {
+    name: 'Google Cloud KMS',
+    patterns: [/from ['"]@google-cloud\/kms['"]|KeyManagementServiceClient\(/i],
+    category: 'cloud key management',
+    explanation: 'KMS integration moves encryption boundaries into a managed key service. The important design work is around envelope encryption, tenant isolation, key rotation, and how secrets are decrypted only at the last responsible moment.',
+    score: 9,
+    retrievalTerms: ['google cloud kms', 'envelope encryption', 'dek', 'kek', 'tenant secrets'],
+  },
   {
     name: 'Redis',
-    patterns: [/from ['"]ioredis['"]|from ['"]redis['"]|new Redis\(|createClient\(\)/i],
+    patterns: [/from ['"]ioredis['"]|from ['"]redis['"]|new Redis\(|redis:\/\/|upstash/i],
     category: 'caching / pub-sub',
     explanation: 'Redis integration adds a fast in-memory layer between the application and the database. Key decisions: TTL strategy, fallback behavior on cache miss, and cache invalidation approach.',
     score: 9,
+    retrievalTerms: ['redis', 'cache invalidation', 'pub sub', 'ttl'],
   },
   {
     name: 'Stripe',
@@ -35,10 +45,11 @@ const KNOWN_SERVICES: ServiceSignature[] = [
   },
   {
     name: 'Supabase',
-    patterns: [/from ['"]@supabase\/supabase-js['"]|createClient\(/],
+    patterns: [/from ['"]@supabase\/supabase-js['"]|supabaseUrl|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY/i],
     category: 'database / auth / storage',
     explanation: 'Supabase integration provides a Postgres-backed backend with built-in auth and row-level security. Connection setup and query patterns matter for both security and performance.',
     score: 7,
+    retrievalTerms: ['supabase', 'postgres', 'row level security', 'tenant storage'],
   },
   {
     name: 'Prisma',
@@ -103,6 +114,7 @@ export class IntegrationModule implements CodeAnalyzer {
     for (const service of KNOWN_SERVICES) {
       if (service.category === AI_CATEGORY) continue;
       if (service.patterns.some(p => p.test(addedText))) {
+        const matchingDiff = ctx.diffs.find((diff) => service.patterns.some((pattern) => pattern.test(diff.patch)));
         return {
           moduleId: this.id,
           aspect: `${service.name} integration`,
@@ -110,7 +122,8 @@ export class IntegrationModule implements CodeAnalyzer {
           technicalDetail: `${service.name}, ${service.category}. New import/client initialization detected in the diff.`,
           plainLanguage: service.explanation,
           interestScore: service.score,
-          contextHint: `${ctx.diffs[0]?.filename ?? 'unknown'} in ${ctx.repo}`,
+          contextHint: `${matchingDiff?.filename ?? ctx.diffs[0]?.filename ?? 'unknown'} in ${ctx.repo}`,
+          retrievalTerms: service.retrievalTerms,
         };
       }
     }


--- src/analysis/modules/security.ts
diff --git a/src/analysis/modules/security.ts b/src/analysis/modules/security.ts
index 495a9cb..b925bb1 100644
--- a/src/analysis/modules/security.ts
+++ b/src/analysis/modules/security.ts
@@ -6,14 +6,28 @@ interface SecurityPattern {
   readonly technicalDetail: string;
   readonly explanation: string;
   readonly isConcern: boolean;
+  readonly retrievalTerms?: readonly string[];
   detect(addedLines: readonly string[], filename: string): boolean;
 }
 
 const SECRET_REGEX = /(?:api[_-]?key|secret|token|password|credentials)\s*[:=]\s*['"][A-Za-z0-9+/=_-]{16,}['"]/i;
 const SQL_CONCAT_REGEX = /(?:`SELECT|`INSERT|`UPDATE|`DELETE|`DROP).*\$\{|['"]SELECT.*['"]\s*\+|['"]INSERT.*['"]\s*\+/i;
+const KMS_ENCRYPTION_REGEX = /@google-cloud\/kms|KeyManagementServiceClient|encrypted_dek|envelope encryption|createCipheriv|createDecipheriv|aes-256-gcm|getAuthTag|setAuthTag|kmsKeyName|resolveTenantSecrets|wrap(ped)? key|unwrap/i;
 const TEST_FILE_REGEX = /\.(test|spec)\.(ts|tsx|js|jsx)$|__tests__\//;
 
 const PATTERNS: readonly SecurityPattern[] = [
+  {
+    name: 'key management / envelope encryption',
+    score: 9,
+    isConcern: false,
+    technicalDetail: 'Envelope encryption with KMS-backed key management — a KEK protects tenant-scoped DEKs, while local AES-GCM handles the actual payload encryption.',
+    explanation: 'This is a serious security hardening step. Instead of leaving sensitive tokens in plaintext or relying on one shared secret, the system wraps per-tenant keys with a managed KMS boundary and decrypts data only when needed.',
+    retrievalTerms: ['kms', 'envelope encryption', 'dek', 'kek', 'aes-256-gcm', 'tenant secrets'],
+    detect: (lines, filename) => {
+      if (TEST_FILE_REGEX.test(filename)) return false;
+      return lines.some((line) => KMS_ENCRYPTION_REGEX.test(line));
+    },
+  },
   {
     name: 'hardcoded secret',
     score: 9,
@@ -95,6 +109,7 @@ export class SecurityModule implements CodeAnalyzer {
             plainLanguage: pattern.explanation,
             interestScore: pattern.score,
             contextHint: `${diff.filename} in ${ctx.repo}`,
+            retrievalTerms: pattern.retrievalTerms ? [...pattern.retrievalTerms] : undefined,
           };
         }
       }


--- src/analysis/pipeline.ts
diff --git a/src/analysis/pipeline.ts b/src/analysis/pipeline.ts
index 03adde2..f42df0e 100644
--- a/src/analysis/pipeline.ts
+++ b/src/analysis/pipeline.ts
@@ -1,6 +1,7 @@
 import { logger } from '../utils/logger.js';
 import { MODULE_REGISTRY } from './modules/index.js';
 import type { AnalysisContext, Finding, CodeAnalyzer } from './types.js';
+import { enrichFindingsForRetrieval } from './retrieval-enrichment.js';
 
 /**
  * Runs all applicable modules in parallel and returns the top N findings
@@ -62,7 +63,8 @@ export async function runPipeline(
   }
 
   const MIN_INTEREST_SCORE = 5;
-  const sorted = findings
+  const enrichedFindings = enrichFindingsForRetrieval(findings, ctx);
+  const sorted = enrichedFindings
     .filter((f) => f.interestScore >= MIN_INTEREST_SCORE)
     .map((f) => ({
       finding: f,


--- src/analysis/retrieval-enrichment.ts
diff --git a/src/analysis/retrieval-enrichment.ts b/src/analysis/retrieval-enrichment.ts
new file mode 100644
index 0000000..62f905f
--- /dev/null
+++ b/src/analysis/retrieval-enrichment.ts
@@ -0,0 +1,180 @@
+import type { AnalysisContext, FileDiff, Finding } from './types.js';
+
+const MAX_RETRIEVAL_TERMS = 18;
+const MAX_FILE_SIGNALS = 5;
+const MAX_RETRIEVAL_TEXT_LENGTH = 2200;
+
+const STOP_WORDS = new Set([
+  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'when', 'then',
+  'were', 'have', 'will', 'your', 'their', 'there', 'about', 'after', 'before',
+  'used', 'using', 'user', 'users', 'code', 'repo', 'file', 'files', 'module',
+  'modules', 'value', 'values', 'data', 'type', 'types', 'test', 'tests', 'line',
+  'lines', 'more', 'less', 'very', 'over', 'under', 'same', 'such', 'only',
+  'just', 'than', 'some', 'into', 'also', 'been', 'being', 'make', 'made',
+  'does', 'did', 'done', 'adds', 'added', 'remove', 'removed', 'update',
+  'updated', 'changes', 'change', 'logic', 'system', 'service', 'services',
+  'client', 'clients', 'config', 'schema', 'unknown', 'null', 'true', 'false',
+]);
+
+const MODULE_HINTS: Record<string, readonly string[]> = {
+  complexity: ['algorithmic complexity', 'query cost', 'performance hotspot'],
+  design_patterns: ['design pattern', 'dependency inversion', 'abstraction boundary'],
+  clean_code: ['readability', 'refactor', 'maintainability'],
+  type_system: ['type safety', 'schema typing', 'inference'],
+  integration: ['external service', 'api integration', 'client initialization'],
+  testing: ['automated testing', 'test harness', 'regression safety'],
+  ai_assisted: ['ai workflow', 'prompting', 'model integration'],
+  performance: ['latency', 'throughput', 'resource usage'],
+  security: ['security hardening', 'encryption', 'authentication', 'secrets management'],
+  api_design: ['api contract', 'interface design', 'backward compatibility'],
+  error_resilience: ['error handling', 'retry strategy', 'fault tolerance'],
+  observability: ['tracing', 'logging', 'metrics', 'diagnostics'],
+  concurrency: ['parallelism', 'race condition', 'synchronization'],
+  dx: ['developer experience', 'tooling', 'validation'],
+  dependency_health: ['dependency upgrade', 'versioning', 'supply chain'],
+  evolutionary: ['modularization', 'migration', 'incremental refactor'],
+  js_advanced: ['javascript runtime', 'async control flow', 'language feature'],
+  react_patterns: ['react component design', 'state management', 'rendering'],
+  devops: ['deployment', 'ci cd', 'infrastructure automation'],
+  python_patterns: ['python architecture', 'async python', 'python tooling'],
+  go_patterns: ['go services', 'goroutines', 'go observability'],
+  java_patterns: ['java backend', 'spring or quarkus patterns', 'jvm services'],
+  elixir_patterns: ['beam systems', 'otp', 'elixir architecture'],
+  architecture_patterns: ['system boundaries', 'service decomposition', 'software architecture'],
+};
+
+function splitCamelCase(input: string): string[] {
+  return input
+    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
+    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
+    .split(/\s+/)
+    .filter(Boolean);
+}
+
+function tokenize(input: string): string[] {
+  const rawParts = input
+    .replace(/[@/.:()[\]{}]/g, ' ')
+    .split(/[^A-Za-z0-9_-]+/)
+    .filter(Boolean);
+
+  const tokens: string[] = [];
+  for (const part of rawParts) {
+    const pieces = splitCamelCase(part).flatMap((piece) => piece.split(/[_-]+/));
+    for (const piece of pieces) {
+      const normalized = piece.trim().toLowerCase();
+      if (
+        normalized.length < 3
+        || normalized.length > 32
+        || STOP_WORDS.has(normalized)
+        || /^\d+$/.test(normalized)
+      ) {
+        continue;
+      }
+      tokens.push(normalized);
+    }
+  }
+  return tokens;
+}
+
+function pushUnique<T>(items: T[], value: T): void {
+  if (!items.includes(value)) items.push(value);
+}
+
+function trimSnippet(text: string, maxLength: number): string {
+  const normalized = text.replace(/\s+/g, ' ').trim();
+  if (normalized.length <= maxLength) return normalized;
+  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
+}
+
+function getFileSignals(diffs: readonly FileDiff[], contextHint?: string): string[] {
+  const signals: string[] = [];
+  if (contextHint) pushUnique(signals, contextHint);
+
+  const rankedFiles = [...diffs]
+    .sort((left, right) => (right.additions + right.deletions) - (left.additions + left.deletions))
+    .slice(0, MAX_FILE_SIGNALS)
+    .map((diff) => diff.filename);
+
+  for (const filename of rankedFiles) {
+    pushUnique(signals, filename);
+  }
+
+  return signals.slice(0, MAX_FILE_SIGNALS);
+}
+
+function getCodeSignals(diffs: readonly FileDiff[], commitMessage: string, commitBody?: string): string[] {
+  const weights = new Map<string, number>();
+
+  const addWeight = (token: string, amount: number): void => {
+    weights.set(token, (weights.get(token) ?? 0) + amount);
+  };
+
+  for (const token of tokenize(commitMessage)) addWeight(token, 4);
+  for (const token of tokenize(commitBody ?? '')) addWeight(token, 3);
+
+  for (const diff of diffs) {
+    for (const token of tokenize(diff.filename)) addWeight(token, 2);
+
+    const addedLines = diff.patch
+      .split('\n')
+      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
+      .map((line) => line.slice(1))
+      .filter(Boolean);
+
+    for (const line of addedLines.slice(0, 80)) {
+      const lineWeight = /\b(import|from|new |class |interface |function |const |let |type |enum )/.test(line) ? 2 : 1;
+      for (const token of tokenize(line)) addWeight(token, lineWeight);
+    }
+  }
+
+  return [...weights.entries()]
+    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
+    .slice(0, MAX_RETRIEVAL_TERMS)
+    .map(([token]) => token);
+}
+
+function buildRetrievalText(
+  finding: Finding,
+  ctx: AnalysisContext,
+  retrievalTerms: readonly string[],
+  fileSignals: readonly string[],
+): string {
+  const sections = [
+    `Repository: ${ctx.repo}`,
+    `Module: ${finding.moduleId}`,

--- src/analysis/types.ts
diff --git a/src/analysis/types.ts b/src/analysis/types.ts
index 565d710..5a1beb3 100644
--- a/src/analysis/types.ts
+++ b/src/analysis/types.ts
@@ -36,6 +36,7 @@ export interface FileDiff {
 export interface AnalysisContext {
   diffs: FileDiff[];
   commitMessage: string;
+  commitBody?: string;
   languages: string[];     // detected from file extensions
   repo: string;            // 'owner/repo'
   sha: string;
@@ -49,6 +50,8 @@ export interface Finding {
   plainLanguage: string;   // what Claude should explain in the post
   interestScore: number;   // 1–10
   contextHint?: string;    // e.g. "ReconciliationService.ts in vialabs-net/scrappers"
+  retrievalText?: string;  // richer retrieval-oriented text for article matching
+  retrievalTerms?: string[];
   evidence?: {
     before?: string;       // code snippet or description of before state
     after?: string;        // code snippet or description of after state


--- src/content/matcher.ts
diff --git a/src/content/matcher.ts b/src/content/matcher.ts
index d702cb4..f12b2b9 100644
--- a/src/content/matcher.ts
+++ b/src/content/matcher.ts
@@ -4,6 +4,7 @@ import type { IAIClient } from '../ai/types.js';
 import { logger } from '../utils/logger.js';
 
 const SIMILARITY_THRESHOLD = 0.75;
+const FALLBACK_THRESHOLDS = [0.45, 0.3, 0];
 const QUALITY_GATE = 6;
 const MATCH_WINDOW_DAYS = 30;
 const TOP_CANDIDATES = 3;
@@ -33,30 +34,43 @@ export interface MatchedContext {
 interface FindingInput {
   readonly moduleId: string;
   readonly finding: string;
+  readonly technicalDetail?: string;
   readonly plainLanguage: string;
   readonly contextHint?: string;
+  readonly retrievalText?: string;
+  readonly retrievalTerms?: string[];
 }
 
-/**
- * Stage 1 — pgvector bi-encoder search (~5ms + 1 embedding call per finding).
- *
- * Embeds finding.plainLanguage, searches article_chunks by cosine similarity,
- * deduplicates by article (keep best chunk per article), returns top 3 candidates.
- */
-async function stage1BiEncoder(
-  finding: FindingInput,
-  embedder: IEmbedder,
+interface Stage1Result {
+  readonly candidates: CandidateArticle[];
+  readonly thresholdUsed: number;
+  readonly queryText: string;
+}
+
+function buildRetrievalQuery(finding: FindingInput): string {
+  const sections = [
+    finding.retrievalText,
+    `Headline: ${finding.finding}`,
+    finding.technicalDetail ? `Technical detail: ${finding.technicalDetail}` : '',
+    `Explanation: ${finding.plainLanguage}`,
+    finding.contextHint ? `Code location: ${finding.contextHint}` : '',
+    finding.retrievalTerms?.length ? `Concrete terms: ${finding.retrievalTerms.join(', ')}` : '',
+  ].filter(Boolean);
+
+  return sections.join('\n');
+}
+
+async function fetchCandidateArticles(
   db: SupabaseClient,
+  embedding: number[],
   similarityThreshold: number,
 ): Promise<CandidateArticle[]> {
-  const embedding = await embedder.embed(finding.plainLanguage);
   const cutoff = new Date(Date.now() - MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
 
-  // pgvector cosine similarity search via Supabase RPC
   const { data, error } = await db.rpc('match_article_chunks', {
     query_embedding: embedding,
     similarity_threshold: similarityThreshold,
-    match_count: TOP_CANDIDATES * 3,  // fetch more, deduplicate by article below
+    match_count: TOP_CANDIDATES * 3,
     min_quality_score: QUALITY_GATE,
     week_of_cutoff: cutoff,
   });
@@ -67,14 +81,12 @@ async function stage1BiEncoder(
 
   const chunks = (data ?? []) as ChunkRow[];
 
-  // Deduplicate: keep best similarity per article
   const bestByArticle = new Map<string, number>();
   for (const chunk of chunks) {
     const prev = bestByArticle.get(chunk.content_item_id) ?? 0;
     if (chunk.similarity > prev) bestByArticle.set(chunk.content_item_id, chunk.similarity);
   }
 
-  // Sort by similarity DESC, take top 3 unique articles
   const topMatches = [...bestByArticle.entries()]
     .sort((a, b) => b[1] - a[1])
     .slice(0, TOP_CANDIDATES)
@@ -102,6 +114,46 @@ async function stage1BiEncoder(
     .sort((a, b) => b.match_strength - a.match_strength);
 }
 
+/**
+ * Stage 1 — pgvector bi-encoder search (~5ms + 1 embedding call per finding).
+ *
+ * Embeds a retrieval-oriented narrative, searches article_chunks by cosine similarity,
+ * and falls back to looser thresholds before giving up.
+ */
+async function stage1BiEncoder(
+  finding: FindingInput,
+  embedder: IEmbedder,
+  db: SupabaseClient,
+  similarityThreshold: number,
+): Promise<Stage1Result> {
+  const queryText = buildRetrievalQuery(finding);
+  const embedding = await embedder.embed(queryText);
+  const thresholds = [similarityThreshold];
+  for (const fallback of FALLBACK_THRESHOLDS) {
+    if (fallback < similarityThreshold && !thresholds.includes(fallback)) {
+      thresholds.push(fallback);
+    }
+  }
+  if (!thresholds.includes(0)) thresholds.push(0);
+
+  for (const threshold of thresholds) {
+    const candidates = await fetchCandidateArticles(db, embedding, threshold);
+    if (candidates.length > 0) {
+      return {
+        candidates,
+        thresholdUsed: threshold,
+        queryText,
+      };
+    }
+  }
+
+  return {
+    candidates: [],
+    thresholdUsed: thresholds[thresholds.length - 1] ?? similarityThreshold,
+    queryText,
+  };
+}
+
 /**
  * Stage 2 — AI cross-encoder (one batched call per finding, all candidates evaluated together).
  *
@@ -127,7 +179,8 @@ Respond ONLY as a JSON array. No markdown, no explanation outside the array.`;
   const userPrompt = `Code change (finding):
 - Module: ${finding.moduleId}
 - Headline: ${finding.finding}
-- Context: ${finding.plainLanguage}${finding.contextHint ? `\n- File: ${finding.contextHint}` : ''}
+- Technical detail: ${finding.technicalDetail ?? 'n/a'}
+- Context: ${finding.plainLanguage}${finding.contextHint ? `\n- File: ${finding.contextHint}` : ''}${finding.retrievalTerms?.length ? `\n- Concrete terms: ${finding.retrievalTerms.join(', ')}` : ''}
 
 Candidate articles:
 ${candidateList}
@@ -231,11 +284,34 @@ export async function matchFindingsToArticles(
   const similarityThreshold = options?.similarityThreshold ?? SIMILARITY_THRESHOLD;
   for (const finding of findings) {
     try {
-      const candidates = await stage1BiEncoder(finding, embedder, db, similarityThreshold);
-      if (candidates.length === 0) continue;
+      const stage1 = await stage1BiEncoder(finding, embedder, db, similarityThreshold);
+      if (stage1.candidates.length === 0) {
+        logger.info('content.match.stage1_no_candidates', {
+          moduleId: finding.moduleId,

--- src/github/commit-enricher.ts
diff --git a/src/github/commit-enricher.ts b/src/github/commit-enricher.ts
index b72e22a..5b6fb24 100644
--- a/src/github/commit-enricher.ts
+++ b/src/github/commit-enricher.ts
@@ -6,6 +6,8 @@ import type { FileDiff } from '../analysis/types.js';
 export interface EnrichedCommit {
   sha: string;
   message: string;
+  body: string;
+  fullMessage: string;
   repo: string;
   authorLogin: string;
   totalAdditions: number;
@@ -52,10 +54,14 @@ export async function enrichCommit(
 
   const diffs = parseCommitFiles(raw.files ?? []);
   const languages = detectLanguages(diffs);
+  const fullMessage = raw.commit.message ?? '';
+  const [subject, ...bodyLines] = fullMessage.split('\n');
 
   return {
     sha: raw.sha,
-    message: raw.commit.message.split('\n')[0] ?? raw.commit.message,
+    message: subject ?? fullMessage,
+    body: bodyLines.join('\n').trim(),
+    fullMessage,
     repo: `${owner}/${repo}`,
     authorLogin,
     totalAdditions: raw.stats?.additions ?? 0,


--- src/main-poll.ts
diff --git a/src/main-poll.ts b/src/main-poll.ts
index 68dbdbf..58ad2e2 100644
--- a/src/main-poll.ts
+++ b/src/main-poll.ts
@@ -182,7 +182,14 @@ async function main(): Promise<void> {
       }
 
       const pipelineFindings = await runPipeline(
-        { diffs: commit.diffs, commitMessage: commit.message, languages: commit.languages, repo: commit.repo, sha: commit.sha },
+        {
+          diffs: commit.diffs,
+          commitMessage: commit.message,
+          commitBody: commit.body,
+          languages: commit.languages,
+          repo: commit.repo,
+          sha: commit.sha,
+        },
         config.posting.analysis_top_n,
         modules,
         recentModuleIds,


--- src/worker/process-job.ts
diff --git a/src/worker/process-job.ts b/src/worker/process-job.ts
index 417d350..a761108 100644
--- a/src/worker/process-job.ts
+++ b/src/worker/process-job.ts
@@ -264,6 +264,7 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
         {
           diffs: commit.diffs,
           commitMessage: commit.message,
+          commitBody: commit.body,
           languages: commit.languages,
           repo: commit.repo,
           sha: commit.sha,

```

## Claims a labelar

Opciones: `grounded` | `plausible_unsupported` | `contradicted` | `irrelevant` | `frame`

| # | Claim | Pre-label (LLM) | Tu label | Notas |
|---|-------|-----------------|----------|-------|
| 0 | One system that went from scraping text to handling LinkedIn tokens with KMS encryption, triggering live corpus fetches, and generating posts that don't accidentally cite articles the author never rea | needs_human | | |
| 1 | Let me trace the arc. | needs_human | | |
| 2 | It started with extraction hardening — Puppeteer fallback policies for hosts that block standard HTTP (Discord, Stripe), protected source lifecycles, and embedded match strength tracking baked into th | needs_human | | |
| 3 | The data layer got opinions. | needs_human | | |
| 4 | Then the security layer got rebuilt. | needs_human | | |
| 5 | Tenant tokens — LinkedIn OAuth, buffer credentials — moved from plaintext Supabase rows to envelope encryption backed by GCP KMS. | needs_human | | |
| 6 | New tokens encrypt before write. | needs_human | | |
| 7 | Workers decrypt at runtime. | needs_human | | |
| 8 | A rotation script re-encrypts the legacy rows that already exist. | needs_human | | |
| 9 | That's not a future plan. | needs_human | | |
| 10 | That's a migration with a backfill. | needs_human | | |
| 11 | CI caught up next. | needs_human | | |
| 12 | Hardcoded values moved to env vars, typecheck added to the deploy pipeline, secrets and env bindings wired into Cloud Run deploys properly. | needs_human | | |
| 13 | Then matching got three thresholds (0.45, 0.3, 0) and a richer query layer built from technical detail, retrieval text, and retrieval terms — plus an audit mode to surface gaps before they become invi | needs_human | | |
| 14 | The content corpus finally went live: a post-discovery fetch job now runs automatically after source discovery, with priority-sorted promotion and batch ID hashing for classifier stability. | needs_human | | |
| 15 | And then the hardest part — prompt constraints. | needs_human | | |
| 16 | A structured `buildIndustryContextBlock()` function replaced raw connection injection. | needs_human | | |
| 17 | It enforces convergence language, explicitly bans citation and derivation patterns, and can surface inferred source-family labels from URLs. | needs_human | | |
| 18 | The goal: articles inform tone without implying the author read them. | needs_human | | |
| 19 | That's a product contract, not just a prompt tweak. | needs_human | | |

## Post-level

- **Publish readiness:** [ ] publish_asis [ ] light_edit [ ] rewrite [ ] discard
- **¿Qué te haría desconfiar del post?** _______
