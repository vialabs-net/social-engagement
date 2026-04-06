import type { SupabaseClient } from '@supabase/supabase-js';
import { GitHubClient } from '../github/client.js';
import { LinkedInClient, LinkedInAuthExpiredError } from '../linkedin/client.js';
import { enrichCommit } from '../github/commit-enricher.js';
import { isInteresting } from '../utils/commit-filter.js';
import { runPipeline } from '../analysis/pipeline.js';
import { MODULE_REGISTRY } from '../analysis/modules/index.js';
import { AnthropicClient } from '../ai/client.js';
import { generatePosts } from '../ai/post-generator.js';
import { BufferClient } from '../buffer/client.js';
import { publishToBuffer } from '../buffer/publisher.js';
import { notifyNewDraft } from '../review/notifier.js';
import { SupabaseStorage } from '../voice/supabase-storage.js';
import { getInstallationToken } from './github-app-auth.js';
import { logger } from '../utils/logger.js';
import { ConfigSchema } from '../config/schema.js';
import type { Config } from '../config/schema.js';

interface TenantRow {
  readonly id: string;
  readonly github_installation_id: number;
  readonly github_username: string;
  readonly buffer_access_token: string | null;
  readonly linkedin_access_token: string | null;
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
    .select('id, github_installation_id, github_username, buffer_access_token, linkedin_access_token, linkedin_member_id, config')
    .eq('id', job.tenant_id)
    .single();

  if (tenantError || !tenantData) {
    throw new Error(`Tenant ${job.tenant_id} not found: ${tenantError?.message ?? 'no data'}`);
  }
  const tenant = tenantData as TenantRow;
  const config = buildConfig(tenant);

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
  const anthropic = new AnthropicClient(
    deps.anthropicApiKey,
    config.ai.model,
    config.ai.max_tokens,
  );
  const storage = new SupabaseStorage(deps.supabaseUrl, deps.supabaseServiceKey, tenant.id);

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
      const findings = await runPipeline(
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

      if (findings.length === 0) {
        logger.info('worker.commit.skip.no_findings', { sha: commit.sha });
        continue;
      }

      const { linkedinPost, bufferText, draftId } = await generatePosts(anthropic, commit, findings, storage, config, recentModuleIds);

      // Post directly to LinkedIn if connected
      if (tenant.linkedin_access_token && tenant.linkedin_member_id) {
        try {
          const linkedinClient = new LinkedInClient(tenant.linkedin_access_token);
          await linkedinClient.post(tenant.linkedin_member_id, linkedinPost);
          await storage.updatePublished({
            id: draftId,
            published: linkedinPost,
            edit_ratio: 1.0,
            published_at: new Date().toISOString(),
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
      if (tenant.buffer_access_token) {
        const bufferClient = new BufferClient(tenant.buffer_access_token);
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
