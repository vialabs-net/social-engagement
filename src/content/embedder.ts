import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

const BATCH_POLL_INTERVAL_MS = 30_000;
const BATCH_TIMEOUT_MS = 2 * 60 * 60 * 1000;  // 2 hours

export interface ChunkToEmbed {
  readonly id: string;      // custom_id for batch tracking
  readonly chunkText: string;
}

export interface EmbeddedChunk {
  readonly id: string;
  readonly embedding: number[];
}

/**
 * Embeds article chunks using OpenAI Batch API (50% discount).
 *
 * Submits all chunks as a single batch, polls until complete.
 * Returns null on timeout — caller should store the batch ID for the next run.
 */
export async function embedChunksBatch(
  chunks: ChunkToEmbed[],
  apiKey: string,
  model: string,
): Promise<EmbeddedChunk[] | null> {
  if (chunks.length === 0) return [];

  const client = new OpenAI({ apiKey });

  // Build batch input JSONL
  const batchInput = chunks.map((chunk) =>
    JSON.stringify({
      custom_id: chunk.id,
      method: 'POST',
      url: '/v1/embeddings',
      body: { model, input: chunk.chunkText },
    }),
  ).join('\n');

  // Upload file
  const file = await client.files.create({
    file: new File([batchInput], 'embeddings.jsonl', { type: 'application/jsonl' }),
    purpose: 'batch',
  });

  // Create batch
  const batch = await client.batches.create({
    input_file_id: file.id,
    endpoint: '/v1/embeddings',
    completion_window: '24h',
  });

  logger.info('content.embed.batch_created', { batchId: batch.id, chunks: chunks.length, model });

  // Poll until complete or timeout
  const deadline = Date.now() + BATCH_TIMEOUT_MS;
  let currentBatch = batch;

  while (currentBatch.status !== 'completed' && currentBatch.status !== 'failed' && currentBatch.status !== 'cancelled') {
    if (Date.now() > deadline) {
      logger.warn('content.embed.batch_timeout', { batchId: batch.id });
      return null;
    }
    await sleep(BATCH_POLL_INTERVAL_MS);
    currentBatch = await client.batches.retrieve(batch.id);
    logger.info('content.embed.batch_poll', { batchId: batch.id, status: currentBatch.status });
  }

  if (currentBatch.status !== 'completed') {
    logger.warn('content.embed.batch_failed', { batchId: batch.id, status: currentBatch.status });
    return null;
  }

  // Download output file
  const outputFileId = currentBatch.output_file_id;
  if (!outputFileId) {
    logger.warn('content.embed.no_output', { batchId: batch.id });
    return null;
  }

  const output = await client.files.content(outputFileId);
  const text = await output.text();
  const results: EmbeddedChunk[] = [];

  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as {
        custom_id: string;
        response?: { body?: { data?: Array<{ embedding: number[] }> } };
      };
      const embedding = parsed.response?.body?.data?.[0]?.embedding;
      if (embedding) {
        results.push({ id: parsed.custom_id, embedding });
      }
    } catch {
      logger.warn('content.embed.parse_error', { line: line.slice(0, 80) });
    }
  }

  logger.info('content.embed.batch_done', { submitted: chunks.length, embedded: results.length });
  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
