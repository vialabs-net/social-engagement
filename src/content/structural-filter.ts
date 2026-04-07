import { countWords } from './article-extractor.js';
import type { SourceTrust } from './types.js';

const SKIP_TITLE_PATTERN = /changelog|release notes|what's new|weekly roundup|newsletter|digest/i;
const MIN_WORD_COUNT = 300;

const METRICS_PATTERN = /\d+\s*(ms|rps|%|MB|GB|req\/s|p99|latency|throughput)/i;
const TRADEOFFS_PATTERN = /trade.?off|however|downside|chose .+ over|instead of/i;
const PROD_CONTEXT_PATTERN = /in production|at scale|our (system|service|platform)|we (run|operate|serve)/i;
const TUTORIAL_PATTERN = /getting started|step[- ]by[- ]step|beginner|how to .+ in \d/i;

export interface StructuralSignals {
  readonly wordCount: number;
  readonly codeBlockCount: number;
  readonly hasMetrics: boolean;
  readonly hasTradeoffs: boolean;
  readonly hasProdContext: boolean;
  readonly isTutorialPattern: boolean;
}

/**
 * Phase 1 — Pre-skip: discards articles that are never worth classifying.
 * Runs on title + word count only (instant, no content analysis).
 */
export function shouldSkip(title: string, wordCount: number): boolean {
  if (SKIP_TITLE_PATTERN.test(title)) return true;
  if (wordCount < MIN_WORD_COUNT) return true;
  return false;
}

/**
 * Phase 2 — Structural scoring: scores article content for depth signals.
 * Gate: score >= 4.
 */
export function extractSignals(text: string): StructuralSignals {
  const wordCount = countWords(text);
  const codeBlockCount = (text.match(/```[\s\S]*?```|(?:^|\n)(?: {4}|\t)[^\n]+/gm) ?? []).length;

  return {
    wordCount,
    codeBlockCount,
    hasMetrics: METRICS_PATTERN.test(text),
    hasTradeoffs: TRADEOFFS_PATTERN.test(text),
    hasProdContext: PROD_CONTEXT_PATTERN.test(text),
    isTutorialPattern: TUTORIAL_PATTERN.test(text),
  };
}

export function structuralScore(signals: StructuralSignals, trust: SourceTrust): number {
  let score = 0;
  if (signals.wordCount >= 800) score += 2;
  if (signals.codeBlockCount >= 2) score += 2;
  if (signals.hasMetrics) score += 2;
  if (signals.hasTradeoffs) score += 2;
  if (signals.hasProdContext) score += 2;
  if (signals.isTutorialPattern) score -= 4;

  if (trust === 'curated') score += 3;
  if (trust === 'verified') score += 1;

  return score;
}

export interface ScoredArticle<T> {
  readonly article: T;
  readonly score: number;
}

/**
 * Phase 3 — Top 3 per source: after scoring, cap at 3 articles per source.
 * Prevents a prolific source from consuming the entire AI budget.
 */
export function topPerSource<T extends { sourceId: string }>(
  articles: Array<ScoredArticle<T>>,
  limit = 3,
): Array<ScoredArticle<T>> {
  const bySource = new Map<string, Array<ScoredArticle<T>>>();

  for (const item of articles) {
    const group = bySource.get(item.article.sourceId) ?? [];
    group.push(item);
    bySource.set(item.article.sourceId, group);
  }

  const result: Array<ScoredArticle<T>> = [];
  for (const group of bySource.values()) {
    const sorted = group.sort((a, b) => b.score - a.score);
    result.push(...sorted.slice(0, limit));
  }

  return result;
}
