import { parseCommitFiles } from '../analysis/diff-parser.js';
import { detectLanguages } from '../analysis/language-detector.js';
import { RepoNotFoundError, type GitHubClient } from './client.js';
import type { FileDiff } from '../analysis/types.js';

export interface EnrichedCommit {
  sha: string;
  message: string;
  repo: string;
  authorLogin: string;
  totalAdditions: number;
  totalDeletions: number;
  diffs: FileDiff[];
  languages: string[];
  committedAt: string;
}

interface RawCommitData {
  sha: string;
  commit: {
    message: string;
    committer?: { date?: string };
  };
  stats?: { additions?: number; deletions?: number };
  files?: Array<{
    filename: string;
    status?: string;
    additions?: number;
    deletions?: number;
    patch?: string;
  }>;
}

/**
 * Fetches full commit data and builds an EnrichedCommit ready for the analysis pipeline.
 */
export async function enrichCommit(
  client: GitHubClient,
  owner: string,
  repo: string,
  sha: string,
  authorLogin: string,
): Promise<EnrichedCommit> {
  let raw: RawCommitData;
  try {
    raw = await client.getCommit(owner, repo, sha) as RawCommitData;
  } catch (err) {
    const e = err as { status?: number };
    if (e.status === 404) throw new RepoNotFoundError(`${owner}/${repo}`);
    throw err;
  }

  const diffs = parseCommitFiles(raw.files ?? []);
  const languages = detectLanguages(diffs);

  return {
    sha: raw.sha,
    message: raw.commit.message.split('\n')[0] ?? raw.commit.message,
    repo: `${owner}/${repo}`,
    authorLogin,
    totalAdditions: raw.stats?.additions ?? 0,
    totalDeletions: raw.stats?.deletions ?? 0,
    diffs,
    languages,
    committedAt: raw.commit.committer?.date ?? new Date().toISOString(),
  };
}
