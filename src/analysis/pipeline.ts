import { logger } from '../utils/logger.js';
import { MODULE_REGISTRY } from './modules/index.js';
import type { AnalysisContext, Finding, DeltaHit, CodeAnalyzer } from './types.js';
import { enrichFindingsForRetrieval } from './retrieval-enrichment.js';

const LOCKFILE_PATH_RE = /(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Gemfile\.lock|Cargo\.lock|poetry\.lock|go\.sum|composer\.lock)$/;
const GENERATED_PATH_RE = /\/tests\/baselines\/|\/(?:__snapshots__)\/|\.snap$|\/dist\/|\/build\/|\/generated\//i;

export interface PipelineResult {
  /** Findings with score ≥ 5 — eligible for immediate post (gatilladores 1 & 2) */
  readonly findings: Finding[];
  /** Findings with score 1-4 — become WeakSignals per topic in the SignalBank */
  readonly weakFindings: Finding[];
  /** Bilateral pattern matches — become WeakSignal(strength=2) per topic */
  readonly deltaHits: DeltaHit[];
}

/**
 * Runs all applicable modules in parallel and returns findings routed by score.
 *
 * - score ≥ 5  → findings[] (immediate post path)
 * - score 1-4  → weakFindings[] (signal accumulation)
 * - delta_hit  → deltaHits[] (bilateral match — signal accumulation, strength=2)
 * - null       → discarded
 *
 * - Failure in one module = null result, NOT a crash (Promise.allSettled)
 * - findings[] empty → caller skips Claude for this commit
 * - applicableLanguages filter: module only runs if the commit touches
 *   at least one of the module's specified languages
 */
export async function runPipeline(
  ctx: AnalysisContext,
  topN = 3,
  modules: CodeAnalyzer[] = MODULE_REGISTRY,
  recentModuleIds: string[] = [],
): Promise<PipelineResult> {
  const filteredDiffs = ctx.diffs.filter(
    (d) => !LOCKFILE_PATH_RE.test(d.filename) && !GENERATED_PATH_RE.test(d.filename) && d.language !== 'Markdown',
  );
  const effectiveCtx: AnalysisContext = filteredDiffs.length < ctx.diffs.length
    ? { ...ctx, diffs: filteredDiffs }
    : ctx;

  const applicableModules = modules.filter(mod => {
    if (!mod.applicableLanguages) return true;
    return mod.applicableLanguages.some(lang => effectiveCtx.languages.includes(lang));
  });

  logger.info('analysis.pipeline.start', {
    sha: ctx.sha,
    repo: ctx.repo,
    modules: applicableModules.map(m => m.id),
    languages: ctx.languages,
  });

  const results = await Promise.allSettled(
    applicableModules.map(mod => mod.analyze(effectiveCtx))
  );

  const allFindings: Finding[] = [];
  const deltaHits: DeltaHit[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const mod = applicableModules[i];

    if (result === undefined || mod === undefined) continue;

    if (result.status === 'fulfilled') {
      if (result.value === null) continue;
      if ('kind' in result.value && result.value.kind === 'delta_hit') {
        deltaHits.push(result.value as DeltaHit);
      } else {
        allFindings.push(result.value as Finding);
      }
    } else {
      logger.warn('analysis.module.failed', {
        module: mod.id,
        error: String(result.reason),
      });
    }
  }

  // Freshness multiplier: penalise modules that fired recently.
  // adjustedScore = interestScore / (fires_in_window + 1)
  const fireCounts = new Map<string, number>();
  for (const id of recentModuleIds) {
    fireCounts.set(id, (fireCounts.get(id) ?? 0) + 1);
  }

  const MIN_INTEREST_SCORE = 7;
  const enrichedFindings = enrichFindingsForRetrieval(allFindings, ctx);

  const weakFindings = enrichedFindings.filter((f) => f.interestScore > 0 && f.interestScore < MIN_INTEREST_SCORE);

  const sorted = enrichedFindings
    .filter((f) => f.interestScore >= MIN_INTEREST_SCORE)
    .map((f) => ({
      finding: f,
      adjustedScore: f.interestScore / ((fireCounts.get(f.moduleId) ?? 0) + 1),
    }))
    .sort((a, b) => b.adjustedScore - a.adjustedScore)
    .map((x) => x.finding);

  const findings = sorted.slice(0, topN);

  logger.info('analysis.pipeline.done', {
    sha: ctx.sha,
    findingsTotal: allFindings.length,
    findingsSelected: findings.length,
    weakFindings: weakFindings.length,
    deltaHits: deltaHits.length,
    scores: findings.map(f => ({
      module: f.moduleId,
      score: f.interestScore,
      adjusted: f.interestScore / ((fireCounts.get(f.moduleId) ?? 0) + 1),
    })),
  });

  return { findings, weakFindings, deltaHits };
}
