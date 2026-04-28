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

const XML_BUFFER_TEXT_RE = /<buffer_text>([\s\S]*?)<\/buffer_text>/;
const XML_OPENING_MOVE_RE = /<opening_move>([\s\S]*?)<\/opening_move>/;

export async function generateSynthesisPost(
  client: IAIClient,
  storage: IVoiceStorage,
  input: SynthesisGeneratorInput,
): Promise<SynthesisResult> {
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
  };

  const systemPrompt = buildSynthesisSystemPrompt(promptInput);
  const userPrompt = buildSynthesisUserPrompt(promptInput);

  const raw = await client.complete(systemPrompt, userPrompt);

  const bufferTextMatch = XML_BUFFER_TEXT_RE.exec(raw);
  if (!bufferTextMatch) {
    throw new Error(`synthesis-generator: missing <buffer_text> in response for ${input.gatillador}/${input.topics.join(',')}`);
  }

  const maxChars = input.voiceProfile.post_length.max;
  let bufferText = bufferTextMatch[1]?.trim() ?? '';

  if (bufferText.length > maxChars * 1.05) {
    logger.warn('synthesis-generator.length_exceeded_retry', {
      length: bufferText.length,
      maxChars,
      gatillador: input.gatillador,
    });
    const reinforced = `${userPrompt}\n\nREINFORCED: hard cap is ${maxChars} characters. Do not exceed it.`;
    const retryRaw = await client.complete(systemPrompt, reinforced);
    const retryMatch = XML_BUFFER_TEXT_RE.exec(retryRaw);
    if (retryMatch) bufferText = retryMatch[1]?.trim() ?? bufferText;
  }

  if (bufferText.length < input.voiceProfile.post_length.min) {
    throw new Error(
      `synthesis-generator: <buffer_text> too short (${bufferText.length} < ${input.voiceProfile.post_length.min}) for ${input.gatillador}/${input.topics.join(',')}`,
    );
  }

  const openingMoveMatch = XML_OPENING_MOVE_RE.exec(raw);
  const openingMove = openingMoveMatch?.[1]?.trim() ?? 'unknown';

  const topTopic = input.topics[0] ?? null;
  const draftId = await storage.saveDraft({
    commit_sha: representativeSha,
    repo: input.repo,
    platform: 'linkedin',
    ai_draft: bufferText,
    top_module_id: topTopic ?? undefined,
    findings_count: input.signals.length,
    author_login: input.authorLogin,
    generation_system: input.voiceStage === 'cold' ? 'v1' : 'v2_progressive',
    opening_move: openingMove,
  });

  const detectedMove = detectOpeningMove(bufferText);

  logger.info('synthesis-generator.done', {
    draftId,
    gatillador: input.gatillador,
    topics: input.topics,
    signalCount: input.signals.length,
    openingMove: detectedMove,
  });

  return { draftId, bufferText, openingMove: detectedMove };
}
