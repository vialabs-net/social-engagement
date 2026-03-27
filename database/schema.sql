-- devcast database schema
-- Run this in Supabase SQL Editor (or SQLite for local dev)

-- Stores every AI draft and its final published version
CREATE TABLE IF NOT EXISTS voice_posts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  commit_sha      TEXT NOT NULL,
  repo            TEXT NOT NULL,           -- 'owner/repo'
  platform        TEXT NOT NULL,           -- 'linkedin' | 'instagram'
  ai_draft        TEXT NOT NULL,           -- stored immediately on generation
  published       TEXT,                    -- captured from Buffer "sent" API
  edit_ratio      REAL,                    -- 1.0=unchanged, 0.0=complete rewrite
  published_at    TIMESTAMPTZ,
  buffer_post_id  TEXT,
  scheduled_at    TIMESTAMPTZ,             -- UTC time Buffer will publish
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'scheduled'|'published'|'queued'
  top_finding     TEXT,                    -- headline of the top module finding
  findings_count  INTEGER NOT NULL DEFAULT 0,
  linkedin_urn    TEXT,                    -- urn:li:share:... captured from Buffer externalLink
  reactions_count INTEGER NOT NULL DEFAULT 0, -- LinkedIn reactions fetched from socialActions API
  engagement_score REAL                   -- composite: edit_ratio*0.6 + normalized_reactions*0.4
);

-- Uninteresting commits saved for optional weekly roundup
CREATE TABLE IF NOT EXISTS pending_batch (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  commit_sha      TEXT NOT NULL,
  repo            TEXT NOT NULL,
  enriched_data   JSONB NOT NULL
);

-- Tracks last-seen event ID and ETag per GitHub username (for polling)
CREATE TABLE IF NOT EXISTS events_state (
  username        TEXT PRIMARY KEY,
  last_event_id   TEXT NOT NULL,
  last_event_etag TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atomic slot claiming — prevents double-booking across concurrent runs
CREATE TABLE IF NOT EXISTS scheduled_slots (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  platform        TEXT NOT NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  voice_post_id   TEXT REFERENCES voice_posts(id),
  UNIQUE(platform, scheduled_at)           -- the invariant that makes scheduling safe
);

-- Fast retrieval of voice examples for prompt assembly
-- engagement_score takes precedence when available; falls back to edit_ratio
CREATE INDEX IF NOT EXISTS idx_voice_retrieval
  ON voice_posts(platform, engagement_score DESC NULLS LAST, edit_ratio DESC NULLS LAST)
  WHERE status = 'published';

-- Prevent processing the same commit twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_posts_sha_platform
  ON voice_posts(commit_sha, platform);

-- ─────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────
-- Enable RLS on all tables. No public policies = anon key has zero access.
-- GitHub Actions must use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
-- The anon key is only safe for local dev with SQLite (see .env.example).

ALTER TABLE voice_posts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_batch    ENABLE ROW LEVEL SECURITY;
ALTER TABLE events_state     ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_slots  ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────
-- MIGRATION — run this block on existing Supabase installations
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards)
-- ─────────────────────────────────────────────────────────
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS linkedin_urn     TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS reactions_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS engagement_score REAL;

DROP INDEX IF EXISTS idx_voice_retrieval;
CREATE INDEX IF NOT EXISTS idx_voice_retrieval
  ON voice_posts(platform, engagement_score DESC NULLS LAST, edit_ratio DESC NULLS LAST)
  WHERE status = 'published';
