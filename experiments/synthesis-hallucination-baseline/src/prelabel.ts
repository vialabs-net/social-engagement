import { openDb } from './lib/db.js';
import { callHaiku, currentCostUsd, COST_CAP_USD } from './lib/anthropic-client.js';
import { splitClaims } from './lib/split-claims.js';
import {
  HAIKU_PRELABEL_SYSTEM,
  buildHaikuPrelabelUser,
} from './prompts/haiku-prelabel.js';
import type { StructuralCheck } from './lib/types.js';
import type { FileDiff } from '../../../src/analysis/types.js';

const DRY_RUN = process.argv.includes('--dry-run');

const VALID_CHECKS: StructuralCheck[] = [
  'grounded',
  'symbol_not_in_diff',
  'number_not_in_diff',
  'file_not_in_diff',
  'frame',
  'needs_human',
];

interface PostRow {
  group_id: string;
  sonnet_output: string;
  declined: number;
}

interface CommitRow {
  commit_sha: string;
  commit_message: string;
  commit_body: string | null;
  diff_json: string;
}

function parseCheck(raw: string): { check: StructuralCheck; evidence: string } {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { check: 'needs_human', evidence: 'prelabel parse failed' };
  try {
    const obj = JSON.parse(match[0]) as { check?: string; evidence?: string };
    const check = obj.check && VALID_CHECKS.includes(obj.check as StructuralCheck)
      ? (obj.check as StructuralCheck)
      : 'needs_human';
    return { check, evidence: obj.evidence ?? '' };
  } catch {
    return { check: 'needs_human', evidence: 'prelabel parse failed' };
  }
}

async function main(): Promise<void> {
  const db = openDb();

  const posts = db
    .prepare(`
      SELECT group_id, sonnet_output, declined
      FROM synthesis_posts
      WHERE declined = 0
    `)
    .all() as PostRow[];

  if (posts.length === 0) {
    console.log('[prelabel] No posts to label (either all declined or generate not run).');
    return;
  }

  console.log(`\n[prelabel] ${posts.length} non-declined posts. Cost so far: $${currentCostUsd().toFixed(4)}\n`);

  if (DRY_RUN) {
    let total = 0;
    for (const p of posts) total += splitClaims(p.sonnet_output).length;
    console.log(`  [DRY RUN] Would label ${total} claims across ${posts.length} posts.\n`);
    return;
  }

  let totalClaims = 0;
  let labeledClaims = 0;

  for (const post of posts) {
    // Already-labeled claim_index set for idempotence
    const existing = db
      .prepare('SELECT claim_index FROM prelabels WHERE group_id = ?')
      .all(post.group_id) as Array<{ claim_index: number }>;
    const existingSet = new Set(existing.map((r) => r.claim_index));

    const claims = splitClaims(post.sonnet_output);
    totalClaims += claims.length;

    if (claims.length === 0) continue;

    // Load commit context once per group
    const groupCommitShas = db
      .prepare(`SELECT commit_shas FROM synthesis_groups WHERE id = ?`)
      .get(post.group_id) as { commit_shas: string } | undefined;
    if (!groupCommitShas) continue;
    const shas = JSON.parse(groupCommitShas.commit_shas) as string[];
    const commits = db
      .prepare(`SELECT commit_sha, commit_message, commit_body, diff_json FROM commit_cache WHERE commit_sha IN (${shas.map(() => '?').join(',')})`)
      .all(...shas) as CommitRow[];

    const diffsText = commits
      .map((c) => {
        const diffs = JSON.parse(c.diff_json) as FileDiff[];
        return diffs.map((d) => `--- ${d.filename}\n${d.patch}`).join('\n');
      })
      .join('\n\n');
    const messagesText = commits
      .map((c) => `[${c.commit_sha.slice(0, 7)}] ${c.commit_message}${c.commit_body ? '\n' + c.commit_body : ''}`)
      .join('\n\n');

    for (let i = 0; i < claims.length; i++) {
      if (existingSet.has(i)) continue;
      if (currentCostUsd() >= COST_CAP_USD) {
        console.warn('[prelabel] Cost cap reached. Aborting.');
        return;
      }

      const claim = claims[i]!;
      const userPrompt = buildHaikuPrelabelUser(claim, diffsText, messagesText);
      const { text } = await callHaiku(HAIKU_PRELABEL_SYSTEM, userPrompt, 256);
      const { check, evidence } = parseCheck(text);

      db.prepare(`
        INSERT INTO prelabels (group_id, claim_index, claim_text, structural_check, evidence)
        VALUES (?, ?, ?, ?, ?)
      `).run(post.group_id, i, claim, check, evidence);

      labeledClaims++;
    }
    console.log(`  ${post.group_id.slice(0, 8)}: ${claims.length} claims labeled`);
  }

  console.log(`\n[prelabel] Done. ${labeledClaims}/${totalClaims} new claims labeled.`);
  console.log(`  Total cost: $${currentCostUsd().toFixed(4)}\n`);
}

main().catch((err) => {
  console.error('[prelabel] Unexpected error:', String(err));
  process.exit(1);
});
