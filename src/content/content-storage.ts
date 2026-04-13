import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import type { ContentSource } from './types.js';

export interface ArticleToStore {
  readonly sourceId: string;
  readonly weekOf: string;   // ISO date YYYY-MM-DD
  readonly url: string;
  readonly title: string;
  readonly contentText: string;
  readonly summary: string;
  readonly mainThesis: string;
  readonly keyInsights: string[];
  readonly techConcepts: string[];
  readonly seedModules?: string[] | null;
  readonly qualityScore: number;
  readonly titleHash: string;
  readonly fingerprint: string;
}

export interface ChunkToStore {
  readonly contentItemId: string;
  readonly chunkIndex: number;
  readonly chunkText: string;
  readonly embedding: number[];
}

/**
 * Stores a classified article and its chunks+embeddings.
 * Returns the inserted content_item id, or null on failure.
 */
export async function storeArticle(
  db: SupabaseClient,
  article: ArticleToStore,
): Promise<string | null> {
  const { data, error } = await db
    .from('content_items')
    .insert({
      source_id: article.sourceId,
      week_of: article.weekOf,
      url: article.url,
      title: article.title,
      content_text: article.contentText,
      summary: article.summary,
      main_thesis: article.mainThesis,
      key_insights: article.keyInsights,
      tech_concepts: article.techConcepts,
      seed_modules: article.seedModules ?? null,
      quality_score: article.qualityScore,
      title_hash: article.titleHash,
      fingerprint: article.fingerprint,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      // Unique constraint on url — already stored
      logger.info('content.storage.article_exists', { url: article.url });
    } else {
      logger.warn('content.storage.article_error', { url: article.url, error: error.message });
    }
    return null;
  }

  return (data as { id: string }).id;
}

/**
 * Bulk-stores article chunks with their embeddings.
 * Uses upsert to handle re-runs gracefully (UNIQUE on content_item_id, chunk_index).
 */
export async function storeChunks(db: SupabaseClient, chunks: ChunkToStore[]): Promise<void> {
  if (chunks.length === 0) return;

  const rows = chunks.map((c) => ({
    content_item_id: c.contentItemId,
    chunk_index: c.chunkIndex,
    chunk_text: c.chunkText,
    embedding: JSON.stringify(c.embedding),
  }));

  const { error } = await db
    .from('article_chunks')
    .upsert(rows, { onConflict: 'content_item_id,chunk_index' });

  if (error) {
    logger.warn('content.storage.chunks_error', {
      contentItemId: chunks[0]?.contentItemId,
      error: error.message,
    });
    throw new Error(`Failed to store chunks: ${error.message}`);
  }
}

/**
 * Loads title hashes and fingerprints for dedup checks.
 * Loads only items from the last 45 days to match the content expiry window.
 */
export async function loadDedupData(db: SupabaseClient): Promise<{
  hashes: Set<string>;
  fingerprints: Array<{ title: string; fingerprint: string }>;
}> {
  const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from('content_items')
    .select('title_hash, title, fingerprint')
    .gte('fetched_at', cutoff);

  if (error) {
    logger.warn('content.storage.dedup_load_error', { error: error.message });
    return { hashes: new Set(), fingerprints: [] };
  }

  const rows = (data ?? []) as Array<{ title_hash: string; title: string; fingerprint: string }>;
  return {
    hashes: new Set(rows.map((r) => r.title_hash)),
    fingerprints: rows.map((r) => ({ title: r.title, fingerprint: r.fingerprint })),
  };
}

/**
 * Increments fetch_failures counter on a source after a feed fetch error.
 * Marks source as 'unreachable' when failures >= 5.
 */
export async function recordFetchFailure(db: SupabaseClient, sourceId: string): Promise<void> {
  const { data } = await db
    .from('content_sources')
    .select('fetch_failures')
    .eq('id', sourceId)
    .single();

  const failures = ((data as { fetch_failures: number } | null)?.fetch_failures ?? 0) + 1;
  const status = failures >= 5 ? 'unreachable' : undefined;

  await db
    .from('content_sources')
    .update({
      fetch_failures: failures,
      ...(status ? { status } : {}),
    })
    .eq('id', sourceId);
}

/**
 * Resets fetch_failures and restores 'active' status after a successful feed fetch.
 */
export async function recordFetchSuccess(db: SupabaseClient, sourceId: string): Promise<void> {
  await db
    .from('content_sources')
    .update({
      fetch_failures: 0,
      last_fetch_ok_at: new Date().toISOString(),
      status: 'active',
    })
    .eq('id', sourceId);
}

/**
 * Updates source quality stats after processing its articles.
 */
export async function updateSourceStats(
  db: SupabaseClient,
  sourceId: string,
  evaluated: number,
  passed: number,
  bestScore: number,
): Promise<void> {
  // Increment counters — read-modify-write is safe here because the CRON is single-instance
  const { data } = await db
    .from('content_sources')
    .select('articles_evaluated, articles_passed, best_score_30d')
    .eq('id', sourceId)
    .single();

  const prev = (data as { articles_evaluated: number; articles_passed: number; best_score_30d: number } | null) ?? {
    articles_evaluated: 0,
    articles_passed: 0,
    best_score_30d: 0,
  };

  await db
    .from('content_sources')
    .update({
      articles_evaluated: prev.articles_evaluated + evaluated,
      articles_passed: prev.articles_passed + passed,
      best_score_30d: Math.max(prev.best_score_30d, bestScore),
    })
    .eq('id', sourceId);
}

/**
 * Returns fetchable sources for the weekly pipeline.
 * Protected sources are static corpus anchors and are never re-fetched.
 */
export async function loadActiveSources(db: SupabaseClient): Promise<ContentSource[]> {
  const { data, error } = await db
    .from('content_sources')
    .select('*')
    .in('status', ['active', 'probation', 'unreachable'])
    .eq('is_protected', false);

  if (error) throw new Error(`Failed to load active sources: ${error.message}`);
  return (data ?? []) as ContentSource[];
}

export async function countSourcesByStatus(db: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await db
    .from('content_sources')
    .select('status, is_protected');

  if (error) throw new Error(`Failed to count content sources: ${error.message}`);

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ status: string; is_protected: boolean }>) {
    const key = row.status + (row.is_protected ? ':protected' : '');
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Promotes up to `limit` queued sources to active.
 * Priority: discovered_from='both' first, then oldest.
 */
export async function promoteQueuedSources(db: SupabaseClient, limit = 20): Promise<number> {
  const { data } = await db
    .from('content_sources')
    .select('id, discovered_from, added_at')
    .eq('status', 'queued')
    .limit(limit);

  if (!data?.length) return 0;

  const priority = new Map<string, number>([
    ['both', 0],
    ['manual', 1],
    ['engineering-blogs', 2],
    ['awesome-tech-rss', 3],
  ]);

  const ids = [...(data as Array<{ id: string; discovered_from: string | null; added_at: string }>) ]
    .sort((left, right) => {
      const leftPriority = priority.get(left.discovered_from ?? '') ?? 99;
      const rightPriority = priority.get(right.discovered_from ?? '') ?? 99;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return new Date(left.added_at).getTime() - new Date(right.added_at).getTime();
    })
    .slice(0, limit)
    .map((row) => row.id);
  await db.from('content_sources').update({ status: 'active' }).in('id', ids);
  return ids.length;
}
