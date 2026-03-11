import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';

interface ConcurrencyPattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  detect(addedLines: readonly string[]): boolean;
}

const PATTERNS: readonly ConcurrencyPattern[] = [
  {
    name: 'mutex / lock',
    score: 9,
    technicalDetail: 'Mutex — mutual exclusion lock that ensures only one operation accesses a shared resource at a time.',
    explanation: 'A mutex prevents two operations from modifying the same data simultaneously. Without it, concurrent writes can corrupt state — one update overwrites the other silently.',
    detect: (lines) => lines.some((l) =>
      /\bnew\s+Mutex\s*\(/.test(l) ||
      /\b(acquireLock|releaseLock|lock\.acquire|lock\.release|withLock)\s*\(/.test(l) ||
      /\bnew\s+Semaphore\s*\(/.test(l),
    ),
  },
  {
    name: 'atomic operation',
    score: 8,
    technicalDetail: 'Atomic operations — indivisible read-modify-write operations that prevent partial updates in concurrent contexts.',
    explanation: 'Atomic operations guarantee that a read-then-write happens as one indivisible step. Without atomicity, two concurrent increments can both read the same value and one update is lost.',
    detect: (lines) => lines.some((l) =>
      /\bAtomics\.(add|sub|load|store|exchange|compareExchange)\s*\(/.test(l) ||
      /\b(compareAndSwap|compareAndSet)\s*\(/.test(l) ||
      /\.\$inc\s*\(|\bincrement\s*\(.*atomic/i.test(l),
    ),
  },
  {
    name: 'worker threads',
    score: 8,
    technicalDetail: 'Worker threads — true parallelism by running CPU-intensive tasks in separate threads with message-passing communication.',
    explanation: 'Worker threads move heavy computation off the main thread. Node.js is single-threaded by default — without workers, a CPU-bound task blocks every other request.',
    detect: (lines) => lines.some((l) =>
      /\bnew\s+Worker\s*\(/.test(l) ||
      /\b(worker_threads|parentPort|workerData|isMainThread)\b/.test(l) ||
      /\bWorkerPool\s*[.(]/.test(l),
    ),
  },
  {
    name: 'concurrency control',
    score: 8,
    technicalDetail: 'Concurrency limiting — bounding the number of parallel operations to prevent resource exhaustion.',
    explanation: 'Running 10,000 requests in parallel crashes the process. A concurrency limiter runs them in controlled batches — fast enough to be useful, bounded enough to stay stable.',
    detect: (lines) => lines.some((l) =>
      /\b(p-limit|p-queue|p-map|PQueue|pLimit)\b/.test(l),
    ),
  },
  {
    name: 'race condition guard',
    score: 7,
    technicalDetail: 'Race condition guard — idempotency keys or abort signals that prevent duplicate or stale operations from corrupting state.',
    explanation: 'An idempotency key ensures the same request processed twice produces the same result. An AbortController cancels stale requests so old responses do not overwrite new ones.',
    detect: (lines) => lines.some((l) =>
      /\b(idempotencyKey|idempotency[_-]key|idempotent)\b/i.test(l) ||
      /\bnew\s+AbortController\s*\(/.test(l) ||
      /\bsignal\s*:\s*\w+\.signal\b/.test(l),
    ),
  },
];

export class ConcurrencyModule implements CodeAnalyzer {
  readonly id = 'concurrency';
  readonly name = 'Concurrency';
  readonly category = 'concurrency' as const;

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    for (const diff of ctx.diffs) {
      if (!diff.patch || diff.status === 'removed') continue;

      const addedLines = diff.patch
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1));

      if (addedLines.length === 0) continue;

      for (const pattern of PATTERNS) {
        if (pattern.detect(addedLines)) {
          return {
            moduleId: this.id,
            aspect: pattern.name,
            finding: `${pattern.name} in ${diff.filename}`,
            technicalDetail: pattern.technicalDetail,
            plainLanguage: pattern.explanation,
            interestScore: pattern.score,
            contextHint: `${diff.filename} in ${ctx.repo}`,
          };
        }
      }
    }

    return null;
  }
}
