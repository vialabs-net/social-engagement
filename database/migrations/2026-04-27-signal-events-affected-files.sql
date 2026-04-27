-- Migration: add affected_files column to signal_events
-- Enables coherence routing (arco vs focal_multiple) using real file paths.

ALTER TABLE signal_events
  ADD COLUMN IF NOT EXISTS affected_files TEXT[] NOT NULL DEFAULT '{}';
