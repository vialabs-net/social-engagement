import { createHash } from 'crypto';

/**
 * Two-step dedup — both steps run before any AI call.
 *
 * Step 1 — exact title hash (SHA-256 of lowercase title)
 *   Catches identical cross-posts.
 *
 * Step 2 — fuzzy similarity for similar titles
 *   Only when step 1 doesn't match.
 *   Jaccard word similarity > 70% on titles + word overlap > 85% on first 200 words.
 *   Catches rewritten cross-posts.
 */

export function titleHash(title: string): string {
  return createHash('sha256').update(title.toLowerCase().trim()).digest('hex');
}

export function articleFingerprint(text: string): string {
  // First 200 words, lowercased — used for fuzzy dedup comparison
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 200)
    .join(' ');
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2),
  );
}

/**
 * Returns true if the article is a duplicate of any stored article.
 *
 * @param title - Title of the candidate article
 * @param text  - Full text of the candidate article
 * @param storedHashes - Set of SHA-256 title hashes already in DB
 * @param storedFingerprints - Array of { titleTokens, fingerprintTokens } from DB
 */
export function isDuplicate(
  title: string,
  text: string,
  storedHashes: Set<string>,
  storedFingerprints: Array<{ titleTokens: Set<string>; fingerprintTokens: Set<string> }>,
): boolean {
  // Step 1 — exact title hash
  const hash = titleHash(title);
  if (storedHashes.has(hash)) return true;

  // Step 2 — fuzzy title match
  const candidateTitleTokens = tokenize(title);
  const candidateFingerprintTokens = tokenize(articleFingerprint(text));

  for (const stored of storedFingerprints) {
    const titleSimilarity = jaccardSimilarity(candidateTitleTokens, stored.titleTokens);
    if (titleSimilarity > 0.7) {
      const contentOverlap = jaccardSimilarity(candidateFingerprintTokens, stored.fingerprintTokens);
      if (contentOverlap > 0.85) return true;
    }
  }

  return false;
}

/**
 * Builds the stored-fingerprint entry from a DB row for use in isDuplicate().
 */
export function buildStoredFingerprint(
  title: string,
  fingerprint: string,
): { titleTokens: Set<string>; fingerprintTokens: Set<string> } {
  return {
    titleTokens: tokenize(title),
    fingerprintTokens: tokenize(fingerprint),
  };
}
