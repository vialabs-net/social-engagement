import { Octokit } from '@octokit/rest';
import { withRetry, GITHUB_RETRY_POLICY } from '../utils/retry.js';

export class GitHubClient {
  private readonly octokit: Octokit;

  constructor(token: string) {
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

  async getCommit(owner: string, repo: string, sha: string): Promise<unknown> {
    return withRetry(async () => {
      const response = await this.octokit.repos.getCommit({ owner, repo, ref: sha });
      return response.data;
    }, GITHUB_RETRY_POLICY, `github.getCommit(${owner}/${repo}@${sha})`);
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
