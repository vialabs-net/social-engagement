import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';

// Decision-point keywords that contribute to cyclomatic complexity
const DECISION_PATTERN = /\b(if|else\s+if|switch|case|for|while|do|catch|finally)\b|&&|\|\||\?[^:]/g;

export class ComplexityModule implements CodeAnalyzer {
  readonly id = 'complexity';
  readonly name = 'Complexity Analyzer';
  readonly category = 'complexity' as const;

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    let addedDecisions = 0;
    let removedDecisions = 0;
    let affectedFiles: string[] = [];

    for (const diff of ctx.diffs) {
      if (!diff.patch) continue;

      const lines = diff.patch.split('\n');
      let fileAdded = 0;
      let fileRemoved = 0;

      for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          const matches = line.match(DECISION_PATTERN);
          fileAdded += matches?.length ?? 0;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          const matches = line.match(DECISION_PATTERN);
          fileRemoved += matches?.length ?? 0;
        }
      }

      if (Math.abs(fileAdded - fileRemoved) >= 2) {
        addedDecisions += fileAdded;
        removedDecisions += fileRemoved;
        affectedFiles.push(diff.filename);
      }
    }

    const delta = removedDecisions - addedDecisions; // positive = complexity reduced

    // Only surface if meaningful complexity change
    if (Math.abs(delta) < 3) return null;

    if (delta > 0) {
      // Complexity reduction — more interesting
      const score = Math.min(10, 4 + Math.floor(delta / 2));
      const primaryFile = affectedFiles[0] ?? 'the codebase';
      return {
        moduleId: this.id,
        aspect: 'cyclomatic complexity reduction',
        finding: `Reduced cyclomatic complexity by ~${delta} decision points across ${affectedFiles.length} file(s) — notably in ${primaryFile}`,
        technicalDetail: `McCabe cyclomatic complexity, extract method refactoring, single-responsibility principle. Decision delta: -${delta}`,
        plainLanguage: `The commit simplified branching logic significantly. Fewer if/else/switch branches means fewer paths a bug can take, fewer test cases needed, and code that's easier to read and change.`,
        interestScore: score,
        evidence: {
          before: `~${removedDecisions} decision branches`,
          after: `~${addedDecisions} decision branches (reduced by ${delta})`,
        },
      };
    } else {
      // Complexity increase — less interesting, only flag if large
      const increase = Math.abs(delta);
      if (increase < 6) return null;
      const score = Math.min(6, 2 + Math.floor(increase / 4));
      return {
        moduleId: this.id,
        aspect: 'cyclomatic complexity increase',
        finding: `Added ~${increase} decision points — complexity grew in ${affectedFiles.length} file(s)`,
        technicalDetail: `McCabe cyclomatic complexity. Decision delta: +${increase}. May warrant future refactoring.`,
        plainLanguage: `The commit added significant branching logic. This may be intentional (handling more cases) but is worth noting as an area to watch.`,
        interestScore: score,
      };
    }
  }
}
