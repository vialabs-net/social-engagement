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
}

export interface SaveDraftInput {
  commit_sha: string;
  repo: string;
  platform: Platform;
  ai_draft: string;
  top_finding?: string;
  findings_count?: number;
}

export interface UpdatePublishedInput {
  id: string;
  published: string;
  edit_ratio: number;
  published_at: string;
}

export interface UpdateScheduledInput {
  id: string;
  buffer_post_id: string;
  scheduled_at: string;
  status: PostStatus;
}

export interface SlottedPost {
  platform: Platform;
  scheduled_at: Date;
  voice_post_id: string;
}

export interface IVoiceStorage {
  /** Save an AI draft immediately after generation. Returns the new row ID. */
  saveDraft(input: SaveDraftInput): Promise<string>;

  /** Update a post after Buffer publishes it (voice loop feedback). */
  updatePublished(input: UpdatePublishedInput): Promise<void>;

  /** Update a post with Buffer scheduling details. */
  updateScheduled(input: UpdateScheduledInput): Promise<void>;

  /** Mark a post as 'queued' (Buffer queue is full). */
  markQueued(id: string): Promise<void>;

  /** Retrieve top published posts for voice examples, ordered by edit_ratio DESC. */
  getTopVoiceExamples(platform: Platform, limit: number): Promise<VoicePost[]>;

  /** Check if a commit SHA + platform already has a processed post. */
  hasDraft(commit_sha: string, platform: Platform): Promise<boolean>;

  /** Get all posts with status='queued' for a given platform. */
  getQueuedPosts(platform: Platform): Promise<VoicePost[]>;

  /** Claim a scheduling slot atomically. Returns false if slot already taken. */
  claimSlot(slot: SlottedPost): Promise<boolean>;

  /** Get all taken slots for a platform on a given day (UTC date string YYYY-MM-DD). */
  getTakenSlots(platform: Platform, dayUtc: string): Promise<Date[]>;
}
