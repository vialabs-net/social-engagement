import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createAIClient, createEmbedder } from '../src/ai/factory.js';
import { runPipeline } from '../src/analysis/pipeline.js';
import type { Finding } from '../src/analysis/types.js';
import { matchFindingsToArticles } from '../src/content/matcher.js';
import { enrichCommit } from '../src/github/commit-enricher.js';
import { GitHubClient } from '../src/github/client.js';
import { getInstallationToken } from '../src/worker/github-app-auth.js';

type AuditMode = 'commit' | 'draft' | 'published';

interface TenantRow {
  readonly id: string;
  readonly github_username: string;
  readonly github_installation_id: number;
  readonly config: Record<string, unknown> | null;
}

interface AuditPostRow {
  readonly id: string;
  readonly commit_sha: string;
  readonly repo: string;
  readonly ai_draft: string;
  readonly published: string | null;
  readonly created_at: string;
  readonly published_at: string | null;
  readonly status: string;
  readonly top_finding: string | null;
  readonly top_module_id: string | null;
  readonly author_login: string | null;
}

interface AuditResult {
  readonly mode: AuditMode;
  readonly sourceId: string;
  readonly repo: string;
  readonly commitSha: string;
  readonly authorLogin: string | null;
  readonly timestamp: string | null;
  readonly findingHeadline: string;
  readonly matched: boolean;
  readonly matchedArticleTitle: string | null;
  readonly matchStrength: number | null;
  readonly connection: string | null;
  readonly textPreview: string;
}

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function getTenantId(): string {
  return getArg('--tenant') ?? process.env['TENANT_ID'] ?? '';
}

function getMode(): AuditMode {
  const mode = (getArg('--mode') ?? 'published') as AuditMode;
  if (mode !== 'commit' && mode !== 'draft' && mode !== 'published') {
    throw new Error(`Unsupported mode "${mode}". Use commit, draft, or published.`);
  }
  return mode;
}

function getLimit(): number {
  const raw = getArg('--limit');
  if (!raw) return 10;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('--limit must be a positive number.');
  return parsed;
}

function getStringConfig(
  config: Record<string, unknown> | null,
  section: string,
  key: string,
  fallback: string,
): string {
  const parent = config?.[section];
  if (!parent || typeof parent !== 'object') return fallback;
  const value = (parent as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function trimPreview(text: string, maxLength = 180): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function tokenizeText(value: string): string[] {
  return [...new Set(value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && part.length <= 30)
  )].slice(0, 16);
}

function getPostText(post: AuditPostRow, mode: AuditMode): string {
  if (mode === 'published') return post.published ?? '';
  return post.ai_draft ?? '';
}

function buildAuditFindingFromPost(post: AuditPostRow, mode: AuditMode): Finding {
  const text = getPostText(post, mode);
  const headline = post.top_finding ?? `${mode} post for ${post.repo}`;
  const retrievalTerms = [
    ...tokenizeText(post.repo),
    ...tokenizeText(post.top_module_id ?? ''),
    ...tokenizeText(post.top_finding ?? ''),
  ].slice(0, 18);

  return {
    moduleId: post.top_module_id ?? `${mode}_post`,
    aspect: `${mode} post audit`,
    finding: headline,
    technicalDetail: `Post audit for ${post.repo} commit ${post.commit_sha}. Original status: ${post.status}.`,
    plainLanguage: text,
    interestScore: 10,
    contextHint: `${mode} post ${post.id}`,
    retrievalTerms,
    retrievalText: [
      `Audit mode: ${mode}`,
      `Repository: ${post.repo}`,
      `Commit SHA: ${post.commit_sha}`,
      `Top module: ${post.top_module_id ?? 'unknown'}`,
      `Top finding: ${headline}`,
      `Post text: ${text}`,
    ].join('\n'),
  };
}

async function loadTenant(db: SupabaseClient, tenantId: string): Promise<TenantRow> {
  const { data, error } = await db
    .from('tenants')
    .select('id, github_username, github_installation_id, config')
    .eq('id', tenantId)
    .single();

  if (error || !data) throw new Error(`Tenant ${tenantId} not found: ${error?.message ?? 'no data'}`);
  return data as TenantRow;
}

async function resolveGithubToken(tenant: TenantRow): Promise<string> {
  const personalToken = process.env['GITHUB_TOKEN'];
  if (personalToken) return personalToken;

  const appId = process.env['GITHUB_APP_ID'];
  const privateKey = process.env['GITHUB_APP_PRIVATE_KEY'];
  if (appId && privateKey && tenant.github_installation_id) {
    return getInstallationToken(appId, privateKey, tenant.github_installation_id);
  }

  throw new Error('Commit audit requires GITHUB_TOKEN or GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY.');
}

async function loadPosts(
  db: SupabaseClient,
  tenantId: string,
  mode: AuditMode,
  authorLogin: string | undefined,
  limit: number,
): Promise<AuditPostRow[]> {
  const orderColumn = mode === 'published' ? 'published_at' : 'created_at';
  let query = db
    .from('voice_posts')
    .select('id, commit_sha, repo, ai_draft, published, created_at, published_at, status, top_finding, top_module_id, author_login')
    .eq('tenant_id', tenantId)
    .order(orderColumn, { ascending: false, nullsFirst: false })
    .limit(limit);

  if (mode === 'published') {
    query = query.eq('status', 'published').not('published', 'is', null);
  } else {
    query = query.not('ai_draft', 'is', null);
  }

  if (authorLogin) query = query.eq('author_login', authorLogin);

  const from = getArg('--from');
  const to = getArg('--to');
  if (from) query = query.gte(orderColumn, `${from}T00:00:00.000Z`);
  if (to) query = query.lte(orderColumn, `${to}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load posts: ${error.message}`);
  return (data ?? []) as AuditPostRow[];
}

function buildAuditResult(
  mode: AuditMode,
  post: AuditPostRow,
  finding: Finding,
  match: Awaited<ReturnType<typeof matchFindingsToArticles>>,
): AuditResult {
  const text = mode === 'published' ? (post.published ?? '') : post.ai_draft;
  return {
    mode,
    sourceId: post.id,
    repo: post.repo,
    commitSha: post.commit_sha,
    authorLogin: post.author_login,
    timestamp: mode === 'published' ? post.published_at : post.created_at,
    findingHeadline: finding.finding,
    matched: Boolean(match),
    matchedArticleTitle: match?.articleTitle ?? null,
    matchStrength: match ? Number(match.matchStrength.toFixed(4)) : null,
    connection: match?.connection ?? null,
    textPreview: trimPreview(text),
  };
}

async function auditPosts(): Promise<void> {
  const tenantId = getTenantId();
  if (!tenantId) throw new Error('Use --tenant <id> or set TENANT_ID.');

  const supabaseUrl = getRequiredEnv('SUPABASE_URL');
  const supabaseKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = getRequiredEnv('ANTHROPIC_API_KEY');
  const openaiKey = getRequiredEnv('OPENAI_API_KEY');
  const db = createClient(supabaseUrl, supabaseKey);
  const tenant = await loadTenant(db, tenantId);
  const mode = getMode();
  const authorLogin = getArg('--author');
  const limit = getLimit();

  if (mode === 'commit') {
    await auditCommits(db, tenant);
    return;
  }

  const posts = await loadPosts(db, tenantId, mode, authorLogin, limit);
  const matcherModel = getStringConfig(tenant.config, 'ai', 'classify_model', 'claude-haiku-4-5');
  const embeddingModel = getStringConfig(tenant.config, 'embeddings', 'model', 'text-embedding-3-small');
  const aiClient = createAIClient('anthropic', anthropicKey, matcherModel, 400);
  const embedder = createEmbedder('openai', openaiKey, embeddingModel);
  const threshold = Number(getArg('--threshold') ?? '0.45');

  const results: AuditResult[] = [];
  for (const post of posts) {
    const finding = buildAuditFindingFromPost(post, mode);
    const match = await matchFindingsToArticles([finding], embedder, aiClient, db, {
      similarityThreshold: threshold,
    });
    results.push(buildAuditResult(mode, post, finding, match));
  }

  console.log(JSON.stringify({
    mode,
    tenant_id: tenantId,
    tenant_github_username: tenant.github_username,
    author_login: authorLogin ?? null,
    total_audited: results.length,
    matched: results.filter((result) => result.matched).length,
    unmatched: results.filter((result) => !result.matched).length,
    results,
  }, null, 2));
}

async function auditCommits(
  db: SupabaseClient,
  tenant: TenantRow,
): Promise<void> {
  const repo = getArg('--repo');
  const shaArg = getArg('--sha');
  if (!repo || !shaArg) {
    throw new Error('Commit mode requires --repo <owner/repo> and --sha <sha[,sha2]>.');
  }

  const anthropicKey = getRequiredEnv('ANTHROPIC_API_KEY');
  const openaiKey = getRequiredEnv('OPENAI_API_KEY');
  const matcherModel = getStringConfig(tenant.config, 'ai', 'classify_model', 'claude-haiku-4-5');
  const embeddingModel = getStringConfig(tenant.config, 'embeddings', 'model', 'text-embedding-3-small');
  const aiClient = createAIClient('anthropic', anthropicKey, matcherModel, 400);
  const embedder = createEmbedder('openai', openaiKey, embeddingModel);
  const github = new GitHubClient(await resolveGithubToken(tenant));
  const threshold = Number(getArg('--threshold') ?? '0.45');
  const [owner, repoName] = repo.split('/') as [string, string];
  const shas = shaArg.split(',').map((sha) => sha.trim()).filter(Boolean);

  const results: Array<Record<string, unknown>> = [];
  for (const sha of shas) {
    const commit = await enrichCommit(github, owner, repoName, sha, getArg('--author') ?? tenant.github_username);
    const { findings } = await runPipeline({
      diffs: commit.diffs,
      commitMessage: commit.message,
      commitBody: commit.body,
      languages: commit.languages,
      repo: commit.repo,
      sha: commit.sha,
    });

    const match = await matchFindingsToArticles(findings, embedder, aiClient, db, {
      similarityThreshold: threshold,
    });

    results.push({
      sha,
      repo,
      commit_message: commit.message,
      findings: findings.map((finding) => ({
        module: finding.moduleId,
        aspect: finding.aspect,
        finding: finding.finding,
        retrieval_terms: finding.retrievalTerms ?? [],
      })),
      matched: Boolean(match),
      matched_article_title: match?.articleTitle ?? null,
      match_strength: match ? Number(match.matchStrength.toFixed(4)) : null,
      connection: match?.connection ?? null,
    });
  }

  console.log(JSON.stringify({
    mode: 'commit',
    tenant_id: tenant.id,
    tenant_github_username: tenant.github_username,
    total_audited: results.length,
    matched: results.filter((result) => Boolean(result['matched'])).length,
    unmatched: results.filter((result) => !result['matched']).length,
    results,
  }, null, 2));
}

auditPosts().catch((err) => {
  console.error(err);
  process.exit(1);
});
