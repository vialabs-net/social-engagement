import { logger } from '../utils/logger.js';
import type { GitHubClient } from './client.js';

export interface PushEvent {
  id: string;
  repo: string;       // 'owner/repo'
  commits: PushCommit[];
  pushedAt: string;
}

export interface PushCommit {
  sha: string;
  message: string;
  authorLogin: string;
}

interface EventsState {
  lastEventId: string | null;
  lastEtag: string | null;
}

interface RawEvent {
  id: string;
  type: string;
  actor: { login: string };
  repo: { name: string };
  payload: {
    before?: string;
    head?: string;
    ref?: string;
  };
  created_at: string;
}

/**
 * Polls GitHub's user events API and returns new PushEvents since the last run.
 * Uses ETag conditional requests — a 304 Not Modified costs 0 API rate-limit points.
 *
 * GitHub's Events API no longer includes commits in PushEvent payloads.
 * We use the Compare API (before...head) to fetch the actual commits.
 */
export async function pollNewPushEvents(
  client: GitHubClient,
  username: string,
  state: EventsState,
  maxCommitsPerPush = 1,
): Promise<{ events: PushEvent[]; newState: EventsState }> {
  const { events, newEtag, notModified } = await client.listUserEvents(
    username,
    state.lastEtag ?? undefined,
  );

  if (notModified) {
    logger.info('events.poll.not_modified', { username });
    return { events: [], newState: state };
  }

  const rawEvents = events as RawEvent[];
  const pushEvents = rawEvents.filter((e) => e.type === 'PushEvent');

  // Find new events since last seen
  const lastSeenIdx = state.lastEventId
    ? pushEvents.findIndex((e) => e.id === state.lastEventId)
    : pushEvents.length; // treat all as new if no state

  const newPushEvents = lastSeenIdx > 0 ? pushEvents.slice(0, lastSeenIdx) : pushEvents;

  logger.info('events.poll.result', {
    username,
    total: rawEvents.length,
    pushEvents: pushEvents.length,
    newEvents: newPushEvents.length,
  });

  const result: PushEvent[] = [];

  for (const e of newPushEvents) {
    const [owner, repo] = e.repo.name.split('/');
    if (!owner || !repo || !e.payload.before || !e.payload.head) continue;

    let commits: PushCommit[];
    try {
      const compared = await client.compareCommits(owner, repo, e.payload.before, e.payload.head);
      commits = compared.slice(0, maxCommitsPerPush).map((c) => ({
        sha: c.sha,
        message: c.message,
        authorLogin: e.actor.login,
      }));
    } catch (err) {
      logger.warn('events.poll.compare_failed', {
        repo: e.repo.name,
        error: String(err),
      });
      continue;
    }

    if (commits.length === 0) continue;

    result.push({
      id: e.id,
      repo: e.repo.name,
      commits,
      pushedAt: e.created_at,
    });
  }

  const newState: EventsState = {
    lastEventId: rawEvents[0]?.id ?? state.lastEventId,
    lastEtag: newEtag ?? state.lastEtag,
  };

  return { events: result, newState };
}
