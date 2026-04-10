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
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'scheduled'|'published'|'queued'|'expired'|'failed'
  top_finding     TEXT,                    -- headline of the top module finding
  findings_count  INTEGER NOT NULL DEFAULT 0,
  linkedin_urn    TEXT,                    -- urn:li:share:... captured from Buffer externalLink
  reactions_count INTEGER NOT NULL DEFAULT 0, -- LinkedIn reactions fetched from socialActions API
  engagement_score REAL,                  -- composite: edit_ratio*0.6 + normalized_reactions*0.4
  generation_system TEXT,                 -- 'v1' | 'v2_progressive'
  tenant_id       UUID REFERENCES tenants(id) -- multi-tenant: scopes voice data per user
);

-- Per-tenant voice contract. One optional default row plus explicit author overrides.
CREATE TABLE IF NOT EXISTS voice_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id),
  github_author_login  TEXT,                         -- NULL = tenant default
  voice                JSONB NOT NULL DEFAULT '{}',
  version              INTEGER NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_default
  ON voice_profiles(tenant_id)
  WHERE github_author_login IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_author
  ON voice_profiles(tenant_id, github_author_login)
  WHERE github_author_login IS NOT NULL;

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

-- Schema gaps backfilled here so the full contract is available on both
-- fresh installs and existing databases that were created before Phase 2 landed.
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS top_module_id            TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS edit_analysis            JSONB;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS context_status           TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS has_industry_context     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_article_id       UUID REFERENCES content_items(id);
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_source_id        UUID REFERENCES content_sources(id);
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_strength           REAL;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection         TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at  TIMESTAMPTZ;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source           TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS generation_system        TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS opening_move             TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS author_login             TEXT;

ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS leased_until               TIMESTAMPTZ;
ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS idempotency_key            TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_idempotency
  ON job_queue(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE content_pipeline_runs ADD COLUMN IF NOT EXISTS classify_batch_id TEXT;
ALTER TABLE content_pipeline_runs ADD COLUMN IF NOT EXISTS embed_batch_id    TEXT;

ALTER TABLE pending_batch ADD COLUMN IF NOT EXISTS tenant_id    UUID REFERENCES tenants(id);
ALTER TABLE pending_batch ADD COLUMN IF NOT EXISTS author_login TEXT;

ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS seed_modules   TEXT[];
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS encrypted_dek        TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_title_hash ON content_items(title_hash);

CREATE INDEX IF NOT EXISTS idx_article_chunks_embedding
  ON article_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m=16, ef_construction=64);

-- ─────────────────────────────────────────────────────────
-- FUNCTIONS (RPCs called from application code)
-- ─────────────────────────────────────────────────────────

-- pgvector similarity search used by matcher Stage 1
CREATE OR REPLACE FUNCTION match_article_chunks(
  query_embedding     vector(1536),
  similarity_threshold FLOAT,
  match_count         INT,
  min_quality_score   INT,
  week_of_cutoff      DATE
)
RETURNS TABLE (content_item_id UUID, similarity FLOAT)
LANGUAGE sql STABLE
AS $$
  SELECT
    ac.content_item_id,
    1 - (ac.embedding <=> query_embedding) AS similarity
  FROM article_chunks ac
  JOIN content_items ci ON ci.id = ac.content_item_id
  LEFT JOIN content_sources cs ON cs.id = ci.source_id
  WHERE
    1 - (ac.embedding <=> query_embedding) >= similarity_threshold
    AND ci.quality_score >= min_quality_score
    AND (
      ci.week_of >= week_of_cutoff
      OR COALESCE(cs.is_protected, FALSE) = TRUE
    )
  ORDER BY ac.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Atomic increment of match counters (called after a strong match is found)
CREATE OR REPLACE FUNCTION increment_content_match(
  p_article_id UUID,
  p_source_id  UUID
)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE content_items
     SET times_matched = times_matched + 1
   WHERE id = p_article_id;

  UPDATE content_sources
     SET matched_count    = matched_count + 1,
         last_matched_at  = NOW()
   WHERE id = p_source_id;
$$;

-- ─────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────
-- Enable RLS on all tables. No public policies = anon key has zero access.
-- GitHub Actions must use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
-- The anon key is only safe for local dev with SQLite (see .env.example).

ALTER TABLE voice_posts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_profiles           ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS generation_system TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS opening_move TEXT;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS linkedin_access_token     TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS linkedin_member_id        TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS linkedin_token_expires_at TIMESTAMPTZ;

ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_voice_posts_tenant ON voice_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_tenant ON voice_profiles(tenant_id);

DROP INDEX IF EXISTS idx_voice_retrieval;
CREATE INDEX IF NOT EXISTS idx_voice_retrieval
  ON voice_posts(platform, engagement_score DESC NULLS LAST, edit_ratio DESC NULLS LAST)
  WHERE status = 'published';
