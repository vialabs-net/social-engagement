export type Platform = 'linkedin' | 'instagram';
export type PostStatus = 'pending' | 'scheduled' | 'published' | 'queued';

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
  findings_count: number;
  linkedin_urn: string | null;
  reactions_count: number;
  engagement_score: number | null;
}

export interface SaveDraftInput {
  commit_sha: string;
  repo: string;
  platform: Platform;
  ai_draft: string;
  top_finding?: string;
  top_module_id?: string;
  findings_count?: number;
}

export interface UpdatePublishedInput {
  id: string;
  published: string;
  edit_ratio: number;
  published_at: string;
  linkedin_urn?: string;  // extracted from Buffer externalLink when available
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

export interface IVoiceStorage {
  /** The tenant this storage instance is scoped to. All queries filter by this. */
  readonly tenantId: string;

  /** Save an AI draft immediately after generation. Returns the new row ID. */
  saveDraft(input: SaveDraftInput): Promise<string>;

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

  /** Claim a scheduling slot atomically. Returns false if slot already taken. */
  claimSlot(slot: SlottedPost): Promise<boolean>;

  /** Get all taken slots for a platform on a given day (UTC date string YYYY-MM-DD). */
  getTakenSlots(platform: Platform, dayUtc: string): Promise<Date[]>;
}
