# Phase 2 Launch Runbook

Step-by-step commands to close Phase 2 and deploy `feat/content-intelligence` safely.

This runbook assumes:
- GCP project: `lilicurl`
- Cloud Run region: `us-central1`
- Supabase migration for Phase 2 is already applied
- seed corpus is already loaded

## 1. Prepare local variables

```bash
cd /Users/Lilicurl/Documents/git/social-engagement

export PROJECT_ID="lilicurl"
export REGION="us-central1"
export KMS_LOCATION="global"
export KMS_KEYRING="devcast"
export KMS_KEY="tenant-secrets"
export GCP_KMS_KEY_NAME="projects/${PROJECT_ID}/locations/${KMS_LOCATION}/keyRings/${KMS_KEYRING}/cryptoKeys/${KMS_KEY}"
```

If you already use a different KMS location or key name, replace the variables above.

## 2. Create the KMS key (skip if it already exists)

```bash
gcloud kms keyrings create "${KMS_KEYRING}" \
  --location="${KMS_LOCATION}" \
  --project="${PROJECT_ID}"

gcloud kms keys create "${KMS_KEY}" \
  --location="${KMS_LOCATION}" \
  --keyring="${KMS_KEYRING}" \
  --purpose="encryption" \
  --project="${PROJECT_ID}"
```

Verify:

```bash
gcloud kms keys describe "${KMS_KEY}" \
  --location="${KMS_LOCATION}" \
  --keyring="${KMS_KEYRING}" \
  --project="${PROJECT_ID}"
```

## 3. Discover which service accounts are running the app

```bash
export WEBHOOK_SA="$(gcloud run services describe getdevcast-webhook \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(spec.template.spec.serviceAccountName)')"

export WORKER_SA="$(gcloud run jobs describe devcast-worker \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(spec.template.template.spec.serviceAccountName)')"

export SCANNER_SA="$(gcloud run jobs describe devcast-scanner \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(spec.template.template.spec.serviceAccountName)')"

printf 'webhook=%s\nworker=%s\nscanner=%s\n' "$WEBHOOK_SA" "$WORKER_SA" "$SCANNER_SA"
```

If `WORKER_SA` or `SCANNER_SA` prints empty / `null`, the job is not using an explicit
service account and will typically inherit the project's default Compute Engine service
account. In that case, granting KMS access to the same default service account used by
the webhook is sufficient.

## 4. Grant KMS permissions

Grant runtime access to each Cloud Run service account:

```bash
for SA in "$WEBHOOK_SA" "$WORKER_SA" "$SCANNER_SA"; do
  gcloud kms keys add-iam-policy-binding "${KMS_KEY}" \
    --location="${KMS_LOCATION}" \
    --keyring="${KMS_KEYRING}" \
    --project="${PROJECT_ID}" \
    --member="serviceAccount:${SA}" \
    --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"
done
```

If the worker/scanner variables are empty, run the binding only for the non-empty service
account instead of looping over blank values.

Grant the same role to the identity that will run the local rotation script.
If you run it with your own user credentials:

```bash
gcloud kms keys add-iam-policy-binding "${KMS_KEY}" \
  --location="${KMS_LOCATION}" \
  --keyring="${KMS_KEYRING}" \
  --project="${PROJECT_ID}" \
  --member="user:<your-google-email>" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"
```

## 5. Authenticate local ADC for the rotation script

```bash
gcloud auth application-default login
```

If you use a service account key locally instead, export `GOOGLE_APPLICATION_CREDENTIALS`.

## 6. Set the KMS env var on Cloud Run

Webhook service:

```bash
gcloud run services update getdevcast-webhook \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --update-env-vars="GCP_KMS_KEY_NAME=${GCP_KMS_KEY_NAME}"
```

Worker job:

```bash
gcloud run jobs update devcast-worker \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --update-env-vars="GCP_KMS_KEY_NAME=${GCP_KMS_KEY_NAME}"
```

Scanner job:

```bash
gcloud run jobs update devcast-scanner \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --update-env-vars="GCP_KMS_KEY_NAME=${GCP_KMS_KEY_NAME}"
```

## 7. Verify launch-critical env vars

Worker:

```bash
gcloud run jobs describe devcast-worker \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='export'
```

Scanner:

```bash
gcloud run jobs describe devcast-scanner \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='export'
```

Confirm these are present where needed:
- `GCP_KMS_KEY_NAME`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 8. Rotate legacy plaintext tokens

Use the same KMS key locally:

```bash
export GCP_KMS_KEY_NAME="projects/${PROJECT_ID}/locations/${KMS_LOCATION}/keyRings/${KMS_KEYRING}/cryptoKeys/${KMS_KEY}"
```

Dry run first:

```bash
npm run rotate-tenant-tokens -- --dry-run
```

If the candidates look correct, run the real rotation:

```bash
npm run rotate-tenant-tokens
```

Single-tenant troubleshooting:

```bash
npm run rotate-tenant-tokens -- --tenant-id <tenant-uuid> --dry-run
npm run rotate-tenant-tokens -- --tenant-id <tenant-uuid>
```

## 9. Commit, push, and merge Phase 2

```bash
git status
git add package.json package-lock.json src/security scripts/rotate-tenant-tokens.ts src/webhook/handlers/onboard.ts src/webhook/handlers/linkedin-oauth.ts src/worker/process-job.ts src/worker/main-scan-tenants.ts docs/adr/ADR-002-envelope-encryption-kms.md docs/phase2-launch-runbook.md
git commit -m "feat: add kms-backed tenant token encryption"
git push origin feat/content-intelligence
```

Then open the PR to `trunk`.

## 10. Deploy

After merge to `trunk`, the existing GitHub Actions deploy workflow will roll the new image.

If you need a manual image rollout after merge:

```bash
git checkout trunk
git pull origin trunk
```

Then push a no-op commit or rerun the deploy workflow from GitHub Actions.

## 11. Run the Phase 2 smoke test

1. Reconnect Buffer or LinkedIn for one tenant if you want to verify a fresh encrypted write
2. Push a real commit in a connected repo
3. Check the worker logs
4. Confirm:
   - the job succeeds
   - a post draft is generated
   - industry context matches from the seed corpus
   - Buffer publish / LinkedIn direct still works
   - scanner still matches sent posts

Useful log commands:

```bash
gcloud logging read 'resource.type="cloud_run_job" AND resource.labels.job_name="devcast-worker"' \
  --project="${PROJECT_ID}" \
  --limit=50 \
  --format='value(textPayload)'

gcloud logging read 'resource.type="cloud_run_job" AND resource.labels.job_name="devcast-scanner"' \
  --project="${PROJECT_ID}" \
  --limit=50 \
  --format='value(textPayload)'
```

## 12. Definition of done for Phase 2

Phase 2 is operationally closed when all of this is true:
- merged to `trunk`
- deployed to Cloud Run
- `GCP_KMS_KEY_NAME` present in webhook, worker, and scanner
- `OPENAI_API_KEY` confirmed in worker/content jobs
- legacy tenants rotated
- one real push verifies seed-corpus matching end-to-end
