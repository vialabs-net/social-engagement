import { logger } from '../utils/logger.js';
import { MODULE_REGISTRY } from './modules/index.js';
import type { AnalysisContext, Finding, CodeAnalyzer } from './types.js';
import { enrichFindingsForRetrieval } from './retrieval-enrichment.js';

/**
 * Runs all applicable modules in parallel and returns the top N findings
 * sorted by interestScore DESC.
 *
 * - Failure in one module = null finding, NOT a crash (Promise.allSettled)
 * - Returns empty array if nothing interesting found → caller skips Claude
 * - applicableLanguages filter: module only runs if the commit touches
 *   at least one of the module's specified languages
 */
export async function runPipeline(
  ctx: AnalysisContext,
  topN = 3,
  modules: CodeAnalyzer[] = MODULE_REGISTRY,
  recentModuleIds: string[] = [],
): Promise<Finding[]> {
  const applicableModules = modules.filter(mod => {
    if (!mod.applicableLanguages) return true;
    return mod.applicableLanguages.some(lang => ctx.languages.includes(lang));
  });

  logger.info('analysis.pipeline.start', {
    sha: ctx.sha,
    repo: ctx.repo,
    modules: applicableModules.map(m => m.id),
    languages: ctx.languages,
  });

  const results = await Promise.allSettled(
    applicableModules.map(mod => mod.analyze(ctx))
  );

  const findings: Finding[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const mod = applicableModules[i];

    if (result === undefined || mod === undefined) continue;

    if (result.status === 'fulfilled') {
      if (result.value !== null) {
        findings.push(result.value);
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
  // A module that fired 3 times recently gets score ÷ 4, making room for others.
  const fireCounts = new Map<string, number>();
  for (const id of recentModuleIds) {
    fireCounts.set(id, (fireCounts.get(id) ?? 0) + 1);
  }

  const MIN_INTEREST_SCORE = 5;
  const enrichedFindings = enrichFindingsForRetrieval(findings, ctx);
  const sorted = enrichedFindings
    .filter((f) => f.interestScore >= MIN_INTEREST_SCORE)
    .map((f) => ({
      finding: f,
      adjustedScore: f.interestScore / ((fireCounts.get(f.moduleId) ?? 0) + 1),
    }))
    .sort((a, b) => b.adjustedScore - a.adjustedScore)
    .map((x) => x.finding);
  const top = sorted.slice(0, topN);

  logger.info('analysis.pipeline.done', {
    sha: ctx.sha,
    findingsTotal: findings.length,
    findingsSelected: top.length,
    scores: top.map(f => ({
      module: f.moduleId,
      score: f.interestScore,
      adjusted: f.interestScore / ((fireCounts.get(f.moduleId) ?? 0) + 1),
    })),
  });

  return top;
}
