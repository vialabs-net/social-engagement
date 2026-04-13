/**
 * Weekly content fetch pipeline entry point.
 *
 * Steps:
 * A. Promote up to CONTENT_FETCH_PROMOTION_LIMIT queued sources to active
 * B. Fetch RSS from all active/probation sources
 * C. Extract, dedup, structural filter, classify, chunk, embed, store
 * D. Log summary + health report
 *
 * Run: tsx src/content/scripts/content-fetch-main.ts
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger.js';
import { fetchAllFeeds } from '../rss-fetcher.js';
import { extractArticle } from '../article-extractor.js';
import { isDuplicate, titleHash, articleFingerprint, buildStoredFingerprint } from '../dedup.js';
import { shouldSkip, extractSignals, structuralScore, topPerSource } from '../structural-filter.js';
import { classifyArticlesBatch } from '../classifier.js';
import { chunkArticle } from '../chunker.js';
import { embedChunksBatch } from '../embedder.js';
import {
  countSourcesByStatus,
  promoteQueuedSources,
  loadDedupData,
  storeArticle,
  storeChunks,
  recordFetchFailure,
  recordFetchSuccess,
  updateSourceStats,
  loadActiveSources,
} from '../content-storage.js';
import { savePipelineRun, logHealthReport } from '../health-reporter.js';
import type { ContentSource, PipelineRunStats, SourceTrust } from '../types.js';
import type { ArticleToStore } from '../content-storage.js';

const DEFAULT_FETCH_PROMOTION_LIMIT = 20;

async function main(): Promise<void> {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const anthropicKey = process.env['ANTHROPIC_API_KEY'];
  const openaiKey = process.env['OPENAI_API_KEY'];
  const promotionLimit = readPromotionLimitFromEnv();

  if (!supabaseUrl || !supabaseKey || !anthropicKey || !openaiKey) {
    throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY required');
  }

  const db = createClient(supabaseUrl, supabaseKey);
  const stats: PipelineRunStats = {
    sources_active: 0, sources_queued: 0, sources_promoted: 0,
    articles_fetched: 0, articles_extracted: 0, extraction_failures: 0,
    articles_deduped: 0, articles_preskipped: 0, articles_structural: 0,
    articles_classified: 0, articles_stored: 0, chunks_embedded: 0,
    avg_quality_score: null, score_distribution: {},
    commits_with_match: 0, commits_without_match: 0, match_skip_failures: 0,
    classify_json_errors: 0, embed_failures: 0,
  };

  const sourceCountsBefore = await countSourcesByStatus(db);
  stats.sources_queued = sourceCountsBefore['queued'] ?? 0;
  stats.sources_active = (sourceCountsBefore['active'] ?? 0) + (sourceCountsBefore['active:protected'] ?? 0);

  // ── A. Promote queued sources ──────────────────────────────────────────────
  const promoted = await promoteQueuedSources(db, promotionLimit);
  stats.sources_promoted = promoted;
  logger.info('content.fetch.promoted', {
    count: promoted,
    limit: promotionLimit,
    queued_before: stats.sources_queued,
    active_before: stats.sources_active,
  });

  // ── B. Fetch RSS feeds ─────────────────────────────────────────────────────
  const sources = await loadActiveSources(db) as unknown as ContentSource[];
  stats.sources_active = sources.filter((s) => s.status === 'active').length + (sourceCountsBefore['active:protected'] ?? 0);

  const feedResults = await fetchAllFeeds(sources);

  // Process fetch failures
  for (const result of feedResults) {
    if (result.failed) {
      await recordFetchFailure(db, result.sourceId);
    } else {
      await recordFetchSuccess(db, result.sourceId);
    }
  }

  const allRawArticles = feedResults.flatMap((r) => r.articles);
  stats.articles_fetched = allRawArticles.length;
  logger.info('content.fetch.rss_done', { articles: allRawArticles.length });

  // ── C. Extract full text ───────────────────────────────────────────────────
  const dedupData = await loadDedupData(db);
  const storedFingerprints = dedupData.fingerprints.map((f) =>
    buildStoredFingerprint(f.title, f.fingerprint),
  );

  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  interface CandidateArticle {
    sourceId: string;
    url: string;
    title: string;
    text: string;
    structuralScore: number;
    trust: SourceTrust;
  }

  const candidates: CandidateArticle[] = [];
  const sourceStats = new Map<string, { evaluated: number; passed: number; bestScore: number }>();

  for (const raw of allRawArticles) {
    const source = sourceMap.get(raw.sourceId);
    if (!source) continue;

    // Phase 1: pre-skip (title only — free, instant)
    if (shouldSkip(raw.title, raw.rssText ? raw.rssText.split(/\s+/).length : 0)) {
      stats.articles_preskipped++;
      continue;
    }

    // Extract full text (3-layer: RSS → URL → Puppeteer)
    const article = await extractArticle(raw.url, raw.rssText, source.trust === 'curated');
    if (!article) {
      stats.extraction_failures++;
      continue;
    }

    // Pre-skip with real word count
    if (shouldSkip(raw.title, article.wordCount)) {
      stats.articles_preskipped++;
      continue;
    }

    stats.articles_extracted++;

    // Dedup
    if (isDuplicate(raw.title, article.text, dedupData.hashes, storedFingerprints)) {
      stats.articles_deduped++;
      continue;
    }

    // Structural score
    const signals = extractSignals(article.text);
    const score = structuralScore(signals, source.trust);
    const ss = sourceStats.get(raw.sourceId) ?? { evaluated: 0, passed: 0, bestScore: 0 };
    ss.evaluated++;
    sourceStats.set(raw.sourceId, ss);

    if (score < 4) continue;

    ss.passed++;
    ss.bestScore = Math.max(ss.bestScore, score);
    stats.articles_structural++;

    candidates.push({
      sourceId: raw.sourceId,
      url: raw.url,
      title: raw.title,
      text: article.text,
      structuralScore: score,
      trust: source.trust,
    });
  }

  // Phase 3: top 3 per source
  const capped = topPerSource(
    candidates.map((a) => ({ article: a, score: a.structuralScore })),
    3,
  ).map((s) => s.article);

  logger.info('content.fetch.structural_done', { candidates: candidates.length, after_cap: capped.length });

  // ── D. Classify ────────────────────────────────────────────────────────────
  const toClassify = capped.map((a) => ({ id: a.url, title: a.title, text: a.text }));
  const classified = await classifyArticlesBatch(toClassify, anthropicKey, 'claude-haiku-4-5');

  if (!classified) {
    logger.warn('content.fetch.classify_timeout');
    stats.classify_json_errors++;
    // Save partial stats and exit — batch ID not tracked (retried next run)
    await savePipelineRun(db, stats);
    return;
  }

  stats.articles_classified = classified.length;
  logger.info('content.fetch.classify_done', { stored: classified.length });

  // ── E. Chunk + embed + store ───────────────────────────────────────────────
  const weekOf = new Date().toISOString().split('T')[0]!;

  interface ChunkJob { id: string; chunkText: string; articleUrl: string; chunkIndex: number }
  const chunkJobs: ChunkJob[] = [];
  const articleIdByUrl = new Map<string, string>();

  for (const item of classified) {
    const candidate = capped.find((c) => c.url === item.id);
    if (!candidate) continue;

    const article: ArticleToStore = {
      sourceId: candidate.sourceId,
      weekOf,
      url: candidate.url,
      title: candidate.title,
      contentText: candidate.text,
      summary: item.result.summary,
      mainThesis: item.result.main_thesis,
      keyInsights: item.result.key_insights,
      techConcepts: item.result.tech_concepts,
      qualityScore: item.result.quality_score,
      titleHash: titleHash(candidate.title),
      fingerprint: articleFingerprint(candidate.text),
    };

    const storedId = await storeArticle(db, article);
    if (!storedId) continue;

    stats.articles_stored++;
    articleIdByUrl.set(candidate.url, storedId);

    const chunks = chunkArticle(candidate.text);
    chunks.forEach((chunkText, chunkIndex) => {
      chunkJobs.push({ id: `${storedId}:${chunkIndex}`, chunkText, articleUrl: candidate.url, chunkIndex });
    });
  }

  // Embed all chunks via OpenAI Batch API
  const toEmbed = chunkJobs.map((c) => ({ id: c.id, chunkText: c.chunkText }));
  const embedded = await embedChunksBatch(toEmbed, openaiKey, 'text-embedding-3-small');

  if (!embedded) {
    logger.warn('content.fetch.embed_timeout');
    stats.embed_failures++;
  } else {
    const embeddedMap = new Map(embedded.map((e) => [e.id, e.embedding]));

    for (const job of chunkJobs) {
      const articleId = articleIdByUrl.get(job.articleUrl);
      const embedding = embeddedMap.get(job.id);
      if (!articleId || !embedding) continue;

      try {
        await storeChunks(db, [{ contentItemId: articleId, chunkIndex: job.chunkIndex, chunkText: job.chunkText, embedding }]);
        stats.chunks_embedded++;
      } catch {
        stats.embed_failures++;
      }
    }
  }

  // Update source stats
  for (const [sourceId, ss] of sourceStats.entries()) {
    await updateSourceStats(db, sourceId, ss.evaluated, ss.passed, ss.bestScore);
  }

  // Quality score distribution
  const scores = classified.map((c) => c.result.quality_score);
  stats.avg_quality_score = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null;
  stats.score_distribution = {
    '1-3': scores.filter((s) => s <= 3).length,
    '4-6': scores.filter((s) => s >= 4 && s <= 6).length,
    '7-8': scores.filter((s) => s >= 7 && s <= 8).length,
    '9-10': scores.filter((s) => s >= 9).length,
  };

  logger.info('content.fetch.summary', {
    sources_active: stats.sources_active,
    sources_promoted: stats.sources_promoted,
    articles_fetched: stats.articles_fetched,
    articles_extracted: stats.articles_extracted,
    extraction_failures: stats.extraction_failures,
    articles_deduped: stats.articles_deduped,
    articles_preskipped: stats.articles_preskipped,
    articles_structural: stats.articles_structural,
    articles_classified: stats.articles_classified,
    articles_stored: stats.articles_stored,
    chunks_embedded: stats.chunks_embedded,
    avg_quality_score: stats.avg_quality_score,
    score_distribution: stats.score_distribution,
  });

  await savePipelineRun(db, stats);
  await logHealthReport(db, stats);
}

main().catch((err) => {
  logger.error('content.fetch.fatal', { error: String(err) });
  process.exit(1);
});

function readPromotionLimitFromEnv(): number {
  const raw = process.env['CONTENT_FETCH_PROMOTION_LIMIT'];
  if (!raw) return DEFAULT_FETCH_PROMOTION_LIMIT;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    logger.warn('content.fetch.invalid_promotion_limit', {
      raw,
      fallback: DEFAULT_FETCH_PROMOTION_LIMIT,
    });
    return DEFAULT_FETCH_PROMOTION_LIMIT;
  }

  return parsed;
}
