import type { BootstrapPost, ContentStrategy, HookStyle, VoiceProfile } from '../config/schema.js';

export type Platform = 'linkedin' | 'instagram';
export type PostStatus = 'pending' | 'scheduled' | 'published' | 'queued' | 'expired' | 'failed';
export type ContextStatus = 'skipped' | 'no_match' | 'matched';
export type PublishSource = 'buffer' | 'linkedin_direct';
export type VoiceStage = 'cold' | 'bootstrap' | 'warming' | 'established';

export interface StoredVoiceProfile {
  voice: VoiceProfile;
  version: number;
}

export interface EditAnalysis {
  hook_changed: boolean;
  closing_changed: boolean;
  length_delta: number;
  hashtags_kept_ratio: number;
  industry_context_removed: boolean;
  edit_type: 'polish' | 'restructure' | 'rewrite';
}

export interface VoicePost {
  id: string;
  created_at: string;
  commit_sha: string;
  repo: string;
  platform: Platform;
  ai_draft: string;
  published: string | null;
  edit_ratio: number | null;
  published_at: string | null;
  buffer_post_id: string | null;
  scheduled_at: string | null;
  status: PostStatus;
  top_finding: string | null;
  top_module_id: string | null;
  findings_count: number;
  author_login: string | null;
  edit_analysis: Record<string, unknown> | null;
  context_status: ContextStatus | null;
  has_industry_context: boolean;
  matched_article_id: string | null;
  matched_source_id: string | null;
  match_strength: number | null;
  match_connection: string | null;
  linkedin_urn: string | null;
  reactions_count: number;
  last_reactions_fetch_at: string | null;
  engagement_score: number | null;
  publish_source: PublishSource | null;
  generation_system?: 'v1' | 'v2_progressive' | null;
  opening_move?: string | null;
}

export interface SaveDraftInput {
  commit_sha: string;
  repo: string;
  platform: Platform;
  ai_draft: string;
  top_finding?: string;
  top_module_id?: string;
  findings_count?: number;
  author_login?: string | null;
  context_status?: ContextStatus | null;
  has_industry_context?: boolean;
  matched_article_id?: string | null;
  matched_source_id?: string | null;
  match_strength?: number | null;
  match_connection?: string | null;
  generation_system?: 'v1' | 'v2_progressive' | null;
  opening_move?: string | null;
}

export interface UpdatePublishedInput {
  id: string;
  published: string;
  edit_ratio: number;
  published_at: string;
  edit_analysis?: EditAnalysis | null;
  linkedin_urn?: string;  // extracted from Buffer externalLink when available
  publish_source?: PublishSource;
}

export interface UpdateScheduledInput {
  id: string;
  buffer_post_id: string;
  scheduled_at: string | null;
  status: PostStatus;
}

export interface UpdateEngagementInput {
  id: string;
  linkedin_urn: string;
  reactions_count: number;
  engagement_score: number;
}

export interface SlottedPost {
  platform: Platform;
  scheduled_at: Date;
  voice_post_id: string;
}

export interface RecentTopFinding {
  top_finding: string;
  published_at: string;
}

export interface IVoiceStorage {
  /** The tenant this storage instance is scoped to. All queries filter by this. */
  readonly tenantId: string;

  /** Save an AI draft immediately after generation. Returns the new row ID. */
  saveDraft(input: SaveDraftInput): Promise<string>;

  /** Lookup voice profile for a specific author, falling back to tenant default row only. */
  getVoiceProfile(authorLogin: string | null): Promise<StoredVoiceProfile | null>;

  /** Insert or update a voice profile row scoped to a specific author or tenant default. */
  saveVoiceProfile(authorLogin: string | null, voice: VoiceProfile, expectedVersion?: number): Promise<boolean>;

  /** Update a post after Buffer publishes it (voice loop feedback). */
  updatePublished(input: UpdatePublishedInput): Promise<void>;

  /** Update a post with Buffer scheduling details. */
  updateScheduled(input: UpdateScheduledInput): Promise<void>;

  /** Mark a post as 'queued' (Buffer queue is full). */
  markQueued(id: string): Promise<void>;

  /** Retrieve top published posts for voice examples, ordered by engagement_score DESC NULLS LAST, edit_ratio DESC. */
  getTopVoiceExamples(platform: Platform, limit: number): Promise<VoicePost[]>;

  /** Update engagement data after fetching from LinkedIn socialActions API. */
  updateEngagement(input: UpdateEngagementInput): Promise<void>;

  /** Get published posts that have a linkedin_urn but no engagement_score yet. */
  getPostsPendingEngagement(platform: Platform): Promise<VoicePost[]>;

  /** Get most recent published posts across all platforms, sorted by published_at DESC. */
  getRecentPublished(limit: number): Promise<VoicePost[]>;

  /** Get recent published posts for one author/platform and quality threshold. */
  getPublishedForAuthor(
    authorLogin: string,
    platform: Platform,
    limit: number,
    minEditRatio?: number,
  ): Promise<VoicePost[]>;

  /** Exposure pool query: per-platform, published-only, edit_ratio >= 0.30, deduped by published prefix. */
  getPublishedForExposure(authorLogin: string, platform: Platform): Promise<VoicePost[]>;

  /** Move-measurement query: cross-platform, published-only, edit_ratio >= 0.30, deduped by published prefix. */
  getPublishedForMoves(authorLogin: string): Promise<VoicePost[]>;

  /** Get recent top_finding texts for chapter context. */
  getRecentTopFindings(authorLogin: string | null, moduleId: string, limit: number): Promise<RecentTopFinding[]>;

  /** Get recent outcomes for one author across published/expired rows. */
  getRecentOutcomes(authorLogin: string, limit: number): Promise<VoicePost[]>;

  /** Get drafts created after the provided ISO timestamp, ordered oldest-first. */
  getDraftsSince(authorLogin: string, sinceIso: string): Promise<VoicePost[]>;

  /** Count drafts for one author created after the provided ISO timestamp. */
  countDraftsSince(authorLogin: string, sinceIso: string): Promise<number>;

  /** Count unique published texts for an author, optionally scoped to one platform. */
  countUniquePublished(authorLogin: string, platform?: Platform): Promise<number>;

  /** Enumerate authors that should be processed by the scanner. */
  listActiveAuthors(days: number): Promise<string[]>;

  /** Check if a commit SHA + platform already has a processed post. */
  hasDraft(commit_sha: string, platform: Platform): Promise<boolean>;

  /**
   * Returns the top_module_id values for posts created in the last `days` days.
   * Used by the pipeline to apply the freshness multiplier to recently-fired modules.
   */
  getRecentModuleIds(days: number): Promise<string[]>;

  /** Get all posts with status='queued' for a given platform. */
  getQueuedPosts(platform: Platform): Promise<VoicePost[]>;

  /** Get scheduled posts that haven't been matched to a published post yet (for voice loop). */
  getScheduledUnpublished(platform: Platform): Promise<VoicePost[]>;

  /** Mark one or more scheduled rows as expired. */
  markExpired(ids: string[]): Promise<void>;

  /** Claim a scheduling slot atomically. Returns false if slot already taken. */
  claimSlot(slot: SlottedPost): Promise<boolean>;

  /** Get all taken slots for a platform on a given day (UTC date string YYYY-MM-DD). */
  getTakenSlots(platform: Platform, dayUtc: string): Promise<Date[]>;
}

export type {
  BootstrapPost,
  ContentStrategy,
  HookStyle,
  VoiceProfile,
};
