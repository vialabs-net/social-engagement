-- Phase 3 + progressive voice subsystem readiness
-- Safe to run manually in Supabase SQL Editor.
-- Idempotent: uses IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS voice_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id),
  github_author_login  TEXT,
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

CREATE INDEX IF NOT EXISTS idx_voice_profiles_tenant
  ON voice_profiles(tenant_id);

ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS tenant_id                 UUID REFERENCES tenants(id);
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS top_module_id             TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS author_login              TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS edit_analysis             JSONB;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS context_status            TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS has_industry_context      BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_article_id        UUID REFERENCES content_items(id);
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_source_id         UUID REFERENCES content_sources(id);
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_strength            REAL;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection          TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS linkedin_urn              TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS reactions_count           INTEGER NOT NULL DEFAULT 0;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS engagement_score          REAL;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at   TIMESTAMPTZ;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source            TEXT;
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS generation_system         TEXT DEFAULT 'v1';
ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS opening_move              TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_voice_posts_tenant
  ON voice_posts(tenant_id);

DROP INDEX IF EXISTS idx_voice_retrieval;
CREATE INDEX IF NOT EXISTS idx_voice_retrieval
  ON voice_posts(platform, engagement_score DESC NULLS LAST, edit_ratio DESC NULLS LAST)
  WHERE status = 'published';
