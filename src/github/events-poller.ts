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
  repo: { name: string };
  payload: {
    commits?: Array<{ sha: string; message: string; author?: { username?: string } }>;
    head_commit?: { author?: { username?: string } };
  };
  created_at: string;
}

/**
 * Polls GitHub's user events API and returns new PushEvents since the last run.
 * Uses ETag conditional requests — a 304 Not Modified costs 0 API rate-limit points.
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
  const pushEvents = rawEvents.filter(e => e.type === 'PushEvent');

  // Find new events since last seen
  const lastSeenIdx = state.lastEventId
    ? pushEvents.findIndex(e => e.id === state.lastEventId)
    : pushEvents.length; // treat all as new if no state

  const newPushEvents = lastSeenIdx > 0 ? pushEvents.slice(0, lastSeenIdx) : pushEvents;

  logger.info('events.poll.result', {
    username,
    total: rawEvents.length,
    pushEvents: pushEvents.length,
    newEvents: newPushEvents.length,
  });

  const result: PushEvent[] = newPushEvents.map(e => {
    const commits = (e.payload.commits ?? []).slice(0, maxCommitsPerPush).map(c => ({
      sha: c.sha,
      message: c.message,
      authorLogin: c.author?.username ?? username,
    }));

    return {
      id: e.id,
      repo: e.repo.name,
      commits,
      pushedAt: e.created_at,
    };
  });

  const newState: EventsState = {
    lastEventId: rawEvents[0]?.id ?? state.lastEventId,
    lastEtag: newEtag ?? state.lastEtag,
  };

  return { events: result, newState };
}
