# ADR-008 — Job claim as two-step SELECT + conditional UPDATE

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-04-07 |
| Deciders | Liliana Castellanos |

## Context

The `devcast-worker` Cloud Run Job runs every 15 minutes and must claim a pending job
from `job_queue` without racing against other instances.

The standard production-grade approach for queue claiming in PostgreSQL is:

```sql
SELECT id FROM job_queue
  WHERE status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
```

This atomically locks the row and prevents any concurrent worker from claiming the same job.
However, this requires executing the SELECT and UPDATE in a single database transaction
with row-level locking.

The simpler alternative is a two-step approach:

```sql
-- Step 1: find candidate
SELECT id FROM job_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1;

-- Step 2: conditional update (optimistic guard)
UPDATE job_queue SET status = 'processing'
  WHERE id = $jobId AND status = 'pending' RETURNING id;
```

If Step 2 returns empty (another worker claimed first), the caller returns null.

## Decision

**Two-step SELECT + conditional UPDATE** for the current phase.

**Why this is safe today:** Cloud Run Job runs as a single instance per execution
(Cloud Run Jobs do not run parallel instances by default). The race window between
Step 1 and Step 2 is irrelevant when there is only one worker at a time.

**When this breaks:** If Cloud Run Job is ever scaled to multiple parallel instances,
or if a future reaper re-sets stuck `processing` jobs back to `pending`, two workers can
claim the same job. At that point, replace with `FOR UPDATE SKIP LOCKED` in a single
transaction via a stored procedure or a Supabase RPC.

**Poison job gap:** A job stuck in `processing` forever (worker killed mid-run) is not
detected. The `leased_until TIMESTAMPTZ` column is specified but not yet added. When added,
the worker sets `leased_until = NOW() + 10min` at claim time, and a reaper query at worker
startup resets any `processing` job where `leased_until < NOW()` back to `pending`.

## Consequences

**Better:**
- Simpler implementation — no transaction management, no Supabase RPC needed.
- Sufficient for single-instance workload.

**Worse:**
- Not safe for concurrent workers. If scaling is ever needed, this must be replaced.
- Poison jobs accumulate silently until the `leased_until` mechanism is implemented.
- No idempotency guard against duplicate webhook events (`idempotency_key` is specified
  but not yet added as a UNIQUE constraint on `job_queue`).
