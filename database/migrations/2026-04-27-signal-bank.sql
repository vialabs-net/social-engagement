-- Migration: CEP Fase B — Signal Bank
-- Creates tables for the signal accumulation architecture.
-- Apply to Supabase and regenerate SQLite schema.

-- ─── signal_bank ────────────────────────────────────────────────────────────
-- Aggregated per (tenant, author, repo, topic). One row per unique combination.
-- threshold_effective is computed at runtime from threshold_baseline, multiplier,
-- last_fired_at, and half_life_refractory — never stored directly.

CREATE TABLE IF NOT EXISTS signal_bank (
  id                      SERIAL PRIMARY KEY,
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  github_author_login     TEXT NOT NULL,
  repo                    TEXT NOT NULL,
  topic                   TEXT NOT NULL,   -- moduleId (e.g. 'performance', 'devops')

  -- Accumulation state
  weight_sum              FLOAT NOT NULL DEFAULT 0,
  signal_count            INTEGER NOT NULL DEFAULT 0,
  last_signal_at          TIMESTAMPTZ,

  -- Adaptive decay parameters (per author/topic)
  half_life_signal        FLOAT NOT NULL DEFAULT 63,  -- days; k=9 * median_interval(7d)
  commit_frequency        FLOAT,                       -- median commit interval in days

  -- Refractory period parameters
  threshold_baseline      FLOAT NOT NULL DEFAULT 15,
  multiplier              FLOAT NOT NULL DEFAULT 0.5,  -- updated from edit_ratio feedback
  half_life_refractory    FLOAT NOT NULL DEFAULT 42,   -- days; k=6 * median_interval(7d)
  last_fired_at           TIMESTAMPTZ,

  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, github_author_login, repo, topic)
);

CREATE INDEX IF NOT EXISTS signal_bank_tenant_author ON signal_bank (tenant_id, github_author_login);
CREATE INDEX IF NOT EXISTS signal_bank_last_fired ON signal_bank (last_fired_at);

-- ─── signal_events ──────────────────────────────────────────────────────────
-- Individual raw signals. Feed the aggregates in signal_bank.

CREATE TABLE IF NOT EXISTS signal_events (
  id                      BIGSERIAL PRIMARY KEY,
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  github_author_login     TEXT NOT NULL,
  repo                    TEXT NOT NULL,
  topic                   TEXT NOT NULL,

  commit_sha              TEXT NOT NULL,
  strength                FLOAT NOT NULL,            -- 1-10 (or 2 for delta_hit)
  pattern_kind            TEXT NOT NULL,             -- 'new_abstraction' | 'contract_change' | ...
  affected_symbols        TEXT[] NOT NULL DEFAULT '{}',
  specific_change         TEXT NOT NULL DEFAULT '',

  source                  TEXT NOT NULL,             -- 'finding' | 'delta_hit' | 'haiku_lazy'
  accumulated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed                BOOLEAN NOT NULL DEFAULT FALSE,
  consumed_by_post_id     TEXT,                      -- voice_posts.id if consumed

  CONSTRAINT signal_events_pattern_kind_check CHECK (
    pattern_kind IN (
      'new_abstraction', 'contract_change', 'semantic_refactor',
      'config_change', 'dependency_update', 'behavioral_change'
    )
  ),
  CONSTRAINT signal_events_source_check CHECK (
    source IN ('finding', 'delta_hit', 'haiku_lazy')
  )
);

CREATE INDEX IF NOT EXISTS signal_events_bank ON signal_events (tenant_id, github_author_login, repo, topic, consumed);
CREATE INDEX IF NOT EXISTS signal_events_commit ON signal_events (commit_sha);

-- ─── post_disparo_audit ─────────────────────────────────────────────────────
-- Snapshot before consuming signals. Enables rollback of threshold on post rejection.

CREATE TABLE IF NOT EXISTS post_disparo_audit (
  id                      BIGSERIAL PRIMARY KEY,
  post_id                 TEXT NOT NULL,             -- voice_posts.id
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  github_author_login     TEXT NOT NULL,
  repo                    TEXT NOT NULL,
  gatillador              TEXT NOT NULL,             -- 'individual_mono' | 'individual_multi' | 'focal' | 'arco'
  topics                  TEXT[] NOT NULL,
  consumed_signal_ids     BIGINT[] NOT NULL,
  signal_bank_snapshot    JSONB NOT NULL,            -- [{topic, weight_sum, last_fired_at}]
  fired_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS post_disparo_audit_post ON post_disparo_audit (post_id);

-- ─── routing_decisions_audit ─────────────────────────────────────────────────
-- Records arco vs focal routing decisions for calibration of coherence weights.

CREATE TABLE IF NOT EXISTS routing_decisions_audit (
  id                      BIGSERIAL PRIMARY KEY,
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  github_author_login     TEXT NOT NULL,
  voice_post_id           TEXT REFERENCES voice_posts(id) ON DELETE SET NULL,
  commit_shas             TEXT[] NOT NULL,
  score_coherencia        FLOAT NOT NULL,
  score_structural        FLOAT NOT NULL,
  score_temporal          FLOAT NOT NULL,
  score_lexical           FLOAT NOT NULL,
  decision                TEXT NOT NULL,             -- 'arco' | 'focal_multiple'
  edit_ratio_result       FLOAT,                     -- filled post-publication for calibration
  decided_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
