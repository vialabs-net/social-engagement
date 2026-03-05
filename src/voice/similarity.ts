/**
 * Computes how similar the published post is to the AI draft.
 * Returns a ratio between 0.0 (complete rewrite) and 1.0 (unchanged).
 *
 * Uses word-level comparison: count shared words / max(word counts).
 * Simple, fast, and language-agnostic.
 */
export function computeEditRatio(draft: string, published: string): number {
  const draftWords = tokenize(draft);
  const publishedWords = tokenize(published);

  if (draftWords.length === 0 && publishedWords.length === 0) return 1.0;
  if (draftWords.length === 0 || publishedWords.length === 0) return 0.0;

  const draftSet = new Map<string, number>();
  for (const word of draftWords) {
    draftSet.set(word, (draftSet.get(word) ?? 0) + 1);
  }

  let shared = 0;
  const publishedSet = new Map<string, number>();
  for (const word of publishedWords) {
    publishedSet.set(word, (publishedSet.get(word) ?? 0) + 1);
  }

  for (const [word, count] of publishedSet) {
    const inDraft = draftSet.get(word) ?? 0;
    shared += Math.min(count, inDraft);
  }

  const maxWords = Math.max(draftWords.length, publishedWords.length);
  return shared / maxWords;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
}
