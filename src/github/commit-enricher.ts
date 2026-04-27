import { parseCommitFiles } from '../analysis/diff-parser.js';
import { detectLanguages } from '../analysis/language-detector.js';
import { RepoNotFoundError, type GitHubClient, type PrLookupResult } from './client.js';
import type { FileDiff } from '../analysis/types.js';

export type PrOutcome = 'open' | 'merged' | 'closed_unmerged' | 'closed_superseded';

export interface PrContext {
  readonly upstreamOwner: string;
  readonly upstreamRepo: string;
  readonly prNumber: number;
  readonly prUrl: string;
  readonly prTitle: string;
  readonly outcome: PrOutcome;
  readonly supersededEvidence?: {
    readonly supersededByPr?: number;
    readonly maintainerComment?: string;
    readonly confidence: 'high' | 'medium';
  };
}

export interface EnrichedCommit {
  sha: string;
  message: string;
  body: string;
  fullMessage: string;
  repo: string;
  authorLogin: string;
  totalAdditions: number;
  totalDeletions: number;
  diffs: FileDiff[];
  languages: string[];
  committedAt: string;
  isPrivateRepo: boolean;
  prContext?: PrContext;
}

interface RawCommitData {
  sha: string;
  commit: {
    message: string;
    committer?: { date?: string };
  };
  author?: { login?: string };
  stats?: { additions?: number; deletions?: number };
  files?: Array<{
    filename: string;
    status?: string;
    additions?: number;
    deletions?: number;
    patch?: string;
  }>;
}

// Regex for high-confidence superseded: verb of incorporation + explicit reference
const CREDIT_PHRASE_RE = /\b(merged|incorporated|applied|landed)\s+(in|from|via|as|under)\s+(#\d+|[0-9a-f]{7,40})/i;
// Regex for medium-confidence superseded: explicit thanks + reference to the work
const THANKS_RE = /\b(thanks|thank you|appreciate)\b.{0,80}(#\d+|[0-9a-f]{7,40}|raising|initial work|this pr)/i;
const PR_REF_RE = /#(\d+)/;

function detectOutcome(
  pr: PrLookupResult,
  forkAuthorLogin: string,
): { outcome: PrOutcome; supersededEvidence?: PrContext['supersededEvidence'] } {
  if (pr.state === 'OPEN') return { outcome: 'open' };
  if (pr.state === 'MERGED') return { outcome: 'merged' };

  const maintainerItems = pr.timelineItems.filter(
    (item) => item.authorLogin !== forkAuthorLogin && item.authorLogin !== '',
  );

  for (const item of maintainerItems) {
    if (CREDIT_PHRASE_RE.test(item.body)) {
      const prRefMatch = PR_REF_RE.exec(item.body);
      return {
        outcome: 'closed_superseded',
        supersededEvidence: {
          maintainerComment: item.body.slice(0, 200),
          supersededByPr: prRefMatch ? parseInt(prRefMatch[1]!, 10) : undefined,
          confidence: 'high',
        },
      };
    }

    if (THANKS_RE.test(item.body)) {
      const prRefMatch = PR_REF_RE.exec(item.body);
      return {
        outcome: 'closed_superseded',
        supersededEvidence: {
          maintainerComment: item.body.slice(0, 200),
          supersededByPr: prRefMatch ? parseInt(prRefMatch[1]!, 10) : undefined,
          confidence: 'medium',
        },
      };
    }
  }

  return { outcome: 'closed_unmerged' };
}

async function resolvePrContext(
  client: GitHubClient,
  owner: string,
  repo: string,
  branchRef: string,
  authorLogin: string,
): Promise<PrContext | undefined> {
  try {
    const prs = await client.listPullsForRef(owner, repo, branchRef);
    if (prs.length === 0) return undefined;

    // Use the first PR found (most recent match to this branch)
    const pr = prs[0]!;
    const { outcome, supersededEvidence } = detectOutcome(pr, authorLogin);

    return {
      upstreamOwner: pr.upstreamOwner,
      upstreamRepo: pr.upstreamRepo,
      prNumber: pr.number,
      prUrl: pr.url,
      prTitle: pr.title,
      outcome,
      supersededEvidence,
    };
  } catch {
    // PR lookup is best-effort — never block commit processing
    return undefined;
  }
}

/**
 * Fetches full commit data and builds an EnrichedCommit ready for the analysis pipeline.
 * branchRef (e.g. "refs/heads/feature-x") enables PR context lookup for non-default branches.
 */
export async function enrichCommit(
  client: GitHubClient,
  owner: string,
  repo: string,
  sha: string,
  fallbackAuthorLogin: string | null,
  branchRef?: string,
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
  const fullMessage = raw.commit.message ?? '';
  const [subject, ...bodyLines] = fullMessage.split('\n');
  const authorLogin = raw.author?.login ?? fallbackAuthorLogin ?? '';

  // Fail-closed: if the visibility fetch fails, treat the repo as private.
  let isPrivateRepo = true;
  let prContext: PrContext | undefined;

  try {
    const repoMeta = await client.getRepoMeta(owner, repo);
    isPrivateRepo = repoMeta.isPrivate;

    // PR lookup: only for non-default-branch pushes (feature branches, fork branches)
    if (branchRef) {
      const refBranch = branchRef.replace('refs/heads/', '');
      const isPushToNonDefaultBranch = refBranch !== repoMeta.defaultBranch;
      if (isPushToNonDefaultBranch) {
        prContext = await resolvePrContext(client, owner, repo, branchRef, authorLogin);
      }
    }
  } catch {
    // Visibility or meta fetch failed — keep fail-closed defaults.
  }

  return {
    sha: raw.sha,
    message: subject ?? fullMessage,
    body: bodyLines.join('\n').trim(),
    fullMessage,
    repo: `${owner}/${repo}`,
    authorLogin,
    totalAdditions: raw.stats?.additions ?? 0,
    totalDeletions: raw.stats?.deletions ?? 0,
    diffs,
    languages,
    committedAt: raw.commit.committer?.date ?? new Date().toISOString(),
    isPrivateRepo,
    prContext,
  };
}
