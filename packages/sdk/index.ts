/**
 * devcast-sdk — TypeScript types for writing devcast analysis module plugins.
 *
 * Usage:
 *   npm install devcast-sdk
 *
 * Example plugin (devcast-module-rust/index.ts):
 *
 *   import type { CodeAnalyzer, Finding, AnalysisContext } from 'devcast-sdk';
 *
 *   export const module: CodeAnalyzer = {
 *     id: 'rust_patterns',
 *     name: 'Rust Patterns',
 *     category: 'rust_patterns',
 *     applicableLanguages: ['Rust'],
 *     async analyze(ctx) {
 *       // inspect ctx.diffs — return Finding | null
 *       return null;
 *     },
 *   };
 *
 * devcast discovers plugins listed in config.yaml under `plugins:` and appends
 * them to the built-in MODULE_REGISTRY at startup. Each plugin must export a
 * named `module` property implementing CodeAnalyzer.
 */

export interface FileDiff {
  readonly filename: string;
  readonly status: 'added' | 'modified' | 'removed' | 'renamed';
  readonly additions: number;
  readonly deletions: number;
  readonly patch: string;
  readonly language?: string;
}

export interface AnalysisContext {
  readonly diffs: FileDiff[];
  readonly commitMessage: string;
  readonly languages: string[];
  readonly repo: string;
  readonly sha: string;
}

export interface Finding {
  readonly moduleId: string;
  readonly aspect: string;
  readonly finding: string;
  readonly technicalDetail: string;
  readonly plainLanguage: string;
  readonly interestScore: number;
  readonly contextHint?: string;
  readonly evidence?: {
    readonly before?: string;
    readonly after?: string;
  };
}

/**
 * The interface every devcast analysis module must implement.
 * Export it as a named `module` property from your npm package.
 */
export interface CodeAnalyzer {
  /** Unique identifier for this module (snake_case). */
  readonly id: string;

  /** Human-readable module name shown in logs. */
  readonly name: string;

  /**
   * Category string — arbitrary for plugins (devcast core uses a fixed union,
   * but plugins may define their own categories).
   */
  readonly category: string;

  /**
   * If defined, this module only runs on commits that touch files in one of
   * these languages (e.g. ['Rust', 'C']). Undefined = runs on all commits.
   */
  readonly applicableLanguages?: string[];

  /**
   * Analyze the commit context. Return a Finding if something interesting was
   * detected, or null if nothing noteworthy was found.
   *
   * Must not throw — unhandled rejections are caught by the pipeline and logged
   * as warnings; the module returns null for that commit.
   */
  analyze(ctx: AnalysisContext): Promise<Finding | null>;
}
