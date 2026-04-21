import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import type { FileDiff } from '../../../../src/analysis/types.js';
import type { CachedCommit } from './types.js';

// Maps common filename extensions to the language strings used by the
// production modules' applicableLanguages check.
const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  rs: 'rust',
  rb: 'ruby',
  ex: 'elixir',
  exs: 'elixir',
  cs: 'csharp',
  sql: 'sql',
  sh: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  json: 'json',
  md: 'markdown',
  html: 'html',
  css: 'css',
  scss: 'scss',
};

function runGit(localPath: string, args: string[]): string {
  return execFileSync('git', ['-C', localPath, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function runGitSafe(localPath: string, args: string[]): string | null {
  try {
    return runGit(localPath, args);
  } catch {
    return null;
  }
}

export function repoLocalPath(reposRoot: string, repo: string): string | null {
  const [, repoName] = repo.split('/');
  if (!repoName) return null;
  const localPath = join(reposRoot, repoName);
  return existsSync(join(localPath, '.git')) ? localPath : null;
}

export function headOf(localPath: string): { sha: string; date: string } | null {
  const out = runGitSafe(localPath, ['log', '-1', '--format=%H|%aI', 'HEAD']);
  if (!out) return null;
  const [sha, date] = out.trim().split('|');
  if (!sha || !date) return null;
  return { sha, date };
}

export function discoverAuthorEmails(localPath: string, login: string): string[] {
  const out = runGitSafe(localPath, ['log', '--all', '--format=%an <%ae>']);
  if (!out) return [];
  const loginLower = login.toLowerCase();
  const emails = new Set<string>();
  for (const line of out.split('\n').filter(Boolean)) {
    const match = line.match(/^(.+?)\s<([^>]+)>$/);
    if (!match) continue;
    const [, name, email] = match;
    if (!email || !name) continue;
    const nameLower = name.toLowerCase();
    const emailLocal = email.split('@')[0]?.toLowerCase() ?? '';
    if (
      nameLower.includes(loginLower) ||
      emailLocal === loginLower ||
      emailLocal.startsWith(loginLower + '+')
    ) {
      emails.add(email);
    }
  }
  return [...emails];
}

export function listAuthorCommitShas(
  localPath: string,
  emails: string[],
  login: string,
  sinceISO: string,
): Array<{ sha: string; date: string; email: string; name: string }> {
  if (emails.length === 0) return [];
  const authorArgs: string[] = [];
  authorArgs.push(`--author=${login}@`);
  authorArgs.push(`--author=${login} <`);
  for (const email of emails) authorArgs.push(`--author=<${email}>`);
  const out = runGitSafe(localPath, [
    'log',
    '--all',
    `--since=${sinceISO}`,
    '--format=%H|%aI|%ae|%an',
    ...authorArgs,
  ]);
  if (!out) return [];
  const rows: Array<{ sha: string; date: string; email: string; name: string }> = [];
  for (const line of out.split('\n').filter(Boolean)) {
    const [sha, date, email, ...nameParts] = line.split('|');
    if (!sha || !date || !email) continue;
    rows.push({ sha, date, email, name: nameParts.join('|') });
  }
  return rows;
}

function detectLanguages(filenames: string[]): string[] {
  const set = new Set<string>();
  for (const name of filenames) {
    const ext = name.split('.').pop()?.toLowerCase();
    if (!ext) continue;
    const lang = EXT_TO_LANG[ext];
    if (lang) set.add(lang);
  }
  return [...set];
}

// Parse `git show --numstat --format= --unified=3 <sha>` output into FileDiff[].
// Numstat gives per-file additions/deletions; we merge with the patch sections.
export function loadCommit(localPath: string, repo: string, sha: string): CachedCommit | null {
  const metaLine = runGitSafe(localPath, [
    'log',
    '-1',
    '--format=%H%x1f%aI%x1f%an%x1f%ae%x1f%s%x1f%b%x1e',
    sha,
  ]);
  if (!metaLine) return null;
  const recordStart = metaLine.indexOf('') !== -1 ? metaLine : metaLine;
  // ASCII 0x1f = unit separator, 0x1e = record separator
  const trimmed = recordStart.replace(/\x1e$/, '').replace(/\x1e\s*$/, '').trim();
  const fields = trimmed.split('\x1f');
  if (fields.length < 5) return null;
  const [shaOut, dateISO, authorName, authorEmail, subject, ...rest] = fields;
  if (!shaOut || !dateISO) return null;
  const body = rest.join('\x1f').trim() || null;

  const numstatRaw = runGitSafe(localPath, ['show', '--numstat', '--format=', sha]);
  const patchRaw = runGitSafe(localPath, ['show', '--format=', '--unified=3', sha]);
  if (numstatRaw === null || patchRaw === null) return null;

  const fileStats = new Map<string, { additions: number; deletions: number; status: FileDiff['status'] }>();
  for (const line of numstatRaw.split('\n').filter(Boolean)) {
    const [addStr, delStr, ...pathParts] = line.split('\t');
    const filename = pathParts.join('\t');
    if (!filename) continue;
    const additions = addStr === '-' ? 0 : parseInt(addStr ?? '0', 10);
    const deletions = delStr === '-' ? 0 : parseInt(delStr ?? '0', 10);
    fileStats.set(filename, { additions, deletions, status: 'modified' });
  }

  // Split patch by 'diff --git a/<x> b/<y>' headers and associate with filenames.
  const diffs: FileDiff[] = [];
  const sections = patchRaw.split(/(?=^diff --git )/m);
  for (const section of sections) {
    if (!section.startsWith('diff --git ')) continue;
    const header = section.split('\n', 1)[0] ?? '';
    const pathMatch = header.match(/^diff --git a\/(.+?) b\/(.+?)$/);
    if (!pathMatch) continue;
    const filename = pathMatch[2] ?? pathMatch[1] ?? '';
    if (!filename) continue;

    let status: FileDiff['status'] = 'modified';
    if (/^new file mode/m.test(section)) status = 'added';
    else if (/^deleted file mode/m.test(section)) status = 'removed';
    else if (/^rename from /m.test(section)) status = 'renamed';

    const stat = fileStats.get(filename);
    const truncated = section.split('\n').slice(0, 150).join('\n');
    diffs.push({
      filename,
      status,
      additions: stat?.additions ?? 0,
      deletions: stat?.deletions ?? 0,
      patch: truncated,
    });
  }

  const filenames = diffs.map((d) => d.filename);
  const languages = detectLanguages(filenames);

  return {
    commit_sha: shaOut,
    repo,
    author_login: null,
    author_email: authorEmail ?? null,
    commit_date: dateISO,
    commit_message: subject ?? '',
    commit_body: body,
    diffs,
    languages,
    files_count: diffs.length,
  };
}

// Check if git CLI is reachable. Throws string error message if not.
export function assertGitAvailable(): string {
  try {
    return execFileSync('git', ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    throw new Error('git CLI not found in PATH');
  }
}
