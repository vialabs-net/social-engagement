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
  | 'concurrency'
  | 'dx'
  | 'dependency_health'
  | 'evolutionary'
  | 'js_advanced'
  | 'react_patterns'
  | 'devops'
  | 'python_patterns'
  | 'go_patterns'
  | 'java_patterns'
  | 'elixir_patterns'
  | 'architecture_patterns';

export interface FileDiff {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  patch: string;           // raw unified diff, max 150 lines
  language?: string;
  hunks?: Array<{ functionName?: string }>;
}

export interface AnalysisContext {
  diffs: FileDiff[];
  commitMessage: string;
  commitBody?: string;
  languages: string[];     // detected from file extensions
  repo: string;            // 'owner/repo'
  sha: string;
}

export interface Finding {
  moduleId: string;
  aspect: string;          // human-readable module label
  finding: string;         // what was found (for Claude's context)
  technicalDetail: string; // technical terms, metrics, named concepts
  plainLanguage: string;   // fallback when verifiableFacts is absent
  /** Diff-derived facts Claude may cite. When present, replaces plainLanguage. */
  verifiableFacts?: readonly string[];
  interestScore: number;   // 1–10
  contextHint?: string;    // e.g. "ReconciliationService.ts in vialabs-net/scrappers"
  retrievalText?: string;  // richer retrieval-oriented text for article matching
  retrievalTerms?: string[];
  evidence?: {
    before?: string;       // code snippet or description of before state
    after?: string;        // code snippet or description of after state
  };
}

/**
 * Emitted by a module when it detects the same pattern in both added and removed
 * lines — a mechanical substitution rather than a genuinely new introduction.
 * The pipeline routes this into the SignalBank as a WeakSignal(strength=2)
 * instead of triggering an immediate post.
 */
export interface DeltaHit {
  readonly kind: 'delta_hit';
  readonly topic: string;   // moduleId
  readonly strength: 2;
}

/** Union type returned by module.analyze() */
export type ModuleResult = Finding | DeltaHit | null;

export interface WeakSignal {
  topic: string;              // moduleId category (e.g. 'performance', 'security')
  strength: number;           // 1–10
  pattern_kind:
    | 'new_abstraction'
    | 'contract_change'
    | 'semantic_refactor'
    | 'config_change'
    | 'dependency_update'
    | 'behavioral_change';
  source: 'finding' | 'delta_hit' | 'haiku_lazy';
  affected_symbols: string[]; // names of functions/classes/types affected
  affected_files: string[];   // file paths touched in this commit (for coherence routing)
  specific_change: string;    // 1-line description: "timeout 5s→30s in fetchUser"
  commit_sha: string;
  repo: string;
  tenant_id: string;
  github_author_login: string;
  accumulated_at: string;     // ISO timestamp for decay calculation
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
   * Analyze the commit context and return a Finding, a DeltaHit (bilateral
   * pattern match — mechanical substitution), or null (nothing of interest).
   *
   * Must not throw — failures are caught by the pipeline.
   */
  analyze(ctx: AnalysisContext): Promise<ModuleResult>;
}
