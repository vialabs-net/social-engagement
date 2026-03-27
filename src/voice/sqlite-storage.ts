import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type {
  IVoiceStorage,
  VoicePost,
  SaveDraftInput,
  UpdatePublishedInput,
  UpdateScheduledInput,
  UpdateEngagementInput,
  Platform,
  PostStatus,
  SlottedPost,
} from './storage.js';

export class SqliteStorage implements IVoiceStorage {
  private readonly db: Database.Database;

  constructor(dbPath = 'data/devcast.db') {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
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
        findings_count  INTEGER NOT NULL DEFAULT 0,
        linkedin_urn    TEXT,
        reactions_count INTEGER NOT NULL DEFAULT 0,
        engagement_score REAL
      );

      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS linkedin_urn     TEXT;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS reactions_count  INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS engagement_score REAL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_sha_platform
        ON voice_posts(commit_sha, platform);

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
    `);
  }

  saveDraft(input: SaveDraftInput): Promise<string> {
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO voice_posts (id, commit_sha, repo, platform, ai_draft, top_finding, findings_count, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(id, input.commit_sha, input.repo, input.platform, input.ai_draft,
           input.top_finding ?? null, input.findings_count ?? 0);
    return Promise.resolve(id);
  }

  updatePublished(input: UpdatePublishedInput): Promise<void> {
    this.db.prepare(`
      UPDATE voice_posts
      SET published = ?, edit_ratio = ?, published_at = ?, status = 'published',
          linkedin_urn = COALESCE(?, linkedin_urn)
      WHERE id = ?
    `).run(input.published, input.edit_ratio, input.published_at,
           input.linkedin_urn ?? null, input.id);
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
      WHERE platform = ? AND status = 'published' AND edit_ratio IS NOT NULL
      ORDER BY engagement_score DESC NULLS LAST, edit_ratio DESC NULLS LAST
      LIMIT ?
    `).all(platform, limit) as VoicePost[];
    return Promise.resolve(rows);
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
      WHERE platform = ? AND status = 'published'
        AND linkedin_urn IS NOT NULL AND engagement_score IS NULL
    `).all(platform) as VoicePost[];
    return Promise.resolve(rows);
  }

  hasDraft(commit_sha: string, platform: Platform): Promise<boolean> {
    const row = this.db.prepare(`
      SELECT id FROM voice_posts WHERE commit_sha = ? AND platform = ?
    `).get(commit_sha, platform);
    return Promise.resolve(row !== undefined);
  }

  getQueuedPosts(platform: Platform): Promise<VoicePost[]> {
    const rows = this.db.prepare(`
      SELECT * FROM voice_posts
      WHERE platform = ? AND status = 'queued'
      ORDER BY created_at ASC
    `).all(platform) as VoicePost[];
    return Promise.resolve(rows);
  }

  getScheduledUnpublished(platform: Platform): Promise<VoicePost[]> {
    const rows = this.db.prepare(`
      SELECT * FROM voice_posts
      WHERE platform = ? AND status = 'scheduled' AND published IS NULL
      ORDER BY created_at ASC
    `).all(platform) as VoicePost[];
    return Promise.resolve(rows);
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
}
