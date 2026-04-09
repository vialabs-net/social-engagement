# ADR-002 — Envelope encryption with GCP KMS for token storage

| Field | Value |
|-------|-------|
| Status | Accepted, implemented on `feat/content-intelligence` |
| Date | 2026-04-08 |
| Deciders | Liliana Castellanos |

## Context

devcast stores third-party API tokens (`buffer_access_token`) in the `tenants` table in
Supabase. Storing tokens in plaintext is acceptable for alpha but not before accepting
paying users or listing on GitHub Marketplace.

Two options were considered:

**Option A: Envelope encryption with GCP KMS**
- One KMS key (the KEK — Key Encryption Key) covers all tenants.
- At tenant creation: generate a random 256-bit DEK (Data Encryption Key) locally,
  call KMS to encrypt the DEK, store the encrypted DEK in `tenants.encrypted_dek`.
- Encrypt the token with the DEK before writing to DB. Stored as ciphertext in
  `tenants.buffer_access_token`.
- In the worker: call KMS once per job to unwrap the DEK, then decrypt the token locally.

**Option B: GCP Secret Manager per token**
- Each token stored as a separate Secret Manager secret.
- `tenants.buffer_access_token` stores the secret resource name, not the value.
- Worker calls Secret Manager to retrieve the token.

## Decision

**Envelope encryption with GCP KMS (Option A).**

**Cost:**
- Option A: 1 KMS key = ~$0.06/month fixed. KMS operations: ~$0.00 at alpha scale
  (one unwrap per job run, billed per 10,000 operations at $0.03).
- Option B: $0.06/secret/month × 1 token × N tenants = $0.06N/month.
  At 100 tenants: $6/month just for storage + $0.03/10k accesses.
  Option B scales linearly with tenants. Rejected.

**Implementation scope:** The columns (`buffer_access_token`, `encrypted_dek`) stay as-is
in the DB contract. Only the storage adapter and a decryption step in `processJob` change.
`TenantRow` interface in `process-job.ts` is unchanged.

**Implementation status:** The envelope encryption flow now exists in the app code:
- new tokens are encrypted before being written from onboarding / OAuth callbacks
- worker and scanner decrypt tokens at runtime using GCP KMS
- a rotation script exists to re-encrypt legacy plaintext rows already stored in Supabase

Rollout is still required before paid tier launch.

## Why Rotation Is Required

Rotation is needed because existing tenants were created before envelope encryption was added.
Those rows already contain plaintext tokens in:

- `tenants.buffer_access_token`
- `tenants.linkedin_access_token`

After the new code is deployed:
- new or reconnected tenants will be stored encrypted automatically
- old tenants would continue working temporarily only because the runtime keeps a legacy
  fallback for plaintext rows during rollout

That fallback is deliberate and temporary. Rotation is what removes the remaining plaintext
secrets from the database without forcing every tenant to reconnect manually.

So the purpose of rotation is:
- eliminate pre-existing plaintext tokens from Supabase
- make the database consistent: all tenants have `encrypted_dek` + ciphertext tokens
- let us remove the legacy plaintext fallback later with confidence
- satisfy the "required before launch" security requirement in the master spec

## Rollout Shape

Safe rollout order:

1. Apply the DB migration that adds `tenants.encrypted_dek`
2. Create the KMS key and grant runtime IAM permissions
3. Deploy the new code with `GCP_KMS_KEY_NAME`
4. Run the rotation script against existing tenants
5. Smoke-test publish + scanner with a real tenant

This order avoids downtime:
- pre-rotation tenants still work because the runtime tolerates plaintext rows
- post-deploy writes are encrypted immediately
- rotation backfills the rest in place

## Consequences

**Better:**
- Fixed cost regardless of tenant count.
- The master key (KEK) is never in the application code or DB — only in KMS.
- A compromised DB gives an attacker encrypted DEKs and encrypted tokens, neither useful
  without the KMS key.
- KMS key rotation is independent of tenant data migration.

**Worse:**
- One additional KMS call per worker job (decrypt DEK). Adds ~20ms latency per job run.
  Acceptable.
- Self-managed encryption logic: the `encryptToken` and `decryptToken` helpers must be
  implemented correctly. An error leaves tokens unreadable.
- If the KMS key is deleted, all tenant tokens are permanently unrecoverable. Requires
  a key deletion policy (30-day scheduled deletion minimum in GCP KMS).
- `encrypted_dek` is a new column in `tenants` — requires a migration that also
  re-encrypts any existing plaintext tokens during rollout.

## Operational Notes

- The runtime expects `GCP_KMS_KEY_NAME` (or legacy alias `KMS_KEY_NAME`) to contain the full
  crypto key resource name, for example:
  `projects/<project>/locations/<location>/keyRings/<keyring>/cryptoKeys/<key>`
- The local rotation script uses the same env var and Google Application Default Credentials.
- Rotation should be run first with `--dry-run`, then without it once the candidate set looks
  correct.
