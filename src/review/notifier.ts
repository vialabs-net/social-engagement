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
const REJECTION_REASONS = ['hook', 'tone', 'too-technical', 'too-long', 'off-topic', 'factual'] as const;
export type RejectionReason = typeof REJECTION_REASONS[number];
export const VALID_REJECTION_REASONS: ReadonlySet<string> = new Set(REJECTION_REASONS);

const REASON_LABELS: Record<RejectionReason, string> = {
  'hook': 'hook fallido',
  'tone': 'tono',
  'too-technical': 'muy técnico',
  'too-long': 'muy largo',
  'off-topic': 'fuera de tema',
  'factual': 'dato incorrecto',
};

export async function notifyNewDraft(
  client: GitHubClient,
  owner: string,
  notificationRepo: string | undefined,
  commit: EnrichedCommit,
  results: PublishResult[],
  appBaseUrl: string,
): Promise<void> {
  if (results.length === 0) return;

  const inboxRepo = notificationRepo?.trim();
  if (!inboxRepo) {
    logger.info('notifier.skipped', { reason: 'no_inbox_configured', sha: commit.sha });
    return;
  }

  const commitUrl = `https://github.com/${commit.repo}/commit/${commit.sha}`;

  const ideaLines = results.map((r) => {
    const feedbackLinks = REJECTION_REASONS
      .map((reason) => `[${REASON_LABELS[reason]}](${appBaseUrl}/feedback?id=${r.draftId}&reason=${reason})`)
      .join(' · ');
    return `- Buffer Idea \`${r.bufferIdeaId}\` — rechazar: ${feedbackLinks}`;
  });

  const body = `## New draft in Buffer Ideas

Commit: [\`${commit.sha.slice(0, 7)}\`](${commitUrl}) in \`${commit.repo}\`
Message: _${commit.message}_

### Idea created
${ideaLines.join('\n')}

---
Review in [Buffer Ideas](https://publish.buffer.com/ideas), convert to a post, and schedule.
No action required here — feedback links above are optional.

_This issue will auto-close in 48 hours._`;

  try {
    const { number, url } = await client.createIssue(
      owner,
      inboxRepo,
      `[devcast] New draft: ${commit.message.slice(0, 60)}`,
      body,
    );
    logger.info('notifier.issue_created', { number, url });
  } catch (err) {
    // Notification failure is non-fatal — the draft is already in Buffer
    logger.warn('notifier.issue_failed', { error: String(err) });
  }
}
