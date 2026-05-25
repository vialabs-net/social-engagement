import { Octokit } from '@octokit/rest';
import { withRetry, GITHUB_RETRY_POLICY } from '../utils/retry.js';

export interface RepoMeta {
  readonly isPrivate: boolean;
  readonly isFork: boolean;
  readonly defaultBranch: string;
  readonly parentOwner?: string;
  readonly parentRepo?: string;
}

export interface ClosingIssue {
  readonly number: number;
  readonly title: string;
  readonly bodySnippet?: string;
  readonly totalReactions: number;
  readonly totalComments: number;
  readonly state: 'OPEN' | 'CLOSED';
}

export interface PrLookupResult {
  readonly number: number;
  readonly title: string;
  readonly state: 'OPEN' | 'CLOSED' | 'MERGED';
  readonly url: string;
  readonly upstreamOwner: string;
  readonly upstreamRepo: string;
  readonly body?: string | null;
  readonly timelineItems: ReadonlyArray<{
    readonly body: string;
    readonly authorLogin: string;
    readonly itemType: 'issue_comment' | 'pr_review';
    readonly reviewState?: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
  }>;
  readonly closingIssues: ReadonlyArray<ClosingIssue>;
}

// Module-level caches survive across GitHubClient instances in the same process.
// RepoMeta (fork flag + defaultBranch) is stable — TTL 7 days.
// PR lookup TTL depends on outcome: open states change, final states don't.
const repoMetaCache = new Map<string, { meta: RepoMeta; cachedAt: number }>();
const prLookupCache = new Map<string, { results: PrLookupResult[]; cachedAt: number }>();

const REPO_META_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PR_TTL_FINAL_MS  = 7 * 24 * 60 * 60 * 1000;  // merged / closed — immutable
const PR_TTL_OPEN_MS   = 12 * 60 * 60 * 1000;       // open — maintainer may merge
const PR_TTL_NONE_MS   = 1 * 60 * 60 * 1000;        // no PR found — branch may get one

function prLookupTtl(results: PrLookupResult[]): number {
  if (results.length === 0) return PR_TTL_NONE_MS;
  const hasOpen = results.some((pr) => pr.state === 'OPEN');
  return hasOpen ? PR_TTL_OPEN_MS : PR_TTL_FINAL_MS;
}

const PR_LOOKUP_GRAPHQL = `
query ListPullsForRef($owner: String!, $name: String!, $refName: String!) {
  repository(owner: $owner, name: $name) {
    ref(qualifiedName: $refName) {
      associatedPullRequests(states: [OPEN, CLOSED, MERGED], first: 5) {
        nodes {
          number
          title
          state
          url
          body
          baseRepository {
            owner { login }
            name
          }
          closingIssuesReferences(first: 3) {
            nodes {
              number
              title
              body
              state
              reactions  { totalCount }
              comments   { totalCount }
            }
          }
          timelineItems(itemTypes: [ISSUE_COMMENT, PULL_REQUEST_REVIEW], last: 20) {
            nodes {
              ... on IssueComment {
                body
                author { login }
              }
              ... on PullRequestReview {
                body
                state
                author { login }
              }
            }
          }
        }
      }
    }
  }
}`.trim();

const PR_LOOKUP_BY_COMMIT_GRAPHQL = `
query ListPullsForCommit($owner: String!, $name: String!, $sha: String!) {
  repository(owner: $owner, name: $name) {
    object(expression: $sha) {
      ... on Commit {
        associatedPullRequests(first: 5) {
          nodes {
            number
            title
            state
            url
            body
            baseRepository {
              owner { login }
              name
            }
            closingIssuesReferences(first: 3) {
              nodes {
                number
                title
                body
                state
                reactions  { totalCount }
                comments   { totalCount }
              }
            }
            timelineItems(itemTypes: [ISSUE_COMMENT, PULL_REQUEST_REVIEW], last: 20) {
              nodes {
                ... on IssueComment {
                  body
                  author { login }
                }
                ... on PullRequestReview {
                  body
                  state
                  author { login }
                }
              }
            }
          }
        }
      }
    }
  }
}`.trim();

interface GraphqlIssueNode {
  number: number;
  title: string;
  body?: string | null;
  state: 'OPEN' | 'CLOSED';
  reactions: { totalCount: number };
  comments: { totalCount: number };
}

interface GraphqlPrNode {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  url: string;
  body?: string | null;
  baseRepository: { owner: { login: string }; name: string } | null;
  closingIssuesReferences: { nodes: GraphqlIssueNode[] };
  timelineItems: {
    nodes: Array<{
      body?: string;
      state?: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
      author?: { login: string } | null;
    }>;
  };
}

const MIN_ISSUE_BODY_CHARS = 30;
const MAX_ISSUE_BODY_CHARS = 200;

function sanitizeIssueBody(raw: string): string {
  const cleaned = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/gm, '')
    .replace(/`[^`\n]+`/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+\[[ x]\].*/gim, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@\w+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_ISSUE_BODY_CHARS)
    .replace(/\s\S*$/, '')
    .trim();
  return cleaned.length < MIN_ISSUE_BODY_CHARS ? '' : cleaned;
}

function mapClosingIssues(nodes: GraphqlIssueNode[]): ClosingIssue[] {
  return nodes.map((n) => {
    const bodySnippet = n.body ? sanitizeIssueBody(n.body) || undefined : undefined;
    return {
      number: n.number,
      title: n.title,
      bodySnippet,
      totalReactions: n.reactions.totalCount,
      totalComments: n.comments.totalCount,
      state: n.state,
    };
  });
}

export class GitHubClient {
  private readonly octokit: Octokit;
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
    this.octokit = new Octokit({ auth: token });
  }

  async listUserEvents(
    username: string,
    etag?: string,
  ): Promise<{ events: unknown[]; newEtag: string | null; notModified: boolean }> {
    return withRetry(async () => {
      const headers: Record<string, string> = {};
      if (etag) headers['if-none-match'] = etag;

      try {
        const response = await this.octokit.request('GET /users/{username}/events', {
          username,
          per_page: 100,
          headers,
        });
        const newEtag = (response.headers as Record<string, string | undefined>)['etag'] ?? null;
        return { events: response.data as unknown[], newEtag, notModified: false };
      } catch (err) {
        const e = err as { status?: number };
        if (e.status === 304) {
          return { events: [], newEtag: null, notModified: true };
        }
        throw err;
      }
    }, GITHUB_RETRY_POLICY, 'github.listUserEvents');
  }

  async compareCommits(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<{ sha: string; message: string }[]> {
    return withRetry(async () => {
      const response = await this.octokit.repos.compareCommits({
        owner,
        repo,
        base,
        head,
      });
      return response.data.commits.map((c) => ({
        sha: c.sha,
        message: c.commit.message,
      }));
    }, GITHUB_RETRY_POLICY, `github.compareCommits(${owner}/${repo}@${base}...${head})`);
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<unknown> {
    return withRetry(async () => {
      const response = await this.octokit.repos.getCommit({ owner, repo, ref: sha });
      return response.data;
    }, GITHUB_RETRY_POLICY, `github.getCommit(${owner}/${repo}@${sha})`);
  }

  async getRepoMeta(owner: string, repo: string): Promise<RepoMeta> {
    const key = `${owner}/${repo}`;
    const cached = repoMetaCache.get(key);
    if (cached && Date.now() - cached.cachedAt < REPO_META_TTL_MS) {
      return cached.meta;
    }

    return withRetry(async () => {
      const response = await this.octokit.repos.get({ owner, repo });
      const data = response.data;
      const meta: RepoMeta = {
        isPrivate: data.private,
        isFork: data.fork,
        defaultBranch: data.default_branch,
        parentOwner: data.fork ? (data.parent?.owner?.login ?? undefined) : undefined,
        parentRepo: data.fork ? (data.parent?.name ?? undefined) : undefined,
      };
      repoMetaCache.set(key, { meta, cachedAt: Date.now() });
      return meta;
    }, GITHUB_RETRY_POLICY, `github.getRepoMeta(${owner}/${repo})`);
  }

  async listPullsForRef(
    forkOwner: string,
    forkRepo: string,
    branchRef: string,
  ): Promise<PrLookupResult[]> {
    const key = `${forkOwner}/${forkRepo}#${branchRef}`;
    const cached = prLookupCache.get(key);
    if (cached && Date.now() - cached.cachedAt < prLookupTtl(cached.results)) {
      return cached.results;
    }

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: PR_LOOKUP_GRAPHQL,
        variables: { owner: forkOwner, name: forkRepo, refName: branchRef },
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub GraphQL error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as {
      data?: { repository?: { ref?: { associatedPullRequests?: { nodes: GraphqlPrNode[] } } } };
      errors?: Array<{ message: string }>;
    };

    if (json.errors?.length) {
      throw new Error(`GitHub GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`);
    }

    const nodes = json.data?.repository?.ref?.associatedPullRequests?.nodes ?? [];
    const results: PrLookupResult[] = nodes
      .filter((node) => node.baseRepository !== null)
      .map((node) => ({
        number: node.number,
        title: node.title,
        state: node.state,
        url: node.url,
        body: node.body ?? null,
        upstreamOwner: node.baseRepository!.owner.login,
        upstreamRepo: node.baseRepository!.name,
        closingIssues: mapClosingIssues(node.closingIssuesReferences.nodes),
        timelineItems: node.timelineItems.nodes
          .filter((item) => item.body !== undefined)
          .map((item) => ({
            body: item.body!,
            authorLogin: item.author?.login ?? '',
            itemType: (item.state !== undefined ? 'pr_review' : 'issue_comment') as 'issue_comment' | 'pr_review',
            reviewState: item.state,
          })),
      }));

    prLookupCache.set(key, { results, cachedAt: Date.now() });
    return results;
  }

  async listPullsForCommit(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<PrLookupResult[]> {
    const key = `commit:${owner}/${repo}@${sha}`;
    const cached = prLookupCache.get(key);
    if (cached && Date.now() - cached.cachedAt < PR_TTL_FINAL_MS) {
      return cached.results;
    }

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: PR_LOOKUP_BY_COMMIT_GRAPHQL,
        variables: { owner, name: repo, sha },
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub GraphQL error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as {
      data?: { repository?: { object?: { associatedPullRequests?: { nodes: GraphqlPrNode[] } } } };
      errors?: Array<{ message: string }>;
    };

    if (json.errors?.length) {
      throw new Error(`GitHub GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`);
    }

    const nodes = json.data?.repository?.object?.associatedPullRequests?.nodes ?? [];
    const results: PrLookupResult[] = nodes
      .filter((node) => node.baseRepository !== null)
      .map((node) => ({
        number: node.number,
        title: node.title,
        state: node.state,
        url: node.url,
        body: node.body ?? null,
        upstreamOwner: node.baseRepository!.owner.login,
        upstreamRepo: node.baseRepository!.name,
        closingIssues: mapClosingIssues(node.closingIssuesReferences.nodes),
        timelineItems: node.timelineItems.nodes
          .filter((item) => item.body !== undefined)
          .map((item) => ({
            body: item.body!,
            authorLogin: item.author?.login ?? '',
            itemType: (item.state !== undefined ? 'pr_review' : 'issue_comment') as 'issue_comment' | 'pr_review',
            reviewState: item.state,
          })),
      }));

    prLookupCache.set(key, { results, cachedAt: Date.now() });
    return results;
  }

  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
  ): Promise<{ number: number; url: string }> {
    const response = await this.octokit.issues.create({ owner, repo, title, body });
    return { number: response.data.number, url: response.data.html_url };
  }

  async closeIssue(owner: string, repo: string, issueNumber: number): Promise<void> {
    await this.octokit.issues.update({ owner, repo, issue_number: issueNumber, state: 'closed' });
  }

  async createIssueComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
  ): Promise<void> {
    await this.octokit.issues.createComment({ owner, repo, issue_number: issueNumber, body });
  }
}

export class RepoNotFoundError extends Error {
  constructor(repo: string) {
    super(`Repository not found: ${repo}`);
    this.name = 'RepoNotFoundError';
  }
}
