import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
} from './storage.js';

interface VoiceProfileRow {
  id: string;
  github_author_login: string | null;
  voice: unknown;
  version: number;
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
        author_login: input.author_login ?? null,
        context_status: input.context_status ?? null,
        has_industry_context: input.has_industry_context ?? false,
        matched_article_id: input.matched_article_id ?? null,
        matched_source_id: input.matched_source_id ?? null,
        match_strength: input.match_strength ?? null,
        match_connection: input.match_connection ?? null,
        generation_system: input.generation_system ?? null,
        opening_move: input.opening_move ?? null,
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
        ...(input.edit_analysis !== undefined && { edit_analysis: input.edit_analysis }),
        status: 'published' satisfies PostStatus,
        ...(input.linkedin_urn !== undefined && { linkedin_urn: input.linkedin_urn }),
        ...(input.publish_source !== undefined && { publish_source: input.publish_source }),
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

  async getVoiceProfile(authorLogin: string | null): Promise<StoredVoiceProfile | null> {
    const exact = await this.fetchVoiceProfileRow(authorLogin);
    if (exact) {
      return {
        voice: normalizeVoiceProfile(exact.voice) ?? DEFAULT_VOICE_PROFILE,
        version: exact.version,
      };
    }

    if (authorLogin) {
      const fallback = await this.fetchVoiceProfileRow(null);
      if (fallback) {
        return {
          voice: normalizeVoiceProfile(fallback.voice) ?? DEFAULT_VOICE_PROFILE,
          version: fallback.version,
        };
      }
    }

    const legacy = await this.loadLegacyVoiceProfile();
    if (!legacy) return null;

    await this.saveVoiceProfile(null, legacy.voice, legacy.version);
    return legacy;
  }

  async saveVoiceProfile(authorLogin: string | null, voice: VoiceProfile, expectedVersion?: number): Promise<boolean> {
    const normalized = normalizeVoiceProfile(voice) ?? DEFAULT_VOICE_PROFILE;
    const existing = await this.fetchVoiceProfileRow(authorLogin);

    if (!existing) {
      if (expectedVersion !== undefined && expectedVersion !== 0) return false;

      const { error } = await this.db
        .from('voice_profiles')
        .insert({
          tenant_id: this.tenantId,
          github_author_login: authorLogin,
          voice: normalized,
          version: 1,
        });

      if (error) throw new Error(`saveVoiceProfile insert failed: ${error.message}`);
      return true;
    }

    if (expectedVersion !== undefined && existing.version !== expectedVersion) return false;

    const nextVersion = existing.version + 1;
    const { error } = await this.db
      .from('voice_profiles')
      .update({
        voice: normalized,
        version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('version', expectedVersion ?? existing.version);

    if (error) throw new Error(`saveVoiceProfile update failed: ${error.message}`);
    return true;
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

  async getPublishedForAuthor(
    authorLogin: string,
    platform: Platform,
    limit: number,
    minEditRatio = 0.7,
  ): Promise<VoicePost[]> {
    const { data, error } = await this.db
      .from('voice_posts')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('author_login', authorLogin)
      .eq('platform', platform)
      .eq('status', 'published')
      .gte('edit_ratio', minEditRatio)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) throw new Error(`getPublishedForAuthor failed: ${error.message}`);
    return (data ?? []) as VoicePost[];
  }

  async getPublishedForExposure(authorLogin: string, platform: Platform): Promise<VoicePost[]> {
    const { data, error } = await this.db
      .from('voice_posts')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('author_login', authorLogin)
      .eq('platform', platform)
      .eq('status', 'published')
      .not('published', 'is', null)
      .gte('edit_ratio', 0.3)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(40);

    if (error) throw new Error(`getPublishedForExposure failed: ${error.message}`);
    return dedupePublishedPrefix((data ?? []) as VoicePost[]);
  }

  async getPublishedForMoves(authorLogin: string): Promise<VoicePost[]> {
    const { data, error } = await this.db
      .from('voice_posts')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('author_login', authorLogin)
      .eq('status', 'published')
      .not('published', 'is', null)
      .gte('edit_ratio', 0.3)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(30);

    if (error) throw new Error(`getPublishedForMoves failed: ${error.message}`);
    return dedupePublishedPrefix((data ?? []) as VoicePost[]);
  }

  async getRecentTopFindings(authorLogin: string | null, moduleId: string, limit: number): Promise<RecentTopFinding[]> {
    let query = this.db
      .from('voice_posts')
      .select('top_finding, published_at')
      .eq('tenant_id', this.tenantId)
      .eq('top_module_id', moduleId)
      .eq('status', 'published')
      .not('top_finding', 'is', null)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (authorLogin) query = query.eq('author_login', authorLogin);

    const { data, error } = await query;
    if (error) throw new Error(`getRecentTopFindings failed: ${error.message}`);
    return (data ?? []) as RecentTopFinding[];
  }

  async getRecentOutcomes(authorLogin: string, limit: number): Promise<VoicePost[]> {
    const { data, error } = await this.db
      .from('voice_posts')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('author_login', authorLogin)
      .in('status', ['published', 'expired'])
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`getRecentOutcomes failed: ${error.message}`);
    return (data ?? []) as VoicePost[];
  }

  async getDraftsSince(authorLogin: string, sinceIso: string): Promise<VoicePost[]> {
    const { data, error } = await this.db
      .from('voice_posts')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('author_login', authorLogin)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`getDraftsSince failed: ${error.message}`);
    return (data ?? []) as VoicePost[];
  }

  async countDraftsSince(authorLogin: string, sinceIso: string): Promise<number> {
    const { count, error } = await this.db
      .from('voice_posts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', this.tenantId)
      .eq('author_login', authorLogin)
      .gte('created_at', sinceIso);

    if (error) throw new Error(`countDraftsSince failed: ${error.message}`);
    return count ?? 0;
  }

  async countUniquePublished(authorLogin: string, platform?: Platform): Promise<number> {
    let query = this.db
      .from('voice_posts')
      .select('published')
      .eq('tenant_id', this.tenantId)
      .eq('author_login', authorLogin)
      .eq('status', 'published')
      .not('published', 'is', null);

    if (platform) query = query.eq('platform', platform);

    const { data, error } = await query;

    if (error) throw new Error(`countUniquePublished failed: ${error.message}`);
    return countDistinctPublishedPrefix((data ?? []) as Array<{ published: string | null }>);
  }

  async listActiveAuthors(days: number): Promise<string[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const authorSet = new Set<string>();

    const [{ data: postAuthors, error: postError }, { data: profileAuthors, error: profileError }] = await Promise.all([
      this.db
        .from('voice_posts')
        .select('author_login')
        .eq('tenant_id', this.tenantId)
        .not('author_login', 'is', null)
        .or(`created_at.gte.${since},published_at.gte.${since}`),
      this.db
        .from('voice_profiles')
        .select('github_author_login')
        .eq('tenant_id', this.tenantId)
        .not('github_author_login', 'is', null),
    ]);

    if (postError) throw new Error(`listActiveAuthors posts failed: ${postError.message}`);
    if (profileError) throw new Error(`listActiveAuthors profiles failed: ${profileError.message}`);

    for (const row of postAuthors ?? []) {
      const authorLogin = (row as { author_login: string | null }).author_login;
      if (authorLogin) authorSet.add(authorLogin);
    }
    for (const row of profileAuthors ?? []) {
      const authorLogin = (row as { github_author_login: string | null }).github_author_login;
      if (authorLogin) authorSet.add(authorLogin);
    }

    return [...authorSet];
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

  async markExpired(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const { error } = await this.db
      .from('voice_posts')
      .update({ status: 'expired' satisfies PostStatus })
      .in('id', ids);

    if (error) throw new Error(`markExpired failed: ${error.message}`);
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

  private async fetchVoiceProfileRow(authorLogin: string | null): Promise<VoiceProfileRow | null> {
    let query = this.db
      .from('voice_profiles')
      .select('id, github_author_login, voice, version')
      .eq('tenant_id', this.tenantId);

    query = authorLogin === null
      ? query.is('github_author_login', null)
      : query.eq('github_author_login', authorLogin);

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`fetchVoiceProfileRow failed: ${error.message}`);
    return (data as VoiceProfileRow | null) ?? null;
  }

  private async loadLegacyVoiceProfile(): Promise<StoredVoiceProfile | null> {
    const { data, error } = await this.db
      .from('tenants')
      .select('config')
      .eq('id', this.tenantId)
      .maybeSingle();

    if (error) throw new Error(`loadLegacyVoiceProfile failed: ${error.message}`);
    if (!data) return null;

    const config = (data as { config?: Record<string, unknown> | null }).config ?? {};
    const voice = normalizeVoiceProfile(config['voice']);
    if (!voice) return null;
    return { voice, version: 1 };
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
