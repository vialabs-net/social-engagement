-- Per-member credentials within a tenant.
-- Each GitHub author in an org can connect their own LinkedIn and Buffer
-- instead of sharing the tenant-level accounts.
--
-- Lookup order in the worker:
--   1. tenant_members WHERE tenant_id = X AND github_author_login = Y
--   2. Fall back to tenants row if no member row exists

CREATE TABLE IF NOT EXISTS tenant_members (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID REFERENCES tenants(id) NOT NULL,
  github_author_login         TEXT NOT NULL,

  -- Publishing credentials (encrypted with member-specific DEK)
  buffer_access_token         TEXT,
  linkedin_access_token       TEXT,
  linkedin_member_id          TEXT,
  linkedin_token_expires_at   TIMESTAMPTZ,
  encrypted_dek               TEXT,           -- KMS-wrapped DEK, generated per member

  -- Voice seeding — member's own bootstrap posts (JSON array of strings)
  voice_bootstrap             TEXT,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, github_author_login)
);

-- RLS: service role bypasses; future user-level policies go here
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tenant_members_lookup
  ON tenant_members(tenant_id, github_author_login);
