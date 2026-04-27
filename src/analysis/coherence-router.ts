import type { EnrichedCommit } from '../github/commit-enricher.js';
import type { SignalEvent } from '../voice/storage.js';

export interface CoherenceScore {
  readonly structural: number; // Jaccard over file paths (weight 0.5)
  readonly temporal: number;   // temporal density binary (weight 0.2)
  readonly lexical: number;    // Jaccard over commit message tokens (weight 0.3)
  readonly total: number;      // weighted sum
  readonly decision: 'arco' | 'focal_multiple';
}

export interface AuthorProfile {
  readonly medianIntervalDays: number | null;
}

const ARCO_THRESHOLD = 0.6;
const DEFAULT_MEDIAN_INTERVAL_DAYS = 3;
const DAYS_MS = 24 * 60 * 60 * 1000;

const COMMIT_PREFIX_RE = /^(feat|fix|chore|refactor|docs|test|style|perf|build|ci)(\([^)]*\))?:\s*/i;
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'in', 'of', 'for', 'on', 'at', 'is', 'are', 'was', 'with', 'by', 'it', 'its', 'be', 'as', 'not', 'no']);

export function scoreCoherence(commits: EnrichedCommit[], author: AuthorProfile): CoherenceScore {
  if (commits.length === 0) {
    return { structural: 0, temporal: 0, lexical: 0, total: 0, decision: 'focal_multiple' };
  }

  const structural = jaccardFiles(commits);
  const temporal = computeTemporalDensity(commits, author.medianIntervalDays);
  const lexical = jaccardMessageTokens(commits);

  const total = 0.5 * structural + 0.2 * temporal + 0.3 * lexical;
  const decision: 'arco' | 'focal_multiple' = total >= ARCO_THRESHOLD ? 'arco' : 'focal_multiple';

  return { structural, temporal, lexical, total, decision };
}

function jaccardFiles(commits: EnrichedCommit[]): number {
  if (commits.length < 2) return 0;

  const fileSets = commits.map((c) => new Set(c.diffs.map((d) => d.filename)));

  const { intersection, union } = intersectUnionSets(fileSets);
  const direct = union.size === 0 ? 0 : intersection.size / union.size;

  if (direct >= 0.2) return direct;

  // Fallback to directory level
  const dirSets = commits.map((c) => new Set(
    c.diffs.map((d) => {
      const slash = d.filename.lastIndexOf('/');
      return slash >= 0 ? d.filename.slice(0, slash) : '.';
    }),
  ));

  const { intersection: dirIntersection, union: dirUnion } = intersectUnionSets(dirSets);
  return dirUnion.size === 0 ? 0 : dirIntersection.size / dirUnion.size;
}

function computeTemporalDensity(commits: EnrichedCommit[], medianIntervalDays: number | null): number {
  if (commits.length < 2) return 1;

  const timestamps = commits
    .map((c) => new Date(c.committedAt).getTime())
    .sort((a, b) => a - b);

  const spanDays = (timestamps[timestamps.length - 1]! - timestamps[0]!) / DAYS_MS;
  const threshold = 3 * (medianIntervalDays ?? DEFAULT_MEDIAN_INTERVAL_DAYS);

  return spanDays < threshold ? 1 : 0;
}

function jaccardMessageTokens(commits: EnrichedCommit[]): number {
  if (commits.length < 2) return 0;

  const tokenSets = commits.map((c) => new Set(tokenize(c.message)));
  const { intersection, union } = intersectUnionSets(tokenSets);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Score coherence from stored signal events (used in Capa 3 accumulation check).
 * Groups signals by commit_sha, uses affected_files for structural Jaccard,
 * accumulated_at as timestamp, and specific_change as message proxy.
 */
export function scoreCoherenceFromSignals(
  signals: SignalEvent[],
  medianIntervalDays: number | null,
): CoherenceScore {
  if (signals.length === 0) {
    return { structural: 0, temporal: 0, lexical: 0, total: 0, decision: 'focal_multiple' };
  }

  // Group by commit_sha — same commit can have multiple signals (different topics)
  const byCommit = new Map<string, { files: Set<string>; tokens: Set<string>; timestamp: number }>();
  for (const s of signals) {
    const entry = byCommit.get(s.commit_sha);
    if (entry) {
      for (const f of s.affected_files) entry.files.add(f);
      for (const t of tokenize(s.specific_change)) entry.tokens.add(t);
    } else {
      byCommit.set(s.commit_sha, {
        files: new Set(s.affected_files),
        tokens: new Set(tokenize(s.specific_change)),
        timestamp: new Date(s.accumulated_at).getTime(),
      });
    }
  }

  if (byCommit.size < 2) {
    return { structural: 0, temporal: 0, lexical: 0, total: 0, decision: 'focal_multiple' };
  }

  const entries = Array.from(byCommit.values());

  const fileSets = entries.map((e) => e.files);
  let structural = (() => {
    const { intersection, union } = intersectUnionSets(fileSets);
    const direct = union.size === 0 ? 0 : intersection.size / union.size;
    if (direct >= 0.2) return direct;
    // Fallback: directory level
    const dirSets = entries.map((e) => new Set(Array.from(e.files).map((f) => {
      const slash = f.lastIndexOf('/');
      return slash >= 0 ? f.slice(0, slash) : '.';
    })));
    const { intersection: di, union: du } = intersectUnionSets(dirSets);
    return du.size === 0 ? 0 : di.size / du.size;
  })();

  const timestamps = entries.map((e) => e.timestamp).sort((a, b) => a - b);
  const spanDays = (timestamps[timestamps.length - 1]! - timestamps[0]!) / DAYS_MS;
  const threshold = 3 * (medianIntervalDays ?? DEFAULT_MEDIAN_INTERVAL_DAYS);
  const temporal = spanDays < threshold ? 1 : 0;

  const tokenSets = entries.map((e) => e.tokens);
  const { intersection: ti, union: tu } = intersectUnionSets(tokenSets);
  const lexical = tu.size === 0 ? 0 : ti.size / tu.size;

  const total = 0.5 * structural + 0.2 * temporal + 0.3 * lexical;
  const decision: 'arco' | 'focal_multiple' = total >= ARCO_THRESHOLD ? 'arco' : 'focal_multiple';

  return { structural, temporal, lexical, total, decision };
}

function tokenize(text: string): string[] {
  return text
    .replace(COMMIT_PREFIX_RE, '')
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function intersectUnionSets<T>(sets: Set<T>[]): { intersection: Set<T>; union: Set<T> } {
  if (sets.length === 0) return { intersection: new Set(), union: new Set() };

  let intersection = new Set(sets[0]!);
  const union = new Set(sets[0]!);

  for (let i = 1; i < sets.length; i++) {
    const s = sets[i]!;
    intersection = new Set([...intersection].filter((x) => s.has(x)));
    for (const x of s) union.add(x);
  }

  return { intersection, union };
}
