import { logger } from '../utils/logger.js';

const COMMON_RSS_PATHS = ['/feed', '/rss', '/atom.xml', '/feed.xml', '/index.xml', '/rss.xml'];
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = 'devcast/1.0 (+https://devcast.lilicurl.com)';

/**
 * Discovers the RSS/Atom feed URL for a given homepage URL.
 *
 * Strategy:
 * 1. Fetch homepage HTML, parse <link rel="alternate"> tags
 * 2. Try common paths as fallback
 * Returns null if no feed found.
 */
export async function discoverRssUrl(homepageUrl: string): Promise<string | null> {
  const html = await fetchHtml(homepageUrl);
  if (html) {
    const fromLink = extractLinkTag(html, homepageUrl);
    if (fromLink) return fromLink;
  }

  // Fallback: probe common paths
  const base = baseUrl(homepageUrl);
  for (const path of COMMON_RSS_PATHS) {
    const candidate = `${base}${path}`;
    if (await isValidFeed(candidate)) return candidate;
  }

  logger.info('rss.discovery.not_found', { url: homepageUrl });
  return null;
}

function extractLinkTag(html: string, homepageUrl: string): string | null {
  // Match <link ... type="application/rss+xml" ...> or type="application/atom+xml"
  const linkPattern = /<link[^>]+(?:rss\+xml|atom\+xml)[^>]*>/gi;
  const hrefPattern = /href=["']([^"']+)["']/i;

  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const hrefMatch = hrefPattern.exec(match[0]);
    if (hrefMatch?.[1]) {
      return resolveUrl(hrefMatch[1], homepageUrl);
    }
  }
  return null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function isValidFeed(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    clearTimeout(timer);
    if (!response.ok) return false;
    const ct = response.headers.get('content-type') ?? '';
    return /xml|rss|atom/.test(ct);
  } catch {
    return false;
  }
}

function baseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url;
  }
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}
