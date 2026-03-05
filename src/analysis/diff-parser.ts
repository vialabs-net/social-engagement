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
