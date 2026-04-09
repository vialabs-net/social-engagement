/**
 * Insert the curated seed corpus into Supabase and generate embeddings in real time.
 *
 * Usage:
 *   npm run seed-corpus:seed
 *   npm run seed-corpus:seed -- --input path/to/seed-articles.json --limit 10
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { articleFingerprint, titleHash } from '../../src/content/dedup.js';
import { classifyArticleRealtimeWithClient } from '../../src/content/classifier.js';
import { chunkArticle } from '../../src/content/chunker.js';
import { storeArticle, storeChunks } from '../../src/content/content-storage.js';
import {
  DEFAULT_CLASSIFIER_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_SEED_JSON_PATH,
  DEFAULT_SEED_SOURCE_NAME,
  DEFAULT_SEED_WEEK_OF,
  getArgValue,
  loadSeedArticles,
  parseInteger,
  resolveCliPath,
} from './shared.js';

const SEED_SOURCE_URL = 'https://devcast.lilicurl.com/seed';
const SEED_SOURCE_RSS_URL = 'https://devcast.lilicurl.com/seed.rss';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputPath = resolveCliPath(getArgValue(args, '--input'), DEFAULT_SEED_JSON_PATH);
  const classifierModel = getArgValue(args, '--classifier-model') ?? DEFAULT_CLASSIFIER_MODEL;
  const embeddingModel = getArgValue(args, '--embedding-model') ?? DEFAULT_EMBEDDING_MODEL;
  const limitArg = getArgValue(args, '--limit');
  const limit = limitArg ? parseInteger(limitArg, '--limit') : null;

  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const openaiApiKey = process.env['OPENAI_API_KEY'];
  const anthropicApiKey = process.env['ANTHROPIC_API_KEY'];

  if (!supabaseUrl || !supabaseKey || !openaiApiKey || !anthropicApiKey) {
    throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, and ANTHROPIC_API_KEY are required');
  }

  const articles = loadSeedArticles(inputPath);
  const selectedArticles = limit === null ? articles : articles.slice(0, limit);
  const db = createClient(supabaseUrl, supabaseKey);
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });
  const openai = new OpenAI({ apiKey: openaiApiKey });

  const sourceId = await ensureSeedSource(db);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`Seeding ${selectedArticles.length} article(s) from ${inputPath}`);
  console.log(`Seed source: ${DEFAULT_SEED_SOURCE_NAME} (${sourceId})`);

  for (let index = 0; index < selectedArticles.length; index++) {
    const article = selectedArticles[index]!;
    process.stdout.write(`[${index + 1}/${selectedArticles.length}] ${article.title} ... `);

    const { data: existing, error: existingError } = await db
      .from('content_items')
      .select('id')
      .eq('url', article.url)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed to check existing article ${article.url}: ${existingError.message}`);
    }

    if (existing) {
      skipped++;
      console.log('SKIP (already exists)');
      continue;
    }

    try {
      const classification = await classifyArticleRealtimeWithClient(
        { id: article.url, title: article.title, text: article.text },
        anthropic,
        classifierModel,
      );

      const contentItemId = await storeArticle(db, {
        sourceId,
        weekOf: DEFAULT_SEED_WEEK_OF,
        url: article.url,
        title: article.title,
        contentText: article.text,
        summary: classification.summary,
        mainThesis: classification.main_thesis,
        keyInsights: classification.key_insights,
        techConcepts: classification.tech_concepts,
        seedModules: article.modules,
        qualityScore: article.quality_score,
        titleHash: titleHash(article.title),
        fingerprint: articleFingerprint(article.text),
      });

      if (!contentItemId) {
        failed++;
        console.log('FAIL (content_items insert failed)');
        continue;
      }

      try {
        const chunks = chunkArticle(article.text);
        if (chunks.length === 0) {
          throw new Error('Chunker returned 0 chunks');
        }

        const embeddingResponse = await openai.embeddings.create({
          model: embeddingModel,
          input: chunks,
        });

        if (embeddingResponse.data.length !== chunks.length) {
          throw new Error(`Embedding count mismatch: expected ${chunks.length}, received ${embeddingResponse.data.length}`);
        }

        await storeChunks(
          db,
          chunks.map((chunkText, chunkIndex) => {
            const embedding = embeddingResponse.data[chunkIndex]?.embedding;
            if (!embedding) {
              throw new Error(`Missing embedding for chunk ${chunkIndex}`);
            }

            return {
              contentItemId,
              chunkIndex,
              chunkText,
              embedding,
            };
          }),
        );

        inserted++;
        console.log(`OK (${chunks.length} chunks)`);
      } catch (err) {
        await rollbackContentItem(db, contentItemId);
        failed++;
        console.log(`FAIL (${String(err).slice(0, 120)})`);
      }
    } catch (err) {
      failed++;
      console.log(`FAIL (${String(err).slice(0, 120)})`);
    }
  }

  console.log('');
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Failed:   ${failed}`);
}

async function ensureSeedSource(db: SupabaseClient): Promise<string> {
  const { data: existing, error: existingError } = await db
    .from('content_sources')
    .select('id')
    .eq('name', DEFAULT_SEED_SOURCE_NAME)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load seed source: ${existingError.message}`);
  }

  if (existing) {
    const { error: updateError } = await db
      .from('content_sources')
      .update({
        url: SEED_SOURCE_URL,
        rss_url: SEED_SOURCE_RSS_URL,
        trust: 'curated',
        status: 'active',
        is_protected: true,
        discovered_from: 'manual',
        disabled_at: null,
      })
      .eq('id', (existing as { id: string }).id);

    if (updateError) {
      throw new Error(`Failed to update seed source: ${updateError.message}`);
    }

    return (existing as { id: string }).id;
  }

  const { data: created, error: createError } = await db
    .from('content_sources')
    .insert({
      name: DEFAULT_SEED_SOURCE_NAME,
      url: SEED_SOURCE_URL,
      rss_url: SEED_SOURCE_RSS_URL,
      trust: 'curated',
      status: 'active',
      is_protected: true,
      discovered_from: 'manual',
    })
    .select('id')
    .single();

  if (createError || !created) {
    throw new Error(`Failed to create seed source: ${createError?.message ?? 'unknown error'}`);
  }

  return (created as { id: string }).id;
}

async function rollbackContentItem(db: SupabaseClient, contentItemId: string): Promise<void> {
  const { error } = await db.from('content_items').delete().eq('id', contentItemId);
  if (error) {
    console.error(`Rollback failed for content_item ${contentItemId}: ${error.message}`);
  }
}

main().catch((err) => {
  console.error('Seed insert failed:', err);
  process.exit(1);
});
