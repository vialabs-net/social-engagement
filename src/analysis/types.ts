export type AnalysisCategory =
  | 'complexity'
  | 'design_patterns'
  | 'clean_code'
  | 'type_system'
  | 'integration'
  | 'testing'
  | 'ai_assisted'
  | 'performance'
  | 'security'
  | 'api_design'
  | 'error_resilience'
  | 'observability'
  | 'concurrency';

export interface FileDiff {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  patch: string;           // raw unified diff, max 150 lines
  language?: string;
}

export interface AnalysisContext {
  diffs: FileDiff[];
  commitMessage: string;
  languages: string[];     // detected from file extensions
  repo: string;            // 'owner/repo'
  sha: string;
}

export interface Finding {
  moduleId: string;
  aspect: string;          // human-readable module label
  finding: string;         // what was found (for Claude's context)
  technicalDetail: string; // technical terms, metrics, named concepts
  plainLanguage: string;   // what Claude should explain in the post
  interestScore: number;   // 1–10
  evidence?: {
    before?: string;       // code snippet or description of before state
    after?: string;        // code snippet or description of after state
  };
}

/**
 * The standard interface every analysis module implements.
 *
 * To add a new module:
 * 1. Create src/analysis/modules/your-module.ts implementing CodeAnalyzer
 * 2. Add one line to src/analysis/modules/index.ts
 * That's it — no other files change.
 */
export interface CodeAnalyzer {
  /** Unique identifier, matches AnalysisCategory */
  readonly id: string;

  /** Human-readable module name */
  readonly name: string;

  /** Which category of finding this module produces */
  readonly category: AnalysisCategory;

  /**
   * If defined, this module only runs when the commit touches files
   * in one of these languages. If undefined, runs on all commits.
   */
  readonly applicableLanguages?: string[];

  /**
   * Analyze the commit context and return a finding if something interesting
   * was detected, or null if nothing noteworthy was found.
   *
   * Must not throw — failures are caught by the pipeline.
   */
  analyze(ctx: AnalysisContext): Promise<Finding | null>;
}
