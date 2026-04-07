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
  engagement_score REAL,                  -- composite: edit_ratio*0.6 + normalized_reactions*0.4
  tenant_id       UUID REFERENCES tenants(id) -- multi-tenant: scopes voice data per user
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
-- MARKETPLACE — multi-tenant tables
-- ─────────────────────────────────────────────────────────

-- One row per GitHub App installation (one tenant per GitHub user/org)
CREATE TABLE IF NOT EXISTS tenants (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  github_installation_id  BIGINT NOT NULL UNIQUE,  -- GitHub App installation ID
  github_username         TEXT NOT NULL UNIQUE,    -- installing user/org login
  plan                    TEXT NOT NULL DEFAULT 'free',
  active                  BOOLEAN NOT NULL DEFAULT TRUE,
  buffer_access_token     TEXT,                    -- set during onboarding (paste API key)
  linkedin_access_token   TEXT,                    -- OAuth 2.0 access token
  linkedin_member_id      TEXT,                    -- urn:li:person:{id}
  linkedin_token_expires_at TIMESTAMPTZ,           -- token TTL (~2 months)
  config                  JSONB NOT NULL DEFAULT '{}',
  voice_bootstrap         TEXT                     -- raw posts pasted during onboarding
);

-- Async job queue — webhook enqueues, worker picks up
CREATE TABLE IF NOT EXISTS job_queue (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  repo        TEXT NOT NULL,                       -- 'owner/repo'
  before_sha  TEXT NOT NULL,                       -- push event before SHA
  after_sha   TEXT NOT NULL,                       -- push event after SHA
  ref         TEXT NOT NULL,                       -- e.g. 'refs/heads/main'
  status      TEXT NOT NULL DEFAULT 'pending',     -- 'pending'|'processing'|'done'|'failed'
  attempts    INTEGER NOT NULL DEFAULT 0,
  error       TEXT,
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_job_queue_pending
  ON job_queue(created_at ASC)
  WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────
-- CONTENT INTELLIGENCE — Phase 2
-- ─────────────────────────────────────────────────────────

-- pgvector extension (required for article_chunks.embedding)
CREATE EXTENSION IF NOT EXISTS vector;

-- RSS/blog sources registry
CREATE TABLE IF NOT EXISTS content_sources (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  url                 TEXT NOT NULL UNIQUE,
  rss_url             TEXT NOT NULL,
  trust               TEXT NOT NULL DEFAULT 'open',     -- 'curated' | 'verified' | 'open'
  status              TEXT NOT NULL DEFAULT 'queued',   -- 'queued' | 'active' | 'probation' | 'disabled' | 'unreachable'
  -- quality stats
  articles_evaluated  INTEGER NOT NULL DEFAULT 0,
  articles_passed     INTEGER NOT NULL DEFAULT 0,
  best_score_30d      INTEGER NOT NULL DEFAULT 0,
  -- value stats
  matched_count       INTEGER NOT NULL DEFAULT 0,
  last_matched_at     TIMESTAMPTZ,
  -- health stats
  fetch_failures      INTEGER NOT NULL DEFAULT 0,
  last_fetch_ok_at    TIMESTAMPTZ,
  -- lifecycle
  added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at         TIMESTAMPTZ,
  discovered_from     TEXT    -- 'awesome-tech-rss' | 'engineering-blogs' | 'both' | 'manual'
);

-- Classified and stored articles
CREATE TABLE IF NOT EXISTS content_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       UUID REFERENCES content_sources(id),
  fetched_at      TIMESTAMPTZ DEFAULT NOW(),
  week_of         DATE NOT NULL,
  url             TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  content_text    TEXT NOT NULL,         -- full extracted article text (enables re-classification)
  summary         TEXT NOT NULL,         -- AI-generated summary from classifier
  main_thesis     TEXT NOT NULL,
  key_insights    TEXT[] NOT NULL,
  tech_concepts   TEXT[] NOT NULL,
  quality_score   INTEGER NOT NULL,
  times_matched   INTEGER NOT NULL DEFAULT 0,
  title_hash      TEXT NOT NULL,         -- SHA-256 of lowercase(title), for exact dedup
  fingerprint     TEXT NOT NULL          -- first 200 words lowercase, for fuzzy dedup
);

-- Article chunks with vector embeddings for semantic search
CREATE TABLE IF NOT EXISTS article_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
  chunk_index     INTEGER NOT NULL,
  chunk_text      TEXT NOT NULL,
  embedding       vector(1536),
  UNIQUE(content_item_id, chunk_index)
);

-- CRON run history for observability + trend analysis
CREATE TABLE IF NOT EXISTS content_pipeline_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- volume
  sources_active        INTEGER NOT NULL DEFAULT 0,
  sources_queued        INTEGER NOT NULL DEFAULT 0,
  sources_promoted      INTEGER NOT NULL DEFAULT 0,
  articles_fetched      INTEGER NOT NULL DEFAULT 0,
  articles_extracted    INTEGER NOT NULL DEFAULT 0,
  extraction_failures   INTEGER NOT NULL DEFAULT 0,
  articles_deduped      INTEGER NOT NULL DEFAULT 0,
  articles_preskipped   INTEGER NOT NULL DEFAULT 0,
  articles_structural   INTEGER NOT NULL DEFAULT 0,
  articles_classified   INTEGER NOT NULL DEFAULT 0,
  articles_stored       INTEGER NOT NULL DEFAULT 0,
  chunks_embedded       INTEGER NOT NULL DEFAULT 0,
  -- quality
  avg_quality_score     REAL,
  score_distribution    JSONB,   -- {"1-3": 5, "4-6": 30, "7-8": 12, "9-10": 3}
  -- matching (from commits processed since last run)
  commits_with_match    INTEGER NOT NULL DEFAULT 0,
  commits_without_match INTEGER NOT NULL DEFAULT 0,
  match_skip_failures   INTEGER NOT NULL DEFAULT 0,
  -- errors
  classify_json_errors  INTEGER NOT NULL DEFAULT 0,
  embed_failures        INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_title_hash ON content_items(title_hash);

CREATE INDEX IF NOT EXISTS idx_article_chunks_embedding
  ON article_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m=16, ef_construction=64);

-- ─────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────
-- Enable RLS on all tables. No public policies = anon key has zero access.
-- GitHub Actions must use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
-- The anon key is only safe for local dev with SQLite (see .env.example).

ALTER TABLE voice_posts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_batch            ENABLE ROW LEVEL SECURITY;
ALTER TABLE events_state             ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_slots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue                ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_sources          ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_chunks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pipeline_runs    ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────
-- MIGRATION — run this block on existing Supabase installations
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards)
-- ─────────────────────────────────────────────────────────
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS linkedin_urn     TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS reactions_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS engagement_score REAL;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS linkedin_access_token     TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS linkedin_member_id        TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS linkedin_token_expires_at TIMESTAMPTZ;

ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_voice_posts_tenant ON voice_posts(tenant_id);

DROP INDEX IF EXISTS idx_voice_retrieval;
CREATE INDEX IF NOT EXISTS idx_voice_retrieval
  ON voice_posts(platform, engagement_score DESC NULLS LAST, edit_ratio DESC NULLS LAST)
  WHERE status = 'published';
