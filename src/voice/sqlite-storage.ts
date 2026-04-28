import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { DEFAULT_VOICE_PROFILE, VoiceProfileSchema, type VoiceProfile } from '../config/schema.js';
import type {
  IVoiceStorage,
  VoicePost,
  SaveDraftInput,
  UpdatePublishedInput,
  UpdateScheduledInput,
  UpdateEngagementInput,
  Platform,
  PostStatus,
  RecentTopFinding,
  SlottedPost,
  StoredVoiceProfile,
  SignalBankEntry,
  SignalEvent,
  DisparoAuditItem,
  RoutingDecisionInput,
} from './storage.js';
import type { WeakSignal } from '../analysis/types.js';
import { computeHalfLives } from '../analysis/accumulation-engine.js';

interface SqliteVoiceProfileRow {
  id: string;
  github_author_login: string | null;
  voice: string;
  version: number;
}

type SqliteVoicePostRow = Omit<VoicePost, 'edit_analysis' | 'has_industry_context'> & {
  edit_analysis: string | null;
  has_industry_context: number;
};

interface SqliteSignalBankRow {
  id: number;
  github_author_login: string;
  repo: string;
  topic: string;
  weight_sum: number;
  signal_count: number;
  last_signal_at: string | null;
  half_life_signal: number;
  commit_frequency: number | null;
  threshold_baseline: number;
  multiplier: number;
  half_life_refractory: number;
  last_fired_at: string | null;
  updated_at: string;
}

interface SqliteSignalEventRow {
  id: number;
  github_author_login: string;
  repo: string;
  topic: string;
  commit_sha: string;
  strength: number;
  pattern_kind: string;
  affected_symbols: string; // JSON-encoded string[]
  affected_files: string;   // JSON-encoded string[]
  specific_change: string;
  source: string;
  accumulated_at: string;
  consumed: number; // 0 or 1
  consumed_by_post_id: string | null;
}

interface SqliteDisparoAuditRow {
  github_author_login: string;
  repo: string;
  consumed_signal_ids: string; // JSON-encoded number[]
  signal_bank_snapshot: string; // JSON-encoded DisparoAuditItem[]
}

function normalizeVoiceProfile(candidate: unknown): VoiceProfile | null {
  const parsed = VoiceProfileSchema.safeParse(candidate);
  if (!parsed.success) return null;
  return {
    ...DEFAULT_VOICE_PROFILE,
    ...parsed.data,
    content_strategy: {
      ...DEFAULT_VOICE_PROFILE.content_strategy,
      ...parsed.data.content_strategy,
    },
    post_length: {
      ...DEFAULT_VOICE_PROFILE.post_length,
      ...parsed.data.post_length,
    },
  };
}

function mapVoicePost(row: SqliteVoicePostRow): VoicePost {
  let editAnalysis: Record<string, unknown> | null = null;
  if (row.edit_analysis) {
    try {
      editAnalysis = JSON.parse(row.edit_analysis) as Record<string, unknown>;
    } catch {
      editAnalysis = null;
    }
  }

  return {
    ...row,
    edit_analysis: editAnalysis,
    has_industry_context: !!row.has_industry_context,
  };
}

export class SqliteStorage implements IVoiceStorage {
  private readonly db: Database.Database;
  readonly tenantId: string;

  constructor(dbPath = 'data/devcast.db', tenantId = 'local') {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.tenantId = tenantId;
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS voice_posts (
        id              TEXT PRIMARY KEY,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        commit_sha      TEXT NOT NULL,
        repo            TEXT NOT NULL,
        platform        TEXT NOT NULL,
        ai_draft        TEXT NOT NULL,
        published       TEXT,
        edit_ratio      REAL,
        published_at    TEXT,
        buffer_post_id  TEXT,
        scheduled_at    TEXT,
        status          TEXT NOT NULL DEFAULT 'pending',
        top_finding     TEXT,
        top_module_id   TEXT,
        findings_count  INTEGER NOT NULL DEFAULT 0,
        author_login    TEXT,
        edit_analysis   TEXT,
        context_status  TEXT,
        has_industry_context INTEGER NOT NULL DEFAULT 0,
        matched_article_id   TEXT,
        matched_source_id    TEXT,
        match_strength       REAL,
        match_connection     TEXT,
        linkedin_urn    TEXT,
        last_reactions_fetch_at TEXT,
        reactions_count INTEGER NOT NULL DEFAULT 0,
        engagement_score REAL,
        publish_source  TEXT,
        generation_system TEXT,
        opening_move    TEXT,
        tenant_id       TEXT
      );

      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS linkedin_urn     TEXT;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS reactions_count  INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS engagement_score REAL;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS top_module_id    TEXT;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS author_login     TEXT;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS edit_analysis    TEXT;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS context_status   TEXT;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS has_industry_context INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_article_id   TEXT;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_source_id    TEXT;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_strength       REAL;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection     TEXT;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at TEXT;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source   TEXT;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS generation_system TEXT;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS opening_move     TEXT;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS tenant_id        TEXT;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_sha_platform
        ON voice_posts(commit_sha, platform);

      CREATE TABLE IF NOT EXISTS voice_profiles (
        id                 TEXT PRIMARY KEY,
        tenant_id          TEXT NOT NULL,
        github_author_login TEXT,
        voice              TEXT NOT NULL DEFAULT '{}',
        version            INTEGER NOT NULL DEFAULT 1,
        created_at         TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_default
        ON voice_profiles(tenant_id)
        WHERE github_author_login IS NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_author
        ON voice_profiles(tenant_id, github_author_login)
        WHERE github_author_login IS NOT NULL;

      CREATE TABLE IF NOT EXISTS scheduled_slots (
        id            TEXT PRIMARY KEY,
        platform      TEXT NOT NULL,
        scheduled_at  TEXT NOT NULL,
        voice_post_id TEXT REFERENCES voice_posts(id),
        UNIQUE(platform, scheduled_at)
      );

      CREATE TABLE IF NOT EXISTS pending_batch (
        id            TEXT PRIMARY KEY,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        commit_sha    TEXT NOT NULL,
        repo          TEXT NOT NULL,
        enriched_data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS events_state (
        username        TEXT PRIMARY KEY,
        last_event_id   TEXT NOT NULL,
        last_event_etag TEXT,
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS signal_bank (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id            TEXT NOT NULL,
        github_author_login  TEXT NOT NULL,
        repo                 TEXT NOT NULL,
        topic                TEXT NOT NULL,
        weight_sum           REAL NOT NULL DEFAULT 0,
        signal_count         INTEGER NOT NULL DEFAULT 0,
        last_signal_at       TEXT,
        half_life_signal     REAL NOT NULL DEFAULT 63,
        commit_frequency     REAL,
        threshold_baseline   REAL NOT NULL DEFAULT 15,
        multiplier           REAL NOT NULL DEFAULT 0.5,
        half_life_refractory REAL NOT NULL DEFAULT 42,
        last_fired_at        TEXT,
        updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (tenant_id, github_author_login, repo, topic)
      );

      CREATE TABLE IF NOT EXISTS signal_events (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id            TEXT NOT NULL,
        github_author_login  TEXT NOT NULL,
        repo                 TEXT NOT NULL,
        topic                TEXT NOT NULL,
        commit_sha           TEXT NOT NULL,
        strength             REAL NOT NULL,
        pattern_kind         TEXT NOT NULL,
        affected_symbols     TEXT NOT NULL DEFAULT '[]',
        affected_files       TEXT NOT NULL DEFAULT '[]',
        specific_change      TEXT NOT NULL DEFAULT '',
        source               TEXT NOT NULL,
        accumulated_at       TEXT NOT NULL DEFAULT (datetime('now')),
        consumed             INTEGER NOT NULL DEFAULT 0,
        consumed_by_post_id  TEXT
      );

      CREATE INDEX IF NOT EXISTS signal_events_bank
        ON signal_events (tenant_id, github_author_login, repo, topic, consumed);
      CREATE INDEX IF NOT EXISTS signal_events_commit
        ON signal_events (commit_sha);

      CREATE TABLE IF NOT EXISTS post_disparo_audit (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id              TEXT NOT NULL,
        tenant_id            TEXT NOT NULL,
        github_author_login  TEXT NOT NULL,
        repo                 TEXT NOT NULL,
        gatillador           TEXT NOT NULL,
        topics               TEXT NOT NULL DEFAULT '[]',
        consumed_signal_ids  TEXT NOT NULL DEFAULT '[]',
        signal_bank_snapshot TEXT NOT NULL DEFAULT '[]',
        fired_at             TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS post_disparo_audit_post
        ON post_disparo_audit (post_id);

      CREATE TABLE IF NOT EXISTS routing_decisions_audit (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id            TEXT NOT NULL,
        github_author_login  TEXT NOT NULL,
        voice_post_id        TEXT,
        commit_shas          TEXT NOT NULL DEFAULT '[]',
        score_coherencia     REAL NOT NULL,
        score_structural     REAL NOT NULL,
        score_temporal       REAL NOT NULL,
        score_lexical        REAL NOT NULL,
        decision             TEXT NOT NULL,
        edit_ratio_result    REAL,
        decided_at           TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  saveDraft(input: SaveDraftInput): Promise<string> {
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO voice_posts (
        id, commit_sha, repo, platform, ai_draft, top_finding, top_module_id, findings_count,
        author_login, context_status, has_industry_context, matched_article_id, matched_source_id,
        match_strength, match_connection, generation_system, opening_move, status, tenant_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      id,
      input.commit_sha,
      input.repo,
      input.platform,
      input.ai_draft,
      input.top_finding ?? null,
      input.top_module_id ?? null,
      input.findings_count ?? 0,
      input.author_login ?? null,
      input.context_status ?? null,
      input.has_industry_context ? 1 : 0,
      input.matched_article_id ?? null,
      input.matched_source_id ?? null,
      input.match_strength ?? null,
      input.match_connection ?? null,
      input.generation_system ?? null,
      input.opening_move ?? null,
      this.tenantId,
    );
    return Promise.resolve(id);
  }

  getVoiceProfile(authorLogin: string | null): Promise<StoredVoiceProfile | null> {
    const exact = this.fetchVoiceProfileRow(authorLogin);
    if (exact) {
      return Promise.resolve({
        voice: normalizeVoiceProfile(JSON.parse(exact.voice)) ?? DEFAULT_VOICE_PROFILE,
        version: exact.version,
        source: 'exact',
      });
    }

    if (authorLogin) {
      const fallback = this.fetchVoiceProfileRow(null);
      if (fallback) {
        return Promise.resolve({
          voice: normalizeVoiceProfile(JSON.parse(fallback.voice)) ?? DEFAULT_VOICE_PROFILE,
          version: fallback.version,
          source: 'fallback',
        });
      }
    }

    const legacy = this.loadLegacyVoiceProfile();
    if (!legacy) return Promise.resolve(null);

    return this.saveVoiceProfile(null, legacy.voice, legacy.version)
      .then(() => legacy);
  }

  saveVoiceProfile(authorLogin: string | null, voice: VoiceProfile, expectedVersion?: number): Promise<boolean> {
    const normalized = normalizeVoiceProfile(voice) ?? DEFAULT_VOICE_PROFILE;
    const existing = this.fetchVoiceProfileRow(authorLogin);

    if (!existing) {
      if (expectedVersion !== undefined && expectedVersion !== 0) return Promise.resolve(false);

      this.db.prepare(`
        INSERT INTO voice_profiles (id, tenant_id, github_author_login, voice, version)
        VALUES (?, ?, ?, ?, 1)
      `).run(randomUUID(), this.tenantId, authorLogin, JSON.stringify(normalized));
      return Promise.resolve(true);
    }

    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      return Promise.resolve(false);
    }

    const result = this.db.prepare(`
      UPDATE voice_profiles
      SET voice = ?, version = ?, updated_at = datetime('now')
      WHERE id = ? AND version = ?
    `).run(
      JSON.stringify(normalized),
      existing.version + 1,
      existing.id,
      expectedVersion ?? existing.version,
    );

    return Promise.resolve(result.changes > 0);
  }

  getRecentModuleIds(days: number): Promise<string[]> {
    const rows = this.db.prepare(`
      SELECT top_module_id FROM voice_posts
      WHERE tenant_id = ?
        AND created_at >= datetime('now', '-' || ? || ' days')
        AND top_module_id IS NOT NULL
    `).all(this.tenantId, days) as { top_module_id: string }[];
    return Promise.resolve(rows.map((r) => r.top_module_id));
  }

  updatePublished(input: UpdatePublishedInput): Promise<void> {
    this.db.prepare(`
      UPDATE voice_posts
      SET published = ?, edit_ratio = ?, published_at = ?, status = 'published',
          edit_analysis = COALESCE(?, edit_analysis),
          linkedin_urn = COALESCE(?, linkedin_urn),
          publish_source = COALESCE(?, publish_source)
      WHERE id = ?
    `).run(
      input.published,
      input.edit_ratio,
      input.published_at,
      input.edit_analysis ? JSON.stringify(input.edit_analysis) : null,
      input.linkedin_urn ?? null,
      input.publish_source ?? null,
      input.id,
    );
    return Promise.resolve();
  }

  updateScheduled(input: UpdateScheduledInput): Promise<void> {
    this.db.prepare(`
      UPDATE voice_posts
      SET buffer_post_id = ?, scheduled_at = ?, status = ?
      WHERE id = ?
    `).run(input.buffer_post_id, input.scheduled_at, input.status, input.id);
    return Promise.resolve();
  }

  markQueued(id: string): Promise<void> {
    this.db.prepare(`UPDATE voice_posts SET status = 'queued' WHERE id = ?`).run(id);
    return Promise.resolve();
  }

  getTopVoiceExamples(platform: Platform, limit: number): Promise<VoicePost[]> {
    const rows = this.db.prepare(`
      SELECT * FROM voice_posts
      WHERE tenant_id = ? AND platform = ? AND status = 'published' AND edit_ratio IS NOT NULL
      ORDER BY engagement_score DESC NULLS LAST, edit_ratio DESC NULLS LAST
      LIMIT ?
    `).all(this.tenantId, platform, limit) as SqliteVoicePostRow[];
    return Promise.resolve(rows.map(mapVoicePost));
  }

  updateEngagement(input: UpdateEngagementInput): Promise<void> {
    this.db.prepare(`
      UPDATE voice_posts
      SET linkedin_urn = ?, reactions_count = ?, engagement_score = ?
      WHERE id = ?
    `).run(input.linkedin_urn, input.reactions_count, input.engagement_score, input.id);
    return Promise.resolve();
  }

  getPostsPendingEngagement(platform: Platform): Promise<VoicePost[]> {
    const rows = this.db.prepare(`
      SELECT * FROM voice_posts
      WHERE tenant_id = ? AND platform = ? AND status = 'published'
        AND linkedin_urn IS NOT NULL AND engagement_score IS NULL
    `).all(this.tenantId, platform) as SqliteVoicePostRow[];
    return Promise.resolve(rows.map(mapVoicePost));
  }

  getRecentPublished(limit: number): Promise<VoicePost[]> {
    const rows = this.db.prepare(`
      SELECT * FROM voice_posts
      WHERE tenant_id = ? AND status = 'published'
      ORDER BY published_at DESC NULLS LAST
      LIMIT ?
    `).all(this.tenantId, limit) as SqliteVoicePostRow[];
    return Promise.resolve(rows.map(mapVoicePost));
  }

  getPublishedForAuthor(
    authorLogin: string,
    platform: Platform,
    limit: number,
    minEditRatio = 0.7,
  ): Promise<VoicePost[]> {
    const rows = this.db.prepare(`
      SELECT * FROM voice_posts
      WHERE tenant_id = ?
        AND author_login = ?
        AND platform = ?
        AND status = 'published'
        AND edit_ratio >= ?
      ORDER BY published_at DESC NULLS LAST
      LIMIT ?
    `).all(this.tenantId, authorLogin, platform, minEditRatio, limit) as SqliteVoicePostRow[];
    return Promise.resolve(rows.map(mapVoicePost));
  }

  getPublishedForExposure(authorLogin: string, platform: Platform): Promise<VoicePost[]> {
    const rows = this.db.prepare(`
      SELECT * FROM voice_posts
      WHERE tenant_id = ?
        AND author_login = ?
        AND platform = ?
        AND status = 'published'
        AND published IS NOT NULL
        AND edit_ratio >= 0.3
      ORDER BY published_at DESC NULLS LAST
      LIMIT 40
    `).all(this.tenantId, authorLogin, platform) as SqliteVoicePostRow[];
    return Promise.resolve(dedupePublishedPrefix(rows.map(mapVoicePost)));
  }

  getPublishedForMoves(authorLogin: string): Promise<VoicePost[]> {
    const rows = this.db.prepare(`
      SELECT * FROM voice_posts
      WHERE tenant_id = ?
        AND author_login = ?
        AND status = 'published'
        AND published IS NOT NULL
        AND edit_ratio >= 0.3
      ORDER BY published_at DESC NULLS LAST
      LIMIT 30
    `).all(this.tenantId, authorLogin) as SqliteVoicePostRow[];
    return Promise.resolve(dedupePublishedPrefix(rows.map(mapVoicePost)));
  }

  getRecentTopFindings(authorLogin: string | null, moduleId: string, limit: number): Promise<RecentTopFinding[]> {
    const rows = (authorLogin
      ? this.db.prepare(`
          SELECT top_finding, published_at
          FROM voice_posts
          WHERE tenant_id = ?
            AND author_login = ?
            AND top_module_id = ?
            AND status = 'published'
            AND top_finding IS NOT NULL
          ORDER BY published_at DESC NULLS LAST
          LIMIT ?
        `).all(this.tenantId, authorLogin, moduleId, limit)
      : this.db.prepare(`
          SELECT top_finding, published_at
          FROM voice_posts
          WHERE tenant_id = ?
            AND top_module_id = ?
            AND status = 'published'
            AND top_finding IS NOT NULL
          ORDER BY published_at DESC NULLS LAST
          LIMIT ?
        `).all(this.tenantId, moduleId, limit)) as RecentTopFinding[];
    return Promise.resolve(rows);
  }

  getRecentOutcomes(authorLogin: string, limit: number): Promise<VoicePost[]> {
    const rows = this.db.prepare(`
      SELECT * FROM voice_posts
      WHERE tenant_id = ?
        AND author_login = ?
        AND status IN ('published', 'expired')
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT ?
    `).all(this.tenantId, authorLogin, limit) as SqliteVoicePostRow[];
    return Promise.resolve(rows.map(mapVoicePost));
  }

  getDraftsSince(authorLogin: string, sinceIso: string): Promise<VoicePost[]> {
    const rows = this.db.prepare(`
      SELECT * FROM voice_posts
      WHERE tenant_id = ?
        AND author_login = ?
        AND created_at >= ?
      ORDER BY created_at ASC
    `).all(this.tenantId, authorLogin, sinceIso) as SqliteVoicePostRow[];
    return Promise.resolve(rows.map(mapVoicePost));
  }

  countDraftsSince(authorLogin: string, sinceIso: string): Promise<number> {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM voice_posts
      WHERE tenant_id = ?
        AND author_login = ?
        AND created_at >= ?
    `).get(this.tenantId, authorLogin, sinceIso) as { count: number };
    return Promise.resolve(row.count);
  }

  countUniquePublished(authorLogin: string, platform?: Platform): Promise<number> {
    const rows = (platform
      ? this.db.prepare(`
          SELECT published
          FROM voice_posts
          WHERE tenant_id = ?
            AND author_login = ?
            AND platform = ?
            AND status = 'published'
            AND published IS NOT NULL
        `).all(this.tenantId, authorLogin, platform)
      : this.db.prepare(`
          SELECT published
          FROM voice_posts
          WHERE tenant_id = ?
            AND author_login = ?
            AND status = 'published'
            AND published IS NOT NULL
        `).all(this.tenantId, authorLogin)) as Array<{ published: string | null }>;
    return Promise.resolve(countDistinctPublishedPrefix(rows));
  }

  listActiveAuthors(days: number): Promise<string[]> {
    const rows = this.db.prepare(`
      SELECT DISTINCT author_login
      FROM voice_posts
      WHERE tenant_id = ?
        AND author_login IS NOT NULL
        AND (
          created_at >= datetime('now', '-' || ? || ' days')
          OR published_at >= datetime('now', '-' || ? || ' days')
        )
      UNION
      SELECT github_author_login AS author_login
      FROM voice_profiles
      WHERE tenant_id = ?
        AND github_author_login IS NOT NULL
    `).all(this.tenantId, days, days, this.tenantId) as { author_login: string }[];
    return Promise.resolve(rows.map((row) => row.author_login));
  }

  hasDraft(commit_sha: string, platform: Platform): Promise<boolean> {
    const row = this.db.prepare(`
      SELECT id FROM voice_posts WHERE tenant_id = ? AND commit_sha = ? AND platform = ?
    `).get(this.tenantId, commit_sha, platform);
    return Promise.resolve(row !== undefined);
  }

  getQueuedPosts(platform: Platform): Promise<VoicePost[]> {
    const rows = this.db.prepare(`
      SELECT * FROM voice_posts
      WHERE tenant_id = ? AND platform = ? AND status = 'queued'
      ORDER BY created_at ASC
    `).all(this.tenantId, platform) as SqliteVoicePostRow[];
    return Promise.resolve(rows.map(mapVoicePost));
  }

  getScheduledUnpublished(platform: Platform): Promise<VoicePost[]> {
    const rows = this.db.prepare(`
      SELECT * FROM voice_posts
      WHERE tenant_id = ? AND platform = ? AND status = 'scheduled' AND published IS NULL
      ORDER BY created_at ASC
    `).all(this.tenantId, platform) as SqliteVoicePostRow[];
    return Promise.resolve(rows.map(mapVoicePost));
  }

  markExpired(ids: string[]): Promise<void> {
    if (ids.length === 0) return Promise.resolve();
    const placeholders = ids.map(() => '?').join(', ');
    this.db.prepare(`
      UPDATE voice_posts
      SET status = 'expired'
      WHERE tenant_id = ? AND id IN (${placeholders})
    `).run(this.tenantId, ...ids);
    return Promise.resolve();
  }

  claimSlot(slot: SlottedPost): Promise<boolean> {
    try {
      this.db.prepare(`
        INSERT INTO scheduled_slots (id, platform, scheduled_at, voice_post_id)
        VALUES (?, ?, ?, ?)
      `).run(randomUUID(), slot.platform, slot.scheduled_at.toISOString(), slot.voice_post_id);
      return Promise.resolve(true);
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return Promise.resolve(false);
      throw err;
    }
  }

  getTakenSlots(platform: Platform, dayUtc: string): Promise<Date[]> {
    const rows = this.db.prepare(`
      SELECT scheduled_at FROM scheduled_slots
      WHERE platform = ?
        AND scheduled_at >= ? AND scheduled_at <= ?
    `).all(platform, `${dayUtc}T00:00:00.000Z`, `${dayUtc}T23:59:59.999Z`) as { scheduled_at: string }[];
    return Promise.resolve(rows.map(r => new Date(r.scheduled_at)));
  }

  depositSignal(signal: WeakSignal): Promise<void> {
    this.db.prepare(`
      INSERT INTO signal_events (
        tenant_id, github_author_login, repo, topic,
        commit_sha, strength, pattern_kind, affected_symbols, affected_files, specific_change,
        source, accumulated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      this.tenantId,
      signal.github_author_login,
      signal.repo,
      signal.topic,
      signal.commit_sha,
      signal.strength,
      signal.pattern_kind,
      JSON.stringify(signal.affected_symbols),
      JSON.stringify(signal.affected_files),
      signal.specific_change,
      signal.source,
      signal.accumulated_at,
    );

    this.db.prepare(`
      INSERT INTO signal_bank (
        tenant_id, github_author_login, repo, topic,
        weight_sum, signal_count, last_signal_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT (tenant_id, github_author_login, repo, topic) DO UPDATE SET
        weight_sum     = weight_sum + excluded.weight_sum,
        signal_count   = signal_count + 1,
        last_signal_at = excluded.last_signal_at,
        updated_at     = datetime('now')
    `).run(
      this.tenantId,
      signal.github_author_login,
      signal.repo,
      signal.topic,
      signal.strength,
      signal.accumulated_at,
    );

    return Promise.resolve();
  }

  getSignalBankEntry(authorLogin: string, repo: string, topic: string): Promise<SignalBankEntry | null> {
    const row = this.db.prepare(`
      SELECT * FROM signal_bank
      WHERE tenant_id = ? AND github_author_login = ? AND repo = ? AND topic = ?
    `).get(this.tenantId, authorLogin, repo, topic) as SqliteSignalBankRow | null;
    return Promise.resolve(row ?? null);
  }

  getSignalBankEntries(authorLogin: string, repo: string): Promise<SignalBankEntry[]> {
    const rows = this.db.prepare(`
      SELECT * FROM signal_bank
      WHERE tenant_id = ? AND github_author_login = ? AND repo = ?
    `).all(this.tenantId, authorLogin, repo) as SqliteSignalBankRow[];
    return Promise.resolve(rows);
  }

  getUnconsumedSignals(authorLogin: string, repo: string, topic: string): Promise<SignalEvent[]> {
    const rows = this.db.prepare(`
      SELECT * FROM signal_events
      WHERE tenant_id = ? AND github_author_login = ? AND repo = ? AND topic = ? AND consumed = 0
      ORDER BY accumulated_at ASC
    `).all(this.tenantId, authorLogin, repo, topic) as SqliteSignalEventRow[];

    return Promise.resolve(rows.map((r) => ({
      ...r,
      affected_symbols: JSON.parse(r.affected_symbols) as string[],
      affected_files: JSON.parse(r.affected_files) as string[],
      consumed: !!r.consumed,
    } as SignalEvent)));
  }

  consumeSignals(
    postId: string,
    authorLogin: string,
    repo: string,
    gatillador: string,
    topics: string[],
    signalIds: number[],
    snapshot: DisparoAuditItem[],
  ): Promise<void> {
    const now = new Date().toISOString();

    const placeholders = signalIds.map(() => '?').join(', ');
    this.db.prepare(`
      UPDATE signal_events
      SET consumed = 1, consumed_by_post_id = ?
      WHERE tenant_id = ? AND id IN (${placeholders})
    `).run(postId, this.tenantId, ...signalIds);

    this.db.prepare(`
      INSERT INTO post_disparo_audit (
        post_id, tenant_id, github_author_login, repo,
        gatillador, topics, consumed_signal_ids, signal_bank_snapshot, fired_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      postId,
      this.tenantId,
      authorLogin,
      repo,
      gatillador,
      JSON.stringify(topics),
      JSON.stringify(signalIds),
      JSON.stringify(snapshot),
      now,
    );

    for (const topic of topics) {
      this.db.prepare(`
        UPDATE signal_bank
        SET weight_sum = 0, signal_count = 0, last_fired_at = ?, updated_at = ?
        WHERE tenant_id = ? AND github_author_login = ? AND repo = ? AND topic = ?
      `).run(now, now, this.tenantId, authorLogin, repo, topic);
    }

    return Promise.resolve();
  }

  rollbackPostConsumption(postId: string): Promise<void> {
    const audit = this.db.prepare(`
      SELECT * FROM post_disparo_audit
      WHERE post_id = ? AND tenant_id = ?
      LIMIT 1
    `).get(postId, this.tenantId) as SqliteDisparoAuditRow | null;

    if (!audit) return Promise.resolve();

    const signalIds = JSON.parse(audit.consumed_signal_ids) as number[];
    const snapshot = JSON.parse(audit.signal_bank_snapshot) as DisparoAuditItem[];

    const placeholders = signalIds.map(() => '?').join(', ');
    this.db.prepare(`
      UPDATE signal_events
      SET consumed = 0, consumed_by_post_id = NULL
      WHERE tenant_id = ? AND id IN (${placeholders})
    `).run(this.tenantId, ...signalIds);

    for (const item of snapshot) {
      this.db.prepare(`
        UPDATE signal_bank
        SET weight_sum = ?, updated_at = datetime('now')
        WHERE tenant_id = ? AND github_author_login = ? AND repo = ? AND topic = ?
      `).run(item.weight_sum, this.tenantId, audit.github_author_login, audit.repo, item.topic);
    }

    return Promise.resolve();
  }

  recordRoutingDecision(input: RoutingDecisionInput): Promise<void> {
    this.db.prepare(`
      INSERT INTO routing_decisions_audit (
        tenant_id, github_author_login, voice_post_id, commit_shas,
        score_coherencia, score_structural, score_temporal, score_lexical, decision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      this.tenantId,
      input.github_author_login,
      input.voice_post_id,
      JSON.stringify(input.commit_shas),
      input.score_coherencia,
      input.score_structural,
      input.score_temporal,
      input.score_lexical,
      input.decision,
    );
    return Promise.resolve();
  }

  adjustSignalBankMultiplier(authorLogin: string, repo: string, topic: string, factor: number): Promise<void> {
    const row = this.db.prepare(`
      SELECT id, multiplier FROM signal_bank
      WHERE tenant_id = ? AND github_author_login = ? AND repo = ? AND topic = ?
    `).get(this.tenantId, authorLogin, repo, topic) as { id: number; multiplier: number } | undefined;

    if (!row) return Promise.resolve();

    const clamped = Math.min(3.0, Math.max(0.1, row.multiplier * factor));
    this.db.prepare(`
      UPDATE signal_bank SET multiplier = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(clamped, row.id);

    return Promise.resolve();
  }

  updateHalfLivesForAuthor(authorLogin: string, repo: string): Promise<void> {
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const rows = this.db.prepare(`
      SELECT commit_sha, MIN(accumulated_at) as ts
      FROM signal_events
      WHERE tenant_id = ? AND github_author_login = ? AND repo = ?
        AND accumulated_at > ?
      GROUP BY commit_sha
      ORDER BY ts ASC
    `).all(this.tenantId, authorLogin, repo, since) as { commit_sha: string; ts: string }[];

    const commitsCount = rows.length;
    if (commitsCount < 2) return Promise.resolve();

    const timestamps = rows.map((r) => new Date(r.ts).getTime());
    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push((timestamps[i]! - timestamps[i - 1]!) / (24 * 60 * 60 * 1000));
    }
    intervals.sort((a, b) => a - b);
    const mid = Math.floor(intervals.length / 2);
    const medianIntervalDays = intervals.length % 2 === 0
      ? ((intervals[mid - 1]! + intervals[mid]!) / 2)
      : intervals[mid]!;

    const { halfLifeSignal, halfLifeRefractory } = computeHalfLives(commitsCount, medianIntervalDays);

    this.db.prepare(`
      UPDATE signal_bank
      SET half_life_signal = ?, half_life_refractory = ?, commit_frequency = ?, updated_at = datetime('now')
      WHERE tenant_id = ? AND github_author_login = ? AND repo = ?
    `).run(halfLifeSignal, halfLifeRefractory, medianIntervalDays, this.tenantId, authorLogin, repo);

    return Promise.resolve();
  }

  /** Local-dev utility: read/write events_state */
  getEventsState(username: string): { last_event_id: string; last_event_etag: string | null } | null {
    return this.db.prepare(`SELECT * FROM events_state WHERE username = ?`).get(username) as
      { last_event_id: string; last_event_etag: string | null } | null;
  }

  setEventsState(username: string, last_event_id: string, last_event_etag: string | null): void {
    this.db.prepare(`
      INSERT INTO events_state (username, last_event_id, last_event_etag)
      VALUES (?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        last_event_id = excluded.last_event_id,
        last_event_etag = excluded.last_event_etag,
        updated_at = datetime('now')
    `).run(username, last_event_id, last_event_etag);
  }

  close(): void {
    this.db.close();
  }

  private fetchVoiceProfileRow(authorLogin: string | null): SqliteVoiceProfileRow | null {
    const query = authorLogin === null
      ? `
        SELECT id, github_author_login, voice, version
        FROM voice_profiles
        WHERE tenant_id = ? AND github_author_login IS NULL
        LIMIT 1
      `
      : `
        SELECT id, github_author_login, voice, version
        FROM voice_profiles
        WHERE tenant_id = ? AND github_author_login = ?
        LIMIT 1
      `;

    return (authorLogin === null
      ? this.db.prepare(query).get(this.tenantId)
      : this.db.prepare(query).get(this.tenantId, authorLogin)) as SqliteVoiceProfileRow | null;
  }

  private loadLegacyVoiceProfile(): StoredVoiceProfile | null {
    if (!this.hasTable('tenants')) return null;

    const tenant = this.db.prepare(`
      SELECT config
      FROM tenants
      WHERE id = ?
      LIMIT 1
    `).get(this.tenantId) as { config: string | null } | undefined;

    if (!tenant?.config) return null;

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(tenant.config) as Record<string, unknown>;
    } catch {
      return null;
    }

    const voice = normalizeVoiceProfile(config['voice']);
    if (!voice) return null;
    return { voice, version: 1, source: 'legacy' };
  }

  private hasTable(name: string): boolean {
    const row = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?
    `).get(name) as { name: string } | undefined;
    return !!row;
  }
}

function dedupePublishedPrefix(rows: VoicePost[]): VoicePost[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = (row.published ?? '').slice(0, 80);
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countDistinctPublishedPrefix(rows: Array<{ published: string | null }>): number {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = (row.published ?? '').slice(0, 80);
    if (!key) continue;
    seen.add(key);
  }
  return seen.size;
}
