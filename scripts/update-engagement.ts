/**
 * update-engagement.ts
 *
 * CLI tool to manually enter LinkedIn reaction counts for published posts.
 * Run after checking LinkedIn notifications or post analytics.
 *
 * Usage:
 *   npm run update-engagement
 */

import { createInterface } from 'readline/promises';
import { loadConfig } from '../src/config/loader.js';
import { logger } from '../src/utils/logger.js';
import { SqliteStorage } from '../src/voice/sqlite-storage.js';
import { SupabaseStorage } from '../src/voice/supabase-storage.js';
import type { IVoiceStorage, VoicePost } from '../src/voice/storage.js';

const MAX_NORM_REACTIONS = 20;  // reactions count considered "excellent" for personal profile

function computeEngagementScore(editRatio: number, reactions: number, publishedAt: string): number {
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  const ageDays = Math.max(ageMs / (1000 * 60 * 60 * 24), 1);
  const normalized = reactions / Math.sqrt(ageDays + 1) / MAX_NORM_REACTIONS;
  const capped = Math.min(normalized, 1.0);
  return editRatio * 0.6 + capped * 0.4;
}

function formatPost(post: VoicePost): string {
  const preview = (post.published ?? post.ai_draft).slice(0, 120).replace(/\n/g, ' ');
  const date = post.published_at ? new Date(post.published_at).toLocaleDateString('es-CL') : '?';
  const urn = post.linkedin_urn ?? '(no URN)';
  return [
    `  Date:       ${date}`,
    `  Repo:       ${post.repo}`,
    `  edit_ratio: ${post.edit_ratio?.toFixed(2) ?? '?'}`,
    `  URN:        ${urn}`,
    `  Preview:    "${preview}..."`,
  ].join('\n');
}

async function main(): Promise<void> {
  const config = loadConfig();

  const storage: IVoiceStorage = process.env['SUPABASE_URL']
    ? new SupabaseStorage(process.env['SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '')
    : new SqliteStorage(process.env['SQLITE_PATH'] ?? 'data/devcast.db');

  const posts = await storage.getPostsPendingEngagement('linkedin');

  if (posts.length === 0) {
    console.log('\nNo published LinkedIn posts pending engagement data.\n');
    process.exit(0);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log(`\n── Engagement Update (${posts.length} posts pending) ──────────────`);
  console.log('Enter reaction count from LinkedIn. Press Enter to skip.\n');

  let updated = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i]!;
    console.log(`\n[${i + 1}/${posts.length}]`);
    console.log(formatPost(post));

    const answer = await rl.question('  Reactions (Enter to skip): ');
    const trimmed = answer.trim();

    if (!trimmed) {
      console.log('  Skipped.');
      continue;
    }

    const reactions = parseInt(trimmed, 10);
    if (isNaN(reactions) || reactions < 0) {
      console.log('  Invalid number — skipped.');
      continue;
    }

    const editRatio = post.edit_ratio ?? 0.5;
    const publishedAt = post.published_at ?? post.created_at;
    const engagementScore = computeEngagementScore(editRatio, reactions, publishedAt);

    await storage.updateEngagement({
      id: post.id,
      linkedin_urn: post.linkedin_urn ?? '',
      reactions_count: reactions,
      engagement_score: engagementScore,
    });

    console.log(`  Saved — engagement_score: ${engagementScore.toFixed(3)}`);
    logger.info('engagement.updated', { id: post.id, reactions, engagementScore });
    updated++;
  }

  rl.close();

  console.log(`\n── Done — ${updated} of ${posts.length} posts updated ──────────────\n`);
}

main().catch((err) => {
  logger.error('update_engagement.fatal', { error: String(err) });
  process.exit(1);
});
