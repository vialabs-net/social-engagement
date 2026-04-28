import type { Finding } from '../analysis/types.js';
import type { EnrichedCommit } from '../github/commit-enricher.js';
import type { VoicePost } from '../voice/storage.js';

const FINDING_WEIGHTS = [1, 0.45, 0.2] as const;
const MAX_SIZE_BONUS = 0.35;
const MULTI_FINDING_BONUS = 0.2;
const SAME_DAY_MODULE_PENALTY = 0.72;
const SATURATED_MODULE_PENALTY = 0.9;

export interface RankedCommitCandidate {
  readonly commitSha: string;
  readonly committedAt: string;
  readonly findingsCount: number;
  readonly topModuleId?: string | null;
  readonly topModuleFireCount: number;
  readonly rankingScore: number;
  readonly totalChangedLines: number;
}

export function buildModuleFireCounts(moduleIds: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const moduleId of moduleIds) {
    counts.set(moduleId, (counts.get(moduleId) ?? 0) + 1);
  }
  return counts;
}

export function computeCandidateRankingScore(
  commit: Pick<EnrichedCommit, 'totalAdditions' | 'totalDeletions'>,
  findings: Finding[],
  recentModuleFireCounts: ReadonlyMap<string, number>,
): number {
  const weightedFindings = findings
    .slice(0, FINDING_WEIGHTS.length)
    .reduce((sum, finding, index) => {
      const weight = FINDING_WEIGHTS[index] ?? 0;
      return sum + (adjustFindingScore(finding, recentModuleFireCounts) * weight);
    }, 0);

  const breadthBonus = Math.max(0, findings.length - 1) * MULTI_FINDING_BONUS;
  const changedLines = commit.totalAdditions + commit.totalDeletions;
  const sizeBonus = Math.min(changedLines, 400) / 400 * MAX_SIZE_BONUS;

  return Number((weightedFindings + breadthBonus + sizeBonus).toFixed(4));
}

export function selectTopDailyCandidates<T extends RankedCommitCandidate>(
  candidates: T[],
  existingTodayDrafts: Array<Pick<VoicePost, 'top_module_id'>>,
  slotsAvailable: number,
): T[] {
  if (slotsAvailable <= 0 || candidates.length === 0) return [];

  const selected: T[] = [];
  const remaining = [...candidates];
  const moduleUsage = new Map<string, number>();

  for (const draft of existingTodayDrafts) {
    const topModuleId = draft.top_module_id;
    if (!topModuleId) continue;
    moduleUsage.set(topModuleId, (moduleUsage.get(topModuleId) ?? 0) + 1);
  }

  while (selected.length < slotsAvailable && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = computeSelectionScore(
      remaining[0]!,
      moduleUsage,
      existingTodayDrafts.length + selected.length,
    );

    for (let i = 1; i < remaining.length; i++) {
      const candidate = remaining[i]!;
      const score = computeSelectionScore(candidate, moduleUsage, existingTodayDrafts.length + selected.length);
      if (isBetterCandidate(candidate, score, remaining[bestIndex]!, bestScore)) {
        bestIndex = i;
        bestScore = score;
      }
    }

    const [bestCandidate] = remaining.splice(bestIndex, 1);
    if (!bestCandidate) break;
    selected.push(bestCandidate);

    if (bestCandidate.topModuleId) {
      moduleUsage.set(bestCandidate.topModuleId, (moduleUsage.get(bestCandidate.topModuleId) ?? 0) + 1);
    }
  }

  return selected;
}

export function getStartOfDayIso(timeZone: string, reference = new Date()): string {
  const dateParts = getTimeZoneDateParts(reference, timeZone);
  const utcGuess = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 0, 0, 0));
  const offsetMs = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMs).toISOString();
}

function adjustFindingScore(
  finding: Finding,
  recentModuleFireCounts: ReadonlyMap<string, number>,
): number {
  const fireCount = recentModuleFireCounts.get(finding.moduleId) ?? 0;
  const floor = finding.interestScore * 0.4;
  return Math.max(finding.interestScore / Math.log2(fireCount + 2), floor);
}

function computeSelectionScore<T extends RankedCommitCandidate>(
  candidate: T,
  moduleUsage: ReadonlyMap<string, number>,
  postsAlreadyPlannedToday: number,
): number {
  let score = candidate.rankingScore;

  if (postsAlreadyPlannedToday > 0 && candidate.topModuleFireCount >= 2) {
    score *= SATURATED_MODULE_PENALTY;
  }

  if (candidate.topModuleId) {
    const repeatedToday = moduleUsage.get(candidate.topModuleId) ?? 0;
    if (repeatedToday > 0) {
      score *= SAME_DAY_MODULE_PENALTY ** repeatedToday;
    }
  }

  return score;
}

function isBetterCandidate<T extends RankedCommitCandidate>(
  left: T,
  leftScore: number,
  right: T,
  rightScore: number,
): boolean {
  if (leftScore !== rightScore) return leftScore > rightScore;
  if (left.rankingScore !== right.rankingScore) return left.rankingScore > right.rankingScore;
  if (left.findingsCount !== right.findingsCount) return left.findingsCount > right.findingsCount;
  if (left.totalChangedLines !== right.totalChangedLines) return left.totalChangedLines > right.totalChangedLines;
  return new Date(left.committedAt).getTime() > new Date(right.committedAt).getTime();
}

function getTimeZoneDateParts(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(lookup.get('year')),
    month: Number(lookup.get('month')),
    day: Number(lookup.get('day')),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(
    Number(lookup.get('year')),
    Number(lookup.get('month')) - 1,
    Number(lookup.get('day')),
    Number(lookup.get('hour')),
    Number(lookup.get('minute')),
    Number(lookup.get('second')),
  );

  return localAsUtc - date.getTime();
}
