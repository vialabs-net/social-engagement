# ADR-005 — OpenAI text-embedding-3-small for chunk embeddings

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-04-07 |
| Deciders | Liliana Castellanos |

## Context

The content pipeline needs to embed article chunks (512-token text) and query embeddings
(~100-token finding descriptions) for cosine similarity matching. The embedding model
determines vector dimensions, cost, and quality.

Requirements:
- Compatible with Anthropic-first stack (but embedding is a separate concern — no Anthropic
  embedding model exists for production use at this cost range)
- Batch API support (50% cost reduction for weekly pipeline)
- Low cost per token — weekly pipeline embeds ~250 chunks, query-time embeds ~1–3 per commit

Candidates:

| Model | Dims | Batch cost/MTok | Notes |
|-------|------|-----------------|-------|
| `text-embedding-3-small` | 1536 | $0.01 | Best cost/quality for semantic retrieval |
| `text-embedding-3-large` | 3072 | $0.065 | 6.5× more expensive, marginal quality gain at this scale |
| `text-embedding-ada-002` | 1536 | $0.05 | Legacy, superseded by 3-small |

## Decision

Use OpenAI `text-embedding-3-small` with 1536 dimensions.

Cost at steady state: ~$0.001/week for batch pipeline (250 chunks × 512 tokens × $0.01/MTok).
Query-time cost: ~$0.00007/commit (1 embedding × ~100 tokens × $0.02/MTok real-time).

The `IEmbedder` interface (`src/ai/types.ts`) makes the provider swappable. Switching to
a different provider requires: a new adapter implementing `IEmbedder`, a schema migration
to change `vector(1536)` to the new dimension, and a full re-embed of all stored chunks.

**Re-embed cost if switching:** ~$0.06 for 3,000 chunks at any reasonable provider price.
Rare event; accepted.

## Consequences

**Better:**
- Lowest cost at this scale with acceptable recall.
- Batch API available (50% discount for weekly pipeline).
- 1536 dims is supported natively by pgvector's HNSW index.

**Worse:**
- Introduces a second AI provider (OpenAI) alongside Anthropic. Two API keys, two cost
  centers, two failure modes.
- `vector(1536)` is hardcoded in the schema. Changing embedding providers requires a
  migration if the new provider uses different dimensions.
- OpenAI embedding failures in the query-time path cause matching to be skipped entirely
  for that commit. Post generates without industry context (graceful degradation).
