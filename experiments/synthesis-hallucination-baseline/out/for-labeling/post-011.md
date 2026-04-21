# Post 011

## Post generado

> Tokens sitting in a database as plaintext are a breach waiting to be discovered. This commit closes that gap.
> 
> The onboarding flow and OAuth callbacks now encrypt tokens before they ever touch storage. Workers and the scanner decrypt at runtime via GCP KMS — the database holds ciphertext, and the plaintext only lives long enough to be used.
> 
> The part that often gets skipped: a rotation script re-encrypts the legacy plaintext rows already sitting in Supabase. New security properties applied retroactively, not just forward from merge day.
> 
> This is envelope encryption — KMS holds the key, the app holds the encrypted data, and neither is useful without the other. The blast radius of a leaked database row just got a lot smaller.
> 
> The integration angle matters here too. Every OAuth callback is a trust handoff between systems. Encrypting at the boundary means the token is protected before it crosses into your own persistence layer — not after.
> 
> Security architecture is often invisible until it isn't. This one became visible in code.
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

## Claims a labelar

Opciones: `grounded` | `plausible_unsupported` | `contradicted` | `irrelevant` | `frame`

| # | Claim | Pre-label (LLM) | Tu label | Notas |
|---|-------|-----------------|----------|-------|
| 0 | Tokens sitting in a database as plaintext are a breach waiting to be discovered. | needs_human | | |
| 1 | This commit closes that gap. | needs_human | | |
| 2 | The onboarding flow and OAuth callbacks now encrypt tokens before they ever touch storage. | needs_human | | |
| 3 | Workers and the scanner decrypt at runtime via GCP KMS — the database holds ciphertext, and the plaintext only lives long enough to be used. | needs_human | | |
| 4 | The part that often gets skipped: a rotation script re-encrypts the legacy plaintext rows already sitting in Supabase. | needs_human | | |
| 5 | New security properties applied retroactively, not just forward from merge day. | needs_human | | |
| 6 | This is envelope encryption — KMS holds the key, the app holds the encrypted data, and neither is useful without the other. | needs_human | | |
| 7 | The blast radius of a leaked database row just got a lot smaller. | needs_human | | |
| 8 | The integration angle matters here too. | needs_human | | |
| 9 | Every OAuth callback is a trust handoff between systems. | needs_human | | |
| 10 | Encrypting at the boundary means the token is protected before it crosses into your own persistence layer — not after. | needs_human | | |
| 11 | Security architecture is often invisible until it isn't. | needs_human | | |
| 12 | This one became visible in code. | needs_human | | |

## Post-level

- **Publish readiness:** [ ] publish_asis [ ] light_edit [ ] rewrite [ ] discard
- **¿Qué te haría desconfiar del post?** _______
