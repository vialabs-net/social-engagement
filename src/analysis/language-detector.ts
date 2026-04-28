import { extname } from 'path';
import type { FileDiff } from './types.js';

const EXT_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.mts': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.swift': 'Swift',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.c': 'C',
  '.sh': 'Shell',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.json': 'JSON',
  '.sql': 'SQL',
  '.md': 'Markdown',
  '.tf': 'Terraform',
  '.dockerfile': 'Dockerfile',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
};

export function detectLanguage(filename: string): string | undefined {
  const ext = extname(filename.toLowerCase());
  if (ext === '' && filename.toLowerCase() === 'dockerfile') return 'Dockerfile';
  return EXT_TO_LANGUAGE[ext];
}

const LOCKFILE_RE = /^(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|npm-shrinkwrap\.json|tsconfig[^/]*\.json)$/i;

/**
 * Returns the unique set of languages detected in the given diffs,
 * excluding lockfiles and config-only files that pollute language signals.
 */
export function detectLanguages(diffs: FileDiff[]): string[] {
  const langs = new Set<string>();
  for (const diff of diffs) {
    const basename = diff.filename.split('/').pop() ?? diff.filename;
    if (LOCKFILE_RE.test(basename)) continue;
    if (diff.language) langs.add(diff.language);
  }
  return Array.from(langs);
}
