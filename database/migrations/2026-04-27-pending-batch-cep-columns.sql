-- CEP columns for pending_batch (§10 spec)
-- Enables future weekly-roundup feature: batch non-interesting commits
-- and publish a synthesis post when enough material accumulates.

ALTER TABLE pending_batch
  ADD COLUMN IF NOT EXISTS signal_strength  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS topic_categories TEXT[],
  ADD COLUMN IF NOT EXISTS proto_findings   JSONB,
  ADD COLUMN IF NOT EXISTS expires_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consumed         BOOLEAN DEFAULT FALSE;
