import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

export class SupabaseStorage implements IVoiceStorage {
  private readonly db: SupabaseClient;
  readonly tenantId: string;

  constructor(url: string, anonKey: string, tenantId: string) {
    this.db = createClient(url, anonKey);
    this.tenantId = tenantId;
  }

  async saveDraft(input: SaveDraftInput): Promise<string> {
    const { data, error } = await this.db
      .from('voice_posts')
      .insert({
        commit_sha: input.commit_sha,
        repo: input.repo,
        platform: input.platform,
        ai_draft: input.ai_draft,
        top_finding: input.top_finding ?? null,
        top_module_id: input.top_module_id ?? null,
        findings_count: input.findings_count ?? 0,
        status: 'pending' satisfies PostStatus,
        tenant_id: this.tenantId,
      })
      .select('id')
      .single();

    if (error) throw new Error(`saveDraft failed: ${error.message}`);
    return (data as { id: string }).id;
  }

  async updatePublished(input: UpdatePublishedInput): Promise<void> {
    const { error } = await this.db
      .from('voice_posts')
      .update({
        published: input.published,
        edit_ratio: input.edit_ratio,
        published_at: input.published_at,
        status: 'published' satisfies PostStatus,
        ...(input.linkedin_urn !== undefined && { linkedin_urn: input.linkedin_urn }),
      })
      .eq('id', input.id);

    if (error) throw new Error(`updatePublished failed: ${error.message}`);
  }

  async updateScheduled(input: UpdateScheduledInput): Promise<void> {
    const { error } = await this.db
      .from('voice_posts')
      .update({
        buffer_post_id: input.buffer_post_id,
        scheduled_at: input.scheduled_at,
        status: input.status,
      })
      .eq('id', input.id);

    if (error) throw new Error(`updateScheduled failed: ${error.message}`);
  }

  async markQueued(id: string): Promise<void> {
    const { error } = await this.db
      .from('voice_posts')
      .update({ status: 'queued' satisfies PostStatus })
      .eq('id', id);

    if (error) throw new Error(`markQueued failed: ${error.message}`);
  }

  async getTopVoiceExamples(platform: Platform, limit: number): Promise<VoicePost[]> {
    const { data, error } = await this.db
      .from('voice_posts')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('platform', platform)
      .eq('status', 'published')
      .not('edit_ratio', 'is', null)
      .order('engagement_score', { ascending: false, nullsFirst: false })
      .order('edit_ratio', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) throw new Error(`getTopVoiceExamples failed: ${error.message}`);
    return (data ?? []) as VoicePost[];
  }

  async updateEngagement(input: UpdateEngagementInput): Promise<void> {
    const { error } = await this.db
      .from('voice_posts')
      .update({
        linkedin_urn: input.linkedin_urn,
        reactions_count: input.reactions_count,
        engagement_score: input.engagement_score,
      })
      .eq('id', input.id);

    if (error) throw new Error(`updateEngagement failed: ${error.message}`);
  }

  async getPostsPendingEngagement(platform: Platform): Promise<VoicePost[]> {
    const { data, error } = await this.db
      .from('voice_posts')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('platform', platform)
      .eq('status', 'published')
      .not('linkedin_urn', 'is', null)
      .is('engagement_score', null);

    if (error) throw new Error(`getPostsPendingEngagement failed: ${error.message}`);
    return (data ?? []) as VoicePost[];
  }

  async getRecentPublished(limit: number): Promise<VoicePost[]> {
    const { data, error } = await this.db
      .from('voice_posts')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) throw new Error(`getRecentPublished failed: ${error.message}`);
    return (data ?? []) as VoicePost[];
  }

  async getRecentModuleIds(days: number): Promise<string[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.db
      .from('voice_posts')
      .select('top_module_id')
      .eq('tenant_id', this.tenantId)
      .gte('created_at', since)
      .not('top_module_id', 'is', null);

    if (error) throw new Error(`getRecentModuleIds failed: ${error.message}`);
    return (data ?? []).map((r) => (r as { top_module_id: string }).top_module_id);
  }

  async hasDraft(commit_sha: string, platform: Platform): Promise<boolean> {
    const { count, error } = await this.db
      .from('voice_posts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', this.tenantId)
      .eq('commit_sha', commit_sha)
      .eq('platform', platform);

    if (error) throw new Error(`hasDraft failed: ${error.message}`);
    return (count ?? 0) > 0;
  }

  async getQueuedPosts(platform: Platform): Promise<VoicePost[]> {
    const { data, error } = await this.db
      .from('voice_posts')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('platform', platform)
      .eq('status', 'queued')
      .order('created_at', { ascending: true });

    if (error) throw new Error(`getQueuedPosts failed: ${error.message}`);
    return (data ?? []) as VoicePost[];
  }

  async getScheduledUnpublished(platform: Platform): Promise<VoicePost[]> {
    const { data, error } = await this.db
      .from('voice_posts')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('platform', platform)
      .eq('status', 'scheduled')
      .is('published', null)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`getScheduledUnpublished failed: ${error.message}`);
    return (data ?? []) as VoicePost[];
  }

  async claimSlot(slot: SlottedPost): Promise<boolean> {
    const { error } = await this.db
      .from('scheduled_slots')
      .insert({
        platform: slot.platform,
        scheduled_at: slot.scheduled_at.toISOString(),
        voice_post_id: slot.voice_post_id,
      });

    if (error) {
      // Unique constraint violation means slot is taken
      if (error.code === '23505') return false;
      throw new Error(`claimSlot failed: ${error.message}`);
    }
    return true;
  }

  async getTakenSlots(platform: Platform, dayUtc: string): Promise<Date[]> {
    const startOfDay = `${dayUtc}T00:00:00Z`;
    const endOfDay = `${dayUtc}T23:59:59Z`;

    const { data, error } = await this.db
      .from('scheduled_slots')
      .select('scheduled_at')
      .eq('platform', platform)
      .gte('scheduled_at', startOfDay)
      .lte('scheduled_at', endOfDay);

    if (error) throw new Error(`getTakenSlots failed: ${error.message}`);
    return (data ?? []).map(r => new Date((r as { scheduled_at: string }).scheduled_at));
  }
}
