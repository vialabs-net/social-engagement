# ADR-006 — Anthropic Batch API for article classification

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-04-07 |
| Deciders | Liliana Castellanos |

## Context

The weekly content pipeline classifies ~120 articles per run using Claude Haiku. Each
classification call takes ~100 input tokens (article text) + ~150 output tokens (JSON).

Two execution modes:

**Real-time (synchronous):** Call the Anthropic API once per article, wait for response,
continue. Simple but ~6× more expensive and subject to rate limiting at 120 consecutive
calls.

**Batch API (asynchronous):** Submit all requests in one batch, poll for completion,
download results. 50% cost reduction. SLA up to 24h but expected to complete in 5–15
minutes for ~120 requests.

The classification pipeline runs in a weekly GitHub Actions workflow (`content-fetch.yml`)
which has a 6h timeout. Classification is not time-sensitive.

## Decision

Use the Anthropic Batch API for article classification. The 50% cost reduction at
~120 requests/week is ~$0.16/week vs. ~$0.32/week.

**Explicit exception to the `IAIClient` interface:** The Batch API's submit → poll →
download lifecycle cannot be expressed through `IAIClient.complete()`. `classifier.ts`
calls the Anthropic SDK directly. Switching the classifier to a different batch provider
requires rewriting `classifier.ts`. This is accepted.

**Cross-encoder and post generation remain provider-agnostic** via `IAIClient`.

**Batch state persistence:** `content_pipeline_runs.classify_batch_id` stores the active
batch ID so that if the workflow dies mid-run, the next run can check the in-flight batch
rather than submitting a new one.

**Timeout handling:** If the batch does not complete in 2h, the workflow exits. Next week's
run checks for a pending `classify_batch_id` and resumes from the existing batch.

## Consequences

**Better:**
- 50% cost reduction for the single largest AI expense in the pipeline.
- Single API call to submit, no rate-limit management needed during classification.

**Worse:**
- `classifier.ts` is not provider-agnostic. Changing batch classification provider = rewrite.
- Batch API introduces asynchronous state: the `classify_batch_id` must be persisted and
  checked on each run. More complex than fire-and-forget.
- Anthropic keeps batches for 29 days. OpenAI keeps them for 7 days. A batch that sits
  unretrieved for more than 7 days (OpenAI) is permanently lost. Real probability: near zero
  (weekly CRON runs every 7 days exactly).
