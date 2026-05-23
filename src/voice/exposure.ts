import type { BootstrapPost } from '../config/schema.js';
import type { VoicePost } from './storage.js';
import { MOVES_REGISTRY, OPENING_MOVE_IDS, type OpeningMoveType } from './moves-registry.js';
import { createRng, hash, weightedShuffle } from './utils.js';

export interface ExposureCandidate {
  id?: string;
  published?: string | null;
  text?: string;
  edit_ratio?: number | null;
  voice_rating?: number | null;
  top_module_id?: string | null;
}

export const MAX_EXPOSURE_CHARS = 4000;

export function exposureWeight(post: ExposureCandidate): number {
  const ratio = post.edit_ratio ?? 0;
  if (ratio < 0.3) return 0;
  if (post.voice_rating === 1) return 0;

  if (post.voice_rating === 2) {
    if (ratio > 0.90) return 1.6;
    if (ratio > 0.65) return 1.3;
    return 1.1;
  }

  // Unrated — preserve previous behaviour
  if (ratio > 0.90) return 0.8;
  if (ratio > 0.65) return 1.0;
  return 1.2;
}

export function selectExposureExamples(
  pool: ExposureCandidate[],
  commitSha: string,
  draftIndexToday: number,
  maxExamples = 3,
): ExposureCandidate[] {
  if (pool.length === 0) return [];
  if (pool.length <= maxExamples) return pool;

  const rng = createRng(hash(`${commitSha}:${draftIndexToday}`));
  const shuffled = weightedShuffle(
    pool.map((post) => ({
      item: post,
      weight: exposureWeight(post),
    })),
    rng,
  );

  const selected: ExposureCandidate[] = [];
  const modulesSeen = new Set<string>();
  for (const post of shuffled) {
    if (selected.length >= maxExamples) break;
    if (post.top_module_id && modulesSeen.has(post.top_module_id)) {
      if (modulesSeen.size < maxExamples) continue;
    }
    selected.push(post);
    if (post.top_module_id) modulesSeen.add(post.top_module_id);
  }

  return selected;
}

export function syntheticVoicePost(bp: BootstrapPost): ExposureCandidate {
  return {
    published: bp.text,
    text: bp.text,
    edit_ratio: 1.0,
    top_module_id: null,
  };
}

export function moduleIdToLabel(moduleId: string): string {
  return moduleId.replace(/_/g, ' ');
}

export function detectOpeningMove(text: string): OpeningMoveType {
  const firstLine = (text ?? '').split('\n').find((line) => line.trim().length > 0) ?? '';

  for (const moveId of OPENING_MOVE_IDS) {
    const regex = MOVES_REGISTRY.find((move) => move.id === moveId)?.regex;
    if (regex?.test(firstLine)) return moveId;
  }

  return 'unknown';
}

export function trimExposureExamples(
  examples: Array<{ text: string; topic: string }>,
  maxChars = MAX_EXPOSURE_CHARS,
): Array<{ text: string; topic: string }> {
  const next = [...examples];
  let totalChars = next.reduce((sum, example) => sum + example.text.length, 0);

  while (totalChars > maxChars && next.length > 1) {
    const longestIdx = next.reduce(
      (maxIdx, example, idx) => (example.text.length > next[maxIdx]!.text.length ? idx : maxIdx),
      0,
    );
    next.splice(longestIdx, 1);
    totalChars = next.reduce((sum, example) => sum + example.text.length, 0);
  }

  if (totalChars > maxChars && next.length === 1) {
    next[0] = {
      ...next[0]!,
      text: `${next[0]!.text.slice(0, maxChars)}\n[truncated]`,
    };
  }

  return next;
}
