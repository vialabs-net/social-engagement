# CLAUDE.md — devcast Project Memory

This file is the authoritative guide for AI-assisted development sessions on this project.
Read it fully before writing any code or making architectural decisions.

---

## What This Project Does

**devcast** monitors all GitHub repositories for new commits, runs the code through specialized
analysis modules, translates the findings into social media posts using Claude AI, and sends
them to Buffer as drafts. Liliana reviews and publishes from Buffer's native UI.

**Author**: Liliana | **Site**: https://lilicurl.com
**Platforms**: LinkedIn + Instagram (Buffer free tier, 3 channels)

---

## Core Requirements (Non-Negotiable)

1. **Install once, works everywhere**: Set up in ONE central repo. Every commit to EVERY repo
   under the account is automatically detected. New repos require zero configuration.

2. **Specialized modular analysis**: Multiple focused modules analyze code before Claude is called.
   Claude translates findings — it does NOT analyze code. Modules do.

3. **Buffer is the review interface**: Posts go directly to Buffer as scheduled drafts.
   Liliana edits in Buffer's native UI and publishes when ready. No GitHub Issues /approve flow.

4. **Voice training loop**: After Liliana publishes from Buffer, the sent-post scanner captures
   the final published text, computes edit_ratio, and stores it as a voice history example.

5. **Posting window**: Posts scheduled ONLY between 8:00 AM and 7:00 PM Chile time
   (America/Santiago). Architecturally enforced via slot-manager.ts — not just configured.

6. **Free tiers only**: GitHub Actions (public repo = unlimited), Buffer (free), Supabase (free).
   Only Anthropic Claude API costs money — minimize aggressively.

7. **Human review required**: No auto-publish path exists. Buffer holds all posts as drafts/scheduled.

---

## The Two-Cron Architecture

```
[CRON every 4h — poll-and-generate.yml]
GitHub Events API → Commit Enrichment → Module Pipeline → Claude → Buffer (draft)

[CRON every 2h — scan-sent-posts.yml]
Buffer "sent" API → Match buffer_post_id → computeEditRatio → Voice History
```

These two crons are kept separate for independent debuggability.

---

## Full Pipeline Flow

```
[CRON every 4h — poll-and-generate.yml]
│
├── github/events-poller.ts
│   └── GET /users/{username}/events (ETag-cached, 304 = free)
│       Filter: PushEvent after last_event_id
│
├── github/commit-enricher.ts
│   └── GET /repos/{owner}/{repo}/commits/{sha}
│       Extract: files, stats, raw patches (max 150 lines per file)
│       → FileDiff[] via analysis/diff-parser.ts
│
├── utils/commit-filter.ts (ZERO API COST — rule-based)
│   └── isInteresting(): lines >= 10, not merge/bot/wip/excluded
│       NOT interesting → pending_batch table (weekly roundup later)
│       IS interesting → analysis pipeline
│
├── analysis/pipeline.ts (ALL modules run IN PARALLEL)
│   ├── ComplexityModule.analyze(ctx)
│   ├── DesignPatternsModule.analyze(ctx)
│   ├── CleanCodeModule.analyze(ctx)
│   ├── TypeSystemModule.analyze(ctx)     ← TypeScript only
│   ├── IntegrationModule.analyze(ctx)
│   ├── TestingModule.analyze(ctx)
│   └── AiAssistedModule.analyze(ctx)
│   → Promise.allSettled (one failure = null, not crash)
│   → Sort by interestScore DESC → top 3 findings
│   → If 0 findings → SKIP (no Claude call, no Buffer post)
│
├── ai/prompt-builder.ts
│   ├── voice/retriever.ts → top 5 published posts (edit_ratio DESC)
│   └── Assemble: [voice examples TOP] + [commit] + [findings] + [task BOTTOM]
│
├── ai/post-generator.ts
│   └── claude-sonnet-4-6, max_tokens=1600
│       ONE call per commit (never per-module)
│       Returns: { linkedin: string, instagram: string }
│       Store ai_draft immediately in DB
│
├── scheduling/slot-manager.ts
│   └── Next available slot within 8am-7pm CLT
│       Atomic claim via UNIQUE(platform, scheduled_at) in DB
│
├── buffer/publisher.ts
│   ├── Check queue depth (≥9 → store as 'queued', drain on next run)
│   ├── POST /1/updates/create.json with scheduled_at (UTC Unix timestamp)
│   └── Store: buffer_post_id, scheduled_at, status='scheduled'
│
└── review/notifier.ts
    └── Open GitHub Issue (NOTIFICATION ONLY — no /approve needed)
        Links to Buffer draft and commit
        Auto-closes after 48h

[CRON every 2h — scan-sent-posts.yml]
│
└── buffer/sent-scanner.ts
    ├── GET /1/profiles/{id}/updates/sent.json (per platform)
    ├── Match by buffer_post_id → voice_posts in DB
    └── For each newly sent post:
        ├── Fetch final text from Buffer response
        ├── computeEditRatio(ai_draft, published_text) → 0.0–1.0
        └── UPDATE: published, edit_ratio, status='published'
            → This post is now a voice history example ✓
```

---

## THE MODULE SYSTEM — The Architectural Core

See [content-generator-v2.md](content-generator-v2.md) for the full design.

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
- No other code changes anywhere

**MVP modules** (7): complexity, design_patterns, clean_code, type_system, integration, testing, ai_assisted

**Pipeline behavior**:
- All modules run in `Promise.allSettled` (parallel, failure-isolated)
- Returns `Finding[]` sorted by `interestScore DESC`, sliced to top 3
- Returns empty array if nothing found → caller skips Claude call entirely

**Adding a new module**: Create `src/analysis/modules/your-module.ts` implementing `CodeAnalyzer`,
add to `MODULE_REGISTRY`. See [content-generator-v2.md](content-generator-v2.md) for the
complete walkthrough.

---

## Claude API — Cost Minimization (Critical)

**Model**: `claude-sonnet-4-6` ONLY. Never Opus.
**max_tokens**: 1600 (hardcoded in `src/ai/client.ts`, never increase)

**Token budget per call:**
- Input: ~1,950 tokens (system + voice examples + commit + findings + task)
- Output: ~900 tokens (LinkedIn ~600 + Instagram ~300)
- Cost: ~$0.006 per post

**Cost controls:**
- `isInteresting()` runs BEFORE any API call — zero API cost on trivial commits
- Modules run BEFORE Claude — if 0 findings, Claude is never called
- ONE Claude call per commit — never one per module
- All drafts cached in DB — rejection is free (no re-generation)
- Duplicate SHA detection — processed commits never re-processed

**Rate limit policy:**
- `529 Overloaded` → retry with backoff (1s → 2s → 4s, max 3 attempts)
- `400 Bad Request` → throw `PromptError`, do NOT retry
- `401 Unauthorized` → throw immediately

---

## Prompt Assembly (Non-Negotiable Order)

Following Anthropic's long-context best practices:

```
[SYSTEM — ~300 tokens]
[VOICE EXAMPLES — TOP of context, ordered edit_ratio DESC]
[COMMIT CONTEXT — middle]
[MODULE FINDINGS — below commit, above task]
[TASK INSTRUCTION — BOTTOM]
```

The findings are serialized as readable natural language (not JSON) so Claude can cite them
naturally in the post. Each finding includes: headline, technical context, teaching angle,
optional before/after evidence.

---

## Chile Timezone Scheduling

**Timezone**: `America/Santiago` (IANA — handles CLT/CLST DST automatically)
**Library**: `date-fns-tz` — never hardcode UTC offsets
**Window**: 8:00 AM – 7:00 PM CLT (19:00 hard cutoff)
**Daily slots**: [8, 12, 17] hours CLT → 8am, 12pm, 5pm

`slot-manager.ts` computes the next unclaimed slot → converts to UTC Unix timestamp →
passes to Buffer's `scheduled_at` field. Posting outside the window is structurally impossible.

The `UNIQUE(platform, scheduled_at)` constraint in the `scheduled_slots` table prevents
double-booking atomically even if two workflow runs race.

---

## Three External Services

### GitHub API
**Auth**: `GITHUB_TOKEN` (auto-provided in Actions)
**Key endpoints**:
- `GET /users/{u}/events?per_page=100` — event polling with ETag
- `GET /repos/{o}/{r}/commits/{sha}` — commit enrichment (1 req per interesting commit)
- `POST /repos/{o}/{r}/issues` — notification issue

**Error handling**: 404 → `RepoNotFoundError` (don't retry); 429 → `withRetry()`

### Buffer API
**Auth**: `BUFFER_ACCESS_TOKEN` — long-lived OAuth token
**Free tier**: 3 channels, 10 posts queued per channel
**Key endpoints**:
- `GET /1/profiles.json` — list channels with profile IDs
- `GET /1/profiles/{id}/updates/pending.json` — check queue depth before publishing
- `POST /1/updates/create.json` — add post with `scheduled_at`
- `GET /1/profiles/{id}/updates/sent.json` — scan for published posts (voice loop)

**Queue management**: Check depth before publishing. If ≥9, store `review_status='queued'`.
Drain queued posts at start of every cron run.

**Token expiry**: `401` → throw `BufferTokenExpiredError`. Regenerate at buffer.com → Settings → Apps.

### Anthropic Claude API
**Auth**: `ANTHROPIC_API_KEY`
**Model**: `claude-sonnet-4-6`
**max_tokens**: 1600 (hardcoded)

---

## Database Schema

```sql
-- database/schema.sql — run in Supabase SQL Editor

CREATE TABLE voice_posts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  commit_sha      TEXT NOT NULL,
  repo            TEXT NOT NULL,           -- 'owner/repo'
  platform        TEXT NOT NULL,           -- 'linkedin' | 'instagram'
  ai_draft        TEXT NOT NULL,           -- stored immediately on generation
  published       TEXT,                    -- captured from Buffer "sent" API
  edit_ratio      REAL,                    -- 1.0=unchanged, 0.0=complete rewrite
  published_at    TIMESTAMPTZ,
  buffer_post_id  TEXT,
  scheduled_at    TIMESTAMPTZ,             -- UTC time Buffer will publish
  status          TEXT DEFAULT 'pending',  -- 'pending'|'scheduled'|'published'|'queued'
  top_finding     TEXT,                    -- headline of the top module finding
  findings_count  INTEGER DEFAULT 0        -- how many findings the pipeline produced
);

CREATE TABLE pending_batch (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  commit_sha      TEXT NOT NULL,
  repo            TEXT NOT NULL,
  enriched_data   JSONB NOT NULL
);

CREATE TABLE events_state (
  username        TEXT PRIMARY KEY,
  last_event_id   TEXT NOT NULL,
  last_event_etag TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE scheduled_slots (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  platform        TEXT NOT NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  voice_post_id   TEXT REFERENCES voice_posts(id),
  UNIQUE(platform, scheduled_at)           -- prevents double-booking
);

CREATE INDEX idx_voice_retrieval
  ON voice_posts(platform, edit_ratio DESC)
  WHERE status = 'published';
```

---

## Configuration

```yaml
# config.yaml (gitignored)
# config.example.yaml (committed — template for forkers)

author:
  github_username: "yourusername"
  name: "Your Name"
  website: "https://lilicurl.com"         # appears in LinkedIn CTAs

github:
  exclude_repos: []
  exclude_patterns:
    - "^(wip|temp|fixup!|squash!)"
    - "\\[skip\\]"
  max_commits_per_push: 1

platforms:
  linkedin:
    enabled: true
    buffer_profile_id: ""
  instagram:
    enabled: true
    buffer_profile_id: ""

scheduling:
  timezone: "America/Santiago"
  window_start_hour: 8
  window_end_hour: 19
  daily_slots: [8, 12, 17]

posting:
  poll_interval_hours: 4
  interesting_min_lines: 10
  voice_examples_count: 5
  max_pending_drafts: 10
  analysis_top_n: 3                       # top N findings passed to Claude

ai:
  model: "claude-sonnet-4-6"
  max_tokens: 1600
```

---

## Directory Structure

```
devcast/
├── .github/workflows/
│   ├── poll-and-generate.yml       # every 4h: commits → modules → Claude → Buffer
│   ├── scan-sent-posts.yml          # every 2h: Buffer sent → voice history
│   └── bootstrap-voice.yml          # manual: seed voice history
├── src/
│   ├── analysis/                    # ← THE ARCHITECTURAL SHOWCASE
│   │   ├── types.ts                 # CodeAnalyzer, Finding, AnalysisContext interfaces
│   │   ├── pipeline.ts              # parallel execution, ranking, top-N
│   │   ├── diff-parser.ts           # raw Git patch → FileDiff[]
│   │   ├── language-detector.ts     # file extensions → language list
│   │   └── modules/
│   │       ├── index.ts             # MODULE_REGISTRY ← only file to edit for new module
│   │       ├── complexity.ts
│   │       ├── design-patterns.ts
│   │       ├── clean-code.ts
│   │       ├── type-system.ts       # TypeScript only
│   │       ├── integration.ts
│   │       ├── testing.ts
│   │       └── ai-assisted.ts
│   ├── github/
│   │   ├── client.ts                # Octokit + ETag state
│   │   ├── events-poller.ts         # poll /users/{u}/events
│   │   └── commit-enricher.ts       # fetch commit, build FileDiff[]
│   ├── ai/
│   │   ├── client.ts                # Anthropic SDK (sonnet, max_tokens=1600)
│   │   ├── prompt-builder.ts        # voice top + commit + findings + task bottom
│   │   └── post-generator.ts        # ONE call per commit, cache draft, parse JSON
│   ├── buffer/
│   │   ├── client.ts                # Buffer REST wrapper
│   │   ├── publisher.ts             # queue check + slot scheduling + POST
│   │   └── sent-scanner.ts          # poll sent posts → voice history feedback
│   ├── scheduling/
│   │   └── slot-manager.ts          # America/Santiago 8am-7pm, atomic slot claiming
│   ├── voice/
│   │   ├── storage.ts               # IVoiceStorage interface
│   │   ├── supabase-storage.ts      # production
│   │   ├── sqlite-storage.ts        # local dev
│   │   └── similarity.ts            # computeEditRatio(draft, published)
│   ├── review/
│   │   └── notifier.ts              # notification-only GitHub Issue (no /approve)
│   ├── config/
│   │   ├── loader.ts
│   │   └── schema.ts               # Zod schemas
│   └── utils/
│       ├── logger.ts                # structured JSON to stdout
│       ├── retry.ts                 # withRetry() per-service policies
│       └── commit-filter.ts         # isInteresting() — rule-based, zero API cost
├── scripts/
│   ├── setup-buffer.ts              # list Buffer channels with IDs
│   ├── bootstrap-voice.ts           # seed DB from voice-bootstrap.md
│   ├── manage-voice.ts              # inspect/delete voice history
│   └── test-analyze.ts              # run module pipeline on any commit SHA
├── database/
│   └── schema.sql
├── data/
│   └── .gitkeep                     # local SQLite (gitignored)
├── .env.example
├── config.example.yaml
├── config.yaml                      # gitignored
├── voice-bootstrap.md
├── content-generator-v2.md          # modular analyzer design doc
├── CONTENT_GUIDE.md
├── content-strategy.json
├── CLAUDE.md
└── README.md
```

---

## MVP Build Order

Build in this sequence — each layer depends on the previous:

1. `src/config/` — loader, Zod schema, config.example.yaml
2. `database/schema.sql`
3. `src/voice/storage.ts` + `supabase-storage.ts` + `sqlite-storage.ts` + `similarity.ts`
4. `src/scheduling/slot-manager.ts` (date-fns-tz)
5. `src/utils/` — logger, retry, commit-filter
6. `src/analysis/types.ts` + `diff-parser.ts` + `language-detector.ts`
7. `src/analysis/modules/` — all 7 MVP modules + index.ts
8. `src/analysis/pipeline.ts`
9. `src/github/client.ts` + `events-poller.ts` + `commit-enricher.ts`
10. `src/ai/client.ts` + `prompt-builder.ts` + `post-generator.ts`
11. `src/buffer/client.ts` + `publisher.ts` + `sent-scanner.ts`
12. `src/review/notifier.ts`
13. `.github/workflows/` — all 3 workflows
14. `scripts/setup-buffer.ts` + `bootstrap-voice.ts`
15. `.env.example` (exists) + `voice-bootstrap.md`

---

## Setup Experience — 8 Steps

1. **Fork** → Settings → Actions → "Allow all actions and reusable workflows"
2. **Supabase**: supabase.com → New project → SQL Editor → run `database/schema.sql`
3. **Secrets**: Settings → Secrets → Actions → add all env vars from `.env.example`
4. **Config**: `cp config.example.yaml config.yaml` → set `author.github_username`
5. **Buffer profiles**: `npm install && npm run setup-buffer` → paste profile IDs
6. **Voice bootstrap**: Edit `voice-bootstrap.md` with 3–5 posts in your actual voice
7. **Seed**: `npm run bootstrap`
8. **Test**: Actions → "Poll and Generate" → "Run workflow" → check Buffer for draft

---

## Error Handling Per Service

```
GitHub:   404 → RepoNotFoundError (don't retry); 429 → withRetry()
Anthropic: 529 → withRetry(); 400 → PromptError (don't retry); 401 → throw immediately
Buffer:   5xx → withRetry(); 401 → BufferTokenExpiredError; 429 → store as 'queued'
```

---

## Coding Conventions

- **No `any`** — use `unknown` and narrow, or define proper types
- **No silent failures** — every catch either rethrows or logs + rethrows
- **Interfaces for data shapes** — classes for stateful services (modules, clients)
- **Dependency injection** — pass `IVoiceStorage` to consumers, never import a singleton
- **One file per concern**
- **No magic strings** — `const STATUS = { PENDING: 'pending', SCHEDULED: 'scheduled' } as const`
- Comments only where logic isn't self-evident

---

## Known Tradeoffs (Accepted)

1. **4-hour polling lag**: Irrelevant when Buffer is the review interface
2. **Buffer review UX**: Native Buffer editing is simpler than GitHub Issues workflow
3. **Voice loop is asynchronous**: 2h delay from publish to voice history — acceptable
4. **Heuristic detection has false positives**: Rare, and modules returning null ≠ crash
5. **Supabase inactivity pause**: 4h cron + keepalive query prevents in normal use
6. **Buffer token manual rotation**: Unavoidable without a running OAuth server
7. **Chile DST**: `date-fns-tz` + `America/Santiago` IANA handles this. Never hardcode UTC offset.

---

## How to Start a New Session

1. Read this file fully
2. Read `content-generator-v2.md` for the module system design
3. Run `ls src/` to see what exists before writing anything
4. Follow MVP Build Order above — start with config and voice storage
5. When implementing a module, test it standalone via `scripts/test-analyze.ts`

---

*Architecture locked. Ready to build.*
