# ADR-007 — Article quality gate at score 6

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-04-07 |
| Deciders | Liliana Castellanos |

## Context

The AI classifier scores articles 1–10 on technical depth and originality. The pipeline
needs a threshold below which articles are discarded and not stored in `content_items`.

The score distribution the classifier is calibrated to:
- 1–3: tutorial, docs rehash, surface overview
- 4–6: decent but not distinctive
- 7–8: real-world experience, production insights
- 9–10: exceptional depth — war stories, novel approaches with data

Two candidate gates:
- **Gate at 7:** Only store articles the classifier rates as "real-world experience or
  better". Tighter corpus, lower noise.
- **Gate at 6:** Accept articles that are "decent but not distinctive" if the classifier
  says so. Higher recall, more noise.

Constraint: LLM scoring is non-deterministic. The same article can score 6 or 7 on
different runs. The classifier is the coarse filter; the cross-encoder (Stage 2 of
matching) is the precision filter.

## Decision

**Gate at 6.**

The classifier is a cost filter, not the quality arbiter. Discarding a score-6 article
that would have been a valid match costs a post quality (false negative). Storing a
score-6 article that doesn't match anything costs ~$0.003 in storage (false positive).

The cross-encoder in the matching pipeline evaluates "strong" vs "weak" vs "none" for each
candidate. A false positive from the classifier that reaches the cross-encoder will be
filtered out at that stage.

False negatives cannot be recovered. False positives are filtered downstream.

## Consequences

**Better:**
- Higher recall: articles that the classifier underscores by 1 point are not lost.
- Safe: the matching cross-encoder is the real quality gate that the developer's post
  actually depends on.

**Worse:**
- ~10–20% more articles stored than a gate-7 policy would allow.
- Slightly more pgvector storage and index size.
- The `idx_voice_retrieval` and matching queries filter by `quality_score >= 6` — any
  change to the gate requires updating both the storage code and the match query.
