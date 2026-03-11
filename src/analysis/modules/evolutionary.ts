import type { CodeAnalyzer, AnalysisContext, Finding, FileDiff } from '../types.js';

const MIGRATION_REGEX = /(?:migrat|\.sql$)/i;
const MIN_EXTRACTION_LINES = 30;
const MIN_LARGE_DELETION = 50;

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot);
}

function getDirectory(filename: string): string {
  const slash = filename.lastIndexOf('/');
  return slash === -1 ? '' : filename.slice(0, slash);
}

function detectModuleExtraction(diffs: readonly FileDiff[], repo: string): Finding | null {
  const addedFiles = diffs.filter((d) => d.status === 'added' && d.additions >= MIN_EXTRACTION_LINES);
  const modifiedWithDeletions = diffs.filter((d) => d.status === 'modified' && d.deletions >= MIN_EXTRACTION_LINES);

  for (const added of addedFiles) {
    for (const modified of modifiedWithDeletions) {
      const sameDir = getDirectory(added.filename) === getDirectory(modified.filename);
      const sameExt = getExtension(added.filename) === getExtension(modified.filename);
      if (sameDir || sameExt) {
        return {
          moduleId: 'evolutionary',
          aspect: 'module extraction',
          finding: `module extraction: ${modified.filename} -> ${added.filename}`,
          technicalDetail: 'Module extraction — splitting a large file into smaller, focused modules with single responsibilities.',
          plainLanguage: 'Extracting code into its own module is a sign of a codebase maturing. A file that does too much gets split into focused pieces — each easier to test, read, and change independently.',
          interestScore: 9,
          contextHint: `${added.filename} in ${repo}`,
        };
      }
    }
  }

  return null;
}

function detectFileRename(diffs: readonly FileDiff[], repo: string): Finding | null {
  const renamed = diffs.find((d) => d.status === 'renamed');
  if (!renamed) return null;
  return {
    moduleId: 'evolutionary',
    aspect: 'file rename',
    finding: `file renamed: ${renamed.filename}`,
    technicalDetail: 'File rename — improving naming to better reflect the module\'s responsibility and make the codebase more navigable.',
    plainLanguage: 'Renaming a file signals that the team is investing in clarity. Good names reduce the time it takes a new developer to find what they are looking for.',
    interestScore: 5,
    contextHint: `${renamed.filename} in ${repo}`,
  };
}

function detectMigration(diffs: readonly FileDiff[], repo: string): Finding | null {
  const migration = diffs.find((d) => d.status === 'added' && MIGRATION_REGEX.test(d.filename));
  if (!migration) return null;
  return {
    moduleId: 'evolutionary',
    aspect: 'migration file',
    finding: `migration added: ${migration.filename}`,
    technicalDetail: 'Database migration — a versioned schema change that evolves the database structure alongside application code.',
    plainLanguage: 'Migrations keep the database in sync with the code. Each migration is a reversible step — if something breaks, you roll back one version, not the entire schema.',
    interestScore: 8,
    contextHint: `${migration.filename} in ${repo}`,
  };
}

function detectDeprecation(diffs: readonly FileDiff[], repo: string): Finding | null {
  for (const diff of diffs) {
    if (!diff.patch || diff.status === 'removed') continue;
    const addedLines = diff.patch
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => l.slice(1));

    if (addedLines.some((l) => /\b@[Dd]eprecated\b|\/\/\s*DEPRECATED|\/\*\*?\s*@deprecated/.test(l))) {
      return {
        moduleId: 'evolutionary',
        aspect: 'deprecation marker',
        finding: `deprecation marker in ${diff.filename}`,
        technicalDetail: 'Deprecation — marking code as obsolete with a clear signal to stop using it before it is removed.',
        plainLanguage: 'Deprecation warnings give consumers time to migrate. Instead of a breaking removal, you mark it deprecated, document the replacement, and remove it in the next major version.',
        interestScore: 7,
        contextHint: `${diff.filename} in ${repo}`,
      };
    }
  }
  return null;
}

function detectLargeDeletion(diffs: readonly FileDiff[], repo: string): Finding | null {
  const large = diffs.find((d) => d.status === 'modified' && d.deletions >= MIN_LARGE_DELETION);
  if (!large) return null;
  return {
    moduleId: 'evolutionary',
    aspect: 'large-scale simplification',
    finding: `${large.deletions} lines removed from ${large.filename}`,
    technicalDetail: 'Large-scale deletion — significant code removal indicating simplification, dead code cleanup, or responsibility transfer.',
    plainLanguage: 'Deleting code is underrated. Every line removed is a line that no longer needs tests, reviews, or maintenance. The best refactor often makes the codebase smaller, not bigger.',
    interestScore: 7,
    contextHint: `${large.filename} in ${repo}`,
  };
}

export class EvolutionaryModule implements CodeAnalyzer {
  readonly id = 'evolutionary';
  readonly name = 'Evolutionary Design';
  readonly category = 'evolutionary' as const;

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    return detectModuleExtraction(ctx.diffs, ctx.repo)
      ?? detectFileRename(ctx.diffs, ctx.repo)
      ?? detectMigration(ctx.diffs, ctx.repo)
      ?? detectDeprecation(ctx.diffs, ctx.repo)
      ?? detectLargeDeletion(ctx.diffs, ctx.repo);
  }
}
