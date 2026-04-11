# Article Match Hardening Spec

Status: Draft
Date: 2026-04-11
Owner: devcast

## Problem

The content-matching system is working end to end, but it is under-matching strong commits.

Observed behavior:

- interesting commits are successfully analyzed and ranked
- the article matcher usually returns `no_match`
- no historical `voice_posts` rows currently contain `context_status`
- representative commits with strong findings still fail retrieval

The issue is not a single bug. It is a system design mismatch across:

1. commit analysis output
2. retrieval query construction
3. retrieval calibration
4. corpus freshness
5. match timing

## What We Learned From The Code

### 1. KMS commits are not described as security work

The `security` module only recognizes:

- hardcoded secrets
- SQL injection
- input validation
- auth/authz
- security headers

Source: [security.ts](/Users/Lilicurl/Documents/git/social-engagement/src/analysis/modules/security.ts)

It does not recognize:

- KMS
- envelope encryption
- key wrapping / unwrapping
- DEK / KEK patterns
- AES-GCM token sealing
- secret storage boundary hardening

So the KMS commit is free to be claimed by other modules first:

- `integration` sees `@supabase/supabase-js` or generic client setup and emits a generic integration finding
- `dependency_health` sees `@google-cloud/kms` and emits `new dependency added`
- `type_system` sees utility types / type guards and emits a generic type-system finding

Source: [integration.ts](/Users/Lilicurl/Documents/git/social-engagement/src/analysis/modules/integration.ts), [dependency-health.ts](/Users/Lilicurl/Documents/git/social-engagement/src/analysis/modules/dependency-health.ts), [type-system.ts](/Users/Lilicurl/Documents/git/social-engagement/src/analysis/modules/type-system.ts)

### 2. Progressive voice is being described as extraction + config validation

The `evolutionary` module heavily rewards module extraction:

- any added file with >= 30 lines
- any modified file with >= 30 deletions
- same directory or same extension

That is enough for large refactors and doc/spec extraction work to be labeled as `module extraction`.

Source: [evolutionary.ts](/Users/Lilicurl/Documents/git/social-engagement/src/analysis/modules/evolutionary.ts)

The same commit also modified `src/config/schema.ts`, so both `security` and `dx` detected schema validation.

This produced findings that are valid, but incomplete:

- they describe visible structural moves
- they do not capture the central narrative of the commit
- they are weak retrieval queries for industry context

### 3. The match query is too abstract

Today Stage 1 embeds only `finding.plainLanguage`.

Source: [matcher.ts](/Users/Lilicurl/Documents/git/social-engagement/src/content/matcher.ts)

That is a problem because `plainLanguage` is optimized for social explanation, not semantic retrieval.

Examples:

- `Extracting code into its own module is a sign of a codebase maturing`
- `Validating input at the boundary catches bad data early`

These are good post-writing sentences.
They are bad retrieval queries because they lose critical terms:

- `KMS`
- `envelope encryption`
- `tenant token`
- `AES-256-GCM`
- `DEK`
- `wrap/unwrap`
- `voice system`
- `progressive voice`
- `opening_move`
- `exposure examples`

### 4. Retrieval is calibrated too aggressively

Today the worker uses:

- `0.75` similarity by default
- `0.72` when the voice profile prefers industry context

Source: [process-job.ts](/Users/Lilicurl/Documents/git/social-engagement/src/worker/process-job.ts)

But manual inspection of representative findings showed top similarities like:

- voice-system style finding: ~`0.42`
- observability style finding: ~`0.44`
- KMS/security style finding: ~`0.34`

So Stage 1 is rejecting most reasonable candidates before Stage 2 can judge them.

### 5. The corpus is varied, but not fresh

The stored corpus is not empty and not monolithic by topic.
It includes coverage for performance, evolutionary, dx, security, architecture, observability, AI, and more.

But operationally it is still mostly static:

- `content_items`: 200
- `article_chunks`: 587
- only one active source: `curated-seed`
- most sources remain `queued`

The seed corpus is intentionally stored with:

- `DEFAULT_SEED_WEEK_OF = 2026-01-01`

Source: [shared.ts](/Users/Lilicurl/Documents/git/social-engagement/scripts/seed-corpus/shared.ts)

The SQL matcher allows seed articles to bypass freshness cutoff because `is_protected = true`.

Source: [schema.sql](/Users/Lilicurl/Documents/git/social-engagement/database/schema.sql)

That means the system currently matches mostly against a frozen anchor corpus, not a living stream of recent engineering writing.

### 6. Matching happens before generation

The system currently tries to match using findings, before post generation.

Source: [process-job.ts](/Users/Lilicurl/Documents/git/social-engagement/src/worker/process-job.ts)

This has a major tradeoff:

- pro: cheaper and cleaner than matching generated prose
- con: it loses the richer language that appears in the final draft

Many published posts may be more matchable than the current findings.

### 7. Commit description is too shallow

`enrichCommit()` stores only the first line of the commit message:

`raw.commit.message.split('\n')[0]`

Source: [commit-enricher.ts](/Users/Lilicurl/Documents/git/social-engagement/src/github/commit-enricher.ts)

So the matcher currently misses:

- commit body detail
- changed symbol names
- ADR titles
- migration intent
- why-level narrative

## Why These Findings Are Good For Posts But Bad For Matching

Post generation and article matching have different optimization targets.

Post-oriented text should be:

- explainable
- reusable
- human
- principle-driven

Matching text should be:

- dense with concrete terms
- close to article vocabulary
- specific about mechanism and domain

Example:

- post-friendly: `Validating config at startup catches typos early.`
- retrieval-friendly: `Zod config schema validation for startup configuration with required environment variables and safeParse gating.`

The first is better writing.
The second is better retrieval.

The current system uses one sentence for both jobs.
That is the design mistake.

## Goals

1. Make important commits produce retrieval-friendly narratives.
2. Preserve good social-writing findings for post generation.
3. Improve recall without flooding posts with weak industry context.
4. Activate live corpus freshness beyond the seed set.
5. Support historical audits and backfills.

## Non-Goals

1. We are not trying to match every commit.
2. We are not trying to force industry context into all posts.
3. We are not replacing the analysis pipeline with a generic LLM summarizer.

## Proposed Fixes

### A. Split Findings Into Two Surfaces

Add a second text surface for each finding:

- `plainLanguage`
  used for post generation
- `retrievalText`
  used for article matching

Optional extra fields:

- `retrievalTerms: string[]`
- `entityHints: string[]`
- `changeSummary: string`

Rules:

- `plainLanguage` remains human and reusable
- `retrievalText` is concrete and term-dense
- retrieval must preserve product and mechanism names

Example for KMS:

- `plainLanguage`:
  `Encrypting tenant tokens behind a dedicated trust boundary reduces the blast radius of credential storage.`
- `retrievalText`:
  `KMS-backed envelope encryption for tenant secrets using DEK generation, KMS wrap/unwrap, AES-256-GCM sealing, and encrypted token storage.`

### B. Add Security Patterns For Secret Management

Extend the `security` module with positive security-hardening patterns:

- `envelope encryption`
- `KMS integration`
- `secret wrapping / unwrapping`
- `crypto sealing with AES-GCM`
- `key rotation / token re-encryption`
- `credential storage boundary hardening`

Detection clues:

- `KeyManagementServiceClient`
- `encrypt(`
- `decrypt(`
- `createCipheriv`
- `createDecipheriv`
- `aes-256-gcm`
- `randomBytes`
- `authTag`
- `encrypted_dek`
- `wrapDek`
- `unwrapDek`
- `sealTenantSecrets`
- `resolveTenantSecrets`

Scoring:

- `envelope encryption`: 9
- `secret storage hardening`: 8
- `key rotation`: 8

Important:

- These are not “concerns”.
- They are positive security improvements.

### C. Reduce Over-General Integration Findings

The `integration` module should not emit generic vendor hits when a more specific security or domain signal exists.

Changes:

- run service detection only when no stronger module-specific signal exists in the same diff
- downgrade generic `Supabase integration` findings when the commit clearly centers on security or storage hardening
- add optional `specificity_score` so low-specificity findings lose tie-breaks
- remove or tighten overly broad patterns like raw `createClient()` that can match many unrelated libraries and setup code paths

### D. Add Commit Narrative Synthesis

Introduce a cheap, deterministic `match narrative` builder before retrieval.

Inputs:

- commit subject
- commit body
- top findings
- changed filenames
- added identifiers
- security / infra / domain lexicon hits

Output:

- `matchNarrative`
- `retrievalQuery`

This should be hybrid, not user-message-only and not LLM-only.

Preferred strategy:

1. trust the user commit subject as an intent hint
2. enrich it from code and findings
3. produce one concrete retrieval string

Example for progressive voice:

`Phase 3 progressive voice system for social post generation, adding voice stages, exposure examples, voice moves, opening-move variety constraints, scanner-derived feedback, and dedicated voice spec extraction.`

### E. Enrich Retrieval Query Construction

Replace `embed(finding.plainLanguage)` with a structured query composer.

Proposed retrieval input shape:

```text
Commit: feat: add kms-backed tenant token encryption
Finding: envelope encryption for tenant secrets
Mechanism: KMS wrap/unwrap, DEK generation, AES-256-GCM sealing
Entities: tenant tokens, encrypted_dek, rotate-tenant-tokens
Files: src/security/tenant-secrets.ts, scripts/rotate-tenant-tokens.ts
```

Construction rules:

- include commit subject
- include finding headline
- include technical detail
- include context hint
- include top changed file names
- include notable added identifiers
- preserve vendor names and acronyms
- deduplicate generic prose

### F. Calibrate Retrieval For Recall First

Stage 1 should become candidate generation, not hard classification.

New behavior:

- default threshold reduced from `0.75` to `0.35`
- always return top `5-8` candidates when available
- let Stage 2 decide `strong | weak | none`

Alternative acceptable design:

- remove threshold entirely
- use top-k only

Rationale:

- current corpus similarities are much lower than assumed
- Stage 2 already exists to reject weak candidates

### G. Make Stage 2 Slightly More Useful

Current Stage 2 only accepts `strong`.

New behavior:

- keep `strong` for direct injection
- record `weak` as telemetry
- optionally allow `weak` when:
  - similarity is above a fallback threshold
  - commit ranking is high
  - the connection sentence is concrete

Not for v1 of this correction:

- do not inject weak matches into production posts yet
- store them for analysis

### H. Activate The Live Corpus

The content system should not operate mainly on `curated-seed`.

Required operational corrections:

1. verify scheduled `content-fetch` runs are happening
2. confirm `promoteQueuedSources()` is advancing sources weekly
3. add dashboard counters:
   - active sources
   - queued sources
   - articles fetched this week
   - non-seed content_items this week
4. alert if active non-seed sources == 0

Product rule:

- seed corpus remains a protected floor
- live sources become the primary freshness layer

### I. Add Post-Level Historical Audit Mode

Add an audit script that can evaluate:

- commit findings -> match result
- generated draft -> match result
- published post -> match result

This is for offline analysis, not production generation.

Use cases:

- understand whether post text is more matchable than findings
- compare commit-match vs post-match recall
- backfill historical analytics

### J. Add Backfill For Existing Posts

Historical `voice_posts` currently have null context fields.

Add a backfill workflow:

1. select historical rows with `context_status is null`
2. reconstruct best available retrieval input
3. attempt commit-level match when commit is still available
4. fallback to `ai_draft`
5. optionally fallback to `published`
6. store:
   - `context_status`
   - `matched_article_id`
   - `matched_source_id`
   - `match_strength`
   - `match_connection`
   - `match_mode = commit | draft | published`

## Product Decision: How Should Commit Description Work?

Use a hybrid model.

Do not rely only on the user-written commit subject.
Do not replace the subject with a pure code-generated summary.

Preferred policy:

- commit subject = intent hint
- commit body = author rationale
- code analysis = mechanism truth
- retrieval narrative = merged output of all three

This keeps the human signal while preventing vague or misleading messages from dominating retrieval.

## Proposed Data Model Changes

### Finding shape

Add:

- `retrievalText?: string`
- `retrievalTerms?: string[]`
- `specificityScore?: number`

### voice_posts

Add optional audit metadata:

- `match_mode text`
- `match_candidate_titles text[]`
- `match_debug jsonb`

### content pipeline telemetry

Add metrics or persisted counters:

- `non_seed_articles_7d`
- `active_non_seed_sources`
- `retrieval_zero_candidate_rate`
- `stage2_strong_rate`
- `stage2_weak_rate`

## Rollout Plan

### Phase 1: Analyzer and Retrieval Shape

- add security patterns for KMS / envelope encryption
- add `retrievalText` to findings
- add query composer
- lower retrieval threshold
- log candidate counts and top similarities

Success criteria:

- representative commits produce 3-5 candidates instead of 0
- KMS commit surfaces a security finding

### Phase 2: Corpus Freshness

- verify content-fetch execution
- activate non-seed sources
- add freshness dashboard and alerts

Success criteria:

- more than one active source
- non-seed articles ingested weekly

### Phase 3: Audit and Backfill

- build audit tool
- run March-April historical study
- backfill legacy `voice_posts`

Success criteria:

- measurable strong/weak/no-match rates
- known historical commits can be analyzed consistently

### Phase 4: Match Quality Review

- inspect `weak` matches offline
- decide whether weak matches can ever be surfaced
- refine analyzer wording and lexicon expansion

## Acceptance Tests

1. `feat: add kms-backed tenant token encryption`
   Expected:
   - top finding is `security`
   - retrieval query contains `KMS`, `envelope encryption`, `AES-256-GCM`, `tenant secrets`
   - Stage 1 returns at least 3 candidates

2. `feat: implement phase 3 progressive voice system`
   Expected:
   - commit still may include `evolutionary`
   - retrieval query includes `progressive voice`, `voice stages`, `exposure`, `opening_move`, `voice moves`
   - Stage 1 returns non-zero candidates or explicitly logs low-recall

3. `feat: add observability module...`
   Expected:
   - observability finding returns tracing/logging-related candidates
   - Stage 2 classifies at least one candidate as `weak` or `strong`

## Open Questions

1. Should security hardening live inside `security`, or do we want a dedicated `secrets_management` analyzer?
2. Should retrieval use only top 1 finding, or all top 3 merged into one query?
3. Should historical post-level match ever influence future real-time production matching?
4. Should live content fetch run more often than weekly once sources are active?

## Recommendation

Start with:

1. security analyzer expansion
2. retrieval text split
3. top-k retrieval with much lower threshold
4. historical audit mode
5. live corpus activation checks

This gives the highest recall improvement with the lowest architectural risk.
