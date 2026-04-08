import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

interface SourceRow {
  id: string;
  name: string;
  status: string;
  is_protected: boolean;
  articles_evaluated: number;
  articles_passed: number;
  best_score_30d: number;
  matched_count: number;
  added_at: string;
  fetch_failures: number;
}

const MIN_EVALUATED_FOR_QUALITY = 10;
const MIN_PASSED_FOR_VALUE = 20;
const MIN_AGE_DAYS_FOR_VALUE = 90;
const HIT_RATE_THRESHOLD = 0.2;
const BEST_SCORE_PROTECTION = 8;
const MAX_FETCH_FAILURES = 5;

/**
 * Evaluates source lifecycle rules and applies status transitions.
 *
 * Rules (per spec):
 * - articles_evaluated >= 10 AND hit_rate < 20% AND best_score_30d < 8 → probation
 * - probation sources that still fail after 10 more articles → disabled
 * - articles_passed >= 20 AND age >= 90d AND matched_count = 0 → probation
 * - fetch_failures >= 5 → unreachable
 * - best_score_30d >= 8 ALWAYS stays active (even low hit rate)
 */
export async function evaluateSourceLifecycle(db: SupabaseClient): Promise<void> {
  const { data, error } = await db
    .from('content_sources')
    .select('id, name, status, is_protected, articles_evaluated, articles_passed, best_score_30d, matched_count, added_at, fetch_failures')
    .in('status', ['active', 'probation', 'unreachable']);

  if (error) {
    logger.warn('content.evaluator.load_error', { error: error.message });
    return;
  }

  const sources = (data ?? []) as SourceRow[];
  const now = Date.now();

  let toActive = 0;
  let toProbation = 0;
  let toDisabled = 0;
  let toUnreachable = 0;
  let protectedSkipped = 0;

  for (const source of sources) {
    if (source.is_protected) {
      protectedSkipped++;
      continue;
    }

    const ageMs = now - new Date(source.added_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const hitRate = source.articles_evaluated > 0
      ? source.articles_passed / source.articles_evaluated
      : 0;

    // Unreachable: too many consecutive fetch failures
    if (source.fetch_failures >= MAX_FETCH_FAILURES && source.status !== 'unreachable') {
      await setStatus(db, source.id, 'unreachable');
      logger.info('content.evaluator.unreachable', { source: source.name, failures: source.fetch_failures });
      toUnreachable++;
      continue;
    }

    // Unreachable recovery: handled by resetting fetch_failures on successful fetch (in content-storage.ts)

    if (source.status === 'active' || source.status === 'probation') {
      // Protection: best_score_30d >= 8 always stays active
      if (source.best_score_30d >= BEST_SCORE_PROTECTION) continue;

      // Quality gate: enough articles evaluated, hit rate too low
      if (source.articles_evaluated >= MIN_EVALUATED_FOR_QUALITY && hitRate < HIT_RATE_THRESHOLD) {
        if (source.status === 'active') {
          await setStatus(db, source.id, 'probation');
          logger.info('content.evaluator.to_probation', { source: source.name, hitRate: hitRate.toFixed(2) });
          toProbation++;
          continue;
        }
        if (source.status === 'probation') {
          // Probation: if still failing after 10 more articles → disable
          // We check if they've had another 10 articles evaluated since reaching probation
          // Simple proxy: articles_evaluated >= 20 and still low
          if (source.articles_evaluated >= MIN_EVALUATED_FOR_QUALITY * 2) {
            await setStatus(db, source.id, 'disabled', new Date().toISOString());
            logger.info('content.evaluator.disabled', { source: source.name, hitRate: hitRate.toFixed(2) });
            toDisabled++;
            continue;
          }
        }
      }

      // Value gate: quality is fine but content never matched any commit
      if (
        source.articles_passed >= MIN_PASSED_FOR_VALUE &&
        ageDays >= MIN_AGE_DAYS_FOR_VALUE &&
        source.matched_count === 0 &&
        source.status === 'active'
      ) {
        await setStatus(db, source.id, 'probation');
        logger.info('content.evaluator.to_probation_no_match', { source: source.name, age: Math.floor(ageDays) });
        toProbation++;
      }
    }
  }

  // Expire old disabled sources back to active if they're still in reference repos
  // (implemented as manual override via sources.yml — not automated here)

  logger.info('content.evaluator.done', {
    toActive,
    toProbation,
    toDisabled,
    toUnreachable,
    protectedSkipped,
  });
}

async function setStatus(
  db: SupabaseClient,
  id: string,
  status: string,
  disabledAt?: string,
): Promise<void> {
  await db
    .from('content_sources')
    .update({ status, ...(disabledAt ? { disabled_at: disabledAt } : {}) })
    .eq('id', id);
}
