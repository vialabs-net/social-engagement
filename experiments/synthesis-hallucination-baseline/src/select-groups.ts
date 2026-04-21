import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';
import { openDb } from './lib/db.js';
import type { AuthorsConfig, SynthesisGroup } from './lib/types.js';
import type { FileDiff } from '../../../src/analysis/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, '../config');

const DRY_RUN = process.argv.includes('--dry-run');
const WINDOW_DAYS = 21;
const FOCAL_MIN = 3;
const ARCO_MIN_COMMITS = 4;
const ARCO_MIN_TOPICS = 3;
const ARCO_JACCARD_MIN = 0.3;
const ADV_FOCAL_JACCARD_MAX = 0.0;
const ADV_ARCO_JACCARD_MIN = 0.4;

const TARGETS_NORMAL = { organic: 20, adversarial: 5, control: 5 };
const TARGETS_REDUCED = { organic: 14, adversarial: 3, control: 3 };

interface SignalRow {
  commit_sha: string;
  repo: string;
  author_login: string;
  tenant_id: string | null;
  module_id: string;
  finding_score: number;
  commit_date: string;
}

interface CommitRow {
  commit_sha: string;
  repo: string;
  author_login: string | null;
  author_email: string | null;
  commit_date: string;
  commit_message: string;
  commit_body: string | null;
  diff_json: string;
  languages_json: string;
}

// ── Jaccard helpers ─────────────────────────────────────────────────────────

function filesOf(row: CommitRow): Set<string> {
  const diffs = JSON.parse(row.diff_json) as FileDiff[];
  return new Set(diffs.map((d) => d.filename));
}

function jaccard(sets: Set<string>[]): number {
  if (sets.length === 0) return 0;
  const union = new Set<string>();
  for (const s of sets) for (const el of s) union.add(el);
  if (union.size === 0) return 0;
  let intersectionCount = 0;
  for (const el of union) {
    if (sets.every((s) => s.has(el))) intersectionCount++;
  }
  return intersectionCount / union.size;
}

// ── Sliding window helpers ──────────────────────────────────────────────────

function daysBetween(aISO: string, bISO: string): number {
  return (new Date(bISO).getTime() - new Date(aISO).getTime()) / (1000 * 60 * 60 * 24);
}

function findLargestWindow(signalsSorted: SignalRow[], windowDays: number): SignalRow[] {
  if (signalsSorted.length === 0) return [];
  let bestStart = 0;
  let bestLen = 1;
  let l = 0;
  for (let r = 0; r < signalsSorted.length; r++) {
    while (l < r && daysBetween(signalsSorted[l]!.commit_date, signalsSorted[r]!.commit_date) > windowDays) {
      l++;
    }
    const len = r - l + 1;
    if (len > bestLen) {
      bestStart = l;
      bestLen = len;
    }
  }
  return signalsSorted.slice(bestStart, bestStart + bestLen);
}

// ── Main selection logic ───────────────────────────────────────────────────

async function main(): Promise<void> {
  const authorsCfg = JSON.parse(readFileSync(join(CONFIG_DIR, 'authors.json'), 'utf8')) as AuthorsConfig;
  const db = openDb();

  // Idempotence
  const existing = (db.prepare('SELECT COUNT(*) as n FROM synthesis_groups').get() as { n: number }).n;
  if (existing > 0) {
    console.log(`[select-groups] Already have ${existing} groups. Delete db/experiment.db to re-run.`);
    return;
  }

  // Load all signals for included authors in window
  const signalRows = db
    .prepare(`
      SELECT commit_sha, repo, author_login, tenant_id, module_id, finding_score, commit_date
      FROM simulated_signals
      WHERE commit_date > datetime('now', '-120 days')
        AND author_login IN (${authorsCfg.included.map(() => '?').join(',')})
      ORDER BY author_login, repo, module_id, commit_date
    `)
    .all(...authorsCfg.included) as SignalRow[];

  if (signalRows.length === 0) {
    console.error('[select-groups] No signals found. Run npm run resample first.');
    process.exit(1);
  }

  // Load commit_cache as a lookup (sha -> CommitRow)
  const commitRows = db
    .prepare(`
      SELECT commit_sha, repo, author_login, author_email, commit_date,
             commit_message, commit_body, diff_json, languages_json
      FROM commit_cache
    `)
    .all() as CommitRow[];
  const commitBySha = new Map<string, CommitRow>();
  for (const c of commitRows) commitBySha.set(c.commit_sha, c);

  // Group signals by (author, repo, module) and by (author) for ARCO
  const byART = new Map<string, SignalRow[]>();
  const byAuthor = new Map<string, SignalRow[]>();
  for (const s of signalRows) {
    const artKey = `${s.author_login}||${s.repo}||${s.module_id}`;
    const arr = byART.get(artKey) ?? [];
    arr.push(s);
    byART.set(artKey, arr);
    const auArr = byAuthor.get(s.author_login) ?? [];
    auArr.push(s);
    byAuthor.set(s.author_login, auArr);
  }

  const groups: SynthesisGroup[] = [];

  // ── Organic FOCAL ──────────────────────────────────────────────────────
  const focalCandidates: Array<{ key: string; signals: SignalRow[]; spanDays: number }> = [];
  for (const [key, rows] of byART) {
    const sorted = rows.slice().sort((a, b) => a.commit_date.localeCompare(b.commit_date));
    const window = findLargestWindow(sorted, WINDOW_DAYS);
    // Unique by commit_sha within window (in case multiple modules fire on same commit)
    const uniq = new Map<string, SignalRow>();
    for (const s of window) if (!uniq.has(s.commit_sha)) uniq.set(s.commit_sha, s);
    if (uniq.size >= FOCAL_MIN) {
      const arr = [...uniq.values()];
      const span = daysBetween(arr[0]!.commit_date, arr[arr.length - 1]!.commit_date);
      focalCandidates.push({ key, signals: arr, spanDays: span });
    }
  }
  // Sort by signal count desc — biggest/densest first
  focalCandidates.sort((a, b) => b.signals.length - a.signals.length);
  console.log(`\n[select-groups] Organic FOCAL candidates: ${focalCandidates.length}`);

  // ── Organic ARCO ───────────────────────────────────────────────────────
  interface ArcoCandidate {
    author_login: string;
    repo: string;
    topics: string[];
    signals: SignalRow[];
    jaccardVal: number;
    spanDays: number;
  }
  const arcoCandidates: ArcoCandidate[] = [];
  for (const [author, rows] of byAuthor) {
    const sorted = rows.slice().sort((a, b) => a.commit_date.localeCompare(b.commit_date));
    // Use sliding window: for each anchor, extend to +21d
    for (let i = 0; i < sorted.length; i++) {
      const anchor = sorted[i]!;
      const window: SignalRow[] = [anchor];
      for (let j = i + 1; j < sorted.length; j++) {
        if (daysBetween(anchor.commit_date, sorted[j]!.commit_date) <= WINDOW_DAYS) {
          window.push(sorted[j]!);
        } else {
          break;
        }
      }
      const uniqCommits = new Map<string, SignalRow>();
      for (const s of window) if (!uniqCommits.has(s.commit_sha)) uniqCommits.set(s.commit_sha, s);
      if (uniqCommits.size < ARCO_MIN_COMMITS) continue;
      const topics = new Set(window.map((s) => s.module_id));
      if (topics.size < ARCO_MIN_TOPICS) continue;

      const commits = [...uniqCommits.values()];
      const files = commits.map((c) => filesOf(commitBySha.get(c.commit_sha)!)).filter((s) => s.size > 0);
      if (files.length === 0) continue;
      const jac = jaccard(files);
      if (jac < ARCO_JACCARD_MIN) continue;

      // Use the most common repo in the cluster (or first commit's)
      const repoCounts = new Map<string, number>();
      for (const c of commits) repoCounts.set(c.repo, (repoCounts.get(c.repo) ?? 0) + 1);
      const repo = [...repoCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      const spanDays = daysBetween(commits[0]!.commit_date, commits[commits.length - 1]!.commit_date);

      arcoCandidates.push({
        author_login: author,
        repo,
        topics: [...topics],
        signals: commits,
        jaccardVal: jac,
        spanDays,
      });
    }
  }
  // Deduplicate by sha-set
  const arcoSeen = new Set<string>();
  const arcoUnique: ArcoCandidate[] = [];
  for (const a of arcoCandidates) {
    const k = a.signals.map((s) => s.commit_sha).sort().join('|');
    if (arcoSeen.has(k)) continue;
    arcoSeen.add(k);
    arcoUnique.push(a);
  }
  arcoUnique.sort((a, b) => b.signals.length - a.signals.length);
  console.log(`[select-groups] Organic ARCO candidates: ${arcoUnique.length}`);

  // ── Determine mode based on organic pool size ─────────────────────────
  const organicPoolSize = focalCandidates.length + arcoUnique.length;
  let targets: typeof TARGETS_NORMAL;
  let modeLabel: string;
  if (organicPoolSize >= 15) {
    targets = TARGETS_NORMAL;
    modeLabel = 'normal';
  } else if (organicPoolSize >= 6) {
    targets = TARGETS_REDUCED;
    modeLabel = `reduced (only ${organicPoolSize} organic candidates — below 15)`;
  } else {
    console.error(
      `[select-groups] ABORT: only ${organicPoolSize} organic candidates (< 6). ` +
      `Insufficient history. Wait for more data or extend author pool.`,
    );
    process.exit(1);
  }
  console.log(`[select-groups] Mode: ${modeLabel}`);
  console.log(`[select-groups] Targets: ${targets.organic} organic, ${targets.adversarial} adversarial, ${targets.control} control\n`);

  // ── Select FOCAL (prioritize densest buckets; split organic target ~60/40 FOCAL/ARCO) ──
  const focalBudget = Math.min(focalCandidates.length, Math.ceil(targets.organic * 0.6));
  const arcoBudget = Math.min(arcoUnique.length, targets.organic - focalBudget);

  for (let i = 0; i < focalBudget; i++) {
    const c = focalCandidates[i]!;
    const [author_login, repo, topic] = c.key.split('||') as [string, string, string];
    const tenant_id = c.signals[0]?.tenant_id ?? null;
    groups.push({
      id: crypto.randomUUID(),
      author_login,
      tenant_id,
      repo,
      topic,
      variant: 'FOCAL',
      origin: 'organic',
      coherence_score: null,
      commit_shas: c.signals.map((s) => s.commit_sha),
    });
  }
  for (let i = 0; i < arcoBudget; i++) {
    const c = arcoUnique[i]!;
    groups.push({
      id: crypto.randomUUID(),
      author_login: c.author_login,
      tenant_id: c.signals[0]?.tenant_id ?? null,
      repo: c.repo,
      topic: c.topics.join(','),
      variant: 'ARCO',
      origin: 'organic',
      coherence_score: c.jaccardVal,
      commit_shas: c.signals.map((s) => s.commit_sha),
    });
  }

  // ── Adversarial FOCAL: 3 commits, same topic, file Jaccard = 0 ────────
  const advFocalTarget = Math.ceil(targets.adversarial * 0.6);
  const advArcoTarget = targets.adversarial - advFocalTarget;
  let advFocalCount = 0;
  for (const [key, rows] of byART) {
    if (advFocalCount >= advFocalTarget) break;
    const uniqByCommit = new Map<string, SignalRow>();
    for (const r of rows) if (!uniqByCommit.has(r.commit_sha)) uniqByCommit.set(r.commit_sha, r);
    if (uniqByCommit.size < 3) continue;
    // Try combinations of 3 commits from this bucket that have Jaccard = 0
    const commits = [...uniqByCommit.values()];
    for (let i = 0; i < commits.length - 2 && advFocalCount < advFocalTarget; i++) {
      for (let j = i + 1; j < commits.length - 1; j++) {
        for (let k = j + 1; k < commits.length; k++) {
          const picks = [commits[i]!, commits[j]!, commits[k]!];
          const fileSets = picks.map((p) => filesOf(commitBySha.get(p.commit_sha)!)).filter((s) => s.size > 0);
          if (fileSets.length < 3) continue;
          const jac = jaccard(fileSets);
          if (jac <= ADV_FOCAL_JACCARD_MAX) {
            const [author_login, repo, topic] = key.split('||') as [string, string, string];
            groups.push({
              id: crypto.randomUUID(),
              author_login,
              tenant_id: picks[0]!.tenant_id,
              repo,
              topic,
              variant: 'FOCAL',
              origin: 'adversarial',
              coherence_score: jac,
              commit_shas: picks.map((p) => p.commit_sha),
            });
            advFocalCount++;
            break;
          }
        }
        if (advFocalCount >= advFocalTarget) break;
      }
    }
  }

  // ── Adversarial ARCO: 4-5 commits, high file Jaccard, ≥3 unrelated topics ──
  let advArcoCount = 0;
  for (const [author, rows] of byAuthor) {
    if (advArcoCount >= advArcoTarget) break;
    const sorted = rows.slice().sort((a, b) => a.commit_date.localeCompare(b.commit_date));
    for (let i = 0; i < sorted.length && advArcoCount < advArcoTarget; i++) {
      const anchor = sorted[i]!;
      const window: SignalRow[] = [anchor];
      for (let j = i + 1; j < sorted.length; j++) {
        if (daysBetween(anchor.commit_date, sorted[j]!.commit_date) <= WINDOW_DAYS * 2) {
          window.push(sorted[j]!);
        } else break;
      }
      const uniqCommits = new Map<string, SignalRow>();
      for (const s of window) if (!uniqCommits.has(s.commit_sha)) uniqCommits.set(s.commit_sha, s);
      if (uniqCommits.size < 4) continue;
      const commits = [...uniqCommits.values()].slice(0, 5);
      const topics = new Set(commits.map((c) => c.module_id));
      if (topics.size < 3) continue;
      const fileSets = commits.map((c) => filesOf(commitBySha.get(c.commit_sha)!)).filter((s) => s.size > 0);
      if (fileSets.length < 4) continue;
      const jac = jaccard(fileSets);
      if (jac < ADV_ARCO_JACCARD_MIN) continue;

      const repoCounts = new Map<string, number>();
      for (const c of commits) repoCounts.set(c.repo, (repoCounts.get(c.repo) ?? 0) + 1);
      const repo = [...repoCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0];

      groups.push({
        id: crypto.randomUUID(),
        author_login: author,
        tenant_id: commits[0]!.tenant_id,
        repo,
        topic: [...topics].join(','),
        variant: 'ARCO',
        origin: 'adversarial',
        coherence_score: jac,
        commit_shas: commits.map((c) => c.commit_sha),
      });
      advArcoCount++;
    }
  }

  // ── Control: random 5 commits with MAX(finding_score) ≥ 5 ──────────────
  const controlRows = db
    .prepare(`
      SELECT commit_sha, repo, author_login, tenant_id, module_id, MAX(finding_score) as top_score, commit_date
      FROM simulated_signals
      WHERE finding_score >= 5
        AND commit_date > datetime('now', '-120 days')
        AND author_login IN (${authorsCfg.included.map(() => '?').join(',')})
      GROUP BY commit_sha
      ORDER BY RANDOM()
      LIMIT ?
    `)
    .all(...authorsCfg.included, targets.control) as Array<{
      commit_sha: string; repo: string; author_login: string;
      tenant_id: string | null; module_id: string; top_score: number; commit_date: string;
    }>;

  for (const cp of controlRows) {
    groups.push({
      id: crypto.randomUUID(),
      author_login: cp.author_login,
      tenant_id: cp.tenant_id,
      repo: cp.repo,
      topic: cp.module_id,
      variant: 'SINGLE',
      origin: 'control',
      coherence_score: null,
      commit_shas: [cp.commit_sha],
    });
  }

  // ── Persist ───────────────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log(`\n[dry-run] would insert ${groups.length} groups`);
  } else {
    const insert = db.prepare(`
      INSERT INTO synthesis_groups
        (id, author_login, tenant_id, repo, topic, variant, origin, coherence_score, commit_shas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction((rows: SynthesisGroup[]) => {
      for (const g of rows) {
        insert.run(
          g.id, g.author_login, g.tenant_id, g.repo, g.topic, g.variant, g.origin,
          g.coherence_score, JSON.stringify(g.commit_shas),
        );
      }
    });
    tx(groups);
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const bucketCounts: Record<string, number> = {};
  for (const g of groups) {
    const k = `${g.origin}/${g.variant}`;
    bucketCounts[k] = (bucketCounts[k] ?? 0) + 1;
  }
  console.log(`\n[select-groups] Summary:`);
  for (const [k, n] of Object.entries(bucketCounts)) {
    console.log(`  ${k.padEnd(20)} ${n}`);
  }
  console.log(`  ${'TOTAL'.padEnd(20)} ${groups.length}`);
  if (modeLabel.startsWith('reduced')) {
    console.log(`\n  ⚠  Reduced sample (${organicPoolSize} organic). Results will be directional, not conclusive.`);
  }
  console.log(`\n[select-groups] Done. Next: npm run generate\n`);
}

main().catch((err) => {
  console.error('[select-groups] Unexpected error:', String(err));
  process.exit(1);
});
