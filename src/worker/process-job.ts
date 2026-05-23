import type { SupabaseClient } from '@supabase/supabase-js';
import { GitHubClient } from '../github/client.js';
import { LinkedInClient, LinkedInAuthExpiredError } from '../linkedin/client.js';
import { enrichCommit, type EnrichedCommit } from '../github/commit-enricher.js';
import { isInteresting } from '../utils/commit-filter.js';
import { detectCommitIntent, computeCollaborationWeight } from '../utils/commit-classifier.js';
import { selectDevelopmentalAngle, buildAngleBlock, type ArcType } from '../ai/developmental-editor.js';
import { runPipeline } from '../analysis/pipeline.js';
import type { Finding } from '../analysis/types.js';
import { MODULE_REGISTRY } from '../analysis/modules/index.js';
import { createAIClient, createEmbedder } from '../ai/factory.js';
import { generatePosts } from '../ai/post-generator.js';
import { buildChapterContext, buildIndustryContextBlock, buildVarietyConstraint } from '../ai/prompt-builder.js';
import { matchFindingsToArticles } from '../content/matcher.js';
import { BufferClient } from '../buffer/client.js';
import { publishToBuffer } from '../buffer/publisher.js';
import { notifyNewDraft } from '../review/notifier.js';
import { SupabaseStorage } from '../voice/supabase-storage.js';
import { getInstallationToken } from './github-app-auth.js';
import { logger } from '../utils/logger.js';
import { bestEffort } from '../utils/best-effort.js';
import { ConfigSchema } from '../config/schema.js';
import type { BootstrapPost, Config, VoiceProfile } from '../config/schema.js';
import type { IVoiceStorage, SaveDraftInput, VoicePost, VoiceStage } from '../voice/storage.js';
import { resolveTenantSecrets } from '../security/tenant-secrets.js';
import { applyPenalizedModules, filterFindingsByContentStrategy, matchesSkipPatterns, mergeVoiceProfile } from '../voice/profile-utils.js';
import { computeVoiceStage } from '../voice/stage.js';
import {
  buildModuleFireCounts,
  computeCandidateRankingScore,
  getStartOfDayIso,
  selectTopDailyCandidates,
  type RankedCommitCandidate,
} from './daily-post-selection.js';
import { check, checkCrossVolume, shouldRunHaikuLazy } from '../analysis/accumulation-engine.js';
import { extractSignalFromDiff } from '../analysis/signal-extractor.js';
import { scoreCoherenceFromSignals } from '../analysis/coherence-router.js';
import { consumeSignalsForPost, rollbackPostConsumption, type Gatillador } from '../analysis/signal-consumer.js';
import { generateBufferText, persistSynthesisPost } from '../ai/synthesis-generator.js';
import type { WeakSignal, DeltaHit } from '../analysis/types.js';
import type { SignalBankEntry, SignalEvent } from '../voice/storage.js';

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
  readonly appBaseUrl: string;
}

const MATCHER_MAX_TOKENS = 400;
const HAIKU_MAX_TOKENS = 600;

type TodayDraftState = Pick<VoicePost, 'created_at' | 'opening_move' | 'top_module_id'>;

interface AuthorGenerationState {
  readonly authorLogin: string | null;
  readonly voiceProfile: VoiceProfile;
  readonly hasBootstrap: boolean;
  uniquePublished: number;
  voiceStage: VoiceStage;
  todayDrafts: TodayDraftState[];
  // Per-member credentials — null means fall back to tenant-level
  readonly memberLinkedinToken: string | null;
  readonly memberLinkedinMemberId: string | null;
  readonly memberBufferToken: string | null;
  readonly memberBufferOrgId: string | null;
  // Per-member bootstrap posts — empty means fall back to voiceProfile.bootstrap_posts
  readonly memberBootstrapPosts: BootstrapPost[];
}

interface CommitCandidate extends RankedCommitCandidate {
  readonly commit: EnrichedCommit;
  readonly findings: Finding[];
  readonly authorKey: string;
  readonly authorLogin: string | null;
  readonly voiceProfile: VoiceProfile;
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
  const generationAi = createAIClient('anthropic', deps.anthropicApiKey, config.ai.model, config.ai.max_tokens);
  const matcherAi = createAIClient('anthropic', deps.anthropicApiKey, config.ai.classify_model, MATCHER_MAX_TOKENS);
  const haikuAi = createAIClient('anthropic', deps.anthropicApiKey, 'claude-haiku-4-5-20251001', HAIKU_MAX_TOKENS);
  const storage = new SupabaseStorage(deps.supabaseUrl, deps.supabaseServiceKey, tenant.id);
  const embedder = deps.openaiApiKey
    ? createEmbedder(config.embeddings.provider, deps.openaiApiKey, config.embeddings.model)
    : null;

  const [owner, repo] = job.repo.split('/') as [string, string];
  const recentModuleIds = await storage.getRecentModuleIds(30, tenant.github_username);
  const recentModuleFireCounts = buildModuleFireCounts(recentModuleIds);
  const dayStartIso = getStartOfDayIso(config.scheduling.timezone);
  const dailyLimit = config.posting.max_daily_posts_per_author;
  const authorStates = new Map<string, AuthorGenerationState>();
  const candidatesByAuthor = new Map<string, CommitCandidate[]>();

  const getAuthorState = async (authorLogin: string | null, commitSha: string): Promise<{
    authorKey: string;
    state: AuthorGenerationState;
  }> => {
    const authorKey = authorLogin ?? `unknown:${commitSha}`;
    const existing = authorStates.get(authorKey);
    if (existing) return { authorKey, state: existing };

    const storedVoiceProfile = await storage.getVoiceProfile(authorLogin);
    const voiceProfile = mergeVoiceProfile(storedVoiceProfile?.voice);
    const hasBootstrap = (voiceProfile.bootstrap_posts?.length ?? 0) > 0;
    const uniquePublished = authorLogin ? await storage.countUniquePublished(authorLogin) : 0;
    const todayDrafts = authorLogin
      ? (await storage.getDraftsSince(authorLogin, dayStartIso)).map(toTodayDraftState)
      : [];

    // Load per-author credentials.
    // Lookup order: developer_profiles (global) → tenant_members (org override).
    let memberLinkedinToken: string | null = null;
    let memberLinkedinMemberId: string | null = null;
    let memberBufferToken: string | null = null;
    let memberBufferOrgId: string | null = null;
    let memberBootstrapPosts: BootstrapPost[] = [];

    if (authorLogin) {
      // 1. Global developer profile — configured once, applies cross-tenant.
      try {
        const { data: devProfile } = await deps.db
          .from('developer_profiles')
          .select('buffer_access_token, buffer_org_id, buffer_linkedin_channel_id, linkedin_access_token, linkedin_member_id, encrypted_dek, voice_bootstrap')
          .eq('github_login', authorLogin)
          .maybeSingle();

        if (devProfile) {
          const row = devProfile as {
            buffer_access_token: string | null;
            buffer_org_id: string | null;
            buffer_linkedin_channel_id: string | null;
            linkedin_access_token: string | null;
            linkedin_member_id: string | null;
            encrypted_dek: string | null;
            voice_bootstrap: string | null;
          };
          const devSecrets = await resolveTenantSecrets({
            encrypted_dek: row.encrypted_dek,
            buffer_access_token: row.buffer_access_token,
            linkedin_access_token: row.linkedin_access_token,
          });
          memberBufferToken = devSecrets.bufferAccessToken;
          memberBufferOrgId = row.buffer_org_id;
          memberLinkedinToken = devSecrets.linkedinAccessToken;
          memberLinkedinMemberId = row.linkedin_member_id;

          try {
            const raw = JSON.parse(row.voice_bootstrap ?? '[]') as string[];
            memberBootstrapPosts = raw
              .filter((t) => typeof t === 'string' && t.trim().length > 0)
              .map((text) => ({ text, pasted_at: new Date().toISOString() }));
          } catch {
            // Non-fatal
          }
        }
      } catch (err) {
        logger.warn('worker.author.dev_profile_failed', { authorLogin, error: String(err) });
      }

      // 2. Org-level override in tenant_members — explicit per-org config wins over global.
      try {
        const { data: memberRow, error: memberError } = await deps.db
          .from('tenant_members')
          .select('linkedin_access_token, linkedin_member_id, buffer_access_token, buffer_org_id, encrypted_dek, voice_bootstrap')
          .eq('tenant_id', tenant.id)
          .eq('github_author_login', authorLogin)
          .maybeSingle();

        if (!memberError && memberRow) {
          const row = memberRow as {
            linkedin_access_token: string | null;
            linkedin_member_id: string | null;
            buffer_access_token: string | null;
            buffer_org_id: string | null;
            encrypted_dek: string | null;
            voice_bootstrap: string | null;
          };
          const memberSecrets = await resolveTenantSecrets({
            encrypted_dek: row.encrypted_dek,
            buffer_access_token: row.buffer_access_token,
            linkedin_access_token: row.linkedin_access_token,
          });
          // Override only fields explicitly set in tenant_members
          if (memberSecrets.bufferAccessToken) memberBufferToken = memberSecrets.bufferAccessToken;
          if (row.buffer_org_id) memberBufferOrgId = row.buffer_org_id;
          if (memberSecrets.linkedinAccessToken) memberLinkedinToken = memberSecrets.linkedinAccessToken;
          if (row.linkedin_member_id) memberLinkedinMemberId = row.linkedin_member_id;

          if (row.voice_bootstrap) {
            try {
              const raw = JSON.parse(row.voice_bootstrap) as string[];
              const parsed = raw
                .filter((t) => typeof t === 'string' && t.trim().length > 0)
                .map((text) => ({ text, pasted_at: new Date().toISOString() }));
              if (parsed.length > 0) memberBootstrapPosts = parsed;
            } catch {
              // Non-fatal
            }
          }
        }
      } catch (err) {
        logger.warn('worker.author.member_secrets_failed', { authorLogin, error: String(err) });
      }
    }

    // Recompute after member bootstrap is known — member bootstrap counts toward stage
    const effectiveHasBootstrap = hasBootstrap || memberBootstrapPosts.length > 0;
    const effectiveVoiceStage = computeVoiceStage(uniquePublished, effectiveHasBootstrap);

    const state: AuthorGenerationState = {
      authorLogin,
      voiceProfile,
      hasBootstrap: effectiveHasBootstrap,
      uniquePublished,
      voiceStage: effectiveVoiceStage,
      todayDrafts,
      memberLinkedinToken,
      memberLinkedinMemberId,
      memberBufferToken,
      memberBufferOrgId,
      memberBootstrapPosts,
    };
    authorStates.set(authorKey, state);
    return { authorKey, state };
  };

  // Get the list of commits in this push range.
  // When before_sha is all zeros, this is a new branch creation — compareCommits
  // returns 404 in that case. Fetch the tip commit directly instead.
  const ZERO_SHA = '0000000000000000000000000000000000000000';
  let commits: { sha: string; message: string }[];
  if (job.before_sha === ZERO_SHA) {
    const tip = await github.getCommit(owner, repo, job.after_sha) as {
      sha: string;
      commit: { message: string };
    };
    commits = [{ sha: tip.sha, message: tip.commit.message }];
  } else {
    commits = await github.compareCommits(owner, repo, job.before_sha, job.after_sha);
  }
  logger.info('worker.job.commits', { jobId, count: commits.length });

  for (const pushCommit of commits) {
    logger.info('worker.commit.start', { sha: pushCommit.sha, repo: job.repo });

    try {
      const alreadyProcessed = await storage.hasDraft(pushCommit.sha, 'linkedin');
      if (alreadyProcessed) {
        logger.info('worker.commit.skip.duplicate', { sha: pushCommit.sha });
        continue;
      }

      const commit = await enrichCommit(github, owner, repo, pushCommit.sha, tenant.github_username, job.ref ?? undefined);

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

      const { authorKey, state: authorState } = await getAuthorState(commit.authorLogin ?? null, commit.sha);
      if (authorState.authorLogin && authorState.todayDrafts.length >= dailyLimit) {
        logger.info('worker.commit.skip.daily_limit_reached', {
          sha: commit.sha,
          authorLogin: authorState.authorLogin,
          draftsToday: authorState.todayDrafts.length,
          dailyLimit,
        });
        continue;
      }

      const { findings: pipelineFindings, weakFindings, deltaHits } = await runPipeline(
        {
          diffs: commit.diffs,
          commitMessage: commit.message,
          commitBody: commit.body,
          languages: commit.languages,
          repo: commit.repo,
          sha: commit.sha,
        },
        config.posting.analysis_top_n,
        MODULE_REGISTRY,
        recentModuleIds,
      );

      // Deposit weak signals (best-effort — never blocks post generation)
      const nowIso = new Date().toISOString();
      const depositAuthorLogin = commit.authorLogin ?? tenant.github_username;
      const commitFiles = commit.diffs.map((d) => d.filename);
      bestEffort('worker.commit.deposit_signal',
        depositWeakSignals(storage, weakFindings, deltaHits, commit.sha, commit.repo, tenant.id, depositAuthorLogin, nowIso, commitFiles),
        { sha: commit.sha });

      // Haiku lazy: semantically evaluate topics near threshold that scored 0 in regex pipeline (best-effort)
      {
        const firedTopicsThisCommit = [...new Set([...weakFindings.map((f) => f.moduleId), ...deltaHits.map((d) => d.topic)])];
        bestEffort('worker.commit.haiku_lazy',
          runHaikuLazy(haikuAi, storage, commit, tenant.id, depositAuthorLogin, firedTopicsThisCommit, nowIso),
          { sha: commit.sha });
      }

      if (pipelineFindings.length === 0) {
        logger.info('worker.commit.skip.no_findings', { sha: commit.sha });
        continue;
      }

      const strategyFindings = filterFindingsByContentStrategy(pipelineFindings, authorState.voiceProfile);

      if (strategyFindings.length === 0) {
        logger.info('worker.commit.skip.no_findings_after_strategy', {
          sha: commit.sha,
          focus_modules: authorState.voiceProfile.content_strategy.focus_modules ?? [],
        });
        continue;
      }

      const findings = applyPenalizedModules(strategyFindings, authorState.voiceProfile);

      const skipPattern = matchesSkipPatterns(commit, findings, authorState.voiceProfile);
      if (skipPattern) {
        logger.info('worker.commit.skip.content_strategy', { sha: commit.sha, skipPattern });
        continue;
      }

      const topModuleId = findings[0]?.moduleId ?? null;
      const topModuleFireCount = topModuleId ? (recentModuleFireCounts.get(topModuleId) ?? 0) : 0;
      const rankingScore = computeCandidateRankingScore(commit, findings, recentModuleFireCounts);
      const candidate: CommitCandidate = {
        commit,
        commitSha: commit.sha,
        committedAt: commit.committedAt,
        findings,
        findingsCount: findings.length,
        authorKey,
        authorLogin: authorState.authorLogin,
        voiceProfile: authorState.voiceProfile,
        topModuleId,
        topModuleFireCount,
        rankingScore,
        totalChangedLines: commit.totalAdditions + commit.totalDeletions,
      };

      const authorCandidates = candidatesByAuthor.get(authorKey) ?? [];
      authorCandidates.push(candidate);
      candidatesByAuthor.set(authorKey, authorCandidates);

      logger.info('worker.commit.candidate', {
        sha: commit.sha,
        authorLogin: authorState.authorLogin,
        topModuleId,
        topModuleFireCount,
        rankingScore,
        draftsToday: authorState.todayDrafts.length,
        dailyLimit,
      });
    } catch (err) {
      // Per-commit errors are logged but don't abort the whole job
      logger.error('worker.commit.error', { sha: pushCommit.sha, error: String(err) });
    }
  }

  for (const [authorKey, candidates] of candidatesByAuthor) {
    const authorState = authorStates.get(authorKey);
    if (!authorState) continue;

    // Fetch arc history once per author (fail-open — anti-repetition disabled if query fails)
    let recentArcTypes: ArcType[] = [];
    try {
      recentArcTypes = (await storage.getRecentArcTypes(authorState.authorLogin, 5)) as ArcType[];
    } catch { /* fail-open */ }

    while (authorState.todayDrafts.length < dailyLimit && candidates.length > 0) {
      const [candidate] = selectTopDailyCandidates(candidates, authorState.todayDrafts, 1);
      if (!candidate) break;

      const candidateIndex = candidates.findIndex((item) => item.commitSha === candidate.commitSha);
      if (candidateIndex >= 0) candidates.splice(candidateIndex, 1);

      logger.info('worker.commit.selected_for_generation', {
        sha: candidate.commit.sha,
        authorLogin: candidate.authorLogin,
        rankingScore: candidate.rankingScore,
        topModuleId: candidate.topModuleId,
        slot: authorState.todayDrafts.length + 1,
        dailyLimit,
      });

      try {
        const draftIndexToday = authorState.todayDrafts.length;
        let chapterContext: string | undefined;
        if (candidate.topModuleId && candidate.topModuleFireCount >= 1) {
          const previousFindings = await storage.getRecentTopFindings(
            candidate.authorLogin,
            candidate.topModuleId,
            2,
          );
          if (previousFindings.length > 0) {
            chapterContext = buildChapterContext(
              candidate.topModuleId,
              previousFindings,
              candidate.topModuleFireCount + 1,
            );
          }
        }

        let exposurePool: Awaited<ReturnType<SupabaseStorage['getPublishedForExposure']>> = [];
        if (candidate.authorLogin && authorState.voiceStage !== 'cold') {
          const poolIds = candidate.voiceProfile.voice_examples_pool?.['linkedin'];
          if (poolIds?.length) {
            exposurePool = await fetchExposurePool(deps.db, tenant.id, poolIds);
          }
          if (exposurePool.length === 0) {
            exposurePool = await storage.getPublishedForExposure(candidate.authorLogin, 'linkedin');
          }
        }

        const todayFirstOpeningMove = authorState.todayDrafts
          .find((draft) => draft.opening_move && draft.opening_move !== 'unknown')
          ?.opening_move ?? undefined;

        const varietyConstraint = authorState.voiceStage !== 'cold'
          ? buildVarietyConstraint(
              candidate.voiceProfile.recent_opening_sequence ?? [],
              draftIndexToday,
              todayFirstOpeningMove,
            ) ?? undefined
          : undefined;

        // Content matching — inject industry context when a strong match is found.
        // Graceful degradation: any failure skips context, post generated normally.
        let industryContext: string | undefined;
        let draftMetadata: Partial<SaveDraftInput> = {
          author_login: candidate.authorLogin,
          generation_system: authorState.voiceStage === 'cold' ? 'v1' : 'v2_progressive',
        };
        if (embedder) {
          const contextPreference = candidate.voiceProfile.content_preferences?.industry_context_preference ?? 'neutral';
          const shouldSkipContext = contextPreference === 'avoid'
            && !(await shouldProbeContext(storage, candidate.authorLogin, dayStartIso));

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
            logger.info('content.match.skipped_by_preference', {
              sha: candidate.commit.sha,
              author: candidate.commit.authorLogin,
            });
          } else {
            try {
              const similarityThreshold = contextPreference === 'prefer' ? 0.72 : 0.75;
              const match = await matchFindingsToArticles(candidate.findings, embedder, matcherAi, deps.db, {
                similarityThreshold,
              });
              if (match) {
                industryContext = buildIndustryContextBlock({
                  connection: match.connection,
                  articleUrl: match.articleUrl,
                });
                draftMetadata = {
                  ...draftMetadata,
                  context_status: 'matched',
                  has_industry_context: true,
                  matched_article_id: match.articleId,
                  matched_source_id: match.sourceId,
                  match_strength: match.matchStrength,
                  match_connection: match.connection,
                };
                logger.info('content.match.injected', {
                  sha: candidate.commit.sha,
                  article: match.articleTitle,
                });
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
              logger.warn('content.match.skipped', { sha: candidate.commit.sha, error: String(err) });
            }
          }
        } else {
          logger.info('content.match.skipped', { sha: candidate.commit.sha, reason: 'no_embedder' });
        }

        // R3: select narrative arc — fail-open if no evidence
        const candidateCollabWeight = computeCollaborationWeight(candidate.commit.prContext);
        const candidateIntent = detectCommitIntent({
          message: candidate.commit.message,
          branchRef: candidate.commit.branchRef,
          prTitle: candidate.commit.prContext?.prTitle,
          moduleIds: candidate.findings.map((f) => f.moduleId),
        });
        let developmentalAngle: string | undefined;
        let selectedArcType: string | null = null;
        try {
          const angle = selectDevelopmentalAngle({
            findings: candidate.findings,
            commitIntent: candidateIntent,
            closingIssues: candidate.commit.prContext?.closingIssues,
            changesRequestedCount: candidate.commit.prContext?.changesRequestedCount ?? 0,
            collaborationWeight: candidateCollabWeight,
            recentArcTypes,
            discouragedArcTypes: (candidate.voiceProfile.content_preferences?.penalized_arc_types ?? []) as ArcType[],
          });
          if (angle) {
            developmentalAngle = buildAngleBlock(angle, candidateCollabWeight);
            selectedArcType = angle.arcType;
          }
        } catch { /* fail-open */ }

        draftMetadata = { ...draftMetadata, arc_type: selectedArcType };

        const {
          linkedinPost,
          bufferText,
          draftId,
          openingMove,
        } = await generatePosts(
          generationAi,
          candidate.commit,
          candidate.findings,
          storage,
          config,
          {
            voiceProfile: candidate.voiceProfile,
            voiceStage: authorState.voiceStage,
            exposurePool,
            bootstrapPosts: authorState.memberBootstrapPosts.length > 0
              ? authorState.memberBootstrapPosts
              : candidate.voiceProfile.bootstrap_posts ?? [],
            recentModuleIds,
            chapterContext,
            industryContext,
            developmentalAngle,
            draftMetadata,
            draftIndexToday,
            varietyConstraint,
          },
        );

        authorState.todayDrafts.push({
          created_at: new Date().toISOString(),
          opening_move: openingMove,
          top_module_id: candidate.topModuleId ?? null,
        });

        // Consume accumulated signals for the fired topics (§9 gatilladores 1 & 2, best-effort)
        {
          const capa1Topics = [...new Set(candidate.findings.map((f) => f.moduleId))];
          const capa1Gatillador: Gatillador = capa1Topics.length === 1 ? 'individual_mono' : 'individual_multi';
          const capa1Author = candidate.authorLogin ?? tenant.github_username;
          bestEffort('worker.commit.capa1_consume',
            consumeSignalsForPost(storage, draftId, capa1Gatillador, capa1Topics, capa1Author, candidate.commit.repo),
            { sha: candidate.commit.sha });
        }

        // Post directly to LinkedIn — prefer member credentials, fall back to tenant
        const effectiveLinkedinToken = authorState.memberLinkedinToken ?? secrets.linkedinAccessToken;
        const effectiveLinkedinMemberId = authorState.memberLinkedinMemberId ?? tenant.linkedin_member_id;

        if (effectiveLinkedinToken && effectiveLinkedinMemberId) {
          try {
            const linkedinClient = new LinkedInClient(effectiveLinkedinToken);
            await linkedinClient.post(effectiveLinkedinMemberId, linkedinPost);
            await storage.updatePublished({
              id: draftId,
              published: linkedinPost,
              edit_ratio: 1.0,
              published_at: new Date().toISOString(),
              publish_source: 'linkedin_direct',
            });
            authorState.uniquePublished += 1;
            authorState.voiceStage = computeVoiceStage(authorState.uniquePublished, authorState.hasBootstrap);
            logger.info('worker.commit.linkedin_posted', { sha: candidate.commit.sha });
          } catch (err) {
            if (err instanceof LinkedInAuthExpiredError) {
              logger.warn('worker.commit.linkedin_expired', { sha: candidate.commit.sha });
            } else {
              logger.error('worker.commit.linkedin_error', { sha: candidate.commit.sha, error: String(err) });
            }
          }
        } else {
          logger.info('worker.commit.linkedin_skipped', { sha: candidate.commit.sha, reason: 'no linkedin token' });
        }

        // Create Buffer Idea — prefer member credentials, fall back to tenant
        const effectiveBufferToken = authorState.memberBufferToken ?? secrets.bufferAccessToken;
        const effectiveBufferOrgId = authorState.memberBufferOrgId ?? config.buffer.organization_id;
        if (effectiveBufferToken && effectiveBufferOrgId && effectiveBufferOrgId !== 'UNCONFIGURED') {
          const bufferClient = new BufferClient(effectiveBufferToken);
          const publishResult = await publishToBuffer(
            bufferClient, storage, config, draftId, bufferText, 'linkedin', effectiveBufferOrgId, candidate.commit.message,
          );
          if (publishResult) {
            await notifyNewDraft(github, owner, config.github.notification_repo, candidate.commit, [publishResult], deps.appBaseUrl);
          }
        } else {
          logger.info('worker.commit.buffer_skipped', { sha: candidate.commit.sha, reason: 'no buffer token' });
        }

        logger.info('worker.commit.done', { sha: candidate.commit.sha });
      } catch (err) {
        // Per-commit errors are logged but don't abort the whole job
        logger.error('worker.commit.error', { sha: candidate.commit.sha, error: String(err) });
      }
    }

    for (const candidate of candidates) {
      logger.info('worker.commit.skip.daily_limit_ranked_out', {
        sha: candidate.commit.sha,
        authorLogin: candidate.authorLogin,
        rankingScore: candidate.rankingScore,
        topModuleId: candidate.topModuleId,
        draftsToday: authorState.todayDrafts.length,
        dailyLimit,
      });
    }
  }

  // Phase 3: accumulation check — fire synthesis if any topic crossed threshold
  const accumNowIso = new Date().toISOString();
  for (const [, authorState] of authorStates) {
    const authorLogin = authorState.authorLogin;
    if (!authorLogin) continue;
    if (authorState.todayDrafts.length >= dailyLimit) continue;

    try {
      await runAccumulationCheck(
        storage,
        generationAi,
        config,
        authorLogin,
        repo,
        job.repo,
        authorState,
        owner,
        github,
        deps.appBaseUrl,
        accumNowIso,
      );
    } catch (err) {
      logger.error('worker.accumulation.error', { authorLogin, repo: job.repo, error: String(err) });
    }
  }

  logger.info('worker.job.done', { jobId });
}

export async function shouldProbeContext(
  storage: SupabaseStorage,
  authorLogin: string | null,
  dayStartIso: string,
): Promise<boolean> {
  if (!authorLogin) return false;
  const draftsToday = await storage.countDraftsSince(authorLogin, dayStartIso);
  // Probe on the first draft of the day. Previous condition (% 5 === 4) never
  // fired because max_daily_posts_per_author defaults to 2.
  return draftsToday === 1;
}

export async function fetchExposurePool(
  db: SupabaseClient,
  tenantId: string,
  poolIds: string[],
): Promise<VoicePost[]> {
  const { data, error } = await db
    .from('voice_posts')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('id', poolIds);
  if (error) return [];
  return (data ?? []) as VoicePost[];
}

function toTodayDraftState(post: Pick<VoicePost, 'created_at' | 'opening_move' | 'top_module_id'>): TodayDraftState {
  return {
    created_at: post.created_at,
    opening_move: post.opening_move ?? null,
    top_module_id: post.top_module_id ?? null,
  };
}

const MODULE_PATTERN_KIND: Record<string, WeakSignal['pattern_kind']> = {
  performance: 'behavioral_change',
  security: 'contract_change',
  design_patterns: 'new_abstraction',
  testing: 'semantic_refactor',
  type_system: 'contract_change',
  integration: 'dependency_update',
  devops: 'config_change',
  dependency_health: 'dependency_update',
  evolutionary: 'semantic_refactor',
  clean_code: 'semantic_refactor',
  api_design: 'contract_change',
  observability: 'behavioral_change',
  error_resilience: 'behavioral_change',
  concurrency: 'behavioral_change',
  dx: 'new_abstraction',
  react_patterns: 'new_abstraction',
  js_advanced: 'new_abstraction',
  complexity: 'semantic_refactor',
  ai_assisted: 'new_abstraction',
  python_patterns: 'semantic_refactor',
  go_patterns: 'semantic_refactor',
  java_patterns: 'semantic_refactor',
  elixir_patterns: 'semantic_refactor',
  architecture_patterns: 'new_abstraction',
};

async function depositWeakSignals(
  storage: IVoiceStorage,
  weakFindings: Finding[],
  deltaHits: DeltaHit[],
  commitSha: string,
  repo: string,
  tenantId: string,
  authorLogin: string,
  nowIso: string,
  files: string[],
): Promise<void> {
  const deposits: WeakSignal[] = [];

  for (const wf of weakFindings) {
    deposits.push({
      topic: wf.moduleId,
      strength: wf.interestScore,
      pattern_kind: MODULE_PATTERN_KIND[wf.moduleId] ?? 'semantic_refactor',
      source: 'finding',
      affected_symbols: [],
      affected_files: files,
      specific_change: wf.finding.slice(0, 80),
      commit_sha: commitSha,
      repo,
      tenant_id: tenantId,
      github_author_login: authorLogin,
      accumulated_at: nowIso,
    });
  }

  for (const dh of deltaHits) {
    deposits.push({
      topic: dh.topic,
      strength: dh.strength,
      pattern_kind: 'behavioral_change',
      source: 'delta_hit',
      affected_symbols: [],
      affected_files: files,
      specific_change: 'bilateral pattern match — same pattern in added and removed lines',
      commit_sha: commitSha,
      repo,
      tenant_id: tenantId,
      github_author_login: authorLogin,
      accumulated_at: nowIso,
    });
  }

  await Promise.all(deposits.map((s) => storage.depositSignal(s)));
}

async function runHaikuLazy(
  haiku: import('../ai/types.js').IAIClient,
  storage: IVoiceStorage,
  commit: import('../github/commit-enricher.js').EnrichedCommit,
  tenantId: string,
  authorLogin: string,
  firedTopics: string[],
  nowIso: string,
): Promise<void> {
  const entries = await storage.getSignalBankEntries(authorLogin, commit.repo);
  const fired = new Set(firedTopics);
  const candidates = entries.filter((e) => !fired.has(e.topic) && shouldRunHaikuLazy(e, nowIso));
  if (candidates.length === 0) return;

  for (const entry of candidates) {
    const signal = await extractSignalFromDiff(haiku, commit, entry.topic, tenantId, authorLogin);
    if (signal) {
      await storage.depositSignal(signal);
      logger.info('worker.commit.haiku_lazy.deposit', { sha: commit.sha, topic: entry.topic, strength: signal.strength });
    }
  }
}

async function runAccumulationCheck(
  storage: IVoiceStorage,
  generationAi: import('../ai/types.js').IAIClient,
  config: Config,
  authorLogin: string,
  repoName: string,
  fullRepo: string,
  authorState: AuthorGenerationState,
  owner: string,
  github: import('../github/client.js').GitHubClient,
  appBaseUrl: string,
  nowIso: string,
): Promise<void> {
  bestEffort('worker.accumulation.half_lives',
    storage.updateHalfLivesForAuthor(authorLogin, fullRepo),
    { authorLogin, repo: fullRepo });

  const entries = await storage.getSignalBankEntries(authorLogin, fullRepo);
  if (entries.length === 0) return;

  const firedEntries = entries.filter((e: SignalBankEntry) => check(e, nowIso).shouldFire);
  const crossVolume = checkCrossVolume(entries, nowIso);

  if (firedEntries.length === 0 && !crossVolume) return;

  const firedTopics = firedEntries.length > 0
    ? firedEntries.map((e: SignalBankEntry) => e.topic)
    : entries.map((e: SignalBankEntry) => e.topic);

  const allSignals: SignalEvent[] = [];
  for (const topic of firedTopics) {
    const signals = await storage.getUnconsumedSignals(authorLogin, fullRepo, topic);
    allSignals.push(...signals);
  }

  if (allSignals.length === 0) return;

  // Coherence routing: arco when >= 2 topics fired and commits share structural/temporal/lexical signal
  const firedEntry = firedEntries[0];
  const medianIntervalDays = firedEntry?.commit_frequency ?? null;
  let gatillador: 'focal' | 'arco' | 'focal_multiple';
  if (firedTopics.length >= 2) {
    const coherence = scoreCoherenceFromSignals(allSignals, medianIntervalDays);
    gatillador = coherence.decision === 'arco' ? 'arco' : 'focal_multiple';
    bestEffort('worker.accumulation.routing_record',
      storage.recordRoutingDecision({
        github_author_login: authorLogin,
        voice_post_id: null,
        commit_shas: [...new Set(allSignals.map((s) => s.commit_sha))],
        score_coherencia: coherence.total,
        score_structural: coherence.structural,
        score_temporal: coherence.temporal,
        score_lexical: coherence.lexical,
        decision: coherence.decision,
      }));
  } else {
    gatillador = 'focal';
  }

  logger.info('worker.accumulation.fire', {
    authorLogin,
    repo: fullRepo,
    topics: firedTopics,
    gatillador,
    signalCount: allSignals.length,
  });

  const exposurePool = authorState.voiceStage !== 'cold'
    ? await storage.getPublishedForExposure(authorLogin, 'linkedin')
    : [];
  const bootstrapPosts = authorState.memberBootstrapPosts.length > 0
    ? authorState.memberBootstrapPosts
    : authorState.voiceProfile.bootstrap_posts ?? [];

  const topicsToGenerate: Array<{ topics: string[]; signals: SignalEvent[]; gatillador: 'focal' | 'arco' }> =
    gatillador === 'focal_multiple'
      ? firedTopics.map((topic) => ({
          topics: [topic],
          signals: allSignals.filter((s) => s.topic === topic),
          gatillador: 'focal' as const,
        }))
      : [{ topics: firedTopics, signals: allSignals, gatillador: gatillador as 'focal' | 'arco' }];

  const fakeCommit = {
    sha: allSignals[allSignals.length - 1]?.commit_sha ?? 'synthesis',
    message: `Synthesis post (${firedTopics.join(', ')})`,
    authorLogin,
    repo: fullRepo,
  } as import('../github/commit-enricher.js').EnrichedCommit;

  const synthesisInputs = topicsToGenerate.map((item, i) => ({
    authorLogin,
    repo: fullRepo,
    gatillador: item.gatillador,
    topics: item.topics,
    signals: item.signals,
    voiceProfile: authorState.voiceProfile,
    voiceStage: authorState.voiceStage,
    config,
    exposurePool,
    bootstrapPosts,
    draftIndexToday: authorState.todayDrafts.length + i,
  }));

  // Phase 1: generate all buffer texts in parallel — fail-fast, no DB writes.
  // If any Claude call fails, no draft is saved for any topic.
  const generatedTexts = await Promise.all(synthesisInputs.map((inp) => generateBufferText(generationAi, inp)));

  // Phase 2: persist sequentially; roll back consumed signals if a later item fails.
  const savedDraftIds: string[] = [];
  try {
    for (let i = 0; i < topicsToGenerate.length; i++) {
      const item = topicsToGenerate[i]!;
      const { draftId } = await persistSynthesisPost(storage, synthesisInputs[i]!, generatedTexts[i]!);
      await consumeSignalsForPost(storage, draftId, item.gatillador, item.topics, authorLogin, fullRepo);
      savedDraftIds.push(draftId);
      await notifyNewDraft(github, owner, config.github.notification_repo, fakeCommit, [], appBaseUrl);
      logger.info('worker.accumulation.done', { draftId, authorLogin, topics: item.topics, gatillador: item.gatillador });
    }
  } catch (err) {
    for (const draftId of savedDraftIds) {
      await rollbackPostConsumption(storage, draftId, 'focal_multiple_partial_failure')
        .catch((e) => logger.error('worker.accumulation.rollback.failed', { draftId, error: String(e) }));
    }
    logger.error('worker.accumulation.failed', { authorLogin, repo: fullRepo, error: String(err) });
    throw err;
  }
}
