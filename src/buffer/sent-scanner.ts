import { logger } from '../utils/logger.js';
import { computeEditRatio } from '../voice/similarity.js';
import type { BufferClient } from './client.js';
import type { IVoiceStorage, Platform } from '../voice/storage.js';
import type { Config } from '../config/schema.js';
import { computeEditAnalysis, deriveContentPreferences } from '../voice/feedback.js';
import { refreshVoiceMoves } from '../voice/moves-calculator.js';
import { mergeVoiceProfile } from '../voice/profile-utils.js';

const MATCH_THRESHOLD = 0.4;  // min similarity to count as a match
const EXPIRED_DAYS = 7;

function extractLinkedInUrn(externalLink: string | null): string | undefined {
  if (!externalLink) return undefined;
  const match = externalLink.match(/urn:li:share:\d+/);
  return match?.[0];
}

/**
 * Polls Buffer's "sent" feed and updates voice history for newly published posts.
 *
 * Because posts are created as Buffer Ideas (not scheduled posts), the published
 * post ID differs from the stored buffer_post_id (idea ID). Matching is done by
 * text similarity between the sent post text and the stored ai_draft.
 */
export async function scanSentPosts(
  bufferClient: BufferClient,
  storage: IVoiceStorage,
  config: Config,
): Promise<void> {
  const platforms: { platform: Platform; profileId: string }[] = [];

  if (config.platforms.linkedin.enabled && config.platforms.linkedin.buffer_profile_id) {
    platforms.push({ platform: 'linkedin', profileId: config.platforms.linkedin.buffer_profile_id });
  }
  if (config.platforms.instagram.enabled && config.platforms.instagram.buffer_profile_id) {
    platforms.push({ platform: 'instagram', profileId: config.platforms.instagram.buffer_profile_id });
  }

  const orgId = config.buffer.organization_id;

  for (const { platform, profileId } of platforms) {
    logger.info('sent_scanner.start', { platform });
    await scanPlatform(bufferClient, storage, platform, orgId, profileId);
  }

  const authors = await storage.listActiveAuthors(30);
  for (const authorLogin of authors) {
    await refreshContentPreferences(storage, authorLogin);
    await refreshVoiceMoves(storage, authorLogin);
  }
}

async function scanPlatform(
  bufferClient: BufferClient,
  storage: IVoiceStorage,
  platform: Platform,
  orgId: string,
  channelId: string,
): Promise<void> {
  const [sentPosts, unmatched] = await Promise.all([
    bufferClient.getSentPosts(orgId, channelId),
    storage.getScheduledUnpublished(platform),
  ]);

  if (sentPosts.length === 0 || unmatched.length === 0) {
    logger.info('sent_scanner.nothing_to_match', { platform, sentCount: sentPosts.length, draftCount: unmatched.length });
    return;
  }

  let matched = 0;

  // Copy to mutable list so matched drafts can be removed
  const remaining = [...unmatched];

  for (const sentPost of sentPosts) {
    let bestScore = 0;
    let bestIdx = -1;

    for (let i = 0; i < remaining.length; i++) {
      const draft = remaining[i];
      if (!draft) continue;
      const score = computeEditRatio(draft.ai_draft, sentPost.text);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && bestScore >= MATCH_THRESHOLD) {
      const bestDraft = remaining[bestIdx]!;
      const publishedAt = sentPost.createdAt;
      const linkedinUrn = extractLinkedInUrn(sentPost.externalLink);
      const editAnalysis = computeEditAnalysis(bestDraft, sentPost.text);
      await storage.updatePublished({
        id: bestDraft.id,
        published: sentPost.text,
        edit_ratio: bestScore,
        published_at: publishedAt,
        edit_analysis: editAnalysis,
        linkedin_urn: linkedinUrn,
        publish_source: 'buffer',
      });
      logger.info('sent_scanner.matched', {
        draftId: bestDraft.id,
        editRatio: bestScore.toFixed(2),
        platform,
        linkedinUrn: linkedinUrn ?? null,
      });
      // Remove matched draft so it can't be claimed by another sent post
      remaining.splice(bestIdx, 1);
      matched++;
    }
  }

  const staleDrafts = remaining.filter((draft) => (
    !!draft.buffer_post_id
    && !!draft.scheduled_at
    && new Date(draft.scheduled_at).getTime() < Date.now() - EXPIRED_DAYS * 24 * 60 * 60 * 1000
  ));
  if (staleDrafts.length > 0) {
    await storage.markExpired(staleDrafts.map((draft) => draft.id));
    logger.info('sent_scanner.expired', { platform, count: staleDrafts.length });
  }

  logger.info('sent_scanner.done', { platform, scanned: sentPosts.length, matched });
}

async function refreshContentPreferences(storage: IVoiceStorage, authorLogin: string): Promise<void> {
  const outcomes = await storage.getRecentOutcomes(authorLogin, 20);
  if (outcomes.length < 10) return;

  const storedProfile = await storage.getVoiceProfile(authorLogin);
  const voiceProfile = mergeVoiceProfile(storedProfile?.voice);
  const updatedAt = voiceProfile.content_preferences?.updated_at;

  if (updatedAt) {
    const newOutcomes = outcomes.filter((post) => new Date(post.published_at ?? post.created_at) > new Date(updatedAt));
    if (newOutcomes.length < 10) return;
  }

  const contentPreferences = deriveContentPreferences(outcomes);
  const nextProfile = {
    ...voiceProfile,
    content_preferences: contentPreferences,
  };

  await storage.saveVoiceProfile(authorLogin, nextProfile, storedProfile?.version);

  if ((contentPreferences.expired_rate_30d ?? 0) > 0.3) {
    logger.warn('voice.content_preferences.expired_rate_high', {
      tenantId: storage.tenantId,
      authorLogin,
      expiredRate30d: contentPreferences.expired_rate_30d,
    });
  }
}
