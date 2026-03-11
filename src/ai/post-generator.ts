import { logger } from '../utils/logger.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt-builder.js';
import type { AnthropicClient, PromptError } from './client.js';
import type { Finding } from '../analysis/types.js';
import type { IVoiceStorage, Platform } from '../voice/storage.js';
import type { EnrichedCommit } from '../github/commit-enricher.js';
import type { Config } from '../config/schema.js';

export interface GeneratedPosts {
  linkedin: string;
  instagram: string;
  linkedinDraftId: string;
  instagramDraftId: string;
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
): Promise<GeneratedPosts> {
  if (findings.length === 0) {
    throw new Error('generatePosts called with 0 findings — caller should skip this call');
  }

  const platforms: Platform[] = [];
  if (config.platforms.linkedin.enabled) platforms.push('linkedin');
  if (config.platforms.instagram.enabled) platforms.push('instagram');

  if (platforms.length === 0) throw new Error('No platforms enabled in config');

  // Retrieve voice examples from all enabled platforms and pick top N by edit_ratio
  const voiceResults = await Promise.all(
    platforms.map((p) => storage.getTopVoiceExamples(p, config.posting.voice_examples_count)),
  );
  const voiceExamples = voiceResults
    .flat()
    .sort((a, b) => (b.edit_ratio ?? 0) - (a.edit_ratio ?? 0))
    .slice(0, config.posting.voice_examples_count);

  const systemPrompt = buildSystemPrompt(config);
  const userPrompt = buildUserPrompt(commit, findings, voiceExamples, platforms, config);

  logger.info('ai.generate.start', { sha: commit.sha, repo: commit.repo, findings: findings.length });

  const rawResponse = await client.complete(systemPrompt, userPrompt);

  const { linkedin, instagram } = parseResponse(rawResponse);

  const topFinding = findings[0]?.finding;
  const findingsCount = findings.length;

  // Store drafts immediately
  const [linkedinDraftId, instagramDraftId] = await Promise.all([
    config.platforms.linkedin.enabled
      ? storage.saveDraft({
          commit_sha: commit.sha,
          repo: commit.repo,
          platform: 'linkedin',
          ai_draft: linkedin,
          top_finding: topFinding,
          findings_count: findingsCount,
        })
      : Promise.resolve(''),
    config.platforms.instagram.enabled
      ? storage.saveDraft({
          commit_sha: commit.sha,
          repo: commit.repo,
          platform: 'instagram',
          ai_draft: instagram,
          top_finding: topFinding,
          findings_count: findingsCount,
        })
      : Promise.resolve(''),
  ]);

  logger.info('ai.generate.done', { sha: commit.sha, linkedinDraftId, instagramDraftId });

  return { linkedin, instagram, linkedinDraftId, instagramDraftId };
}

function parseResponse(raw: string): { linkedin: string; instagram: string } {
  const linkedinMatch = raw.match(/<linkedin_draft>([\s\S]*?)<\/linkedin_draft>/);
  const instagramMatch = raw.match(/<instagram_draft>([\s\S]*?)<\/instagram_draft>/);

  if (!linkedinMatch || !instagramMatch) {
    logger.error('ai.parse.missing_tags', { preview: raw.slice(0, 200) });
    throw new Error('Claude response missing XML tags — draft discarded to avoid broken posts');
  }

  return {
    linkedin: (linkedinMatch[1] ?? '').trim(),
    instagram: (instagramMatch[1] ?? '').trim(),
  };
}

export type { PromptError };
