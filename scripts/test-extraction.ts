/**
 * Extraction feasibility spike — Step 3 GATE
 *
 * Tests article extraction against 30 curated source URLs.
 * Acceptance criteria: >= 80% of articles extractable (wordCount >= 300).
 *
 * Run: tsx --env-file=.env.local scripts/test-extraction.ts
 */

import { extractArticle } from '../src/content/article-extractor.js';

// 30 articles from curated engineering blogs
const TEST_URLS = [
  // Netflix
  'https://netflixtechblog.com/detecting-and-avoiding-equipment-damage-in-netflix-datacenters-45b9c7001cce',
  'https://netflixtechblog.com/our-learnings-from-adopting-large-language-models-with-zero-shot-prompting-4e43efcc8b90',
  // Stripe
  'https://stripe.com/blog/payment-api-design',
  'https://stripe.com/blog/idempotency',
  // Cloudflare
  'https://blog.cloudflare.com/how-we-built-pingora-the-proxy-that-connects-cloudflare-to-the-internet/',
  'https://blog.cloudflare.com/the-story-of-web-framework-hono-from-the-edge/',
  // Uber
  'https://www.uber.com/en-US/blog/how-uber-serves-over-40-million-reads-per-second-using-an-integrated-cache/',
  'https://www.uber.com/en-US/blog/gearshift-automating-postgresql-replication-slot-management-at-uber/',
  // Dropbox
  'https://dropbox.tech/infrastructure/how-we-optimized-magic-pocket-for-cold-storage',
  'https://dropbox.tech/machine-learning/how-we-built-a-data-pipeline-for-dropbox-business',
  // GitHub
  'https://github.blog/engineering/infrastructure/how-github-uses-merge-queue-to-ship-hundreds-of-changes-daily/',
  'https://github.blog/engineering/engineering-principles/how-github-converted-hundreds-of-millions-of-api-requests-per-day/',
  // Shopify
  'https://shopify.engineering/building-resilient-payment-systems',
  'https://shopify.engineering/rubykaigi-2024-shopify',
  // Meta
  'https://engineering.fb.com/2023/08/15/open-source/immortal-threads-multithreading-life-death-and-the-execution-of-concurrent-software/',
  'https://engineering.fb.com/2024/03/19/data-infrastructure/composable-data-management-at-meta/',
  // LinkedIn
  'https://engineering.linkedin.com/blog/2023/stream-processing-with-apache-flink--linkedins-journey-to-the-n',
  'https://engineering.linkedin.com/blog/2024/linkedins-approach-to-chaos-engineering',
  // ByteByteGo
  'https://blog.bytebytego.com/p/ep113-10-key-data-structures-we-use',
  'https://blog.bytebytego.com/p/ep103-consistent-hashing-explained',
  // Martin Fowler
  'https://martinfowler.com/articles/patterns-of-distributed-systems/two-phase-commit.html',
  'https://martinfowler.com/articles/is-quality-worth-cost.html',
  // Julia Evans
  'https://jvns.ca/blog/2023/04/17/a-list-of-programming-bloggers/',
  'https://jvns.ca/blog/2024/01/26/inside-git/',
  // High Scalability
  'http://highscalability.com/blog/2023/2/7/efficient-pagination-using-a-cursor-based-approach.html',
  // Discord
  'https://discord.com/blog/how-discord-stores-trillions-of-messages',
  // Slack
  'https://slack.engineering/how-slack-built-shared-channels/',
  // DoorDash
  'https://doordash.engineering/2023/01/23/from-zero-to-production-postgres/',
  // Airbnb
  'https://medium.com/airbnb-engineering/building-airbnbs-internationalization-platform-45cf0104b63c',
  // Figma
  'https://www.figma.com/blog/how-figmas-multiplayer-technology-works/',
];

interface Result {
  url: string;
  success: boolean;
  wordCount: number;
  title: string;
  error?: string;
}

async function runSpike(): Promise<void> {
  console.log(`Testing extraction on ${TEST_URLS.length} curated URLs...\n`);

  const results: Result[] = [];
  let i = 0;
  for (const url of TEST_URLS) {
    i++;
    process.stdout.write(`[${i}/${TEST_URLS.length}] ${url.slice(0, 70)}... `);
    const start = Date.now();
    try {
      // null rssText, isCurated=true to also test Puppeteer fallback layer
      const article = await extractArticle(url, null, true);
      const ms = Date.now() - start;
      if (article && article.wordCount >= 300) {
        console.log(`OK (${article.wordCount} words, ${ms}ms)`);
        results.push({ url, success: true, wordCount: article.wordCount, title: article.title });
      } else {
        const reason = article ? `only ${article.wordCount} words` : 'null result';
        console.log(`FAIL (${reason}, ${ms}ms)`);
        results.push({ url, success: false, wordCount: article?.wordCount ?? 0, title: article?.title ?? '' });
      }
    } catch (err) {
      const ms = Date.now() - start;
      console.log(`ERROR (${String(err).slice(0, 60)}, ${ms}ms)`);
      results.push({ url, success: false, wordCount: 0, title: '', error: String(err) });
    }
  }

  const passed = results.filter((r) => r.success).length;
  const rate = (passed / TEST_URLS.length) * 100;

  console.log('\n─────────────────────────────────────────');
  console.log(`Results: ${passed}/${TEST_URLS.length} passed (${rate.toFixed(1)}%)`);
  console.log(`Threshold: 80%`);
  console.log(`Gate: ${rate >= 80 ? 'PASS ✓' : 'FAIL ✗ — revise extraction approach before building the pipeline'}`);

  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    console.log('\nFailed URLs:');
    for (const f of failures) {
      console.log(`  - ${f.url}${f.error ? ` (${f.error.slice(0, 60)})` : ''}`);
    }
  }

  const avgWords = results.filter((r) => r.success).reduce((s, r) => s + r.wordCount, 0) / Math.max(passed, 1);
  console.log(`\nAvg word count (passing): ${Math.round(avgWords)}`);

  process.exit(rate >= 80 ? 0 : 1);
}

runSpike().catch((err) => {
  console.error('Spike failed:', err);
  process.exit(1);
});
