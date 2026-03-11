---
name: devcast
description: >
  Context skill for the devcast project (social-engagement repo). Use this skill whenever
  the user asks about devcast architecture, pipeline, modules, Buffer integration, voice
  training, scheduling, Claude API usage, or any code in this repository. Also trigger
  when the user asks to add a new analysis module, debug the pipeline, or understand
  how any component connects to the rest of the system.
---

# devcast — Project Context

## What It Does

devcast monitors ALL GitHub repositories for new commits, runs the code through specialized
analysis modules, translates findings into social media posts via Claude AI, and sends them
to Buffer as Ideas (drafts). Liliana reviews and publishes from Buffer's native UI.

**Author**: Liliana Castellanos | **Site**: https://lilicurl.com
**Platforms**: LinkedIn + Instagram (Buffer free tier, 3 channels)

---

## Two-Cron Architecture

```
[CRON every 4h — poll-and-generate.yml]
GitHub Events API → Commit Enrichment → Module Pipeline → Claude → Buffer (Idea)

[CRON every 2h — scan-sent-posts.yml]
Buffer "sent" API → Match by text similarity → computeEditRatio → Voice History
```

---

## Full Pipeline (poll-and-generate)

```
github/events-poller.ts       GET /users/{username}/events (ETag-cached)
github/commit-enricher.ts     GET /repos/{o}/{r}/commits/{sha} → FileDiff[]
utils/commit-filter.ts        isInteresting() — rule-based, zero API cost
analysis/pipeline.ts          ALL 17 modules run IN PARALLEL (Promise.allSettled)
  ├── complexity.ts            Cyclomatic complexity, deep nesting
  ├── design-patterns.ts       Strategy, observer, factory, builder, decorator, singleton
  ├── clean-code.ts            KISS line reduction, DRY function extraction
  ├── type-system.ts           Discriminated unions, branded types, generics (TS only)
  ├── integration.ts           Redis, Stripe, Supabase, Prisma, K8s, AWS SDK
  ├── testing.ts               Parametrized tests, edge cases, test expansion
  ├── ai-assisted.ts           AI SDK imports, prompt files, AI commit messages
  ├── performance.ts           N+1 queries, batch ops, memoization, streams, sync I/O
  ├── security.ts              Hardcoded secrets, SQL injection, input validation, auth
  ├── api-design.ts            REST routes, error contracts, versioning, rate limiting
  ├── error-resilience.ts      Circuit breaker, retry backoff, graceful shutdown, health check
  ├── observability.ts         Distributed tracing, structured logging, metrics, error tracking
  ├── concurrency.ts           Mutex, atomics, worker threads, concurrency control
  ├── dx.ts                    Custom errors, config validation, CLI, env validation
  ├── dependency-health.ts     Security deps, major bumps, new/removed deps
  ├── evolutionary.ts          Module extraction, renames, migrations, deprecation
  └── js-advanced.ts           Proxy/Reflect, WeakRef, generators/iterators
  → top 3 findings by interestScore DESC
  → 0 findings → SKIP (no Claude call, no Buffer post)
ai/prompt-builder.ts          voice examples TOP + commit + findings (with contextHint) + task BOTTOM
ai/post-generator.ts          claude-sonnet-4-6, max_tokens=1600, ONE call/commit
buffer/publisher.ts           GraphQL createIdea mutation → Buffer Ideas inbox
review/notifier.ts            GitHub Issue (notification only, no /approve)
```

---

## Key Architectural Rules

- **Modules detect, Claude writes** — Claude never analyzes code directly
- **MODULE_REGISTRY** in `src/analysis/modules/index.ts` is the only file to touch when adding a module
- **ONE Claude call per commit** — never one per module
- **isInteresting() runs before any API call** — trivial commits are free
- **0 findings → no Claude call** — cost guard
- **Buffer uses GraphQL** (`graph.buffer.com`) for createIdea, REST (`/1/profiles/{id}/updates/sent.json`) for sent-post scanning
- **Slot uniqueness**: `UNIQUE(platform, scheduled_at)` in DB prevents race conditions
- **Posting window**: 8am–7pm CLT only, enforced in `slot-manager.ts` (not yet wired)

---

## Claude API — Cost Budget

| Item | Value |
|------|-------|
| Model | `claude-sonnet-4-6` only |
| max_tokens | 1600 (hardcoded, never increase) |
| Input | ~1,950 tokens |
| Output | ~900 tokens |
| Cost/post | ~$0.006 |

Retry policy: `529 Overloaded` → backoff (1s/2s/4s, max 3); `400` → PromptError (no retry); `401` → throw immediately.

---

## Directory Structure (Key Files)

```
src/
├── analysis/
│   ├── types.ts              CodeAnalyzer, Finding (with contextHint), AnalysisContext
│   ├── pipeline.ts           parallel execution, ranking, top-N slice
│   ├── diff-parser.ts        raw Git patch → FileDiff[]
│   └── modules/
│       └── index.ts          MODULE_REGISTRY (17 modules) ← only file to edit
├── ai/
│   ├── client.ts             Anthropic SDK (sonnet, max_tokens=1600)
│   ├── prompt-builder.ts     voice TOP + commit + findings + task BOTTOM
│   └── post-generator.ts     ONE call/commit, cache draft, parse XML tags
├── buffer/
│   ├── client.ts             Buffer GraphQL + REST wrapper
│   ├── publisher.ts          createIdea GraphQL mutation → Buffer Ideas
│   └── sent-scanner.ts       poll sent → text similarity match → voice history
├── scheduling/
│   └── slot-manager.ts       America/Santiago 8am-7pm, atomic slot claiming
├── voice/
│   ├── storage.ts            IVoiceStorage interface
│   ├── supabase-storage.ts   production
│   └── sqlite-storage.ts     local dev
└── review/
    └── notifier.ts           notification-only GitHub Issue
```

---

## Database Schema Summary

| Table | Purpose |
|-------|---------|
| `voice_posts` | Main table: drafts, published text, edit_ratio, status |
| `pending_batch` | Non-interesting commits for future weekly roundup (unused) |
| `events_state` | ETag + last_event_id per GitHub username |
| `scheduled_slots` | Atomic slot claiming with UNIQUE constraint |

---

## Error Handling Per Service

```
GitHub:     404 → RepoNotFoundError (no retry); 429 → withRetry()
Anthropic:  529 → withRetry(); 400 → PromptError (no retry); 401 → throw
Buffer:     5xx → withRetry(); 401 → BufferTokenExpiredError; 429 → store 'queued'
```

---

## Project-Specific Conventions

- `date-fns-tz` for all timezone logic — never hardcode UTC offsets
- No magic strings — use `const STATUS = { PENDING: 'pending' } as const`
- Each Finding includes `contextHint` with `filename in repo` for Claude to cite
