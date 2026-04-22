/**
 * main-poll.ts — legacy single-tenant poll pipeline kept for manual/local debugging
 *
 * Flow: GitHub Events → filter → enrich → modules → Claude → Buffer
 */

import { loadConfig } from './config/loader.js';
import { logger } from './utils/logger.js';
import { isInteresting } from './utils/commit-filter.js';
import { GitHubClient } from './github/client.js';
import { pollNewPushEvents } from './github/events-poller.js';
import { enrichCommit, type EnrichedCommit } from './github/commit-enricher.js';
import { runPipeline } from './analysis/pipeline.js';
import type { Finding } from './analysis/types.js';
import { loadPlugins } from './analysis/plugin-loader.js';
import { MODULE_REGISTRY } from './analysis/modules/index.js';
import { createAIClient } from './ai/factory.js';
import { generatePosts } from './ai/post-generator.js';
import { BufferClient } from './buffer/client.js';
import { publishToBuffer } from './buffer/publisher.js';
import { notifyNewDraft } from './review/notifier.js';
import { SqliteStorage } from './voice/sqlite-storage.js';
import { SupabaseStorage } from './voice/supabase-storage.js';
import type { IVoiceStorage, VoicePost, VoiceStage } from './voice/storage.js';
import type { VoiceProfile } from './config/schema.js';
import { mergeVoiceProfile } from './voice/profile-utils.js';
import { buildChapterContext, buildVarietyConstraint } from './ai/prompt-builder.js';
import { computeVoiceStage } from './voice/stage.js';
import {
  buildModuleFireCounts,
  computeCandidateRankingScore,
  getStartOfDayIso,
  selectTopDailyCandidates,
  type RankedCommitCandidate,
} from './worker/daily-post-selection.js';

type TodayDraftState = Pick<VoicePost, 'created_at' | 'opening_move' | 'top_module_id'>;

interface PollAuthorState {
  readonly authorLogin: string | null;
  readonly voiceProfile: VoiceProfile;
  readonly hasBootstrap: boolean;
  uniquePublished: number;
  voiceStage: VoiceStage;
  todayDrafts: TodayDraftState[];
}

interface PollCommitCandidate extends RankedCommitCandidate {
  readonly commit: EnrichedCommit;
  readonly findings: Finding[];
  readonly authorKey: string;
  readonly authorLogin: string | null;
  readonly owner: string;
  readonly repoName: string;
  readonly voiceProfile: VoiceProfile;
}

async function main(): Promise<void> {
  const config = loadConfig();
  logger.info('poll.start', { username: config.author.github_username });

  const plugins = await loadPlugins(config.plugins);
  const modules = plugins.length > 0 ? [...MODULE_REGISTRY, ...plugins] : MODULE_REGISTRY;

  // Storage: Supabase in production (service_role key), SQLite locally
  // TENANT_ID env var required for Supabase (multi-tenant). Defaults to 'local' for SQLite.
  const tenantId = process.env['TENANT_ID'] ?? 'local';
  const storage: IVoiceStorage = process.env['SUPABASE_URL']
    ? new SupabaseStorage(process.env['SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '', tenantId)
    : new SqliteStorage(process.env['SQLITE_PATH'] ?? 'data/devcast.db', tenantId);

  const github = new GitHubClient(process.env['GITHUB_TOKEN'] ?? '');
  const anthropic = createAIClient('anthropic', process.env['ANTHROPIC_API_KEY'] ?? '', config.ai.model, config.ai.max_tokens);
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
  const recentModuleIds = await storage.getRecentModuleIds(30);
  const recentModuleFireCounts = buildModuleFireCounts(recentModuleIds);
  const dayStartIso = getStartOfDayIso(config.scheduling.timezone);
  const dailyLimit = config.posting.max_daily_posts_per_author;
  const authorStates = new Map<string, PollAuthorState>();
  const candidatesByAuthor = new Map<string, PollCommitCandidate[]>();

  const getAuthorState = async (authorLogin: string | null, commitSha: string): Promise<{
    authorKey: string;
    state: PollAuthorState;
  }> => {
    const authorKey = authorLogin ?? `unknown:${commitSha}`;
    const existing = authorStates.get(authorKey);
    if (existing) return { authorKey, state: existing };

    const storedVoiceProfile = await storage.getVoiceProfile(authorLogin);
    const voiceProfile = mergeVoiceProfile(storedVoiceProfile?.voice);
    const hasBootstrap = (voiceProfile.bootstrap_posts?.length ?? 0) > 0;
    const uniquePublished = authorLogin ? await storage.countUniquePublished(authorLogin) : 0;
    const voiceStage = computeVoiceStage(uniquePublished, hasBootstrap);
    const todayDrafts = authorLogin
      ? (await storage.getDraftsSince(authorLogin, dayStartIso)).map(toTodayDraftState)
      : [];

    const state: PollAuthorState = {
      authorLogin,
      voiceProfile,
      hasBootstrap,
      uniquePublished,
      voiceStage,
      todayDrafts,
    };
    authorStates.set(authorKey, state);
    return { authorKey, state };
  };

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

      const { authorKey, state: authorState } = await getAuthorState(commit.authorLogin ?? null, commit.sha);
      if (authorState.authorLogin && authorState.todayDrafts.length >= dailyLimit) {
        logger.info('poll.skip.daily_limit_reached', {
          sha: commit.sha,
          authorLogin: authorState.authorLogin,
          draftsToday: authorState.todayDrafts.length,
          dailyLimit,
        });
        continue;
      }

      const pipelineFindings = await runPipeline(
        {
          diffs: commit.diffs,
          commitMessage: commit.message,
          commitBody: commit.body,
          languages: commit.languages,
          repo: commit.repo,
          sha: commit.sha,
        },
        config.posting.analysis_top_n,
        modules,
        recentModuleIds,
      );

      if (pipelineFindings.length === 0) {
        logger.info('poll.skip.no_findings', { sha: commit.sha });
        continue;
      }

      const findings = pipelineFindings;
      const topModuleId = findings[0]?.moduleId ?? null;
      const topModuleFireCount = topModuleId ? (recentModuleFireCounts.get(topModuleId) ?? 0) : 0;
      const rankingScore = computeCandidateRankingScore(commit, findings, recentModuleFireCounts);
      const candidate: PollCommitCandidate = {
        commit,
        commitSha: commit.sha,
        committedAt: commit.committedAt,
        findings,
        findingsCount: findings.length,
        authorKey,
        authorLogin: authorState.authorLogin,
        owner,
        repoName: repo,
        voiceProfile: authorState.voiceProfile,
        topModuleId,
        topModuleFireCount,
        rankingScore,
        totalChangedLines: commit.totalAdditions + commit.totalDeletions,
      };

      const authorCandidates = candidatesByAuthor.get(authorKey) ?? [];
      authorCandidates.push(candidate);
      candidatesByAuthor.set(authorKey, authorCandidates);

      logger.info('poll.candidate', {
        sha: commit.sha,
        authorLogin: authorState.authorLogin,
        topModuleId,
        rankingScore,
        draftsToday: authorState.todayDrafts.length,
        dailyLimit,
      });
    }
  }

  for (const [authorKey, candidates] of candidatesByAuthor) {
    const authorState = authorStates.get(authorKey);
    if (!authorState) continue;

    while (authorState.todayDrafts.length < dailyLimit && candidates.length > 0) {
      const [candidate] = selectTopDailyCandidates(candidates, authorState.todayDrafts, 1);
      if (!candidate) break;

      const candidateIndex = candidates.findIndex((item) => item.commitSha === candidate.commitSha);
      if (candidateIndex >= 0) candidates.splice(candidateIndex, 1);

      try {
        const draftIndexToday = authorState.todayDrafts.length;
        const exposurePool = candidate.authorLogin && authorState.voiceStage !== 'cold'
          ? await storage.getPublishedForExposure(candidate.authorLogin, 'linkedin')
          : [];
        let chapterContext: string | undefined;
        if (candidate.topModuleId && candidate.topModuleFireCount >= 1) {
          const previousFindings = await storage.getRecentTopFindings(candidate.authorLogin, candidate.topModuleId, 2);
          if (previousFindings.length > 0) {
            chapterContext = buildChapterContext(
              candidate.topModuleId,
              previousFindings,
              candidate.topModuleFireCount + 1,
            );
          }
        }
        const todayFirstOpening = authorState.todayDrafts
          .find((draft) => draft.opening_move && draft.opening_move !== 'unknown')
          ?.opening_move ?? undefined;
        const varietyConstraint = authorState.voiceStage !== 'cold'
          ? buildVarietyConstraint(
              candidate.voiceProfile.recent_opening_sequence ?? [],
              draftIndexToday,
              todayFirstOpening,
            ) ?? undefined
          : undefined;

        const { bufferText, draftId, openingMove } = await generatePosts(
          anthropic,
          candidate.commit,
          candidate.findings,
          storage,
          config,
          {
            voiceProfile: candidate.voiceProfile,
            voiceStage: authorState.voiceStage,
            exposurePool,
            bootstrapPosts: candidate.voiceProfile.bootstrap_posts ?? [],
            recentModuleIds,
            chapterContext,
            draftMetadata: {
              author_login: candidate.authorLogin,
              generation_system: authorState.voiceStage === 'cold' ? 'v1' : 'v2_progressive',
            },
            draftIndexToday,
            varietyConstraint,
          },
        );

        authorState.todayDrafts.push({
          created_at: new Date().toISOString(),
          opening_move: openingMove,
          top_module_id: candidate.topModuleId ?? null,
        });

        const publishResult = await publishToBuffer(
          bufferClient,
          storage,
          config,
          draftId,
          bufferText,
          'linkedin',
          config.buffer.organization_id,
          candidate.commit.message,
        );

        if (publishResult) {
          await notifyNewDraft(github, candidate.owner, config.github.notification_repo, candidate.commit, [publishResult], process.env['APP_BASE_URL'] ?? '');
        }

        logger.info('poll.commit.done', { sha: candidate.commit.sha });
      } catch (err) {
        logger.error('poll.commit.error', { sha: candidate.commit.sha, error: String(err) });
      }
    }

    for (const candidate of candidates) {
      logger.info('poll.skip.daily_limit_ranked_out', {
        sha: candidate.commit.sha,
        authorLogin: candidate.authorLogin,
        rankingScore: candidate.rankingScore,
        topModuleId: candidate.topModuleId,
        draftsToday: authorState.todayDrafts.length,
        dailyLimit,
      });
    }
  }

  logger.info('poll.done');
}

main().catch(err => {
  logger.error('poll.fatal', { error: String(err) });
  process.exit(1);
});

function toTodayDraftState(post: Pick<VoicePost, 'created_at' | 'opening_move' | 'top_module_id'>): TodayDraftState {
  return {
    created_at: post.created_at,
    opening_move: post.opening_move ?? null,
    top_module_id: post.top_module_id ?? null,
  };
}
