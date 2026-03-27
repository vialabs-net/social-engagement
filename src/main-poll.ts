/**
 * main-poll.ts — runs on the poll-and-generate cron (every 4h)
 *
 * Flow: GitHub Events → filter → enrich → modules → Claude → Buffer
 */

import { loadConfig } from './config/loader.js';
import { logger } from './utils/logger.js';
import { isInteresting } from './utils/commit-filter.js';
import { GitHubClient } from './github/client.js';
import { pollNewPushEvents } from './github/events-poller.js';
import { enrichCommit } from './github/commit-enricher.js';
import { runPipeline } from './analysis/pipeline.js';
import { AnthropicClient } from './ai/client.js';
import { generatePosts } from './ai/post-generator.js';
import { BufferClient } from './buffer/client.js';
import { publishToBuffer } from './buffer/publisher.js';
import { notifyNewDraft } from './review/notifier.js';
import { SqliteStorage } from './voice/sqlite-storage.js';
import { SupabaseStorage } from './voice/supabase-storage.js';
import type { IVoiceStorage } from './voice/storage.js';

async function main(): Promise<void> {
  const config = loadConfig();
  logger.info('poll.start', { username: config.author.github_username });

  // Storage: Supabase in production (service_role key), SQLite locally
  const storage: IVoiceStorage = process.env['SUPABASE_URL']
    ? new SupabaseStorage(process.env['SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '')
    : new SqliteStorage(process.env['SQLITE_PATH'] ?? 'data/devcast.db');

  const github = new GitHubClient(process.env['GITHUB_TOKEN'] ?? '');
  const anthropic = new AnthropicClient(
    process.env['ANTHROPIC_API_KEY'] ?? '',
    config.ai.model,
    config.ai.max_tokens,
  );
  const bufferClient = new BufferClient(process.env['BUFFER_ACCESS_TOKEN'] ?? '');

  // Load events state from storage (SQLite only — Supabase handled separately)
  const sqliteStorage = storage instanceof SqliteStorage ? storage : null;
  const eventsState = sqliteStorage?.getEventsState(config.author.github_username) ?? {
    last_event_id: null,
    last_event_etag: null,
  };

  const { events, newState } = await pollNewPushEvents(
    github,
    config.author.github_username,
    { lastEventId: eventsState.last_event_id, lastEtag: eventsState.last_event_etag },
    config.github.max_commits_per_push,
  );

  // Persist new events state
  sqliteStorage?.setEventsState(
    config.author.github_username,
    newState.lastEventId ?? eventsState.last_event_id ?? '',
    newState.lastEtag ?? null,
  );

  logger.info('poll.events_found', { count: events.length });

  for (const pushEvent of events) {
    const [owner, repo] = pushEvent.repo.split('/');
    if (!owner || !repo) continue;

    for (const pushCommit of pushEvent.commits) {
      logger.info('poll.processing_commit', { sha: pushCommit.sha, repo: pushEvent.repo });

      // Check for duplicate
      const alreadyProcessed = await storage.hasDraft(pushCommit.sha, 'linkedin');
      if (alreadyProcessed) {
        logger.info('poll.skip.duplicate', { sha: pushCommit.sha });
        continue;
      }

      // Enrich commit
      const commit = await enrichCommit(github, owner, repo, pushCommit.sha, pushCommit.authorLogin);

      // Rule-based filter — zero API cost
      const filterResult = isInteresting(
        {
          sha: commit.sha,
          message: commit.message,
          authorLogin: commit.authorLogin,
          totalAdditions: commit.totalAdditions,
          totalDeletions: commit.totalDeletions,
          repo: commit.repo,
        },
        {
          excludeRepos: config.github.exclude_repos,
          excludePatterns: config.github.exclude_patterns,
          minChangedLines: config.posting.interesting_min_lines,
        },
      );

      if (!filterResult.interesting) {
        logger.info('poll.skip.not_interesting', { sha: commit.sha, reason: filterResult.reason });
        continue;
      }

      // Run analysis modules
      const findings = await runPipeline(
        { diffs: commit.diffs, commitMessage: commit.message, languages: commit.languages, repo: commit.repo, sha: commit.sha },
        config.posting.analysis_top_n,
      );

      if (findings.length === 0) {
        logger.info('poll.skip.no_findings', { sha: commit.sha });
        continue;
      }

      // Generate post (ONE Claude call — returns full post + Twitter short variant)
      const { bufferText, draftId } = await generatePosts(
        anthropic, commit, findings, storage, config,
      );

      // Publish ONE Buffer Idea with both variants in the text
      const publishResult = await publishToBuffer(bufferClient, storage, config, draftId, bufferText, commit.message);

      // Notification issue (non-fatal)
      if (publishResult) {
        await notifyNewDraft(github, owner, repo, commit, [publishResult]);
      }
    }
  }

  logger.info('poll.done');
}

main().catch(err => {
  logger.error('poll.fatal', { error: String(err) });
  process.exit(1);
});
