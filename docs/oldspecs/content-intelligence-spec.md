# Phase 2 — Content Intelligence Agent — Design Spec

**Status:** Draft v10 — reviewed 2026-04-06

---

## Goal

When devcast generates a post about a user's commit, connect it with what the industry is discussing. If a user builds a circuit breaker and Netflix just published about their circuit breaker failures — the post becomes 10x more relevant.

Fallback: if no match found, generate a normal code analysis post (current behavior, always available).

---

## Prerequisite: AI Agnosticism

All LLM and embedding interactions go through interfaces. No SDK imported outside of adapter files.

```typescript
// src/ai/types.ts
export interface IAIClient {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
  readonly model: string;
}

export interface IEmbedder {
  embed(text: string): Promise<number[]>;
  readonly dimensions: number;
}
```

```typescript
// src/ai/factory.ts
export function createAIClient(provider: string, apiKey: string, model: string, maxTokens: number): IAIClient;
export function createEmbedder(provider: string, apiKey: string): IEmbedder;
```

V1 implementations: `AnthropicAdapter` + `OpenAIEmbedder`. Swappable without touching pipeline code.

Config:
```yaml
ai:
  provider: "anthropic"
  model: "claude-sonnet-4-6"
  max_tokens: 1600
  classify_model: "claude-haiku-4-5"   # cheaper model for classification + cross-encoding
embeddings:
  provider: "openai"
  model: "text-embedding-3-small"
```

### New secrets required

| Secret | Purpose | Where |
|--------|---------|-------|
| `OPENAI_API_KEY` | Embedding articles and findings | GitHub Actions + Cloud Run |

`ANTHROPIC_API_KEY` already exists — used for both Sonnet (post generation) and Haiku (classification + cross-encoding).

### Batch API usage (50% discount on both providers)

Both Anthropic and OpenAI offer Batch APIs with 50% discount for async processing. The weekly CRON is not time-sensitive — results can wait up to 24 hours.

| Provider | Regular | Batch (50% off) | Used for |
|----------|---------|-----------------|----------|
| Anthropic Haiku input | $1.00/MTok | $0.50/MTok | Classifier, cross-encoder |
| Anthropic Haiku output | $5.00/MTok | $2.50/MTok | Classifier, cross-encoder |
| OpenAI text-embedding-3-small | $0.02/MTok | $0.01/MTok | Article chunk embeddings |

The classifier and embedder in the weekly CRON submit work via Batch API. The cross-encoder in the per-commit pipeline runs in real-time (not batched) since it needs immediate results for post generation.

---

## Architecture Overview

```
[CRON monthly — discover-sources.yml]
Reference repos (OPML) → RSS auto-discovery → add in batches of 20/week

[CRON weekly — content-fetch.yml]
Promote 20 queued sources → active
Fetch RSS from active sources
  → extract full article text (@extractus/article-extractor)
  → dedup (exact title hash + fuzzy similarity)
  → pre-skip (changelogs, release notes, < 300 words)
  → structural score (free, all articles)
  → top 3 per source (best by structural score)
  → AI classify (IAIClient, Haiku Batch API)
  → chunk (recursive 512-token)
  → embed chunks (IEmbedder, OpenAI Batch API)
  → store in Supabase (pgvector)
  → update source stats + log summary

[In post-generation pipeline — per commit]
Finding → pgvector match → AI cross-encoder → inject if strong match
  → update matched_count on source + times_matched on article
```

---

## Layer 1 — Source Registry

### Discovery

Two community-maintained GitHub repos serve as market intelligence:
- `tuan3w/awesome-tech-rss` (~180 sources, includes RSS URLs, OPML file)
- `kilimchoi/engineering-blogs` (~400 sources, homepage URLs + OPML file)

These repos are NOT the feed. They are input for discovering new sources. The system's own registry decides what to fetch based on measured performance.

New sources from repos are added in batches of 20/week, prioritizing sources that appear in BOTH repos first.

### RSS Auto-Discovery

`kilimchoi/engineering-blogs` lists homepage URLs, not RSS URLs. Before adding a source, the system must find the RSS feed:

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

Sources without a discoverable RSS feed are logged and skipped — not added to the registry.

### Source Schema

```sql
CREATE TABLE content_sources (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  url                 TEXT NOT NULL UNIQUE,
  rss_url             TEXT NOT NULL,
  trust               TEXT NOT NULL DEFAULT 'open',   -- 'curated' | 'verified' | 'open'
  status              TEXT NOT NULL DEFAULT 'queued',   -- 'queued' | 'active' | 'probation' | 'disabled' | 'unreachable'
  -- quality stats
  articles_evaluated  INTEGER NOT NULL DEFAULT 0,
  articles_passed     INTEGER NOT NULL DEFAULT 0,
  best_score_30d      INTEGER NOT NULL DEFAULT 0,
  -- value stats (the metric that actually matters)
  matched_count       INTEGER NOT NULL DEFAULT 0,
  last_matched_at     TIMESTAMPTZ,
  -- health stats
  fetch_failures      INTEGER NOT NULL DEFAULT 0,
  last_fetch_ok_at    TIMESTAMPTZ,
  -- lifecycle
  added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at         TIMESTAMPTZ,
  discovered_from     TEXT    -- 'awesome-tech-rss' | 'engineering-blogs' | 'both' | 'manual'
);
```

### Trust Assignment

| Trust | Meaning | Examples |
|-------|---------|----------|
| `curated` | Company engineering blog or editorially reviewed | Netflix, Stripe, Cloudflare, ByteByteGo |
| `verified` | Individual with established track record | Martin Fowler, Julia Evans |
| `open` | Open platform, anyone can publish | dev.to, Medium, Hashnode |

Trust is assigned manually when adding sources. Sources discovered from repos default to `verified` if they appear in both repos, `open` otherwise. Manual override via `sources.yml`.

### Source Lifecycle

```
Discovered in reference repo
    ↓
RSS auto-discovery → found? → INSERT as status='queued'
                   → not found? → skip, log

[content-fetch.yml promotes 20 queued sources per run]
SELECT ... WHERE status = 'queued' ORDER BY
  (discovered_from = 'both') DESC,   -- prioritize double-validated
  added_at ASC                        -- oldest first
LIMIT 20
→ UPDATE status = 'active'

active (evaluation begins)
    ↓
After 10 articles evaluated:
    ├── hit_rate >= 20%          → active (stays)
    ├── hit_rate < 20%           → probation (10 more articles)
    │       ├── improves         → active
    │       └── no               → disabled
    └── best_score_30d >= 8      → active (ALWAYS, even if hit_rate is low)

matched_count evaluation (only when articles_passed >= 20 AND age >= 90 days):
    └── matched_count = 0        → probation (content is quality but not useful)

fetch_failures >= 5 consecutive  → unreachable (retry weekly, NOT a quality issue)
fetch OK again                   → reset fetch_failures, back to active

disabled + repo still lists it 6 months later → active (second chance)
```

Key rules:
- `best_score_30d >= 8` protects prolific sources that produce occasional gems
- `matched_count` only evaluated after sufficient sample (articles_passed >= 20 AND age >= 90 days)
- Infrastructure failure (RSS down) never confused with quality failure
- Martin Fowler (publishes rarely) never reaches 10 evaluated articles → stays active indefinitely

---

## Article Text Extraction

RSS feeds only provide title, summary (often truncated), and a link. To classify and embed, we need the full article text.

### Feasibility

This step MUST be validated before building the rest of the pipeline. A spike test must confirm:
- What percentage of the top 30 curated sources are extractable?
- What percentage of the full source list is extractable?
- What's the average extraction time per article?

**Acceptance criteria:** >= 80% of curated sources must be extractable. If < 80%, the extraction approach must be revised before proceeding.

### Approach

Use `@extractus/article-extractor` as primary extractor.

**Why this library over alternatives:**
- `readability` (Mozilla): DOM-only, requires `jsdom` in Node.js — heavy dependency, slower
- `mercury-parser` (Postlight): unmaintained since 2023, archived repo
- `trafilatura` (Python): requires Python runtime, incompatible with our Node.js stack
- `@extractus/article-extractor`: pure Node.js, actively maintained (weekly releases), handles RSS/Atom metadata, MIT license, ~50KB unpacked. Best fit for our stack.

```typescript
// src/content/article-extractor.ts
import { extract } from '@extractus/article-extractor';

export async function extractArticle(url: string): Promise<ArticleText | null> {
  try {
    const article = await extract(url, {
      timeout: 30000,  // 30s max per article
    });
    if (!article || !article.content) return null;
    const text = stripHtml(article.content);
    if (countWords(text) < 100) return null;  // too short = extraction failed partially
    return {
      title: article.title ?? '',
      text,
      wordCount: countWords(text),
      publishedAt: article.published ? new Date(article.published) : null,
    };
  } catch {
    return null;
  }
}
```

### Rate limiting

500 HTTP fetches in one CRON run can trigger rate limits. Mitigations:
- Concurrent limit: max 5 parallel fetches (p-limit)
- Per-domain delay: 15 second between requests to the same domain
- User-Agent: `devcast/1.0 (+https://devcast.lilicurl.com)` — identify ourselves, don't pretend to be a browser
- Timeout: 30 seconds per article, skip on timeout

### What fails and how we handle it

| Failure | Frequency | Handling |
|---------|-----------|---------|
| JavaScript-rendered content (SPA) | ~5% of blogs | Skip — not worth headless browser for V1 |
| Paywalls | ~3% | Skip — RSS entry still has title/summary for dedup |
| Anti-bot / Cloudflare challenge | ~2% | Skip — retry next week, may resolve |
| Malformed HTML / partial extraction | ~5% | `wordCount < 100` guard catches these → skip |
| **Total expected failure rate** | **~10-15%** | **Logged, skipped, not retried until next fetch cycle** |

Extraction failures are NOT source quality failures. `content_sources.fetch_failures` only increments for RSS feed failures, not article extraction failures.

---

## Dedup (two-step, before classification)

### Step 1 — Exact title match (free, instant)

Hash of `lowercase(title)`. If an identical title exists in content_items → skip. Catches identical cross-posts.

### Step 2 — Fuzzy similarity for similar titles (free, ~1ms)

Only runs when Step 1 doesn't match. If a stored article has a title with > 70% Jaccard word similarity, compare the first 200 words of both articles. If word overlap > 85% → skip. Catches rewritten cross-posts (slightly different title, same content).

```typescript
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}
```

---

## Layer 2 — Structural Filter (free, two phases)

All filtering before AI. Reduces articles reaching the classifier from ~400 to ~120, saving ~60% of classification cost.

### Phase 1 — Pre-skip (title-level, instant)

Discard articles that are never worth classifying, regardless of source or content:

```typescript
function shouldSkip(title: string, wordCount: number): boolean {
  // Non-analytical content patterns
  if (/changelog|release notes|what's new|weekly roundup|newsletter|digest/i.test(title)) return true;

  // Too short — likely partial extraction or announcement
  if (wordCount < 300) return true;

  return false;
}
```

### Phase 2 — Structural scoring (content-level)

Scores article content for depth signals.

### Phase 3 — Top 3 per source (after scoring, before classifier)

After structural scoring, if a source has > 3 articles this week, only the top 3 by structural score go to the classifier. This prevents a prolific source from consuming the entire AI budget while ensuring the BEST articles from that source are selected.

```typescript
// Group by source_id, sort by structuralScore DESC, take top 3 per group
const budgetCapped = groupBySource(articles)
  .flatMap(([_sourceId, group]) =>
    group.sort((a, b) => b.structuralScore - a.structuralScore).slice(0, 3)
  );
```

Pipeline order: pre-skip → structural score → top 3/source → classify.

### Structural scoring function

```typescript
interface StructuralSignals {
  wordCount: number;
  codeBlockCount: number;
  hasMetrics: boolean;          // regex: /\d+\s*(ms|rps|%|MB|GB|req\/s|p99|latency|throughput)/i
  hasTradeoffs: boolean;        // regex: /trade.?off|however|downside|chose .+ over|instead of/i
  hasProdContext: boolean;      // regex: /in production|at scale|our (system|service|platform)|we (run|operate|serve)/i
  isTutorialPattern: boolean;   // regex: /getting started|step[- ]by[- ]step|beginner|how to .+ in \d/i
}

function structuralScore(s: StructuralSignals, trust: Trust): number {
  let score = 0;
  if (s.wordCount >= 800) score += 2;
  if (s.codeBlockCount >= 2) score += 2;
  if (s.hasMetrics) score += 2;
  if (s.hasTradeoffs) score += 2;
  if (s.hasProdContext) score += 2;
  if (s.isTutorialPattern) score -= 4;

  // Source trust bonus — reputation buys benefit of the doubt
  if (trust === 'curated') score += 3;
  if (trust === 'verified') score += 1;

  return score; // gate >= 4
}
```

Why trust bonus matters: a 500-word post without code from Martin Fowler (verified, +1) about architecture concepts gets score = 0 + 0 + 0 + 2 + 2 + 1 = 5 → passes. Same post from an unknown blog: score = 4 → borderline. Netflix Engineering (curated, +3): always passes unless it's a tutorial pattern.

---

## Layer 3 — AI Depth Scoring

Only articles that pass Layer 2 (~120/week after pre-skip filter). Uses `IAIClient` with Haiku model (never SDK directly).

### Batch API (50% discount)

Classification is NOT time-sensitive — the CRON runs weekly and results can wait up to 24 hours. Anthropic's Batch API provides 50% discount for async processing.

The weekly CRON submits all ~120 articles as a single batch request, polls for completion, then processes results. No real-time pressure.

**Batch timeout plan:** Anthropic's Batch API SLA is up to 24 hours. For ~120 Haiku requests, expect completion in 5-15 minutes. GitHub Actions timeout is 6 hours. If the batch does not complete within 2 hours, the CRON logs `content.batch.timeout`, stores the batch ID, and exits. The next weekly run checks for pending batch results before submitting new work. Lost batch = retry next week (articles re-fetched, re-classified). Same strategy applies to OpenAI embedding batches.

### Input: full article text (no truncation)

The classifier receives the FULL extracted article text, not a truncated version. With Batch API pricing, sending 2000 words (~2,600 tokens) per article costs ~$0.0013/article. Truncation would save ~$0.0005/article but risks missing important signals in the middle or end of the article. Not worth the quality tradeoff.

### Prompt

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
  "summary": "<2-3 sentence summary of the article>",
  "main_thesis": "<one sentence core argument>",
  "key_insights": ["<insight 1>", "<insight 2>"],
  "tech_concepts": ["<concept 1>", "<concept 2>"]
}
```

Gate: `quality_score >= 6`

### JSON parse failure handling

The LLM returns malformed JSON ~2-5% of the time. Strategy:
1. First attempt: `JSON.parse(response)`
2. If fails: retry the same `IAIClient.complete()` call once (different sampling = different output)
3. If fails again: log `classify.json_error` + skip this article. Not a source quality failure.

Expected loss: ~0.1% of articles (2-5% fail rate × retry success ~95%).

Gate is 6 because LLM scoring is non-deterministic — the same article can get 6 or 7 on different runs. A borderline article stored costs nothing. A good article discarded is a loss. The matching cross-encoder is the real quality filter.

The prompt uses descriptive bands (1-3, 4-6, 7-8, 9-10) instead of a rubric with weights. This is more reliable — the LLM reasons about the band the article belongs to rather than computing a score from sub-components.

The `summary` field is generated here (not from RSS or extraction). This is the only reliable way to get a consistent summary.

---

## Chunking Strategy

Articles that pass classification are split into chunks for granular embedding and matching. A finding about "circuit breaker" should match the paragraph about circuit breakers, not the whole article.

### Approach: recursive 512-token chunking

```typescript
// src/content/chunker.ts
const CHUNK_SIZE = 512;    // tokens (approximate via word count × 1.3)
const CHUNK_OVERLAP = 64;  // tokens — ensures context isn't lost at boundaries

export function chunkArticle(text: string): string[] {
  // 1. Split by paragraphs (double newline)
  // 2. Accumulate paragraphs until CHUNK_SIZE reached
  // 3. Start next chunk with CHUNK_OVERLAP tokens from end of previous
  // 4. Code blocks: never split mid-block — include whole block in chunk
  //    (if a code block > CHUNK_SIZE, it becomes its own chunk)
}
```

Average article (~1500 words) produces ~5 chunks. ~50 stored articles/week × 5 = ~250 chunks embedded per week.

### Code block handling

Code blocks are detected by markdown fences (```) or indentation (4+ spaces). A code block is never split across chunks. If a code block exceeds CHUNK_SIZE, it becomes its own standalone chunk — code examples are high-signal for technical matching.

---

## Content Storage

**Embedding dimensions are provider-dependent.** OpenAI text-embedding-3-small = 1536. Switching embedding provider requires: schema migration + re-embed all stored content. This is an accepted tradeoff — switching providers is rare and a full re-embed of ~3000 articles costs ~$0.06.

```sql
CREATE TABLE content_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       UUID REFERENCES content_sources(id),
  fetched_at      TIMESTAMPTZ DEFAULT NOW(),
  week_of         DATE NOT NULL,
  url             TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  content_text    TEXT NOT NULL,         -- full extracted article text (enables re-classification)
  summary         TEXT NOT NULL,         -- AI-generated summary from classifier
  main_thesis     TEXT NOT NULL,
  key_insights    TEXT[] NOT NULL,
  tech_concepts   TEXT[] NOT NULL,
  quality_score   INTEGER NOT NULL,
  times_matched   INTEGER NOT NULL DEFAULT 0,
  title_hash      TEXT NOT NULL,         -- SHA-256 of lowercase(title), for exact dedup
  fingerprint     TEXT NOT NULL           -- first 200 words lowercase, for fuzzy dedup
);

CREATE TABLE article_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
  chunk_index     INTEGER NOT NULL,
  chunk_text      TEXT NOT NULL,
  embedding       vector(1536),
  UNIQUE(content_item_id, chunk_index)
);

CREATE INDEX idx_title_hash ON content_items(title_hash);

CREATE INDEX ON article_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m=16, ef_construction=64);
```

Embeddings are generated via OpenAI Batch API (50% discount, $0.01/MTok). ~250 chunks/week × ~500 tokens = 125K tokens → ~$0.001/week.

`content_text` is stored to enable re-classification when changing AI models or prompts, without re-extracting from the source URL (which may have changed or gone offline).

Content expires: `DELETE WHERE week_of < NOW() - 45 days` (monthly cleanup CRON).

Row-level security (consistent with existing schema):
```sql
ALTER TABLE content_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_chunks  ENABLE ROW LEVEL SECURITY;
-- No public policies. Access only via SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
```

---

## Matching Pipeline (per commit, inside post-generation)

### Stage 1 — pgvector bi-encoder (~5ms + 1 embedding call)

```
1. Embed finding.plainLanguage with IEmbedder (real-time, ~200ms)
2. Cosine similarity against article_chunks
3. Group results by content_item_id (deduplicate — 3 chunks from same article = 1 candidate)
4. Take best chunk per article
5. Top 3 unique articles, threshold > 0.75
6. Filter: week_of >= NOW() - 30 days, quality_score >= 6
```

Matching window is 30 days (aligned with storage of 45 days, with buffer).

**Chunk-to-article dedup:** Stage 1 returns chunks, but the cross-encoder needs articles. Multiple chunks from the same article are collapsed — only the highest-similarity chunk per article counts. This ensures 3 candidates = 3 unique articles.

**Failure handling:** The embedding call to IEmbedder (OpenAI) is in the post-generation critical path. If it fails (timeout, rate limit, provider down), the matching pipeline is skipped entirely — the commit gets a normal code analysis post without industry context. Graceful degradation, not crash.

```typescript
try {
  const matchedContext = await matchFindingsToArticles(findings, embedder, aiClient, db);
  if (matchedContext) {
    // inject into prompt
  }
} catch (err) {
  logger.warn('content.match.skipped', { error: String(err) });
  // continue without industry context — normal post
}
```

### Stage 2 — AI cross-encoder (IAIClient)

One batched call per finding (not one per candidate). All candidates evaluated in a single prompt:

```
You are deciding if a developer's code change is related to an industry article.

Code change (finding):
- Module: {finding.moduleId}
- Headline: {finding.headline}
- Context: {finding.plainLanguage}
- File: {finding.contextHint}

Candidate articles:
1. "{article1.title}" — Thesis: {article1.main_thesis}. Insights: {article1.key_insights.join(', ')}
2. "{article2.title}" — Thesis: {article2.main_thesis}. Insights: {article2.key_insights.join(', ')}
3. "{article3.title}" — Thesis: {article3.main_thesis}. Insights: {article3.key_insights.join(', ')}

For each candidate, respond:
- strength: "strong" (direct connection), "weak" (tangential), or "none"
- connection: one sentence explaining how the code relates to the article (only if strong)

Respond as JSON array:
[
  { "candidate": 1, "strength": "strong", "connection": "..." },
  { "candidate": 2, "strength": "none", "connection": null },
  { "candidate": 3, "strength": "weak", "connection": null }
]
```

**Cost optimization:** 1 AI call per finding (batched), not 1 per candidate. A commit with 3 findings = 3 AI calls, not 30.

Only `strength === 'strong'` passes to Stage 3.

**JSON parse failure:** same strategy as classifier — retry once, then skip matching for this finding (graceful degradation, not crash).

### Stage 3 — Inject into prompt

```xml
<industry_context>
Connection: [one sentence from cross-encoder]
You built this. The industry is discussing what you already practice.
</industry_context>
```

After injection:
```sql
UPDATE content_items SET times_matched = times_matched + 1 WHERE id = matched_article_id;
UPDATE content_sources SET matched_count = matched_count + 1, last_matched_at = NOW() WHERE id = source_id;
```

No match → normal code analysis post (current behavior, no degradation).

---

## Workflows

```yaml
# discover-sources.yml — monthly CRON (1st of each month, 8am CLT)
schedule:
  - cron: '0 12 1 * *'
# Fetch OPML from tuan3w/awesome-tech-rss + kilimchoi/engineering-blogs
# For each new source not already in content_sources:
#   1. RSS auto-discovery (find RSS URL from homepage)
#   2. If found → INSERT into content_sources (status='queued')
#   3. If not found → log and skip
# All new sources start as 'queued'. The weekly fetch promotes them.
# Also supports: workflow_dispatch for manual runs

# content-fetch.yml — weekly (Sunday 6am CLT = 10:00 UTC)
schedule:
  - cron: '0 10 * * 0'
#
# STEP A: Promote queued sources (max 20 per run)
# SELECT FROM content_sources WHERE status = 'queued'
#   ORDER BY (discovered_from = 'both') DESC, added_at ASC LIMIT 20
# UPDATE status = 'active'
#
# STEP B: Fetch articles from active sources
# SELECT FROM content_sources WHERE status IN ('active', 'probation', 'unreachable')
# For unreachable: just try RSS fetch, if OK reset fetch_failures
# For active/probation:
#   1. Fetch RSS → list of article URLs
#   2. Extract full text (rate-limited: 5 concurrent, 15s delay per domain)
#   3. Dedup: exact title hash, then fuzzy similarity
#   4. Structural filter
#   5. AI classify → parse JSON (retry 1x on parse failure, then skip)
#   6. Chunk article (recursive 512-token)
#   7. Embed chunks (IEmbedder)
#   8. Store in content_items + article_chunks
# Update source stats: articles_evaluated, articles_passed, best_score_30d, fetch_failures
#
# STEP C: Log run summary
# Log: sources_active, sources_queued, articles_fetched, articles_extracted,
#       articles_passed, extraction_failures, classify_failures, embed_failures

# content-cleanup.yml — monthly (15th of each month)
schedule:
  - cron: '0 12 15 * *'
# DELETE content_items WHERE week_of < NOW() - 45 days
# Evaluate source lifecycle:
#   - articles_evaluated >= 10 AND hit_rate < 20% AND best_score_30d < 8 → probation
#   - probation for 10+ more articles without improvement → disabled
#   - articles_passed >= 20 AND age >= 90d AND matched_count = 0 → probation
#   - fetch_failures >= 5 → unreachable
```

---

## Funnel (steady state numbers)

```
~250 active sources
    ↓ RSS fetch weekly
~500 articles (title + link from RSS)
    ↓ Article text extraction (~10-15% fail → skip)
~430 with full text
    ↓ Dedup (exact title hash + fuzzy similarity)
~400 unique
    ↓ Pre-skip (changelogs, release notes, < 300 words)
~350 pass
    ↓ Structural scoring (free, all 350)
~180 pass gate >= 4
    ↓ Top 3 per source (best by structural score)
~120 to classifier
    ↓ AI depth scoring (Haiku Batch API, full article text, 50% off)
~50 stored (quality_score >= 6)
    ↓ Chunking (~5 chunks/article avg)
~250 chunks embedded (OpenAI Batch API, 50% off)
    ↓ Matching with findings (per commit, pgvector + cross-encoder)
 2-5 matches/week injected into prompts
```

---

## Costs (per week, steady state)

### Fixed costs (global, shared across all users)

The content pipeline runs once per week. Articles are stored globally — every user benefits from the same corpus.

| Operation | Provider | Cost/week | Cost/month |
|-----------|----------|-----------|------------|
| RSS fetch + article extraction | — | $0 | $0 |
| Dedup + structural + pre-skip | — | $0 | $0 |
| AI classify ~120 articles, full text (Haiku Batch, 50% off) | Anthropic | ~$0.16 | ~$0.64 |
| Embed ~250 chunks (text-embedding-3-small Batch, 50% off) | OpenAI | ~$0.001 | ~$0.005 |
| **Fixed total** | | **~$0.16** | **~$0.64** |

### Per-user costs (scale with number of users and commits)

Each commit triggers matching (embed finding + cross-encoder). Post generation is the existing cost.

| Operation | Provider | Cost/commit | Calculation |
|-----------|----------|-------------|-------------|
| Embed finding for matching (real-time) | OpenAI | ~$0.00007 | ~100 tokens × $0.02/MTok |
| Cross-encoder, 1 call per finding × 3 findings (Haiku, real-time) | Anthropic | ~$0.005 | 3 × (500 input × $1/MTok + 200 output × $5/MTok) |
| Post generation (Sonnet, already exists) | Anthropic | ~$0.006 | ~1950 input × $3/MTok + ~900 output × $15/MTok |
| **Per commit total** | | **~$0.011** | |

### Unit economics at scale

| Users | Posts/month | Fixed cost | Variable cost | Total | Revenue @$5/user | Margin |
|-------|-----------|------------|--------------|-------|-------------------|--------|
| 1 | 10 | $0.65 | $0.11 | $0.76 | $5 | 85% |
| 10 | 100 | $0.65 | $1.10 | $1.75 | $50 | 96% |
| 100 | 1,000 | $0.65 | $11.00 | $11.65 | $500 | 98% |
| 1,000 | 10,000 | $0.65 | $110.00 | $110.65 | $5,000 | 98% |

The content pipeline is a fixed cost that dilutes with more users. More users = better margin.

---

## Implementation Order

| # | Step | Dependencies | Files |
|---|------|-------------|-------|
| 0 | AI agnosticism + secrets (see detail below) | none | src/ai/types.ts, src/ai/anthropic-adapter.ts, src/ai/openai-embedder.ts, src/ai/factory.ts, src/ai/post-generator.ts, src/worker/process-job.ts, src/main-poll.ts, src/config/schema.ts |
| 1 | Source registry + content schema + pgvector | none | database/schema.sql, src/content/types.ts |
| 2 | RSS auto-discovery | none | src/content/rss-discovery.ts |
| 3 | **Spike: extraction feasibility** | none | src/content/article-extractor.ts — standalone script, test against 30 hardcoded article URLs from curated sources, must pass >= 80% |
| 4 | OPML importer + discover workflow | step 1 + step 2 | src/content/opml-importer.ts, .github/workflows/discover-sources.yml |
| 5 | RSS fetcher | step 1 | src/content/rss-fetcher.ts |
| 6 | Dedup (exact hash + fuzzy) | step 3 | src/content/dedup.ts |
| 7 | Pre-skip + structural filter + top 3/source | step 6 | src/content/structural-filter.ts |
| 8 | AI classifier (Haiku Batch API) | step 0 + step 7 | src/content/classifier.ts |
| 9 | Chunker | step 3 | src/content/chunker.ts |
| 10 | Embedder + chunk storage (OpenAI Batch API) | step 0 + step 9 | src/content/embedder.ts, src/content/content-storage.ts |
| 11 | Matcher Stage 1 (pgvector, dedup by article) | step 10 | src/content/matcher.ts |
| 12 | Matcher Stage 2 (cross-encoder, batched prompt) | step 11 | src/content/matcher.ts |
| 13 | Prompt injection + generatePosts signature | step 12 | src/ai/prompt-builder.ts, src/ai/post-generator.ts |
| 14 | Observability (pipeline_runs table + health report) | step 1 | database/schema.sql, src/content/health-reporter.ts |
| 15 | Source lifecycle evaluator | step 1 + step 12 + step 14 | src/content/source-evaluator.ts |
| 16 | Weekly + monthly CRONs | all | .github/workflows/content-fetch.yml, .github/workflows/content-cleanup.yml |

Steps 0, 1, 2, and 3 are independent — can be implemented in parallel.

**Step 3 is a gate.** If extraction feasibility < 80% on curated sources, stop and revise the approach before building the rest.

### Step 0 detail: AI agnosticism

This is the refactor that decouples the codebase from Anthropic SDK. All files that currently import `AnthropicClient` directly must use `IAIClient` instead.

**New files:**
- `src/ai/types.ts` — `IAIClient` + `IEmbedder` interfaces
- `src/ai/anthropic-adapter.ts` — rename of current `client.ts`, implements `IAIClient`
- `src/ai/openai-embedder.ts` — implements `IEmbedder` using OpenAI SDK
- `src/ai/factory.ts` — `createAIClient()` + `createEmbedder()` factory functions

**Modified files:**
- `src/ai/post-generator.ts` — change param type from `AnthropicClient` to `IAIClient`
- `src/worker/process-job.ts` — use factory, instantiate both `aiClient` + `embedder`
- `src/main-poll.ts` — use factory
- `src/config/schema.ts` — add `ai.classify_model`, `embeddings.provider`, `embeddings.model`

**Secrets to add (operational, no code):**
- `OPENAI_API_KEY` → GitHub Actions secrets + Cloud Run `--update-secrets`

**Batch API note:** `IAIClient.complete()` is real-time only. The Anthropic Batch API for classification is handled separately in `src/content/classifier.ts` (Step 8) — it calls the Anthropic SDK directly for batch submission, not via `IAIClient`. This is by design: batch is an infrastructure optimization, not an interface concern.

### Step 1 detail: Schema includes pgvector

Step 1 creates all 4 content tables + enables pgvector:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
-- Then content_sources, content_items, article_chunks, content_pipeline_runs
-- With HNSW index, RLS, etc.
```

### Step 13 detail: generatePosts signature change

Add optional `industryContext` parameter:
```typescript
export async function generatePosts(
  client: IAIClient,
  commit: EnrichedCommit,
  findings: Finding[],
  storage: IVoiceStorage,
  config: Config,
  recentModuleIds: string[] = [],
  industryContext?: string,          // ← NEW: injected by matcher if strong match found
): Promise<GeneratedPosts>
```

If `industryContext` is provided, `buildUserPrompt()` injects it as `<industry_context>` before the `<task>` section. If not provided, prompt is unchanged (current behavior, no degradation).

---

## Observability

Four questions the system must answer:
1. **Is the pipeline working?** — did the CRON run, did articles get stored?
2. **Is the data quality good?** — are we storing useful articles or junk?
3. **Are we always discarding the same things?** — wasted sources, wasted budget?
4. **Are we improving?** — do matches increase over time, do posts with context perform better?

### Pipeline run history

Each CRON run inserts a row into `content_pipeline_runs`. This accumulates historical data for trend analysis.

```sql
CREATE TABLE content_pipeline_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- volume
  sources_active        INTEGER NOT NULL DEFAULT 0,
  sources_queued        INTEGER NOT NULL DEFAULT 0,
  sources_promoted      INTEGER NOT NULL DEFAULT 0,
  articles_fetched      INTEGER NOT NULL DEFAULT 0,
  articles_extracted    INTEGER NOT NULL DEFAULT 0,
  extraction_failures   INTEGER NOT NULL DEFAULT 0,
  articles_deduped      INTEGER NOT NULL DEFAULT 0,
  articles_preskipped   INTEGER NOT NULL DEFAULT 0,
  articles_structural   INTEGER NOT NULL DEFAULT 0,
  articles_classified   INTEGER NOT NULL DEFAULT 0,
  articles_stored       INTEGER NOT NULL DEFAULT 0,
  chunks_embedded       INTEGER NOT NULL DEFAULT 0,
  -- quality
  avg_quality_score     REAL,
  score_distribution    JSONB,        -- {"1-3": 5, "4-6": 30, "7-8": 12, "9-10": 3}
  -- matching (from commits processed since last run)
  commits_with_match    INTEGER NOT NULL DEFAULT 0,
  commits_without_match INTEGER NOT NULL DEFAULT 0,
  match_skip_failures   INTEGER NOT NULL DEFAULT 0,
  -- errors
  classify_json_errors  INTEGER NOT NULL DEFAULT 0,
  embed_failures        INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE content_pipeline_runs ENABLE ROW LEVEL SECURITY;
```

### Structured logs per CRON

```typescript
// content-fetch.yml — end of run
logger.info('content.fetch.summary', {
  sources_active, sources_queued, sources_promoted,
  articles_fetched, articles_extracted, extraction_failures,
  articles_deduped, articles_preskipped, articles_structural,
  articles_classified, classify_json_errors,
  articles_stored, chunks_embedded,
  avg_quality_score, score_distribution,
});

// content-cleanup.yml — end of run
logger.info('content.cleanup.summary', {
  articles_expired, sources_to_probation, sources_disabled, sources_unreachable,
});
```

### Matching log per commit

```typescript
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

At the end of each content-fetch run, compare this week vs the last 4 weeks average:

```typescript
logger.info('content.health.report', {
  // Trends (↑ improving, ↓ degrading, → stable)
  articles_stored_trend: compare(thisWeek.stored, avg4weeks.stored),
  avg_quality_trend: compare(thisWeek.avgQuality, avg4weeks.avgQuality),
  match_rate_trend: compare(thisWeek.matchRate, avg4weeks.matchRate),

  // Red flags
  zero_stored: thisWeek.stored === 0,
  quality_dropping: thisWeek.avgQuality < avg4weeks.avgQuality - 1,
  no_matches_4_weeks: last4weeks.every((w) => w.commits_with_match === 0),

  // Top wasted sources (classified many, stored few)
  wasted_sources: topSourcesByWaste(3),
});
```

### The metric that matters: does industry context improve posts?

```sql
SELECT
  CASE WHEN ai_draft LIKE '%<industry_context>%'
    THEN 'with_context' ELSE 'without_context' END AS type,
  COUNT(*) AS posts,
  AVG(edit_ratio) AS avg_edit_ratio,
  AVG(engagement_score) AS avg_engagement
FROM voice_posts
WHERE status = 'published'
GROUP BY type;
```

If `edit_ratio` with context > without → Liliana edits less when industry context is present → feature adds value.
If `edit_ratio` with context < without → she removes the industry reference → cross-encoder or prompt injection needs revision.

This query runs in the monthly cleanup CRON and logs the result.

### Alerting (V1 — log-based)

| Condition | Severity | Log key |
|-----------|----------|---------|
| `articles_stored === 0` for 2 consecutive weeks | Error | `content.pipeline.stale` |
| `avg_quality_score` drops > 1 point week-over-week | Warn | `content.quality.degrading` |
| `commits_with_match === 0` for 4 consecutive weeks | Warn | `content.matches.dry` |
| `extraction_failures > 50%` of fetched | Error | `content.extraction.failing` |

No PagerDuty, no Slack — just structured log lines. In V2, these can trigger GitHub Issue notifications.

---

## Known Tradeoffs (Accepted)

1. **Weekly fetch lag**: a major blog post on Monday isn't available for matching until Sunday. Acceptable — the 4h commit poll lag is already accepted.
2. **45-day content expiry**: evergreen articles are lost. Acceptable — the goal is "industry is discussing NOW", not historical reference.
3. **Global content pool**: same articles for all tenants. Personalization happens at the matching stage via finding-specific embeddings, not at the classification stage.
4. **Batch source onboarding**: 20 sources/week means full coverage takes ~3 months. Acceptable — avoids cost explosion on week 1.
5. **matched_count cold start**: takes 3+ months to be useful. Mitigated by requiring articles_passed >= 20 before evaluating.
6. **Article extraction ~10-15% failure rate**: some blogs use client-side rendering, paywalls, or anti-bot measures. These articles are skipped, not retried. Extraction failures are not counted as source quality failures. Gated by spike test (Step 3).
7. **Embedding dimensions tied to provider**: `vector(1536)` is OpenAI text-embedding-3-small. Switching provider requires schema migration + re-embed (~$0.06 for full corpus). Rare event, acceptable cost.
8. **AI quality_score is non-deterministic**: same article can score 6 or 7 on different runs. Gate set at 6 to prefer false positives over false negatives. The matching cross-encoder is the real quality gate.
9. **No user feedback on match quality**: `matched_count` tracks that a match happened, not whether the user found it useful. The existing `edit_ratio` is the closest proxy — if the user removes the industry reference before publishing, edit_ratio drops. Explicit match feedback requires UI, deferred to V2.
10. **Full article text stored**: increases DB size (~1KB-10KB per article × 3000/year = ~15MB/year). Acceptable — enables re-classification without re-extraction.
11. **Embedding in critical path**: if the OpenAI embedding call fails during post-generation, matching is skipped entirely. The post is still generated without industry context. Graceful degradation, not crash.
12. **JSON parse failures from LLM (~2-5%)**: retry once, then skip. Expected real loss ~0.1% of articles. Not a source quality failure.
13. **Two AI providers**: Anthropic (Haiku for classify/cross-encode, Sonnet for post generation) + OpenAI (embeddings only). Two API keys, two cost centers. Acceptable — OpenAI embeddings are 10x cheaper than any LLM-based alternative and the `IEmbedder` interface makes switching trivial.
14. **Top 3 per source cap**: prolific sources that publish > 3 articles/week only get their top 3 (by structural score) classified. Remaining articles are discarded. Acceptable — structural score selects the most analytically dense articles, not random ones.
15. **Batch API timeout**: if Anthropic/OpenAI batch doesn't complete in 2 hours, the CRON exits and retries next week. Expected to never happen for ~120 requests, but the plan exists.
16. **Observability is log-based**: no external dashboard or alerting service. Trends computed from `content_pipeline_runs` table. Sufficient for V1 — external monitoring (Grafana, PagerDuty) deferred to V2 when there are paying users to justify the cost.
