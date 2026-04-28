/**
 * replay-commit.ts — end-to-end replay of a commit through the full pipeline.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/replay-commit.ts <owner/repo> <sha> [author-login] [branch-ref]
 *
 * Example:
 *   npx tsx --env-file=.env.local scripts/replay-commit.ts microboxlabs/ecm-coordinator f9e98b12fe4863adb1f764617558f38bfc1efc0d korutx refs/heads/JDWP-debug-port
 *
 * Captures all pipeline stages to stdout. Use > out.json to save.
 */

import { GitHubClient } from '../src/github/client.js';
import { enrichCommit } from '../src/github/commit-enricher.js';
import { runPipeline } from '../src/analysis/pipeline.js';
import { buildSystemPrompt, buildUserPrompt } from '../src/ai/prompt-builder.js';
import { AnthropicAdapter } from '../src/ai/anthropic-adapter.js';
import { SupabaseStorage } from '../src/voice/supabase-storage.js';
import { DEFAULT_VOICE_PROFILE } from '../src/config/schema.js';

const SEP = '─'.repeat(72);

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fullRepo = args[0];
  const sha = args[1];
  const authorLogin = args[2] ?? null;
  const branchRef = args[3] ?? undefined;

  if (!fullRepo || !sha || !fullRepo.includes('/')) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/replay-commit.ts <owner/repo> <sha> [author-login] [branch-ref]');
    process.exit(1);
  }

  const [owner, repo] = fullRepo.split('/') as [string, string];

  const githubToken = process.env['GITHUB_TOKEN'] ?? '';
  const anthropicKey = process.env['ANTHROPIC_API_KEY'] ?? '';
  const supabaseUrl = process.env['SUPABASE_URL'] ?? '';
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  const tenantId = process.env['TENANT_ID'] ?? 'default';

  if (!githubToken) { console.error('GITHUB_TOKEN not set'); process.exit(1); }
  if (!anthropicKey) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }

  // ── Stage 1: Enrich commit ──────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('STAGE 1 — enrichCommit');
  console.log(SEP);

  const githubClient = new GitHubClient(githubToken);
  let commit;
  try {
    commit = await enrichCommit(githubClient, owner, repo, sha, authorLogin, branchRef);
  } catch (e) {
    console.error('enrichCommit failed:', String(e));
    process.exit(1);
  }

  console.log(`repo:          ${commit.repo}`);
  console.log(`sha:           ${commit.sha}`);
  console.log(`message:       ${commit.message}`);
  console.log(`isPrivateRepo: ${commit.isPrivateRepo}`);
  console.log(`totalAdditions:${commit.totalAdditions}  totalDeletions:${commit.totalDeletions}`);
  console.log(`languages:     ${commit.languages.join(', ') || 'none'}`);
  console.log(`files (${commit.diffs.length}):`);
  for (const d of commit.diffs) {
    console.log(`  ${d.filename} [${d.status}] +${d.additions}/-${d.deletions} lang=${d.language ?? 'unknown'}`);
  }

  // ── Stage 2: Module inputs (what each module sees after filters) ─────────
  // (Shown implicitly via pipeline findings below; full per-module log omitted
  //  to keep output readable. The regression test covers the exact inputs.)

  // ── Stage 3: Run all 24 modules ─────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('STAGE 3 — runPipeline (24 modules)');
  console.log(SEP);

  const { findings } = await runPipeline({
    diffs: commit.diffs,
    commitMessage: commit.message,
    commitBody: commit.body,
    languages: commit.languages,
    repo: commit.repo,
    sha: commit.sha,
  });

  if (findings.length === 0) {
    console.log('\n✗ No findings passed the interest threshold.');
    console.log('  → Pipeline would SKIP this commit. No Claude call. No post generated.');
    console.log('\nVerdict: NO POST — commit does not meet interest threshold.\n');
    process.exit(0);
  }

  console.log(`\n${findings.length} finding(s) ranked by adjusted score:\n`);
  for (const f of findings) {
    console.log(`  [${'★'.repeat(f.interestScore)}${' '.repeat(10 - f.interestScore)}] score=${f.interestScore} module=${f.moduleId}`);
    console.log(`    aspect:  ${f.aspect}`);
    console.log(`    finding: ${f.finding}`);
    if (f.evidence?.after) console.log(`    evidence after: ${f.evidence.after.slice(0, 120)}`);
    console.log('');
  }

  // ── Stage 4: Load voice profile ─────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log(`STAGE 4 — voice profile for author: ${authorLogin ?? '(none)'}`);
  console.log(SEP);

  let voiceProfile = DEFAULT_VOICE_PROFILE;
  if (supabaseUrl && supabaseKey && authorLogin) {
    try {
      const storage = new SupabaseStorage(supabaseUrl, supabaseKey, tenantId);
      const stored = await storage.getVoiceProfile(authorLogin);
      if (stored) {
        voiceProfile = stored.voice;
        console.log(`Found voice profile for ${authorLogin}: tone=${voiceProfile.tone}, source=${stored.source}`);
      } else {
        console.log(`No voice profile found for ${authorLogin} — using DEFAULT_VOICE_PROFILE`);
      }
    } catch (e) {
      console.warn(`Voice profile fetch failed (${String(e)}) — using DEFAULT_VOICE_PROFILE`);
    }
  } else {
    console.log('No Supabase config or author login — using DEFAULT_VOICE_PROFILE');
  }

  console.log(`profile: tone=${voiceProfile.tone} rhythm=${voiceProfile.rhythm ?? 'default'} max=${voiceProfile.post_length.max}chars`);

  // ── Stage 5: Build prompt ────────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('STAGE 5 — buildUserPrompt');
  console.log(SEP);

  const minConfig = {
    author: { name: authorLogin ?? 'developer', github_login: authorLogin ?? '' },
    platforms: { linkedin: { enabled: true }, instagram: { enabled: false } },
    pipeline: { max_daily_posts_per_author: 2 },
    voice: voiceProfile,
  } as never;

  const systemPrompt = buildSystemPrompt(
    minConfig,
    voiceProfile,
    { stage: 'cold', exposurePool: [], bootstrapPosts: [], commitSha: commit.sha, draftIndexToday: 0 },
  );

  const userPrompt = buildUserPrompt(commit, findings);

  console.log('\n[userPrompt excerpt — first 1500 chars]');
  console.log(userPrompt.slice(0, 1500));
  if (userPrompt.length > 1500) console.log(`... [${userPrompt.length - 1500} more chars]`);

  // ── Stage 6: Claude call ─────────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('STAGE 6 — Claude generation');
  console.log(SEP);

  const ai = new AnthropicAdapter(anthropicKey);
  let rawResponse: string;
  try {
    rawResponse = await ai.complete(systemPrompt, userPrompt);
  } catch (e) {
    console.error('Claude call failed:', String(e));
    process.exit(1);
  }

  // ── Stage 7: Parse and display final post ───────────────────────────────
  console.log(`\n${SEP}`);
  console.log('STAGE 7 — final post');
  console.log(SEP);

  const postMatch = rawResponse.match(/<post_draft>([\s\S]*?)<\/post_draft>/);
  const shortMatch = rawResponse.match(/<short_draft>([\s\S]*?)<\/short_draft>/);

  if (!postMatch || !shortMatch) {
    console.error('Claude response missing XML tags. Raw response:');
    console.error(rawResponse);
    process.exit(1);
  }

  const mainPost = (postMatch[1] ?? '').trim();
  const shortPost = (shortMatch[1] ?? '').trim();

  console.log('\n── MAIN POST ──────────────────────────────────────────────────────────\n');
  console.log(mainPost);
  console.log('\n── SHORT VARIANT ──────────────────────────────────────────────────────\n');
  console.log(shortPost);
  console.log(`\n── STATS ──────────────────────────────────────────────────────────────`);
  console.log(`main post: ${mainPost.length} chars (max ${voiceProfile.post_length.max})`);
  console.log(`short:     ${shortPost.length} chars`);
  console.log(`top module: ${findings[0]?.moduleId} (score ${findings[0]?.interestScore})`);
  console.log(`private repo: ${commit.isPrivateRepo}`);
  console.log('');
}

main().catch((err) => {
  console.error('Fatal:', String(err));
  process.exit(1);
});
