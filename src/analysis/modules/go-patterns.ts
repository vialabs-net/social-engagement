import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';
import { extractRemovedLines, extractFirstHunkSnippet } from '../diff-parser.js';

interface GoPattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  detect(addedLines: readonly string[]): boolean;
}

const PATTERNS: readonly GoPattern[] = [
  {
    name: 'goroutine',
    score: 8,
    technicalDetail: 'Goroutine — a lightweight thread managed by the Go runtime, launched with `go`, costing ~2KB of stack vs ~1MB for an OS thread.',
    explanation: 'A goroutine starts in two kilobytes of stack and costs almost nothing to spawn. Go programs routinely run hundreds of thousands of goroutines concurrently on a handful of OS threads.',
    detect: (lines) =>
      lines.some((l) => /\bgo\s+func\s*\(/.test(l) || /\bgo\s+[a-z]\w*\s*\(/.test(l)),
  },
  {
    name: 'channel communication',
    score: 8,
    technicalDetail: 'Go channels — typed conduits for goroutine communication, enforcing message-passing concurrency instead of shared memory.',
    explanation: "Go channels enforce the rule: don't communicate by sharing memory, share memory by communicating. Data ownership transfers through the channel — no locks needed.",
    detect: (lines) =>
      lines.some(
        (l) =>
          /\bmake\s*\(\s*chan\b/.test(l) ||
          /\bchan\s+\w/.test(l) ||
          /\b<-\s*\w/.test(l) ||
          /\w\s*<-/.test(l),
      ),
  },
  {
    name: 'context cancellation',
    score: 8,
    technicalDetail: 'context.WithCancel / context.WithTimeout — propagates cancellation and deadlines through the call stack without modifying function signatures.',
    explanation: 'Context threads cancellation signals through every layer of the call stack. When a request is cancelled, every goroutine doing work for it stops — no wasted resources.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\bcontext\.WithCancel\b/.test(l) ||
          /\bcontext\.WithTimeout\b/.test(l) ||
          /\bcontext\.WithDeadline\b/.test(l) ||
          /\bctx\.Done\(\)/.test(l),
      ),
  },
  {
    name: 'interface definition',
    score: 7,
    technicalDetail: 'Go interface — implicitly satisfied structural typing: any type implementing the methods satisfies the interface without declaration.',
    explanation: 'Go interfaces are satisfied implicitly — no `implements` keyword. If a type has the methods, it satisfies the interface. This keeps dependencies minimal and enables easy mocking.',
    detect: (lines) =>
      lines.some((l) => /\btype\s+\w+\s+interface\s*\{/.test(l)),
  },
  {
    name: 'error wrapping',
    score: 7,
    technicalDetail: 'Go error wrapping with %w (fmt.Errorf) — creates error chains that callers can inspect with errors.Is and errors.As without parsing strings.',
    explanation: 'Wrapping errors with %w builds a chain of context. The caller can use errors.Is to check for a specific error type anywhere in the chain, without string matching.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /fmt\.Errorf\s*\(.*%w/.test(l) ||
          /\berrors\.As\s*\(/.test(l) ||
          /\berrors\.Is\s*\(/.test(l) ||
          /\berrors\.Unwrap\s*\(/.test(l),
      ),
  },
  {
    name: 'sync primitives',
    score: 7,
    technicalDetail: 'sync.WaitGroup / sync.Mutex / sync.RWMutex — coordinating goroutine lifecycle and protecting shared state in concurrent code.',
    explanation: 'WaitGroup waits for a group of goroutines to finish. Mutex protects shared data. RWMutex allows concurrent reads but exclusive writes — standard concurrency tools.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\bsync\.WaitGroup\b/.test(l) ||
          /\bsync\.Mutex\b/.test(l) ||
          /\bsync\.RWMutex\b/.test(l) ||
          /\bsync\.Once\b/.test(l),
      ),
  },
  {
    name: 'table-driven tests',
    score: 8,
    technicalDetail: 'Table-driven tests — Go idiom of defining test cases as a slice of structs and iterating over them with t.Run, maximizing coverage with minimal code.',
    explanation: 'Table-driven tests define dozens of cases as a data table. Adding a new edge case is one line. Failures report which row failed — no guessing which test broke.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\[\]struct\s*\{/.test(l) ||
          (/\bt\.Run\s*\(/.test(l) && /\btest(s|Cases|Data|Table)\b/i.test(lines.join('\n'))),
      ),
  },
  {
    name: 'defer for resource cleanup',
    score: 7,
    technicalDetail: 'defer statement — schedules a function call to run when the surrounding function returns, ensuring cleanup regardless of the return path.',
    explanation: 'defer guarantees cleanup runs when the function exits — whether via return or panic. Open a resource, immediately defer its close, and the code is always correct.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\bdefer\s+\w+\.Close\(\)/.test(l) ||
          /\bdefer\s+\w+\.Unlock\(\)/.test(l) ||
          /\bdefer\s+cancel\(\)/.test(l),
      ),
  },
];

export class GoPatternsModule implements CodeAnalyzer {
  readonly id = 'go_patterns';
  readonly name = 'Go Patterns';
  readonly category = 'go_patterns' as const;
  readonly applicableLanguages = ['Go'];

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    for (const diff of ctx.diffs) {
      if (!diff.patch || diff.status === 'removed') continue;
      if (diff.language !== 'Go') continue;

      const addedLines = diff.patch
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1));

      if (addedLines.length === 0) continue;

      const removedText = extractRemovedLines(diff.patch);
      const removedLines = removedText.split('\n').filter(Boolean);

      for (const pattern of PATTERNS) {
        if (pattern.detect(addedLines) && !pattern.detect(removedLines)) {
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
      }
    }

    return null;
  }
}
