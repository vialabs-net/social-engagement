# devcast — Master Spec

| Field | Value |
|-------|-------|
| Version | 1.5.17 |
| Status | Phase 1: complete · Phase 2: implemented on feat/content-intelligence, pending merge + SQL migration · Phase 3: design only |
| Last updated | 2026-04-08 |
| Owner | Liliana Castellanos / Vialabs Spa |
| App URL | https://app.devcast.lilicurl.com |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.5.17 | 2026-04-08 | `hashtags_kept_ratio` now documents its hashtag extraction regex, curated seed corpus module coverage is now persisted in `content_items.seed_modules`, and the `avoid` rebound rule includes an explicit alpha-calibration note. |
| 1.5.16 | 2026-04-08 | `top_module_id` is now defined explicitly: it is taken from the first finding in the final pipeline ordering (`adjustedScore DESC`, then `interestScore DESC`, then `moduleId ASC` as deterministic tie-breakers), so prompt diversification no longer depends on incidental array order. |
| 1.5.15 | 2026-04-08 | The scanner now defines how it enumerates authors per tenant: recent `voice_posts` activity plus explicit per-author `voice_profiles` rows, excluding historical ghost authors and the tenant-default null profile row. |
| 1.5.14 | 2026-04-08 | `filterByContentStrategy()` now documents the minimal `EnrichedCommit` shape it consumes, so `matchesSkipPattern()` no longer relies on an implied commit schema from `commit-enricher.ts`. |
| 1.5.13 | 2026-04-08 | `getVoiceProfile()` now has an explicit `IVoiceStorage` contract: it performs only the DB lookup chain (author-specific, then tenant default), returns `{ voice, version } | null`, lives in `src/voice/storage.ts`, and leaves `DEFAULT_VOICE_PROFILE` fallback to the caller. |
| 1.5.12 | 2026-04-08 | `expired` verification is now explicitly batched by Buffer profile: `sent-scanner.ts` reuses the profile sent-feed sync for both published matching and stale-draft checks, paginates by profile when needed, and never performs one Buffer request per stale draft. |
| 1.5.11 | 2026-04-08 | `industry_context_removed` now has a short-anchor guardrail: if normalized `match_connection` has fewer than 6 tokens, the scanner sets it to `false` and logs `voice.edit_analysis.context_anchor_too_short` instead of treating a tiny overlap as a context deletion. |
| 1.5.10 | 2026-04-08 | The weekly content pipeline now defines `top 3/source` unambiguously: `source` means `content_sources.id`, and the cap is applied after structural scoring but before classifier batch assembly with explicit pseudocode. |
| 1.5.9 | 2026-04-08 | Phase 2 corpus math is now explicit: the Article Funnel is documented as weekly throughput, while the Cold Start timeline separately models protected seed chunks plus 45-day cleanup, fixing the old Week 4 / Month 3 inconsistency. |
| 1.5.8 | 2026-04-08 | `industry_context_preference='avoid'` no longer traps the system: `voice_posts.context_status` now distinguishes `skipped` vs `no_match` vs `matched`, Loop 4 excludes skipped rows from preference learning, and `process-job.ts` forces a periodic probe attempt so `avoid` can rebound to `neutral`. |
| 1.5.7 | 2026-04-08 | Phase 2 now explicitly states that `matchFindingsToArticles()` returns structured `IndustryMatch` metadata, while `process-job.ts` persists `has_industry_context`, `matched_article_id`, `matched_source_id`, `match_strength`, and `match_connection` on the draft row at generation time. |
| 1.5.6 | 2026-04-08 | `matchFindingsToArticles()` now defines its optional `MatcherOptions` contract in Phase 2 with `stage1Threshold` defaulting to `0.75`; Phase 3 only consumes that existing contract instead of introducing a new signature. |
| 1.5.5 | 2026-04-08 | Loop 1 extractor refresh now uses the same quality gates as `voice_history`: `getRecentPublished()` excludes rewrites and low-edit-ratio posts, refresh skips when fewer than 5 strong samples remain, and the old "weak examples for extractor refresh" wording was removed. |
| 1.5.4 | 2026-04-08 | Final consistency fixes: behavioral `<preferences>` now override conflicting extracted hook devices, `TenantConfig` keys are documented, `edit_analysis` added to Phase 3 prerequisites, short hooks/closings skip overlap-based change analysis, and source reactivation ownership is assigned to `discover-sources.yml`. |
| 1.5.3 | 2026-04-08 | Cross-phase inconsistency fixes: `author_login` is now marked required for Phase 3, `last_reactions_fetch_at` added to schema/migrations, freshness multiplier storage/caching defined, `expired` requires a Buffer verification step before marking false negatives, `industry_context_preference` thresholds specified, prompt-builder replacement called out explicitly, and impossible source reactivation / CLT-only daily cap rules corrected. |
| 1.5.2 | 2026-04-08 | Voice extractor split into `style_patterns` + `voice_devices` instead of a single `extracted_patterns` field. `discouraged_hook_styles` now uses a defined enum, scanner loop order is specified end-to-end, and V1 explicitly excludes per-post confidence scoring and selection explainability UI. |
| 1.5.1 | 2026-04-08 | Phase 3 ambiguity fixes after v1.5.0 review: `skip_patterns` scope defined, `computeEditRatio()` contract documented, `edit_analysis` algorithms specified, `industry_context_removed` made detectable via stored `match_connection`, `content_preferences` now has explicit consumers, and audience is documented as manual-only. |
| 1.5.0 | 2026-04-08 | Phase 3 rewritten into one canonical section. Voice system now specifies `voice_history` selection, `ContentStrategy`, `edit_analysis`, negative feedback via `expired`, structured extractor input, corrected hashtag `always` wording, and proper optimistic locking with top-level `version`. Onboarding now captures both voice and content strategy. |
| 1.4.0 | 2026-04-08 | Buffer-only publishing (LinkedIn direct removed from current phase scope). Status convention legend added. voice_posts table reorganized by concern, engagement_score formula fixed, state machine completed. Tenants table: linkedin_access_token removed, envelope encryption frozen as token storage strategy. content_sources: is_protected column added. Seed corpus: recency vs 45-day expiry interaction documented. Voice extractor: extracted_at no longer described as optimistic lock. Editing artifacts fixed throughout. |
| 1.3.0 | 2026-04-08 | Implementation Status section: verified deployed vs branch vs gaps vs not started. Schema gaps migration script. `top_module_id` gap identified (written by code, missing from schema.sql). `has_industry_context` gap (logged but never persisted). Analytics columns not written anywhere. slot-manager confirmed not wired. |
| 1.2.0 | 2026-04-08 | Daily cap scoped per (tenant_id, authorLogin). Migration plan with pre-flight checks + rollback. Batch API `batch_id` persistence in `content_pipeline_runs`. HNSW parameters justified with scaling path. Source reactivation requires quality gate. Jaccard dedup limitation documented. IAIClient section right-sized. `/settings/voice` UI spec for org installs. Open Questions section (OQ-1 through OQ-7). Cold start corpus (200 pre-curated articles) as launch prerequisite. |
| 1.1.0 | 2026-04-07 | Full DB schema contract. Security risk section (token encryption). Worker semantics (lease, poison jobs, idempotency). Analytics flags (has_industry_context). Voice rule layers separated. Costs complete (infra + AI). Hashtag contradiction fixed. AI agnosticism exception documented. Optimistic lock fixed (version field). Tenant health status section. |
| 1.0.0 | 2026-04-07 | Unified spec: Phase 1 + Phase 2 + Phase 3 (Voice Profile). Consolidated from phase1-spec.md, content-intelligence-spec.md, voice-profile-spec.md |

---

## Status Conventions

Every section, column, and feature in this document uses one of four labels:

| Label | Meaning |
|-------|---------|
| **[CURRENT STATE]** | Deployed on `trunk` and running in production. |
| **[REQUIRED BEFORE LAUNCH]** | Must be done before accepting paying users. Not yet implemented. |
| **[SPECIFIED BUT NOT IMPLEMENTED]** | Designed here, but no code or schema column exists yet. |
| **[OPEN DECISION]** | Requires a product or architectural decision before implementation can start. |

---

## Mission

Most developers build things the world never sees.
Not because the work isn't worth seeing — but because explaining it takes time and energy
that most developers don't have after shipping. devcast fixes that.

Every time a developer pushes code, devcast reads the commit, understands what's
interesting about it, and writes a social media post in that developer's own voice.
No templates. No generic summaries. Real posts, in real voices, about real engineering work.

**The work deserves to be seen. devcast makes that happen automatically.**

---

## Who is this for

Three profiles, all valid:

**1. The solo developer or startup engineer**
Commits frequently. Has things worth saying. Has zero time to say them. Wants
LinkedIn/social presence without the overhead of writing posts. devcast runs silently
in the background and surfaces their best work.

**2. The company with a dev team on GitHub**
Marketing wants developer content. Developers don't want to write it. devcast gives
each developer their own voice (not a corporate template) while the company pays for it —
because their engineering blog is now automatic, per-developer, and authentic.

**3. The non-developer who came back to programming via AI**
Vibe coders, PMs who now ship, designers who learned to code. They're building real things
but don't have the vocabulary to explain it. devcast does the translation for them.

---

## What devcast does

devcast is a GitHub Marketplace App that monitors repositories for new commits, runs the
code through 24 specialized analysis modules, translates findings into social media posts
using Claude AI, and sends them to Buffer as Ideas for review and publishing.

Each developer gets posts in their own voice. Industry context from curated engineering
blogs is injected when relevant. The system improves automatically as the developer
publishes and edits posts.

**Publishing:** Buffer is the publishing layer — it supports LinkedIn, Instagram, Twitter/X,
Facebook, Mastodon, and more. devcast sends Ideas (drafts) to Buffer; the developer reviews
and publishes from Buffer's native UI. This gives the developer full control and access to
all social networks without devcast needing to integrate each one.

> **This phase is Buffer-only.** LinkedIn direct posting (`src/linkedin/client.ts`) exists
> in the codebase but is out of scope for the current launch. All publishing flows through Buffer.

**Source control:** GitHub today. Bitbucket, GitLab, and others in a future phase.

**Model:** `claude-sonnet-4-6` for post generation. `claude-haiku-4-5` for classify/cross-encode/voice-extract.

---

## Architecture Overview

### Three Cloud Run services (same Docker image, different entry points)

```
getdevcast-webhook  (Cloud Run Service — always on, scales to zero)
  → GitHub webhooks (push, installation events)
  → Onboarding UI at /onboard
  → OAuth callbacks (GitHub)
  → Enqueues jobs in job_queue table

devcast-worker  (Cloud Run Job — every 15 min via Cloud Scheduler)
  → Claims pending jobs from job_queue
  → Per job: fetch tenant → installation token → process commits
  → Pipeline: enrich → filter → analyze → match → generate → post

devcast-scanner  (Cloud Run Job — every 2h via Cloud Scheduler)
  → Iterates all active tenants with Buffer tokens
  → Scans published Buffer posts → edit_ratio → voice training loop
  → [Phase 3] Refreshes voice profiles per author after 5 new published posts
```

### CI/CD

Push to `trunk` → GitHub Actions → Docker build → deploys all three services.
Workload Identity Federation (no long-lived GCP keys in GitHub).

---

## Commit Pipeline (per push)

```
GitHub push webhook
  → job_queue(tenant_id, repo, before_sha, after_sha)
  → devcast-worker claims job
  → compareCommits(before...after)

Per commit:
  → hasDraft(sha, tenant_id)?           → skip if duplicate
  → enrichCommit(sha)                   → FileDiff[], stats, languages
  → isInteresting()?                    → skip if trivial (< 10 lines, merge, bot, wip)
  → runPipeline(24 modules, parallel)
      → freshness multiplier: adjustedScore = interestScore / (fires_in_30d + 1)
      → top 3 findings by adjustedScore
      → 0 findings → skip (no Claude call)
  → [Phase 3] storage.getVoiceProfile(tenantId, commit.authorLogin)   ← lookup per developer
  → [Phase 3] filterByContentStrategy(findings, voiceProfile.content_strategy)
      → if 0 findings remain or a skip pattern matches → skip (no Claude call)
  → [Phase 3] apply content_preferences
      → if `industry_context_preference='avoid'` → skip article matching for most drafts, but force a periodic probe attempt
      → if `industry_context_preference='prefer'` → lower Stage 1 threshold to 0.72
  → [Phase 2] matchFindingsToArticles(filteredFindings, embedder, aiClient, db) → `IndustryMatch?`
      → `process-job.ts` persists context metadata on the draft row at generation time (`context_status`, match ids, connection when present)
  → generatePosts(filteredFindings, voiceProfile, industryContext?)    ← all three feeds in
      → parse <post_draft> + <short_draft>
      → save draft to voice_posts with tenant_id
  → Buffer: create Idea if tenant has buffer_access_token
  → GitHub Issue: notification with links
```

`fires_in_30d` is not a stored column. It is computed once per tenant per worker run with:

```sql
SELECT top_module_id, COUNT(*) AS fires_in_30d
FROM voice_posts
WHERE tenant_id = $1
  AND top_module_id IS NOT NULL
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY top_module_id;
```

The worker caches this map in memory for the duration of the run and increments it as new drafts are saved. This avoids 24 SQL queries per commit in the hot path. Phase 3 therefore depends on `top_module_id` being present in `voice_posts` before freshness-based diversification can work correctly.

---

## Voice Training Loop

```
devcast-scanner (every 2h):
  → for each active tenant with buffer_access_token:
      → GET /1/profiles/{id}/updates/sent.json once per Buffer profile
      → build in-memory indexes by normalized text + `buffer_post_id`
      → match by text similarity against voice_posts WHERE tenant_id = ?
      → if match: compute edit_ratio(ai_draft, published_text)
                  → compute edit_analysis JSON
                  → status = 'published'
                  → this post becomes eligible for voice_history if it passes quality gates
      → for stale scheduled posts older than 7 days:
          → resolve each stale `buffer_post_id` against the same profile-level sent-feed snapshot
          → if unresolved, paginate more sent-feed pages for that profile (shared budget), not one request per draft
          → only then mark as expired
  → [Phase 3] per author: if new_published >= 5 since last extraction
      → re-run voice extractor against up to 15 recent high-signal published posts (`edit_ratio >= 0.70`, `edit_type != 'rewrite'`, ordered by `published_at DESC`)
      → if fewer than 5 posts remain after filtering: skip refresh and log `voice.extractor.insufficient_signal`
      → update voice_profiles.voice (style_patterns + voice_devices + voice_summary)
  → [Phase 3] per author: every 10 outcomes (published + expired)
      → refresh content_preferences from publication / expiration patterns
```

---

## Analytics CRON — Platform Reactions **[SPECIFIED BUT NOT IMPLEMENTED]**

**Blocked on:** LinkedIn app approval (requires `r_organization_social` or `w_member_social` scope + LinkedIn review).

**Purpose:** After a Buffer Idea is published by the user, link the Buffer post to the actual platform post and periodically fetch reactions to compute `engagement_score`.

**Flow:**

```
devcast-scanner (every 2h — already running):
  → scans Buffer sent feed (existing behavior)
  → for each matched voice_post WHERE linkedin_urn IS NULL:
      → extract platform post URL from Buffer sent feed response
         (Buffer sent post includes `service_update_id` per channel)
      → if LinkedIn channel: store as linkedin_urn in voice_posts

devcast-analytics (new Cloud Run Job — every 24h, once per post, up to 7 days after publish):
  → SELECT id, linkedin_urn FROM voice_posts
      WHERE linkedin_urn IS NOT NULL
        AND published_at > NOW() - INTERVAL '7 days'
        AND (last_reactions_fetch_at IS NULL
             OR last_reactions_fetch_at < NOW() - INTERVAL '24 hours')
  → for each: GET https://api.linkedin.com/rest/socialActions/{urn}/likes
  → update reactions_count, recompute engagement_score, set last_reactions_fetch_at = NOW()
```

**New columns required on `voice_posts`:**
- `last_reactions_fetch_at TIMESTAMPTZ` — cursor for the analytics CRON
- (above columns are in addition to `linkedin_urn` and `reactions_count` already listed)

**Why 7 days:** LinkedIn engagement is concentrated in the first 24–72h after posting. Fetching beyond 7 days has diminishing return and consumes API quota.

**Why daily cadence:** LinkedIn socialActions API has rate limits. One call per post per day is safe at alpha scale.

---

---

# Phase 1 — GitHub Marketplace

**Status:** Almost Complete (deployed to production)

---

## Multi-Tenant Architecture

One GitHub App installation = one tenant (`tenants` table row). Each tenant has their own:
- GitHub installation token (per-job, short-lived)
- Buffer API key (pasted in onboarding)
- Voice data (`voice_posts` scoped by `tenant_id`)

### Onboarding flow

```
User installs GitHub App on GitHub
  → GitHub OAuth callback → /auth/github/callback → redirect to /onboard
  → Form: name, website, voice bootstrap, Buffer API key
  → Save → tenant configured
  → Pushes trigger webhook → worker processes → posts appear
```

### Storage tenant scoping

`SupabaseStorage(db, tenant.id)` — tenant ID in constructor, all queries auto-filtered.
`SqliteStorage` follows same pattern for local dev (`TENANT_ID` env var or `'local'` default).

---

## Database Schema — Full Contract

This section documents all tables as deployed. Authoritative source is `database/schema.sql`.

---

### `voice_posts` — Owner: Phase 1

Central table. One row per generated draft per commit per platform.

> This table mixes five concerns intentionally: draft identity, publication state, Buffer
> integration, voice training signal, and Phase 2 analytics. Columns are grouped below by
> concern to make each contract explicit.

**— Identity (set at generation, never change) — [CURRENT STATE]**

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | TEXT | NOT NULL | `gen_random_uuid()::text` | PK |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | |
| `commit_sha` | TEXT | NOT NULL | — | |
| `repo` | TEXT | NOT NULL | — | `'owner/repo'` |
| `platform` | TEXT | NOT NULL | — | enum: `'linkedin'` \| `'instagram'` |
| `tenant_id` | UUID | NULL | — | FK `tenants(id)`. null = pre-marketplace legacy rows |
| `top_finding` | TEXT | NULL | — | headline/text of the first finding in the final ordered findings array used for generation |
| `top_module_id` | TEXT | NULL | — | **[REQUIRED BEFORE LAUNCH]** `findings[0].moduleId` after the final pipeline ordering. Required for `voice_history` diversification and content preference analytics. |
| `findings_count` | INTEGER | NOT NULL | `0` | |
| `author_login` | TEXT | NULL | — | **[REQUIRED BEFORE LAUNCH]** commit.authorLogin. Required for per-author daily cap, per-author `voice_history`, scanner author loops, and published-post extractor refresh. Phase 3 cannot work correctly without it. |

**— Draft & voice training signal — [CURRENT STATE]**

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `ai_draft` | TEXT | NOT NULL | — | stored immediately on generation |
| `published` | TEXT | NULL | — | final text as published by user (set by scanner) |
| `edit_ratio` | REAL | NULL | — | `1.0`=unchanged · `0.0`=rewritten · null until published |
| `edit_analysis` | JSONB | NULL | — | **[SPECIFIED BUT NOT IMPLEMENTED]** structural edit summary computed by scanner: hook/closing changes, length delta, hashtag retention, industry-context removal, `edit_type`. |
| `published_at` | TIMESTAMPTZ | NULL | — | null until published |

**— Publication state — [CURRENT STATE]**

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `status` | TEXT | NOT NULL | `'pending'` | enum below |
| `publish_source` | TEXT | NULL | — | **[SPECIFIED BUT NOT IMPLEMENTED]** `'buffer'`. null = not yet published. Required for voice loop exclusion logic (OQ-6). |

**— Buffer integration — [CURRENT STATE]**

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `buffer_post_id` | TEXT | NULL | — | Buffer Idea ID, set when Buffer accepts the draft |
| `scheduled_at` | TIMESTAMPTZ | NULL | — | UTC time Buffer schedules publication |

**— Phase 2 analytics — [SPECIFIED BUT NOT IMPLEMENTED]** (gaps: columns not yet added, see migration script)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `context_status` | TEXT | NULL | — | **[SPECIFIED BUT NOT IMPLEMENTED]** enum-like: `'skipped'` \| `'no_match'` \| `'matched'`. `NULL` = historical row or matcher error before result. Distinguishes "not attempted" from "attempted, no strong match". |
| `has_industry_context` | BOOLEAN | NOT NULL | `FALSE` | Set when `matchFindingsToArticles()` returns a strong match |
| `matched_article_id` | UUID | NULL | — | FK `content_items(id)` |
| `matched_source_id` | UUID | NULL | — | FK `content_sources(id)` |
| `match_strength` | REAL | NULL | — | cosine similarity 0.0–1.0 of winning match |
| `match_connection` | TEXT | NULL | — | **[SPECIFIED BUT NOT IMPLEMENTED]** one-sentence connection returned by the cross-encoder for a strong match. Required for `industry_context_removed` analysis and debugging false-positive matches. |
| `linkedin_urn` | TEXT | NULL | — | **[SPECIFIED BUT NOT IMPLEMENTED]** LinkedIn post URN (`urn:li:share:...`). Extracted from Buffer sent feed response after user publishes. Required to call LinkedIn socialActions API for reactions. Blocked on LinkedIn app approval. |
| `reactions_count` | INTEGER | NOT NULL | `0` | **[SPECIFIED BUT NOT IMPLEMENTED]** LinkedIn reactions count. Populated by a periodic analytics CRON (see Analytics CRON below). Blocked on LinkedIn app approval. Zero until then. |
| `last_reactions_fetch_at` | TIMESTAMPTZ | NULL | — | **[SPECIFIED BUT NOT IMPLEMENTED]** cursor for Analytics CRON reaction refreshes. Blocked on LinkedIn app approval. |
| `engagement_score` | REAL | NULL | — | `edit_ratio × 0.6 + norm(reactions_count) × 0.4` where `norm(x) = min(x/100, 1.0)`. **[SPECIFIED BUT NOT IMPLEMENTED]**: requires `reactions_count` to be populated. null until both edit_ratio and reactions data exist. See Analytics CRON. |

Persistence timing and ownership:
- these Phase 2 match fields are written on the initial `voice_posts` draft insert, not later at publish time
- `src/content/matcher.ts` only returns match metadata; it never writes `voice_posts`
- `src/worker/process-job.ts` owns the write by passing the match metadata into the draft-save path
- `context_status='skipped'` is reserved for intentional skip due to preference logic, not for matcher errors

**Status enum and valid transitions — [CURRENT STATE]**

```
pending     →  pending is the initial state: draft created, not yet submitted to Buffer.

pending     → scheduled   (Buffer accepted the Idea and scheduled it)
pending     → queued      (Buffer returned 429 rate limit — stored for retry)
pending     → failed      (Buffer returned terminal error: 401 or 403 — no retry)
scheduled   → published   (scanner confirms post appeared in Buffer sent feed)
scheduled   → expired     [SPECIFIED BUT NOT IMPLEMENTED] older than 7 days, not matched
                         in Buffer sent feed, AND the batched profile-level Buffer
                         sent-feed sync confirms the `buffer_post_id`
                         is not in a sent state. If Buffer check is ambiguous, keep
                         `scheduled` and log `voice.expired.uncertain`.
queued      → scheduled   (retry succeeded)
queued      → failed      [SPECIFIED BUT NOT IMPLEMENTED] max-retry budget exhausted.
                          No MAX_RETRY_QUEUED constant exists yet. Queued rows can
                          accumulate indefinitely until manually cleared.
```

**Derived fields (not stored, computed on read):**
- `was_user_edited`: `edit_ratio IS NOT NULL AND edit_ratio < 1.0`

**Indexes:**
- `idx_voice_posts_sha_platform` UNIQUE on `(commit_sha, platform)` — duplicate detection
- `idx_voice_posts_tenant` on `(tenant_id)` — tenant-scoped queries
- `idx_voice_retrieval` on `(platform, edit_ratio DESC NULLS LAST)` WHERE `status = 'published'`
  _(previously included `engagement_score` but that column is not yet populated — using `edit_ratio` alone until engagement data exists)_

**Required fields by phase:**
- Phase 1 (at generation): `commit_sha`, `repo`, `platform`, `ai_draft`, `findings_count`, `tenant_id`
- Phase 3 prerequisites before launch: `author_login`, `top_module_id`, `edit_analysis`
- Phase 1 (at Buffer publish): `buffer_post_id`, `scheduled_at`, `status='scheduled'`
- Phase 3 (at publish detection): `published`, `edit_ratio`, `edit_analysis`, `published_at`, `status='published'`
- Phase 3 (negative feedback): `status='expired'` when scheduled draft is never published
- Phase 2 (at draft creation): `context_status`
- Phase 2 (when match found): `has_industry_context=TRUE`, `matched_article_id`, `matched_source_id`, `match_strength`, `match_connection`

---

### `tenants` — Owner: Phase 1

One row per GitHub App installation. Billing and access unit.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | |
| `github_installation_id` | BIGINT | NOT NULL | — | UNIQUE. GitHub App installation ID |
| `github_username` | TEXT | NOT NULL | — | UNIQUE. Installing user/org login |
| `plan` | TEXT | NOT NULL | `'free'` | enum: `'free'` \| `'pro'` (future) |
| `active` | BOOLEAN | NOT NULL | `TRUE` | set to FALSE on uninstall webhook |
| `buffer_access_token` | TEXT | NULL | — | **[REQUIRED BEFORE LAUNCH]** Plaintext in V1 alpha. Will store encrypted DEK-ciphertext once envelope encryption is implemented. See Security section. |
| `config` | JSONB | NOT NULL | `{}` | tenant settings. Valid keys are documented in `TenantConfig` below. Legacy `config.voice` is deprecated and migrates to `voice_profiles` in Phase 3. |
| `voice_bootstrap` | TEXT | NULL | — | raw posts pasted at onboarding. read-only after save |

**Unique constraints:** `github_installation_id`, `github_username`

`TenantConfig` contract:

```typescript
interface TenantConfig {
  timezone?: string;                   // IANA timezone string, default UTC
  max_daily_posts_per_author?: number; // default 2
  voice?: unknown;                     // deprecated Phase 1/2 legacy field, read-only during migration to voice_profiles
}
```

Only these keys are valid in V1.5.x. New keys must be documented here before they are used in code or prompts.

---

### `job_queue` — Owner: Phase 1

Webhook enqueues. Worker claims and processes.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | |
| `tenant_id` | UUID | NOT NULL | — | FK `tenants(id)` |
| `repo` | TEXT | NOT NULL | — | `'owner/repo'` |
| `before_sha` | TEXT | NOT NULL | — | push event range start |
| `after_sha` | TEXT | NOT NULL | — | push event range end |
| `ref` | TEXT | NOT NULL | — | `'refs/heads/main'` |
| `status` | TEXT | NOT NULL | `'pending'` | enum below |
| `attempts` | INTEGER | NOT NULL | `0` | incremented on each failure |
| `error` | TEXT | NULL | — | last error message |
| `processed_at` | TIMESTAMPTZ | NULL | — | set when `done` or `failed` |
| `leased_until` | TIMESTAMPTZ | NULL | — | **gap**: not yet added. Required for poison job detection |
| `idempotency_key` | TEXT | NULL | — | **gap**: `SHA-256(tenant_id\|\|repo\|\|before_sha\|\|after_sha)`. Required to deduplicate webhook retries |

**Status enum and valid transitions:**

```
pending    → processing  (worker claims it)
processing → done        (all commits processed)
processing → pending     (attempt failed, attempts < MAX_ATTEMPTS)
processing → failed      (attempts >= MAX_ATTEMPTS = 3)
```

**Indexes:** `idx_job_queue_pending` on `(created_at ASC)` WHERE `status = 'pending'`

**Worker claim semantics** — see Worker section for full detail.

---

### `pending_batch` — Owner: Phase 1 (unimplemented)

Commits that passed `isInteresting()` but were skipped due to daily post limit.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | TEXT | NOT NULL | `gen_random_uuid()::text` | PK |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | |
| `commit_sha` | TEXT | NOT NULL | — | |
| `repo` | TEXT | NOT NULL | — | |
| `enriched_data` | JSONB | NOT NULL | — | serialized `EnrichedCommit` |

**[SPECIFIED BUT NOT IMPLEMENTED]** Table exists in schema, is never written to. `MAX_DAILY_POSTS_PER_AUTHOR` is not yet implemented. Missing columns: `tenant_id` (cannot scope per tenant) and `author_login` (cannot scope per author). Both are required before the daily cap or weekly roundup can be built — see migration script.

---

### `events_state` — Owner: Phase 1 (local dev only)

GitHub Events API cursor. Not used in production (webhook-driven architecture).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `username` | TEXT | NOT NULL | — | PK |
| `last_event_id` | TEXT | NOT NULL | — | |
| `last_event_etag` | TEXT | NULL | — | HTTP ETag for conditional GET |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | |

---

### `scheduled_slots` — Owner: Phase 1 (not yet wired)

Prevents double-booking the same time slot across concurrent post creation.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | TEXT | NOT NULL | `gen_random_uuid()::text` | PK |
| `platform` | TEXT | NOT NULL | — | `'linkedin'` \| `'instagram'` |
| `scheduled_at` | TIMESTAMPTZ | NOT NULL | — | UTC |
| `voice_post_id` | TEXT | NULL | — | FK `voice_posts(id)` |

**Unique constraint:** `(platform, scheduled_at)` — the atomicity guarantee.

**Gap:** `slot-manager.ts` is implemented but not wired into `publisher.ts`.

---

### `content_sources` — Owner: Phase 2

RSS/blog feed registry. Global (not per-tenant).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `name` | TEXT | NOT NULL | — | |
| `url` | TEXT | NOT NULL | — | UNIQUE. Homepage URL |
| `rss_url` | TEXT | NOT NULL | — | |
| `trust` | TEXT | NOT NULL | `'open'` | enum: `'curated'` \| `'verified'` \| `'open'` |
| `status` | TEXT | NOT NULL | `'queued'` | enum below |
| `articles_evaluated` | INTEGER | NOT NULL | `0` | total run through structural filter |
| `articles_passed` | INTEGER | NOT NULL | `0` | total stored (quality_score >= 6) |
| `best_score_30d` | INTEGER | NOT NULL | `0` | highest quality_score in last 30 days |
| `matched_count` | INTEGER | NOT NULL | `0` | how many commit matches came from this source |
| `last_matched_at` | TIMESTAMPTZ | NULL | — | |
| `fetch_failures` | INTEGER | NOT NULL | `0` | consecutive RSS fetch failures |
| `last_fetch_ok_at` | TIMESTAMPTZ | NULL | — | reset on successful fetch |
| `added_at` | TIMESTAMPTZ | NOT NULL | NOW() | |
| `disabled_at` | TIMESTAMPTZ | NULL | — | set when status transitions to disabled |
| `discovered_from` | TEXT | NULL | — | enum: `'awesome-tech-rss'` \| `'engineering-blogs'` \| `'both'` \| `'manual'` |
| `is_protected` | BOOLEAN | NOT NULL | `FALSE` | When TRUE: exempt from lifecycle pruning (probation → disabled transitions). Set TRUE for the seed corpus source and any manually curated high-value source that should never be auto-disabled. |

**Status enum and valid transitions:**

```
queued      → active      (promoted by weekly CRON, up to 20/week)
active      → probation   (hit_rate < 20% after articles_passed >= 10)
active      → unreachable (fetch_failures >= 5 consecutive)
probation   → disabled    (no improvement after 10 more articles)
probation   → active      (hit_rate recovers, best_score_30d >= 8 protects)
unreachable → active      (fetch succeeds again, fetch_failures reset)
disabled    → queued      (repo still lists source after 6 months)
```

**Note:** `matched_count` cold-start: not meaningful until `articles_passed >= 20` AND `age >= 90d`.

---

### `content_items` — Owner: Phase 2

Classified and stored articles. Global (not per-tenant). Expires after 45 days.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `source_id` | UUID | NULL | — | FK `content_sources(id)`. null if source later deleted |
| `fetched_at` | TIMESTAMPTZ | NULL | NOW() | |
| `week_of` | DATE | NOT NULL | — | ISO week start of fetch |
| `url` | TEXT | NOT NULL | — | UNIQUE |
| `title` | TEXT | NOT NULL | — | |
| `content_text` | TEXT | NOT NULL | — | full extracted text. enables re-classification |
| `summary` | TEXT | NOT NULL | — | AI-generated (Haiku) |
| `main_thesis` | TEXT | NOT NULL | — | AI-generated, one sentence |
| `key_insights` | TEXT[] | NOT NULL | — | AI-generated array |
| `tech_concepts` | TEXT[] | NOT NULL | — | AI-generated array |
| `seed_modules` | TEXT[] | NULL | — | only populated for curated seed corpus rows. Stores manual module tags for coverage audits. `NULL` for normal automated articles. |
| `quality_score` | INTEGER | NOT NULL | — | 1–10. Only stored if >= 6. |
| `times_matched` | INTEGER | NOT NULL | `0` | incremented atomically by `increment_content_match()` |
| `title_hash` | TEXT | NOT NULL | — | `SHA-256(lowercase(title))`. dedup exact match |
| `fingerprint` | TEXT | NOT NULL | — | first 200 words lowercase. dedup fuzzy match |

**Indexes:** `idx_title_hash` on `(title_hash)`.

---

### `article_chunks` — Owner: Phase 2

Chunks of `content_items` with pgvector embeddings.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `content_item_id` | UUID | NULL | — | FK `content_items(id)` ON DELETE CASCADE |
| `chunk_index` | INTEGER | NOT NULL | — | 0-based |
| `chunk_text` | TEXT | NOT NULL | — | |
| `embedding` | vector(1536) | NULL | — | null until OpenAI Batch job completes |

**Unique constraint:** `(content_item_id, chunk_index)`

**Indexes:** `idx_article_chunks_embedding` HNSW on `(embedding vector_cosine_ops)` WITH `m=16, ef_construction=64`

**HNSW parameter rationale:**
- `m=16`, `ef_construction=64` are pgvector defaults — not tuned for this workload.
- At alpha corpus size (~3,000 chunks/year = 250/week × 12 weeks), the index is trivially small. Any parameter set produces near-perfect recall. Parameters do not matter at this scale.
- At scale (50,000+ chunks), `m=16` can produce suboptimal recall for high-dimensional vectors (1536 dims). Recommended upgrade at that point: `m=32, ef_construction=128`.
- Changing HNSW parameters requires a full index rebuild (`REINDEX`). At 3,000 chunks this takes seconds; at 50,000 it takes minutes but is a simple maintenance operation.
- **No action needed now.** Revisit when corpus exceeds 10,000 chunks or when match recall drops below 80% on spot-checks.

---

### `content_pipeline_runs` — Owner: Phase 2

One row per weekly CRON execution. Used for trend analysis and health reporting.

All volume and quality columns are `INTEGER NOT NULL DEFAULT 0` or `REAL`. See `database/schema.sql` for full column list.

---

### `voice_profiles` — Owner: Phase 3 (not yet implemented)

One row per developer per tenant installation.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `tenant_id` | UUID | NOT NULL | — | FK `tenants(id)` |
| `github_author_login` | TEXT | NULL | — | null = tenant default profile |
| `voice` | JSONB | NOT NULL | `{}` | `VoiceProfile` object |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | |
| `version` | INTEGER | NOT NULL | `1` | **required for proper optimistic locking** |

**Unique indexes:**
- `idx_voice_profiles_tenant_default` UNIQUE on `(tenant_id)` WHERE `github_author_login IS NULL`
- `idx_voice_profiles_tenant_author` UNIQUE on `(tenant_id, github_author_login)` WHERE `github_author_login IS NOT NULL`

---

### SQL Functions (RPCs)

| Function | Purpose |
|----------|---------|
| `match_article_chunks(query_embedding, threshold, count, min_quality, week_cutoff)` | pgvector cosine search. Returns `(content_item_id, similarity)` |
| `increment_content_match(p_article_id, p_source_id)` | Atomically increments `content_items.times_matched` + `content_sources.matched_count`. Single transaction. |

---

### RLS Policy

All tables have `ENABLE ROW LEVEL SECURITY`. No public policies defined — anon key has zero access. All backend services use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS). RLS provides **tenant data isolation for functional queries** but is not the primary credential protection mechanism — see Security section.

---

### Migration (Liliana's single-tenant data)

Run in Supabase SQL Editor. Each step must pass before proceeding.

**Step 0 — Pre-flight checks (run first, fix before proceeding)**

```sql
-- 1. Confirm the tenant row exists
SELECT id FROM tenants WHERE github_username = 'lilicurl';
-- Must return exactly 1 row. If 0: tenant not created yet — run onboarding first.

-- 2. Check for SHA collisions — rows that would violate UNIQUE(commit_sha, platform) after assignment
SELECT commit_sha, platform, COUNT(*) FROM voice_posts
WHERE tenant_id IS NULL
GROUP BY commit_sha, platform
HAVING COUNT(*) > 1;
-- Must return 0 rows. If any: duplicate pre-existing rows.
-- Decide per row: keep the newest (MAX(created_at)), delete the older.
-- DELETE FROM voice_posts WHERE id IN (
--   SELECT id FROM (
--     SELECT id, ROW_NUMBER() OVER (PARTITION BY commit_sha, platform ORDER BY created_at DESC) AS rn
--     FROM voice_posts WHERE tenant_id IS NULL
--   ) t WHERE rn > 1
-- );

-- 3. Count rows to migrate
SELECT COUNT(*) FROM voice_posts WHERE tenant_id IS NULL;
-- Note the number. You will verify the same number was updated.
```

**Step 1 — Assign tenant_id**

```sql
UPDATE voice_posts
  SET tenant_id = (SELECT id FROM tenants WHERE github_username = 'lilicurl')
WHERE tenant_id IS NULL;
-- Verify: rows updated must match the count from Step 0 check 3.
```

**Step 2 — Post-migration verification**

```sql
-- No null tenant_ids remain
SELECT COUNT(*) FROM voice_posts WHERE tenant_id IS NULL;
-- Must be 0. If not: investigate why new rows appeared during migration.

-- UNIQUE index still holds (no violations)
SELECT commit_sha, platform, COUNT(*) FROM voice_posts
GROUP BY commit_sha, platform
HAVING COUNT(*) > 1;
-- Must be 0 rows. If any: the UNIQUE index will block future writes. Investigate immediately.

-- Spot check: voice_posts scoped to lilicurl tenant return correct data
SELECT COUNT(*), MIN(created_at), MAX(created_at)
FROM voice_posts
WHERE tenant_id = (SELECT id FROM tenants WHERE github_username = 'lilicurl');
-- Count must match what you migrated.
```

**Rollback** (only safe before new multi-tenant data exists):

```sql
-- Undo the assignment if something is wrong:
UPDATE voice_posts SET tenant_id = NULL
WHERE tenant_id = (SELECT id FROM tenants WHERE github_username = 'lilicurl');
```

This rollback is only valid if no other tenant has posted yet. Once a second tenant exists, tenant_id = NULL is ambiguous and the rollback cannot be used.

---

## The 24 Analysis Modules

**Key principle:** Modules detect what is interesting. Claude writes about it.
Claude never analyzes code directly.

```typescript
interface CodeAnalyzer {
  readonly id: string;
  readonly name: string;
  readonly category: AnalysisCategory;
  readonly applicableLanguages?: string[];  // undefined = all languages
  analyze(ctx: AnalysisContext): Promise<Finding | null>;
}
```

`MODULE_REGISTRY` in `src/analysis/modules/index.ts` is the ONLY file that changes
when adding a new module.

Modules: complexity, design_patterns, clean_code, type_system, integration, testing,
ai_assisted, performance, security, api_design, error_resilience, observability,
concurrency, dx, dependency_health, evolutionary, js_advanced, react_patterns, devops,
python, go, java_quarkus, elixir, architecture_patterns.

Pipeline: all modules run via `Promise.allSettled` (parallel, failure-isolated).
Freshness multiplier reduces repeated modules. Final findings order is:
- `adjustedScore DESC`
- tie-break 1: `interestScore DESC`
- tie-break 2: `moduleId ASC` (deterministic only)

The pipeline returns the top 3 findings from this final ordered array. `top_module_id` is
defined as `findings[0].moduleId` from that array, and `top_finding` comes from the same row.
Returns `[]` if nothing found → caller skips Claude call entirely.

---

## Claude API — Cost Controls

| Rule | Value |
|------|-------|
| Model | `claude-sonnet-4-6` only for post generation |
| max_tokens | 1600 (hardcoded, never increase) |
| `isInteresting()` | Runs BEFORE any API call — zero cost on trivial commits |
| Modules BEFORE Claude | 0 findings → Claude never called |
| ONE call per commit | Never one per module |
| Dedup per tenant | Same SHA never processed twice |
| Daily post limit | `MAX_DAILY_POSTS_PER_AUTHOR = 2` — see below |

### MAX_DAILY_POSTS_PER_AUTHOR = 2

**Status: planned, not yet implemented.**

A developer who pushes 30 commits in a day should not receive 30 posts. Two reasons:
1. **Quality**: forcing the system to choose the 2 best commits of the day produces better posts than generating one per commit.
2. **Cost**: unbounded generation is a cost risk and a noise risk for the developer's audience.

**Scope: per `(tenant_id, commit.authorLogin)`, not per tenant.**

In an org installation with 5 developers, each developer gets their own daily budget. Developer A posting 10 commits does not consume Developer B's budget.

**Implementation plan** (`process-job.ts`, before `generatePosts()`):

```typescript
const todayCount = await storage.countGeneratedToday(tenant.id, commit.authorLogin);
if (todayCount >= MAX_DAILY_POSTS_PER_AUTHOR) {
  logger.info('worker.commit.daily_limit_reached', {
    sha: commit.sha,
    authorLogin: commit.authorLogin,
    todayCount,
  });
  await storage.savePendingBatch(commit, tenant.id);
  continue;
}
```

`countGeneratedToday(tenantId, authorLogin)`: counts `voice_posts` WHERE
`tenant_id = $1 AND author_login = $2 AND created_at >= startOfDay(tenant.config.timezone ?? 'UTC')`.

**Timezone rule:** daily caps are scoped to the tenant's configured IANA timezone string
(`tenants.config.timezone`). If absent, default to `UTC`. `CLT` is not valid as a global product default.

**Dependencies before implementing:**
1. `pending_batch` needs `tenant_id` column (currently missing)
2. `voice_posts` needs `author_login TEXT` column (currently not persisted)
3. `storage.countGeneratedToday()` + `storage.savePendingBatch()` on `IVoiceStorage`

Commits that hit the limit go to `pending_batch` — not discarded. Weekly roundup (Open Questions) will use them.

**Configurable:** `tenants.config.max_daily_posts_per_author`. Default: 2. Paid tiers: higher.

**Known gap — burst waste:** 50 separate pushes = 50 jobs. All 50 claim and run the module pipeline before the cap stops post generation at commit 3. Fix requires storing the author at enqueue time in `job_queue` so `claimJob()` can skip jobs for authors already at the daily cap. Deferred.

---

## Error Handling Per Service

```
GitHub:     404 → RepoNotFoundError (no retry); 429 → withRetry()
Anthropic:  529 → withRetry(); 400/403/404/422 → throw (no retry); 401 → throw
Buffer:     5xx → withRetry(); 401 → BufferTokenExpiredError; 429 → store 'queued'
```

---

## Worker Semantics — Job Queue Contract

The worker runs as a Cloud Run Job every 15 minutes. Single instance per run. No horizontal scaling today.

### Claim semantics (as implemented)

Two-step SELECT + conditional UPDATE. Not atomic SKIP LOCKED.

```typescript
// Step 1: find candidate
SELECT id FROM job_queue
  WHERE status = 'pending' AND attempts < MAX_ATTEMPTS
  ORDER BY created_at ASC LIMIT 1

// Step 2: claim with optimistic guard
UPDATE job_queue SET status = 'processing'
  WHERE id = $jobId AND status = 'pending'
  RETURNING id
```

If the UPDATE returns empty, another worker claimed the job first — caller returns null and the loop stops.

**Why this is safe today:** Cloud Run Job runs as a single instance (not parallel). The two-step race window doesn't matter.

**What breaks it:** If Cloud Run Job is ever scaled to multiple instances, or if a future reaper re-sets stuck jobs to `pending`, two instances can claim the same job. Fix: replace with `FOR UPDATE SKIP LOCKED` in a single SQL transaction.

### Retry policy

| Condition | Behavior |
|-----------|---------|
| Job throws any error | `attempts++`, status → `pending` if `attempts < 3` |
| `attempts >= 3` | status → `failed` (terminal) |
| Per-commit error inside a job | logged, job continues to next commit (never aborts whole job) |

`MAX_ATTEMPTS = 3` hardcoded in `main-worker.ts`.

### Poison jobs (gap)

A job stuck in `status='processing'` forever is a poison job. Current causes:
- Worker Cloud Run Job killed mid-run (OOM, timeout, deploy)
- Unhandled promise rejection that skips `markFailed`

**Required fix:** Add `leased_until TIMESTAMPTZ` to `job_queue`. Worker sets `leased_until = NOW() + 10min` on claim. A reaper query run at worker start resets any `processing` job where `leased_until < NOW()` back to `pending`.

### Idempotency (gap)

GitHub webhook retries the same event if the server doesn't respond 200 in time. The webhook handler responds 200 immediately (by design), but a network partition could still cause duplicate events.

**Required fix:** Add `idempotency_key TEXT UNIQUE` = `SHA-256(tenant_id||repo||before_sha||after_sha)`. Webhook handler uses INSERT ... ON CONFLICT DO NOTHING.

### Burst handling

A developer who force-pushes 50 commits in one push creates one job with `before_sha` and `after_sha` spanning all 50 commits. The worker fetches all 50 from `compareCommits()` and processes each in a loop — capped by `MAX_DAILY_POSTS_PER_AUTHOR = 2` (once implemented).

A developer who does 50 separate pushes in one day creates 50 jobs. Each job processes 1 commit. The daily cap (once implemented) limits total posts, but all 50 jobs still run (wasting API calls after the cap is hit). Full fix tracked in OQ-2.

**No per-tenant job throttle today.** Accepted for alpha volume (< 50 tenants).

### Dead-letter / terminal failure

Jobs in `status='failed'` are permanent dead-letter entries. No automatic retry beyond `MAX_ATTEMPTS`. No alerting when a job dies permanently.

**Operations:** `SELECT * FROM job_queue WHERE status = 'failed' ORDER BY created_at DESC` is the manual recovery query. To retry: `UPDATE job_queue SET status='pending', attempts=0 WHERE id = $id`.

---

## Failure Handling — What the Developer Sees vs What Liliana Sees

**Developer experience on failure: silence.**
If post generation fails for a commit, the developer sees nothing. No error, no partial post,
no notification.

**The problem with total silence:** The developer cannot distinguish between:
- No interesting commit (expected, correct)
- Rate limit hit (temporary, will retry)
- GitHub token expired (permanent until reinstall)
- Anthropic API failure (temporary)
- Buffer token expired (permanent until onboarding update)
- Worker stopped running entirely

See **Tenant Health Status** section for how to surface this.

**Liliana's experience on failure: structured logs + alerting.**
Every failure is logged with enough context to diagnose. The worker logs a run summary
after each execution.

Key log events:
```typescript
logger.error('worker.job.failed', { job_id, tenant_id, error: String(err), attempts });
logger.info('worker.run.summary', {
  jobs_processed, jobs_failed, jobs_skipped,
  tenants_served, posts_generated, buffer_posted,
});
```

Alert thresholds (log-based, V1):
| Condition | Log key | Severity |
|-----------|---------|----------|
| Job fails 3+ times | `worker.job.max_retries` | Error |
| 0 posts generated in 24h across all tenants | `worker.run.zero_output` | Error |
| Worker run takes > 10 min | `worker.run.slow` | Warn |

Failed jobs stay in `job_queue` with `status='failed'` and `attempts` count.
A future cleanup CRON will expire old failed jobs and log a weekly summary.

---

## Tenant Health Status (planned, not yet implemented)

Silent failures are not acceptable for V1 alpha but are a trust problem at any scale. A developer who pushed 3 times this week and saw zero posts doesn't know if devcast is working.

**Minimum viable status endpoint:**

`GET /status` (authenticated via GitHub OAuth session) returns:
```json
{
  "last_commit_processed_at": "2026-04-06T18:32:00Z",
  "last_post_generated_at": "2026-04-06T18:32:05Z",
  "pending_jobs": 0,
  "failed_jobs_24h": 1,
  "buffer_token_status": "ok",
  "posts_today": 1,
  "posts_this_week": 4
}
```

Visible in onboarding UI as a health banner. Turns red if:
- `failed_jobs_24h > 0`
- `buffer_token_status = 'expired'`
- No commits processed in last 7 days (worker may be down)

**Implementation:** Reads from `job_queue` + `voice_posts` + `tenants`. No new table needed.

---

## Security — Token Storage

**[REQUIRED BEFORE LAUNCH]** — Plaintext tokens are V1 alpha only. Must be resolved before publishing pricing or listing on GitHub Marketplace.

**Chosen strategy: envelope encryption with GCP KMS.**

Rationale: one KMS key (the KEK) covers all tenants → ~$0.06/month fixed cost. DEKs are
generated locally and stored encrypted in the DB. KMS is called once per job to unwrap the
DEK, not once per token access. GCP Secret Manager per-token would cost ~$0.12/tenant/month
and grows linearly — rejected.

**Implementation:**
1. At tenant creation: generate a random 256-bit DEK, call KMS to encrypt it, store
   the encrypted DEK in `tenants.encrypted_dek TEXT` (new column — not yet added).
2. Encrypt `buffer_access_token` with the DEK before writing to DB.
3. In the worker at job claim time: call KMS to decrypt the DEK, then decrypt the token.
   Never log decrypted values.

**What must not change when this is implemented:**
- `tenants.buffer_access_token` column stays — it stores the DEK-encrypted ciphertext.
- The `TenantRow` interface in `process-job.ts` stays unchanged.
- Only the storage adapter and a new decryption step in `processJob` change.

**New column required:**
```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS encrypted_dek TEXT;
-- Populated at tenant creation, required before token write.
```

---

## Known Tradeoffs (Phase 1)

1. Buffer doesn't support third-party OAuth — users paste API key. Stored in DB (see Security section).
2. Buffer is the publishing layer — LinkedIn, Instagram, Twitter/X, and more, all via one integration.
   devcast does not integrate directly with any social network. This reduces maintenance surface.
3. Worker runs every 15 min — posts appear ~15 min after push.
4. Single Cloud Run image for webhook + worker (different entry points). Simpler CI/CD.
5. GitHub App owned by `vialabs-net` org (required for Marketplace listing).
6. GitHub only today. Bitbucket and GitLab require separate GitHub App equivalents per platform. Deferred.

---

---

# Phase 2 — Content Intelligence Agent

**Status:** Partially implemented on `feat/content-intelligence`. Pending SQL migration in Supabase.

---

## Goal

When devcast generates a post about a developer's commit, connect it with what the
industry is discussing. If a user builds a circuit breaker and Netflix just published
about their circuit breaker failures — the post becomes 10x more relevant.

Fallback: if no match found, generate a normal code analysis post (current behavior).

---

## AI Provider Configuration

Two AI providers are in use. All real-time interactions go through typed interfaces (`src/ai/types.ts`). The Anthropic Batch API is an explicit exception — see below.

**Secrets:**

| Secret | Purpose | Where |
|--------|---------|-------|
| `ANTHROPIC_API_KEY` | Post generation (Sonnet), classification (Haiku), cross-encoding (Haiku) | Cloud Run jobs + GitHub Actions |
| `OPENAI_API_KEY` | Article chunk embedding (text-embedding-3-small) | Cloud Run jobs + GitHub Actions |

**Config (`config.yaml`):**
```yaml
ai:
  provider: "anthropic"
  model: "claude-sonnet-4-6"
  max_tokens: 1600
  classify_model: "claude-haiku-4-5"
embeddings:
  provider: "openai"
  model: "text-embedding-3-small"
```

**Real-time interface** (`src/ai/types.ts`):
```typescript
interface IAIClient { complete(system: string, user: string): Promise<string>; }
interface IEmbedder { embed(text: string): Promise<number[]>; }
```
V1: `AnthropicAdapter` + `OpenAIEmbedder`. Swappable per config.

**Batch API exception:** `classifier.ts` calls the Anthropic SDK directly — the Batch API (submit → poll → download) cannot be expressed through `IAIClient.complete()`. Switching the classifier to a different batch provider requires rewriting `classifier.ts`. This is accepted. Cross-encoder and post generation remain provider-agnostic.

| Provider | Regular | Batch (50% off) | Used for |
|----------|---------|-----------------|----------|
| Anthropic Haiku input | $1.00/MTok | $0.50/MTok | Classifier, cross-encoder |
| Anthropic Haiku output | $5.00/MTok | $2.50/MTok | Classifier, cross-encoder |
| OpenAI text-embedding-3-small | $0.02/MTok | $0.01/MTok | Article chunk embeddings |

Weekly CRON uses Batch API (not time-sensitive). Per-commit matching uses real-time
(post generation must not wait hours).

### Batch timeout plan

Anthropic/OpenAI Batch API SLA is up to 24h. For ~120 Haiku requests, expect 5–15 min. GitHub Actions timeout is 6h. If batch does not complete in 2h, the CRON exits.

**Gap in the original plan:** "store the `batch_id`" had no specified storage location. If the process dies, there is nowhere to look up the pending batch ID on the next run.

**Storage: `content_pipeline_runs` table — two columns needed:**

```sql
ALTER TABLE content_pipeline_runs
  ADD COLUMN IF NOT EXISTS classify_batch_id TEXT,   -- Anthropic Batch API ID
  ADD COLUMN IF NOT EXISTS embed_batch_id    TEXT;   -- OpenAI Batch API ID
```

Both columns are null on a completed run. They are set when a batch is submitted and cleared when the batch is downloaded and processed.

**Recovery flow on next weekly CRON run:**

```typescript
// At start of content-fetch-main.ts, before submitting new batches:
const pending = await db
  .from('content_pipeline_runs')
  .select('id, classify_batch_id, embed_batch_id')
  .not('classify_batch_id', 'is', null)
  .order('run_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (pending?.classify_batch_id) {
  const status = await checkAnthropicBatch(pending.classify_batch_id);
  if (status === 'ended') {
    await downloadAndStoreClassifications(pending.classify_batch_id, pending.id);
    await db.from('content_pipeline_runs')
      .update({ classify_batch_id: null })
      .eq('id', pending.id);
  } else {
    logger.warn('content.batch.still_pending', { batch_id: pending.classify_batch_id });
    // Skip new submission this week — wait for previous batch to complete.
    return;
  }
}
// Same pattern for embed_batch_id.
```

**Lost batch** (API returns 404 or `expired`): clear the column, log `content.batch.lost`, re-fetch and re-classify next week. Real loss: ~0% (Anthropic keeps batches 29 days; OpenAI 7 days — both exceed the weekly CRON interval).

---

## Source Registry

Sources are RSS/blog feeds stored in `content_sources`.

Trust levels:
- `curated` — company engineering blogs (Netflix, Stripe, Cloudflare). Structural score bonus +3.
- `verified` — individual with established track record (Martin Fowler). Bonus +1.
- `open` — open platform (dev.to, Medium). No bonus.

Source lifecycle: `queued → active → probation → disabled / unreachable`
- hit_rate < 20% after 10 articles → probation
- probation + no improvement after 10 more → disabled
- best_score_30d >= 8 → always protected (produces occasional gems even at low hit_rate)
- fetch_failures >= 5 consecutive → unreachable (NOT a quality failure — infrastructure issue)
- fetch OK again → reset fetch_failures, back to active
- matched_count = 0 after articles_passed >= 20 AND age >= 90d → probation
- disabled + repo still lists it 6 months later → `queued` (not directly to `active`)

Key rules:
- Martin Fowler publishes rarely → may never reach 10 evaluated articles → stays active indefinitely
- Infrastructure failure (RSS down) never confused with quality failure
- `matched_count` cold start: takes 3+ months to be meaningful (needs `articles_passed >= 20`). See Cold Start Corpus section.

**Source reactivation rule (corrected):**

The old `best_score_30d >= 4` gate was impossible for disabled sources, because disabled sources are not evaluated and therefore cannot refresh a rolling 30-day score. It has been removed from the transition rule.

Reactivated sources still go to `queued`, not directly to `active` — they must win one of the weekly promotion slots again. That queue step is the quality gate. If a future phase needs a historical quality gate for reactivation, it must store a non-rolling snapshot such as `best_score_at_disable`.

Ownership:
- `discover-sources.yml` performs the "repo still lists source" re-check during the twice-monthly re-import run
- when a previously `disabled` source is still present in the repo feed after 6 months, that workflow moves it back to `queued`

### Trust assignment

Trust is assigned manually when adding sources. Sources from repos default to `verified`
if they appear in BOTH repos, `open` otherwise. Manual override via `sources.yml`.

| Trust | Meaning | Examples |
|-------|---------|----------|
| `curated` | Company engineering blog or editorially reviewed | Netflix, Stripe, Cloudflare, ByteByteGo |
| `verified` | Individual with established track record | Martin Fowler, Julia Evans |
| `open` | Open platform, anyone can publish | dev.to, Medium, Hashnode |

### RSS auto-discovery

`kilimchoi/engineering-blogs` lists homepage URLs, not RSS URLs. Before adding a source:

```typescript
// src/content/rss-discovery.ts
export async function discoverRssUrl(homepageUrl: string): Promise<string | null> {
  // 1. Fetch homepage HTML
  // 2. Parse <link rel="alternate" type="application/rss+xml" href="...">
  // 3. Also check <link rel="alternate" type="application/atom+xml" href="...">
  // 4. Fallback: try common paths (/feed, /rss, /atom.xml, /feed.xml, /index.xml)
  // 5. If nothing found → return null (source not added)
}
```

Sources without a discoverable RSS feed are logged and skipped — not added to the registry. Without an RSS feed there is no automated way to fetch new articles. Manual polling via HTML scraping is not scalable and would require per-source scraper maintenance. The RSS requirement is a hard gate.

---

## Weekly Content Pipeline

Runs every Sunday via `content-fetch.yml` (automatic) or manually via `workflow_dispatch` in GitHub Actions. Manual dispatch is the correct way to run it outside the weekly schedule — no code change needed.

```
Promote up to 20 queued sources → active. The 20-source limit per week controls classification and embedding budget: 20 new sources × ~3 articles/week × ~$0.0013/article = ~$0.08/week overhead. It also lets the pipeline evaluate sources gradually — promoting all queued sources at once on week 1 would flood the corpus with unproven sources before the lifecycle evaluator has enough signal to prune them.
Fetch RSS from all active sources (p-limit 5, 15s domain delay)

Per article:
  → RSS content:encoded → @extractus/article-extractor → Puppeteer (curated only, fallback)
  → 3-layer extraction: if RSS text >= 300 words → done.
                        else URL extract. Else Puppeteer (curated only).
  → dedup: SHA-256(lowercase(title)) + Jaccard fuzzy on first 200 words
  → pre-skip: changelog, release notes, < 300 words → skip
  → structuralScore(): code blocks, metrics, tradeoffs, prod context, tutorial penalty
  → top 3 per source (structural score DESC)
  → classifyArticlesBatch() — Haiku Batch API, quality_score >= 6 gate
  → chunkArticle() — 512 tokens, 64 overlap, never split code blocks
  → embedChunksBatch() — OpenAI Batch API, text-embedding-3-small, 1536 dims
  → store in content_items + article_chunks (pgvector)

Update source stats → log health report → evaluate source lifecycle

### Article text extraction — 3-layer strategy

**Why @extractus/article-extractor** over alternatives:
- `readability` (Mozilla): DOM-only, requires `jsdom` in Node.js — heavy, slower
- `mercury-parser` (Postlight): unmaintained since 2023, archived repo
- `trafilatura` (Python): requires Python runtime, incompatible with Node.js stack
- `@extractus/article-extractor`: pure Node.js, actively maintained, MIT license, ~50KB. Best fit.

**Feasibility validation result (spike, 2026-04):**
- URL extraction alone: 33% pass rate on curated sources
- RSS content quality: 63% raw, projected ~93% with 3-layer strategy
- Gate was `>= 80%` — met with 3-layer approach. Do not regress to 1-layer.

**Expected failure rates (accepted):**

| Failure type | Frequency | Handling |
|-------------|-----------|---------|
| JavaScript-rendered content (SPA) | ~5% | Skip — Puppeteer only for curated |
| Paywalls | ~3% | Skip |
| Anti-bot / Cloudflare challenge | ~2% | Skip — retry next week |
| Malformed HTML / partial extraction | ~5% | `wordCount < 300` guard → skip |
| **Total expected** | **~10-15%** | Logged, skipped, not retried until next cycle |

**Critical distinction:** extraction failures are NOT source quality failures.
`content_sources.fetch_failures` only increments for RSS feed failures, never for
individual article extraction failures.

**Rate limiting:**
- Max 5 parallel fetches (`p-limit`)
- 15s delay between requests to the same domain
- User-Agent: `devcast/1.0 (+https://devcast.lilicurl.com)`
- 30s timeout per article

### Dedup — two steps before classification

**Step 1 — Exact title match (free, instant)**
`SHA-256(lowercase(title))`. Identical title exists → skip. Catches cross-posts.

**Step 2 — Fuzzy similarity (free, ~1ms)**
Only when Step 1 doesn't match. If stored article has title > 70% Jaccard word similarity,
compare first 200 words. If word overlap > 85% → skip. Catches rewritten cross-posts.

```typescript
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}
```

**Known limitation — no stopword normalization:**

Jaccard on raw words does not strip stopwords (`a`, `the`, `is`, `in`, `of`) or apply stemming (`building` vs `build`, `breakers` vs `breaker`). This causes two problems:

1. **Under-detection (false negatives):** "Build a circuit breaker" and "Building circuit breakers" share 1 content word out of 6 total unique words → Jaccard ≈ 0.17. These are the same concept but the dedup misses them.

2. **Over-detection risk (false positives):** Short titles with high stopword overlap may trigger the gate when they are unrelated articles.

**Why this is accepted:** The dedup is a cost-saving pre-filter, not the final quality gate. The Anthropic classifier runs after dedup and will produce a different summary for genuinely different articles even if they discuss similar topics. Duplicate articles with slightly different wording produce redundant chunks in pgvector — mildly wasteful, not harmful to match quality.

**Improvement path (if needed):** Strip common English stopwords before Jaccard. A 30-word stopword list covers 99% of the noise. No stemming library needed. Implement when false negative rate is measurable (requires manually tagging duplicates in the corpus).

### Structural scoring — exact function

All filtering before AI. Reduces ~400 articles to ~120, saving ~60% classification cost.

**Pre-skip (title-level, instant):**
```typescript
function shouldSkip(title: string, wordCount: number): boolean {
  if (/changelog|release notes|what's new|weekly roundup|newsletter|digest/i.test(title)) return true;
  if (wordCount < 300) return true;
  return false;
}
```

**Structural score (content-level):**
```typescript
interface StructuralSignals {
  wordCount: number;
  codeBlockCount: number;
  hasMetrics: boolean;        // /\d+\s*(ms|rps|%|MB|GB|req\/s|p99|latency|throughput)/i
  hasTradeoffs: boolean;      // /trade.?off|however|downside|chose .+ over|instead of/i
  hasProdContext: boolean;    // /in production|at scale|our (system|service|platform)|we (run|operate|serve)/i
  isTutorialPattern: boolean; // /getting started|step[- ]by[- ]step|beginner|how to .+ in \d/i
}

function structuralScore(s: StructuralSignals, trust: SourceTrust): number {
  let score = 0;
  if (s.wordCount >= 800) score += 2;
  if (s.codeBlockCount >= 2) score += 2;
  if (s.hasMetrics) score += 2;
  if (s.hasTradeoffs) score += 2;
  if (s.hasProdContext) score += 2;
  if (s.isTutorialPattern) score -= 4;
  if (trust === 'curated') score += 3;
  if (trust === 'verified') score += 1;
  return score; // gate: >= 4
}
```

**Example — why trust bonus matters:**
Martin Fowler (verified, +1), 500-word post, mentions tradeoffs (+2) and prod context (+2):
score = 0 + 0 + 0 + 2 + 2 + 1 = **5 → passes**.
Same post from unknown blog: score = **4 → borderline**.
Netflix Engineering (curated, +3): score = 0+0+0+2+2+3 = **7 → always passes** unless tutorial pattern.

**Top 3 per source cap (after scoring, before classifier):**

Here, `source` means the source registry primary key (`content_sources.id`), carried on each
candidate as `article.sourceId`. It does **not** mean URL hostname, feed title, or domain grouping.

```typescript
const budgetCapped = groupBy(articles, (article) => article.sourceId)
  .flatMap(([_sourceId, group]) =>
    group.sort((a, b) => b.structuralScore - a.structuralScore).slice(0, 3)
  );
```
Prevents a prolific source from consuming the entire AI budget.

**Weekly pipeline order (exact):**
```typescript
const extracted = await fetchAndExtractAllSources();
const unique = dedupByCanonicalUrlOrHash(extracted);
const preskipped = unique.filter((article) => !shouldPreSkip(article));
const scored = preskipped.map((article) => ({
  ...article,
  structuralScore: structuralScore(article.signals, article.trust),
}));
const gated = scored.filter((article) => article.structuralScore >= 4);
const top3PerSource = groupBy(gated, (article) => article.sourceId)
  .flatMap(([_sourceId, group]) =>
    group.sort((a, b) => b.structuralScore - a.structuralScore).slice(0, 3)
  );
const classified = await classifyBatch(top3PerSource);
```

The cap is applied to the structurally gated list **before** the classifier batch is constructed.
If it happens after `classifyBatch()`, it is considered an incorrect implementation.

### AI classifier — full prompt and gate

Receives FULL article text (no truncation). With Batch API, 2000 words (~2600 tokens)
costs ~$0.0013/article. Truncation saves ~$0.0005 but risks missing mid-article signals.

```
You are evaluating a technical article for depth and originality.

Rate the article on a scale of 1-10:
- 1-3: tutorial, rehash of documentation, or surface-level overview
- 4-6: decent technical content but nothing you couldn't find in docs or standard resources
- 7-8: real-world experience, production insights, or non-obvious lessons
- 9-10: exceptional depth — war stories, failure analysis, novel approaches with data

Respond ONLY as JSON:
{
  "quality_score": <number 1-10>,
  "summary": "<2-3 sentence summary>",
  "main_thesis": "<one sentence core argument>",
  "key_insights": ["<insight 1>", "<insight 2>"],
  "tech_concepts": ["<concept 1>", "<concept 2>"]
}
```

**Gate: `quality_score >= 6`**

Why 6 (not 7): LLM scoring is non-deterministic — same article can score 6 or 7 on
different runs. Gate at 6 prefers false positives over false negatives. The matching
cross-encoder is the real quality filter.

**JSON parse failure:**
1. `JSON.parse(response)`
2. If fails: retry same call once (different sampling = different output)
3. If fails again: log `classify.json_error` + skip this article (not a source quality failure)
Expected real loss: ~0.1% of articles (2–5% fail rate × ~95% retry success).

### Chunking strategy

```typescript
// src/content/chunker.ts
const CHUNK_SIZE = 512;    // tokens (approximate: word count × 1.3)
const CHUNK_OVERLAP = 64;  // tokens — ensures context not lost at boundaries

export function chunkArticle(text: string): string[] {
  // 1. Split by paragraphs (double newline)
  // 2. Accumulate until CHUNK_SIZE reached
  // 3. Start next chunk with CHUNK_OVERLAP tokens from end of previous
  // 4. Code blocks: never split mid-block
  //    (if code block > CHUNK_SIZE, it becomes its own standalone chunk)
}
```

Average article (~1500 words) → ~5 chunks. ~50 articles/week × 5 = ~250 chunks/week.
Code blocks are detected by markdown fences (```) or 4+ space indentation.

---

## Article Funnel (steady-state weekly throughput)

```
~250 active sources → ~500 articles/week from RSS
  → ~430 extracted (10-15% fail)
  → ~400 unique (dedup)
  → ~350 pass pre-skip
  → ~180 pass structural gate (>= 4)
  → ~120 to classifier (top 3/source cap)
  → ~50 stored (quality_score >= 6)
  → ~250 chunks embedded
  → 2-5 matches/week injected into prompts
```

Important: this funnel describes gross weekly throughput, not permanent corpus growth.
At steady state the automated pipeline still adds ~50 stored articles/week (~250 chunks/week),
but retained corpus size is later capped by the 45-day expiry window plus the monthly cleanup CRON.
The protected seed corpus is outside that expiry logic. See Cold Start timeline below.

---

## Matching Pipeline (per commit, real-time)

Runs inside post-generation critical path. Failures are always graceful — post generates
normally without context.

**Graceful degradation — exact pattern:**
```typescript
try {
  const industryMatch = await matchFindingsToArticles(findings, embedder, aiClient, db);
  if (industryMatch) {
    industryContext = industryMatch.connection;
  }
} catch (err) {
  logger.warn('content.match.skipped', { error: String(err) });
  // continue without industry context — normal post
}
```

**Matcher contract (Phase 2):**
```typescript
interface IndustryMatch {
  articleId: string;
  sourceId: string;
  matchStrength: number; // cosine similarity of the winning Stage 1 article
  connection: string;    // one sentence, returned only for the winning strong match
}

interface MatcherOptions {
  stage1Threshold?: number; // default 0.75
}

async function matchFindingsToArticles(
  findings: Finding[],
  embedder: EmbedderClient,
  aiClient: AIClient,
  db: ContentDatabase,
  opts?: MatcherOptions,
): Promise<IndustryMatch | null>
```

`stage1Threshold` belongs to the Phase 2 matcher contract because it changes Stage 1 candidate selection.
Phase 3 may pass a non-default value, but it must not redefine the function signature.
The matcher returns metadata only; persistence is owned by `process-job.ts`.

```
Stage 1 — pgvector bi-encoder (~200ms + 1 embedding call):
  1. embed finding.plainLanguage (OpenAI real-time, ~100 tokens)
  2. cosine similarity against article_chunks
  3. chunk-to-article dedup: multiple chunks from same article → keep only
     the highest-similarity chunk. 3 candidates = 3 UNIQUE articles.
  4. top 3 unique articles, where the similarity threshold is `opts?.stage1Threshold ?? 0.75`
     → default remains `> 0.75`
     → if a later phase passes `stage1Threshold=0.72`, Stage 1 uses `> 0.72`
  5. filter: week_of >= NOW() - 30 days, quality_score >= 6

Stage 2 — AI cross-encoder (Haiku, 1 call for ALL candidates):
  Cost optimization: 1 AI call per finding (batched), not 1 per candidate.
  A commit with 3 findings = 3 AI calls max, not 9.

  Prompt:
  ---
  You are deciding if a developer's code change is related to an industry article.

  Code change (finding):
  - Module: {finding.moduleId}
  - Finding: {finding.finding}
  - Context: {finding.plainLanguage}
  - File: {finding.contextHint}

  Candidate articles:
  1. "{article1.title}" — Thesis: {article1.main_thesis}. Insights: {article1.key_insights.join(', ')}
  2. "{article2.title}" — Thesis: {article2.main_thesis}. Insights: {article2.key_insights.join(', ')}
  3. "{article3.title}" — Thesis: {article3.main_thesis}. Insights: {article3.key_insights.join(', ')}

  For each candidate, respond:
  - strength: "strong" (direct connection), "weak" (tangential), or "none"
  - connection: one sentence explaining how code relates to article (only if strong)

  Respond as JSON array:
  [
    { "candidate": 1, "strength": "strong", "connection": "..." },
    { "candidate": 2, "strength": "none", "connection": null },
    { "candidate": 3, "strength": "weak", "connection": null }
  ]
  ---

  Only "strong" passes. JSON parse failure → retry once → skip (graceful degradation).

Stage 3 — Inject into prompt:
  <industry_context>
    Connection: [one sentence from cross-encoder]
    You built this. The industry is discussing what you already practice.
  </industry_context>

After injection:
  → increment_content_match(article_id, source_id) — atomic SQL function

Stage 4 — Persist match metadata on draft creation:
- Owner: `src/worker/process-job.ts`, not `src/content/matcher.ts`
- When `IndustryMatch` exists, write these fields on the initial `voice_posts` insert:
  - `context_status = 'matched'`
  - `has_industry_context = TRUE`
  - `matched_article_id = industryMatch.articleId`
  - `matched_source_id = industryMatch.sourceId`
  - `match_strength = industryMatch.matchStrength`
  - `match_connection = industryMatch.connection`
- If matching was attempted but no strong match exists, write:
  - `context_status = 'no_match'`
  - `has_industry_context = FALSE`
  - `matched_article_id = NULL`
  - `matched_source_id = NULL`
  - `match_strength = NULL`
  - `match_connection = NULL`
- If matching was intentionally skipped because `industry_context_preference='avoid'` and this draft was not selected for a probe, write:
  - `context_status = 'skipped'`
  - `has_industry_context = FALSE`
  - `matched_article_id = NULL`
  - `matched_source_id = NULL`
  - `match_strength = NULL`
  - `match_connection = NULL`
- If the matcher fails before returning a result, keep `context_status = NULL`, log `content.match.skipped`, and do not fabricate a preference signal
- This happens at draft creation time, not at publish time. Phase 3 scanners read these persisted fields later; they do not backfill them.
  → log content.match.result (sha, candidates_found, strong_matches, matched_article_url)
```

---

## Database Schema (Phase 2 additions)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

content_sources         — RSS registry, trust, status, quality/value/health stats
content_items           — classified articles, summary, insights, quality_score
article_chunks          — chunk_text + embedding vector(1536), HNSW index
content_pipeline_runs   — one row per weekly CRON run, full stats for trend analysis

-- pgvector similarity search RPC
CREATE OR REPLACE FUNCTION match_article_chunks(
  query_embedding vector(1536),
  similarity_threshold FLOAT,
  match_count INT,
  min_quality_score INT,
  week_of_cutoff DATE
) RETURNS TABLE(content_item_id UUID, similarity FLOAT) ...

-- Atomic match counter increment RPC
CREATE OR REPLACE FUNCTION increment_content_match(
  p_article_id UUID,
  p_source_id UUID
) RETURNS void ...
```

Content expires: `DELETE WHERE week_of < NOW() - 45 days` (monthly cleanup CRON).

---

## Phase 2 — Implementation Order

| # | Step | Dependencies | Files |
|---|------|-------------|-------|
| 0 | AI agnosticism + secrets | none | `src/ai/types.ts`, `anthropic-adapter.ts`, `openai-embedder.ts`, `factory.ts`, `post-generator.ts`, `process-job.ts`, `main-poll.ts`, `config/schema.ts` |
| 1 | Source registry + content schema + pgvector | none | `database/schema.sql`, `src/content/types.ts` |
| 2 | RSS auto-discovery | none | `src/content/rss-discovery.ts` |
| 3 | **Spike: extraction feasibility** (gate >= 80%) | none | spike script — test 30 curated URLs |
| 4 | OPML importer + discover workflow | 1 + 2 | `src/content/opml-importer.ts`, `discover-sources.yml` |
| 5 | RSS fetcher | 1 | `src/content/rss-fetcher.ts` |
| 6 | Dedup (exact hash + fuzzy) | 3 | `src/content/dedup.ts` |
| 7 | Pre-skip + structural filter + top 3/source | 6 | `src/content/structural-filter.ts` |
| 8 | AI classifier (Haiku Batch API) | 0 + 7 | `src/content/classifier.ts` |
| 9 | Chunker | 3 | `src/content/chunker.ts` |
| 10 | Embedder + chunk storage (OpenAI Batch API) | 0 + 9 | `src/content/embedder.ts`, `content-storage.ts` |
| 11 | Matcher Stage 1 (pgvector, dedup by article, `MatcherOptions.stage1Threshold` default `0.75`) | 10 | `src/content/matcher.ts` |
| 12 | Matcher Stage 2 (cross-encoder, batched prompt) | 11 | `src/content/matcher.ts` |
| 13 | Prompt injection + generatePosts signature | 12 | `src/ai/prompt-builder.ts`, `post-generator.ts` |
| 14 | Observability (pipeline_runs table + health report) | 1 | `database/schema.sql`, `health-reporter.ts` |
| 15 | Source lifecycle evaluator | 1 + 12 + 14 | `src/content/source-evaluator.ts` |
| 16 | Weekly + monthly CRONs | all | `content-fetch.yml`, `content-cleanup.yml` |

Steps 0, 1, 2, 3 are independent — can be implemented in parallel.
Step 3 is a gate: if extraction < 80% on curated sources, stop and revise before continuing.
`MatcherOptions.stage1Threshold` is a Phase 2 prerequisite for any later phase that wants to tune Stage 1 recall without refactoring the matcher signature.

---

## Cold Start Corpus — Launch Prerequisite

**This is a launch prerequisite, not a nice-to-have.**

The weekly pipeline needs 8–12 weeks before the corpus produces reliable matches. The first users to install devcast at launch would see zero industry context for their first 3 months. They would never know Phase 2 exists.

**Two-track strategy:**

**Track A — Automated pipeline (starts now, takes ~3 months):**
1. Run `discover-sources.yml` immediately after merging `feat/content-intelligence`
2. Let the weekly CRON accumulate articles — 50/week → ~600 after 12 weeks
3. Source lifecycle evaluator takes effect after month 2

**Track B — Pre-curated seed corpus (200 articles, manually selected, run once):**

A manually curated set of 200 high-quality engineering articles, pre-embedded and inserted directly into `content_items` + `article_chunks`. This corpus is available to match against from day one.

**Why 200 articles solves the cold start:**
- 200 curated articles × ~5 chunks = ~1,000 chunks in pgvector before launch
- Curated = quality_score >= 7, hand-picked from known sources (Netflix, Stripe, Cloudflare, Martin Fowler, etc.)
- Covers the main technical domains devcast detects: observability, security, API design, performance, architecture
- Match rate from week 1, not month 3

**How to build the seed corpus:**

No automation needed. A one-time script:

```typescript
// scripts/seed-corpus.ts
// Input: seed-articles.json — array of
// { url, title, source_name, text, quality_score, seed_modules: string[] }
// Steps:
// 1. INSERT into content_items (week_of = '2026-01-01', source_id = seed_source_uuid)
// 2. chunk each article
// 3. embed each chunk via OpenAI real-time (not batch — one-time operation)
// 4. INSERT into article_chunks
```

**Seed source:** Create one `content_sources` row with `name='curated-seed'`, `trust='curated'`, `status='active'`, `is_protected=TRUE`. All seed articles reference this source. `is_protected=TRUE` prevents the lifecycle evaluator from ever moving this source to probation or disabled — it is a permanent fixture in the corpus, not subject to the quality lifecycle rules.

**Who selects the 200 articles:** Liliana, manually. Criteria:
- Real production war stories
- Has metrics or concrete numbers
- Published in last 2 years
- From domains matching devcast's 24 modules

> **Recency vs 45-day expiry conflict:** Seed articles are inserted with `week_of = '2026-01-01'`
> (a static backdated value). The monthly cleanup CRON deletes rows where
> `week_of < NOW() - 45 days` — which would immediately delete all seed articles.
> **Fix required:** The cleanup CRON must skip articles from sources with `is_protected=TRUE`.
> Without this guard, the seed corpus is wiped on the first cleanup run.
> This is a **[REQUIRED BEFORE LAUNCH]** item.

> **Module coverage:** The 200 articles should cover all 24 analysis modules with at least
> 3 articles each (8 per category minimum). Without coverage breadth, matches will be
> concentrated on a few modules and users in underrepresented domains will never see
> industry context. Verify coverage before seeding: manually tag each article with the
> module(s) it covers, persist those tags in `content_items.seed_modules`, and confirm no
> module has zero articles.

**Pre-launch corpus checklist:**
```
[ ] feat/content-intelligence merged to trunk
[ ] SQL migration run in Supabase (pgvector + 4 tables + RLS + is_protected column on content_sources)
[ ] OPENAI_API_KEY injected in Cloud Run jobs + GitHub Actions
[ ] 200 articles selected → seed-articles.json written
[ ] Coverage verified: each of 24 modules has >= 3 seed articles tagged
[ ] scripts/seed-corpus.ts run → verify 200 rows in content_items + ~1000 in article_chunks
[ ] Cleanup CRON updated: skip content_items from sources WHERE is_protected = TRUE
[ ] discover-sources.yml dispatched manually → RSS sources queued
[ ] content-fetch.yml dispatched manually → first automated batch
[ ] Weekly schedule confirmed active (Sunday 10:00 UTC)
[ ] Manual test: push a commit → verify match is found from seed corpus
```

**Accumulation timeline (with seed corpus):**
- Day 1 (launch): ~1,000 chunks = protected seed corpus only. Matches available immediately.
- Week 4: ~2,000 chunks = ~1,000 protected seed + (4 weeks × ~250 automated chunks/week). No automated cleanup should have fired yet because the 45-day expiry window has not been reached.
- Month 3: gross automated production is ~12 weeks × ~250 chunks/week = ~3,000 automated chunks, but non-protected content older than 45 days is removed by the monthly cleanup CRON.
  Retained total should therefore fluctuate around ~2,500-3,000 chunks:
  - ~1,000 protected seed chunks (never expired)
  - ~1,500-2,000 recent automated chunks (roughly 6-8 weeks retained, depending on where the 15th-of-month cleanup lands)

Math note:
- without cleanup, Month 3 would be ~4,000 chunks total (= 1,000 seed + 3,000 automated)
- the lower retained range exists only because cleanup removes old non-protected batches after day 45
- the old Week 4 `~1,200` figure was incorrect because it mixed protected-seed assumptions with a post-cleanup corpus size that cannot exist that early

---

## CRONs (Phase 2)

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `discover-sources.yml` | 1st and 15th of month, 12:00 UTC | Fetch OPML from 2 repos, discover RSS, add to registry |
| `content-fetch.yml` | Sunday 10:00 UTC | Full weekly pipeline |
| `content-cleanup.yml` | 15th of month, 12:00 UTC | Expire old articles + evaluate source lifecycle |

---

## Costs (Full Stack — Phase 1 + Phase 2, steady state)

### AI costs — variable per commit

| Operation | Cost/commit |
|-----------|-------------|
| Post generation (Sonnet) | ~$0.006 |
| Cross-encoder match (Haiku real-time) | ~$0.005 |
| Embed finding for matching (OpenAI real-time) | ~$0.00007 |
| **Total per interesting commit** | **~$0.011** |

### AI costs — fixed weekly (global, shared across all users)

| Operation | Cost/week |
|-----------|-----------|
| Classify ~120 articles (Haiku Batch, 50% off) | ~$0.16 |
| Embed ~250 chunks (OpenAI Batch, 50% off) | ~$0.001 |
| **Total weekly fixed** | **~$0.16/week (~$0.69/month)** |

### Infrastructure costs (GCP, monthly estimate)

| Resource | Estimate | Notes |
|----------|----------|-------|
| Cloud Run — webhook service | ~$0 | Scales to zero. Free tier covers ~2M req/month |
| Cloud Run — worker job (15 min × 24h × 30d = ~2,900 runs) | ~$0–2 | ~200ms per run, minimal CPU. Free tier likely covers it |
| Cloud Run — scanner job (12 runs/day × 30d = ~360 runs) | ~$0 | Same |
| Cloud Run — GitHub Actions CRONs (content) | ~$0 | Billed to GitHub Actions minutes (free tier for public repo) |
| Artifact Registry — Docker image storage | ~$0.10 | One image, ~500MB |
| Cloud Scheduler — 3 jobs | $0.10 | First 3 jobs/month free; scales by number of jobs |
| Supabase (free tier) | $0 | Up to 500MB DB, 1GB vector. Upgrade ~$25/month at 50+ active tenants |
| pgvector index — HNSW on 250 chunks/week | ~$0 | Grows slowly. ~1MB/1,000 chunks at 1536 dims |
| Network egress — outbound to GitHub/Anthropic/OpenAI | ~$0.01 | Low volume |
| **Total infra/month (alpha)** | **~$0.20–2.50** | Dominated by Supabase upgrade trigger |

### Unit economics at scale

| Users | Posts/month | AI (variable) | AI (fixed) | Infra | Total | Revenue @$5/user | Margin |
|-------|-------------|--------------|-----------|-------|-------|-----------------|--------|
| 10 | 100 | $1.10 | $0.69 | $0.50 | $2.29 | $50 | 95% |
| 100 | 1,000 | $11.00 | $0.69 | $3.00 | $14.69 | $500 | 97% |
| 1,000 | 10,000 | $110.00 | $0.69 | $30.00 | $140.69 | $5,000 | 97% |

**Cost risks not in the table above:**
- Supabase upgrade ($25/month) triggers at ~50 active tenants with non-trivial voice history
- Scanner failures causing retry storms (Buffer 429 loops) — mitigated by `withRetry()` backoff
- OpenAI embedding failures mid-batch requiring re-submission (partial cost duplication)
- High-commit-rate tenant with no daily cap — 100 commits × $0.011 = $1.10/day for one user. Mitigated by `MAX_DAILY_POSTS_PER_AUTHOR = 2` (once implemented) — only 2 Sonnet calls/day/author. But the module pipeline and GitHub API calls still run for all commits before the cap stops post generation. Full fix requires author-level early exit at job claim time (Open Questions).

---

## Observability (Phase 2)

Four questions the system must answer:
1. **Is the pipeline working?** — did the CRON run, did articles get stored?
2. **Is the data quality good?** — are we storing useful articles or junk?
3. **Are we always discarding the same things?** — wasted sources, wasted budget?
4. **Are we improving?** — do matches increase over time, do posts with context perform better?

### Structured logs

```typescript
// End of content-fetch.yml run:
logger.info('content.fetch.summary', {
  sources_active, sources_queued, sources_promoted,
  articles_fetched, articles_extracted, extraction_failures,
  articles_deduped, articles_preskipped, articles_structural,
  articles_classified, classify_json_errors,
  articles_stored, chunks_embedded,
  avg_quality_score, score_distribution,  // {"1-3": 5, "4-6": 30, "7-8": 12, "9-10": 3}
});

// End of content-cleanup.yml run:
logger.info('content.cleanup.summary', {
  articles_expired, sources_to_probation, sources_disabled, sources_unreachable,
});

// Per-commit matching:
logger.info('content.match.result', {
  sha: string,
  findings_count: number,
  candidates_found: number,
  strong_matches: number,
  match_skipped: boolean,
  matched_article_url: string | null,
});
```

### Weekly health report

At end of each content-fetch run, compare this week vs last 4 weeks average:

```typescript
logger.info('content.health.report', {
  articles_stored_trend: compare(thisWeek.stored, avg4weeks.stored),   // ↑ ↓ →
  avg_quality_trend: compare(thisWeek.avgQuality, avg4weeks.avgQuality),
  match_rate_trend: compare(thisWeek.matchRate, avg4weeks.matchRate),
  zero_stored: thisWeek.stored === 0,
  quality_dropping: thisWeek.avgQuality < avg4weeks.avgQuality - 1,
  no_matches_4_weeks: last4weeks.every((w) => w.commits_with_match === 0),
  wasted_sources: topSourcesByWaste(3),  // classified many, stored few
});
```

### The metric that matters — does industry context improve posts?

**Why the LIKE approach is wrong:**

Detecting `ai_draft LIKE '%industry_context%'` is fragile and analytically undefined:
- It only works if the injected tag literally appears in the persisted text.
- It cannot survive prompt refactoring.
- It conflates "context was injected" with "context appeared in output".
- It provides no signal about match quality or which source drove the improvement.

**Correct approach — explicit flags on `voice_posts`:**

These columns must be added to `voice_posts` as part of Phase 2 finalization (see DB schema gaps):

| Column | Set when |
|--------|----------|
| `context_status` | `'matched'` when strong context was injected, `'no_match'` when matching was attempted but no strong candidate won, `'skipped'` when matching was intentionally skipped by preference logic |
| `has_industry_context` | `matchFindingsToArticles()` returns a strong match |
| `matched_article_id` | same — FK to `content_items` |
| `matched_source_id` | same — FK to `content_sources` |
| `match_strength` | cosine similarity score of winning match |
| `match_connection` | one-sentence connection returned by the cross-encoder for the winning strong match |

`process-job.ts` writes these fields on draft creation. The matcher returns the data, but does not persist it. `context_status='skipped'` is a deliberate product decision, while `NULL` remains reserved for historical rows or technical failures.

**The correct query:**

```sql
SELECT
  has_industry_context AS with_context,
  COUNT(*) AS posts,
  AVG(edit_ratio) AS avg_edit_ratio,
  AVG(engagement_score) AS avg_engagement,
  AVG(match_strength) FILTER (WHERE has_industry_context) AS avg_match_strength
FROM voice_posts
WHERE status = 'published'
GROUP BY has_industry_context;
```

Interpretation:
- `edit_ratio` higher for `with_context=TRUE` → user edits less → feature adds value
- `edit_ratio` lower for `with_context=TRUE` → user is removing the reference → cross-encoder threshold too low or prompt injection poorly worded
- `avg_match_strength` trending down → bi-encoder threshold needs tuning (too many weak matches passing Stage 1)

This query runs in the monthly cleanup CRON and logs the result.

### Alerting (V1 — log-based, no external service)

| Condition | Severity | Log key |
|-----------|----------|---------|
| `articles_stored === 0` for 2 consecutive weeks | Error | `content.pipeline.stale` |
| `avg_quality_score` drops > 1 point week-over-week | Warn | `content.quality.degrading` |
| `commits_with_match === 0` for 4 consecutive weeks | Warn | `content.matches.dry` |
| `extraction_failures > 50%` of fetched | Error | `content.extraction.failing` |

No PagerDuty, no Slack in V1. External monitoring deferred to V2 when paying users justify cost.

---

## Known Tradeoffs (Phase 2)

1. Weekly fetch lag — major post on Monday available Sunday. Accepted.
2. 45-day content expiry — evergreen articles are lost. Goal is "discussing NOW", not historical reference. Evergreen content (e.g. foundational architecture posts) that remains useful beyond 45 days is a future phase feature — requires a `is_evergreen` flag on `content_items` and a separate retention policy. Not in scope for Phase 2.
3. Global content pool — same articles for all tenants. Personalization happens at matching stage via finding-specific embeddings, not at classification stage.
4. Batch onboarding 20 sources/week — full coverage takes ~3 months. Avoids cost explosion on week 1.
5. `vector(1536)` tied to OpenAI `text-embedding-3-small`. Switching provider = schema migration + re-embed (~$0.06 for full corpus). Rare, accepted.
6. Embedding in critical path — if OpenAI call fails, matching skipped entirely. Post generates without context. Graceful degradation, not crash.
7. Two AI providers (Anthropic + OpenAI). Two API keys, two cost centers. `IEmbedder` interface makes switching trivial.
8. Extraction failure rate ~10-15%. JS-rendered content, paywalls, anti-bot. Skipped, not retried. Extraction failures never count as source quality failures.
9. `content_text` stored in full (~1KB–10KB per article × 3000/year = ~15MB/year). Enables re-classification without re-extraction if source URL changes or goes offline. Accepted.
10. Batch API timeout — if batch doesn't complete in 2h, CRON exits, retries next week. Expected to never happen for ~120 requests but plan exists.
11. Top 3/source cap — prolific sources that publish > 3 articles/week only get their best 3 classified. Structural score selects most analytically dense. Remaining discarded.
12. `matched_count` cold start — takes 3+ months to be useful (requires `articles_passed >= 20`). Mitigated by requiring sufficient sample before evaluating.
13. JSON parse failures from LLM (~2-5%) — retry once, then skip. Real loss ~0.1%. Not a source quality failure.
14. No user feedback on match quality — `matched_count` tracks that a match happened, not whether user found it useful. `edit_ratio` is the closest proxy (if user removes the reference before publishing, edit_ratio drops). Explicit feedback requires UI, deferred to V2.
15. AI quality_score is non-deterministic — same article can score 6 or 7 on different runs. Gate at 6 prefers false positives over false negatives. Cross-encoder is the real quality gate.

---

---

# Phase 3 — Voice Profile + Content Strategy System

**Status:** Design revised after voice review. Not yet implemented.
**Branch target:** `feat/voice-profile`

---

## Goal

Phase 3 is no longer only "learn how this developer writes."

It must learn both:
- **voice** — how they write
- **strategy** — what they want to publish, for whom, and what to avoid

The product goal is not merely "generate posts that sound like me." The goal is
"generate the posts I would actually publish."

---

## Scope

**In scope:**
- Per-developer voice profiles (`voice_profiles`, keyed by `github_author_login`)
- 3-tier fallback: extracted patterns → tone/rhythm defaults → baseline
- Runtime `voice_history` selection with explicit quality rules
- `ContentStrategy` in onboarding and `/settings/voice`
- `edit_analysis` on published posts
- Negative feedback via `status='expired'`
- Structured extractor input for published-post refresh
- Derived `content_preferences` from publish/expire behavior
- Tone-specific post structure
- Human-readable `voice_summary` for UI

**Out of scope:**
- Org-wide brand templates
- Voice inheritance trees beyond tenant default → author override
- Per-repository voice profiles
- Explicit thumbs-up/down UI on drafts
- Per-post voice confidence score ("87% aligned with your voice")
- Commit-selection explainability UI ("selected because architecture_patterns scored 8.5")

---

## Core Principle

devcast replicates voice. It does not correct it.

If a developer uses emojis, short sentences, "I'm excited", ironic hooks, or a highly
personal opener, the extractor should capture that and the prompt should preserve it.
Hard rules exist only for broken output or platform-hostile artifacts.

---

## Individual Voice, Always

The app install (tenant) is a billing and access unit, not a voice unit.

**Effective lookup chain (storage + caller):**
```typescript
1. voice_profiles WHERE tenant_id = X AND github_author_login = commit.authorLogin
2. voice_profiles WHERE tenant_id = X AND github_author_login IS NULL
3. DEFAULT_VOICE_PROFILE
```

**Storage contract (`src/voice/storage.ts`):**
```typescript
interface StoredVoiceProfile {
  voice: VoiceProfile;
  version: number;
}

interface IVoiceStorage {
  getVoiceProfile(
    tenantId: string,
    authorLogin: string | null,
  ): Promise<StoredVoiceProfile | null>;
}
```

Contract rules:
- `getVoiceProfile()` performs only DB lookup steps 1 and 2 from the chain above:
  - first try `github_author_login = authorLogin`
  - then try `github_author_login IS NULL` for the tenant default
- if neither row exists, return `null`
- it must **not** apply `DEFAULT_VOICE_PROFILE` internally. The caller owns that fallback via `?? DEFAULT_VOICE_PROFILE`
- it must return `version` together with `voice` in the same read, so callers do not need a second query before optimistic-lock updates
- cache semantics are intentionally not part of the contract. Per-job memoization is allowed as an implementation detail, but callers must behave correctly without assuming a cache

**Who gets a profile:**
- Individual install: onboarding creates one profile for `tenant.github_username`
- Org install: onboarding creates the installing user's profile; other members use `/settings/voice`
- Until a member configures theirs, they fall through to tenant default or Tier 3

`authorLogin` already exists in `EnrichedCommit` (`src/github/commit-enricher.ts:10`).

### `/settings/voice` — Org member setup

**URL:** `GET /settings/voice` (GitHub OAuth session)

**Who can use it:** Any GitHub user with a real commit attributed to them for this tenant.
This is a practical V1 gate, not a perfect authorization model.

**Open auth limitation:** `commit.authorLogin` is a membership proxy, not a verified
current-org-membership check. Before Phase 3 auth hardening, decide whether to verify
membership via GitHub API on login or accept the proxy for V1.

**What the page shows:**
1. Current voice summary and tier
2. Content strategy controls
3. Tone/rhythm/hashtags/post-length controls
4. Bootstrap textarea
5. Save button that re-runs extraction if bootstrap changed

---

## Data Model

### `voice_profiles` table

```sql
CREATE TABLE IF NOT EXISTS voice_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id),
  github_author_login  TEXT,                         -- NULL = tenant default
  voice                JSONB NOT NULL DEFAULT '{}',
  version              INTEGER NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_voice_profiles_tenant_default
  ON voice_profiles(tenant_id)
  WHERE github_author_login IS NULL;

CREATE UNIQUE INDEX idx_voice_profiles_tenant_author
  ON voice_profiles(tenant_id, github_author_login)
  WHERE github_author_login IS NOT NULL;
```

`tenants.config.voice` remains deprecated and is lazily migrated on first access.
`tenants.voice_bootstrap` stays as raw user input. Extracted output lives in `voice_profiles.voice`.

### `VoiceProfile` JSONB contract

```typescript
interface ContentStrategy {
  focus_modules?: string[];   // undefined or [] = all modules allowed
  audience: 'peers' | 'hiring-managers' | 'general-tech' | 'mixed';
  skip_patterns: string[];    // case-insensitive phrases with explicit scope rules; matched before generation
}

type HookStyle =
  | 'question'
  | 'statistic'
  | 'anecdote'
  | 'declarative'
  | 'contradiction'
  | 'problem-first';

interface ContentPreferences {
  preferred_modules?: string[];
  discouraged_hook_styles?: HookStyle[];
  typical_length_delta?: number;
  industry_context_preference?: 'prefer' | 'neutral' | 'avoid';
  expired_rate_30d?: number;
  updated_at?: string;
}

interface VoiceProfile {
  tone: 'formal' | 'professional' | 'casual' | 'humorous' | 'storytelling' | 'teaching';
  rhythm: 'paragraphs' | 'mixed' | 'short-sentences';
  hashtags: string[];
  hashtags_mode: 'always' | 'prefer';
  post_length: { min: number; max: number };
  content_strategy: ContentStrategy;

  style_patterns?: string;               // <= 400 chars, always in English. Mechanics: rhythm, density, sentence length, punctuation, paragraphing.
  voice_devices?: string;                // <= 300 chars, always in English. Signature openers, closers, analogies, recurring rhetorical moves, catchphrases.
  voice_summary?: string;                // <= 200 chars, UI only
  extraction_source?: 'bootstrap' | 'published_posts';
  extracted_at?: string;                 // cursor for refresh threshold, not a lock

  content_preferences?: ContentPreferences;  // derived from publish/edit/expire outcomes
}

const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  tone: 'professional',
  rhythm: 'mixed',
  hashtags: [],
  hashtags_mode: 'prefer',
  post_length: { min: 1200, max: 1800 },
  content_strategy: {
    audience: 'mixed',
    skip_patterns: [],
  },
};
```

**Validation rules:**
- `post_length.min >= 300`
- `post_length.max <= 3000`
- `min < max`
- `hashtags.length <= 10`
- `style_patterns <= 400 chars`
- `voice_devices <= 300 chars`
- `voice_summary <= 200 chars`
- `content_strategy.focus_modules` must be a subset of `MODULE_REGISTRY`
- `content_strategy.audience` is always manual. The extractor must not infer, override, or silently rewrite it.

### `computeEditRatio()` contract

`edit_ratio` is the core quality signal for published posts and must be computed consistently everywhere.

Algorithm:
1. Lowercase both strings
2. Replace punctuation with spaces (keep alphanumerics and common Spanish accented characters)
3. Split into tokens on whitespace
4. Count shared token frequency
5. Return `shared_tokens / max(draft_tokens, published_tokens)`

This is a word-overlap ratio, not Levenshtein distance.

```typescript
edit_ratio =
  shared_token_count(ai_draft, published) /
  max(token_count(ai_draft), token_count(published))
```

Edge cases:
- both empty → `1.0`
- one empty, one non-empty → `0.0`

### `edit_analysis` on `voice_posts`

Stored in `voice_posts.edit_analysis` JSONB after a sent post is matched:

```typescript
interface EditAnalysis {
  hook_changed: boolean;
  closing_changed: boolean;
  length_delta: number;            // published.length - ai_draft.length
  hashtags_kept_ratio: number;     // 0.0 - 1.0
  industry_context_removed: boolean;
  edit_type: 'polish' | 'restructure' | 'rewrite';
}
```

`edit_type` meaning:
- `polish`: `edit_ratio >= 0.85`
- `restructure`: `edit_ratio >= 0.60 && edit_ratio < 0.85`
- `rewrite`: `edit_ratio < 0.60`

Algorithm definitions:
- `hook` = first paragraph (`text` up to first double newline). If no double newline exists, use the first sentence. In both cases, cap at the first 280 characters.
- `closing` = last paragraph (`text` after the last double newline). If no double newline exists, use the last sentence. In both cases, cap at the last 280 characters.
- `hook_changed = computeEditRatio(hook_draft, hook_published) < 0.50`
- `closing_changed = computeEditRatio(closing_draft, closing_published) < 0.50`
- `length_delta = published.length - ai_draft.length`
- `suggested_hashtags = extractHashtags(ai_draft)` using regex `/(?<=^|\\s)#[A-Za-z0-9_]+/g`
- `kept_suggested_hashtags` = hashtags extracted from `ai_draft` that also appear in `published`, compared case-insensitively after lowercasing
- `hashtags_kept_ratio = kept_suggested_hashtags / max(suggested_hashtags, 1)`
- `industry_context_removed = false` when `has_industry_context = false` or `match_connection IS NULL`
- otherwise, normalize `match_connection` and `published` with the same tokenizer as `computeEditRatio()`
- if normalized `match_connection` has fewer than 6 tokens, set `industry_context_removed = false` and log `voice.edit_analysis.context_anchor_too_short`
- otherwise, compute:

```typescript
const anchorRetention =
  shared_token_count(match_connection, published) /
  token_count(match_connection);

industry_context_removed = anchorRetention < 0.50;
```

**Why `0.50` for hook/closing instead of `0.70`:** `computeEditRatio()` is word-overlap based. On short spans like hooks and closings, synonym swaps and sentence reordering drop overlap faster than on full posts. The lower threshold reduces false positives while still catching meaningful rewrites.

Short-span guardrail:
- if either hook span has fewer than 5 tokens after normalization, set `hook_changed = false`
- if either closing span has fewer than 5 tokens after normalization, set `closing_changed = false`
- rationale: overlap on 1-4 token spans is too unstable (`"Ship it."` vs `"Let's go."` becomes a false full rewrite)
- skipped short spans still contribute to the overall `edit_ratio`, but they do not count as hook/closing rewrites for Loop 4 statistics

---

## Onboarding And `/settings/voice`

The existing onboarding flow gains three sections, in this order.

### Section 1 — "What should devcast publish about?"

**Module focus:** checkbox grid grouped by category. Default = all selected.

Examples:
- Architecture: `architecture_patterns`, `design_patterns`
- Quality: `clean_code`, `testing`, `error_resilience`
- Platform: `performance`, `security`, `observability`, `devops`
- Language / framework: `react_patterns`, `js_advanced`, `python`, `go`, `java_quarkus`, `elixir`

**Audience** (radio, default `mixed`):
- `peers`
- `hiring-managers`
- `general-tech`
- `mixed`

**Never publish** (textarea):
- Examples: "Do not mention clients", "Do not post about private repos", "Avoid production metrics"
- Stored as `content_strategy.skip_patterns`

### Section 2 — "How do you sound?"

Existing Tier 2 controls:
- Tone
- Rhythm
- Hashtags
- Hashtag mode
- Post length

### Section 3 — "Your voice"

Existing bootstrap textarea:
> "Paste 1-5 posts you've written and are proud of. This is the fastest way to make devcast sound like you from day one."

**Post-save behavior:**
- If bootstrap changed, run extractor
- Rebuild `voice_summary`
- No redirect; show summary inline below the textarea

The same three-section layout is reused in `/settings/voice` for org members.

---

## Content Strategy In The Commit Pipeline

Strategy is applied before any Claude generation.

```typescript
const storedVoice = await storage.getVoiceProfile(tenantId, commit.authorLogin);
const voiceProfile = storedVoice?.voice ?? DEFAULT_VOICE_PROFILE;

const filteredFindings = filterByContentStrategy(
  findings,
  commit,
  voiceProfile.content_strategy,
);

if (filteredFindings.length === 0) {
  return; // skip commit, no Claude call
}
```

`filterByContentStrategy()` rules:
1. If `focus_modules` is configured, drop findings whose `moduleId` is not listed
2. `skip_patterns` are matched with explicit scope rules:

Minimal commit shape required by this filter:

```typescript
interface StrategyCommitView {
  authorLogin: string | null;
  repo: string; // e.g. "owner/repo"
  diffs: Array<{
    filename: string;
  }>;
}
```

`filterByContentStrategy()` and `matchesSkipPattern()` depend only on this view of
`EnrichedCommit`. Callers may pass the full `EnrichedCommit`, but implementations must not
assume fields like `repository.full_name`, `files`, or other GitHub REST shapes.

```typescript
function matchesSkipPattern(
  pattern: string,
  commit: StrategyCommitView,
  findings: Finding[],
): boolean {
  const p = pattern.trim().toLowerCase();

  if (p.startsWith('repo:')) {
    return commit.repo.toLowerCase().includes(p.slice(5).trim());
  }

  if (p.startsWith('file:')) {
    return commit.diffs.some((f) => f.filename.toLowerCase().includes(p.slice(5).trim()));
  }

  return findings.some((f) =>
    f.finding.toLowerCase().includes(p) ||
    f.plainLanguage.toLowerCase().includes(p),
  );
}
```

Rules for implementers:
- Matching is case-insensitive substring matching
- No regex support in V1
- Unprefixed patterns DO NOT match repo names, commit messages, filenames, or raw matched article text
- Use `repo:` and `file:` prefixes to opt into those scopes

3. If any `skip_patterns` match, skip the commit entirely
4. If no findings remain after filtering, skip generation

**Audience affects prompting, not selection:**

```xml
<audience>
You are writing for {audience_description}.
</audience>
```

Audience mapping:
- `peers`: assume deep technical context, skip basics
- `hiring-managers`: emphasize decisions, ownership, impact, and reasoning
- `general-tech`: explain significance without stack-specific assumptions
- `mixed`: balanced default

Audience is always manually selected by the user. The extractor may describe tone or rhetorical style, but it must never infer or overwrite `content_strategy.audience`.

---

## Runtime `voice_history` Selection

> **Replaced by voice-system-spec.md** — §Voice Exposure (pool management, example selection, deduplication).
> The `edit_ratio >= 0.70` gate and top-5 recency selection below are superseded by the progressive exposure pool when `voice.voice_moves` is present. Keep reading for legacy behavior (authors without `voice_moves`) and for the Loop 2/3/4 definitions that remain unchanged.

`voice_history` remains the primary per-post quality driver, but it is now fully specified.

**Phase 3 prerequisite:** this query is only valid once `voice_posts.author_login` is persisted for every generated draft. Without that column, org installs would mix multiple developers' voices in the same example pool. `top_module_id` must also be persisted before module diversification can work.

**Source pool:**
```sql
SELECT *
FROM voice_posts
WHERE tenant_id = $1
  AND author_login = $2
  AND platform = $3
  AND status = 'published'
  AND edit_ratio >= 0.70
ORDER BY published_at DESC;
```

Loop 1 extractor refresh must use the same quality gate as this source pool, with `LIMIT 15`.
If fewer than 5 rows remain after filtering, do not refresh the voice profile and log `voice.extractor.insufficient_signal`.

**Selection algorithm:**
1. Start from published posts only
2. Exclude `status='expired'`, drafts, queued rows, and anything below `edit_ratio 0.70`
3. Prefer the most recent posts
4. Cap at **2 posts per `top_module_id`**
5. Take **up to 5 posts maximum**

**Why these rules exist:**
- Published text is the only approved output
- `edit_ratio >= 0.70` filters out drafts the developer mostly rewrote
- Platform matching avoids using short-form Instagram phrasing as LinkedIn examples
- Module diversity prevents the prompt from overfitting to one repeated topic

**What goes into the prompt:**
- `published` text only
- When `edit_ratio = 1.0`, mark the example as strongest signal because the developer approved it unchanged

**Example payload:**
```xml
<examples>
  <example signal="exact" module="testing">
    ...
  </example>
  <example signal="approved" module="architecture_patterns">
    ...
  </example>
</examples>
```

If no qualifying examples exist, omit the block entirely and rely on Tier 1 or Tier 2 instructions.

---

## 3-Tier Voice System

> **Replaced by voice-system-spec.md** — §Progressive Voice System (Stages 0–3), §Prompt builder integration.
> The 3-tier fallback below (Tier 1 `style_patterns` → Tier 2 `TONE_INSTRUCTIONS` → Tier 3 baseline) is the legacy path used when `voice.voice_moves` is absent. When `voice.voice_moves` is present, `buildProgressiveVoiceBlocks()` takes over entirely. At Stage 3, `TONE_INSTRUCTIONS`, `RHYTHM_INSTRUCTIONS`, and `STRUCTURE_MAP` are all dropped — voice exposure examples and dice rolls encode the actual voice.

**`buildSystemPrompt()` in this section [REPLACES CURRENT].**
The prompt-builder behavior described in Implementation Status ("voice TOP + commit + findings + task BOTTOM") is the pre-Phase-3 state and must be fully replaced, not merged with this new contract.

```xml
Tier 1:
  <style>{style_patterns}</style>
  <voice_devices>{voice_devices}</voice_devices>   <!-- omit block if empty -->
  <structure>{STRUCTURE_MAP[tone]}</structure>

Tier 2:
  <voice>{TONE_INSTRUCTIONS[tone]} {RHYTHM_INSTRUCTIONS[rhythm]}</voice>
  <structure>{STRUCTURE_MAP[tone]}</structure>

Tier 3:
  <voice>Write clearly and directly. One idea per sentence. Professional but human. No filler.</voice>
  <structure>{STRUCTURE_MAP['professional']}</structure>
```

All tiers also receive:
- `<never>` hard rules
- `<preferences>` derived soft negatives from `content_preferences`
- `<audience>` strategy block
- hashtag instructions
- post-length instructions
- runtime `voice_history` examples when available
- `module_variety_hint`
- `industry_context` when matched

---

## Rule Layers

### Layer 1 — Hard rules (non-overridable)

These are platform and model-safety rules, not style opinions.

```xml
<never>
- No LinkedIn headers (**LINKEDIN**, ## LinkedIn)
- No meta-commentary or visible chain-of-thought
- No engagement-bait questions ("Thoughts?", "What do you think?")
- No code blocks
- No lead with counts or quantities (line counts, file counts, module counts)
</never>
```

### Layer 2 — Default style preferences (overridable)

Applied when the user has not expressed a contrary pattern.

- Professional tone
- Mixed rhythm
- Setup paragraphs like "Here's the context:" are discouraged, not banned
- Generic motivational phrases are discouraged, not banned
- Corporate buzzwords are discouraged, not banned
- Emojis are discouraged by default, but allowed if present in user voice
- 3-5 relevant hashtags
- 1200-1800 characters

### Layer 3 — User voice (highest priority, except explicit behavioral negatives)

Everything extracted from bootstrap or approved history overrides Layer 2.

If the developer's real voice includes emojis, setup paragraphs, short punchy fragments, or
phrases like "I'm excited", the prompt should preserve them.

### Derived preferences block — soft negatives from behavior

`content_preferences` does not belong in Layer 1 because it is learned behavior, not a hard constraint.
It is injected in a separate `<preferences>` block between `<never>` and the user voice blocks.

Example:

```xml
<preferences>
- Avoid opening with a rhetorical question
- Avoid statistic-first hooks
</preferences>
```

Override rule:
- behavioral `<preferences>` wins over conflicting extracted hook devices in Layer 3
- if Loop 4 learns "avoid rhetorical question hooks" from repeated rewrites, prompt-builder must honor that even if `voice_devices` still mentions rhetorical-question openings
- this priority applies only to the specific behavior the preference names. All other extracted voice traits in Layer 3 still win over Layer 2
- Loop 1 may later re-extract from approved published posts and converge with the learned preference, but prompt-builder must not wait for that convergence to stop repeating a rejected hook pattern

---

## Hashtag Injection

Corrected wording:

```typescript
if (hashtags_mode === 'always' && hashtags.length > 0) {
  `Include these hashtags in every post: ${hashtags.join(' ')}. Do not add others unless they replace one of these.`
} else if (hashtags_mode === 'prefer' && hashtags.length > 0) {
  `Prefer these hashtags when they fit the post: ${hashtags.join(' ')}. Use what fits. Add others if more relevant. Total 3-5.`
} else {
  `3-5 relevant hashtags. Choose based on the technical topic of the post.`
}
```

The previous wording using "exactly" plus "you may add more" is invalid and must not reappear.

---

## Tone And Structure

`STRUCTURE_MAP` from v1.4.0 stays intact. Tone still determines the narrative shape:
- `formal`: statement → context → analysis → conclusion
- `professional`: hook → context → the work → lesson → closing
- `casual`: hook → what happened → what you learned → closing
- `humorous`: ironic hook → the work → twist → closing
- `storytelling`: problem → journey → resolution → lesson → closing
- `teaching`: concept → problem it solves → concrete example → take it further → closing

Tier 1 keeps using the selected tone's structure even when style comes from extraction.

**Tone instructions — used by Tier 2:**

```typescript
const TONE_INSTRUCTIONS = {
  formal:
    'Use full sentences. No contractions. Precise language. Write as if the post will be reviewed.',
  professional:
    'Direct and confident. First-person. Human but not casual. No hedging.',
  casual:
    'Relaxed. Contractions welcome. Write like you talk to a colleague over coffee.',
  humorous:
    'Dry wit. Ironic observations. Self-aware commentary. The humor is in the observation, not the delivery. Never a punchline. Never sarcastic.',
  storytelling:
    `Narrative voice. You open with a problem that had no obvious solution — not the answer,
the friction. You walk through what you tried, what failed, what you noticed. The resolution
emerges from the journey. The reader should feel "I've been there" or "I didn't know that
was possible." The lesson is earned, not declared.`,
  teaching:
    `Pedagogical voice. You are the person who explains it simply without dumbing it down.
You do not start with the definition — you start with the situation where the absence of
this concept causes pain. You give one concrete example with real names and real outcomes.
You end with the mistake most people make or the next thing worth knowing.
The reader finishes knowing something they can apply today.`,
} as const;
```

**Rhythm instructions — used by Tier 2:**

```typescript
const RHYTHM_INSTRUCTIONS = {
  paragraphs:        'Group related ideas into paragraphs of 2–4 sentences. Flowing prose.',
  mixed:             'Vary sentence length naturally. Some short. Some longer. Feels human.',
  'short-sentences': 'One idea per sentence. Each sentence is its own line. No compression.',
} as const;
```

**Structure map — injected as `<structure>` block:**

```text
FORMAL:
  STATEMENT: One precise claim. No hedging. What the commit does, technically.
  CONTEXT: Why this exists. What problem it addresses in the system.
  ANALYSIS: What the implementation reveals — tradeoffs, constraints, decisions.
  CONCLUSION: The principle that generalizes beyond this specific change.
  CLOSING: Direct statement. One sentence.

PROFESSIONAL:
  HOOK: One concrete fact — a decision, a surprise, a tradeoff. No preamble.
  CONTEXT: 2–3 short sentences. Project name, what was happening.
  THE WORK: What changed and why. Specific details. Name files, name patterns.
  LESSON: One transferable principle. Named concept when applicable.
  CLOSING: Direct statement. Never a question.

CASUAL:
  HOOK: What happened — the surprising or interesting part first.
  WHAT HAPPENED: Walk through it as you'd tell a colleague. Informal, first-person.
  WHAT YOU LEARNED: One honest takeaway. Can be obvious-in-hindsight.
  CLOSING: Direct, short. Can be self-aware.

HUMOROUS:
  IRONIC HOOK: The contradiction, the irony, or the embarrassing truth first.
  THE WORK: What you did — with dry commentary woven in, not forced.
  TWIST: The thing that reframes the whole situation. One beat.
  CLOSING: The punchline that is also a principle. Direct. No winking.

STORYTELLING:
  PROBLEM: Open with the situation before the solution existed. Make it felt, not described.
    Not "I had a bug." More: "Three services were timing out in a cascade I couldn't explain."
  JOURNEY: What you tried. What failed. What you noticed. The reader follows your thinking.
  RESOLUTION: What actually worked — and crucially, why it worked when other things didn't.
  LESSON: What this taught you that transfers to other problems.
  CLOSING: One sentence. The principle distilled.

TEACHING:
  CONCEPT: Name the idea. One sentence. No jargon — or define the jargon immediately.
  PROBLEM IT SOLVES: The real situation where you needed it. Not the textbook definition.
    What breaks, slows down, or becomes impossible without this concept.
  CONCRETE EXAMPLE: Name the file. Name the pattern. Name the outcome.
    "In ReconciliationService.ts, replacing X with Y eliminated the N+1."
  TAKE IT FURTHER: The most common mistake with this concept, or the logical next step.
  CLOSING: Direct statement. The reader should know exactly what to do next.
```

---

## Voice Extractor (`src/ai/voice-extractor.ts`)

> **Replaced by voice-system-spec.md** — §Voice Moves Registry, §`voice-moves-calculator.ts`.
> The Haiku extraction call below is superseded by statistical move measurement (zero AI calls) when `voice.voice_moves` is present. `voice-extractor.ts` continues to exist for the legacy path. New authors use the progressive system from day one.

Haiku call. Two triggers:
1. Bootstrap changed
2. Scanner sees 5+ new published posts since `extracted_at`

Extractor output contract:

```json
{
  "style_patterns": "...",
  "voice_devices": "...",
  "summary": "..."
}
```

Field meanings:
- `style_patterns`: max 400 chars, always in English. Sentence mechanics only: rhythm, sentence length, punctuation density, paragraphing, directness, compression.
- `voice_devices`: max 300 chars, always in English. What makes the voice recognizable: signature openers, closers, analogies, recurring rhetorical moves, catchphrases, self-aware turns.
- `summary`: max 150 chars, same language as the samples, for UI only.

Why split the field:
- `style_patterns` captures how the person writes
- `voice_devices` captures what makes them sound like themselves

Without the split, a single 600-char field tends to preserve mechanics and lose the recognisable signature devices.

### Structured input for published-post refresh

The extractor must not receive raw concatenated text without metadata.
`getRecentPublished()` is a quality-gated query: it returns only `status='published'` rows
with `edit_ratio >= 0.70` and `edit_type != 'rewrite'`, ordered by `published_at DESC`.

```typescript
const recent = await getRecentPublished(tenantId, authorLogin, 15);

if (recent.length < 5) {
  logger.info('voice.extractor.insufficient_signal', {
    tenantId,
    authorLogin,
    sampleCount: recent.length,
  });
  return;
}

const structuredInput = recent
  .map((post, index) => {
    const signal =
      post.edit_ratio >= 0.85 ? 'high' :
      post.edit_ratio >= 0.70 ? 'medium' :
      'low';

    const recency = index < 5 ? 'recent' : 'older';

    return `<post signal="${signal}" recency="${recency}" module="${post.top_module_id ?? 'unknown'}">
${post.published}
</post>`;
  })
  .join('\n\n');
```

Extractor prompt requirements:
- `style_patterns`: max 400 chars, always in English
- `voice_devices`: max 300 chars, always in English
- `summary`: max 150 chars, same language as the samples
- Weight `signal="high"` more than `medium`, and `medium` more than `low`
- Prefer recent posts when patterns conflict
- Do not infer or overwrite `audience`

### Correct optimistic lock

`extracted_at` is a refresh cursor, not a lock.

Use `voice_profiles.version` as the guard:

```typescript
const storedVoice = await storage.getVoiceProfile(tenantId, authorLogin);
if (!storedVoice) return; // no DB row to refresh yet

const { voice, version } = storedVoice;
const result = await extractVoice(structuredInput);

if (!result.style_patterns || result.style_patterns.trim().length < 40) {
  logger.warn('voice.extractor.low_quality', { tenantId, authorLogin });
  return;
}

const updatedVoice = {
  ...voice,
  style_patterns: result.style_patterns,
  voice_devices: result.voice_devices?.trim() ? result.voice_devices : undefined,
  voice_summary: result.summary,
  extraction_source: source,
  extracted_at: new Date().toISOString(),
};

const { count } = await db
  .from('voice_profiles')
  .update({
    voice: updatedVoice,
    version: version + 1,
    updated_at: new Date().toISOString(),
  })
  .eq('tenant_id', tenantId)
  .eq('github_author_login', authorLogin)
  .eq('version', version);

if (count === 0) {
  logger.warn('voice.extractor.conflict', { tenantId, authorLogin });
}
```

The `version` increment is top-level. It does **not** live inside `voice` JSONB.

---

## Feedback Loops

The old loop only learned "how much was edited." Phase 3 uses four loops.

### Loop 1 — Style refresh (every 5 published posts)

> **Replaced by voice-system-spec.md** — §Feedback Loops — Loop 1 (statistical move recalculation, zero AI calls).
> The Haiku extractor input/output below is the legacy path. When `voice.voice_moves` is present, Loop 1 runs `refreshVoiceMoves()` instead: measures move frequencies against MOVES_REGISTRY, updates `voice.voice_moves` probabilities, refreshes the exposure pool, and computes `voice_summary` from move descriptions. Uses `edit_ratio >= 0.30` for pool eligibility (not 0.70 — see override table in voice-system-spec.md §What this spec replaces).

Input:
- up to 15 recent high-signal published posts (`edit_ratio >= 0.70`, `edit_type != 'rewrite'`, ordered by `published_at DESC`)
- structured with signal quality, recency, and module metadata
- minimum sample floor: if fewer than 5 posts remain after filtering, skip refresh and log `voice.extractor.insufficient_signal`

Output:
- `style_patterns`
- `voice_devices`
- `voice_summary`

### Loop 2 — Edit analysis (on every matched publication)

When the scanner finds a published post:
1. compute `edit_ratio`
2. compute `edit_analysis`
3. store both on `voice_posts`

This enables:
- better `voice_history` quality gating
- health reporting on what gets edited
- strategy tuning without another AI call

### Loop 3 — Negative feedback (`expired`)

A draft that was scheduled but never published is a negative signal.

Mark as expired when:
```sql
status = 'scheduled'
AND scheduled_at < NOW() - INTERVAL '7 days'
AND NOT matched in Buffer sent feed
AND buffer_post_id IS NOT NULL
AND the profile-level Buffer sent-feed verification confirms the post is not in a sent/published state
```

Rules:
- `expired` rows never enter `voice_history`
- `expired` rows count toward content preference analysis
- if `expired_rate_30d > 0.30`, log a warning
- if `expired_rate_30d > 0.50`, surface it in the health report
- if the Buffer check is unavailable or ambiguous, keep `status='scheduled'` and log `voice.expired.uncertain`
- verification is batched by Buffer profile, not by draft. `sent-scanner.ts` must fetch the sent feed once per profile, reuse that snapshot for both published matching and stale-draft checks, and only paginate additional pages when unresolved stale drafts remain for the same profile
- per-draft HTTP lookups by `buffer_post_id` are an incorrect implementation, even if they produce the same result
- if the shared per-profile page budget is exhausted before all stale drafts are resolved, keep the unresolved rows as `scheduled` and log `voice.expired.uncertain`

### Loop 4 — Content preferences (every 10 outcomes)

Input:
- last 20 outcomes per author (`published` + `expired`)

Derived fields stored in `voiceProfile.content_preferences`:
- preferred modules by publish rate
- discouraged hook styles if they are repeatedly rewritten
- typical length delta
- industry-context preference (`prefer` / `neutral` / `avoid`)
- 30-day expired rate

This loop is statistical only. No AI call required.

`context_status` meaning for Loop 4:
- `skipped`: matching was intentionally not attempted because the current preference was `avoid` and this draft was not selected for a probe
- `no_match`: matching was attempted, but Stage 2 produced no strong winner
- `matched`: matching was attempted, a strong winner existed, and `match_connection` was persisted
- `NULL`: historical row or matcher failure — ignore for preference derivation

`discouraged_hook_styles` uses a closed enum:
- `question`
- `statistic`
- `anecdote`
- `declarative`
- `contradiction`
- `problem-first`

Loop 4 derives these values deterministically from the draft hook, using the same `hook` extraction defined in `edit_analysis`:
- `question`: hook ends with `?`
- `statistic`: hook starts with a number, percentage, or count word
- `anecdote`: hook starts with a first-person narrative opener such as `I`, `we`, `when I`, `today I`
- `contradiction`: hook contains contrast markers such as `but`, `except`, `turns out`, `the irony`
- `problem-first`: hook contains failure/problem markers such as `bug`, `incident`, `timeout`, `error`, `outage`, `failed`
- `declarative`: fallback when none of the above match

Only add a style to `discouraged_hook_styles` when both are true in the last 10 published outcomes:
- the style appears at least 3 times
- `hook_changed = true` in at least 70% of those occurrences

`industry_context_preference` derivation uses two windows:
- `attempted_context_posts` = last 5 published posts where `context_status IN ('matched', 'no_match')`
- `matched_context_posts` = the subset of those posts where `context_status = 'matched'`
- rows with `context_status = 'skipped'` or `NULL` are excluded entirely from this derivation

Rules:
- if `matched_context_posts.length = 5` AND `industry_context_removed = true` in at least 3 of those 5 posts → `avoid`
- if `matched_context_posts.length = 5` AND `industry_context_removed = false` in all 5 posts AND average `edit_ratio >= 0.80` across those 5 posts → `prefer`
- rebound rule while current preference is `avoid`:
  - `process-job.ts` must force one probe attempt after every 4 consecutive `context_status='skipped'` drafts for that author, so every 5th otherwise-skipped draft re-tests matching
  - if `attempted_context_posts.length = 5`, no post in `matched_context_posts` has `industry_context_removed = true`, and average `edit_ratio >= 0.80` across `attempted_context_posts`, downgrade `avoid` → `neutral`
- otherwise → `neutral`

Alpha calibration note:
- rebound intentionally uses `attempted_context_posts` (`matched` + `no_match`), not only successful `matched` posts
- this means an author can exit `avoid` even if only 1 of the 5 recent attempts injected context, as long as those attempts did not degrade post quality
- keep this for alpha; if rebound proves too permissive in production, tighten it to require at least 3 of the 5 attempts with `context_status='matched'`

### Scanner author enumeration

`sent-scanner.ts` runs per tenant, but loops are evaluated per author. Author enumeration is part of the spec:

```sql
SELECT DISTINCT author_login
FROM voice_posts
WHERE tenant_id = $1
  AND author_login IS NOT NULL
  AND (
    created_at >= NOW() - INTERVAL '30 days'
    OR published_at >= NOW() - INTERVAL '30 days'
  )

UNION

SELECT github_author_login AS author_login
FROM voice_profiles
WHERE tenant_id = $1
  AND github_author_login IS NOT NULL;
```

Rules:
- this is the set of authors the scanner processes for that tenant in the current run
- recent `voice_posts` activity keeps active authors in the loop even if they do not yet have a dedicated `voice_profiles` row
- explicit per-author `voice_profiles` rows are always included so configured users continue to receive refreshes even during quiet periods
- the tenant default profile row (`github_author_login IS NULL`) is **not** treated as an author
- do **not** implement this as naive `SELECT DISTINCT author_login FROM voice_posts WHERE tenant_id = ?`, because that would keep processing ghost authors from old history every 2 hours

### Scanner execution order

Within `sent-scanner.ts`, execution order is fixed because later loops consume data produced by earlier ones:

```typescript
// In sent-scanner.ts, per tenant, per enumerated author:
// 1. Match sent posts → compute edit_ratio + edit_analysis (Loop 2)
// 2. Mark stale scheduled posts as expired (Loop 3)
// 3. If 5+ new published since extracted_at → refresh voice (Loop 1)
// 4. If 10+ new outcomes since content_preferences.updated_at → refresh preferences (Loop 4)
```

Loop 4 must run after Loops 2 and 3 in the same scanner execution. Otherwise it reads stale outcome data.

## How `content_preferences` affect the pipeline

`content_preferences` is not passive metadata. Each field has an explicit consumer.

- `preferred_modules`: health reporting and `/settings/voice` suggestions only. It never auto-overrides `content_strategy.focus_modules`, because explicit user choices win.
- `discouraged_hook_styles`: prompt-builder injects them into the `<preferences>` block as author-specific soft negatives, for example "avoid opening with a rhetorical question". For the named hook behavior, this block overrides conflicting extracted `voice_devices` until Loop 1 later converges on the updated published voice.
- `typical_length_delta`: UI/settings suggestion only. Example: "Your published posts are typically 180 chars shorter than the configured max." No automatic rewrite of `post_length`.
- `industry_context_preference`:
  - `avoid`: skip `matchFindingsToArticles()` for most drafts, but force a probe attempt every 5th otherwise-skipped draft so the preference can rebound
  - `neutral`: current Phase 2 behavior
  - `prefer`: lower the Stage 1 bi-encoder similarity threshold from `0.75` to `0.72`, but Stage 2 must still return `strength = "strong"`
- `expired_rate_30d`: health reporting and warning banners only; no direct prompt effect

---

## Voice Summary In The UI

| Level | Source | Example |
|-------|--------|---------|
| Tier 1 (bootstrap) | extractor output | "Short punchy sentences. Dry humor. Closes with a lesson." |
| Tier 1 (published) | extractor output | "Frases cortas y directas. Humor seco. Cierra con una leccion." |
| Tier 2 | built from config | "Professional · Mixed · Audience: Mixed · 1200-1800 chars" |
| Tier 3 | fixed fallback | "Default style — add examples or pick a tone to personalize." |

`voice_summary` is always regenerated in the same extractor call as `style_patterns` and `voice_devices`.
They must never drift out of sync.

---

## Post Quality Target

**Target `edit_ratio`: >= 0.75 across published posts in the last 30 days**

Interpretation:
- `>= 0.85`: excellent
- `0.75-0.84`: good
- `0.60-0.74`: mediocre
- `< 0.60`: rewrite signal, weak training data

`edit_type='rewrite'` rows should be excluded from both `voice_history` and Loop 1 extractor refresh. They remain useful for health reporting, but they are not valid voice examples.

---

## Integration In `process-job.ts`

> **Extended by voice-system-spec.md** — §Integration in `process-job.ts`.
> The pseudocode below is the Phase 3 baseline. The voice spec adds: stage computation, `draftIndexToday` counter, exposure pool fetch, voice block assembly via `buildProgressiveVoiceBlocks()`, Opening Type Memory (variety constraint), Chapter Context System (skip-vs-chapter decision), and `generation_system = 'v2_progressive'` + `opening_move` persistence at draft-save time. The overall structure (fetch voice profile → filter findings → match articles → generate → publish) is unchanged.

```typescript
const storedVoice = await storage.getVoiceProfile(tenant.id, commit.authorLogin);
const voiceProfile = storedVoice?.voice ?? DEFAULT_VOICE_PROFILE;

const filteredFindings = filterByContentStrategy(
  findings,
  commit,
  voiceProfile.content_strategy,
);

if (filteredFindings.length === 0) {
  return;
}

let industryContext: string | undefined;
let industryMatch: IndustryMatch | undefined;
let contextStatus: 'skipped' | 'no_match' | 'matched' | null = null;
const industryContextPreference =
  voiceProfile.content_preferences?.industry_context_preference ?? 'neutral';

const shouldProbeContext =
  industryContextPreference === 'avoid' &&
  await shouldProbeIndustryContext(tenant.id, commit.authorLogin);
// `shouldProbeIndustryContext()` returns true when the last 4 drafts for this author
// have `context_status='skipped'`, so every 5th otherwise-skipped draft re-tests matching.

const shouldAttemptIndustryContext =
  industryContextPreference !== 'avoid' || shouldProbeContext;

if (shouldAttemptIndustryContext) {
  try {
    // `stage1Threshold` comes from the Phase 2 matcher contract; Phase 3 only selects the value.
    industryMatch = await matchFindingsToArticles(
      filteredFindings,
      embedder,
      aiClient,
      db,
      {
        stage1Threshold: industryContextPreference === 'prefer' ? 0.72 : 0.75,
      },
    ) ?? undefined;
    if (industryMatch) {
      industryContext = industryMatch.connection;
      contextStatus = 'matched';
    } else {
      contextStatus = 'no_match';
    }
  } catch (err) {
    logger.warn('content.match.skipped', { error: String(err) });
  }
} else {
  contextStatus = 'skipped';
}

const draftMatchFields = industryMatch
  ? {
      contextStatus: 'matched',
      hasIndustryContext: true,
      matchedArticleId: industryMatch.articleId,
      matchedSourceId: industryMatch.sourceId,
      matchStrength: industryMatch.matchStrength,
      matchConnection: industryMatch.connection,
    }
  : contextStatus === 'skipped'
  ? {
      contextStatus: 'skipped',
      hasIndustryContext: false,
      matchedArticleId: null,
      matchedSourceId: null,
      matchStrength: null,
      matchConnection: null,
    }
  : contextStatus === 'no_match'
  ? {
      contextStatus: 'no_match',
      hasIndustryContext: false,
      matchedArticleId: null,
      matchedSourceId: null,
      matchStrength: null,
      matchConnection: null,
    }
  : {
      contextStatus: null, // matcher error or historical unknown; do not fabricate a preference signal
      hasIndustryContext: false,
      matchedArticleId: null,
      matchedSourceId: null,
      matchStrength: null,
      matchConnection: null,
    };

// `process-job.ts` owns this persistence by including `draftMatchFields`
// in the initial draft-save payload. The matcher never writes `voice_posts` directly.
await generatePosts(
  commit,
  filteredFindings,
  storage,
  aiClient,
  config,
  voiceProfile,
  industryContext,
  draftMatchFields,
);
```

What stays the same:
- `module_variety_hint`
- `industry_context` injection
- SELF-CHECK block in `<task>`
- XML output format (`<post_draft>`, `<short_draft>`)

---

## Files Affected

| File | Change |
|------|--------|
| `database/schema.sql` | Add `voice_profiles.version`, `voice_posts.author_login`, `voice_posts.top_module_id`, `voice_posts.edit_analysis`, `voice_posts.context_status`, `voice_posts.match_connection`, `last_reactions_fetch_at`, `expired` status support |
| `src/config/schema.ts` | Add `ContentStrategy`, `ContentPreferences`, `HookStyle`, `VoiceProfileSchema`, `DEFAULT_VOICE_PROFILE` |
| `src/voice/storage.ts` | Define `IVoiceStorage.getVoiceProfile(tenantId, authorLogin): Promise<{ voice, version } | null>` and keep fallback semantics in caller |
| `src/ai/voice-extractor.ts` | New extractor with structured input, split output (`style_patterns` + `voice_devices`), and optimistic locking |
| `src/ai/prompt-builder.ts` | Add rule layers, audience block, corrected hashtag wording, runtime `voice_history` contract |
| `src/content/matcher.ts` | Phase 2 contract: return structured `IndustryMatch` metadata and accept optional `MatcherOptions` with `stage1Threshold` default `0.75`; Phase 3 consumes that existing option for `industry_context_preference` |
| `src/webhook/handlers/onboard.ts` | Add 3-section onboarding and summary UI |
| `src/buffer/sent-scanner.ts` | Compute `edit_analysis`, expire stale drafts, refresh voice + content preferences |
| `src/worker/process-job.ts` | Apply content strategy before generation, persist Phase 2 match metadata on the draft row, and force periodic context probes while `industry_context_preference='avoid'` |
| `src/ai/post-generator.ts` | Pass `voiceProfile` + `voice_history` examples into prompt builder and accept draft-match metadata in the save path |

---

## Definition Of Done

Phase 3 is complete when:
1. `voice_profiles` exists with `version`
2. `voice_posts.author_login` and `voice_posts.top_module_id` are persisted before any per-author voice rollout
3. `voice_history` selection is implemented exactly as specified
4. Content strategy is captured in onboarding and applied before Claude
5. `skip_patterns` matching uses the scoped rules from this spec
6. `buildSystemPrompt()` uses hard rules + default rules + user voice with correct precedence
7. The extractor stores `style_patterns` and `voice_devices` separately
8. Hashtag `always` mode uses the corrected wording
9. Scanner writes `edit_analysis` using the specified algorithms
10. Scanner marks stale scheduled drafts as `expired` only after Buffer verification
11. Published-post extractor refresh uses structured input and runs loops in the specified order
12. `content_preferences` has explicit consumers in pipeline, UI, or health reporting
13. `industry_context_preference` differentiates `skipped` vs `no_match` vs `matched`, and `avoid` includes a rebound probe path
14. Org installs can manage per-author profiles via `/settings/voice`
15. `npm run typecheck` passes

---

## Implementation Order

1. `database/schema.sql` — schema changes for `voice_profiles`, `voice_posts`, indexes, RLS
2. `src/config/schema.ts` — `VoiceProfileSchema`, `ContentStrategy`, defaults
3. `src/ai/prompt-builder.ts` — rule layers, audience, hashtags, `voice_history`
4. `src/content/matcher.ts` — return structured `IndustryMatch` metadata and honor `industry_context_preference`
5. `src/worker/process-job.ts` — lookup chain + strategy filtering + persist match metadata on draft creation, including `context_status` and periodic probes
6. `src/ai/post-generator.ts` — pass examples and voice profile into prompt builder
7. `src/ai/voice-extractor.ts` — structured input + optimistic lock
8. `src/webhook/handlers/onboard.ts` — onboarding and `/settings/voice`
9. `src/buffer/sent-scanner.ts` — edit analysis, `expired`, style refresh, content preferences

Step 4 is a prerequisite for Loop 2 `industry_context_removed`, because that analysis depends on `match_connection`.

Steps 1-6 can ship with Tier 2/Tier 3 fallback. Steps 7-9 turn the system into a real feedback loop.

---

---

# Open Questions

Decisions that are pending, partially specified, or deliberately deferred. Each entry has an owner action to unblock it.

---

## OQ-1 — Weekly Roundup (pending_batch consumer)

**What it is:** A weekly "week in review" post generated from commits saved to `pending_batch` — commits that were interesting but skipped due to the daily post cap.

**Why it's not specified:** `pending_batch` currently has no `tenant_id` column and is never written to. The roundup feature depends on the daily cap implementation, which depends on the `pending_batch` fix.

**Blocking items:**
1. Add `tenant_id` and `author_login` to `pending_batch`
2. Implement `MAX_DAILY_POSTS_PER_AUTHOR` in `process-job.ts`
3. Decide: roundup is one post per week per author (best 3 skipped commits), or one per repo?
4. Decide: roundup runs via an additional CRON or as part of `devcast-worker` on Monday morning?

**Open decision:** Who writes the roundup prompt? Same `post-generator.ts` but with a multi-commit input, or a separate template? Needs spec before implementation.

---

## OQ-2 — Author-level job cap (burst efficiency)

**What it is:** Skip `job_queue` entries for an author who has already hit their daily post cap, to avoid wasting the module pipeline on commits that cannot generate posts.

**Why it's not specified:** Requires storing `commit.authorLogin` at webhook time (when the job is enqueued). The webhook today only knows `tenant_id, repo, before_sha, after_sha`. It would need to fetch the commit list and extract the author — a GitHub API call at enqueue time instead of claim time.

**Tradeoff:** Adds latency to webhook response. Webhook currently responds 200 in <50ms. Fetching commit authors adds ~200–500ms.

**Open decision:** Is the API call at enqueue time worth it? Or is wasting the module pipeline on 48 commits acceptable at alpha scale? Revisit when a high-commit-rate tenant exists.

---

## OQ-3 — Evergreen content retention

**What it is:** Some articles (e.g. "The Architecture of Observability" from Netflix) remain relevant for years, not weeks. Today they expire after 45 days.

**Current decision:** 45-day expiry stands for Phase 2. Focus is on "what the industry is discussing NOW."

**When to revisit:** Phase 4 or when users report that a specific article they reference in a post no longer matches future commits. Requires `is_evergreen BOOLEAN` on `content_items` + separate cleanup policy.

---

## OQ-4 — Backpressure in webhook handler

**What it is:** If the webhook receives 500 push events in 10 seconds (e.g. a large org with many active repos), all 500 get enqueued in `job_queue`. The worker processes them over multiple 15-min cycles — no problem. But the webhook handler itself has no concurrency limit, no rate cap, and no backpressure signal back to GitHub.

**Risk:** At large scale, the webhook `job_queue` could grow unbounded. Not a problem today (< 50 tenants).

**Mitigation at scale:** Add a `job_queue` depth check at webhook handler — if depth > 1,000 pending jobs, return `202 Accepted` without enqueuing (GitHub will retry). Log `webhook.backpressure`. Deferred until the threshold is actually hit.

---

## OQ-5 — `/settings/voice` for org members

**Status:** Specified in Phase 3 (this document). Not yet implemented.

**Blocking items for implementation:**
1. GitHub OAuth session cookie must carry `github_username` (currently handled at onboarding but session management isn't specified)
2. Auth check: only members of the org tied to `tenant_id` can create profiles for that tenant
3. Minimal viable version: tone picker only (no bootstrap extraction) is sufficient to unblock Tier 2

---

## OQ-6 — LinkedIn direct post exclusion from voice feedback loop

**Status:** Specified (Phase 3). Not yet enforced in `sent-scanner.ts`.

**Action needed:** `countPublishedSince()` must filter `publish_source != 'linkedin_direct'`. This requires `publish_source` column to be added to `voice_posts` (currently a DB gap).

---

## OQ-7 — Token encryption (Security)

**Status: Decision made. [REQUIRED BEFORE LAUNCH].**

Strategy: envelope encryption with GCP KMS. See Security section for full spec.

**Blocking items before implementation:**
1. Add `encrypted_dek TEXT` column to `tenants`.
2. Implement `encryptToken(dek, plaintext)` and `decryptToken(dek, ciphertext)` helpers.
3. Add KMS unwrap call in `processJob()` before `storage.claimJob()`.
4. Rotate any plaintext tokens after migration (invalidate old values).

---

---

# Implementation Status

Verified against the codebase on 2026-04-08.

**Branches:**
- `trunk` — production deployed code
- `feat/content-intelligence` — current branch, not yet merged

---

## Deployed (on `trunk`, running in production)

| Component | File(s) | Notes |
|-----------|---------|-------|
| Webhook server | `src/webhook/server.ts` | Cloud Run Service `getdevcast-webhook` |
| Push handler → job_queue | `src/webhook/handlers/push.ts` | Enqueues on every push event |
| Installation handler | `src/webhook/handlers/installation.ts` | Creates/deactivates tenant |
| GitHub OAuth | `src/webhook/handlers/github-oauth.ts` | |
| LinkedIn OAuth | `src/webhook/handlers/linkedin-oauth.ts` | HMAC-signed state |
| Onboarding UI | `src/webhook/handlers/onboard.ts` | Voice bootstrap as 3 guided textareas |
| Worker — job claim | `src/worker/main-worker.ts` | SELECT + conditional UPDATE (not SKIP LOCKED) |
| Worker — pipeline | `src/worker/process-job.ts` | enrich → filter → analyze → generate → post |
| 24 analysis modules | `src/analysis/modules/index.ts` | All registered in MODULE_REGISTRY |
| Post generation | `src/ai/post-generator.ts` | ONE Sonnet call/commit, XML parse |
| Prompt builder | `src/ai/prompt-builder.ts` | voice TOP + commit + findings + task BOTTOM. **Pre-Phase-3 state only; Phase 3 replaces this contract entirely.** |
| LinkedIn direct posting | `src/linkedin/client.ts` | **Out of scope — current phase is Buffer-only.** Code exists but not called in pipeline. |
| Buffer publisher | `src/buffer/publisher.ts` | `createIdea` GraphQL mutation |
| Sent-post scanner | `src/buffer/sent-scanner.ts` | `edit_ratio` via `computeEditRatio()` |
| Voice storage (Supabase) | `src/voice/supabase-storage.ts` | All queries scoped by `tenantId` |
| Slot manager | `src/scheduling/slot-manager.ts` | **Implemented but NOT wired** — publisher.ts does not call it |
| `voice_posts` table | `database/schema.sql` | Deployed. Missing: `top_module_id`, `edit_analysis`, `context_status`, `has_industry_context`, `matched_article_id`, `matched_source_id`, `match_strength`, `match_connection`, `last_reactions_fetch_at`, `publish_source`, `author_login` — see gaps |
| `tenants` table | `database/schema.sql` | Deployed. `buffer_access_token` in plaintext. `linkedin_access_token` column exists but out of scope. `encrypted_dek` column not yet added. |
| `job_queue` table | `database/schema.sql` | Deployed. Missing: `leased_until`, `idempotency_key` |
| `pending_batch` table | `database/schema.sql` | Table exists. Never written to. Missing: `tenant_id`, `author_login` |
| `events_state` table | `database/schema.sql` | Deployed. Local dev only |
| `scheduled_slots` table | `database/schema.sql` | Deployed. Not used (slot-manager not wired) |
| RLS on Phase 1 tables | `database/schema.sql` | Enabled, no public policies |

---

## On `feat/content-intelligence` (implemented, not yet merged)

All Phase 2 files exist and typecheck passes. Not in production. Pending SQL migration.

| Component | File(s) | Verified |
|-----------|---------|---------|
| IAIClient + IEmbedder interfaces | `src/ai/types.ts` | ✓ |
| AnthropicAdapter | `src/ai/anthropic-adapter.ts` | ✓ |
| OpenAIEmbedder | `src/ai/openai-embedder.ts` | ✓ |
| AI factory | `src/ai/factory.ts` | ✓ |
| Industry context injection in prompt | `src/ai/prompt-builder.ts` | ✓ `<industry_context>` block |
| `industryContext` param in `generatePosts` | `src/ai/post-generator.ts` | ✓ logs `has_industry_context` but does NOT persist it to DB |
| OPENAI_API_KEY wired in worker | `src/worker/main-worker.ts` | ✓ |
| `matchFindingsToArticles` called in pipeline | `src/worker/process-job.ts` | ✓ graceful degradation |
| Content types | `src/content/types.ts` | ✓ |
| RSS discovery | `src/content/rss-discovery.ts` | ✓ |
| 3-layer article extractor | `src/content/article-extractor.ts` | ✓ RSS → URL → Puppeteer |
| OPML importer | `src/content/opml-importer.ts` | ✓ |
| RSS fetcher | `src/content/rss-fetcher.ts` | ✓ p-limit(5), 15s domain delay |
| Dedup (SHA-256 + Jaccard) | `src/content/dedup.ts` | ✓ |
| Structural filter | `src/content/structural-filter.ts` | ✓ |
| AI classifier (Anthropic Batch) | `src/content/classifier.ts` | ✓ SDK direct (not IAIClient) |
| Chunker | `src/content/chunker.ts` | ✓ 512 tokens, 64 overlap |
| OpenAI Batch embedder | `src/content/embedder.ts` | ✓ |
| Content storage | `src/content/content-storage.ts` | ✓ |
| Matcher (pgvector + cross-encoder) | `src/content/matcher.ts` | ✓ |
| Health reporter | `src/content/health-reporter.ts` | ✓ |
| Source lifecycle evaluator | `src/content/source-evaluator.ts` | ✓ |
| Discover CRON entry point | `src/content/scripts/discover-sources-main.ts` | ✓ |
| Content fetch CRON entry point | `src/content/scripts/content-fetch-main.ts` | ✓ |
| Content cleanup CRON entry point | `src/content/scripts/content-cleanup-main.ts` | ✓ |
| Phase 2 DB schema | `database/schema.sql` | ✓ 4 tables + HNSW + 2 RPCs + RLS |
| Phase 2 GitHub Actions | `.github/workflows/content-*.yml`, `discover-sources.yml` | ✓ |

---

## Gaps — code exists, DB column missing

These features are coded and deployed (or on the branch) but the DB column does not exist in `schema.sql` and has never been added via migration. If they run against the real Supabase they will silently ignore the column or fail on write.

| Column | Table | Written by | Status |
|--------|-------|-----------|--------|
| `top_module_id` | `voice_posts` | `supabase-storage.ts:saveDraft()` | **Missing from `schema.sql`**. Written in production — Supabase accepted it, meaning it was added manually at some point. Must be added to `schema.sql` and verified in Supabase before Phase 3 `voice_history` / freshness logic is enabled. |
| `context_status` | `voice_posts` | Target owner: `process-job.ts` at draft creation. Current code: not written anywhere | Column does not exist. Required to distinguish skipped matching from attempted-no-match and to let `industry_context_preference='avoid'` rebound. |
| `has_industry_context` | `voice_posts` | Target owner: `process-job.ts` at draft creation. Current code: `post-generator.ts` only logs it, does NOT persist to DB | Column does not exist anywhere. Field logged at `ai.generate.start` but never inserted. |
| `matched_article_id` | `voice_posts` | Target owner: `process-job.ts` at draft creation. Current code: not written anywhere | Column does not exist. `process-job.ts` does not yet extract article ID from match result. |
| `matched_source_id` | `voice_posts` | Target owner: `process-job.ts` at draft creation. Current code: not written anywhere | Same. |
| `match_strength` | `voice_posts` | Target owner: `process-job.ts` at draft creation. Current code: not written anywhere | Same. |
| `match_connection` | `voice_posts` | Target owner: `process-job.ts` at draft creation. Current code: not written anywhere | Column does not exist. Required for `industry_context_removed` detection and debugging match quality. |
| `last_reactions_fetch_at` | `voice_posts` | Not written anywhere | Column does not exist. Required for Analytics CRON refresh cadence once LinkedIn reactions are enabled. |
| `publish_source` | `voice_posts` | Not written anywhere | Column does not exist. LinkedIn posts cannot be distinguished from Buffer posts in DB. |
| `author_login` | `voice_posts` | Not written anywhere | Column does not exist. Required for per-author daily cap and all per-author Phase 3 voice logic. Treat as a rollout blocker for Phase 3, not a nice-to-have gap. |
| `leased_until` | `job_queue` | Not written anywhere | Column does not exist. Poison job detection requires it. |
| `idempotency_key` | `job_queue` | Not written anywhere | Column does not exist. |
| `classify_batch_id` | `content_pipeline_runs` | Not yet added | Needed for batch timeout recovery. |
| `embed_batch_id` | `content_pipeline_runs` | Not yet added | Same. |

---

## Not yet started (Phase 3 + Open Questions)

| Feature | Spec location | Status |
|---------|--------------|--------|
| `voice_profiles` table | Phase 3 DB schema | Schema designed, not in `schema.sql`. Must include `version`. |
| `VoiceProfileSchema` | Phase 3 | Not in `src/config/schema.ts` |
| `voice-extractor.ts` | Phase 3 | File does not exist |
| `buildSystemPrompt(config, voiceProfile)` 3-tier logic | Phase 3 | `prompt-builder.ts` still has Liliana's voice hardcoded. This is the pre-Phase-3 implementation and must be replaced, not merged. |
| Voice profile lookup in `process-job.ts` | Phase 3 | Not wired |
| `/settings/voice` UI | Phase 3 | Not built |
| Onboarding voice + content strategy fields | Phase 3 | `onboard.ts` only has voice bootstrap textareas |
| Runtime `voice_history` selection rules | Phase 3 | Not implemented in prompt builder |
| `content_preferences` consumers | Phase 3 | Not implemented in matcher, prompt-builder, or settings UI |
| Scanner feedback loop (`edit_analysis`, `expired`, refresh) | Phase 3 | Not in `sent-scanner.ts` |
| `slot-manager.ts` wired into `publisher.ts` | Phase 1 gap | File exists, not called anywhere |
| `MAX_DAILY_POSTS_PER_AUTHOR` | Phase 1 gap (OQ-2) | Not implemented |
| Seed corpus script (`seed-corpus.ts`) | Launch prerequisite | Does not exist |
| Weekly roundup (pending_batch consumer) | OQ-1 | Not started |
| Token encryption | OQ-7 | Not started |
| Tenant health status endpoint | Planned | Not started |

---

## Schema gaps migration (what needs to run in Supabase)

Before Phase 2 features work correctly in production, these must be run **in addition to** the Phase 2 tables already in `database/schema.sql`:

```sql
-- voice_posts gaps
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS top_module_id       TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS edit_analysis       JSONB;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS context_status      TEXT;  -- 'skipped' | 'no_match' | 'matched' | NULL=historical/error
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS has_industry_context BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_article_id  UUID REFERENCES content_items(id);
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_source_id   UUID REFERENCES content_sources(id);
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_strength       REAL;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection     TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at TIMESTAMPTZ;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source       TEXT;  -- 'buffer' | 'linkedin_direct'
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS author_login         TEXT;

-- job_queue gaps
ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS leased_until      TIMESTAMPTZ;
ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS idempotency_key   TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_idempotency ON job_queue(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- content_pipeline_runs gaps (Phase 2)
ALTER TABLE content_pipeline_runs ADD COLUMN IF NOT EXISTS classify_batch_id TEXT;
ALTER TABLE content_pipeline_runs ADD COLUMN IF NOT EXISTS embed_batch_id    TEXT;

-- pending_batch gaps
ALTER TABLE pending_batch ADD COLUMN IF NOT EXISTS tenant_id    UUID REFERENCES tenants(id);
ALTER TABLE pending_batch ADD COLUMN IF NOT EXISTS author_login TEXT;

-- content_sources: seed corpus protection
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT FALSE;

-- tenants: envelope encryption DEK storage
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS encrypted_dek TEXT;
```

---

# Appendix — Directory Structure

```
devcast/
├── .github/workflows/
│   ├── deploy.yml                  # CI/CD: push to trunk → webhook + worker + scanner
│   ├── discover-sources.yml        # 1st + 15th each month — RSS source discovery
│   ├── content-fetch.yml           # Weekly Sunday — full content pipeline
│   ├── content-cleanup.yml         # Monthly 15th — expire articles + lifecycle eval
│   ├── poll-and-generate.yml       # DISABLED — kept as workflow_dispatch for local dev
│   ├── scan-sent-posts.yml         # DISABLED — replaced by multi-tenant scanner
│   ├── bootstrap-voice.yml         # manual: seed voice history
│   └── voice-report.yml            # weekly voice training report
├── src/
│   ├── analysis/                   # 24 analysis modules
│   ├── ai/
│   │   ├── types.ts                # IAIClient + IEmbedder interfaces
│   │   ├── anthropic-adapter.ts    # AnthropicAdapter implements IAIClient
│   │   ├── openai-embedder.ts      # OpenAIEmbedder implements IEmbedder
│   │   ├── factory.ts              # createAIClient() + createEmbedder()
│   │   ├── prompt-builder.ts       # buildSystemPrompt(config, voiceProfile) [Phase 3]
│   │   ├── post-generator.ts       # ONE call/commit, parse XML
│   │   └── voice-extractor.ts      # [Phase 3] Haiku call, quality gate
│   ├── content/                    # [Phase 2] Content Intelligence Agent
│   │   ├── types.ts
│   │   ├── rss-discovery.ts
│   │   ├── article-extractor.ts
│   │   ├── rss-fetcher.ts
│   │   ├── dedup.ts
│   │   ├── structural-filter.ts
│   │   ├── classifier.ts
│   │   ├── chunker.ts
│   │   ├── embedder.ts
│   │   ├── content-storage.ts
│   │   ├── matcher.ts
│   │   ├── health-reporter.ts
│   │   ├── source-evaluator.ts
│   │   └── scripts/
│   │       ├── discover-sources-main.ts
│   │       ├── content-fetch-main.ts
│   │       └── content-cleanup-main.ts
│   ├── voice/
│   │   ├── storage.ts              # IVoiceStorage interface
│   │   ├── supabase-storage.ts     # Production (tenant-scoped)
│   │   └── sqlite-storage.ts       # Local dev
│   ├── webhook/
│   │   ├── server.ts
│   │   ├── github-handler.ts
│   │   └── handlers/
│   │       ├── push.ts
│   │       ├── installation.ts
│   │       ├── onboard.ts          # [Phase 3] voice profile fields
│   │       ├── github-oauth.ts
│   │       └── linkedin-oauth.ts
│   ├── worker/
│   │   ├── main-worker.ts
│   │   ├── process-job.ts          # Integration point for all phases
│   │   ├── main-scan-tenants.ts    # [Phase 3] feedback loop per author
│   │   └── github-app-auth.ts
│   └── buffer/
│       ├── client.ts
│       ├── publisher.ts
│       └── sent-scanner.ts         # [Phase 3] voice refresh trigger
├── database/
│   └── schema.sql                  # Single source of truth for all tables
└── devcast-spec.md                 # This file
```

---

# Appendix — What to Run in Supabase SQL Editor

The following must be run manually in the Supabase SQL Editor after deploying Phase 2
(branch `feat/content-intelligence`):

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Phase 2 tables
CREATE TABLE IF NOT EXISTS content_sources ( ... );  -- see database/schema.sql
CREATE TABLE IF NOT EXISTS content_items ( ... );
CREATE TABLE IF NOT EXISTS article_chunks ( ... );
CREATE TABLE IF NOT EXISTS content_pipeline_runs ( ... );

-- HNSW index
CREATE INDEX IF NOT EXISTS idx_article_chunks_embedding
  ON article_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m=16, ef_construction=64);

-- RPC functions
CREATE OR REPLACE FUNCTION match_article_chunks(...) ...
CREATE OR REPLACE FUNCTION increment_content_match(...) ...

-- RLS
ALTER TABLE content_sources       ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_chunks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pipeline_runs ENABLE ROW LEVEL SECURITY;
```

Full SQL: see `database/schema.sql` lines 101–280.

After Phase 3 is implemented, also run:
```sql
CREATE TABLE IF NOT EXISTS voice_profiles (..., version INTEGER NOT NULL DEFAULT 1, ...);
CREATE UNIQUE INDEX idx_voice_profiles_tenant_default ...;
CREATE UNIQUE INDEX idx_voice_profiles_tenant_author ...;
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;
```
