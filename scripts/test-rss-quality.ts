/**
 * RSS content quality spike — v2 (raw fetch, no XML parser dependency)
 *
 * Tests whether RSS feeds provide sufficient text for classification.
 * Uses raw regex extraction to avoid fast-xml-parser entity expansion limits.
 *
 * Criteria:
 *   ok        >= 300 words
 *   truncated 100-299 words (Puppeteer candidate for curated sources)
 *   fail      < 100 words or unreachable
 *
 * Run: tsx --env-file=.env.local scripts/test-rss-quality.ts
 */

const USER_AGENT = 'devcast/1.0 (+https://devcast.lilicurl.com)';
const FETCH_TIMEOUT_MS = 15_000;

interface SourceFeed {
  name: string;
  rssUrl: string;
  trust: 'curated' | 'verified' | 'open';
}

const SOURCES: SourceFeed[] = [
  // curated — company engineering blogs
  // curated — company engineering blogs
  { name: 'Netflix Tech Blog',       rssUrl: 'https://netflixtechblog.medium.com/feed',                trust: 'curated' },
  { name: 'Stripe Blog',             rssUrl: 'https://stripe.com/blog/feed.rss',                       trust: 'curated' },
  { name: 'Cloudflare Blog',         rssUrl: 'https://blog.cloudflare.com/rss/',                       trust: 'curated' },
  { name: 'Uber Engineering',        rssUrl: 'https://www.uber.com/en-US/blog/engineering/rss/',        trust: 'curated' },
  { name: 'Dropbox Tech',            rssUrl: 'https://dropbox.tech/feed',                              trust: 'curated' },
  { name: 'GitHub Blog',             rssUrl: 'https://github.blog/feed/',                              trust: 'curated' },
  { name: 'Shopify Engineering',     rssUrl: 'https://shopify.engineering/feed',                       trust: 'curated' },
  { name: 'Meta Engineering',        rssUrl: 'https://engineering.fb.com/feed/',                       trust: 'curated' },
  { name: 'LinkedIn Engineering',    rssUrl: 'https://engineering.linkedin.com/blog.rss',              trust: 'curated' },
  { name: 'Discord Blog',            rssUrl: 'https://discord.com/blog/rss.xml',                       trust: 'curated' },
  { name: 'Slack Engineering',       rssUrl: 'https://slack.engineering/rss/',                         trust: 'curated' },
  { name: 'DoorDash Engineering',    rssUrl: 'https://doordash.engineering/feed/',                     trust: 'curated' },
  { name: 'Airbnb Engineering',      rssUrl: 'https://medium.com/feed/airbnb-engineering',             trust: 'curated' },
  { name: 'Figma Blog',              rssUrl: 'https://www.figma.com/blog/rss/',                        trust: 'curated' },
  { name: 'AWS Blog',                rssUrl: 'https://aws.amazon.com/blogs/aws/feed/',                 trust: 'curated' },
  { name: 'Google Cloud Blog',       rssUrl: 'https://cloudblog.withgoogle.com/rss/',                  trust: 'curated' },
  // verified — individual experts
  { name: 'Martin Fowler',           rssUrl: 'https://martinfowler.com/feed.atom',                    trust: 'verified' },
  { name: 'Julia Evans (jvns.ca)',   rssUrl: 'https://jvns.ca/atom.xml',                              trust: 'verified' },
  { name: 'ByteByteGo',              rssUrl: 'https://blog.bytebytego.com/feed',                       trust: 'verified' },
  { name: 'High Scalability',        rssUrl: 'http://feeds.feedburner.com/HighScalability',            trust: 'verified' },
  // open — platforms
  { name: 'Hashicorp Blog',          rssUrl: 'https://www.hashicorp.com/blog/feed.xml',                trust: 'open' },
  { name: 'Datadog Blog',            rssUrl: 'https://www.datadoghq.com/blog/feed.xml',               trust: 'open' },
  { name: 'Grafana Labs Blog',       rssUrl: 'https://grafana.com/blog/index.xml',                    trust: 'open' },
  { name: 'Fly.io Blog',             rssUrl: 'https://fly.io/blog/index.xml',                         trust: 'open' },
  { name: 'Vercel Blog',             rssUrl: 'https://vercel.com/atom',                               trust: 'open' },
  { name: 'Microsoft DevBlog',       rssUrl: 'https://devblogs.microsoft.com/feed/',                  trust: 'open' },
  { name: 'Atlassian Engineering',   rssUrl: 'https://www.atlassian.com/engineering/feed',            trust: 'open' },
  { name: 'Notion Engineering',      rssUrl: 'https://www.notion.so/blog/feed',                      trust: 'open' },
  { name: 'PlanetScale Blog',        rssUrl: 'https://planetscale.com/blog/rss',                      trust: 'open' },
  { name: 'Lenny Rachitsky',         rssUrl: 'https://www.lennysnewsletter.com/feed',                 trust: 'verified' },
];

interface FeedResult {
  name: string;
  trust: string;
  status: 'ok' | 'truncated' | 'fail';
  bestWordCount: number;
  contentSource: 'content:encoded' | 'description' | 'none';
  error?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function extractBestContent(xml: string): { words: number; source: FeedResult['contentSource'] } {
  const candidates: number[] = [];

  // RSS: content:encoded (usually full text)
  for (const m of xml.matchAll(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/gi)) {
    candidates.push(countWords(stripHtml(m[1] ?? '')));
  }

  // Atom: <content type="html"> or <content type="xhtml"> or plain <content>
  for (const m of xml.matchAll(/<content(?:\s[^>]*)?>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/gi)) {
    candidates.push(countWords(stripHtml(m[1] ?? '')));
  }

  const bestEncoded = candidates.sort((a, b) => b - a)[0] ?? 0;
  if (bestEncoded >= 100) return { words: bestEncoded, source: 'content:encoded' };

  // Fall back to description (RSS) — skip index 0 which is often channel description
  const descMatches = [...xml.matchAll(/<description>([\s\S]*?)<\/description>/gi)].slice(1, 4);
  const bestDesc = descMatches
    .map((m) => countWords(stripHtml(m[1] ?? '')))
    .sort((a, b) => b - a)[0] ?? 0;
  if (bestDesc > 0) return { words: bestDesc, source: 'description' };

  return { words: 0, source: 'none' };
}

async function testFeed(source: SourceFeed): Promise<FeedResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(source.rssUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/rss+xml, application/atom+xml, text/xml, */*' },
    });
    clearTimeout(timer);

    if (!response.ok) {
      return { name: source.name, trust: source.trust, status: 'fail', bestWordCount: 0, contentSource: 'none', error: `HTTP ${response.status}` };
    }

    const xml = await response.text();
    const { words, source: contentSource } = extractBestContent(xml);
    const status = words >= 300 ? 'ok' : words >= 100 ? 'truncated' : 'fail';

    return { name: source.name, trust: source.trust, status, bestWordCount: words, contentSource };
  } catch (err) {
    const msg = String(err).replace(/^Error: /, '').slice(0, 70);
    return { name: source.name, trust: source.trust, status: 'fail', bestWordCount: 0, contentSource: 'none', error: msg };
  }
}

async function runSpike(): Promise<void> {
  console.log(`\nRSS content quality spike — ${SOURCES.length} feeds\n`);

  const results: FeedResult[] = [];
  for (let i = 0; i < SOURCES.length; i++) {
    const source = SOURCES[i]!;
    process.stdout.write(`[${String(i + 1).padStart(2)}/${SOURCES.length}] ${`[${source.trust}]`.padEnd(11)} ${source.name.padEnd(26)} `);
    const result = await testFeed(source);
    const icon = result.status === 'ok' ? '✓' : result.status === 'truncated' ? '~' : '✗';
    const detail = result.bestWordCount > 0
      ? `${result.bestWordCount}w via ${result.contentSource}`
      : result.error ?? 'no content';
    console.log(`${icon}  ${detail}`);
    results.push(result);
  }

  const ok        = results.filter((r) => r.status === 'ok');
  const truncated = results.filter((r) => r.status === 'truncated');
  const failed    = results.filter((r) => r.status === 'fail');
  const passRate  = (ok.length / SOURCES.length) * 100;

  const curatedOk   = ok.filter((r) => r.trust === 'curated').length;
  const curatedTotal = SOURCES.filter((s) => s.trust === 'curated').length;
  const curatedRate = (curatedOk / curatedTotal) * 100;

  console.log('\n──────────────────────────────────────────────────────');
  console.log(`✓ Full content (>= 300w):  ${ok.length}/${SOURCES.length} total (${passRate.toFixed(0)}%)`);
  console.log(`  curated sources:         ${curatedOk}/${curatedTotal} (${curatedRate.toFixed(0)}%)`);
  console.log(`~ Truncated (100-299w):    ${truncated.length}  ← Puppeteer candidates`);
  console.log(`✗ Failed / empty:          ${failed.length}`);

  if (truncated.length > 0) {
    console.log('\nTruncated → Puppeteer candidates:');
    truncated.forEach((r) => console.log(`  ~ [${r.trust}] ${r.name} (${r.bestWordCount}w)`));
  }
  if (failed.length > 0) {
    console.log('\nFailed:');
    failed.forEach((r) => console.log(`  ✗ [${r.trust}] ${r.name}${r.error ? ` — ${r.error}` : ''}`));
  }
}

runSpike().catch((err) => {
  console.error('Spike crashed:', err);
  process.exit(1);
});
