import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';

const SMALL_FUNCTION_PATTERN = /^[+]\s*(function\s+\w+|const\s+\w+\s*=\s*(\(|async)|\w+\s*\()/;
const LOOKUP_TABLE_PATTERN = /new Map\s*\(\s*\[|const\s+\w+\s*:\s*Record|as\s+const\s*;|= \{[\s\S]{0,200}\} as const/;

export class CleanCodeModule implements CodeAnalyzer {
  readonly id = 'clean_code';
  readonly name = 'Clean Code Analyzer';
  readonly category = 'clean_code' as const;

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    for (const diff of ctx.diffs) {
      if (!diff.patch || diff.status === 'removed') continue;

      const totalBefore = diff.deletions;
      const totalAfter = diff.additions;

      // KISS: significant net line reduction (≥ 30% fewer lines)
      if (totalBefore >= 15 && totalAfter < totalBefore) {
        const reductionRatio = (totalBefore - totalAfter) / totalBefore;
        if (reductionRatio >= 0.3) {
          const percentReduced = Math.round(reductionRatio * 100);
          const usesLookup = LOOKUP_TABLE_PATTERN.test(diff.patch);

          const kissFacts: string[] = [
            `${diff.filename} modified: +${totalAfter} added, -${totalBefore} removed (${percentReduced}% net reduction).`,
          ];
          if (usesLookup) kissFacts.push('Lookup table pattern (new Map or as const object) detected in diff.');

          return {
            moduleId: this.id,
            aspect: 'KISS / line reduction',
            finding: `Reduced ${diff.filename} by ${percentReduced}% — from ~${totalBefore} to ~${totalAfter} lines${usesLookup ? ' using a lookup table' : ''}`,
            technicalDetail: `KISS principle, ${usesLookup ? 'lookup table pattern, ' : ''}cognitive complexity reduction. ${totalBefore}→${totalAfter} lines (${percentReduced}% reduction).`,
            plainLanguage: `The commit made the code significantly simpler — ${percentReduced}% fewer lines with the same behavior. ${usesLookup ? 'A nested conditional tree was replaced with a lookup table, which is readable as data rather than traced as logic.' : 'The simplification reduces the cognitive load for anyone reading or modifying this code in the future.'}`,
            verifiableFacts: kissFacts,
            interestScore: Math.min(9, 5 + Math.floor(reductionRatio * 8)),
            contextHint: `${diff.filename} in ${ctx.repo}`,
            evidence: {
              before: `~${totalBefore} lines`,
              after: `~${totalAfter} lines (${percentReduced}% reduction)`,
            },
          };
        }
      }

      // DRY: extraction of new small pure functions
      const addedLines = diff.patch.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));
      const newFunctions = addedLines.filter(l => SMALL_FUNCTION_PATTERN.test(l));

      // Compact refactor: many new functions with near-zero net growth
      const isCompactExtraction = newFunctions.length >= 3 && totalAfter <= totalBefore + 5;
      // Structural refactor: extracts functions while reorganizing existing code (moderate net growth allowed)
      const isStructuralExtraction = newFunctions.length >= 2 && totalBefore >= 5 && totalAfter <= totalBefore * 2;

      if (isCompactExtraction || isStructuralExtraction) {
        const fnNames = newFunctions
          .slice(0, 5)
          .map((l) => l.match(/(?:function\s+|const\s+)(\w+)/)?.[1])
          .filter((n): n is string => Boolean(n));

        const dryFacts: string[] = [
          `${newFunctions.length} new function signatures detected in ${diff.filename} (${diff.status}: +${diff.additions}/-${diff.deletions} lines).`,
        ];
        if (fnNames.length > 0) dryFacts.push(`Named functions added: ${fnNames.join(', ')}.`);

        return {
          moduleId: this.id,
          aspect: 'DRY / function extraction',
          finding: `Extracted ${newFunctions.length} new functions in ${diff.filename} — single-responsibility refactoring`,
          technicalDetail: `DRY principle, single responsibility principle, extract method refactoring. ${newFunctions.length} new functions added.`,
          plainLanguage: `The commit broke a larger block of logic into ${newFunctions.length} focused functions, each with one job. Each function can now be read, tested, and changed independently.`,
          verifiableFacts: dryFacts,
          interestScore: 6,
          contextHint: `${diff.filename} in ${ctx.repo}`,
        };
      }
    }

    return null;
  }
}
