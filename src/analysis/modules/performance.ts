import type { CodeAnalyzer, AnalysisContext, Finding, ModuleResult } from '../types.js';
import { extractRemovedLines, extractFirstHunkSnippet } from '../diff-parser.js';

interface PerformancePattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  readonly skipOnNewFile?: boolean;
  detect(addedLines: readonly string[], filePatch: string): boolean;
}

const LOOP_KEYWORDS = /\b(for|while|forEach|\.map\(|\.flatMap\(|for\s+of|for\s+in)\b/;
const QUERY_KEYWORDS = /\b(\.query\(|\.execute\(|\.findOne\(|\.findMany\(|\.find\(|\.select\(|\.where\(|await\s+prisma\.|await\s+db\.)\b/;

function hasProximityMatch(
  lines: readonly string[],
  patternA: RegExp,
  patternB: RegExp,
  maxDistance: number,
): boolean {
  for (let i = 0; i < lines.length; i++) {
    if (patternA.test(lines[i]!)) {
      const start = Math.max(0, i - maxDistance);
      const end = Math.min(lines.length, i + maxDistance + 1);
      for (let j = start; j < end; j++) {
        if (j !== i && patternB.test(lines[j]!)) return true;
      }
    }
  }
  return false;
}

const PATTERNS: readonly PerformancePattern[] = [
  {
    name: 'query in loop (potential N+1)',
    score: 9,
    technicalDetail: 'N+1 query pattern — database call inside a loop. Each iteration triggers a separate query instead of a single batch fetch.',
    explanation: 'Each loop iteration fires a separate database query. With 100 items, that is 101 queries instead of 1. Batching or joining removes the bottleneck.',
    detect: (lines) => hasProximityMatch(lines, LOOP_KEYWORDS, QUERY_KEYWORDS, 10),
  },
  {
    name: 'sequential await in loop',
    score: 8,
    technicalDetail: 'Sequential async/await inside a loop — each iteration waits for the previous one to finish instead of running in parallel.',
    explanation: 'Awaiting inside a loop means each step waits for the previous one. If the operations are independent, running them in parallel with Promise.all cuts total time dramatically.',
    detect: (lines) => hasProximityMatch(lines, LOOP_KEYWORDS, /\bawait\s+/, 4),
    skipOnNewFile: true,
  },
  {
    name: 'database index creation',
    score: 8,
    technicalDetail: 'Database index — speeds up queries by avoiding full table scans on filtered or joined columns.',
    explanation: 'Adding an index turns a slow full-table scan into a fast lookup. One line in a migration can turn a 2-second query into a 2-millisecond one.',
    detect: (lines) => lines.some((l) => /\b(CREATE\s+INDEX|\.createIndex\(|\.ensureIndex\()/i.test(l)),
  },
  {
    name: 'batch operation',
    score: 8,
    technicalDetail: 'Batch processing — groups multiple operations into a single call to reduce round-trips and overhead.',
    explanation: 'Instead of sending requests one by one, batching groups them into a single call. Fewer round-trips means less latency and lower resource usage.',
    skipOnNewFile: true,
    detect: (lines) => lines.some((l) =>
      /\b(Promise\.all\(|Promise\.allSettled\(|\$in\b|\.insertMany\(|\.bulkWrite\(|\.createMany\(|\.batchWrite\()/.test(l),
    ),
  },
  {
    name: 'memoization / caching',
    score: 7,
    technicalDetail: 'Memoization or caching layer — stores computed results to avoid redundant work on repeated calls.',
    explanation: 'Caching saves the result of expensive work so it does not repeat. The first call pays the cost; every subsequent call is near-instant.',
    detect: (lines) => lines.some((l) =>
      /\b(useMemo\(|useCallback\(|React\.memo\(|\.memoize\(|cache\.get\(|cache\.set\(|new\s+Map\(\)|\.getOrSet\()/.test(l),
    ),
  },
  {
    name: 'lazy loading / code splitting',
    score: 7,
    technicalDetail: 'Lazy loading — defers loading of code or resources until they are actually needed, reducing initial bundle size.',
    explanation: 'Loading everything upfront slows the first render. Lazy loading defers heavy modules until the user needs them, cutting initial load time.',
    detect: (lines) => lines.some((l) =>
      /\b(React\.lazy\(|lazy\(\(\)\s*=>|import\(\s*['"]|dynamic\(\(\)\s*=>)/.test(l),
    ),
  },
  {
    name: 'event loop blocking (sync I/O)',
    score: 8,
    technicalDetail: 'Synchronous I/O — fs.readFileSync, execSync, and similar *Sync calls block the event loop, stalling all concurrent requests.',
    explanation: 'Node.js handles thousands of requests on a single thread. A *Sync call freezes that thread until the disk or child process responds — every other request waits in line.',
    detect: (lines, filePatch) => {
      const isCli = /(?:cli|script|bin|seed|migrate|setup)\b/i.test(filePatch);
      if (isCli) return false;
      return lines.some((l) =>
        /\b(readFileSync|writeFileSync|appendFileSync|existsSync|mkdirSync|readdirSync|statSync|execSync|execFileSync|spawnSync)\s*\(/.test(l),
      );
    },
  },
  {
    name: 'stream processing',
    score: 7,
    technicalDetail: 'Node.js streams — processing data chunk-by-chunk instead of loading the entire payload into memory.',
    explanation: 'Streams process data as it arrives. Instead of reading a 2GB file into memory, a stream handles it in small chunks — constant memory, no matter the file size.',
    detect: (lines) => lines.some((l) =>
      /\b(createReadStream|createWriteStream|pipeline\(|new\s+Transform\(|new\s+Readable\(|new\s+Writable\(|\.pipe\s*\()/.test(l),
    ),
  },
];

export class PerformanceModule implements CodeAnalyzer {
  readonly id = 'performance';
  readonly name = 'Performance Patterns';
  readonly category = 'performance' as const;

  async analyze(ctx: AnalysisContext): Promise<ModuleResult> {
    let hasBilateral = false;

    for (const diff of ctx.diffs) {
      if (!diff.patch || diff.status === 'removed') continue;

      const addedLines = diff.patch
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1));

      if (addedLines.length === 0) continue;

      const removedText = extractRemovedLines(diff.patch);
      const removedLines = removedText.split('\n').filter(Boolean);

      for (const pattern of PATTERNS) {
        if (pattern.skipOnNewFile && diff.status === 'added') continue;
        if (pattern.detect(addedLines, diff.patch) && !pattern.detect(removedLines, diff.patch)) {
          return {
            moduleId: this.id,
            aspect: pattern.name,
            finding: `Detected ${pattern.name} in ${diff.filename}`,
            technicalDetail: pattern.technicalDetail,
            plainLanguage: pattern.explanation,
            interestScore: pattern.score,
            contextHint: `${diff.filename} in ${ctx.repo}`,
            evidence: {
              before: removedText.slice(0, 300) || undefined,
              after: extractFirstHunkSnippet(diff.patch) || undefined,
            },
          };
        }
        if (pattern.detect(addedLines, diff.patch) && pattern.detect(removedLines, diff.patch)) {
          hasBilateral = true;
        }
      }
    }

    return hasBilateral ? { kind: 'delta_hit' as const, topic: this.id, strength: 2 as const } : null;
  }
}
