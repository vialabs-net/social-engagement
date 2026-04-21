-- Experiment v1.4 schema. Local SQLite only. No production writes.

-- ── Commit cache: one row per commit extracted from local git ───────────────
CREATE TABLE IF NOT EXISTS commit_cache (
  commit_sha     TEXT PRIMARY KEY,
  repo           TEXT NOT NULL,
  author_login   TEXT,
  author_email   TEXT,
  commit_date    TIMESTAMP NOT NULL,
  commit_message TEXT NOT NULL,
  commit_body    TEXT,
  diff_json      TEXT NOT NULL,
  languages_json TEXT NOT NULL,
  files_count    INTEGER,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cc_author_date ON commit_cache(author_login, commit_date);
CREATE INDEX IF NOT EXISTS idx_cc_repo_date   ON commit_cache(repo, commit_date);

-- ── Simulated signals: raw findings 1-10 from the 24 modules ────────────────
CREATE TABLE IF NOT EXISTS simulated_signals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_sha      TEXT NOT NULL REFERENCES commit_cache(commit_sha),
  repo            TEXT NOT NULL,
  author_login    TEXT NOT NULL,
  tenant_id       TEXT,
  module_id       TEXT NOT NULL,
  finding_score   INTEGER NOT NULL,
  finding_text    TEXT,
  commit_date     TIMESTAMP NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(commit_sha, module_id)
);
CREATE INDEX IF NOT EXISTS idx_sig_grouping ON simulated_signals(author_login, repo, module_id, commit_date);

-- ── Selected groups for Fase B synthesis simulation ─────────────────────────
CREATE TABLE IF NOT EXISTS synthesis_groups (
  id                TEXT PRIMARY KEY,
  author_login      TEXT NOT NULL,
  tenant_id         TEXT,
  repo              TEXT NOT NULL,
  topic             TEXT NOT NULL,
  variant           TEXT NOT NULL,    -- 'FOCAL' | 'ARCO' | 'SINGLE'
  origin            TEXT NOT NULL,    -- 'organic' | 'adversarial' | 'control'
  coherence_score   REAL,
  commit_shas       TEXT NOT NULL,    -- JSON array
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Weak signals extracted per commit (simulates Haiku Capa 2) ──────────────
CREATE TABLE IF NOT EXISTS weak_signals (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id          TEXT NOT NULL REFERENCES synthesis_groups(id),
  commit_sha        TEXT NOT NULL,
  haiku_raw         TEXT NOT NULL,
  topic             TEXT,
  strength          INTEGER,
  pattern_kind      TEXT,
  affected_symbols  TEXT,
  specific_change   TEXT,
  evidence_snippet  TEXT
);

-- ── Sonnet synthesis output (simulates Capa 4) ──────────────────────────────
CREATE TABLE IF NOT EXISTS synthesis_posts (
  group_id          TEXT PRIMARY KEY REFERENCES synthesis_groups(id),
  sonnet_input      TEXT NOT NULL,
  sonnet_output     TEXT NOT NULL,
  declined          INTEGER NOT NULL DEFAULT 0,
  claim_count       INTEGER NOT NULL DEFAULT 0,
  cost_usd          REAL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Structural pre-labels (Haiku, distinct from synthesis generator) ────────
CREATE TABLE IF NOT EXISTS prelabels (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id          TEXT NOT NULL REFERENCES synthesis_groups(id),
  claim_index       INTEGER NOT NULL,
  claim_text        TEXT NOT NULL,
  structural_check  TEXT NOT NULL,
  evidence          TEXT
);

-- ── Human labels (edited in markdown by Liliana) ────────────────────────────
CREATE TABLE IF NOT EXISTS human_labels (
  group_id          TEXT NOT NULL REFERENCES synthesis_groups(id),
  claim_index       INTEGER NOT NULL,
  label             TEXT NOT NULL,
  notes             TEXT,
  PRIMARY KEY(group_id, claim_index)
);

CREATE TABLE IF NOT EXISTS post_level_labels (
  group_id          TEXT PRIMARY KEY REFERENCES synthesis_groups(id),
  publish_readiness TEXT,
  decline_judgment  TEXT,
  distrust_reason   TEXT
);

-- ── Cumulative cost tracking for the $5 cap ─────────────────────────────────
CREATE TABLE IF NOT EXISTS experiment_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO experiment_meta(key, value) VALUES ('total_cost_usd', '0');
