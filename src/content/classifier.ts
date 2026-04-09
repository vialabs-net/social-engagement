import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';
import type { ClassifierResult } from './types.js';

const QUALITY_GATE = 6;
const BATCH_POLL_INTERVAL_MS = 30_000;   // 30s between polls
const BATCH_TIMEOUT_MS = 2 * 60 * 60 * 1000;  // 2 hours max wait
const CLASSIFIER_MAX_TOKENS = 768;
const CLASSIFIER_TEMPERATURE = 0;

export const CONTENT_CLASSIFIER_SYSTEM_PROMPT = `You are evaluating a technical article for depth and originality.

Rate the article on a scale of 1-10:
- 1-3: tutorial, rehash of documentation, or surface-level overview
- 4-6: decent technical content but nothing you couldn't find in docs or standard resources
- 7-8: real-world experience, production insights, or non-obvious lessons
- 9-10: exceptional depth — war stories, failure analysis, novel approaches with data

Respond ONLY as JSON:
{
  "quality_score": <number 1-10>,
  "summary": "<2-3 sentence summary of the article>",
  "main_thesis": "<one sentence core argument>",
  "key_insights": ["<insight 1>", "<insight 2>"],
  "tech_concepts": ["<concept 1>", "<concept 2>"]
}`;

export interface ArticleToClassify {
  readonly id: string;  // used as custom_id in batch
  readonly title: string;
  readonly text: string;
}

export interface ClassifiedArticle {
  readonly id: string;
  readonly result: ClassifierResult;
}

/**
 * Classifies articles using Anthropic Batch API (50% discount, async).
 *
 * Submits all articles as a single batch, polls until complete.
 * If batch does not complete within 2 hours, returns null — caller
 * should store the batch ID and check on the next run.
 *
 * JSON parse failures: retry once per article, then skip (graceful degradation).
 */
export async function classifyArticlesBatch(
  articles: ArticleToClassify[],
  apiKey: string,
  model: string,
): Promise<ClassifiedArticle[] | null> {
  if (articles.length === 0) return [];

  const client = new Anthropic({ apiKey });

  // Submit batch
  const requests: Anthropic.MessageCreateParamsNonStreaming[] = articles.map((article) => ({
    model,
    max_tokens: CLASSIFIER_MAX_TOKENS,
    temperature: CLASSIFIER_TEMPERATURE,
    system: CONTENT_CLASSIFIER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildClassifierUserPrompt(article) }],
  }));

  const batchRequests = articles.map((article, i) => ({
    custom_id: article.id,
    params: requests[i]!,
  }));

  logger.info('content.classify.batch_submit', { count: articles.length, model });

  const batch = await client.messages.batches.create({ requests: batchRequests });
  logger.info('content.classify.batch_created', { batchId: batch.id });

  // Poll until complete or timeout
  const deadline = Date.now() + BATCH_TIMEOUT_MS;
  let currentBatch = batch;

  while (currentBatch.processing_status !== 'ended') {
    if (Date.now() > deadline) {
      logger.warn('content.classify.batch_timeout', { batchId: batch.id });
      return null;  // caller stores batch ID and retries next run
    }
    await sleep(BATCH_POLL_INTERVAL_MS);
    currentBatch = await client.messages.batches.retrieve(batch.id);
    logger.info('content.classify.batch_poll', {
      batchId: batch.id,
      status: currentBatch.processing_status,
    });
  }

  // Collect results
  const classified: ClassifiedArticle[] = [];
  let jsonErrors = 0;

  for await (const result of await client.messages.batches.results(batch.id)) {
    if (result.result.type !== 'succeeded') {
      logger.warn('content.classify.item_failed', { id: result.custom_id, type: result.result.type });
      continue;
    }

    const block = result.result.message.content[0];
    if (block?.type !== 'text') continue;

    const parsed = parseClassifierResponse(block.text);
    if (parsed) {
      if (parsed.quality_score >= QUALITY_GATE) {
        classified.push({ id: result.custom_id, result: parsed });
      }
    } else {
      jsonErrors++;
      logger.warn('content.classify.json_error', { id: result.custom_id });
    }
  }

  logger.info('content.classify.batch_done', {
    submitted: articles.length,
    passed: classified.length,
    json_errors: jsonErrors,
  });

  return classified;
}

export async function classifyArticleRealtime(
  article: ArticleToClassify,
  apiKey: string,
  model: string,
): Promise<ClassifierResult> {
  const client = new Anthropic({ apiKey });
  return classifyArticleRealtimeWithClient(article, client, model);
}

export async function classifyArticleRealtimeWithClient(
  article: ArticleToClassify,
  client: Anthropic,
  model: string,
): Promise<ClassifierResult> {
  const baseUserPrompt = buildClassifierUserPrompt(article);

  for (let attempt = 0; attempt < 2; attempt++) {
    const userPrompt = attempt === 0
      ? baseUserPrompt
      : `${baseUserPrompt}\n\nReturn ONLY valid JSON. Do not wrap it in markdown fences. Do not add commentary before or after the JSON object.`;

    const response = await client.messages.create({
      model,
      max_tokens: CLASSIFIER_MAX_TOKENS,
      temperature: CLASSIFIER_TEMPERATURE,
      system: CONTENT_CLASSIFIER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const block = response.content[0];
    if (block?.type !== 'text') {
      throw new Error('Classifier returned a non-text response');
    }

    const parsed = parseClassifierResponse(block.text);
    if (parsed) {
      return parsed;
    }

    logger.warn('content.classify.realtime_json_error', {
      id: article.id,
      attempt: attempt + 1,
      preview: block.text.slice(0, 200),
    });
  }

  throw new Error(`Classifier returned invalid JSON for article ${article.id}`);
}

export function parseClassifierResponse(raw: string): ClassifierResult | null {
  const candidates = buildJsonCandidates(raw);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const score = Number(parsed['quality_score']);
      if (Number.isNaN(score)) continue;

      return {
        quality_score: score,
        summary: String(parsed['summary'] ?? ''),
        main_thesis: String(parsed['main_thesis'] ?? ''),
        key_insights: toStringArray(parsed['key_insights']),
        tech_concepts: toStringArray(parsed['tech_concepts']),
      };
    } catch {
      continue;
    }
  }

  return null;
}

function toStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map(String);
}

function buildClassifierUserPrompt(article: ArticleToClassify): string {
  return `Title: ${article.title}\n\n${article.text}`;
}

function buildJsonCandidates(raw: string): string[] {
  const cleaned = stripMarkdownFences(raw);
  const candidates = new Set<string>();

  pushCandidate(candidates, cleaned);
  pushCandidate(candidates, cleanupJsonLikeText(cleaned));

  const extractedObject = extractJSONObject(cleaned);
  if (extractedObject) {
    pushCandidate(candidates, extractedObject);
    pushCandidate(candidates, cleanupJsonLikeText(extractedObject));
  }

  return [...candidates];
}

function stripMarkdownFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function cleanupJsonLikeText(value: string): string {
  return value
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

function extractJSONObject(value: string): string | null {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return value.slice(start, end + 1).trim();
}

function pushCandidate(target: Set<string>, candidate: string | null): void {
  if (!candidate) return;
  const trimmed = candidate.trim();
  if (!trimmed) return;
  target.add(trimmed);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
