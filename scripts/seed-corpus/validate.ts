/**
 * Validate seed-articles.json before writing anything to Supabase.
 *
 * Usage:
 *   npm run seed-corpus:validate
 *   npm run seed-corpus:validate -- --input path/to/seed-articles.json
 */

import {
  DEFAULT_SEED_JSON_PATH,
  MODULE_IDS,
  assertKnownModules,
  buildCoverageCounts,
  getArgValue,
  loadSeedArticles,
  normalizeModules,
  resolveCliPath,
} from './shared.js';

const MIN_TEXT_LENGTH = 1_500;
const MAX_TEXT_LENGTH = 50_000;
const MAX_ARTICLES_PER_SOURCE = 25;
const MIN_ARTICLES_PER_MODULE = 3;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputPath = resolveCliPath(getArgValue(args, '--input'), DEFAULT_SEED_JSON_PATH);
  const articles = loadSeedArticles(inputPath);

  const issues: string[] = [];
  const seenUrls = new Set<string>();
  const sourceCounts = new Map<string, number>();

  for (let index = 0; index < articles.length; index++) {
    const article = articles[index]!;
    const label = `article[${index}]`;

    if (!article.url.trim()) issues.push(`${label} is missing url`);
    if (!article.title.trim()) issues.push(`${label} is missing title`);
    if (!article.source_name.trim()) issues.push(`${label} is missing source_name`);
    if (!article.text.trim()) issues.push(`${label} is missing text`);

    try {
      void new URL(article.url);
    } catch {
      issues.push(`${label} has invalid URL: ${article.url}`);
    }

    if (!Number.isInteger(article.quality_score) || article.quality_score < 7 || article.quality_score > 10) {
      issues.push(`${label} has invalid quality_score ${article.quality_score}; expected 7-10`);
    }

    if (article.text.length < MIN_TEXT_LENGTH) {
      issues.push(`${label} text is too short (${article.text.length} chars)`);
    }
    if (article.text.length > MAX_TEXT_LENGTH) {
      issues.push(`${label} text is too long (${article.text.length} chars)`);
    }

    const normalizedModules = normalizeModules(article.modules);
    if (normalizedModules.length === 0) {
      issues.push(`${label} has no modules`);
    }
    try {
      assertKnownModules(normalizedModules, label);
    } catch (err) {
      issues.push(String(err));
    }

    if (seenUrls.has(article.url)) {
      issues.push(`Duplicate URL detected: ${article.url}`);
    } else {
      seenUrls.add(article.url);
    }

    sourceCounts.set(article.source_name, (sourceCounts.get(article.source_name) ?? 0) + 1);
  }

  const coverage = buildCoverageCounts(articles);
  for (const moduleId of MODULE_IDS) {
    const count = coverage.get(moduleId) ?? 0;
    if (count < MIN_ARTICLES_PER_MODULE) {
      issues.push(`Coverage gap: module "${moduleId}" has ${count} article(s); expected at least ${MIN_ARTICLES_PER_MODULE}`);
    }
  }

  for (const [sourceName, count] of sourceCounts.entries()) {
    if (count > MAX_ARTICLES_PER_SOURCE) {
      issues.push(`Source cap exceeded: "${sourceName}" has ${count} articles; max is ${MAX_ARTICLES_PER_SOURCE}`);
    }
  }

  const weakestModules = [...coverage.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5)
    .map(([moduleId, count]) => `${moduleId}=${count}`)
    .join(', ');

  console.log(`Validated ${articles.length} seed article(s) from ${inputPath}`);
  console.log(`Unique URLs: ${seenUrls.size}`);
  console.log(`Weakest modules: ${weakestModules}`);
  console.log(`Largest source bucket: ${Math.max(...sourceCounts.values(), 0)}`);

  if (issues.length > 0) {
    console.error('');
    console.error(`Validation failed with ${issues.length} issue(s):`);
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log('Validation passed.');
}

main().catch((err) => {
  console.error('Seed validation failed:', err);
  process.exit(1);
});
