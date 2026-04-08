# devcast — Seed Corpus Spec

| Field | Value |
|-------|-------|
| Version | 1.0.0 |
| Status | Design — not yet executed |
| Owner | Liliana Castellanos / Vialabs Spa |
| Parent spec | `devcast-spec.md` v1.5.16 — Cold Start Corpus section |
| Mode | Hybrid: AI proposes candidates, human approves |

---

## Purpose

Produce the 200-article seed corpus that devcast Phase 2 requires before accepting users. Without this corpus, the first three months of installs see zero industry context matches, and the entire Content Intelligence Agent looks dead from the user's perspective.

This spec covers everything from "blank spreadsheet" to "verified rows in `content_items` and `article_chunks`". It does not duplicate the master spec — it implements the operational steps the master spec only sketches at a high level.

---

## Authoritative references (do not redefine)

These come from `devcast-spec.md` and must be respected exactly. If anything in this document conflicts with them, the master spec wins.

| Item | Source |
|------|--------|
| `content_items` schema | master spec, line 549 |
| `article_chunks` schema | master spec, line 575 |
| `content_sources` schema with `is_protected` | master spec, line 509 |
| Chunking strategy (512 tokens, 64 overlap, never split code) | master spec, line 1363 |
| 3-layer extraction strategy | master spec, line 1188 |
| Article quality criteria (war stories, metrics, tradeoffs) | master spec, structural scoring section |
| 24 analysis modules list | master spec, line 714 |
| Cold Start Corpus rationale and `week_of='2026-01-01'` convention | master spec, line 1590 |
| `is_protected=TRUE` exemption from cleanup CRON | master spec, line 1638 |

---

## Out of scope

- Modifying Phase 2 schema beyond the one optional `seed_modules` column proposed below
- Changes to cleanup CRON logic (already specified in master spec as a [REQUIRED BEFORE LAUNCH] item)
- Continuous refresh of the seed corpus (this is one-time; future phases can revisit)
- Tagging real-time RSS-fetched articles with modules (out of scope; only seed articles are tagged)

---

## Deliverables

1. `seed-articles.json` — the curated and verified list of 200 articles, with full text extracted
2. `scripts/seed-corpus/` — a small directory with the helper scripts described below
3. One `content_sources` row with `name='curated-seed'`, `is_protected=TRUE`
4. ~200 rows in `content_items` and ~1000 rows in `article_chunks`, all referencing the seed source
5. A coverage report proving every one of the 24 analysis modules has at least 3 seed articles tagged

---

## Optional schema addition

The master spec notes (issue B in the v1.5.16 review) that `content_items` has no column to store which modules a seed article was tagged for. Two options:

**Option 1 — add a column (recommended).**

```sql
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS seed_modules TEXT[] DEFAULT NULL;
```

- `NULL` for all RSS-fetched articles
- An array of module ids for seed articles
- Enables a SQL coverage audit at any time:
  ```sql
  SELECT module, COUNT(*)
  FROM content_items, unnest(seed_modules) AS module
  WHERE source_id = (SELECT id FROM content_sources WHERE name='curated-seed')
  GROUP BY module
  ORDER BY COUNT(*) ASC;
  ```
- Enables future analytics like "is this match coming from seed or fresh content?"

**Option 2 — keep tags only in `seed-articles.json`, no DB column.**

- Coverage audit lives only in the JSON file
- After seeding completes, there is no way to answer the audit question from the DB alone
- Acceptable if you commit to never deleting `seed-articles.json` from the repo

This spec assumes Option 1. If you reject it, replace every `seed_modules` reference below with "verify against `seed-articles.json` instead".

---

## The 24 modules — coverage targets

From the master spec (line 732). Each module must end with at least 3 articles tagged.

| Category | Modules | Min articles |
|---|---|---|
| Architecture | `architecture_patterns`, `design_patterns`, `evolutionary` | 3 each = 9 |
| Quality | `clean_code`, `testing`, `error_resilience`, `complexity` | 3 each = 12 |
| Platform | `performance`, `security`, `observability`, `devops`, `concurrency`, `dependency_health` | 3 each = 18 |
| API & integration | `api_design`, `integration` | 3 each = 6 |
| Type & DX | `type_system`, `dx`, `ai_assisted` | 3 each = 9 |
| Languages & frameworks | `js_advanced`, `react_patterns`, `python`, `go`, `java_quarkus`, `elixir` | 3 each = 18 |

**Hard floor: 72 articles to satisfy minimums.** That leaves ~128 articles to distribute on whichever modules attract more high-quality candidates. Architecture, performance, observability, and security tend to dominate; do not over-budget them at the expense of language-specific coverage.

A single article can be tagged with multiple modules if it genuinely covers them (e.g. a Netflix Hystrix post tagged `error_resilience` + `architecture_patterns`). Multi-tagging counts toward each module's minimum.

---

## Workflow — three tracks in parallel

### Track 1 — Known classics (target: ~60 articles, ~half a day)

Articles you, your circle, or well-known engineering leaders already cite. No AI search needed. Open browser, navigate to the blogs you already trust, pick 2-3 per author/source.

Reference list of high-yield sources by module (non-exhaustive):

| Module | Sources to mine first |
|---|---|
| `architecture_patterns`, `design_patterns`, `evolutionary` | martinfowler.com, Sam Newman, ThoughtWorks Insights |
| `performance`, `observability` | Netflix Tech Blog, Discord Engineering, Cloudflare Blog, Honeycomb |
| `security` | Cloudflare Blog, GitHub Security Lab, Trail of Bits, Project Zero |
| `api_design` | Stripe Blog, Slack Engineering, Shopify Engineering |
| `error_resilience`, `concurrency` | Netflix (Hystrix-era posts), Uber Engineering, AWS Builders Library |
| `react_patterns`, `js_advanced` | overreacted.io (Dan Abramov), kentcdodds.com, Josh Comeau |
| `python` | Real Python, Hynek Schlawack, Łukasz Langa |
| `go` | Dave Cheney, Bradfitz, Go Blog |
| `elixir` | theerlangelist.com (Saša Jurić), Dashbit Blog, Plataformatec archives |
| `java_quarkus` | Quarkus Blog, Red Hat Developers, InfoQ Java track |
| `devops` | Honeycomb (Charity Majors), Bridget Kromhout, Increment magazine |
| `testing` | Kent Beck, t-wada, Software Engineering at Google online chapters |
| `ai_assisted` | Anthropic engineering posts, Simon Willison's blog, GitHub Next |

**Output of Track 1:** rows added to the working spreadsheet (see below) with `source: track1` and `status: candidate`.

### Track 2 — AI-assisted search (target: ~100 articles, 1-2 days)

For modules that Track 1 did not cover well (especially language-specific ones), use Claude or another web-search-enabled assistant to propose candidates.

**One query per module.** Do not ask one mega-query for all 24 modules at once — the IA will overweight the famous ones and leave gaps.

**Query template:**

```
Find 6 production engineering blog posts about [MODULE TOPIC]
from January 2024 onwards.

Required for every result:
- Real production system, not a tutorial or "getting started" guide
- Either concrete metrics, a war story, or explicit tradeoffs
- Published on a known engineering blog or by a known practitioner
- Article is still live at the URL (verify by fetching)

Return as a JSON array. Each item:
{
  "url": "...",
  "title": "...",
  "source_name": "...",
  "published_date": "YYYY-MM-DD",
  "one_line_why": "what makes this article match the criteria"
}

Do NOT invent URLs. If you cannot find 6 that meet all criteria,
return fewer rather than padding the list.
```

**Module topic phrasings to use:**

| Module | Topic phrasing |
|---|---|
| `architecture_patterns` | "service decomposition, monolith-to-microservices migration, or system architecture refactors" |
| `design_patterns` | "design pattern application in production code (not pattern catalogs)" |
| `evolutionary` | "incremental refactoring, strangler fig pattern, or evolutionary architecture in production" |
| `clean_code` | "code quality, naming, function design lessons learned in production codebases" |
| `testing` | "production testing strategies, test pyramids, contract testing, or testability war stories" |
| `error_resilience` | "circuit breakers, retries, bulkheads, timeouts, or failure-mode engineering in production" |
| `complexity` | "managing code complexity, cyclomatic complexity reduction, or simplification stories" |
| `performance` | "performance optimization with measurable before/after metrics in production systems" |
| `security` | "production security incidents, hardening stories, or vulnerability discovery and remediation" |
| `observability` | "production observability, tracing, structured logging, or incident-driven monitoring improvements" |
| `devops` | "CI/CD pipeline design, deployment strategies, or infrastructure-as-code lessons" |
| `concurrency` | "concurrency bugs, race conditions, or parallelism design in production systems" |
| `dependency_health` | "dependency management, supply chain, version pinning, or lockfile war stories" |
| `api_design` | "REST or GraphQL API design decisions, versioning strategies, or API evolution stories" |
| `integration` | "third-party integration patterns, webhook design, or system integration war stories" |
| `type_system` | "advanced TypeScript, Rust, or other static type system patterns from production code" |
| `dx` | "developer experience improvements, internal tooling, or productivity engineering" |
| `ai_assisted` | "production use of LLMs, AI-assisted coding, or building with model APIs" |
| `js_advanced` | "advanced JavaScript engine internals, V8 optimization, or production JS performance" |
| `react_patterns` | "production React patterns, state management decisions, or React performance work" |
| `python` | "production Python performance, async patterns, packaging, or large Python codebase lessons" |
| `go` | "production Go services, goroutine patterns, or Go-specific performance work" |
| `java_quarkus` | "Quarkus, GraalVM native image, or modern JVM production stories" |
| `elixir` | "Elixir or Phoenix in production, OTP patterns, or BEAM-specific war stories" |

**For every returned candidate, the human reviewer must:**
1. Open the URL in a browser (do NOT trust the IA's claim that the URL is live)
2. Read the first two paragraphs and skim the rest
3. Apply the acceptance checklist (next section)
4. Mark `status: kept` or `status: rejected` in the spreadsheet, with a one-line reason if rejected

Hallucinated URLs are common — even with web search active. Treat every IA-proposed URL as unverified until you click it.

### Track 3 — Curated lists (target: ~40 articles, 2-3 hours)

Existing community-curated lists already did selection work. Skim them, pick what fits.

| List | What to look for |
|---|---|
| `kilimchoi/engineering-blogs` | Already consumed by `discover-sources.yml`. Open the blogs of authors you do not know yet, pick their best 1-2 posts |
| `papers-we-love/papers-we-love` | For `architecture_patterns`, `concurrency`, `evolutionary` — but only papers with engineering blog companion posts, not raw papers |
| HackerNews "best of" archives (e.g. `hn.algolia.com` sorted by points) | Filter for engineering blog posts > 500 points in the last 2 years |
| "awesome-distributed-systems", "awesome-sre", "awesome-system-design" repos | Mine the "blog posts" subsections specifically |

---

## Acceptance checklist (per article)

Before marking a candidate as `kept`, every box must be checked. If any box fails, reject. **No partial passes.**

```
[ ] URL opens and loads the actual article (not a 404, paywall, or "subscribe to read")
[ ] Published on or after 2024-01-01
[ ] Word count >= 800 (skim — does it look like a real article, not a 300-word announcement?)
[ ] At least one of:
    [ ] Concrete metrics (latency numbers, throughput, error rates, percentages, before/after)
    [ ] Production war story with named system, scale, and consequences
    [ ] Explicit tradeoffs ("we chose X over Y because...")
[ ] Not a tutorial, "getting started", "introduction to", or rehash of documentation
[ ] Author or publisher is identifiable (named individual or known engineering blog)
[ ] You can name at least one analysis module it would match against
[ ] You would actually send this to a colleague
```

The last one is the tiebreaker. If you would not personally share it, it is not seed-corpus material.

---

## Working spreadsheet — schema

Use Google Sheets, Notion, Airtable, or even a CSV. The schema:

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | int | yes | Sequential, just for tracking |
| `track` | enum | yes | `track1` / `track2` / `track3` |
| `module_primary` | text | yes | One of the 24 module ids — the dominant one |
| `module_secondary` | text[] | no | Comma-separated additional modules, if multi-tagged |
| `url` | text | yes | The article URL |
| `title` | text | yes | Exact title from the page |
| `source_name` | text | yes | "Netflix Tech Blog", "Cloudflare Blog", etc. |
| `author` | text | no | If named |
| `published_date` | date | yes | YYYY-MM-DD |
| `quality_score` | int | yes | 7, 8, 9, or 10 only — anything below 7 is rejected |
| `why_kept` | text | yes | One sentence: what makes this match the criteria |
| `status` | enum | yes | `candidate` / `reviewed` / `kept` / `rejected` / `text_extracted` / `failed_extraction` |
| `reject_reason` | text | conditional | Required when status = rejected |
| `notes` | text | no | Free-form |

**Status flow:** `candidate` → `reviewed` → (`kept` or `rejected`) → `text_extracted` (or `failed_extraction`)

The spreadsheet is the source of truth during curation. `seed-articles.json` is generated from it at the end of Step 4 below.

---

## Execution steps

### Step 0 — Setup (30 min)

1. Create a working directory: `scripts/seed-corpus/`
2. Create the working spreadsheet with the schema above
3. If using Option 1 (recommended), apply the `seed_modules` column migration in a Supabase **staging** database first (not production)

### Step 1 — Track 1 fill (half a day)

Open browser, mine known sources, add rows to the spreadsheet. Target: ~60 candidates with `status='candidate'`.

Stop when each "Architecture", "Quality", "Platform", and "API" module has at least 2 candidates. Do not aim for completeness here — Track 2 covers gaps.

### Step 2 — Track 2 AI-assisted search (1-2 days)

For each of the 24 modules, run the query template once. Use Claude with web search, Perplexity, or ChatGPT browsing — whatever returns real URLs reliably.

Run the queries in priority order: **the language-specific modules first** (`elixir`, `java_quarkus`, `go`, `python`, `react_patterns`, `js_advanced`), because those are the hardest to fill and you want to catch shortages early.

After each module's query:
1. Paste the IA's results into the spreadsheet with `status='candidate'`
2. Verify each URL by clicking it
3. Apply the acceptance checklist
4. Mark `status='kept'` or `status='rejected'`

Stop a module when it has at least 4 `kept` candidates (one buffer over the minimum of 3).

### Step 3 — Track 3 fill gaps (2-3 hours)

For any module still under 4 `kept` candidates after Step 2, mine the curated lists. This is the final pass to close coverage holes.

If a module is still under 3 `kept` after Step 3, **stop and reconsider**:
- Is the module phrasing too narrow? Reword the search query.
- Is the module just rare in the wild? Consider whether 2 articles is acceptable, or whether to merge it with a sibling module for V1.
- Is your acceptance bar too high? Re-read the rejected candidates for that module — were any borderline?

Do not seed a corpus where any module has zero articles. The master spec is explicit on this (line 1646).

### Step 4 — Coverage audit + freeze list (1 hour)

When the spreadsheet has ~200 rows with `status='kept'`, run the audit.

Build the audit by grouping `kept` rows by `module_primary` plus every `module_secondary` entry, and counting:

```
architecture_patterns: 12
design_patterns: 8
evolutionary: 4
clean_code: 6
...
elixir: 3
```

**Pass criteria:**
- Every module appears with count >= 3
- Total `kept` count is between 180 and 220 (target: 200)
- No URL appears twice (deduplicate by exact URL match)
- No source dominates: no single `source_name` represents more than 25 articles

If any criterion fails, return to Step 2 or Step 3 for that specific module.

When the audit passes, freeze the spreadsheet by exporting it as `seed-articles-frozen.csv` and committing it to the repo. This is the human-readable source of truth.

### Step 5 — Text extraction (2-3 hours)

Generate `seed-articles.json` from `seed-articles-frozen.csv`, including the full extracted text of each article.

Use `@extractus/article-extractor` (already in the devcast stack — same library Phase 2 production uses, so seed extraction matches production extraction):

```typescript
// scripts/seed-corpus/extract-text.ts
import { extract } from '@extractus/article-extractor';
import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

interface CsvRow {
  id: string;
  url: string;
  title: string;
  source_name: string;
  module_primary: string;
  module_secondary: string;
  quality_score: string;
  status: string;
}

interface SeedArticle {
  url: string;
  title: string;
  source_name: string;
  text: string;
  quality_score: number;
  modules: string[];
}

async function main() {
  const csv = readFileSync('seed-articles-frozen.csv', 'utf-8');
  const rows: CsvRow[] = parse(csv, { columns: true });
  const kept = rows.filter((r) => r.status === 'kept');

  const out: SeedArticle[] = [];
  const failures: Array<{ id: string; url: string; reason: string }> = [];

  for (const row of kept) {
    try {
      const article = await extract(row.url);
      if (!article || !article.content) {
        failures.push({ id: row.id, url: row.url, reason: 'extractor_returned_null' });
        continue;
      }
      const text = stripHtml(article.content).trim();
      const wordCount = text.split(/\s+/).length;
      if (wordCount < 300) {
        failures.push({ id: row.id, url: row.url, reason: `word_count_${wordCount}` });
        continue;
      }

      const modules = [
        row.module_primary,
        ...(row.module_secondary?.split(',').map((m) => m.trim()).filter(Boolean) ?? []),
      ];

      out.push({
        url: row.url,
        title: row.title,
        source_name: row.source_name,
        text,
        quality_score: parseInt(row.quality_score, 10),
        modules,
      });

      // Be polite: 2s between requests, never more than 5 in flight
      await sleep(2000);
    } catch (err) {
      failures.push({ id: row.id, url: row.url, reason: String(err) });
    }
  }

  writeFileSync('seed-articles.json', JSON.stringify(out, null, 2));
  writeFileSync('seed-extraction-failures.json', JSON.stringify(failures, null, 2));

  console.log(`Extracted: ${out.length} / ${kept.length}`);
  console.log(`Failures: ${failures.length} (see seed-extraction-failures.json)`);
}

function stripHtml(html: string): string {
  // Use the same approach as src/content/article-extractor.ts in production
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

main();
```

**Expected failure rate: 10-15%** (master spec, line 1170 — same rates as production extraction). For each failure:

1. Open the URL manually in a browser
2. Select all article text, copy to clipboard
3. Add the article to `seed-articles.json` by hand with the same shape
4. Note the manual addition in `seed-extraction-failures.json`

If the manual extraction is also impossible (paywall, dead link, JavaScript-rendered SPA where copy-paste produces garbage), reject the article and pick a replacement from the rejected pool of the same module.

After Step 5, `seed-articles.json` should contain ~200 entries with full text.

### Step 6 — Pre-seed validation (30 min)

Before touching Supabase, run a validation script against `seed-articles.json`:

```typescript
// scripts/seed-corpus/validate.ts
// Checks:
// 1. Every entry has all required fields
// 2. quality_score in [7, 10]
// 3. modules is a non-empty array, each value is in MODULE_REGISTRY
// 4. text length >= 1500 chars (rough sanity check)
// 5. text length <= 50000 chars (something is wrong if longer — likely scraped junk)
// 6. URLs are unique
// 7. Coverage: every module in MODULE_REGISTRY appears at least 3 times across all entries
// 8. No single source_name has > 25 entries
// Exit non-zero on any failure with a clear message
```

This is the same audit as Step 4 but applied to the JSON, not the CSV. It catches drift introduced during Step 5 (if a manual extraction got the wrong source name, etc.).

**Do not proceed to Step 7 until validation passes.**

### Step 7 — Seeding to Supabase (1 hour, including verification)

This is the only step that touches the production database. It must be idempotent — running it twice should not produce duplicate rows.

```typescript
// scripts/seed-corpus/seed.ts
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { chunkArticle } from '../../src/content/chunker'; // reuse production chunker
import { OpenAI } from 'openai';

const SEED_SOURCE_NAME = 'curated-seed';
const SEED_WEEK_OF = '2026-01-01'; // master spec convention

async function main() {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const articles = JSON.parse(readFileSync('seed-articles.json', 'utf-8'));

  // 1. Ensure seed source exists (idempotent)
  let { data: source } = await db
    .from('content_sources')
    .select('id')
    .eq('name', SEED_SOURCE_NAME)
    .maybeSingle();

  if (!source) {
    const { data: created, error } = await db
      .from('content_sources')
      .insert({
        name: SEED_SOURCE_NAME,
        url: 'https://devcast.lilicurl.com/seed',
        rss_url: 'https://devcast.lilicurl.com/seed.rss', // placeholder, never fetched
        trust: 'curated',
        status: 'active',
        is_protected: true,
        discovered_from: 'manual',
      })
      .select('id')
      .single();
    if (error) throw error;
    source = created;
  }

  console.log(`Seed source id: ${source.id}`);

  let inserted = 0;
  let skipped = 0;

  for (const article of articles) {
    // 2. Idempotency: skip if URL already exists
    const { data: existing } = await db
      .from('content_items')
      .select('id')
      .eq('url', article.url)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    // 3. Insert content_items row
    // NOTE: summary, main_thesis, key_insights, tech_concepts are normally produced by the
    // Phase 2 classifier. For seed articles we either:
    //   (a) call Haiku once per article to produce them (most consistent with prod)
    //   (b) leave summary as the first paragraph and key_insights/tech_concepts as []
    // Option (a) is recommended — it costs ~$0.16 for 200 articles (Haiku non-batch)
    // and means the matcher's Stage 2 prompt sees the same shape for seed and fresh articles.

    const classification = await classifyWithHaiku(article.text);

    const { data: item, error: itemErr } = await db
      .from('content_items')
      .insert({
        source_id: source.id,
        week_of: SEED_WEEK_OF,
        url: article.url,
        title: article.title,
        content_text: article.text,
        summary: classification.summary,
        main_thesis: classification.main_thesis,
        key_insights: classification.key_insights,
        tech_concepts: classification.tech_concepts,
        quality_score: article.quality_score,
        title_hash: sha256(article.title.toLowerCase()),
        fingerprint: article.text.split(/\s+/).slice(0, 200).join(' ').toLowerCase(),
        seed_modules: article.modules, // requires the optional column from the migration
      })
      .select('id')
      .single();

    if (itemErr) {
      console.error(`Failed to insert ${article.url}:`, itemErr);
      continue;
    }

    // 4. Chunk and embed
    const chunks = chunkArticle(article.text); // reuse production chunker
    const chunkRows = [];

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunks[i],
      });
      chunkRows.push({
        content_item_id: item.id,
        chunk_index: i,
        chunk_text: chunks[i],
        embedding: embedding.data[0].embedding,
      });
    }

    const { error: chunkErr } = await db.from('article_chunks').insert(chunkRows);
    if (chunkErr) {
      // Rollback the content_items row to keep state consistent
      await db.from('content_items').delete().eq('id', item.id);
      console.error(`Failed to insert chunks for ${article.url}:`, chunkErr);
      continue;
    }

    inserted++;
    console.log(`[${inserted}/${articles.length}] ${article.title}`);
  }

  console.log(`Done. Inserted: ${inserted}, Skipped (already existed): ${skipped}`);
}

main();
```

**About `classifyWithHaiku()`:** reuse the same prompt from `src/content/classifier.ts` (master spec line 1327). Do not duplicate the prompt — import it. If it is not currently exported, refactor it to be exportable. The seed corpus should be classified by the exact same prompt as RSS-fetched articles, otherwise the cross-encoder Stage 2 sees inconsistent input shapes.

**Cost estimate for Step 7:**
- Haiku classification: 200 articles × ~$0.0013 = ~$0.26
- OpenAI embeddings: ~1000 chunks × ~$0.00007 = ~$0.07
- Total: ~$0.33

This is real-time, not batch (master spec line 1623 — "embed each chunk via OpenAI real-time, not batch — one-time operation"). It is a one-time cost.

### Step 8 — Post-seed verification (30 min)

After Step 7 reports success, verify the database state from a fresh SQL session.

```sql
-- 1. Source exists and is protected
SELECT id, name, trust, status, is_protected
FROM content_sources
WHERE name = 'curated-seed';
-- Expected: 1 row, trust='curated', status='active', is_protected=true

-- 2. Article count
SELECT COUNT(*) AS seed_articles
FROM content_items
WHERE source_id = (SELECT id FROM content_sources WHERE name='curated-seed');
-- Expected: ~200 (within tolerance of the manual rejections from Step 5)

-- 3. Chunk count
SELECT COUNT(*) AS seed_chunks
FROM article_chunks
WHERE content_item_id IN (
  SELECT id FROM content_items
  WHERE source_id = (SELECT id FROM content_sources WHERE name='curated-seed')
);
-- Expected: between 4× and 8× the article count (avg 5 chunks per article)

-- 4. Every chunk has an embedding
SELECT COUNT(*) AS missing_embeddings
FROM article_chunks
WHERE embedding IS NULL
  AND content_item_id IN (
    SELECT id FROM content_items
    WHERE source_id = (SELECT id FROM content_sources WHERE name='curated-seed')
  );
-- Expected: 0

-- 5. Module coverage (requires Option 1 schema column)
SELECT module, COUNT(*) AS articles
FROM content_items, unnest(seed_modules) AS module
WHERE source_id = (SELECT id FROM content_sources WHERE name='curated-seed')
GROUP BY module
ORDER BY articles ASC;
-- Expected: every module appears with COUNT >= 3
-- Special check: no module from MODULE_REGISTRY is missing from this result

-- 6. Quality score distribution
SELECT quality_score, COUNT(*)
FROM content_items
WHERE source_id = (SELECT id FROM content_sources WHERE name='curated-seed')
GROUP BY quality_score
ORDER BY quality_score;
-- Expected: only 7, 8, 9, 10 — no value below 7
```

**Sanity check via the matcher:** push a real commit to a test repo where you know which module should fire. Verify in the logs that `content.match.result` returns at least one strong match from the seed source. This proves the entire pipeline (chunking, embedding, pgvector index, cross-encoder) works against seed data, not just that rows exist.

```
[ ] Test commit pushed
[ ] Logs show content.match.result with strong_matches >= 1
[ ] matched_article_url is from a curated-seed article
```

### Step 9 — Cleanup CRON guard (already in master spec, verify before launch)

The master spec (line 1638) requires:

```sql
-- In the monthly cleanup CRON
DELETE FROM content_items
WHERE week_of < NOW() - INTERVAL '45 days'
  AND source_id NOT IN (
    SELECT id FROM content_sources WHERE is_protected = TRUE
  );
```

This is **not part of seed corpus work**. It is a Phase 2 fix that must already be deployed. But the seed corpus is meaningless without it, so verify it before considering seeding done.

```
[ ] content-cleanup-main.ts confirmed to filter by is_protected = FALSE
[ ] Manual dry-run: simulate cleanup with seed corpus present, verify no seed rows are deleted
```

If cleanup is wrong, do not seed yet — fix cleanup first, otherwise the next 15th of the month wipes everything.

---

## Failure modes and recovery

| Failure | Detection | Recovery |
|---|---|---|
| URL hallucinated by IA in Track 2 | Step 2 manual click | Reject, do not waste a slot |
| Article passes acceptance but extraction fails | Step 5 `failed_extraction` | Manual copy-paste; if impossible, replace from rejected pool |
| Coverage audit fails at Step 4 | Step 4 module count < 3 | Return to Step 2 with a more specific query for that module |
| Validation fails at Step 6 | Validation script exits non-zero | Fix `seed-articles.json` by hand, re-run |
| Step 7 partial failure (some rows inserted, some not) | Step 8 count check | Re-run Step 7 — idempotent on URL match |
| Step 7 chunk insert fails after item insert | Logs show rollback | Already rolled back; re-run picks it up |
| Cleanup CRON wipes seed corpus on the 15th | Sanity SQL count drops to 0 | Cleanup CRON is broken — fix and re-seed |

---

## Time estimate

| Step | Duration | Notes |
|---|---|---|
| 0. Setup | 30 min | |
| 1. Track 1 | 4-6 hours | Concentrated browsing |
| 2. Track 2 | 1-2 days | The bulk of the work |
| 3. Track 3 | 2-3 hours | Filling holes |
| 4. Coverage audit | 1 hour | Spreadsheet + manual review |
| 5. Text extraction | 2-3 hours | Includes manual fallbacks |
| 6. Validation | 30 min | Should pass first try if Step 5 was clean |
| 7. Seeding | 1 hour | Runtime ~30 min for the script |
| 8. Verification | 30 min | |
| **Total** | **~3 days of focused work** | Spread over a week if intercalated |

---

## Definition of Done

```
[ ] seed-articles-frozen.csv exists in the repo with ~200 'kept' rows
[ ] seed-articles.json exists in the repo with the full extracted text
[ ] All 24 modules have >= 3 articles tagged
[ ] No single source has > 25 articles
[ ] No URL appears twice
[ ] All quality_score values are in [7, 10]
[ ] scripts/seed-corpus/extract-text.ts is checked in
[ ] scripts/seed-corpus/validate.ts is checked in
[ ] scripts/seed-corpus/seed.ts is checked in
[ ] (If Option 1) seed_modules column exists in content_items in production
[ ] curated-seed source exists in production with is_protected=TRUE
[ ] ~200 rows in content_items, ~1000 in article_chunks, all referencing curated-seed
[ ] Every chunk has a non-null embedding
[ ] Test commit produces a strong match from a seed article in production logs
[ ] content-cleanup-main.ts verified to skip is_protected sources
[ ] Pre-launch checklist in master spec (line 1648) updated with the seed-corpus completion date
```

When every box is checked, the seed corpus is done and devcast can accept its first user without the cold-start gap.
