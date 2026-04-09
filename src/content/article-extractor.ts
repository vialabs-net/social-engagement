import { existsSync, readFileSync } from 'fs';
import { extract } from '@extractus/article-extractor';
import { parse } from 'yaml';
import { logger } from '../utils/logger.js';
import type { ArticleText } from './types.js';

const EXTRACT_TIMEOUT_MS = 30_000;
const EXTRACT_RETRY_DELAY_MS = 1_500;
const PUPPETEER_LAUNCH_TIMEOUT_MS = 20_000;
const PUPPETEER_TOTAL_TIMEOUT_MS = 45_000;
const BROWSER_CLOSE_TIMEOUT_MS = 2_000;
const MIN_WORD_COUNT_RESULT = 100;   // below this = extraction failed
const MIN_WORD_COUNT_ACCEPT = 300;   // below this = use Puppeteer fallback for curated
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
const DEFAULT_PUPPETEER_FALLBACK_HOSTS = [
  'discord.com',
  'stripe.com',
  'www.linkedin.com',
] as const;

interface UrlRequestProfile {
  readonly name: string;
  readonly headers: Record<string, string>;
}

interface ExtractionPolicy {
  readonly puppeteerFallbackHosts: Set<string>;
  readonly source: 'default' | 'env' | 'config';
}

let cachedExtractionPolicy: ExtractionPolicy | null = null;

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
  const host = getHostname(url);
  const extractionPolicy = getExtractionPolicy();
  const allowPuppeteerFallback = isCurated && shouldUsePuppeteerFallback(url, extractionPolicy);

  // Layer 1: RSS content
  if (rssText) {
    const rssResult = parseRssText(rssText);
    if (rssResult && rssResult.wordCount >= MIN_WORD_COUNT_ACCEPT) {
      logger.info('content.extract.success', {
        url,
        host,
        layer: 'rss',
        wordCount: rssResult.wordCount,
        isCurated,
      });
      return rssResult;
    }
  }

  // Layer 2: URL fetch
  const urlResult = await extractFromUrl(url);
  if (urlResult && urlResult.wordCount >= MIN_WORD_COUNT_ACCEPT) {
    logger.info('content.extract.success', {
      url,
      host,
      layer: 'url',
      wordCount: urlResult.wordCount,
      isCurated,
    });
    return urlResult;
  }

  // Layer 3: Puppeteer — curated sources only
  if (allowPuppeteerFallback) {
    logger.info('content.extract.puppeteer', {
      url,
      host,
      policySource: extractionPolicy.source,
    });
    const puppeteerResult = await extractWithPuppeteer(url);
    if (puppeteerResult && puppeteerResult.wordCount >= MIN_WORD_COUNT_RESULT) {
      logger.info('content.extract.success', {
        url,
        host,
        layer: 'puppeteer',
        wordCount: puppeteerResult.wordCount,
        isCurated,
      });
      return puppeteerResult;
    }
  }

  logger.warn('content.extract.fail', {
    url,
    host,
    isCurated,
    attemptedPuppeteer: allowPuppeteerFallback,
    policySource: extractionPolicy.source,
  });

  return null;
}

function parseRssText(raw: string): ArticleText | null {
  const text = stripHtml(raw);
  const wordCount = countWords(text);
  if (wordCount < MIN_WORD_COUNT_RESULT) return null;
  return { title: '', text, wordCount, publishedAt: null };
}

async function extractFromUrl(url: string): Promise<ArticleText | null> {
  const host = getHostname(url);
  const requestProfiles = getUrlRequestProfiles(url);

  for (let index = 0; index < requestProfiles.length; index++) {
    const profile = requestProfiles[index]!;

    try {
      if (index > 0) {
        await sleep(EXTRACT_RETRY_DELAY_MS);
      }

      const signal = AbortSignal.timeout(EXTRACT_TIMEOUT_MS);
      const article = await extract(url, {}, { signal, headers: profile.headers });
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
    } catch (err) {
      logger.debug('content.extract.url.fail', {
        url,
        host,
        profile: profile.name,
        error: String(err),
      });

      if (index < requestProfiles.length - 1) {
        logger.info('content.extract.url.retry', {
          url,
          host,
          fromProfile: profile.name,
          toProfile: requestProfiles[index + 1]!.name,
        });
        continue;
      }
    }
  }

  return null;
}

async function extractWithPuppeteer(url: string): Promise<ArticleText | null> {
  // Dynamic import to avoid loading Puppeteer when it is not needed
  let browser: {
    close(): Promise<void>;
    newPage(): Promise<{
      setDefaultNavigationTimeout(timeout: number): void;
      setDefaultTimeout(timeout: number): void;
      setUserAgent(userAgent: string): Promise<void>;
      setExtraHTTPHeaders(headers: Record<string, string>): Promise<void>;
      goto(url: string, options: { waitUntil: 'domcontentloaded'; timeout: number }): Promise<unknown>;
      waitForSelector(selector: string, options: { timeout: number }): Promise<unknown>;
      waitForNetworkIdle(options: { idleTime: number; timeout: number }): Promise<unknown>;
      evaluate(script: string): Promise<unknown>;
      title(): Promise<string>;
    }>;
    process(): { kill(signal?: NodeJS.Signals | number): boolean } | null;
  } | undefined;
  let skipBrowserClose = false;
  try {
    return await withTimeout(
      (async () => {
        const { launch } = await import('puppeteer-core');
        const puppeteerFull = await import('puppeteer');
        const executablePath = puppeteerFull.executablePath as () => string;

        browser = await launch({
          executablePath: executablePath(),
          headless: true,
          timeout: PUPPETEER_LAUNCH_TIMEOUT_MS,
          protocolTimeout: EXTRACT_TIMEOUT_MS,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });

        const page = await browser.newPage();
        const headers = getBaseBrowserHeaders();
        page.setDefaultNavigationTimeout(EXTRACT_TIMEOUT_MS);
        page.setDefaultTimeout(EXTRACT_TIMEOUT_MS);
        await page.setUserAgent(BROWSER_USER_AGENT);
        await page.setExtraHTTPHeaders(withoutUserAgentHeader(getHostSpecificBrowserHeaders(url, headers)));
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: EXTRACT_TIMEOUT_MS });
        await page.waitForSelector('body', { timeout: 5_000 }).catch(() => undefined);
        await page.waitForNetworkIdle({ idleTime: 750, timeout: 5_000 }).catch(() => undefined);

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
      })(),
      PUPPETEER_TOTAL_TIMEOUT_MS,
      () => {
        skipBrowserClose = true;
        logger.warn('content.extract.puppeteer.timeout', { url, timeoutMs: PUPPETEER_TOTAL_TIMEOUT_MS });
        browser?.process()?.kill('SIGKILL');
      },
    );
  } catch (err) {
    logger.warn('content.extract.puppeteer.fail', { url, error: String(err) });
    return null;
  } finally {
    await closeBrowserSafely(browser, skipBrowserClose, url);
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          onTimeout?.();
          reject(new Error(`Timed out after ${timeoutMs} ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
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

function getUrlRequestProfiles(url: string): UrlRequestProfile[] {
  const baseHeaders = getBaseBrowserHeaders();
  const hostHeaders = getHostSpecificBrowserHeaders(url, baseHeaders);

  if (headersEqual(baseHeaders, hostHeaders)) {
    return [{ name: 'browser-default', headers: baseHeaders }];
  }

  return [
    { name: 'browser-default', headers: baseHeaders },
    { name: 'host-browser', headers: hostHeaders },
  ];
}

function shouldUsePuppeteerFallback(url: string, policy: ExtractionPolicy): boolean {
  return policy.puppeteerFallbackHosts.has(getHostname(url));
}

function getExtractionPolicy(): ExtractionPolicy {
  if (cachedExtractionPolicy) return cachedExtractionPolicy;

  const envHosts = process.env['CONTENT_PUPPETEER_FALLBACK_HOSTS'];
  if (envHosts && envHosts.trim().length > 0) {
    cachedExtractionPolicy = {
      puppeteerFallbackHosts: new Set(parseHostList(envHosts)),
      source: 'env',
    };
    return cachedExtractionPolicy;
  }

  const configHosts = readFallbackHostsFromConfig();
  if (configHosts) {
    cachedExtractionPolicy = {
      puppeteerFallbackHosts: new Set(configHosts),
      source: 'config',
    };
    return cachedExtractionPolicy;
  }

  cachedExtractionPolicy = {
    puppeteerFallbackHosts: new Set(DEFAULT_PUPPETEER_FALLBACK_HOSTS),
    source: 'default',
  };
  return cachedExtractionPolicy;
}

function readFallbackHostsFromConfig(): string[] | null {
  if (!existsSync('config.yaml')) return null;

  try {
    const raw = readFileSync('config.yaml', 'utf8');
    const parsed = parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const content = (parsed as Record<string, unknown>)['content'];
    if (!content || typeof content !== 'object') return null;

    const extraction = (content as Record<string, unknown>)['extraction'];
    if (!extraction || typeof extraction !== 'object') return null;

    const hosts = (extraction as Record<string, unknown>)['puppeteer_fallback_hosts'];
    if (!Array.isArray(hosts)) return null;

    return hosts
      .map((host) => String(host).trim().toLowerCase())
      .filter((host) => host.length > 0);
  } catch (err) {
    logger.warn('content.extract.config_read_fail', { error: String(err) });
    return null;
  }
}

function parseHostList(value: string): string[] {
  return value
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return 'invalid-url';
  }
}

function getBaseBrowserHeaders(): Record<string, string> {
  return {
    'User-Agent': BROWSER_USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
  };
}

function getHostSpecificBrowserHeaders(
  url: string,
  baseHeaders: Record<string, string>,
): Record<string, string> {
  const host = getHostname(url);

  if (host === 'www.linkedin.com' || host === 'linkedin.com') {
    return {
      ...baseHeaders,
      'Origin': 'https://www.linkedin.com',
      'Referer': 'https://www.linkedin.com/',
    };
  }

  if (host === 'www.uber.com' || host === 'uber.com') {
    return {
      ...baseHeaders,
      'Origin': 'https://www.uber.com',
      'Referer': 'https://www.uber.com/',
    };
  }

  return baseHeaders;
}

function withoutUserAgentHeader(headers: Record<string, string>): Record<string, string> {
  const clone = { ...headers };
  delete clone['User-Agent'];
  return clone;
}

function headersEqual(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  if (leftEntries.length !== rightEntries.length) return false;
  return leftEntries.every(([key, value]) => right[key] === value);
}

async function closeBrowserSafely(
  browser: {
    close(): Promise<void>;
    process(): { kill(signal?: NodeJS.Signals | number): boolean } | null;
  } | undefined,
  skipBrowserClose: boolean,
  url: string,
): Promise<void> {
  if (!browser || skipBrowserClose) return;

  try {
    await withTimeout(browser.close(), BROWSER_CLOSE_TIMEOUT_MS, () => {
      browser.process()?.kill('SIGKILL');
    });
  } catch (err) {
    logger.debug('content.extract.puppeteer.close_fail', {
      url,
      error: String(err),
    });
    browser.process()?.kill('SIGKILL');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
