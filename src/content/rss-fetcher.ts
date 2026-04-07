import pLimit from 'p-limit';
import { stripHtml } from './article-extractor.js';
import { logger } from '../utils/logger.js';
import type { ContentSource } from './types.js';

const USER_AGENT = 'devcast/1.0 (+https://devcast.lilicurl.com)';
const FETCH_TIMEOUT_MS = 15_000;
const CONCURRENT_FETCHES = 5;
const DOMAIN_DELAY_MS = 15_000;

export interface RawArticle {
  sourceId: string;
  url: string;
  title: string;
  rssText: string | null;   // content:encoded or description (may be null if absent)
  publishedAt: Date | null;
}

export interface FetchResult {
  sourceId: string;
  articles: RawArticle[];
  failed: boolean;
}

/**
 * Fetches RSS feeds from all active sources concurrently (max 5 parallel).
 * Enforces a 15s delay between consecutive requests to the same domain.
 */
export async function fetchAllFeeds(sources: ContentSource[]): Promise<FetchResult[]> {
  const limit = pLimit(CONCURRENT_FETCHES);
  const domainLastFetch = new Map<string, number>();

  const tasks = sources.map((source) =>
    limit(async () => {
      await respectDomainDelay(source.rss_url, domainLastFetch);
      return fetchFeed(source);
    }),
  );

  return Promise.all(tasks);
}

async function fetchFeed(source: ContentSource): Promise<FetchResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(source.rss_url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      logger.warn('content.fetch.rss_error', { source: source.name, status: response.status });
      return { sourceId: source.id, articles: [], failed: true };
    }

    const xml = await response.text();
    const articles = parseEntries(xml, source.id);

    logger.info('content.fetch.rss_ok', { source: source.name, entries: articles.length });
    return { sourceId: source.id, articles, failed: false };
  } catch (err) {
    logger.warn('content.fetch.rss_fail', { source: source.name, error: String(err) });
    return { sourceId: source.id, articles: [], failed: true };
  }
}

function parseEntries(xml: string, sourceId: string): RawArticle[] {
  const articles: RawArticle[] = [];

  // Match RSS <item> or Atom <entry> blocks
  const itemPattern = /<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;

  let match: RegExpExecArray | null;
  while ((match = itemPattern.exec(xml)) !== null) {
    const block = match[1] ?? '';

    const url = extractFirst(block, ['<link>([^<]+)<\/link>', '<link[^>]+href=["\'](https?://[^"\']+)["\']']) ?? '';
    if (!url) continue;

    const title = stripHtml(extractFirst(block, ['<title[^>]*>([^<]*)<\/title>', '<title>([^<]+)<\/title>']) ?? '');
    const publishedAt = parseDate(
      extractFirst(block, ['<pubDate>([^<]+)<\/pubDate>', '<published>([^<]+)<\/published>', '<updated>([^<]+)<\/updated>']) ?? '',
    );

    // Prefer content:encoded (full text), then Atom <content>, then description
    const rssText = extractContent(block);

    articles.push({ sourceId, url: url.trim(), title: title.trim(), rssText, publishedAt });
  }

  return articles;
}

function extractContent(block: string): string | null {
  // RSS content:encoded
  const encoded = extractFirst(block, ['<content:encoded[^>]*>([\\s\\S]*?)<\\/content:encoded>']);
  if (encoded) {
    const text = stripHtml(encoded).trim();
    if (text.length > 50) return text;
  }

  // Atom <content>
  const atomContent = extractFirst(block, ['<content(?:\\s[^>]*)?>([\s\\S]*?)<\\/content>']);
  if (atomContent) {
    const text = stripHtml(atomContent).trim();
    if (text.length > 50) return text;
  }

  // Description fallback
  const desc = extractFirst(block, ['<description[^>]*>([\\s\\S]*?)<\\/description>']);
  if (desc) {
    const text = stripHtml(desc).trim();
    if (text.length > 50) return text;
  }

  return null;
}

function extractFirst(text: string, patterns: string[]): string | undefined {
  for (const pattern of patterns) {
    const match = new RegExp(pattern, 'i').exec(text);
    if (match?.[1]) {
      // Unwrap CDATA if present
      return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    }
  }
  return undefined;
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

async function respectDomainDelay(url: string, lastFetch: Map<string, number>): Promise<void> {
  let domain: string;
  try {
    domain = new URL(url).hostname;
  } catch {
    return;
  }

  const last = lastFetch.get(domain);
  if (last) {
    const wait = DOMAIN_DELAY_MS - (Date.now() - last);
    if (wait > 0) await sleep(wait);
  }
  lastFetch.set(domain, Date.now());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
