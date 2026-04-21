import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { openDb } from './lib/db.js';
import {
  headOf,
  listAuthorCommitShas,
  loadCommit,
  repoLocalPath,
} from './lib/git-local.js';
import { getSupabaseReadonly } from './lib/supabase-readonly.js';
import type { AuthorsConfig, AuthorEmails, ResampleManifestEntry, CachedCommit } from './lib/types.js';
import { MODULE_REGISTRY } from '../../../src/analysis/modules/index.js';
import type { AnalysisContext, Finding, FileDiff } from '../../../src/analysis/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '../db');
const CONFIG_DIR = join(__dirname, '../config');
const WINDOW_DAYS = 120;

const DRY_RUN = process.argv.includes('--dry-run');
const STATS_ONLY = process.argv.includes('--stats');

function parseAuthorsConfig(): AuthorsConfig {
  const path = join(CONFIG_DIR, 'authors.json');
  return JSON.parse(readFileSync(path, 'utf8')) as AuthorsConfig;
}

function parseAuthorEmails(): AuthorEmails {
  const path = join(DB_DIR, 'author-emails.json');
  if (!existsSync(path)) {
    throw new Error('db/author-emails.json missing. Run npm run preflight first.');
  }
  return JSON.parse(readFileSync(path, 'utf8')) as AuthorEmails;
}

async function fetchTenantIdsByLogin(logins: string[]): Promise<Map<string, string | null>> {
  const supabase = getSupabaseReadonly();
  const { data } = await supabase
    .from('voice_profiles')
    .select('github_author_login, tenant_id')
    .in('github_author_login', logins);
  const map = new Map<string, string | null>();
  for (const row of (data ?? []) as Array<{ github_author_login: string; tenant_id: string | null }>) {
    map.set(row.github_author_login, row.tenant_id);
  }
  return map;
}

async function fetchRepoByCommitSha(shas: string[]): Promise<Map<string, string>> {
  if (shas.length === 0) return new Map();
  const supabase = getSupabaseReadonly();
  const map = new Map<string, string>();
  // Chunk to stay under Supabase query length limits
  const chunkSize = 100;
  for (let i = 0; i < shas.length; i += chunkSize) {
    const slice = shas.slice(i, i + chunkSize);
    const { data } = await supabase
      .from('voice_posts')
      .select('commit_sha, repo')
      .in('commit_sha', slice);
    for (const row of (data ?? []) as Array<{ commit_sha: string; repo: string }>) {
      map.set(row.commit_sha, row.repo);
    }
  }
  return map;
}

async function discoverReposForAuthors(
  logins: string[],
  reposRoot: string,
): Promise<Map<string, string>> {
  // Build map: repo(owner/name from voice_posts) -> local path
  const supabase = getSupabaseReadonly();
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('voice_posts')
    .select('repo')
    .gte('created_at', cutoff)
    .in('author_login', logins)
    .not('repo', 'is', null);
  const repos = new Set<string>();
  for (const row of (data ?? []) as Array<{ repo: string }>) repos.add(row.repo);

  const map = new Map<string, string>();
  for (const repo of repos) {
    const local = repoLocalPath(reposRoot, repo);
    if (local) map.set(repo, local);
  }
  return map;
}

function writeManifest(repoLocalByName: Map<string, string>): void {
  const entries: ResampleManifestEntry[] = [];
  const runStart = new Date().toISOString();
  for (const [repo, localPath] of repoLocalByName) {
    const head = headOf(localPath);
    if (!head) continue;
    entries.push({
      repo,
      local_path: localPath,
      head_sha: head.sha,
      head_date: head.date,
      run_started_at: runStart,
    });
  }
  if (!DRY_RUN && !STATS_ONLY) {
    mkdirSync(DB_DIR, { recursive: true });
    writeFileSync(join(DB_DIR, 'resample-manifest.json'), JSON.stringify(entries, null, 2));
  }
  for (const e of entries) {
    console.log(`  manifest: ${e.repo} HEAD=${e.head_sha.slice(0, 7)} (${e.head_date})`);
  }
}

function buildAnalysisContext(cached: CachedCommit): AnalysisContext {
  return {
    diffs: cached.diffs,
    commitMessage: cached.commit_message,
    commitBody: cached.commit_body ?? undefined,
    languages: cached.languages,
    repo: cached.repo,
    sha: cached.commit_sha,
  };
}

interface RunStats {
  commitsScanned: number;
  commitsWithFinding: number;
  scoreDistribution: Record<number, number>;
  byModule: Record<string, number>;
}

async function runModules(ctx: AnalysisContext): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const mod of MODULE_REGISTRY) {
    const languages = (mod as unknown as { applicableLanguages?: string[] }).applicableLanguages;
    if (languages && !languages.some((l) => ctx.languages.includes(l))) continue;
    try {
      const result = await mod.analyze(ctx);
      if (result) findings.push(result);
    } catch (err) {
      console.warn(`  module ${mod.id} threw on ${ctx.sha.slice(0, 7)}: ${String(err)}`);
    }
  }
  return findings;
}

function insertCommit(db: ReturnType<typeof openDb>, c: CachedCommit, authorLogin: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO commit_cache
      (commit_sha, repo, author_login, author_email, commit_date, commit_message, commit_body, diff_json, languages_json, files_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    c.commit_sha,
    c.repo,
    authorLogin,
    c.author_email,
    c.commit_date,
    c.commit_message,
    c.commit_body,
    JSON.stringify(c.diffs),
    JSON.stringify(c.languages),
    c.files_count,
  );
}

function insertSignal(
  db: ReturnType<typeof openDb>,
  commitSha: string,
  repo: string,
  authorLogin: string,
  tenantId: string | null,
  commitDate: string,
  finding: Finding,
): void {
  db.prepare(`
    INSERT OR IGNORE INTO simulated_signals
      (commit_sha, repo, author_login, tenant_id, module_id, finding_score, finding_text, commit_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    commitSha,
    repo,
    authorLogin,
    tenantId,
    finding.moduleId,
    finding.interestScore,
    JSON.stringify({
      aspect: finding.aspect,
      finding: finding.finding,
      technicalDetail: finding.technicalDetail,
      plainLanguage: finding.plainLanguage,
      contextHint: finding.contextHint,
    }),
    commitDate,
  );
}

async function main(): Promise<void> {
  const authorsCfg = parseAuthorsConfig();
  const authorEmails = parseAuthorEmails();
  const reposRoot = process.env['REPOS_ROOT'] ?? join(homedir(), 'Documents/git');

  const mode = STATS_ONLY ? 'stats-only' : DRY_RUN ? 'dry-run' : 'write';
  console.log(`\n[resample] mode=${mode} | authors=[${authorsCfg.included.join(', ')}] | reposRoot=${reposRoot}\n`);

  // Only open DB in write mode
  const db = STATS_ONLY ? null : openDb();

  // Repo discovery: repos from voice_posts that exist locally.
  const repoLocalByName = await discoverReposForAuthors(authorsCfg.included, reposRoot);
  if (repoLocalByName.size === 0) {
    console.error('[resample] No local repos to scan. Check REPOS_ROOT and clones.');
    process.exit(1);
  }

  // Manifest — HEAD sha per repo (skipped for stats-only).
  if (!STATS_ONLY) writeManifest(repoLocalByName);

  const tenantByLogin = await fetchTenantIdsByLogin(authorsCfg.included);
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Collect list of (repo, sha, author_login) triples to process.
  interface Triple { repo: string; localPath: string; sha: string; authorLogin: string; }
  const allTriples: Triple[] = [];

  for (const login of authorsCfg.included) {
    const emails = authorEmails[login] ?? [];
    if (emails.length === 0) {
      console.warn(`  skip ${login}: no emails discovered`);
      continue;
    }
    for (const [repo, localPath] of repoLocalByName) {
      const rows = listAuthorCommitShas(localPath, emails, login, cutoff);
      for (const row of rows) {
        allTriples.push({ repo, localPath, sha: row.sha, authorLogin: login });
      }
    }
  }

  console.log(`  found ${allTriples.length} candidate commits from local git\n`);

  const stats: RunStats = {
    commitsScanned: 0,
    commitsWithFinding: 0,
    scoreDistribution: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 0])),
    byModule: {},
  };

  // Already-cached shas to skip in write mode
  const cachedShas = new Set<string>();
  if (db) {
    const rows = db.prepare('SELECT commit_sha FROM commit_cache').all() as Array<{ commit_sha: string }>;
    for (const r of rows) cachedShas.add(r.commit_sha);
  }
  // Already-scored shas to skip in write mode
  const scoredShas = new Set<string>();
  if (db) {
    const rows = db.prepare('SELECT DISTINCT commit_sha FROM simulated_signals').all() as Array<{ commit_sha: string }>;
    for (const r of rows) scoredShas.add(r.commit_sha);
  }

  let processed = 0;
  for (const { repo, localPath, sha, authorLogin } of allTriples) {
    processed++;
    if (processed % 25 === 0) {
      console.log(`  progress: ${processed}/${allTriples.length}`);
    }

    // Load commit if not cached (or always, if stats-only / dry-run).
    let cached: CachedCommit | null;
    if (db && cachedShas.has(sha)) {
      const row = db
        .prepare('SELECT * FROM commit_cache WHERE commit_sha = ?')
        .get(sha) as {
        commit_sha: string;
        repo: string;
        author_login: string | null;
        author_email: string | null;
        commit_date: string;
        commit_message: string;
        commit_body: string | null;
        diff_json: string;
        languages_json: string;
        files_count: number;
      };
      cached = {
        commit_sha: row.commit_sha,
        repo: row.repo,
        author_login: row.author_login,
        author_email: row.author_email,
        commit_date: row.commit_date,
        commit_message: row.commit_message,
        commit_body: row.commit_body,
        diffs: JSON.parse(row.diff_json) as FileDiff[],
        languages: JSON.parse(row.languages_json) as string[],
        files_count: row.files_count,
      };
    } else {
      cached = loadCommit(localPath, repo, sha);
      if (!cached) continue;
      if (db && !DRY_RUN) insertCommit(db, cached, authorLogin);
    }

    stats.commitsScanned++;

    // Signal scoring — skip if already scored (in write mode), always run in stats/dry modes.
    if (db && scoredShas.has(sha)) {
      // Count existing signals for stats in subsequent print (read from DB at the end).
      continue;
    }

    const ctx = buildAnalysisContext(cached);
    const findings = await runModules(ctx);

    if (findings.length > 0) stats.commitsWithFinding++;

    for (const f of findings) {
      const score = Math.max(1, Math.min(10, Math.round(f.interestScore)));
      stats.scoreDistribution[score] = (stats.scoreDistribution[score] ?? 0) + 1;
      stats.byModule[f.moduleId] = (stats.byModule[f.moduleId] ?? 0) + 1;

      if (db && !DRY_RUN && !STATS_ONLY) {
        const tenantId = tenantByLogin.get(authorLogin) ?? null;
        insertSignal(db, cached.commit_sha, cached.repo, authorLogin, tenantId, cached.commit_date, f);
      }
    }
  }

  // If write mode and some commits were already scored in previous runs, include those in stats
  if (db && !STATS_ONLY && scoredShas.size > 0) {
    const rows = db
      .prepare(`
        SELECT commit_sha, module_id, finding_score FROM simulated_signals
        WHERE commit_sha IN (${[...scoredShas].map(() => '?').join(',')})
      `)
      .all(...scoredShas) as Array<{ commit_sha: string; module_id: string; finding_score: number }>;
    const commitSet = new Set<string>();
    for (const r of rows) {
      commitSet.add(r.commit_sha);
      const sc = Math.max(1, Math.min(10, r.finding_score));
      stats.scoreDistribution[sc] = (stats.scoreDistribution[sc] ?? 0) + 1;
      stats.byModule[r.module_id] = (stats.byModule[r.module_id] ?? 0) + 1;
    }
    // Commits already in cache + scored are represented in stats
    stats.commitsScanned = Math.max(stats.commitsScanned, cachedShas.size);
    stats.commitsWithFinding = Math.max(stats.commitsWithFinding, commitSet.size);
  }

  printStats(stats);

  // Extra: print bucket candidates (author, repo, topic) with ≥3 signals in any 21d window.
  if (db) printBucketCandidates(db);

  console.log(`\n[resample] Done.\n`);
}

function printStats(stats: RunStats): void {
  const totalFindings = Object.values(stats.scoreDistribution).reduce((a, b) => a + b, 0);
  const fillRate = stats.commitsScanned > 0 ? stats.commitsWithFinding / stats.commitsScanned : 0;

  console.log(`\n=== Resample stats ===`);
  console.log(`  Commits scanned:            ${stats.commitsScanned}`);
  console.log(`  Commits with ≥1 finding:   ${stats.commitsWithFinding} (${(fillRate * 100).toFixed(0)}%)`);
  console.log(`  Total findings:             ${totalFindings}`);
  console.log(`  Score distribution:`);
  for (let i = 1; i <= 10; i++) {
    const n = stats.scoreDistribution[i] ?? 0;
    const bar = '█'.repeat(Math.min(40, Math.floor(n / Math.max(1, totalFindings / 40))));
    console.log(`    ${i.toString().padStart(2)}: ${n.toString().padStart(4)} ${bar}`);
  }
  console.log(`  Findings by module:`);
  const sorted = Object.entries(stats.byModule).sort((a, b) => b[1] - a[1]);
  for (const [mod, n] of sorted) {
    console.log(`    ${mod.padEnd(30)} ${n}`);
  }
}

function printBucketCandidates(db: ReturnType<typeof openDb>): void {
  const buckets = db.prepare(`
    SELECT author_login, repo, module_id, COUNT(*) as n,
           MIN(commit_date) as win_start, MAX(commit_date) as win_end
    FROM simulated_signals
    WHERE commit_date > datetime('now', '-120 days')
    GROUP BY author_login, repo, module_id
    HAVING n >= 3
    ORDER BY n DESC
  `).all() as Array<{ author_login: string; repo: string; module_id: string; n: number; win_start: string; win_end: string }>;

  console.log(`\n=== Bucket candidates (author, repo, topic) with ≥3 signals ===`);
  if (buckets.length === 0) {
    console.log(`  (none)`);
    return;
  }
  for (const b of buckets) {
    const spanDays = (new Date(b.win_end).getTime() - new Date(b.win_start).getTime()) / (1000 * 60 * 60 * 24);
    const in21 = spanDays <= 21 ? ' ★ within-21d' : '';
    console.log(`  ${b.author_login} | ${b.repo} | ${b.module_id}: ${b.n} signals, span=${spanDays.toFixed(0)}d${in21}`);
  }
  const focalCandidates = buckets.filter((b) => {
    const span = (new Date(b.win_end).getTime() - new Date(b.win_start).getTime()) / (1000 * 60 * 60 * 24);
    return span <= 21;
  });
  console.log(`\n  FOCAL candidates (≥3 signals within 21d): ${focalCandidates.length}`);
}

main().catch((err) => {
  console.error('[resample] Unexpected error:', String(err));
  process.exit(1);
});
