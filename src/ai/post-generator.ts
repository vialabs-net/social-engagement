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

  const systemPrompt = buildSystemPrompt(config, options.voiceProfile, voiceContext);
  const userPrompt = buildUserPrompt(
    commit,
    findings,
    options.recentModuleIds ?? [],
    options.chapterContext,
    options.industryContext,
  );

  logger.info('ai.generate.start', {
    sha: commit.sha,
    repo: commit.repo,
    findings: findings.length,
    has_industry_context: options.industryContext !== undefined,
  });

  const rawResponse = await client.complete(systemPrompt, userPrompt);

  const parsed = parseResponse(rawResponse);
  const post = enforceMainPostLength(parsed.post, options.voiceProfile.post_length.max);
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
    generation_system: draftMetadata.generation_system ?? (options.voiceStage === 'cold' ? 'v1' : 'v2_progressive'),
    opening_move: draftMetadata.opening_move ?? openingMove,
    ...draftMetadata,
  });

  // Buffer Idea text includes both variants so Liliana can copy per platform in the UI
  const bufferText = `${post}\n\n─────────────────\n🐦 Twitter:\n${shortPost}`;

  logger.info('ai.generate.done', { sha: commit.sha, draftId });

  return { linkedinPost: post, shortPost, bufferText, draftId, openingMove };
}

function parseResponse(raw: string): { post: string; shortPost: string } {
  const postMatch = raw.match(/<post_draft>([\s\S]*?)<\/post_draft>/);
  const shortMatch = raw.match(/<short_draft>([\s\S]*?)<\/short_draft>/);

  if (!postMatch || !shortMatch) {
    logger.error('ai.parse.missing_tags', { preview: raw.slice(0, 200) });
    throw new Error('Claude response missing XML tags — draft discarded to avoid broken posts');
  }

  return {
    post: (postMatch[1] ?? '').trim(),
    shortPost: (shortMatch[1] ?? '').trim(),
  };
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
