import { logger } from '../utils/logger.js';
import type { GitHubClient } from '../github/client.js';
import type { PublishResult } from '../buffer/publisher.js';
import type { EnrichedCommit } from '../github/commit-enricher.js';

/**
 * Opens a GitHub Issue as a notification-only FYI.
 * No /approve mechanic — Liliana reviews and publishes directly from Buffer.
 *
 * The issue auto-closes after 48 hours via a comment (the workflow runs this
 * function, then a separate step closes old issues via the GitHub API).
 */
export async function notifyNewDraft(
  client: GitHubClient,
  owner: string,
  notificationRepo: string,
  commit: EnrichedCommit,
  results: PublishResult[],
): Promise<void> {
  if (results.length === 0) return;

  const [repoOwner, repoName] = commit.repo.split('/');
  const commitUrl = `https://github.com/${commit.repo}/commit/${commit.sha}`;

  const platformLines = results.map(r =>
    `- **${r.platform}**: Buffer Idea ID \`${r.bufferIdeaId}\``,
  );

  const body = `## New draft in Buffer Ideas

Commit: [\`${commit.sha.slice(0, 7)}\`](${commitUrl}) in \`${commit.repo}\`
Message: _${commit.message}_

### Ideas created
${platformLines.join('\n')}

---
Review in [Buffer Ideas](https://publish.buffer.com/ideas), convert to a post, and schedule.
No action required here.

_This issue will auto-close in 48 hours._`;

  try {
    const { number, url } = await client.createIssue(
      owner,
      notificationRepo,
      `[devcast] New draft: ${commit.message.slice(0, 60)}`,
      body,
    );
    logger.info('notifier.issue_created', { number, url });
  } catch (err) {
    // Notification failure is non-fatal — the draft is already in Buffer
    logger.warn('notifier.issue_failed', { error: String(err) });
  }
}
