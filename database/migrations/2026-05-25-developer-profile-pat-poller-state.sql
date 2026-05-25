-- Poller state for PAT-based event polling (per developer).
-- Tracks last seen event and ETag so each run is incremental.

ALTER TABLE developer_profiles
  ADD COLUMN IF NOT EXISTS pat_last_event_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pat_last_etag     TEXT DEFAULT NULL;
