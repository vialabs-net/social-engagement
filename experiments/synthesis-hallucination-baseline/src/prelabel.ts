import { openDb } from './lib/db.js';
import { callHaiku } from './lib/anthropic-client.js';
import { HAIKU_PRELABEL_SYSTEM, buildHaikuPrelabelUser } from './prompts/haiku-prelabel.js';
import { splitClaims } from './lib/split-claims.js';
import type { HaikuPrelabelOutput, StructuralCheck } from './lib/types.js';

const DRY_RUN = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  const db = openDb();

  const posts = db.prepare(`
    SELECT sp.group_id, sp.sonnet_output, sp.declined,
           sg.commit_shas, sg.commit_messages, sg.commit_diffs
    FROM synthesis_posts sp
    JOIN synthesis_groups sg ON sg.id = sp.group_id
    WHERE sp.declined = 0
  `).all() as Array<{
    group_id: string;
    sonnet_output: string;
    declined: number;
    commit_shas: string;
    commit_messages: string;
    commit_diffs: string;
  }>;

  if (posts.length === 0) {
    console.log('[prelabel] No non-declined posts found. Run npm run generate first.');
    return;
  }

  console.log(`[prelabel] Labeling ${posts.length} posts...`);

  for (const post of posts) {
    const claims = splitClaims(post.sonnet_output);
    if (claims.length === 0) continue;

    const commitShas: string[] = JSON.parse(post.commit_shas) as string[];
    const commitMessages: string[] = JSON.parse(post.commit_messages) as string[];
    const commitDiffs: string[] = JSON.parse(post.commit_diffs) as string[];

    const diffs = commitShas.map((sha, i) => `=== ${sha.slice(0, 7)} ===\n${commitDiffs[i] ?? ''}`).join('\n\n');
    const messages = commitMessages.join('\n');

    for (let idx = 0; idx < claims.length; idx++) {
      const claim = claims[idx]!;

      // Skip if already labeled
      const existing = db.prepare(
        'SELECT id FROM prelabels WHERE group_id = ? AND claim_index = ?',
      ).get(post.group_id, idx);
      if (existing) continue;

      if (DRY_RUN) {
        console.log(`  [dry-run] prelabel group=${post.group_id.slice(0, 8)} claim[${idx}]: "${claim.slice(0, 60)}..."`);
        continue;
      }

      try {
        const userPrompt = buildHaikuPrelabelUser(claim, diffs, messages);
        const { text } = await callHaiku(HAIKU_PRELABEL_SYSTEM, userPrompt);

        let parsed: HaikuPrelabelOutput | null = null;
        try {
          const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
          parsed = JSON.parse(cleaned) as HaikuPrelabelOutput;
        } catch {
          parsed = null;
        }

        const check: StructuralCheck = parsed?.check ?? 'needs_human';
        const evidence = parsed?.evidence ?? 'Parse error — needs human review';

        db.prepare(`
          INSERT OR IGNORE INTO prelabels (group_id, claim_index, claim_text, structural_check, evidence)
          VALUES (?, ?, ?, ?, ?)
        `).run(post.group_id, idx, claim, check, evidence);
      } catch (err) {
        const msg = String(err);
        if (msg.includes('Cost cap')) {
          console.error(`[prelabel] Cost cap reached: ${msg}`);
          process.exit(1);
        }
        console.error(`  [error] group=${post.group_id.slice(0, 8)} claim[${idx}]: ${msg}`);
      }
    }

    console.log(`  [done] group ${post.group_id.slice(0, 8)} — ${claims.length} claims labeled`);
  }

  console.log('\n[prelabel] Done. Run npm run export next.\n');
}

main().catch((err) => {
  console.error('[prelabel] Fatal:', String(err));
  process.exit(1);
});
