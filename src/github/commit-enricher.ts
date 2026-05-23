import { parseCommitFiles } from '../analysis/diff-parser.js';
import { detectLanguages } from '../analysis/language-detector.js';
import { RepoNotFoundError, type GitHubClient, type PrLookupResult } from './client.js';
import type { FileDiff } from '../analysis/types.js';
import { logger } from '../utils/logger.js';

export type PrOutcome = 'open' | 'merged' | 'closed_unmerged' | 'closed_superseded';

export interface IssueRef {
  readonly number: number;
  readonly title: string;
  readonly bodySnippet?: string;
  readonly totalReactions: number;
  readonly totalComments: number;
}

export interface ReviewSummary {
  readonly body: string;
  readonly authorLogin: string;
  readonly state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
}

export interface PrContext {
  readonly upstreamOwner: string;
  readonly upstreamRepo: string;
  readonly prNumber: number;
  readonly prUrl: string;
  readonly prTitle: string;
  readonly outcome: PrOutcome;
  readonly prDescription?: string;
  readonly closingIssues?: ReadonlyArray<IssueRef>;
  readonly reviewSummaries?: ReadonlyArray<ReviewSummary>;
  readonly changesRequestedCount?: number;
  readonly timelineItemsCount?: number;
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
  branchRef?: string;
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

const MIN_PR_DESCRIPTION_CHARS = 50;
const MAX_PR_DESCRIPTION_CHARS = 500;

function sanitizePrBody(raw: string): string {
  const cleaned = raw
    .replace(/<!--[\s\S]*?-->/g, '')          // GitHub template comments
    .replace(/```[\s\S]*?```/gm, '')           // fenced code blocks
    .replace(/`[^`\n]+`/g, '')                 // inline code
    .replace(/^#{1,6}\s+/gm, '')               // header markers (keep text, strip ##)
    .replace(/^[-*]\s+\[[ x]\].*/gim, '')      // checklist items
    .replace(/https?:\/\/\S+/g, '')            // URLs
    .replace(/@\w+/g, '')                      // @ mentions
    .replace(/\n{3,}/g, '\n\n')               // collapse excess blank lines
    .trim()
    .slice(0, MAX_PR_DESCRIPTION_CHARS)
    .replace(/\s\S*$/, '')                     // trim to last word boundary
    .trim();

  return cleaned.length < MIN_PR_DESCRIPTION_CHARS ? '' : cleaned;
}

// Regex for low-value review feedback (quality noise — not design reasoning)
const REVIEW_NOISE_RE = /\b(sonar(qube|lint)?|lint|checkstyle|pmd|spotbugs|codeclimate|coverage|tests?\s+missing|nit[:\s]|nitpick|typo|formatting|rename|style\s+guide|code\s+style|trailing\s+space|unused\s+(import|variable))\b/i;
// Regex for high-value review feedback (design reasoning, operational implications)
const REVIEW_SIGNAL_RE = /\b(won'?t\s+(scale|work)|consider|instead\s+of|alternative|will\s+cause|assumption|edge\s+case|race\s+condition|concurrent|production|latency|memory\s+leak|thundering|deadlock|have\s+you\s+(thought|considered)|what\s+(about|if|happens))\b/i;

function hasNarrativeValue(body: string): boolean {
  if (body.trim().length < 20) return false;
  if (REVIEW_NOISE_RE.test(body)) return false;
  if (REVIEW_SIGNAL_RE.test(body)) return true;
  return body.trim().length >= 60;
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
  sha: string,
  branchRef: string | null,
  authorLogin: string,
): Promise<PrContext | undefined> {
  try {
    const prs = branchRef !== null
      ? await client.listPullsForRef(owner, repo, branchRef)
      : await client.listPullsForCommit(owner, repo, sha);

    if (prs.length === 0) return undefined;

    // Use the first PR found (most recent match to this ref/commit)
    const pr = prs[0]!;
    const { outcome, supersededEvidence } = detectOutcome(pr, authorLogin);

    const prDescription = sanitizePrBody(pr.body ?? '') || undefined;

    logger.debug('commit.pr_description', {
      sha,
      repo: `${owner}/${repo}`,
      prNumber: pr.number,
      hasDescription: !!prDescription,
      chars: prDescription?.length ?? 0,
      source: branchRef !== null ? 'branch_ref' : 'commit_sha',
    });

    const closingIssues: IssueRef[] = pr.closingIssues.map((issue) => ({
      number: issue.number,
      title: issue.title,
      bodySnippet: issue.bodySnippet,
      totalReactions: issue.totalReactions,
      totalComments: issue.totalComments,
    }));

    const reviewSummaries: ReviewSummary[] = pr.timelineItems
      .filter((item) =>
        item.itemType === 'pr_review' &&
        item.reviewState !== undefined &&
        hasNarrativeValue(item.body),
      )
      .map((item) => ({
        body: item.body.slice(0, 150).replace(/\s\S*$/, '').trim(),
        authorLogin: item.authorLogin,
        state: item.reviewState!,
      }));

    const changesRequestedCount = pr.timelineItems.filter(
      (item) => item.itemType === 'pr_review' && item.reviewState === 'CHANGES_REQUESTED',
    ).length;

    return {
      upstreamOwner: pr.upstreamOwner,
      upstreamRepo: pr.upstreamRepo,
      prNumber: pr.number,
      prUrl: pr.url,
      prTitle: pr.title,
      outcome,
      prDescription,
      closingIssues: closingIssues.length > 0 ? closingIssues : undefined,
      reviewSummaries: reviewSummaries.length > 0 ? reviewSummaries : undefined,
      changesRequestedCount: changesRequestedCount > 0 ? changesRequestedCount : undefined,
      timelineItemsCount: pr.timelineItems.length > 0 ? pr.timelineItems.length : undefined,
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

    if (branchRef) {
      const refBranch = branchRef.replace('refs/heads/', '');
      const isPushToNonDefaultBranch = refBranch !== repoMeta.defaultBranch;
      if (isPushToNonDefaultBranch) {
        // Feature branch push: look up PRs by branch ref (open or merged PR for this branch)
        prContext = await resolvePrContext(client, owner, repo, sha, branchRef, authorLogin);
      } else {
        // Direct push to default branch: look up PRs by commit SHA.
        // Handles squash-merges and merge commits where the PR body has context.
        prContext = await resolvePrContext(client, owner, repo, sha, null, authorLogin);
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
    branchRef,
    prContext,
  };
}
