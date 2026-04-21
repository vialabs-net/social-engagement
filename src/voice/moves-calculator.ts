import { logger } from '../utils/logger.js';
import type { VoiceProfile } from '../config/schema.js';
import { DEFAULT_VOICE_PROFILE } from '../config/schema.js';
import { calibrateMoveProbability } from './dice.js';
import { MOVES_REGISTRY } from './moves-registry.js';
import { computeVoiceStage } from './stage.js';
import type { IVoiceStorage, VoicePost } from './storage.js';

const HASHTAG_REGEX = /(?<=^|\s)#[A-Za-z0-9_]+/g;
const FIRST_PERSON_OPENING = /^I\s+(shipped|deleted|added|wrote|built|pushed|created|fixed)/im;

export async function refreshVoiceMoves(
  storage: IVoiceStorage,
  authorLogin: string,
): Promise<void> {
  let stored = await storage.getVoiceProfile(authorLogin);
  // Only seed a new author row from an exact match. Tenant-default/legacy voices
  // belong to the tenant owner, not to this author — copying them would persist
  // foreign hashtags, bootstrap_posts, etc. as this author's permanent voice.
  const seedVoice = stored && stored.source === 'exact'
    ? stored.voice
    : DEFAULT_VOICE_PROFILE;
  if (stored && stored.source !== 'exact') {
    logger.info('voice.moves.seed.default', {
      authorLogin,
      reason: stored.source,
    });
  }

  await storage.saveVoiceProfile(authorLogin, seedVoice, 0);
  stored = await storage.getVoiceProfile(authorLogin);

  const currentVoice = stored?.voice ?? DEFAULT_VOICE_PROFILE;
  const currentVersion = stored?.version ?? 0;
  const posts = await storage.getPublishedForMoves(authorLogin);
  const totalUniquePublished = await storage.countUniquePublished(authorLogin);
  const stage = computeVoiceStage(totalUniquePublished, !!currentVoice.bootstrap_posts?.length);

  const [linkedinPool, instagramPool, recentOutcomes] = await Promise.all([
    storage.getPublishedForExposure(authorLogin, 'linkedin'),
    storage.getPublishedForExposure(authorLogin, 'instagram'),
    storage.getRecentOutcomes(authorLogin, 20),
  ]);

  const voiceExamplesPool = {
    ...(linkedinPool.length > 0 && { linkedin: linkedinPool.map((post) => post.id) }),
    ...(instagramPool.length > 0 && { instagram: instagramPool.map((post) => post.id) }),
  };

  const alwaysHashtags = detectAlwaysHashtags(posts);
  const recentOpeningSequence = recentOutcomes
    .filter((post) => post.status === 'published' && post.opening_move && post.opening_move !== 'unknown')
    .slice(0, 5)
    .map((post) => post.opening_move as string)
    .reverse();

  if (posts.length < 5) {
    const updatedVoice: VoiceProfile = {
      ...currentVoice,
      voice_stage: stage,
      voice_examples_pool: voiceExamplesPool,
      always_hashtags: alwaysHashtags,
      recent_opening_sequence: recentOpeningSequence,
      voice_summary: posts.length >= 3
        ? computeProtoSummary(posts, alwaysHashtags)
        : currentVoice.voice_summary ?? '',
    };

    const saved = await storage.saveVoiceProfile(authorLogin, updatedVoice, currentVersion);
    if (!saved) {
      logger.warn('voice.moves.refresh_conflict', { tenantId: storage.tenantId, authorLogin, stage });
      return;
    }

    logger.info('voice.moves.refresh_skipped', {
      tenantId: storage.tenantId,
      authorLogin,
      reason: 'insufficient_quality_posts_for_moves',
      quality_filtered_count: posts.length,
      total_unique_published: totalUniquePublished,
      stage,
    });
    return;
  }

  if (stage === 'warming') {
    const updatedVoice: VoiceProfile = {
      ...currentVoice,
      voice_stage: stage,
      voice_examples_pool: voiceExamplesPool,
      always_hashtags: alwaysHashtags,
      recent_opening_sequence: recentOpeningSequence,
      voice_summary: computeProtoSummary(posts, alwaysHashtags),
    };

    const saved = await storage.saveVoiceProfile(authorLogin, updatedVoice, currentVersion);
    if (!saved) {
      logger.warn('voice.moves.refresh_conflict', { tenantId: storage.tenantId, authorLogin, stage });
      return;
    }

    logger.info('voice.moves.refreshed', {
      tenantId: storage.tenantId,
      authorLogin,
      stage,
      moves_count: 0,
      always_hashtags: alwaysHashtags,
      pool_size: linkedinPool.length + instagramPool.length,
      posts_analyzed: posts.length,
    });
    return;
  }

  const newMoves: Record<string, number> = {};
  for (const move of MOVES_REGISTRY) {
    if (!move.regex) continue;
    let matchCount = 0;
    for (const post of posts) {
      if (move.regex.test(post.published ?? '')) matchCount++;
    }
    const probability = calibrateMoveProbability(matchCount, posts.length);
    if (probability > 0) newMoves[move.id] = probability;
  }

  const smoothed: Record<string, number> = {};
  if (currentVoice.voice_moves) {
    for (const [moveId, newProb] of Object.entries(newMoves)) {
      const oldProb = currentVoice.voice_moves[moveId] ?? newProb;
      smoothed[moveId] = Math.round((0.6 * oldProb + 0.4 * newProb) * 20) / 20;
    }
  } else {
    Object.assign(smoothed, newMoves);
  }

  const updatedVoice: VoiceProfile = {
    ...currentVoice,
    voice_moves: smoothed,
    voice_stage: stage,
    voice_examples_pool: voiceExamplesPool,
    always_hashtags: alwaysHashtags,
    recent_opening_sequence: recentOpeningSequence,
    voice_summary: computeVoiceSummary(smoothed),
  };

  const saved = await storage.saveVoiceProfile(authorLogin, updatedVoice, currentVersion);
  if (!saved) {
    logger.warn('voice.moves.refresh_conflict', { tenantId: storage.tenantId, authorLogin, stage });
    return;
  }

  logger.info('voice.moves.refreshed', {
    tenantId: storage.tenantId,
    authorLogin,
    stage,
    moves_count: Object.keys(smoothed).length,
    always_hashtags: alwaysHashtags,
    pool_size: linkedinPool.length + instagramPool.length,
    posts_analyzed: posts.length,
  });
}

export function computeVoiceSummary(moves: Record<string, number>): string {
  const active = Object.entries(moves)
    .filter(([, probability]) => probability > 0)
    .sort((left, right) => right[1] - left[1]);

  if (active.length === 0) return '';

  return active
    .slice(0, 3)
    .map(([id]) => MOVES_REGISTRY.find((move) => move.id === id)?.description ?? id)
    .join('; ')
    .slice(0, 200);
}

export function computeProtoSummary(posts: VoicePost[], alwaysHashtags: string[]): string {
  if (posts.length === 0) return '';

  const parts: string[] = [];
  const lengths = posts.map((post) => (post.published ?? '').length);
  const mean = Math.round(lengths.reduce((sum, length) => sum + length, 0) / lengths.length);
  parts.push(`~${mean} chars`);

  const firstPersonCount = posts.filter((post) => FIRST_PERSON_OPENING.test(post.published ?? '')).length;
  if (firstPersonCount / posts.length > 0.4) {
    parts.push('opens in first person');
  }

  if (alwaysHashtags.length > 0) {
    parts.push(`always ${alwaysHashtags.join(' ')}`);
  }

  return parts.join('. ').slice(0, 200);
}

function detectAlwaysHashtags(posts: VoicePost[]): string[] {
  if (posts.length === 0) return [];

  const hashtagCounts = new Map<string, number>();
  for (const post of posts) {
    const hashtags = (post.published ?? '').match(HASHTAG_REGEX) ?? [];
    for (const tag of new Set(hashtags)) {
      hashtagCounts.set(tag, (hashtagCounts.get(tag) ?? 0) + 1);
    }
  }

  const alwaysHashtags: string[] = [];
  for (const [tag, count] of hashtagCounts.entries()) {
    if (count / posts.length >= 0.8) alwaysHashtags.push(tag);
  }
  return alwaysHashtags;
}
