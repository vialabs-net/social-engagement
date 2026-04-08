-- Phase 2 + seed corpus readiness migration
-- Safe to run manually in Supabase SQL Editor.
-- Idempotent: uses IF NOT EXISTS / CREATE OR REPLACE.

-- voice_posts gaps
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
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS author_login             TEXT;

-- job_queue gaps
ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS leased_until TIMESTAMPTZ;
ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_idempotency
  ON job_queue(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- content_pipeline_runs gaps
ALTER TABLE content_pipeline_runs ADD COLUMN IF NOT EXISTS classify_batch_id TEXT;
ALTER TABLE content_pipeline_runs ADD COLUMN IF NOT EXISTS embed_batch_id    TEXT;

-- pending_batch gaps
ALTER TABLE pending_batch ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE pending_batch ADD COLUMN IF NOT EXISTS author_login TEXT;

-- content_sources / content_items gaps for protected seed corpus support
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS seed_modules TEXT[];

-- tenants gaps
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS encrypted_dek TEXT;

-- matcher Stage 1 must include protected sources even if their week_of is backdated
CREATE OR REPLACE FUNCTION match_article_chunks(
  query_embedding      vector(1536),
  similarity_threshold FLOAT,
  match_count          INT,
  min_quality_score    INT,
  week_of_cutoff       DATE
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
