import type { SupabaseClient } from '@supabase/supabase-js';
import type { IEmbedder } from '../ai/types.js';
import type { IAIClient } from '../ai/types.js';
import { logger } from '../utils/logger.js';

const SIMILARITY_THRESHOLD = 0.75;
const QUALITY_GATE = 6;
const MATCH_WINDOW_DAYS = 30;
const TOP_CANDIDATES = 3;

interface ChunkRow {
  content_item_id: string;
  similarity: number;
}

interface CandidateArticle {
  id: string;
  title: string;
  main_thesis: string;
  key_insights: string[];
  source_id: string;
}

export interface MatchedContext {
  readonly articleId: string;
  readonly sourceId: string;
  readonly connection: string;   // one sentence from cross-encoder
  readonly articleTitle: string;
}

interface FindingInput {
  readonly moduleId: string;
  readonly finding: string;
  readonly plainLanguage: string;
  readonly contextHint?: string;
}

/**
 * Stage 1 — pgvector bi-encoder search (~5ms + 1 embedding call per finding).
 *
 * Embeds finding.plainLanguage, searches article_chunks by cosine similarity,
 * deduplicates by article (keep best chunk per article), returns top 3 candidates.
 */
async function stage1BiEncoder(
  finding: FindingInput,
  embedder: IEmbedder,
  db: SupabaseClient,
): Promise<CandidateArticle[]> {
  const embedding = await embedder.embed(finding.plainLanguage);
  const cutoff = new Date(Date.now() - MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // pgvector cosine similarity search via Supabase RPC
  const { data, error } = await db.rpc('match_article_chunks', {
    query_embedding: embedding,
    similarity_threshold: SIMILARITY_THRESHOLD,
    match_count: TOP_CANDIDATES * 3,  // fetch more, deduplicate by article below
    min_quality_score: QUALITY_GATE,
    week_of_cutoff: cutoff,
  });

  if (error) {
    throw new Error(`pgvector search failed: ${error.message}`);
  }

  const chunks = (data ?? []) as ChunkRow[];

  // Deduplicate: keep best similarity per article
  const bestByArticle = new Map<string, number>();
  for (const chunk of chunks) {
    const prev = bestByArticle.get(chunk.content_item_id) ?? 0;
    if (chunk.similarity > prev) bestByArticle.set(chunk.content_item_id, chunk.similarity);
  }

  // Sort by similarity DESC, take top 3 unique articles
  const topArticleIds = [...bestByArticle.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_CANDIDATES)
    .map(([id]) => id);

  if (topArticleIds.length === 0) return [];

  const { data: articles, error: articleError } = await db
    .from('content_items')
    .select('id, title, main_thesis, key_insights, source_id')
    .in('id', topArticleIds);

  if (articleError) {
    throw new Error(`Failed to fetch candidate articles: ${articleError.message}`);
  }

  return (articles ?? []) as CandidateArticle[];
}

/**
 * Stage 2 — AI cross-encoder (one batched call per finding, all candidates evaluated together).
 *
 * Returns null if no strong match found or if AI call fails.
 */
async function stage2CrossEncoder(
  finding: FindingInput,
  candidates: CandidateArticle[],
  aiClient: IAIClient,
): Promise<{ articleId: string; sourceId: string; connection: string; title: string } | null> {
  if (candidates.length === 0) return null;

  const candidateList = candidates
    .map((c, i) => {
      const insights = c.key_insights.slice(0, 3).join(', ');
      return `${i + 1}. "${c.title}" — Thesis: ${c.main_thesis}. Insights: ${insights}`;
    })
    .join('\n');

  const systemPrompt = `You are deciding if a developer's code change is related to an industry article.
Respond ONLY as a JSON array. No markdown, no explanation outside the array.`;

  const userPrompt = `Code change (finding):
- Module: ${finding.moduleId}
- Headline: ${finding.finding}
- Context: ${finding.plainLanguage}${finding.contextHint ? `\n- File: ${finding.contextHint}` : ''}

Candidate articles:
${candidateList}

For each candidate, respond with:
- strength: "strong" (direct connection), "weak" (tangential), or "none"
- connection: one sentence explaining how the code relates to the article (only if strong, else null)

Respond as JSON array:
[
  { "candidate": 1, "strength": "strong", "connection": "..." },
  { "candidate": 2, "strength": "none", "connection": null }
]`;

  let raw: string;
  try {
    raw = await aiClient.complete(systemPrompt, userPrompt);
  } catch (err) {
    throw new Error(`Cross-encoder AI call failed: ${String(err)}`);
  }

  const results = parseCrossEncoderResponse(raw, candidates.length);
  if (!results) {
    // Retry once on parse failure
    try {
      const retry = await aiClient.complete(systemPrompt, userPrompt);
      const retryResults = parseCrossEncoderResponse(retry, candidates.length);
      if (!retryResults) return null;
      return findStrongMatch(retryResults, candidates);
    } catch {
      return null;
    }
  }

  return findStrongMatch(results, candidates);
}

function findStrongMatch(
  results: Array<{ candidate: number; strength: string; connection: string | null }>,
  candidates: CandidateArticle[],
): { articleId: string; sourceId: string; connection: string; title: string } | null {
  for (const result of results) {
    if (result.strength === 'strong' && result.connection) {
      const idx = result.candidate - 1;
      const article = candidates[idx];
      if (article) {
        return {
          articleId: article.id,
          sourceId: article.source_id,
          connection: result.connection,
          title: article.title,
        };
      }
    }
  }
  return null;
}

function parseCrossEncoderResponse(
  raw: string,
  candidateCount: number,
): Array<{ candidate: number; strength: string; connection: string | null }> | null {
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;
    if (parsed.length !== candidateCount) return null;
    return parsed as Array<{ candidate: number; strength: string; connection: string | null }>;
  } catch {
    return null;
  }
}

/**
 * Stage 3 — Update match stats in DB after a successful match.
 * Uses a single RPC to do both increments atomically.
 * SQL function defined in database/schema.sql.
 */
async function recordMatch(
  db: SupabaseClient,
  articleId: string,
  sourceId: string,
): Promise<void> {
  await db.rpc('increment_content_match', { p_article_id: articleId, p_source_id: sourceId });
}

/**
 * Main entry point for the per-commit matching pipeline.
 *
 * Tries each finding in order, returns the first strong match found.
 * Graceful degradation: any failure returns null (post generated without industry context).
 */
export async function matchFindingsToArticles(
  findings: FindingInput[],
  embedder: IEmbedder,
  aiClient: IAIClient,
  db: SupabaseClient,
): Promise<MatchedContext | null> {
  for (const finding of findings) {
    try {
      const candidates = await stage1BiEncoder(finding, embedder, db);
      if (candidates.length === 0) continue;

      const match = await stage2CrossEncoder(finding, candidates, aiClient);
      if (!match) continue;

      // Record match stats asynchronously — don't block post generation
      recordMatch(db, match.articleId, match.sourceId).catch((err) => {
        logger.warn('content.match.stats_error', { error: String(err) });
      });

      logger.info('content.match.result', {
        finding: finding.moduleId,
        article: match.title,
        connection: match.connection.slice(0, 80),
      });

      return {
        articleId: match.articleId,
        sourceId: match.sourceId,
        connection: match.connection,
        articleTitle: match.title,
      };
    } catch (err) {
      logger.warn('content.match.finding_error', { moduleId: finding.moduleId, error: String(err) });
    }
  }

  return null;
}
