import { logger } from '../utils/logger.js';
import {
  buildSynthesisSystemPrompt,
  buildSynthesisUserPrompt,
  groupSignalsByCommit,
  type SynthesisPromptInput,
} from './synthesis-prompt-builder.js';
import type { IAIClient } from './types.js';
import type { IVoiceStorage, SignalEvent } from '../voice/storage.js';
import type { CoherenceScore } from '../analysis/coherence-router.js';
import type { VoiceStage } from '../voice/storage.js';
import type { BootstrapPost, Config, VoiceProfile } from '../config/schema.js';
import type { VoicePost } from '../voice/storage.js';
import { detectOpeningMove } from '../voice/exposure.js';

export interface SynthesisGeneratorInput {
  readonly authorLogin: string;
  readonly repo: string;
  readonly gatillador: 'focal' | 'arco' | 'focal_multiple';
  readonly topics: string[];
  readonly signals: SignalEvent[];          // all unconsumed signals for the topic(s)
  readonly coherenceScore?: CoherenceScore; // only for arco
  readonly lastPostSummary?: string;
  readonly developmentalAngle?: string;     // R3 arc guidance block
  readonly industryContext?: string;        // editorial tension frame from article match
  readonly featuredSignal?: string;         // specific_change text that triggered the article match
  readonly voiceProfile: VoiceProfile;
  readonly voiceStage: VoiceStage;
  readonly config: Config;
  readonly exposurePool: VoicePost[];
  readonly bootstrapPosts: BootstrapPost[];
  readonly draftIndexToday: number;
  readonly draftMetadata?: {
    author_login: string | null;
    generation_system: 'v1' | 'v2_progressive' | null;
  };
}

export interface SynthesisResult {
  readonly draftId: string;
  readonly bufferText: string;
  readonly openingMove: string;
}

export interface BufferTextResult {
  readonly bufferText: string;
  readonly openingMove: string;
  readonly representativeSha: string;
  readonly instagramText?: string;
}

// Accept linkedin_draft (current tag after R6) with fallback to legacy buffer_text
const XML_BUFFER_TEXT_RE = /<linkedin_draft>([\s\S]*?)<\/linkedin_draft>|<buffer_text>([\s\S]*?)<\/buffer_text>/;
const XML_INSTAGRAM_RE = /<instagram_draft>([\s\S]*?)<\/instagram_draft>/;
const XML_OPENING_MOVE_RE = /<opening_move>([\s\S]*?)<\/opening_move>/;

/**
 * Calls Claude and parses the response — no storage writes.
 * Use this for Phase 1 of focal_multiple batches so all texts are generated
 * before any draft is saved, preventing partial state on Claude failures.
 */
export async function generateBufferText(
  client: IAIClient,
  input: SynthesisGeneratorInput,
): Promise<BufferTextResult> {
  const commitGroups = groupSignalsByCommit(input.signals);
  const representativeSha = commitGroups[commitGroups.length - 1]?.commitSha ?? 'synthesis';

  const promptInput: SynthesisPromptInput = {
    gatillador: input.gatillador,
    topics: input.topics,
    commitGroups,
    coherenceScore: input.coherenceScore,
    lastPostSummary: input.lastPostSummary,
    voiceProfile: input.voiceProfile,
    voiceStage: input.voiceStage,
    config: input.config,
    exposurePool: input.exposurePool,
    bootstrapPosts: input.bootstrapPosts,
    draftIndexToday: input.draftIndexToday,
    commitSha: representativeSha,
    industryContext: input.industryContext,
    featuredSignal: input.featuredSignal,
  };

  const systemPrompt = buildSynthesisSystemPrompt(promptInput);
  const userPrompt = buildSynthesisUserPrompt(promptInput);
  const raw = await client.complete(systemPrompt, userPrompt);

  const bufferTextMatch = XML_BUFFER_TEXT_RE.exec(raw);
  if (!bufferTextMatch) {
    throw new Error(`synthesis-generator: missing <linkedin_draft>/<buffer_text> in response for ${input.gatillador}/${input.topics.join(',')}`);
  }

  const extractText = (m: RegExpExecArray): string => (m[1] ?? m[2] ?? '').trim();

  const maxChars = input.voiceProfile.post_length.max;
  let bufferText = extractText(bufferTextMatch);

  if (bufferText.length > maxChars * 1.05) {
    logger.warn('synthesis-generator.length_exceeded_retry', {
      length: bufferText.length,
      maxChars,
      gatillador: input.gatillador,
    });
    const reinforced = `${userPrompt}\n\nREINFORCED: hard cap is ${maxChars} characters. Do not exceed it.`;
    const retryRaw = await client.complete(systemPrompt, reinforced);
    const retryMatch = XML_BUFFER_TEXT_RE.exec(retryRaw);
    if (retryMatch) bufferText = extractText(retryMatch);
  }

  if (bufferText.length < input.voiceProfile.post_length.min) {
    throw new Error(
      `synthesis-generator: post too short (${bufferText.length} < ${input.voiceProfile.post_length.min}) for ${input.gatillador}/${input.topics.join(',')}`,
    );
  }

  const openingMoveMatch = XML_OPENING_MOVE_RE.exec(raw);
  const openingMove = openingMoveMatch?.[1]?.trim() ?? 'unknown';

  const instagramMatch = XML_INSTAGRAM_RE.exec(raw);
  const instagramText = instagramMatch?.[1]?.trim();

  return { bufferText, openingMove, representativeSha, instagramText };
}

/**
 * Saves a pre-generated buffer text to storage and logs.
 * Use this for Phase 2 of focal_multiple batches after all texts are ready.
 */
export async function persistSynthesisPost(
  storage: IVoiceStorage,
  input: SynthesisGeneratorInput,
  result: BufferTextResult,
): Promise<SynthesisResult> {
  const topTopic = input.topics[0] ?? null;
  const generationSystem = input.voiceStage === 'cold' ? 'v1' : 'v2_progressive';
  const draftId = await storage.saveDraft({
    commit_sha: result.representativeSha,
    repo: input.repo,
    platform: 'linkedin',
    ai_draft: result.bufferText,
    top_module_id: topTopic ?? undefined,
    findings_count: input.signals.length,
    author_login: input.authorLogin,
    generation_system: generationSystem,
    opening_move: result.openingMove,
  });

  if (input.config.platforms.instagram.enabled && result.instagramText) {
    await storage.saveDraft({
      commit_sha: result.representativeSha,
      repo: input.repo,
      platform: 'instagram',
      ai_draft: result.instagramText,
      top_module_id: topTopic ?? undefined,
      findings_count: input.signals.length,
      author_login: input.authorLogin,
      generation_system: generationSystem,
      opening_move: detectOpeningMove(result.instagramText),
    });
  }

  const detectedMove = detectOpeningMove(result.bufferText);

  logger.info('synthesis-generator.done', {
    draftId,
    gatillador: input.gatillador,
    topics: input.topics,
    signalCount: input.signals.length,
    openingMove: detectedMove,
    instagramSaved: input.config.platforms.instagram.enabled && !!result.instagramText,
  });

  return { draftId, bufferText: result.bufferText, openingMove: detectedMove };
}

export async function generateSynthesisPost(
  client: IAIClient,
  storage: IVoiceStorage,
  input: SynthesisGeneratorInput,
): Promise<SynthesisResult> {
  const result = await generateBufferText(client, input);
  return persistSynthesisPost(storage, input, result);
}
