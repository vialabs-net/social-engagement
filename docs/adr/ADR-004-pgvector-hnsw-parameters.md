# ADR-004 — pgvector HNSW index parameters

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-04-07 |
| Deciders | Liliana Castellanos |

## Context

The `article_chunks` table stores 1536-dimensional embeddings (OpenAI text-embedding-3-small)
and requires an approximate nearest-neighbor index for cosine similarity search at query time.

pgvector supports two index types: IVFFlat and HNSW. HNSW was chosen because it:
- Supports incremental inserts without rebuild (IVFFlat requires pre-built lists)
- Has better query-time recall at equivalent `ef_search` settings
- Is the recommended index for pgvector since v0.5.0

HNSW has two construction parameters:
- `m`: number of bi-directional links per node. Higher = better recall, larger index size.
- `ef_construction`: size of the dynamic candidate list during construction. Higher = better
  recall, slower index build.

## Decision

Use HNSW with `m=16, ef_construction=64` — the pgvector defaults.

At alpha corpus size (~3,000 chunks/year = ~250 chunks/week × 12 weeks), the index is
trivially small. Any reasonable parameter set produces near-perfect recall at this scale.

**Scaling path:**
- Under 10,000 chunks: current parameters are fine.
- At 10,000–50,000 chunks: if spot-checks show match recall below 80%, upgrade to
  `m=32, ef_construction=128`.
- HNSW parameter changes require `REINDEX` (seconds at 3,000 chunks, minutes at 50,000).

**No action needed until the corpus exceeds 10,000 chunks or match recall drops below 80%.**

## Consequences

**Better:**
- No upfront tuning cost.
- pgvector defaults are well-tested and safe.
- Incremental inserts work without rebuild.

**Worse:**
- At large scale, `m=16` can produce suboptimal recall for 1536-dim vectors. This is
  a known limitation, documented with a clear trigger for when to revisit.
- Changing parameters at scale requires a maintenance window for `REINDEX`.
