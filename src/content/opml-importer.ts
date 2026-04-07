import type { SupabaseClient } from '@supabase/supabase-js';
import { discoverRssUrl } from './rss-discovery.js';
import { logger } from '../utils/logger.js';
import type { DiscoveredFrom, SourceTrust } from './types.js';

interface OpmlOutline {
  xmlUrl?: string;
  htmlUrl?: string;
  text?: string;
  title?: string;
}

interface ImportResult {
  added: number;
  skipped_existing: number;
  skipped_no_rss: number;
  errors: number;
}

/**
 * Parses OPML XML and extracts feed outlines.
 * Handles both <outline xmlUrl="..."> (direct RSS) and <outline htmlUrl="..."> (homepage).
 */
export function parseOpml(xml: string): OpmlOutline[] {
  const outlines: OpmlOutline[] = [];
  const outlinePattern = /<outline\b([^>]*?)(?:\/>|>)/gi;

  let match: RegExpExecArray | null;
  while ((match = outlinePattern.exec(xml)) !== null) {
    const attrs = match[1] ?? '';
    const xmlUrl = extractAttr(attrs, 'xmlUrl');
    const htmlUrl = extractAttr(attrs, 'htmlUrl');
    const text = extractAttr(attrs, 'text') ?? extractAttr(attrs, 'title') ?? '';

    if (xmlUrl || htmlUrl) {
      outlines.push({ xmlUrl, htmlUrl, text });
    }
  }

  return outlines;
}

function extractAttr(attrs: string, name: string): string | undefined {
  const pattern = new RegExp(`\\b${name}=["']([^"']*)["']`, 'i');
  return pattern.exec(attrs)?.[1];
}

/**
 * Fetches OPML from a GitHub raw URL and returns parsed outlines.
 */
export async function fetchOpml(rawUrl: string): Promise<OpmlOutline[]> {
  const response = await fetch(rawUrl, {
    headers: { 'User-Agent': 'devcast/1.0 (+https://devcast.lilicurl.com)' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch OPML from ${rawUrl}: HTTP ${response.status}`);
  }
  const xml = await response.text();
  return parseOpml(xml);
}

/**
 * Imports new sources from OPML outlines into content_sources.
 *
 * Sources that appear in both repos get trust='verified'.
 * Others default to trust='open'.
 * All start as status='queued'.
 */
export async function importSources(
  db: SupabaseClient,
  outlines: OpmlOutline[],
  discoveredFrom: DiscoveredFrom,
  existingUrls: Set<string>,
): Promise<ImportResult> {
  const result: ImportResult = { added: 0, skipped_existing: 0, skipped_no_rss: 0, errors: 0 };

  for (const outline of outlines) {
    try {
      // Determine the canonical homepage URL and RSS URL
      const homepageUrl = outline.htmlUrl ?? outline.xmlUrl ?? '';
      if (!homepageUrl) continue;

      if (existingUrls.has(homepageUrl)) {
        result.skipped_existing++;
        continue;
      }

      let rssUrl = outline.xmlUrl ?? null;

      // If no RSS URL in OPML, discover it from the homepage
      if (!rssUrl) {
        rssUrl = await discoverRssUrl(homepageUrl);
        if (!rssUrl) {
          logger.info('content.import.no_rss', { url: homepageUrl });
          result.skipped_no_rss++;
          continue;
        }
      }

      const trust: SourceTrust = discoveredFrom === 'both' ? 'verified' : 'open';
      const name = outline.text ?? new URL(homepageUrl).hostname;

      const { error } = await db.from('content_sources').insert({
        name,
        url: homepageUrl,
        rss_url: rssUrl,
        trust,
        status: 'queued',
        discovered_from: discoveredFrom,
      });

      if (error) {
        // Unique violation = already exists (race condition), not a real error
        if (error.code === '23505') {
          result.skipped_existing++;
        } else {
          logger.warn('content.import.insert_error', { url: homepageUrl, error: error.message });
          result.errors++;
        }
      } else {
        logger.info('content.import.added', { url: homepageUrl, rss: rssUrl, trust });
        result.added++;
        existingUrls.add(homepageUrl);
      }
    } catch (err) {
      logger.warn('content.import.error', { outline, error: String(err) });
      result.errors++;
    }
  }

  return result;
}

/**
 * Main entry point for the discover-sources CRON.
 *
 * Fetches OPML from both reference repos, merges sources that appear in both
 * (trust='verified'), and inserts new ones as status='queued'.
 */
export async function discoverSources(db: SupabaseClient): Promise<void> {
  const AWESOME_TECH_RSS_OPML =
    'https://raw.githubusercontent.com/tuan3w/awesome-tech-rss/master/feeds.opml';
  const ENGINEERING_BLOGS_OPML =
    'https://raw.githubusercontent.com/kilimchoi/engineering-blogs/master/engineering_blogs.opml';

  logger.info('content.discover.start');

  // Load existing URLs to skip duplicates
  const { data: existing } = await db.from('content_sources').select('url');
  const existingUrls = new Set<string>((existing ?? []).map((r: { url: string }) => r.url));

  logger.info('content.discover.existing', { count: existingUrls.size });

  // Fetch both OPML files
  const [awesomeOutlines, engineeringOutlines] = await Promise.all([
    fetchOpml(AWESOME_TECH_RSS_OPML).catch((err) => {
      logger.warn('content.discover.opml_fail', { source: 'awesome-tech-rss', error: String(err) });
      return [] as OpmlOutline[];
    }),
    fetchOpml(ENGINEERING_BLOGS_OPML).catch((err) => {
      logger.warn('content.discover.opml_fail', { source: 'engineering-blogs', error: String(err) });
      return [] as OpmlOutline[];
    }),
  ]);

  // Find URLs that appear in both repos → trust='verified' (discoveredFrom='both')
  const awesomeUrls = new Set(awesomeOutlines.map((o) => normalizeUrl(o.xmlUrl ?? o.htmlUrl ?? '')));
  const bothOutlines = engineeringOutlines.filter((o) =>
    awesomeUrls.has(normalizeUrl(o.xmlUrl ?? o.htmlUrl ?? '')),
  );
  const engineeringOnly = engineeringOutlines.filter(
    (o) => !awesomeUrls.has(normalizeUrl(o.xmlUrl ?? o.htmlUrl ?? '')),
  );

  logger.info('content.discover.opml_parsed', {
    awesome: awesomeOutlines.length,
    engineering: engineeringOutlines.length,
    both: bothOutlines.length,
  });

  // Import in priority order: both repos first, then individual repos
  const bothResult = await importSources(db, bothOutlines, 'both', existingUrls);
  const awesomeResult = await importSources(db, awesomeOutlines, 'awesome-tech-rss', existingUrls);
  const engineeringResult = await importSources(db, engineeringOnly, 'engineering-blogs', existingUrls);

  logger.info('content.discover.done', {
    added: bothResult.added + awesomeResult.added + engineeringResult.added,
    skipped_existing: bothResult.skipped_existing + awesomeResult.skipped_existing + engineeringResult.skipped_existing,
    skipped_no_rss: bothResult.skipped_no_rss + awesomeResult.skipped_no_rss + engineeringResult.skipped_no_rss,
    errors: bothResult.errors + awesomeResult.errors + engineeringResult.errors,
  });
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
