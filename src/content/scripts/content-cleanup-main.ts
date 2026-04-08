/**
 * Monthly content cleanup entry point.
 *
 * Steps:
 * 1. Delete content_items older than 45 days (cascades to article_chunks)
 * 2. Evaluate source lifecycle (probation/disabled/unreachable transitions)
 * 3. Log engagement metric (posts with vs without industry context)
 *
 * Run: tsx src/content/scripts/content-cleanup-main.ts
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger.js';
import { evaluateSourceLifecycle } from '../source-evaluator.js';

async function main(): Promise<void> {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }

  const db = createClient(supabaseUrl, supabaseKey);

  // 1. Expire old content (45-day window, cascades to article_chunks).
  // Protected sources are permanent corpus anchors and must survive cleanup.
  const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
  const { data: protectedSources, error: protectedError } = await db
    .from('content_sources')
    .select('id')
    .eq('is_protected', true);

  if (protectedError) {
    throw new Error(`Failed to load protected sources before cleanup: ${protectedError.message}`);
  }

  const protectedSourceIds = new Set(
    (protectedSources ?? []).map((row) => (row as { id: string }).id),
  );

  const { data: oldRows, error: oldRowsError } = await db
    .from('content_items')
    .select('id, source_id')
    .lt('week_of', cutoff);

  if (oldRowsError) {
    throw new Error(`Failed to load old content rows before cleanup: ${oldRowsError.message}`);
  }

  const expiredRows = (oldRows ?? []) as Array<{ id: string; source_id: string | null }>;
  const idsToDelete = expiredRows
    .filter((row) => row.source_id === null || !protectedSourceIds.has(row.source_id))
    .map((row) => row.id);
  const retainedProtected = expiredRows.length - idsToDelete.length;

  if (idsToDelete.length === 0) {
    logger.info('content.cleanup.expired', {
      articles_deleted: 0,
      retained_protected: retainedProtected,
      protected_sources: protectedSourceIds.size,
      cutoff,
    });
  } else {
    const { error: expireError } = await db
      .from('content_items')
      .delete()
      .in('id', idsToDelete);

    if (expireError) {
      logger.warn('content.cleanup.expire_error', { error: expireError.message });
    } else {
      logger.info('content.cleanup.expired', {
        articles_deleted: idsToDelete.length,
        retained_protected: retainedProtected,
        protected_sources: protectedSourceIds.size,
        cutoff,
      });
    }
  }

  // 2. Source lifecycle evaluation
  await evaluateSourceLifecycle(db);

  // 3. Engagement metric: posts with vs without industry context
  const { data: engagementData } = await db
    .from('voice_posts')
    .select('ai_draft, edit_ratio, engagement_score')
    .eq('status', 'published')
    .not('edit_ratio', 'is', null);

  const engagementRows = (engagementData ?? []) as Array<{
    ai_draft: string;
    edit_ratio: number | null;
    engagement_score: number | null;
  }>;

  const withContext = engagementRows.filter((r) => r.ai_draft.includes('<industry_context>'));
  const withoutContext = engagementRows.filter((r) => !r.ai_draft.includes('<industry_context>'));

  const avgEditRatio = (arr: typeof engagementRows): number | null => {
    const vals = arr.map((r) => r.edit_ratio).filter((v): v is number => v !== null);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };

  logger.info('content.cleanup.engagement_metric', {
    with_context: { posts: withContext.length, avg_edit_ratio: avgEditRatio(withContext) },
    without_context: { posts: withoutContext.length, avg_edit_ratio: avgEditRatio(withoutContext) },
    note: 'Higher edit_ratio = fewer edits = context adds value',
  });
}

main().catch((err) => {
  logger.error('content.cleanup.fatal', { error: String(err) });
  process.exit(1);
});
