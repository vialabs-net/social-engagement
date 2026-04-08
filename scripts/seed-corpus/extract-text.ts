/**
 * Generate seed-articles.json from the frozen CSV by extracting full article text.
 *
 * Usage:
 *   npm run seed-corpus:extract
 *   npm run seed-corpus:extract -- --input path/to/seed-articles-frozen.csv --output path/to/seed-articles.json
 */

import { writeFileSync } from 'fs';
import { extractArticle } from '../../src/content/article-extractor.js';
import {
  DEFAULT_FAILURES_JSON_PATH,
  DEFAULT_FROZEN_CSV_PATH,
  DEFAULT_SEED_JSON_PATH,
  assertKnownModules,
  getArgValue,
  modulesFromRow,
  parseInteger,
  readFrozenCsv,
  resolveCliPath,
  type SeedArticle,
  type SeedExtractionFailure,
} from './shared.js';

const MIN_WORD_COUNT = 300;
const DEFAULT_DELAY_MS = 2_000;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputPath = resolveCliPath(getArgValue(args, '--input'), DEFAULT_FROZEN_CSV_PATH);
  const outputPath = resolveCliPath(getArgValue(args, '--output'), DEFAULT_SEED_JSON_PATH);
  const failuresPath = resolveCliPath(getArgValue(args, '--failures'), DEFAULT_FAILURES_JSON_PATH);
  const delayMs = parseInteger(getArgValue(args, '--delay-ms') ?? String(DEFAULT_DELAY_MS), '--delay-ms');
  const limit = getArgValue(args, '--limit');
  const limitCount = limit ? parseInteger(limit, '--limit') : null;

  const rows = readFrozenCsv(inputPath)
    .filter((row) => row.status === 'kept' || row.status === 'text_extracted');
  const selectedRows = limitCount === null ? rows : rows.slice(0, limitCount);

  const out: SeedArticle[] = [];
  const failures: SeedExtractionFailure[] = [];

  console.log(`Extracting full text for ${selectedRows.length} curated rows from ${inputPath}`);

  for (let index = 0; index < selectedRows.length; index++) {
    const row = selectedRows[index]!;
    const modules = modulesFromRow(row);
    const qualityScore = parseInteger(row.quality_score, `quality_score for row ${row.id}`);

    if (!row.url || !row.title || !row.source_name) {
      throw new Error(`Row ${row.id} is missing url, title, or source_name`);
    }
    if (qualityScore < 7 || qualityScore > 10) {
      throw new Error(`Row ${row.id} has invalid quality_score ${qualityScore}; expected 7-10`);
    }
    if (modules.length === 0) {
      throw new Error(`Row ${row.id} has no module tags`);
    }
    assertKnownModules(modules, `row ${row.id}`);

    process.stdout.write(`[${index + 1}/${selectedRows.length}] ${row.title} ... `);

    try {
      const article = await extractArticle(row.url, null, true);
      if (!article) {
        failures.push({ id: row.id, url: row.url, reason: 'extractor_returned_null' });
        console.log('FAIL (extractor returned null)');
      } else if (article.wordCount < MIN_WORD_COUNT) {
        failures.push({ id: row.id, url: row.url, reason: `word_count_${article.wordCount}` });
        console.log(`FAIL (${article.wordCount} words)`);
      } else {
        out.push({
          url: row.url,
          title: row.title,
          source_name: row.source_name,
          text: article.text,
          quality_score: qualityScore,
          modules,
        });
        console.log(`OK (${article.wordCount} words)`);
      }
    } catch (err) {
      failures.push({ id: row.id, url: row.url, reason: String(err) });
      console.log(`ERROR (${String(err).slice(0, 120)})`);
    }

    if (index < selectedRows.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  writeFileSync(outputPath, `${JSON.stringify(out, null, 2)}\n`);
  writeFileSync(failuresPath, `${JSON.stringify(failures, null, 2)}\n`);

  console.log('');
  console.log(`Extracted: ${out.length}/${selectedRows.length}`);
  console.log(`Failures:  ${failures.length}`);
  console.log(`JSON:      ${outputPath}`);
  console.log(`Failures:  ${failuresPath}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('Seed extraction failed:', err);
  process.exit(1);
});
