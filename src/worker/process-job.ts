import type { SupabaseClient } from '@supabase/supabase-js';
import { GitHubClient } from '../github/client.js';
import { LinkedInClient, LinkedInAuthExpiredError } from '../linkedin/client.js';
import { enrichCommit } from '../github/commit-enricher.js';
import { isInteresting } from '../utils/commit-filter.js';
import { runPipeline } from '../analysis/pipeline.js';
import { MODULE_REGISTRY } from '../analysis/modules/index.js';
import { createAIClient, createEmbedder } from '../ai/factory.js';
import { generatePosts } from '../ai/post-generator.js';
import { buildChapterContext, buildVarietyConstraint } from '../ai/prompt-builder.js';
import { matchFindingsToArticles } from '../content/matcher.js';
import { BufferClient } from '../buffer/client.js';
import { publishToBuffer } from '../buffer/publisher.js';
import { notifyNewDraft } from '../review/notifier.js';
import { SupabaseStorage } from '../voice/supabase-storage.js';
import { getInstallationToken } from './github-app-auth.js';
import { logger } from '../utils/logger.js';
import { ConfigSchema } from '../config/schema.js';
import type { Config } from '../config/schema.js';
import type { SaveDraftInput } from '../voice/storage.js';
import { resolveTenantSecrets } from '../security/tenant-secrets.js';
import { filterFindingsByContentStrategy, matchesSkipPatterns, mergeVoiceProfile } from '../voice/profile-utils.js';
import { computeVoiceStage } from '../voice/stage.js';

interface TenantRow {
  readonly id: string;
  readonly github_installation_id: number;
  readonly github_username: string;
  readonly buffer_access_token: string | null;
  readonly linkedin_access_token: string | null;
  readonly encrypted_dek: string | null;
  readonly linkedin_member_id: string | null;
  readonly config: Record<string, unknown>;
}

interface JobRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly repo: string;
  readonly before_sha: string;
  readonly after_sha: string;
  readonly ref: string;
}

export interface ProcessJobDeps {
  readonly db: SupabaseClient;
  readonly appId: string;
  readonly privateKey: string;
  readonly supabaseUrl: string;
  readonly supabaseServiceKey: string;
  readonly anthropicApiKey: string;
  readonly openaiApiKey?: string;
}

/**
 * Builds a Config from a tenant row + its config JSONB.
 * Uses 'UNCONFIGURED' as placeholder for buffer.organization_id when absent
 * so Zod's min(1) constraint is satisfied — the caller checks
 * buffer_access_token before attempting to publish.
 */
function buildConfig(tenant: TenantRow): Config {
  const tc = tenant.config;
  const result = ConfigSchema.safeParse({
    github: { exclude_repos: [], exclude_patterns: [] },
    scheduling: {},
    posting: {},
    ai: {},
    buffer: { organization_id: 'UNCONFIGURED' },
    platforms: {
      linkedin: { enabled: true, buffer_profile_id: '' },
      instagram: { enabled: false, buffer_profile_id: '' },
    },
    ...tc,
    // author.github_username always comes from the tenants table, not JSONB
    author: {
      name: tenant.github_username,
      ...((tc['author'] as Record<string, unknown> | undefined) ?? {}),
      github_username: tenant.github_username,
    },
  });

  if (!result.success) {
    throw new Error(`Invalid config for tenant ${tenant.id}: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Processes a single job end-to-end:
 * 1. Fetch job + tenant from DB
 * 2. Get GitHub installation token
 * 3. Compare commits in the push range
 * 4. For each commit: filter → enrich → modules → Claude → Buffer
 */
export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<void> {
  logger.info('worker.job.start', { jobId });

  const { data: jobData, error: jobError } = await deps.db
    .from('job_queue')
    .select('id, tenant_id, repo, before_sha, after_sha, ref')
    .eq('id', jobId)
    .single();

  if (jobError || !jobData) {
    throw new Error(`Job ${jobId} not found: ${jobError?.message ?? 'no data'}`);
  }
  const job = jobData as JobRow;

  const { data: tenantData, error: tenantError } = await deps.db
    .from('tenants')
    .select('id, github_installation_id, github_username, buffer_access_token, linkedin_access_token, encrypted_dek, linkedin_member_id, config')
    .eq('id', job.tenant_id)
    .eq('active', true)
    .single();

  if (tenantError || !tenantData) {
    throw new Error(`Tenant ${job.tenant_id} not found or inactive: ${tenantError?.message ?? 'no data'}`);
  }
  const tenant = tenantData as TenantRow;
  const config = buildConfig(tenant);
  const secrets = await resolveTenantSecrets(tenant);

  logger.info('worker.job.tenant', {
    jobId,
    tenant: tenant.github_username,
    repo: job.repo,
    ref: job.ref,
  });

  // Installation token is valid for 1 hour — enough for one job
  const installationToken = await getInstallationToken(
    deps.appId,
    deps.privateKey,
    tenant.github_installation_id,
  );

  const github = new GitHubClient(installationToken);
  const anthropic = createAIClient('anthropic', deps.anthropicApiKey, config.ai.model, config.ai.max_tokens);
  const storage = new SupabaseStorage(deps.supabaseUrl, deps.supabaseServiceKey, tenant.id);
  const embedder = deps.openaiApiKey
    ? createEmbedder(config.embeddings.provider, deps.openaiApiKey, config.embeddings.model)
    : null;

  const [owner, repo] = job.repo.split('/') as [string, string];

  // Get the list of commits in this push range
  const commits = await github.compareCommits(owner, repo, job.before_sha, job.after_sha);
  logger.info('worker.job.commits', { jobId, count: commits.length });

  for (const pushCommit of commits) {
    logger.info('worker.commit.start', { sha: pushCommit.sha, repo: job.repo });

    try {
      const alreadyProcessed = await storage.hasDraft(pushCommit.sha, 'linkedin');
      if (alreadyProcessed) {
        logger.info('worker.commit.skip.duplicate', { sha: pushCommit.sha });
        continue;
      }

      const commit = await enrichCommit(github, owner, repo, pushCommit.sha, tenant.github_username);

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
        logger.info('worker.commit.skip.not_interesting', {
          sha: commit.sha,
          reason: filterResult.reason,
        });
        continue;
      }

      const recentModuleIds = await storage.getRecentModuleIds(30);
      const pipelineFindings = await runPipeline(
        {
          diffs: commit.diffs,
          commitMessage: commit.message,
          languages: commit.languages,
          repo: commit.repo,
          sha: commit.sha,
        },
        config.posting.analysis_top_n,
        MODULE_REGISTRY,
        recentModuleIds,
      );

      if (pipelineFindings.length === 0) {
        logger.info('worker.commit.skip.no_findings', { sha: commit.sha });
        continue;
      }

      const storedVoiceProfile = await storage.getVoiceProfile(commit.authorLogin ?? null);
      const voiceProfile = mergeVoiceProfile(storedVoiceProfile?.voice);
      const authorLogin = commit.authorLogin ?? null;
      const uniquePublished = authorLogin ? await storage.countUniquePublished(authorLogin) : 0;
      const hasBootstrap = (voiceProfile.bootstrap_posts?.length ?? 0) > 0;
      const voiceStage = computeVoiceStage(uniquePublished, hasBootstrap);
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const todayStartIso = startOfDay.toISOString();
      const draftsToday = authorLogin ? await storage.countDraftsSince(authorLogin, todayStartIso) : 0;
      const findings = filterFindingsByContentStrategy(pipelineFindings, voiceProfile);

      if (findings.length === 0) {
        logger.info('worker.commit.skip.no_findings_after_strategy', {
          sha: commit.sha,
          focus_modules: voiceProfile.content_strategy.focus_modules ?? [],
        });
        continue;
      }

      const skipPattern = matchesSkipPatterns(commit, findings, voiceProfile);
      if (skipPattern) {
        logger.info('worker.commit.skip.content_strategy', { sha: commit.sha, skipPattern });
        continue;
      }

      const fireCounts = new Map<string, number>();
      for (const moduleId of recentModuleIds) {
        fireCounts.set(moduleId, (fireCounts.get(moduleId) ?? 0) + 1);
      }
      const topModuleId = findings[0]?.moduleId;
      const topModuleFireCount = topModuleId ? (fireCounts.get(topModuleId) ?? 0) : 0;

      if (topModuleFireCount >= 2 && draftsToday > 0) {
        logger.info('worker.commit.skip.module_saturation', {
          sha: commit.sha,
          module: topModuleId,
          fireCount: topModuleFireCount,
          draftIndexToday: draftsToday,
        });
        continue;
      }

      let chapterContext: string | undefined;
      if (topModuleId && topModuleFireCount >= 1) {
        const previousFindings = await storage.getRecentTopFindings(authorLogin, topModuleId, 2);
        if (previousFindings.length > 0) {
          chapterContext = buildChapterContext(topModuleId, previousFindings, topModuleFireCount + 1);
        }
      }

      let exposurePool: Awaited<ReturnType<SupabaseStorage['getPublishedForExposure']>> = [];
      if (authorLogin && voiceStage !== 'cold') {
        const poolIds = voiceProfile.voice_examples_pool?.['linkedin'];
        if (poolIds?.length) {
          const { data, error } = await deps.db
            .from('voice_posts')
            .select('*')
            .in('id', poolIds);
          if (!error) exposurePool = (data ?? []) as typeof exposurePool;
        }
        if (exposurePool.length === 0) {
          exposurePool = await storage.getPublishedForExposure(authorLogin, 'linkedin');
        }
      }

      let todayFirstOpeningMove: string | undefined;
      if (authorLogin && draftsToday > 0) {
        const { data } = await deps.db
          .from('voice_posts')
          .select('opening_move')
          .eq('tenant_id', tenant.id)
          .eq('author_login', authorLogin)
          .gte('created_at', todayStartIso)
          .not('opening_move', 'is', null)
          .order('created_at', { ascending: true })
          .limit(1);
        todayFirstOpeningMove = (data?.[0] as { opening_move?: string } | undefined)?.opening_move;
      }

      const varietyConstraint = voiceStage !== 'cold'
        ? buildVarietyConstraint(voiceProfile.recent_opening_sequence ?? [], draftsToday, todayFirstOpeningMove) ?? undefined
        : undefined;

      // Content matching — inject industry context when a strong match is found.
      // Graceful degradation: any failure skips context, post generated normally.
      let industryContext: string | undefined;
      let draftMetadata: Partial<SaveDraftInput> = {
        author_login: authorLogin,
        generation_system: voiceStage === 'cold' ? 'v1' : 'v2_progressive',
      };
      if (embedder) {
        const contextPreference = voiceProfile.content_preferences?.industry_context_preference ?? 'neutral';
        const shouldSkipContext = contextPreference === 'avoid'
          && !(await shouldProbeContext(storage, authorLogin));

        if (shouldSkipContext) {
          draftMetadata = {
            ...draftMetadata,
            context_status: 'skipped',
            has_industry_context: false,
            matched_article_id: null,
            matched_source_id: null,
            match_strength: null,
            match_connection: null,
          };
          logger.info('content.match.skipped_by_preference', { sha: commit.sha, author: commit.authorLogin });
        } else {
          try {
            const similarityThreshold = contextPreference === 'prefer' ? 0.72 : 0.75;
            const match = await matchFindingsToArticles(findings, embedder, anthropic, deps.db, {
              similarityThreshold,
            });
            if (match) {
              industryContext = `Connection: ${match.connection}`;
              draftMetadata = {
                ...draftMetadata,
                context_status: 'matched',
                has_industry_context: true,
                matched_article_id: match.articleId,
                matched_source_id: match.sourceId,
                match_strength: match.matchStrength,
                match_connection: match.connection,
              };
              logger.info('content.match.injected', { sha: commit.sha, article: match.articleTitle });
            } else {
              draftMetadata = {
                ...draftMetadata,
                context_status: 'no_match',
                has_industry_context: false,
                matched_article_id: null,
                matched_source_id: null,
                match_strength: null,
                match_connection: null,
              };
            }
          } catch (err) {
            logger.warn('content.match.skipped', { sha: commit.sha, error: String(err) });
          }
        }
      } else {
        logger.info('content.match.skipped', { sha: commit.sha, reason: 'no_embedder' });
      }

      const { linkedinPost, bufferText, draftId } = await generatePosts(
        anthropic,
        commit,
        findings,
        storage,
        config,
        {
          voiceProfile,
          voiceStage,
          exposurePool,
          bootstrapPosts: voiceProfile.bootstrap_posts ?? [],
          recentModuleIds,
          chapterContext,
          industryContext,
          draftMetadata,
          draftIndexToday: draftsToday,
          varietyConstraint,
        },
      );

      // Post directly to LinkedIn if connected
      if (secrets.linkedinAccessToken && tenant.linkedin_member_id) {
        try {
          const linkedinClient = new LinkedInClient(secrets.linkedinAccessToken);
          await linkedinClient.post(tenant.linkedin_member_id, linkedinPost);
          await storage.updatePublished({
            id: draftId,
            published: linkedinPost,
            edit_ratio: 1.0,
            published_at: new Date().toISOString(),
            publish_source: 'linkedin_direct',
          });
          logger.info('worker.commit.linkedin_posted', { sha: commit.sha });
        } catch (err) {
          if (err instanceof LinkedInAuthExpiredError) {
            logger.warn('worker.commit.linkedin_expired', { sha: commit.sha });
          } else {
            logger.error('worker.commit.linkedin_error', { sha: commit.sha, error: String(err) });
          }
        }
      } else {
        logger.info('worker.commit.linkedin_skipped', { sha: commit.sha, reason: 'no linkedin token' });
      }

      // Create Buffer Idea if configured (for Instagram or as backup)
      if (secrets.bufferAccessToken) {
        const bufferClient = new BufferClient(secrets.bufferAccessToken);
        const publishResult = await publishToBuffer(
          bufferClient, storage, config, draftId, bufferText, commit.message,
        );
        if (publishResult) {
          await notifyNewDraft(github, owner, repo, commit, [publishResult]);
        }
      } else {
        logger.info('worker.commit.buffer_skipped', { sha: commit.sha, reason: 'no buffer token' });
      }

      logger.info('worker.commit.done', { sha: commit.sha });
    } catch (err) {
      // Per-commit errors are logged but don't abort the whole job
      logger.error('worker.commit.error', { sha: pushCommit.sha, error: String(err) });
    }
  }

  logger.info('worker.job.done', { jobId });
}

async function shouldProbeContext(storage: SupabaseStorage, authorLogin: string | null): Promise<boolean> {
  if (!authorLogin) return false;
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const draftsToday = await storage.countDraftsSince(authorLogin, startOfDay.toISOString());
  return draftsToday > 0 && draftsToday % 5 === 4;
}
