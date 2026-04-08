# ADR-002 — Envelope encryption with GCP KMS for token storage

| Field | Value |
|-------|-------|
| Status | Accepted |
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

**Not yet implemented.** Required before paid tier launch.

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
