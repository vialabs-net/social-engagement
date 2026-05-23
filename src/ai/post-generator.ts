import { logger } from '../utils/logger.js';
import { buildSystemPrompt, buildUserPrompt, type VoicePromptContext } from './prompt-builder.js';
import type { IAIClient } from './types.js';
import type { Finding } from '../analysis/types.js';
import type { IVoiceStorage, SaveDraftInput, VoiceStage } from '../voice/storage.js';
import type { EnrichedCommit } from '../github/commit-enricher.js';
import type { BootstrapPost, Config, VoiceProfile } from '../config/schema.js';
import { detectOpeningMove } from '../voice/exposure.js';

export interface GeneratedPosts {
  linkedinPost: string;   // clean LinkedIn text for direct posting
  instagramPost: string;  // Instagram caption (empty string if Instagram disabled)
  shortPost: string;      // short variant for Twitter/X
  bufferText: string;     // combined text for Buffer Idea
  draftId: string;
  openingMove: string;
}

export interface GeneratePostsOptions {
  voiceProfile: VoiceProfile;
  voiceStage: VoiceStage;
  exposurePool?: import('../voice/storage.js').VoicePost[];
  bootstrapPosts?: BootstrapPost[];
  recentModuleIds?: string[];
  chapterContext?: string;
  industryContext?: string;
  developmentalAngle?: string;
  draftMetadata?: Partial<SaveDraftInput>;
  draftIndexToday?: number;
  varietyConstraint?: string;
}

/**
 * ONE Claude call per commit.
 * Stores ai_draft in DB immediately before returning.
 * If Claude fails, the error propagates — no draft is stored.
 */
export async function generatePosts(
  client: IAIClient,
  commit: EnrichedCommit,
  findings: Finding[],
  storage: IVoiceStorage,
  config: Config,
  options: GeneratePostsOptions,
): Promise<GeneratedPosts> {
  if (findings.length === 0) {
    throw new Error('generatePosts called with 0 findings — caller should skip this call');
  }

  const draftMetadata = options.draftMetadata ?? {};
  const voiceContext: VoicePromptContext = {
    stage: options.voiceStage,
    exposurePool: options.exposurePool ?? [],
    bootstrapPosts: options.bootstrapPosts ?? [],
    commitSha: commit.sha,
    draftIndexToday: options.draftIndexToday ?? 0,
    varietyConstraint: options.varietyConstraint,
  };

  const instagramEnabled = config.platforms.instagram.enabled;

  const systemPrompt = buildSystemPrompt(config, options.voiceProfile, voiceContext);
  const userPrompt = buildUserPrompt(
    commit,
    findings,
    options.recentModuleIds ?? [],
    options.chapterContext,
    options.industryContext,
    options.developmentalAngle,
    instagramEnabled,
  );

  logger.info('ai.generate.start', {
    sha: commit.sha,
    repo: commit.repo,
    findings: findings.length,
    has_industry_context: options.industryContext !== undefined,
  });

  const rawResponse = await client.complete(systemPrompt, userPrompt);

  const maxChars = options.voiceProfile.post_length.max;
  let parsed = parseResponse(rawResponse);

  if (parsed.post.length > maxChars * 1.05) {
    logger.warn('ai.generate.length_exceeded_retry', {
      sha: commit.sha,
      length: parsed.post.length,
      maxChars,
    });
    const reinforced = `${userPrompt}\n\nREINFORCED: hard cap is ${maxChars} characters. Do not exceed it.`;
    const retryResponse = await client.complete(systemPrompt, reinforced);
    parsed = parseResponse(retryResponse);
  }

  const post = enforceMainPostLength(parsed.post, maxChars);
  const instagramPost = parsed.instagramPost ? enforceInstagramHook(parsed.instagramPost) : '';
  const shortPost = parsed.shortPost;

  const topFinding = findings[0]?.finding;
  const topModuleId = findings[0]?.moduleId;
  const findingsCount = findings.length;
  const openingMove = detectOpeningMove(post);

  // One record per commit — ai_draft stores the full post for voice training
  const draftId = await storage.saveDraft({
    commit_sha: commit.sha,
    repo: commit.repo,
    platform: 'linkedin',
    ai_draft: post,
    top_finding: topFinding,
    top_module_id: topModuleId,
    findings_count: findingsCount,
    ...draftMetadata,
    // These must come after the spread so computed fallbacks win over undefined
    generation_system: draftMetadata.generation_system ?? (options.voiceStage === 'cold' ? 'v1' : 'v2_progressive'),
    opening_move: draftMetadata.opening_move ?? openingMove,
  });

  if (instagramEnabled && instagramPost) {
    await storage.saveDraft({
      commit_sha: commit.sha,
      repo: commit.repo,
      platform: 'instagram',
      ai_draft: instagramPost,
      top_finding: topFinding,
      top_module_id: topModuleId,
      findings_count: findingsCount,
      ...draftMetadata,
      generation_system: draftMetadata.generation_system ?? (options.voiceStage === 'cold' ? 'v1' : 'v2_progressive'),
      opening_move: detectOpeningMove(instagramPost),
    });
  }

  // Buffer Idea text includes all generated variants for manual platform selection in the UI
  const bufferText = instagramEnabled && instagramPost
    ? `${post}\n\n─────────────────\n📸 Instagram:\n${instagramPost}\n\n─────────────────\n🐦 Twitter:\n${shortPost}`
    : `${post}\n\n─────────────────\n🐦 Twitter:\n${shortPost}`;

  logger.info('ai.generate.done', { sha: commit.sha, draftId, instagramEnabled });

  return { linkedinPost: post, instagramPost, shortPost, bufferText, draftId, openingMove };
}

function parseResponse(raw: string): { post: string; instagramPost: string; shortPost: string } {
  // Accept new linkedin_draft tag with fallback to legacy post_draft during transition
  const linkedinMatch = raw.match(/<linkedin_draft>([\s\S]*?)<\/linkedin_draft>/)
    ?? raw.match(/<post_draft>([\s\S]*?)<\/post_draft>/);

  const instagramMatch = raw.match(/<instagram_draft>([\s\S]*?)<\/instagram_draft>/);

  // Accept new twitter_draft tag with fallback to legacy short_draft during transition
  const twitterMatch = raw.match(/<twitter_draft>([\s\S]*?)<\/twitter_draft>/)
    ?? raw.match(/<short_draft>([\s\S]*?)<\/short_draft>/);

  if (!linkedinMatch || !twitterMatch) {
    logger.error('ai.parse.missing_tags', { preview: raw.slice(0, 200) });
    throw new Error('Claude response missing XML tags — draft discarded to avoid broken posts');
  }

  return {
    post: (linkedinMatch[1] ?? '').trim(),
    instagramPost: (instagramMatch?.[1] ?? '').trim(),
    shortPost: (twitterMatch[1] ?? '').trim(),
  };
}

function enforceInstagramHook(text: string, maxHookChars = 125): string {
  const lines = text.split('\n');
  const firstLine = lines[0] ?? '';
  if (firstLine.length <= maxHookChars) return text;
  const trimmed = firstLine.slice(0, maxHookChars).replace(/\s\S*$/, '');
  return [trimmed, ...lines.slice(1)].join('\n');
}

function enforceMainPostLength(post: string, maxChars: number): string {
  const normalized = post.trim();
  if (normalized.length <= maxChars) return normalized;

  const { body, hashtags } = splitTrailingHashtags(normalized);
  const reservedChars = hashtags ? hashtags.length + 2 : 0;
  const availableForBody = Math.max(200, maxChars - reservedChars);
  const trimmedBody = trimToBoundary(body, availableForBody);
  const next = hashtags ? `${trimmedBody}\n\n${hashtags}` : trimmedBody;

  logger.warn('ai.generate.post_truncated', {
    original_length: normalized.length,
    max_chars: maxChars,
    final_length: next.length,
  });

  return next.length <= maxChars ? next : trimToBoundary(next, maxChars);
}

function splitTrailingHashtags(text: string): { body: string; hashtags: string } {
  const match = text.match(/(?:\n|^)(#[^\s#]+(?:\s+#[^\s#]+)*)\s*$/);
  if (!match || match.index === undefined) {
    return { body: text, hashtags: '' };
  }

  return {
    body: text.slice(0, match.index).trimEnd(),
    hashtags: match[1] ?? '',
  };
}

function trimToBoundary(text: string, maxChars: number): string {
  const normalized = text.trim();
  if (normalized.length <= maxChars) return normalized;

  const minBoundaryIndex = Math.floor(maxChars * 0.6);
  const boundarySlice = normalized.slice(0, maxChars + 1);
  const paragraphBoundary = boundarySlice.lastIndexOf('\n\n');
  if (paragraphBoundary >= minBoundaryIndex) {
    return boundarySlice.slice(0, paragraphBoundary).trimEnd();
  }

  const sentenceBoundary = findSentenceBoundary(boundarySlice, minBoundaryIndex);
  if (sentenceBoundary >= minBoundaryIndex) {
    return boundarySlice.slice(0, sentenceBoundary).trimEnd();
  }

  const fallbackIndex = normalized.lastIndexOf(' ', maxChars - 1);
  const hardLimit = fallbackIndex >= minBoundaryIndex ? fallbackIndex : Math.max(0, maxChars - 1);
  return `${normalized.slice(0, hardLimit).trimEnd()}…`;
}

function findSentenceBoundary(text: string, minBoundaryIndex: number): number {
  for (let idx = text.length - 1; idx >= minBoundaryIndex; idx--) {
    const char = text[idx];
    if (char !== '.' && char !== '!' && char !== '?') continue;
    const next = text[idx + 1];
    if (next === undefined || /\s/.test(next)) {
      return idx + 1;
    }
  }
  return -1;
}
export type { PromptError } from './anthropic-adapter.js';
