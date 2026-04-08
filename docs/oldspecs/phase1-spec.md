# Phase 1 — GitHub Marketplace — Spec & Gap Analysis

**Status:** v6 FINAL — 2026-04-06

---

## Goal

devcast as a one-click installable GitHub App. Any developer installs it, configures in 2 minutes, and starts receiving LinkedIn posts from their commits. Multi-tenant from day one.

---

## Architectural Transition: Single-Tenant → Multi-Tenant

devcast was built as a single-tenant system for Liliana. Multi-tenant (GitHub App) was added on top. The storage layer was never updated. This creates data contamination between tenants.

### Before (single-tenant, how it worked for Liliana)

```
[GitHub Actions CRONs — Liliana's credentials hardcoded]

poll-and-generate.yml (every 4h)
  → main-poll.ts
  → config from config.yaml (Liliana's github_username)
  → credentials from GitHub Actions secrets (Liliana's tokens)
  → SupabaseStorage(url, key) — no tenant, queries all rows
  → voice_posts written without tenant_id

scan-sent-posts.yml (every 2h)
  → main-scan.ts
  → Liliana's BUFFER_ACCESS_TOKEN from secrets
  → scans Liliana's Buffer account
  → matches against ALL voice_posts (no tenant filter)
```

### After (multi-tenant, how it should work)

```
[Webhook + Cloud Run — per-tenant credentials from DB]

GitHub push → webhook → job_queue(tenant_id)
  → devcast-worker (every 15 min)
  → process-job.ts
  → tenant from DB (credentials, config)
  → SupabaseStorage(url, key, tenant.id) — tenant-scoped
  → voice_posts written WITH tenant_id

devcast-scanner (every 2h)
  → main-scan-tenants.ts
  → for each tenant with buffer_access_token
  → scan THEIR Buffer account with THEIR token
  → match against voice_posts WHERE tenant_id = tenant.id
```

### The gap: storage layer is still single-tenant

The worker (`process-job.ts`) knows the tenant. The storage (`SupabaseStorage`) doesn't. All voice_posts are written and queried without tenant scope. Two tenants using devcast today would contaminate each other's voice training.

### Migration plan for Liliana's data

Liliana's existing voice_posts were created by the single-tenant path (no tenant_id). These must be assigned to her tenant before the multi-tenant storage goes live:

1. **Verify**: `SELECT COUNT(*) FROM voice_posts WHERE tenant_id IS NULL` — should match Liliana's post count
2. **Backfill**: `UPDATE voice_posts SET tenant_id = (SELECT id FROM tenants WHERE github_username = 'lilicurl') WHERE tenant_id IS NULL`
3. **Verify again**: `SELECT COUNT(*) FROM voice_posts WHERE tenant_id IS NULL` — should be 0

After this, the single-tenant crons are disabled (kept as `workflow_dispatch` for local dev), and all processing goes through the multi-tenant worker + scanner.

`main-poll.ts` and `main-scan.ts` remain in the codebase as local dev tools. For local dev, they use `SqliteStorage` which also gets tenant support, using `TENANT_ID` env var (or a default value for single-user local testing).

### Cutover sequence (exact order of operations)

The transition from single-tenant to multi-tenant has a timing risk: between deploy (new code with `WHERE tenant_id = X`) and backfill (existing rows get tenant_id), queries return 0 results. The worker runs every 15 minutes — that's the window.

**Strategy: deploy + backfill in the same 15-minute window, before the next worker run.**

```
1. Merge PR A to trunk
   → CI/CD deploys webhook + worker automatically (~3 min)

2. IMMEDIATELY run backfill in Supabase SQL Editor (within 15 min of deploy):
   -- Verify
   SELECT COUNT(*) FROM voice_posts WHERE tenant_id IS NULL;
   
   -- Backfill
   UPDATE voice_posts SET tenant_id = (
     SELECT id FROM tenants WHERE github_username = 'lilicurl'
   ) WHERE tenant_id IS NULL;
   
   -- Verify again
   SELECT COUNT(*) FROM voice_posts WHERE tenant_id IS NULL;
   -- Must be 0

3. Verify: push a test commit → worker processes it → voice_posts row has tenant_id

4. Merge PR B (disable single-tenant CRONs + multi-tenant scanner)
   → CI/CD deploys

5. Create Cloud Run Job + Cloud Scheduler for scanner:
   gcloud run jobs create devcast-scanner --image gcr.io/lilicurl/devcast:latest \
     --region us-central1 --project lilicurl \
     --command "npx" --args "tsx,src/worker/main-scan-tenants.ts" \
     --update-secrets=...
   
   gcloud scheduler jobs create http devcast-scanner-trigger \
     --schedule "0 */2 * * *" \
     --uri "https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/749111652662/jobs/devcast-scanner:run" \
     --http-method POST \
     --oauth-service-account-email 749111652662-compute@developer.gserviceaccount.com \
     --location us-central1 --project lilicurl

6. Verify: publish a post from Buffer → scanner picks it up → voice_posts.status = 'published'

7. Done. Single-tenant path disabled. Multi-tenant path active.
```

### Backward compatibility during the window

The tenant-scoped queries MUST handle `tenant_id IS NULL` gracefully during the backfill window. If a query finds 0 rows with `WHERE tenant_id = ?`, the pipeline continues without voice examples (same behavior as a new tenant with no history). No crash, no data loss — just lower quality posts for ~15 minutes until backfill completes.

This is NOT a code change — it's an operational acceptance. The code uses strict `WHERE tenant_id = $1` (no fallback to NULL). If backfill is delayed, Liliana's posts during the window generate without voice examples. Acceptable for a one-time migration.

---

## Current State (what's implemented)

### Infrastructure

| Component | Status | Where |
|-----------|--------|-------|
| GitHub App (`getdevcast`) | Registered, transferred to vialabs-net | github.com/settings/apps |
| Webhook receiver | Cloud Run Service `getdevcast-webhook` | `src/webhook/server.ts` |
| Worker | Cloud Run Job `devcast-worker`, every 15 min | `src/worker/main-worker.ts` |
| CI/CD | GitHub Actions → Docker build → Cloud Run deploy | `.github/workflows/deploy.yml` |
| Custom domain | `app.devcast.lilicurl.com` → Cloud Run | GCP domain mapping |
| Favicon | `public/favicon.png` served from server.ts | `src/webhook/server.ts` |

### Single-tenant workflows (pre-Marketplace, to be disabled)

| Workflow | Status | Notes |
|----------|--------|-------|
| `poll-and-generate.yml` | **To disable** | Single-tenant CRON every 4h. Replaced by webhook + worker. |
| `scan-sent-posts.yml` | **To disable** | Single-tenant CRON every 2h. Replaced by multi-tenant scanner. |

Both are kept as `workflow_dispatch` only for local testing after being disabled.

### Multi-tenant schema

| Table | Status | Notes |
|-------|--------|-------|
| `tenants` | ✓ | id, github_installation_id, github_username, plan, buffer_access_token, linkedin_*, config, voice_bootstrap |
| `job_queue` | ✓ | tenant_id FK, repo, before/after SHA, status, attempts |
| `voice_posts` | **BUG** | No `tenant_id` — all users' posts mixed in same table |
| `events_state` | Not used | Worker uses Compare API per push, not polling |
| `scheduled_slots` | Not used | Slot manager not wired into pipeline |

### Webhook handlers

| Route | Handler | Status |
|-------|---------|--------|
| `POST /webhooks/github` | `github-handler.ts` → `push.ts`, `installation.ts` | ✓ |
| `GET /onboard` | `onboard.ts` — dark theme form | ✓ |
| `POST /onboard` | `onboard.ts` — saves config to tenant | ✓ |
| `GET /auth/github/callback` | `github-oauth.ts` — code exchange + redirect | ✓ |
| `GET /auth/linkedin` | `linkedin-oauth.ts` — redirect to LinkedIn auth | ✓ |
| `GET /auth/linkedin/callback` | `linkedin-oauth.ts` — token exchange + store | ✓ |
| `GET /health` | inline in server.ts | ✓ |
| `GET /favicon.png` | inline in server.ts | ✓ |

### Worker pipeline (process-job.ts)

```
job_queue → fetch tenant → get installation token
  → compareCommits (before...after)
  → per commit:
    → enrichCommit → isInteresting?
    → runPipeline (24 analysis modules)
    → generatePosts (Sonnet)
    → post to LinkedIn (if token)
    → create Buffer Idea (if token)
    → notify via GitHub Issue
```

Status: ✓ functional for single tenant. Multi-tenant bugs exist (see below).

### Onboarding flow

```
User installs GitHub App
  → GitHub OAuth callback → redirect to /onboard?installation_id=X
  → Form: name, website, Buffer API key, Buffer org ID
  → Connect LinkedIn (OAuth 2.0)
  → Save → redirect with saved=1
```

Status: ✓ functional. Missing voice setup wizard.

### Marketplace listing

- Publisher verification requested for `vialabs-net` org
- Domain verification: `lilicurl.com` ✓, `vialabs.net` ✓
- Waiting ~3 business days for GitHub review
- Logo uploaded to GitHub App

---

## Bugs (must fix before Phase 2)

### BUG 1: `voice_posts` has no `tenant_id` — CRITICAL

**Problem:** All users' voice posts go into the same table without tenant identification. When `SupabaseStorage.getVoiceExamples()` fetches top voice examples for prompt assembly, it returns posts from ALL tenants. User A's posts contaminate User B's voice.

**Impact:**
- Voice examples from other users injected into prompts → wrong voice
- `edit_ratio` metrics mixed across users → voice training loop broken
- Phase 2 health report can't compare edit_ratio per tenant

**Root cause:** The original single-tenant design stored everything in `voice_posts` without scoping. The multi-tenant worker (`process-job.ts`) wraps the pipeline with tenant context but `SupabaseStorage` doesn't filter by tenant.

**Fix:**

Schema:
```sql
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX idx_voice_posts_tenant ON voice_posts(tenant_id);
```

Code changes:
1. `src/voice/storage.ts` — add `tenantId` parameter to `IVoiceStorage` interface methods
2. `src/voice/supabase-storage.ts` — filter all queries by `tenant_id`
3. `src/voice/sqlite-storage.ts` — add `tenant_id` column (local dev compatibility)
4. `src/ai/post-generator.ts` — pass `tenantId` when calling storage
5. `src/worker/process-job.ts` — pass `tenant.id` through the pipeline

**Files affected:** 5 files
**Risk:** Existing `voice_posts` rows (Liliana's single-tenant data) need `tenant_id` backfilled.

**Before running, verify:** `SELECT COUNT(*) FROM voice_posts WHERE tenant_id IS NULL` — should match the number of Liliana's existing posts. The second tenant (vialabs-net, installation_id=121912608) has no voice_posts yet, so all NULL rows belong to Liliana.

```sql
UPDATE voice_posts SET tenant_id = (
  SELECT id FROM tenants WHERE github_username = 'lilicurl'
) WHERE tenant_id IS NULL;
```

### BUG 2: `SupabaseStorage` has no tenant scope — CRITICAL

This is the code-layer manifestation of BUG 1. Every storage method needs tenant scoping.

**Approach: tenantId in constructor (not per-method).**

```typescript
// Before (no tenant scope):
const storage = new SupabaseStorage(db);

// After (tenant-scoped instance per job):
const storage = new SupabaseStorage(db, tenant.id);
// All queries automatically filtered by tenant_id
```

This is safer than passing `tenantId` to each method call — impossible to forget the scope. One scoped instance per job in `process-job.ts`.

Methods affected:

| Method | Current behavior | Fix |
|--------|-----------------|-----|
| `saveDraft()` | Inserts without tenant_id | Add `this.tenantId` to INSERT |
| `getVoiceExamples()` | Returns all published posts | `WHERE tenant_id = this.tenantId` |
| `hasDraft()` | Checks all drafts | `WHERE tenant_id = this.tenantId` |
| `getRecentModuleIds()` | Returns all module history | `WHERE tenant_id = this.tenantId` |
| `updateDraftStatus()` | No tenant filter | Add `WHERE tenant_id = this.tenantId` |

`IVoiceStorage` interface adds `readonly tenantId: string` property. `SqliteStorage` follows the same pattern for local dev compatibility.

### BUG 3: `deploy.yml` only deploys webhook, not worker — HIGH

**Problem:** The CI/CD workflow runs `gcloud run services update getdevcast-webhook` but the worker is a Cloud Run **Job** (`devcast-worker`), not a Service. Code changes to `process-job.ts`, `post-generator.ts`, or any worker-used file don't reach the worker until manually redeployed.

**Impact:** After merging the tenant_id fix, the worker keeps running old code without tenant scoping. The bug persists in production even after the PR is merged.

**Fix:** Add worker deployment to `deploy.yml`:
```yaml
- name: Deploy worker job
  run: |
    IMAGE="gcr.io/lilicurl/devcast:${{ github.sha }}"
    gcloud run jobs update devcast-worker \
      --image "$IMAGE" \
      --region us-central1 \
      --project lilicurl
```

**Files affected:** 1 file (`.github/workflows/deploy.yml`)

### BUG 4: `scan-sent-posts.yml` is not multi-tenant — HIGH

**Problem:** The voice training loop depends on the sent-scanner: Buffer publishes a post → scanner detects it → computes edit_ratio → post becomes voice example. But `main-scan.ts` only scans Liliana's Buffer account. New tenants' published posts are never captured.

**Impact:** New users never improve their voice. The voice training loop — the core product differentiator — is broken for all tenants except Liliana.

**What the scanner does:**
```
For each Buffer profile of the tenant:
  → GET /1/profiles/{id}/updates/sent.json (published posts)
  → For each recently published post:
    → Find matching draft in voice_posts by text similarity (>= 0.3 threshold)
    → If match:
      → Store published text
      → Compute edit_ratio(ai_draft, published_text)
      → Mark status = 'published'
      → This post becomes a voice training example
```

**Cost: $0.** Buffer REST API is free. Text similarity is CPU-only. For 100 tenants × 2 profiles = 200 API calls every 2h — well under any rate limit.

**Fix:** Replace `main-scan.ts` (single-tenant) with multi-tenant scanner:
1. Query `SELECT * FROM tenants WHERE buffer_access_token IS NOT NULL AND active = true`
2. For each tenant: create tenant-scoped `SupabaseStorage(db, tenant.id)`
3. Scan their Buffer sent posts using their `buffer_access_token`
4. Match against `voice_posts WHERE tenant_id = tenant.id`
5. Update edit_ratio + published text

**Frequency:** Every 2 hours (same as current single-tenant scanner). The cost is $0 regardless of frequency.

**Runs as:** Cloud Run Job (same as worker) triggered by Cloud Scheduler, or a GitHub Actions CRON. Cloud Run Job is simpler — reuse the same Docker image with a different entry point.

**Replaces:** `scan-sent-posts.yml` is disabled after this (kept as `workflow_dispatch`). The multi-tenant scanner handles Liliana's account too.

**Deployment:** Create a second Cloud Scheduler trigger for the scanner:
```bash
gcloud scheduler jobs create http devcast-scanner-trigger \
  --schedule "0 */2 * * *" \
  --uri "https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/749111652662/jobs/devcast-scanner:run" \
  --http-method POST \
  --oauth-service-account-email 749111652662-compute@developer.gserviceaccount.com \
  --location us-central1 --project lilicurl
```
This requires a new Cloud Run Job `devcast-scanner` using the same Docker image with entry point `src/worker/main-scan-tenants.ts`.

**Files affected:** New file `src/worker/main-scan-tenants.ts` + Dockerfile entry point + Cloud Run Job + Cloud Scheduler.

### BUG 5: Liliana has double-processing — MEDIUM

**Problem:** `poll-and-generate.yml` runs every 4h and processes Liliana's commits via Events API. The webhook also receives her pushes and creates jobs in `job_queue`. The worker processes those jobs. Each commit could generate 2 posts.

`hasDraft(sha, platform)` should prevent duplicates, but without `tenant_id` in the query, the dedup check is unreliable.

**Fix:** Disable `poll-and-generate.yml` — the webhook + worker pipeline fully replaces it. The polling CRON was the pre-Marketplace single-tenant approach. With the GitHub App installed, webhooks are the correct trigger.

Keep `main-poll.ts` in the codebase for local development/testing, but disable the GitHub Actions CRON.

**Files affected:** 1 file (`.github/workflows/poll-and-generate.yml` — change cron to `workflow_dispatch` only)

### BUG 6: LinkedIn direct posts never marked as published — HIGH

**Problem:** When the worker posts directly to LinkedIn via `LinkedInClient.post()`, nothing updates the `voice_posts` row. The draft stays as `status='pending'` forever. The voice training loop never closes for LinkedIn direct posts.

**Flow:**
1. `generatePosts()` → saves draft in `voice_posts` with `status='pending'` ✓
2. `LinkedInClient.post()` → publishes to LinkedIn ✓
3. **Nothing** updates `voice_posts.status` to `'published'` ✗

For Buffer, the sent-scanner handles step 3. For LinkedIn direct, there is no scanner — the post goes out and the system forgets about it.

**Fix:** After successful `LinkedInClient.post()`, update the voice_post immediately in `process-job.ts`:

```typescript
if (tenant.linkedin_access_token && tenant.linkedin_member_id) {
  try {
    const linkedinClient = new LinkedInClient(tenant.linkedin_access_token);
    await linkedinClient.post(tenant.linkedin_member_id, linkedinPost);
    // Mark as published immediately — LinkedIn direct has no editing step
    await storage.updateDraftStatus(draftId, 'published', linkedinPost, 1.0);
    logger.info('worker.commit.linkedin_posted', { sha: commit.sha });
  } catch (err) { ... }
}
```

`edit_ratio = 1.0` because LinkedIn direct posts are published exactly as generated — there's no editing step (unlike Buffer where the user edits before publishing).

**Files affected:** 1 file (`src/worker/process-job.ts`)

---

## Gaps (should fix, not blocking)

### GAP 1: Voice setup wizard missing

**Roadmap says:**
- "Paste a post where you explained something technical"
- "Paste a post where you told a story about your work"
- "Paste a post you liked how it turned out"
- Auto-fetch: GitHub READMEs + PR descriptions → Haiku extracts writing style

**Current state:** The `voice_bootstrap TEXT` column exists in `tenants` but the onboarding form doesn't collect it. First-time users have zero voice examples → Claude generates with base prompt → first edits become first voice training.

**Impact:** Quality of first 3-5 posts is lower than it could be. Not blocking, but affects first impressions.

**Fix:** Add a textarea to the onboarding form: "Paste 2-3 posts you've written before (LinkedIn, blog, anything). This teaches devcast your writing voice."

Store in `tenants.voice_bootstrap`. When the worker processes the first commit for a tenant, if `voice_bootstrap` exists and no `voice_posts` exist yet, run the bootstrap flow (same as `scripts/bootstrap-voice.ts` but triggered automatically).

**Files affected:** 2 files (`onboard.ts` HTML, `process-job.ts` bootstrap check)

### GAP 2: Onboarding doesn't show success state for LinkedIn

After connecting LinkedIn, the user returns to `/onboard` but there's no visual confirmation that LinkedIn was connected (the green "LinkedIn connected" badge requires a page refresh or explicit `linkedin_member_id` check).

**Fix:** After LinkedIn callback, redirect to `/onboard?installation_id=X&linkedin=connected`. Show success badge.

**Files affected:** 1 file (`linkedin-oauth.ts` redirect URL)

### GAP 3: No tenant deactivation flow

If a user uninstalls the GitHub App, the webhook receives an `installation.deleted` event. Currently nothing happens — the tenant stays `active: true` and the worker keeps trying to process jobs that will fail (no installation token).

**Fix:** Handle `installation.deleted` in `installation.ts` → `UPDATE tenants SET active = false WHERE github_installation_id = $1`. The worker already skips inactive tenants (if we add the check).

**Files affected:** 2 files (`installation.ts`, `process-job.ts`)

### GAP 4: Worker doesn't skip inactive tenants

`process-job.ts` queries `tenants` by ID but doesn't check `active = true`. If a tenant uninstalls, jobs keep failing.

**Fix:** Add `AND active = true` to the tenant query in `process-job.ts`.

**Files affected:** 1 file

### GAP 5: No notification for failed jobs

If a job fails (installation token expired, Anthropic API down, Buffer error), it's marked as `status='failed'` in `job_queue`. Nobody is notified. Failed jobs accumulate silently.

**Fix:** At the end of each worker run, log a summary. If `failed_count > 0`, log at error level:
```typescript
logger.error('worker.run.failures', { failed: 3, processed: 12, skipped: 0 });
```
For V2: the cleanup CRON can alert if > N jobs failed in the last week.

**Files affected:** 1 file (`main-worker.ts`)

### GAP 6: Onboarding nav shows text "devcast", not the logo

The favicon image exists at `/favicon.png` but the nav bar uses plain text. Should use the logo image for brand consistency across landing page and app.

**Fix:** In `onboard.ts` HTML, replace `<span class="logo">devcast</span>` with `<img src="/favicon.png" alt="devcast" style="height:24px">`.

**Files affected:** 1 file (`onboard.ts`)

### GAP 7: CLAUDE.md is outdated

The project CLAUDE.md still describes the single-tenant architecture (poll-and-generate cron, Buffer as only review interface). Multi-tenant architecture (webhook + worker + LinkedIn direct + onboarding) is not documented.

**Fix:** Update CLAUDE.md to reflect current architecture after all fixes are implemented.

---

## Implementation Order

| # | Step | Type | Files | Priority | PR |
|---|------|------|-------|----------|----|
| 1 | Schema: add `tenant_id` to `voice_posts` | Migration | database/schema.sql | **P0** | PR A |
| 2 | Backfill existing rows with Liliana's tenant_id | Migration | SQL (manual in Supabase) | **P0** | manual |
| 3 | `IVoiceStorage` — add `tenantId` to constructor | Code | src/voice/storage.ts | **P0** | PR A |
| 4 | `SupabaseStorage` — tenant-scoped via `this.tenantId` | Code | src/voice/supabase-storage.ts | **P0** | PR A |
| 5 | `SqliteStorage` — tenant-scoped via `this.tenantId` | Code | src/voice/sqlite-storage.ts | **P0** | PR A |
| 6 | `post-generator.ts` — receives tenant-scoped storage | Code | src/ai/post-generator.ts | **P0** | PR A |
| 7 | `process-job.ts` — create `SupabaseStorage(db, tenant.id)` | Code | src/worker/process-job.ts | **P0** | PR A |
| 8 | `process-job.ts` — mark LinkedIn posts as published | Code | src/worker/process-job.ts | **P0** | PR A |
| 9 | `main-poll.ts` — create storage with env `TENANT_ID` or query | Code | src/main-poll.ts | **P0** | PR A |
| 10 | `deploy.yml` — add worker job deployment | Code | .github/workflows/deploy.yml | **P0** | PR A |
| 11 | Disable `poll-and-generate.yml` CRON (keep workflow_dispatch) | Code | .github/workflows/poll-and-generate.yml | **P0** | PR B |
| 12 | Disable `scan-sent-posts.yml` CRON (keep workflow_dispatch) | Code | .github/workflows/scan-sent-posts.yml | **P0** | PR B |
| 13 | Multi-tenant sent-scanner (Cloud Run Job, every 2h) | Code | src/worker/main-scan-tenants.ts | **P0** | PR B |
| 14 | Worker observability (log summary per run) | Code | src/worker/main-worker.ts | **P0** | PR A |
| 15 | Handle `installation.deleted` → deactivate tenant | Code | src/webhook/handlers/installation.ts | P1 | PR C |
| 16 | Worker skip inactive tenants (`AND active = true`) | Code | src/worker/process-job.ts | P1 | PR C |
| 17 | Worker log failed job summary | Code | src/worker/main-worker.ts | P1 | PR C |
| 18 | Voice bootstrap textarea in onboarding | Code | src/webhook/handlers/onboard.ts | P2 | PR D |
| 19 | Auto-bootstrap on first commit if voice_bootstrap exists | Code | src/worker/process-job.ts | P2 | PR D |
| 20 | Onboarding nav: logo image instead of text | Code | src/webhook/handlers/onboard.ts | P2 | PR E |
| 21 | LinkedIn connected success badge | Code | src/webhook/handlers/linkedin-oauth.ts | P2 | PR E |
| 22 | Update CLAUDE.md | Docs | CLAUDE.md | P2 | PR F |

### PR strategy

- **PR A** (steps 1-10, 14): Tenant isolation + LinkedIn publish fix + deploy fix + observability. One atomic PR — everything must deploy together.
- **PR B** (steps 11-13): Multi-tenant scanner. Can merge after PR A (needs tenant-scoped storage).
- **PR C** (steps 15-17): Tenant deactivation. Independent, can merge anytime after PR A.
- **PR D** (steps 18-19): Voice bootstrap. Independent.
- **PR E** (step 20): LinkedIn badge. Independent.
- **PR F** (step 21): CLAUDE.md update. After all other PRs.

### Worker observability (step 14)

At the end of each worker run, log a structured summary:

```typescript
logger.info('worker.run.summary', {
  jobs_processed: number,
  jobs_failed: number,
  jobs_skipped: number,
  tenants_served: Set<string>.size,
  posts_generated: number,
  linkedin_posted: number,
  buffer_posted: number,
});
```

---

## Testing Plan

**Test environment:** Both members of vialabs-net org install the GitHub App on their accounts. Two real tenants processing real commits.

| Test | How | Pass criteria |
|------|-----|---------------|
| Independent post generation | Both users push commits | Each gets posts with their OWN voice, not the other's |
| Voice isolation | User A has voice examples, User B doesn't | User B's posts use base prompt, NOT User A's voice |
| LinkedIn direct publish | User with LinkedIn connected pushes | Post appears on LinkedIn AND `voice_posts.status = 'published'` |
| Buffer flow | User with Buffer connected pushes | Post appears as Buffer Idea |
| Sent-scanner multi-tenant | User publishes from Buffer | Scanner detects, computes edit_ratio, marks as published |
| Tenant deactivation | Uninstall app from one account | Tenant marked inactive, jobs stop processing |
| CI/CD deploys both | Push to trunk | Both webhook AND worker get new image |

---

## Definition of Done — Phase 1

```
Phase 1 is complete when:
1. ✅ Two different tenants can install the app and receive posts independently
2. ✅ Voice examples are scoped per tenant (User A never sees User B's voice)
3. ✅ Voice training loop works per tenant (sent-scanner scans each tenant's Buffer)
4. ✅ deploy.yml deploys both webhook AND worker on push to trunk
5. ✅ poll-and-generate.yml disabled (no double-processing)
6. ✅ Tenant deactivation on app uninstall works
7. ✅ Marketplace listing is live (pending GitHub review)
8. ✅ npm run typecheck passes
9. ✅ CLAUDE.md reflects current architecture
```

---

## Integration Checklist with Phase 2

Phase 2 depends on these Phase 1 contracts:

| Phase 2 needs | Phase 1 provides | Status |
|---------------|-----------------|--------|
| `tenant_id` in `voice_posts` for per-tenant edit_ratio analysis | BUG 1 fix (PR #67) | ✓ Done |
| `IVoiceStorage` with tenant scope for voice examples | BUG 2 fix (PR #67) | ✓ Done |
| LinkedIn posts marked as published (edit_ratio=1.0) | BUG 6 fix (PR #67) | ✓ Done |
| `deploy.yml` deploys webhook + worker | BUG 3 fix (PR #67) | ✓ Done |
| `tenants.config` JSONB for per-tenant config | Already exists | ✓ |
| `process-job.ts` as integration point for matching | Already exists | ✓ |
| `generatePosts()` accepts optional `industryContext` param | **New** — Phase 2 Step 13 | planned |
| AI agnosticism (`IAIClient` + `IEmbedder` + factory) | **New** — Phase 2 Step 0 | planned |
| Content schema (4 new tables, global, no tenant_id) | **New** — Phase 2 Step 1 | planned |
| pgvector extension enabled in Supabase | **New** — Phase 2 Step 1 | planned |
| `OPENAI_API_KEY` in secrets (GitHub Actions + Cloud Run) | **New** — Phase 2 Step 0 | planned |

---

## Known Tradeoffs (Phase 1)

1. **Buffer paste key, not OAuth**: Buffer doesn't support third-party OAuth. Users paste their API key. Acceptable — key is stored in DB, masked on display.
2. **LinkedIn token expires in ~2 months**: No auto-refresh. User must reconnect manually when expired. Worker logs `linkedin_expired` and continues without crash.
3. **No voice setup wizard yet**: First posts generated with base prompt. Quality improves as user edits and publishes. Acceptable for V1 — wizard is a P2 enhancement.
4. **Worker runs every 15 minutes**: Posts appear ~15 min after push. Acceptable for social media posting.
5. **Single Cloud Run image for webhook + worker**: Both services use the same Docker image with different entry points. Simpler CI/CD, no code duplication.
6. **GitHub App owned by org, not personal account**: Required for Marketplace listing. Transfer completed.
7. **Tokens stored in plaintext**: `buffer_access_token` and `linkedin_access_token` are not encrypted in Supabase. RLS + service role key provide access control. If Supabase is compromised, tokens are exposed. Acceptable for V1 — encryption at rest is a V2 security hardening task.
8. **`poll-and-generate.yml` disabled**: Single-tenant polling CRON replaced by multi-tenant webhook + worker. Kept as `workflow_dispatch` only for local testing.
