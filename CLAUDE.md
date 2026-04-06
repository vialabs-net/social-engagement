# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What This Project Does

**devcast** is a GitHub Marketplace App that monitors all repositories for new commits,
runs the code through 24 specialized analysis modules, translates findings into social media
posts using Claude AI, and publishes them to LinkedIn (direct) and Buffer (Ideas for Instagram).

**Owner**: Vialabs Spa (vialabs-net) | **Site**: https://devcast.lilicurl.com
**App URL**: https://app.devcast.lilicurl.com
**Platforms**: LinkedIn (direct posting via OAuth) + Buffer (Ideas inbox for Instagram)

---

## Development Commands

```bash
npm install                          # install dependencies
npm run typecheck                    # tsc --noEmit (strict mode, no any)
npm test                             # vitest run (no test files yet)
npm run poll                         # run poll-and-generate pipeline locally (needs TENANT_ID)
npm run scan                         # run sent-post scanner locally (needs TENANT_ID)
npm run setup-buffer                 # verify Buffer token + print org/profile ID instructions
npm run bootstrap                    # seed voice history from voice-bootstrap.md (needs TENANT_ID)
npm run test-analyze                 # run analysis pipeline on a commit SHA (no publish)
```

All scripts use `tsx --env-file=.env.local` — local env vars live in `.env.local`.
This is an ESM project (`"type": "module"` in package.json). All internal imports use `.js` extensions per NodeNext resolution.

**TENANT_ID**: Required for all storage operations. For local dev with SQLite, defaults to `'local'`. For Supabase, must be a real tenant UUID from the `tenants` table.

---

## Architecture: Multi-Tenant GitHub App

devcast is a GitHub App installed per user/org. Each installation creates a tenant.

### Three Cloud Run services (same Docker image, different entry points)

```
getdevcast-webhook (Service — always on, scales to zero)
  → Receives GitHub webhooks (push, installation events)
  → Serves onboarding UI at /onboard
  → Handles OAuth callbacks (GitHub, LinkedIn)
  → Enqueues jobs in job_queue table

devcast-worker (Job — every 15 min via Cloud Scheduler)
  → Claims pending jobs from job_queue
  → Per job: fetch tenant → get installation token → process commits
  → Pipeline: enrich → filter → analyze → generate → post to LinkedIn/Buffer

devcast-scanner (Job — every 2h via Cloud Scheduler)
  → Iterates all active tenants with Buffer tokens
  → Scans each tenant's published Buffer posts
  → Computes edit_ratio → updates voice training loop
```

### CI/CD

Push to `trunk` → GitHub Actions → Docker build → deploys all three (webhook + worker + scanner).
Uses Workload Identity Federation (no long-lived GCP keys in GitHub).

### Onboarding flow

```
User installs GitHub App on GitHub
  → GitHub OAuth callback → /auth/github/callback → redirect to /onboard
  → Form: name, website, voice bootstrap, Buffer API key, LinkedIn connect
  → Save → tenant configured
  → Pushes trigger webhook → worker processes → posts appear
```

---

## Full Pipeline Flow (per commit)

```
GitHub push webhook → job_queue(tenant_id, repo, before_sha, after_sha)
  → devcast-worker claims job
  → fetch tenant from DB (credentials, config)
  → get GitHub App installation token (JWT → POST /app/installations/{id}/access_tokens)
  → compareCommits(before...after) → list of commits

Per commit:
  → hasDraft(sha, tenant_id)? → skip if duplicate
  → enrichCommit(sha) → FileDiff[], stats, languages
  → isInteresting()? → skip if trivial (< 10 lines, merge, bot, wip)
  → runPipeline(24 modules, parallel via Promise.allSettled)
    → freshness multiplier: adjustedScore = interestScore / (fires_in_30d + 1)
    → top 3 findings by adjustedScore
    → 0 findings → skip (no Claude call)
  → generatePosts(Sonnet, max_tokens=1600, ONE call per commit)
    → voice examples from tenant's own published posts (tenant-scoped)
    → module variety hint injected before task
    → parse XML tags: <post_draft> + <short_draft>
    → save draft to voice_posts with tenant_id
  → LinkedIn: post directly if tenant has linkedin_access_token
    → mark voice_post as published (edit_ratio=1.0, immediate)
  → Buffer: create Idea if tenant has buffer_access_token
  → GitHub Issue: notification with links to draft and commit
```

---

## Multi-Tenant Data Isolation

All voice data is scoped per tenant via `tenant_id` in `voice_posts`.

```typescript
// Storage is tenant-scoped via constructor
const storage = new SupabaseStorage(url, key, tenant.id);
// All queries automatically filter by tenant_id
```

- Voice examples: only from the tenant's own published posts
- Duplicate detection: scoped per tenant (two tenants can process same SHA)
- Module freshness: per-tenant history
- Voice training loop: per-tenant Buffer scanning

---

## THE MODULE SYSTEM — The Architectural Core

**The key principle**: Modules detect what is interesting. Claude writes about it.
Claude never analyzes code directly.

**Module interface** (`src/analysis/types.ts`):
```typescript
interface CodeAnalyzer {
  readonly id: string;
  readonly name: string;
  readonly category: AnalysisCategory;
  readonly applicableLanguages?: string[];  // undefined = all languages
  analyze(ctx: AnalysisContext): Promise<Finding | null>;
}
```

**MODULE_REGISTRY** (`src/analysis/modules/index.ts`):
- This is the ONLY file that changes when adding a new module
- Import the module class + add one line to the array

**24 modules**: complexity, design_patterns, clean_code, type_system, integration, testing,
ai_assisted, performance, security, api_design, error_resilience, observability, concurrency,
dx, dependency_health, evolutionary, js_advanced, react_patterns, devops, python, go,
java_quarkus, elixir, architecture_patterns

**Pipeline behavior**:
- All modules run in `Promise.allSettled` (parallel, failure-isolated)
- Freshness multiplier reduces repeated modules: `adjustedScore = interestScore / (fires_in_30d + 1)`
- Returns `Finding[]` sorted by adjustedScore DESC, sliced to top 3
- Returns empty array if nothing found → caller skips Claude call entirely

---

## Claude API — Cost Minimization (Critical)

**Model**: `claude-sonnet-4-6` ONLY for post generation. Never Opus.
**max_tokens**: 1600 (hardcoded in `src/ai/client.ts`, never increase)

**Cost controls:**
- `isInteresting()` runs BEFORE any API call — zero API cost on trivial commits
- Modules run BEFORE Claude — if 0 findings, Claude is never called
- ONE Claude call per commit — never one per module
- All drafts cached in DB — rejection is free (no re-generation)
- Duplicate SHA detection per tenant — processed commits never re-processed

---

## Database Schema (Multi-Tenant)

```sql
-- Core tables
voice_posts     — drafts, published text, edit_ratio, status, tenant_id
tenants         — one row per GitHub App installation
job_queue       — async job queue (webhook enqueues, worker picks up)

-- Supporting tables
pending_batch   — non-interesting commits for future weekly roundup (unused)
events_state    — ETag + last_event_id per username (local dev only)
scheduled_slots — atomic slot claiming with UNIQUE constraint

-- Indexes
idx_voice_posts_tenant          — fast tenant-scoped queries
idx_voice_posts_sha_platform    — duplicate detection
idx_voice_retrieval             — voice example retrieval (engagement_score, edit_ratio)
idx_job_queue_pending           — fast job claiming
```

---

## External Services

### GitHub API
**Auth**: GitHub App installation tokens (JWT → exchange for short-lived token per tenant)
**Key endpoints**:
- `POST /app/installations/{id}/access_tokens` — installation token
- `GET /repos/{o}/{r}/compare/{base}...{head}` — commits in push range
- `GET /repos/{o}/{r}/commits/{sha}` — commit enrichment
- `POST /repos/{o}/{r}/issues` — notification issue

### LinkedIn API
**Auth**: OAuth 2.0 per tenant (`w_member_social` scope, 2-month token TTL)
**Endpoint**: `POST https://api.linkedin.com/rest/posts` (LinkedIn-Version: 202501)
**Posts marked published immediately** (edit_ratio=1.0, no editing step)

### Buffer API
**Auth**: Per-tenant API key (pasted in onboarding, not OAuth)
**Endpoints**:
- GraphQL (`https://graph.buffer.com/`) — `createIdea` mutation
- `GET /1/profiles/{id}/updates/sent.json` — scan for published posts (voice loop)

### Anthropic Claude API
**Auth**: `ANTHROPIC_API_KEY`
**Model**: `claude-sonnet-4-6`, max_tokens=1600

---

## Directory Structure

```
devcast/
├── .github/workflows/
│   ├── deploy.yml                  # CI/CD: push to trunk → deploy webhook + worker + scanner
│   ├── poll-and-generate.yml       # DISABLED — replaced by webhook + worker
│   ├── scan-sent-posts.yml         # DISABLED — replaced by multi-tenant scanner
│   ├── bootstrap-voice.yml         # manual: seed voice history
│   └── voice-report.yml            # weekly voice training report
├── src/
│   ├── analysis/                   # 24 analysis modules
│   │   ├── types.ts                # CodeAnalyzer, Finding, AnalysisContext
│   │   ├── pipeline.ts             # parallel execution, freshness multiplier, top-N
│   │   ├── diff-parser.ts          # raw Git patch → FileDiff[]
│   │   └── modules/
│   │       └── index.ts            # MODULE_REGISTRY ← only file to edit
│   ├── ai/
│   │   ├── client.ts               # Anthropic SDK (sonnet, max_tokens=1600)
│   │   ├── prompt-builder.ts       # voice top + commit + findings + module_variety_hint + task bottom
│   │   └── post-generator.ts       # ONE call/commit, parse XML, save draft with tenant_id
│   ├── buffer/
│   │   ├── client.ts               # Buffer GraphQL + REST wrapper
│   │   ├── publisher.ts            # createIdea GraphQL mutation
│   │   └── sent-scanner.ts         # poll sent posts → voice training loop
│   ├── linkedin/
│   │   └── client.ts               # LinkedIn Posts API + OAuth token exchange
│   ├── webhook/
│   │   ├── server.ts               # HTTP server: health, onboard, auth, webhooks
│   │   ├── github-handler.ts       # Signature validation + event routing
│   │   └── handlers/
│   │       ├── push.ts             # Enqueue job in job_queue
│   │       ├── installation.ts     # Create/deactivate tenant on install/uninstall
│   │       ├── onboard.ts          # Onboarding UI (dark theme, voice bootstrap)
│   │       ├── github-oauth.ts     # GitHub App OAuth callback
│   │       └── linkedin-oauth.ts   # LinkedIn OAuth flow with HMAC-signed state
│   ├── worker/
│   │   ├── main-worker.ts          # Cloud Run Job entry: claim + process pending jobs
│   │   ├── process-job.ts          # Per-job pipeline: tenant → commits → posts
│   │   ├── main-scan-tenants.ts    # Multi-tenant sent-post scanner
│   │   └── github-app-auth.ts      # JWT → installation token exchange
│   ├── voice/
│   │   ├── storage.ts              # IVoiceStorage interface (tenantId in constructor)
│   │   ├── supabase-storage.ts     # Production (tenant-scoped queries)
│   │   ├── sqlite-storage.ts       # Local dev (tenant-scoped)
│   │   └── similarity.ts           # computeEditRatio(draft, published)
│   ├── config/
│   │   ├── loader.ts
│   │   └── schema.ts              # Zod schemas
│   └── utils/
│       ├── logger.ts               # structured JSON to stdout
│       ├── retry.ts                # withRetry() per-service policies
│       └── commit-filter.ts        # isInteresting() — rule-based, zero API cost
├── scripts/
│   ├── setup-buffer.ts
│   ├── bootstrap-voice.ts
│   └── test-analyze.ts
├── public/
│   └── favicon.png                 # devcast logo
├── database/
│   └── schema.sql
├── phase1-spec.md                  # Phase 1 spec (GitHub Marketplace)
├── content-intelligence-spec.md    # Phase 2 spec (Content Intelligence Agent)
└── CLAUDE.md
```

---

## Error Handling Per Service

```
GitHub:     404 → RepoNotFoundError (no retry); 429 → withRetry()
Anthropic:  529 → withRetry(); 400/403/404/422 → throw (no retry); 401 → throw
Buffer:     5xx → withRetry(); 401 → BufferTokenExpiredError; 429 → store 'queued'
LinkedIn:   401 → LinkedInAuthExpiredError (log, skip, no crash); 5xx → withRetry()
```

---

## Infrastructure (GCP)

| Component | Type | Trigger |
|-----------|------|---------|
| `getdevcast-webhook` | Cloud Run Service | HTTP (always on, scales to zero) |
| `devcast-worker` | Cloud Run Job | Cloud Scheduler every 15 min |
| `devcast-scanner` | Cloud Run Job | Cloud Scheduler every 2h |
| `app.devcast.lilicurl.com` | Custom domain → Cloud Run | DNS CNAME |
| CI/CD | GitHub Actions + WIF | Push to trunk |

---

## How to Start a New Session

1. Read this file fully
2. Check `phase1-spec.md` and `content-intelligence-spec.md` for current roadmap
3. Run `ls src/` to see what exists before modifying anything
4. Run `npm run typecheck` to verify the build is clean
5. When implementing a new module, test it standalone via `npm run test-analyze`
6. No test suite exists yet — vitest is configured but no `.test.ts` files

---

*Phase 1 (GitHub Marketplace) complete. Phase 2 (Content Intelligence Agent) in design.*
