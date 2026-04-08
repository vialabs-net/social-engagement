# ADR-003 — @extractus/article-extractor for article text extraction

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-04-07 |
| Deciders | Liliana Castellanos |

## Context

The content intelligence pipeline needs to extract full article text from blog URLs. RSS
feeds often contain partial text or summaries. The extractor must run in Node.js (the
project stack) without requiring a separate runtime.

Candidates evaluated:

| Library | Reason rejected |
|---------|----------------|
| `readability` (Mozilla) | DOM-only; requires `jsdom` in Node.js — heavy (~5MB), slower, adds a DOM emulation layer |
| `mercury-parser` (Postlight) | Archived in 2023, no maintenance |
| `trafilatura` | Python-only; incompatible with Node.js stack without a subprocess call |
| `@extractus/article-extractor` | Pure Node.js, actively maintained, MIT license, ~50KB |

A feasibility spike was run on 30 curated URLs (April 2026):
- URL extraction alone: 33% pass rate
- RSS `content:encoded` alone: 63% raw pass rate
- 3-layer strategy (RSS → URL → Puppeteer for curated): ~93% projected pass rate

The acceptance gate was ≥ 80%.

## Decision

Use `@extractus/article-extractor` as the URL extraction layer in a 3-layer strategy:

1. RSS `content:encoded` ≥ 300 words → use directly.
2. Else: `article-extractor` on the URL.
3. Else (curated sources only): Puppeteer fallback.

This meets the ≥ 80% extraction gate. Do not regress to a 1-layer approach.

## Consequences

**Better:**
- No external runtime dependency.
- Actively maintained library with broad site support.
- 3-layer strategy handles the majority of failure cases.

**Worse:**
- ~10–15% of articles still fail extraction (JS-rendered content, paywalls, anti-bot).
  These are logged and skipped — not retried until next cycle.
- Puppeteer is only used for curated sources to avoid cost and complexity at scale.
  A high-value open-source blog that is JS-rendered will be skipped.
- Extraction failures are explicitly NOT source quality failures — they do not
  affect `content_sources.fetch_failures` or the source lifecycle.
