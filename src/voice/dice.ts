import { MOVES_REGISTRY, type MoveDefinition } from './moves-registry.js';
import { hash, seededRandom } from './utils.js';

export interface RolledMoves {
  available: MoveDefinition[];
  unavailable: MoveDefinition[];
}

export function calibrateMoveProbability(matchCount: number, totalPosts: number): number {
  if (totalPosts < 5) return 0;
  const raw = matchCount / totalPosts;
  if (raw < 0.05) return 0;
  if (raw > 0.9) return 0.9;
  return Math.round(raw * 20) / 20;
}

export function rollVoiceDice(
  moves: Record<string, number>,
  commitSha: string,
  draftIndexToday: number,
): RolledMoves {
  const available: MoveDefinition[] = [];
  const unavailable: MoveDefinition[] = [];

  for (const [moveId, probability] of Object.entries(moves)) {
    if (probability <= 0 || probability >= 1) continue;

    const move = MOVES_REGISTRY.find((candidate) => candidate.id === moveId);
    if (!move) continue;

    const seed = hash(`${commitSha}:${draftIndexToday}:${moveId}`);
    const roll = seededRandom(seed);
    if (roll < probability) available.push(move);
    else unavailable.push(move);
  }

  return { available, unavailable };
}
