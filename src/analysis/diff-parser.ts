import type { FileDiff } from './types.js';
import { detectLanguage } from './language-detector.js';

const MAX_PATCH_LINES = 150;

interface RawFile {
  filename: string;
  status?: string;
  additions?: number;
  deletions?: number;
  patch?: string;
}

/**
 * Converts the raw file list from GitHub's commit API into FileDiff[].
 * Truncates patches to MAX_PATCH_LINES to control token cost.
 */
export function parseCommitFiles(rawFiles: RawFile[]): FileDiff[] {
  return rawFiles
    .filter(f => f.status !== 'removed' || f.additions !== undefined)
    .map(f => {
      const patch = f.patch ? truncatePatch(f.patch, MAX_PATCH_LINES) : '';
      const status = normalizeStatus(f.status ?? 'modified');
      return {
        filename: f.filename,
        status,
        additions: f.additions ?? 0,
        deletions: f.deletions ?? 0,
        patch,
        language: detectLanguage(f.filename),
      } satisfies FileDiff;
    });
}

export function extractAddedLines(patch: string, language?: string): string {
  const raw = patch
    .split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .map((l) => l.slice(1))
    .join('\n');
  return language ? stripCommentsAndStrings(raw, language) : raw;
}

export function extractRemovedLines(patch: string, language?: string): string {
  const raw = patch
    .split('\n')
    .filter((l) => l.startsWith('-') && !l.startsWith('---'))
    .map((l) => l.slice(1))
    .join('\n');
  return language ? stripCommentsAndStrings(raw, language) : raw;
}

/**
 * Strips comment-only lines and string literal contents from extracted diff text.
 * Heuristic, not a parser: favors false negatives (retains ambiguous lines) over
 * false positives (removing real code). Unsupported languages pass through unchanged.
 *
 * Covered: JavaScript, TypeScript, Java, Python, Go, Elixir, XML.
 */
export function stripCommentsAndStrings(text: string, language: string): string {
  const lang = language.toLowerCase();

  if (lang === 'xml') {
    return text
      .split('\n')
      .map((line) => {
        // Remove XML comments
        const noComment = line.replace(/<!--[\s\S]*?-->/g, '');
        // Empty text-only nodes (content between tags that is prose, not code)
        return noComment.replace(/>([^<]+)</g, (_, inner) =>
          /[<>{}()=]/.test(inner) ? `>${inner}<` : '><',
        );
      })
      .filter((line) => line.trim().length > 0)
      .join('\n');
  }

  if (
    lang === 'javascript' ||
    lang === 'typescript' ||
    lang === 'java' ||
    lang === 'go' ||
    lang === 'kotlin' ||
    lang === 'swift' ||
    lang === 'c#' ||
    lang === 'c++' ||
    lang === 'c'
  ) {
    return text
      .split('\n')
      .filter((line) => {
        const trimmed = line.trimStart();
        // Discard lines that are purely a line comment
        return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
      })
      .map((line) =>
        // Clear string literal contents; keep the quotes so structural patterns still match
        line
          .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""')
          .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''")
          .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, '``'),
      )
      .join('\n');
  }

  if (lang === 'python') {
    return text
      .split('\n')
      .filter((line) => {
        const trimmed = line.trimStart();
        return !trimmed.startsWith('#');
      })
      .map((line) =>
        line
          .replace(/"""[\s\S]*?"""/g, '""""""')
          .replace(/'''[\s\S]*?'''/g, "''''''")
          .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""')
          .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''"),
      )
      .join('\n');
  }

  if (lang === 'elixir') {
    return text
      .split('\n')
      .filter((line) => {
        const trimmed = line.trimStart();
        return !trimmed.startsWith('#');
      })
      .map((line) =>
        line
          .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""')
          .replace(/~S\(.*?\)/g, '~S()'),
      )
      .join('\n');
  }

  // Unsupported language: return unchanged
  return text;
}

export function extractFirstHunkSnippet(patch: string, maxLines = 6): string {
  const lines = patch.split('\n');
  let inHunk = false;
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith('\\')) continue;
    result.push(line);
    if (result.length >= maxLines) break;
  }

  return result.join('\n');
}

function normalizeStatus(raw: string): FileDiff['status'] {
  switch (raw) {
    case 'added':    return 'added';
    case 'removed':  return 'removed';
    case 'renamed':  return 'renamed';
    default:         return 'modified';
  }
}

function truncatePatch(patch: string, maxLines: number): string {
  const lines = patch.split('\n');
  if (lines.length <= maxLines) return patch;
  return lines.slice(0, maxLines).join('\n') + '\n[... truncated]';
}
