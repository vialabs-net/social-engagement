import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { getSupabaseReadonly } from './lib/supabase-readonly.js';
import { openDb } from './lib/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '../db');
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

  // 1. Credentials
  const required = ['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  for (const key of required) {
    if (!process.env[key]) fail(`env.${key}`, `${key} is not set`);
    ok(`env.${key}`, 'present');
  }
  // GITHUB_TOKEN is no longer required — resampling reads from local git clones
  if (!process.env['GITHUB_TOKEN']) {
    console.log('  ℹ  env.GITHUB_TOKEN: not set (local-git mode — OK)');
  } else {
    ok('env.GITHUB_TOKEN', 'present (unused by resampling, kept for legacy)');
  }

  // 2. git CLI available
  try {
    const gitVersion = execFileSync('git', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    ok('env.git', gitVersion);
  } catch {
    fail('env.git', 'git CLI not found in PATH');
  }

  // 3. REPOS_ROOT exists
  const reposRoot = process.env['REPOS_ROOT'] ?? join(homedir(), 'Documents/git');
  if (!existsSync(reposRoot)) {
    fail('env.REPOS_ROOT', `${reposRoot} does not exist. Set REPOS_ROOT env var or clone repos there.`);
  }
  ok('env.REPOS_ROOT', reposRoot);

  // 4. Supabase connectivity (SELECT only)
  const supabase = getSupabaseReadonly();
  const { error: connError } = await supabase.from('voice_posts').select('id').limit(1);
  if (connError) fail('supabase.connect', `Cannot query voice_posts: ${connError.message}`);
  ok('supabase.connect', 'SELECT access confirmed — no writes will be made');

  // 5. voice_profiles schema
  const { error: vprofProbeError } = await supabase
    .from('voice_profiles')
    .select('tenant_id, github_author_login')
    .limit(1);
  if (vprofProbeError) {
    fail(
      'schema.voice_profiles',
      'voice_profiles schema does not match expected (missing tenant_id or github_author_login). ' +
      `Error: ${String(vprofProbeError)}.`,
    );
  }
  ok('schema.voice_profiles', 'expected columns present');

  // 6. voice_profiles data — ≥ 3 distinct authors
  const { data: profiles, error: profError } = await supabase
    .from('voice_profiles')
    .select('tenant_id, github_author_login')
    .not('github_author_login', 'is', null);
  if (profError) fail('data.voice_profiles', `Query failed: ${profError.message}`);
  const distinctAuthors = [...new Set((profiles ?? []).map((p) => p.github_author_login as string))];
  if (distinctAuthors.length < 3) {
    fail('data.voice_profiles', `Only ${distinctAuthors.length} distinct author profile(s) found. Minimum 3 required.`);
  }
  ok('data.voice_profiles', `${distinctAuthors.length} distinct author profiles: ${distinctAuthors.join(', ')}`);

  // 7. Discover repos referenced in voice_posts (last 120d) and check local clones
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: repoRows, error: repoError } = await supabase
    .from('voice_posts')
    .select('repo')
    .gte('created_at', cutoff)
    .not('repo', 'is', null);
  if (repoError) fail('supabase.voice_posts_repos', `Query failed: ${repoError.message}`);
  const distinctRepos = [...new Set((repoRows ?? []).map((r) => r.repo as string))];
  const foundRepos: string[] = [];
  const missingRepos: string[] = [];
  for (const repo of distinctRepos) {
    const [, repoName] = repo.split('/');
    if (!repoName) {
      missingRepos.push(repo);
      continue;
    }
    const localPath = join(reposRoot, repoName);
    if (existsSync(join(localPath, '.git'))) foundRepos.push(localPath);
    else missingRepos.push(repo);
  }
  report.repos_found = foundRepos;
  report.repos_missing = missingRepos;
  if (foundRepos.length === 0) {
    fail('local_repos', `No local clones found under ${reposRoot}. Expected: ${distinctRepos.join(', ')}`);
  }
  ok('local_repos', `${foundRepos.length}/${distinctRepos.length} repos present locally`);
  if (missingRepos.length > 0) {
    console.warn(`  ⚠  Missing repos (commits from these will have empty diffs): ${missingRepos.join(', ')}`);
  }

  // 8. Per-author local commit presence (last 120d)
  const sinceArg = `--since=${cutoff}`;
  const authorStats: Record<string, { commits: number; emails: string[]; repos: string[] }> = {};

  for (const login of distinctAuthors) {
    const emails = new Set<string>();
    const reposHit = new Set<string>();
    let commits = 0;
    const loginLower = login.toLowerCase();

    for (const repoPath of foundRepos) {
      try {
        const out = execFileSync(
          'git',
          ['-C', repoPath, 'log', '--all', sinceArg, '--format=%an|%ae|%H'],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 },
        );
        let repoMatched = false;
        for (const line of out.split('\n').filter(Boolean)) {
          const parts = line.split('|');
          const name = parts[0] ?? '';
          const email = parts[1] ?? '';
          const nameLower = name.toLowerCase();
          const emailLocal = email.split('@')[0]?.toLowerCase() ?? '';
          // Tight match: login appears in name OR is the email local-part (or prefix thereof)
          if (nameLower.includes(loginLower) || emailLocal === loginLower || emailLocal.startsWith(loginLower + '+')) {
            emails.add(email);
            commits++;
            repoMatched = true;
          }
        }
        if (repoMatched) reposHit.add(repoPath.split('/').pop() ?? repoPath);
      } catch {
        /* skip unreadable repo */
      }
    }
    authorStats[login] = { commits, emails: [...emails], repos: [...reposHit] };
  }
  report.author_stats = authorStats;

  const authorsWithZero = Object.entries(authorStats).filter(([, s]) => s.commits === 0);
  if (authorsWithZero.length > 0) {
    const names = authorsWithZero.map(([a]) => a).join(', ');
    const hint = missingRepos.length > 0
      ? ` Missing repos in voice_posts that you may need to clone: ${missingRepos.join(', ')}.`
      : '';
    fail(
      'author_local_commits',
      `Authors with 0 local commits in last ${WINDOW_DAYS}d: ${names}.${hint} ` +
      `Clone the relevant repos under ${reposRoot} or remove these profiles from voice_profiles.`,
    );
  }

  console.log('\n  Author → local commits (last 120d):');
  for (const [login, s] of Object.entries(authorStats)) {
    console.log(`    ${login}: ${s.commits} commits across ${s.repos.length} repo(s) [${s.repos.join(', ')}] (${s.emails.length} email(s))`);
  }
  ok('author_local_commits', `${Object.keys(authorStats).length} authors with ≥1 commit locally`);

  // All checks passed
  report.passed = true;
  mkdirSync(DB_DIR, { recursive: true });
  writeFileSync(join(DB_DIR, 'preflight-report.json'), JSON.stringify(report, null, 2));

  // Initialize SQLite DB (ensures new v1.4 tables exist)
  openDb();

  console.log('\n[preflight] All checks passed. preflight-report.json written.\n');
  console.log('  Ready to run: npm run select\n');
}

main().catch((err) => {
  console.error('[preflight] Unexpected error:', String(err));
  process.exit(1);
});
