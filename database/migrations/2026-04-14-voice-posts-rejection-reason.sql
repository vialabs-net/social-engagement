-- Per-draft rejection reason captured via feedback link in GitHub Issue notification.
-- Populated when the user clicks a reason link (hook / tone / too-technical / too-long / off-topic).
-- Used by the prompt builder to avoid repeating patterns that didn't resonate.

ALTER TABLE voice_posts
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
