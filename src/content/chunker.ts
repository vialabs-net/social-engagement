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
 * - Code blocks: keep them intact when reasonably sized
 * - Oversized segments are subdivided before chunk assembly so no single
 *   chunk can exceed the embedding model's practical input limit
 *
 * Returns an array of chunk strings.
 */
export function chunkArticle(text: string): string[] {
  const segments = extractSegments(text).flatMap(splitOversizedSegment);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const segment of segments) {
    const segWords = countWords(segment);

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

function splitOversizedSegment(segment: string): string[] {
  const trimmed = segment.trim();
  if (!trimmed) return [];

  if (countWords(trimmed) <= WORDS_PER_CHUNK) {
    return [trimmed];
  }

  return isCodeBlock(trimmed)
    ? splitOversizedCodeBlock(trimmed)
    : splitOversizedText(trimmed);
}

function splitOversizedText(text: string): string[] {
  return splitWords(text, OVERLAP_WORDS);
}

function splitOversizedCodeBlock(block: string): string[] {
  const lines = block.split('\n');
  const firstLine = lines[0]?.trim() ?? '';
  const lastLine = lines[lines.length - 1]?.trim() ?? '';
  const isFenced = firstLine.startsWith('```') && lastLine === '```';

  const bodyLines = isFenced ? lines.slice(1, -1) : lines;
  const chunks = splitLines(bodyLines, Math.max(8, Math.floor(OVERLAP_WORDS / 4)));

  if (!isFenced) {
    return chunks;
  }

  return chunks.map((chunk) => `${firstLine}\n${chunk}\n\`\`\``);
}

function splitLines(lines: string[], overlapLines: number): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const line of lines) {
    const lineWords = countWords(line);

    if (currentWords + lineWords > WORDS_PER_CHUNK && current.length > 0) {
      chunks.push(current.join('\n'));
      current = current.slice(Math.max(0, current.length - overlapLines));
      currentWords = countWords(current.join('\n'));
    }

    current.push(line);
    currentWords += lineWords;
  }

  if (current.length > 0) {
    chunks.push(current.join('\n'));
  }

  return chunks.flatMap((chunk) => splitOversizedText(chunk));
}

function splitWords(text: string, overlapWords: number): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length <= WORDS_PER_CHUNK) {
    return [text.trim()];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(words.length, start + WORDS_PER_CHUNK);
    chunks.push(words.slice(start, end).join(' '));
    if (end >= words.length) break;
    start = Math.max(end - overlapWords, start + 1);
  }

  return chunks;
}
