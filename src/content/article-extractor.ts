import { extract } from '@extractus/article-extractor';
import type { ArticleText } from './types.js';

const EXTRACT_TIMEOUT_MS = 30_000;
const MIN_WORD_COUNT = 100;

/**
 * Extracts full article text from a URL.
 * Returns null when extraction fails or content is too short.
 */
export async function extractArticle(url: string): Promise<ArticleText | null> {
  try {
    const signal = AbortSignal.timeout(EXTRACT_TIMEOUT_MS);
    const article = await extract(url, {}, { signal });
    if (!article?.content) return null;

    const text = stripHtml(article.content);
    const wordCount = countWords(text);
    if (wordCount < MIN_WORD_COUNT) return null;

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

function stripHtml(html: string): string {
  // Remove script/style blocks first
  let text = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Collapse whitespace
  return text.replace(/\s+/g, ' ').trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}
