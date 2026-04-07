import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import type { PipelineRunStats } from './types.js';

interface PipelineRunRow {
  articles_stored: number;
  avg_quality_score: number | null;
  commits_with_match: number;
  commits_without_match: number;
}

/**
 * Saves a content_pipeline_runs row at the end of each content-fetch CRON run.
 */
export async function savePipelineRun(
  db: SupabaseClient,
  stats: PipelineRunStats,
): Promise<void> {
  const { error } = await db.from('content_pipeline_runs').insert({
    ...stats,
    run_at: new Date().toISOString(),
  });

  if (error) {
    logger.warn('content.health.save_error', { error: error.message });
  }
}

/**
 * Logs a weekly health report comparing this run vs the last 4 weeks average.
 * Called at the end of each content-fetch CRON run.
 */
export async function logHealthReport(
  db: SupabaseClient,
  thisWeek: PipelineRunStats,
): Promise<void> {
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await db
    .from('content_pipeline_runs')
    .select('articles_stored, avg_quality_score, commits_with_match, commits_without_match')
    .gte('run_at', fourWeeksAgo)
    .order('run_at', { ascending: false })
    .limit(4);

  const rows = (data ?? []) as PipelineRunRow[];

  if (rows.length === 0) {
    logger.info('content.health.report', { note: 'first run, no history to compare' });
    return;
  }

  const avg = <K extends keyof PipelineRunRow>(key: K): number => {
    const vals = rows.map((r) => r[key] ?? 0) as number[];
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };

  const thisMatchRate = matchRate(thisWeek);
  const avgMatchRate = rows.reduce((s, r) => {
    const total = r.commits_with_match + r.commits_without_match;
    return s + (total > 0 ? r.commits_with_match / total : 0);
  }, 0) / rows.length;

  const trend = (curr: number, prev: number): '↑' | '↓' | '→' => {
    const diff = (curr - prev) / (Math.abs(prev) || 1);
    if (diff > 0.05) return '↑';
    if (diff < -0.05) return '↓';
    return '→';
  };

  // Wasted sources: classified many, stored few
  const { data: wastedData } = await db
    .from('content_sources')
    .select('name, articles_evaluated, articles_passed')
    .gt('articles_evaluated', 10)
    .order('articles_evaluated', { ascending: false })
    .limit(10);

  const wasted = ((wastedData ?? []) as Array<{ name: string; articles_evaluated: number; articles_passed: number }>)
    .map((s) => ({ name: s.name, waste_ratio: 1 - s.articles_passed / Math.max(s.articles_evaluated, 1) }))
    .sort((a, b) => b.waste_ratio - a.waste_ratio)
    .slice(0, 3);

  logger.info('content.health.report', {
    articles_stored_trend: `${thisWeek.articles_stored} ${trend(thisWeek.articles_stored, avg('articles_stored'))} (avg ${avg('articles_stored').toFixed(0)})`,
    avg_quality_trend: `${(thisWeek.avg_quality_score ?? 0).toFixed(1)} ${trend(thisWeek.avg_quality_score ?? 0, avg('avg_quality_score'))} (avg ${avg('avg_quality_score').toFixed(1)})`,
    match_rate_trend: `${(thisMatchRate * 100).toFixed(0)}% ${trend(thisMatchRate, avgMatchRate)} (avg ${(avgMatchRate * 100).toFixed(0)}%)`,
    // Red flags
    zero_stored: thisWeek.articles_stored === 0,
    quality_dropping: (thisWeek.avg_quality_score ?? 0) < (avg('avg_quality_score') ?? 0) - 1,
    no_matches_4_weeks: rows.every((r) => r.commits_with_match === 0) && thisWeek.commits_with_match === 0,
    // Top wasted sources
    wasted_sources: wasted,
  });
}

function matchRate(stats: PipelineRunStats): number {
  const total = stats.commits_with_match + stats.commits_without_match;
  return total > 0 ? stats.commits_with_match / total : 0;
}
