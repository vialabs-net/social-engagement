const CHUNK_SIZE_TOKENS = 512;
const CHUNK_OVERLAP_TOKENS = 64;
// Approximate token count: words × 1.3
const WORDS_PER_CHUNK = Math.floor(CHUNK_SIZE_TOKENS / 1.3);   // ~393 words
const OVERLAP_WORDS = Math.floor(CHUNK_OVERLAP_TOKENS / 1.3);  // ~49 words

const CODE_FENCE_PATTERN = /^```[\s\S]*?^```/gm;
const INDENTED_CODE_PATTERN = /(?:^(?:    |\t)[^\n]+\n?)+/gm;

/**
 * Splits article text into overlapping chunks for granular embedding.
 *
 * Rules:
 * - Split by paragraphs first; accumulate until CHUNK_SIZE reached
 * - Start next chunk with CHUNK_OVERLAP tokens from end of previous
 * - Code blocks: never split mid-block — include the whole block in a chunk
 *   (if a code block > CHUNK_SIZE, it becomes its own standalone chunk)
 *
 * Returns an array of chunk strings.
 */
export function chunkArticle(text: string): string[] {
  const segments = extractSegments(text);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const segment of segments) {
    const segWords = countWords(segment);

    // Oversized code block → standalone chunk
    if (segWords > WORDS_PER_CHUNK && isCodeBlock(segment)) {
      if (current.length > 0) {
        chunks.push(current.join('\n\n'));
        current = buildOverlap(current);
        currentWords = countWords(current.join(' '));
      }
      chunks.push(segment.trim());
      continue;
    }

    // Would overflow current chunk → flush
    if (currentWords + segWords > WORDS_PER_CHUNK && current.length > 0) {
      chunks.push(current.join('\n\n'));
      current = buildOverlap(current);
      currentWords = countWords(current.join(' '));
    }

    current.push(segment);
    currentWords += segWords;
  }

  if (current.length > 0 && countWords(current.join(' ')) > 20) {
    chunks.push(current.join('\n\n'));
  }

  return chunks.filter((c) => c.trim().length > 0);
}

function extractSegments(text: string): string[] {
  const segments: string[] = [];
  let remaining = text;

  // Extract code blocks first to avoid splitting them
  const codeBlocks: string[] = [];
  remaining = remaining.replace(CODE_FENCE_PATTERN, (match) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });
  remaining = remaining.replace(INDENTED_CODE_PATTERN, (match) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });

  // Split by double newline (paragraph boundaries)
  for (const part of remaining.split(/\n\n+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Restore code blocks
    if (trimmed.startsWith('__CODE_BLOCK_')) {
      const idx = parseInt(trimmed.replace('__CODE_BLOCK_', '').replace('__', ''));
      if (!isNaN(idx) && codeBlocks[idx]) {
        segments.push(codeBlocks[idx]!);
        continue;
      }
    }

    segments.push(trimmed);
  }

  return segments;
}

function buildOverlap(segments: string[]): string[] {
  // Take enough trailing segments to cover OVERLAP_WORDS
  const overlap: string[] = [];
  let words = 0;
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i]!;
    words += countWords(s);
    overlap.unshift(s);
    if (words >= OVERLAP_WORDS) break;
  }
  return overlap;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function isCodeBlock(text: string): boolean {
  return text.startsWith('```') || /^(    |\t)/.test(text);
}
