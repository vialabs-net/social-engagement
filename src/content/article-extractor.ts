import { extract } from '@extractus/article-extractor';
import { logger } from '../utils/logger.js';
import type { ArticleText } from './types.js';

const EXTRACT_TIMEOUT_MS = 30_000;
const MIN_WORD_COUNT_RESULT = 100;   // below this = extraction failed
const MIN_WORD_COUNT_ACCEPT = 300;   // below this = use Puppeteer fallback for curated
const USER_AGENT = 'devcast/1.0 (+https://devcast.lilicurl.com)';

/**
 * Three-layer extraction strategy:
 *
 * Layer 1 — RSS content (provided by caller from feed parsing)
 *   If rssText has >= 300 words → use it directly, no HTTP fetch needed.
 *
 * Layer 2 — URL fetch via @extractus/article-extractor
 *   Fallback when RSS is truncated or absent.
 *   Handles static HTML sites (Cloudflare, Figma, GitHub, etc.).
 *
 * Layer 3 — Puppeteer headless browser
 *   Only for trust='curated' sources when layers 1+2 both fail.
 *   Handles JS-rendered blogs (Stripe, Discord, LinkedIn, etc.).
 *
 * Returns null when all layers fail or result is too short.
 */
export async function extractArticle(
  url: string,
  rssText: string | null,
  isCurated: boolean,
): Promise<ArticleText | null> {
  // Layer 1: RSS content
  if (rssText) {
    const rssResult = parseRssText(rssText);
    if (rssResult && rssResult.wordCount >= MIN_WORD_COUNT_ACCEPT) {
      return rssResult;
    }
  }

  // Layer 2: URL fetch
  const urlResult = await extractFromUrl(url);
  if (urlResult && urlResult.wordCount >= MIN_WORD_COUNT_ACCEPT) {
    return urlResult;
  }

  // Layer 3: Puppeteer — curated sources only
  if (isCurated) {
    logger.info('content.extract.puppeteer', { url });
    const puppeteerResult = await extractWithPuppeteer(url);
    if (puppeteerResult && puppeteerResult.wordCount >= MIN_WORD_COUNT_RESULT) {
      return puppeteerResult;
    }
  }

  return null;
}

function parseRssText(raw: string): ArticleText | null {
  const text = stripHtml(raw);
  const wordCount = countWords(text);
  if (wordCount < MIN_WORD_COUNT_RESULT) return null;
  return { title: '', text, wordCount, publishedAt: null };
}

async function extractFromUrl(url: string): Promise<ArticleText | null> {
  try {
    const signal = AbortSignal.timeout(EXTRACT_TIMEOUT_MS);
    const article = await extract(url, {}, { signal, headers: { 'User-Agent': USER_AGENT } });
    if (!article?.content) return null;

    const text = stripHtml(article.content);
    const wordCount = countWords(text);
    if (wordCount < MIN_WORD_COUNT_RESULT) return null;

    return {
      title: article.title ?? '',
      text,
      wordCount,
      publishedAt: article.published ? new Date(article.published) : null,
    };
  } catch {
    return null;
  }
}

async function extractWithPuppeteer(url: string): Promise<ArticleText | null> {
  // Dynamic import to avoid loading Puppeteer when it is not needed
  let browser;
  try {
    const { launch } = await import('puppeteer-core');
    const puppeteerFull = await import('puppeteer');
    const executablePath = puppeteerFull.executablePath as () => string;

    browser = await launch({
      executablePath: executablePath(),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    await page.goto(url, { waitUntil: 'networkidle2', timeout: EXTRACT_TIMEOUT_MS });

    // String-based evaluate to avoid TS DOM-type conflicts in Node context
    const text = await page.evaluate(`
      (function() {
        ['nav','header','footer','aside','.sidebar','.ad'].forEach(function(sel) {
          document.querySelectorAll(sel).forEach(function(el) { el.remove(); });
        });
        return document.body ? document.body.innerText : '';
      })()
    `) as string;

    const title = await page.title();
    const wordCount = countWords(text);
    if (wordCount < MIN_WORD_COUNT_RESULT) return null;

    return { title, text, wordCount, publishedAt: null };
  } catch (err) {
    logger.warn('content.extract.puppeteer.fail', { url, error: String(err) });
    return null;
  } finally {
    await browser?.close();
  }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}
