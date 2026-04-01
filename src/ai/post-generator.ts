import { logger } from '../utils/logger.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt-builder.js';
import { computeEditRatio } from '../voice/similarity.js';
import type { AnthropicClient, PromptError } from './client.js';
import type { Finding } from '../analysis/types.js';
import type { IVoiceStorage, VoicePost } from '../voice/storage.js';
import type { EnrichedCommit } from '../github/commit-enricher.js';
import type { Config } from '../config/schema.js';

export interface GeneratedPosts {
  bufferText: string;
  draftId: string;
}

/**
 * ONE Claude call per commit.
 * Stores ai_draft in DB immediately before returning.
 * If Claude fails, the error propagates — no draft is stored.
 */
export async function generatePosts(
  client: AnthropicClient,
  commit: EnrichedCommit,
  findings: Finding[],
  storage: IVoiceStorage,
  config: Config,
  recentModuleIds: string[] = [],
): Promise<GeneratedPosts> {
  if (findings.length === 0) {
    throw new Error('generatePosts called with 0 findings — caller should skip this call');
  }

  // Fetch voice examples (linkedin as primary training platform)
  const poolSize = config.posting.voice_examples_count * 3;
  const voicePool = await storage.getTopVoiceExamples('linkedin', poolSize);
  const voiceExamples = selectVoiceExamples(voicePool, findings, config.posting.voice_examples_count);

  const systemPrompt = buildSystemPrompt(config);
  const userPrompt = buildUserPrompt(commit, findings, voiceExamples, config, recentModuleIds);

  logger.info('ai.generate.start', { sha: commit.sha, repo: commit.repo, findings: findings.length });

  const rawResponse = await client.complete(systemPrompt, userPrompt);

  const { post, shortPost } = parseResponse(rawResponse);

  const topFinding = findings[0]?.finding;
  const topModuleId = findings[0]?.moduleId;
  const findingsCount = findings.length;

  // One record per commit — ai_draft stores the full post for voice training
  const draftId = await storage.saveDraft({
    commit_sha: commit.sha,
    repo: commit.repo,
    platform: 'linkedin',
    ai_draft: post,
    top_finding: topFinding,
    top_module_id: topModuleId,
    findings_count: findingsCount,
  });

  // Buffer Idea text includes both variants so Liliana can copy per platform in the UI
  const bufferText = `${post}\n\n─────────────────\n🐦 Twitter:\n${shortPost}`;

  logger.info('ai.generate.done', { sha: commit.sha, draftId });

  return { bufferText, draftId };
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

/**
 * Selects voice examples using a two-pass strategy:
 *
 * Pass 1 — Anchors (style fidelity): pick the top 2 posts by edit_ratio.
 *   These ground Claude in the user's best-preserved voice patterns.
 *
 * Pass 2 — Topic match (relevance): from the remaining pool, rank by
 *   text similarity between post.top_finding and the current findings
 *   headlines. Fill remaining slots with the most topically similar posts.
 *
 * Final deduplication by published text prevents repeated examples.
 */
function selectVoiceExamples(
  posts: VoicePost[],
  findings: Finding[],
  limit: number,
): VoicePost[] {
  // Deduplicate pool by published text first
  const seen = new Set<string>();
  const pool: VoicePost[] = [];
  for (const post of posts.sort((a, b) => (b.edit_ratio ?? 0) - (a.edit_ratio ?? 0))) {
    const key = (post.published ?? post.ai_draft).slice(0, 100);
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(post);
  }

  if (pool.length === 0) return [];

  // Pass 1: anchors — top 2 by edit_ratio
  const anchorCount = Math.min(2, Math.floor(limit / 2), pool.length);
  const anchors = pool.slice(0, anchorCount);
  const anchorIds = new Set(anchors.map((p) => p.id));

  // Pass 2: topic match from the remaining candidates
  const topicSlots = limit - anchors.length;
  if (topicSlots <= 0) return anchors;

  const topicQuery = findings.map((f) => f.finding).join(' ');
  const candidates = pool.filter((p) => !anchorIds.has(p.id));

  const ranked = candidates
    .map((p) => ({
      post: p,
      score: computeEditRatio(p.top_finding ?? '', topicQuery),
    }))
    .sort((a, b) => b.score - a.score);

  const topicMatches = ranked.slice(0, topicSlots).map((r) => r.post);

  return [...anchors, ...topicMatches];
}

export type { PromptError };
