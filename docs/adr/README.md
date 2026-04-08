# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for devcast.

An ADR captures the context, decision, and consequences of a significant architectural
choice. ADRs are immutable after acceptance — they are not updated when decisions change.
A superseding decision creates a new ADR that references the old one.

## Format

Each ADR uses the following structure:

| Field | Value |
|-------|-------|
| Status | `Accepted` / `Superseded by ADR-NNN` / `Deprecated` |
| Date | YYYY-MM-DD |
| Deciders | Who made the call |

- **Context** — Why did this decision need to be made? What forces are at play?
- **Decision** — What was decided and why this option over the alternatives?
- **Consequences** — What does this decision make easier? What does it make harder?

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](ADR-001-buffer-publishing-layer.md) | Buffer as the publishing layer | Accepted |
| [ADR-002](ADR-002-envelope-encryption-kms.md) | Envelope encryption with GCP KMS for token storage | Accepted |
| [ADR-003](ADR-003-article-extractor-library.md) | @extractus/article-extractor for article text extraction | Accepted |
| [ADR-004](ADR-004-pgvector-hnsw-parameters.md) | pgvector HNSW index parameters | Accepted |
| [ADR-005](ADR-005-openai-embeddings.md) | OpenAI text-embedding-3-small for chunk embeddings | Accepted |
| [ADR-006](ADR-006-anthropic-batch-api-classification.md) | Anthropic Batch API for article classification | Accepted |
| [ADR-007](ADR-007-article-quality-gate.md) | Article quality gate at score 6 | Accepted |
| [ADR-008](ADR-008-job-claim-semantics.md) | Job claim as two-step SELECT + conditional UPDATE | Accepted |
| [ADR-009](ADR-009-platform-analytics-direct-api.md) | Platform analytics via direct API after Buffer publish | Accepted |
