import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { getSupabaseReadonly } from './lib/supabase-readonly.js';
import { openDb } from './lib/db.js';
import { assertGitAvailable, repoLocalPath, discoverAuthorEmails } from './lib/git-local.js';
import type {
  AuthorsConfig,
  AuthorEmails,
  VoiceProfileCacheEntry,
} from './lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '../db');
const CONFIG_DIR = join(__dirname, '../config');
const WINDOW_DAYS = 120;

interface PreflightReport {
  timestamp: string;
  passed: boolean;
  checks: Array<{ name: string; status: 'ok' | 'fail'; detail: string }>;
  author_stats?: Record<string, { commits: number; emails: string[]; repos: string[] }>;
  repos_found?: string[];
  repos_missing?: string[];
}

function abort(message: string): never {
  console.error(`\n[preflight] ABORT: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const report: PreflightReport = {
    timestamp: new Date().toISOString(),
    passed: false,
    checks: [],
  };

  const ok = (name: string, detail: string) => {
    console.log(`  ✓ ${name}: ${detail}`);
    report.checks.push({ name, status: 'ok', detail });
  };

  const fail = (name: string, detail: string): never => {
    report.checks.push({ name, status: 'fail', detail });
    mkdirSync(DB_DIR, { recursive: true });
    writeFileSync(join(DB_DIR, 'preflight-report.json'), JSON.stringify(report, null, 2));
    abort(detail);
  };

  console.log('\n[preflight] Starting checks (v1.4 — commit-stream resampling)...\n');

  // 1. Env vars
  const required = ['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  for (const key of required) {
    if (!process.env[key]) fail(`env.${key}`, `${key} is not set`);
    ok(`env.${key}`, 'present');
  }

  // 2. Git available
  try {
    const version = assertGitAvailable();
    ok('env.git', version);
  } catch (err) {
    fail('env.git', String(err));
  }

  // 3. REPOS_ROOT
  const reposRoot = process.env['REPOS_ROOT'] ?? join(homedir(), 'Documents/git');
  if (!existsSync(reposRoot)) {
    fail('env.REPOS_ROOT', `${reposRoot} does not exist. Set REPOS_ROOT env var or clone repos there.`);
  }
  ok('env.REPOS_ROOT', reposRoot);

  // 4. authors.json
  const authorsPath = join(CONFIG_DIR, 'authors.json');
  if (!existsSync(authorsPath)) fail('config.authors', `${authorsPath} missing`);
  const authorsCfg = JSON.parse(readFileSync(authorsPath, 'utf8')) as AuthorsConfig;
  if (!Array.isArray(authorsCfg.included) || authorsCfg.included.length === 0) {
    fail('config.authors', 'authors.json#included must list at least one author');
  }
  ok('config.authors', `included: ${authorsCfg.included.join(', ')}`);

  // 5. Supabase SELECT connectivity
  const supabase = getSupabaseReadonly();
  const { error: connError } = await supabase.from('voice_profiles').select('github_author_login').limit(1);
  if (connError) fail('supabase.connect', `Cannot query voice_profiles: ${connError.message}`);
  ok('supabase.connect', 'SELECT access confirmed — no writes will be made');

  // 6. Schema checks via direct column probes (PostgREST does not expose information_schema)
  const { error: vpProbe } = await supabase.from('voice_profiles').select('tenant_id, github_author_login').limit(1);
  if (vpProbe) fail('schema.voice_profiles', `Missing columns. ${String(vpProbe)}`);
  ok('schema.voice_profiles', 'tenant_id + github_author_login present');

  const { error: vPostsProbe } = await supabase.from('voice_posts').select('author_login, repo, commit_sha').limit(1);
  if (vPostsProbe) fail('schema.voice_posts', `Missing columns. ${String(vPostsProbe)}`);
  ok('schema.voice_posts', 'author_login + repo + commit_sha present');

  // 7. Voice profiles for each included author
  const { data: profiles, error: profError } = await supabase
    .from('voice_profiles')
    .select('tenant_id, github_author_login, voice, updated_at')
    .in('github_author_login', authorsCfg.included);
  if (profError) fail('data.voice_profiles', `Query failed: ${profError.message}`);

  const latestByLogin = new Map<string, VoiceProfileCacheEntry>();
  for (const row of (profiles ?? []) as Array<VoiceProfileCacheEntry & { updated_at?: string }>) {
    const prev = latestByLogin.get(row.github_author_login);
    if (!prev) latestByLogin.set(row.github_author_login, row);
    // if multiple rows per login, the .in() returns all; keep any (they'll be same current record)
  }
  const missingProfiles = authorsCfg.included.filter((login) => !latestByLogin.has(login));
  if (missingProfiles.length > 0) {
    fail(
      'data.voice_profiles',
      `No voice_profile for: ${missingProfiles.join(', ')}. Exclude from config/authors.json or onboard these authors first.`,
    );
  }
  const profileCache: VoiceProfileCacheEntry[] = [...latestByLogin.values()];
  mkdirSync(DB_DIR, { recursive: true });
  writeFileSync(join(DB_DIR, 'voice-profiles-cache.json'), JSON.stringify(profileCache, null, 2));
  ok('data.voice_profiles', `${profileCache.length} profile(s) cached`);

  // 8. Discover distinct repos referenced in voice_posts by included authors
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: repoRows, error: repoErr } = await supabase
    .from('voice_posts')
    .select('repo, author_login')
    .gte('created_at', cutoff)
    .in('author_login', authorsCfg.included)
    .not('repo', 'is', null);
  if (repoErr) fail('data.voice_posts_repos', `Query failed: ${repoErr.message}`);

  const reposByAuthor = new Map<string, Set<string>>();
  const allRepos = new Set<string>();
  for (const row of (repoRows ?? []) as Array<{ repo: string; author_login: string }>) {
    allRepos.add(row.repo);
    if (!reposByAuthor.has(row.author_login)) reposByAuthor.set(row.author_login, new Set());
    reposByAuthor.get(row.author_login)!.add(row.repo);
  }

  const foundRepos: string[] = [];
  const missingRepos: string[] = [];
  const repoLocalByName = new Map<string, string>();
  for (const repo of allRepos) {
    const local = repoLocalPath(reposRoot, repo);
    if (local) {
      foundRepos.push(local);
      repoLocalByName.set(repo, local);
    } else {
      missingRepos.push(repo);
    }
  }
  report.repos_found = foundRepos;
  report.repos_missing = missingRepos;

  if (foundRepos.length === 0) {
    fail('local_repos', `No local clones under ${reposRoot}. Expected: ${[...allRepos].join(', ')}`);
  }
  ok('local_repos', `${foundRepos.length}/${allRepos.size} repos present locally`);
  if (missingRepos.length > 0) {
    console.warn(`  ⚠  Missing repos (skipped during resample): ${missingRepos.join(', ')}`);
  }

  // 9. Author emails discovery — scan only repos where the author actually appears
  const authorEmails: AuthorEmails = {};
  for (const login of authorsCfg.included) {
    const authorRepos = [...(reposByAuthor.get(login) ?? [])]
      .map((r) => repoLocalByName.get(r))
      .filter((p): p is string => Boolean(p));

    const emails = new Set<string>();
    for (const repoPath of authorRepos) {
      for (const email of discoverAuthorEmails(repoPath, login)) emails.add(email);
    }
    // Also scan ALL found repos as fallback — some authors commit to repos not
    // yet registered in voice_posts.
    if (emails.size === 0) {
      for (const repoPath of foundRepos) {
        for (const email of discoverAuthorEmails(repoPath, login)) emails.add(email);
      }
    }
    authorEmails[login] = [...emails];
  }
  writeFileSync(join(DB_DIR, 'author-emails.json'), JSON.stringify(authorEmails, null, 2));

  const authorsWithNoEmail = authorsCfg.included.filter((l) => (authorEmails[l]?.length ?? 0) === 0);
  if (authorsWithNoEmail.length > 0) {
    fail(
      'author_emails',
      `No git emails discovered for: ${authorsWithNoEmail.join(', ')}. ` +
      `Their commits in local repos cannot be located by --author. ` +
      `Either clone additional repos or remove these logins from config/authors.json.`,
    );
  }
  ok('author_emails', Object.entries(authorEmails).map(([l, es]) => `${l}(${es.length})`).join(', '));

  // 10. Per-author commit count sanity — ≥1 commit each in last 120d across found repos
  const { execFileSync } = await import('child_process');
  const sinceArg = `--since=${cutoff}`;
  const authorStats: Record<string, { commits: number; emails: string[]; repos: string[] }> = {};

  for (const login of authorsCfg.included) {
    const emails = authorEmails[login] ?? [];
    const reposHit = new Set<string>();
    let commits = 0;

    for (const repoPath of foundRepos) {
      const args = ['-C', repoPath, 'log', '--all', sinceArg, '--format=%H'];
      args.push(`--author=${login}@`);
      args.push(`--author=${login} <`);
      for (const email of emails) args.push(`--author=<${email}>`);
      try {
        const out = execFileSync('git', args, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          maxBuffer: 32 * 1024 * 1024,
        });
        const count = out.split('\n').filter(Boolean).length;
        if (count > 0) {
          commits += count;
          reposHit.add(repoPath.split('/').pop() ?? repoPath);
        }
      } catch { /* skip unreadable repo */ }
    }
    authorStats[login] = { commits, emails, repos: [...reposHit] };
  }
  report.author_stats = authorStats;

  const authorsWithZero = Object.entries(authorStats).filter(([, s]) => s.commits === 0);
  if (authorsWithZero.length > 0) {
    const names = authorsWithZero.map(([a]) => a).join(', ');
    fail(
      'author_local_commits',
      `Authors with 0 local commits in last ${WINDOW_DAYS}d: ${names}. ` +
      `Missing repos detected: ${missingRepos.join(', ') || 'none'}. ` +
      `Clone relevant repos under ${reposRoot} or move these authors to config/authors.json#excluded.`,
    );
  }

  console.log('\n  Author → local commits (last 120d):');
  for (const [login, s] of Object.entries(authorStats)) {
    console.log(`    ${login}: ${s.commits} commits across ${s.repos.length} repo(s) [${s.repos.join(', ')}] (${s.emails.length} email(s))`);
  }
  ok('author_local_commits', `${Object.keys(authorStats).length} authors with ≥1 commit locally`);

  // All checks passed
  report.passed = true;
  writeFileSync(join(DB_DIR, 'preflight-report.json'), JSON.stringify(report, null, 2));

  // Initialize SQLite DB (creates tables if they don't exist)
  openDb();

  console.log('\n[preflight] All checks passed. preflight-report.json written.\n');
  console.log('  Next: npm run resample  (then npm run resample:stats)\n');
}

main().catch((err) => {
  console.error('[preflight] Unexpected error:', String(err));
  process.exit(1);
});
