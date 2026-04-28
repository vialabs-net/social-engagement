import type { CodeAnalyzer, AnalysisContext, Finding, FileDiff } from '../types.js';
import { extractRemovedLines, extractFirstHunkSnippet } from '../diff-parser.js';

// Filename candidates that MIGHT be migrations. Requires further structural
// verification (see detectMigration) — "migrat" alone is not enough.
const MIGRATION_PATH_REGEX = /(?:migrat|\.sql$)/i;

// Versioning prefixes used by real migration tools:
//   Flyway/Liquibase: V1__, V2_3__, R__
//   Sequelize/Knex/Django/Alembic: 001_, 1234_, 20260422_, 2026_04_22_
//   Rails: 20260422123000_
const VERSIONED_MIGRATION_FILENAME_REGEX = /(?:^|\/)(?:V\d+(?:_\d+)*__|R__|\d{3,}_|\d{4}_\d{2}_\d{2}_|\d{8,}_)/;

// SQL DDL signatures in the added content.
const SQL_DDL_REGEX = /\b(?:CREATE|ALTER|DROP|TRUNCATE)\s+(?:TABLE|INDEX|SCHEMA|VIEW|COLUMN|CONSTRAINT|SEQUENCE|MATERIALIZED\s+VIEW)\b/i;
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

function getRetrievalTerms(...values: string[]): string[] {
  return [...new Set(values
    .flatMap((value) => value.split(/[^A-Za-z0-9]+/))
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length >= 3 && part.length <= 30)
  )].slice(0, 12);
}

function detectModuleExtraction(ctx: AnalysisContext): Finding | null {
  const addedFiles = ctx.diffs.filter((d) => d.status === 'added' && d.additions >= MIN_EXTRACTION_LINES);
  const modifiedWithDeletions = ctx.diffs.filter((d) => d.status === 'modified' && d.deletions >= MIN_EXTRACTION_LINES);

  for (const added of addedFiles) {
    for (const modified of modifiedWithDeletions) {
      const sameDir = getDirectory(added.filename) === getDirectory(modified.filename);
      if (sameDir) {
        return {
          moduleId: 'evolutionary',
          aspect: 'module extraction',
          finding: `module extraction: responsibilities moved from ${modified.filename} into ${added.filename}`,
          technicalDetail: `Module extraction — splitting responsibilities from ${modified.filename} into ${added.filename} to create a smaller, more focused boundary.`,
          plainLanguage: 'Extracting code into its own module is a sign of a codebase maturing. A file that does too much gets split into focused pieces so each one is easier to test, reason about, and evolve independently.',
          interestScore: 7,
          contextHint: `${added.filename} in ${ctx.repo}`,
          retrievalTerms: getRetrievalTerms('module extraction', modified.filename, added.filename, ctx.commitMessage),
        };
      }
    }
  }

  return null;
}

function detectFileRename(ctx: AnalysisContext): Finding | null {
  const renamed = ctx.diffs.find((d) => d.status === 'renamed');
  if (!renamed) return null;
  return {
    moduleId: 'evolutionary',
    aspect: 'file rename',
    finding: `file renamed: ${renamed.filename}`,
    technicalDetail: 'File rename — improving naming to better reflect the module\'s responsibility and make the codebase more navigable.',
    plainLanguage: 'Renaming a file signals that the team is investing in clarity. Good names reduce the time it takes a new developer to find what they are looking for.',
    interestScore: 5,
    contextHint: `${renamed.filename} in ${ctx.repo}`,
    retrievalTerms: getRetrievalTerms('file rename', renamed.filename, ctx.commitMessage),
  };
}

function detectMigration(ctx: AnalysisContext): Finding | null {
  // Filename candidates — path contains "migrat" or has .sql extension.
  const candidates = ctx.diffs.filter(
    (d) => d.status === 'added' && MIGRATION_PATH_REGEX.test(d.filename),
  );
  if (candidates.length === 0) return null;

  // Require at least one structural signal before firing. Filename alone is
  // not enough — "tools/.../migration/backfill.js" is a one-off script, not a
  // versioned schema migration, and should not trigger this finding.
  const migration = candidates.find((d) => {
    const isSql = d.filename.toLowerCase().endsWith('.sql');
    if (isSql) return true;

    const hasVersionedName = VERSIONED_MIGRATION_FILENAME_REGEX.test(d.filename);
    if (hasVersionedName) return true;

    const hasSqlDdl = d.patch ? SQL_DDL_REGEX.test(d.patch) : false;
    if (hasSqlDdl) return true;

    return false;
  });
  if (!migration) return null;

  return {
    moduleId: 'evolutionary',
    aspect: 'migration file',
    finding: `migration added: ${migration.filename}`,
    technicalDetail: 'Database migration — a versioned schema change that evolves the database structure alongside application code.',
    plainLanguage: 'Migrations keep the database in sync with the code. Each migration is a reversible step — if something breaks, you roll back one version, not the entire schema.',
    interestScore: 8,
    contextHint: `${migration.filename} in ${ctx.repo}`,
    retrievalTerms: getRetrievalTerms('database migration', migration.filename, ctx.commitMessage),
  };
}

const DEPRECATION_REGEX = /\b@[Dd]eprecated\b|\/\/\s*DEPRECATED|\/\*\*?\s*@deprecated/;

function detectDeprecation(ctx: AnalysisContext): Finding | null {
  for (const diff of ctx.diffs) {
    if (!diff.patch || diff.status === 'removed') continue;
    const addedLines = diff.patch
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => l.slice(1));

    if (!addedLines.some((l) => DEPRECATION_REGEX.test(l))) continue;

    const removedText = extractRemovedLines(diff.patch);
    if (removedText.split('\n').some((l) => DEPRECATION_REGEX.test(l))) continue;

    return {
      moduleId: 'evolutionary',
      aspect: 'deprecation marker',
      finding: `deprecation marker in ${diff.filename}`,
      technicalDetail: 'Deprecation — marking code as obsolete with a clear signal to stop using it before it is removed.',
      plainLanguage: 'Deprecation warnings give consumers time to migrate. Instead of a breaking removal, you mark it deprecated, document the replacement, and remove it in the next major version.',
      interestScore: 7,
      contextHint: `${diff.filename} in ${ctx.repo}`,
      retrievalTerms: getRetrievalTerms('deprecation', diff.filename, ctx.commitMessage),
      evidence: {
        before: removedText.slice(0, 300) || undefined,
        after: extractFirstHunkSnippet(diff.patch) || undefined,
      },
    };
  }
  return null;
}

function detectLargeDeletion(ctx: AnalysisContext): Finding | null {
  const large = ctx.diffs.find((d) => d.status === 'modified' && d.deletions >= MIN_LARGE_DELETION);
  if (!large) return null;
  return {
    moduleId: 'evolutionary',
    aspect: 'large-scale simplification',
    finding: `${large.deletions} lines removed from ${large.filename}`,
    technicalDetail: 'Large-scale deletion — significant code removal indicating simplification, dead code cleanup, or responsibility transfer.',
    plainLanguage: 'Deleting code is underrated. Every line removed is a line that no longer needs tests, reviews, or maintenance. The best refactor often makes the codebase smaller, not bigger.',
    interestScore: 7,
    contextHint: `${large.filename} in ${ctx.repo}`,
    retrievalTerms: getRetrievalTerms('simplification', large.filename, ctx.commitMessage),
  };
}

export class EvolutionaryModule implements CodeAnalyzer {
  readonly id = 'evolutionary';
  readonly name = 'Evolutionary Design';
  readonly category = 'evolutionary' as const;

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    return detectModuleExtraction(ctx)
      ?? detectFileRename(ctx)
      ?? detectMigration(ctx)
      ?? detectDeprecation(ctx)
      ?? detectLargeDeletion(ctx);
  }
}
