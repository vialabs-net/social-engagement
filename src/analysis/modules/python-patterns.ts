import type { CodeAnalyzer, AnalysisContext, Finding, ModuleResult } from '../types.js';
import { extractRemovedLines, extractFirstHunkSnippet } from '../diff-parser.js';

interface PythonPattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  detect(addedLines: readonly string[]): boolean;
}

const PATTERNS: readonly PythonPattern[] = [
  {
    name: 'type hints',
    score: 7,
    technicalDetail: 'PEP 484 type hints — annotating function signatures and variables with types for static analysis and IDE support.',
    explanation: 'Python type hints let mypy or pyright catch type errors before runtime. The code stays dynamic but tools can reason about it statically — the best of both worlds.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /def\s+\w+\s*\([^)]*:\s*\w/.test(l) ||
          /\)\s*->\s*\w/.test(l) ||
          /^from\s+typing\s+import/.test(l) ||
          /^from\s+__future__\s+import\s+annotations/.test(l),
      ),
  },
  {
    name: 'dataclass',
    score: 7,
    technicalDetail: 'Python dataclass (PEP 557) — auto-generates `__init__`, `__repr__`, `__eq__` from annotated fields, reducing boilerplate.',
    explanation: 'A @dataclass eliminates the manual `__init__` and `__repr__` boilerplate. Declare the fields once with types — Python generates the rest.',
    detect: (lines) =>
      lines.some((l) => /^\s*@dataclass/.test(l) || /from\s+dataclasses\s+import/.test(l)),
  },
  {
    name: 'Pydantic model',
    score: 8,
    technicalDetail: 'Pydantic BaseModel — runtime data validation and serialization using Python type annotations, with automatic coercion and error messages.',
    explanation: 'Pydantic validates incoming data at runtime using the same type annotations mypy reads. One model definition handles validation, serialization, and schema generation.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /class\s+\w+\s*\(\s*BaseModel\s*\)/.test(l) ||
          /from\s+pydantic\s+import/.test(l) ||
          /^\s*@validator\b/.test(l) ||
          /^\s*@model_validator\b/.test(l),
      ),
  },
  {
    name: 'async/await',
    score: 8,
    technicalDetail: 'Python asyncio — cooperative multitasking with async def and await, enabling non-blocking I/O without threads.',
    explanation: 'Async Python handles thousands of concurrent I/O operations on a single thread. No threads, no locks — the event loop switches coroutines when they yield control.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /^\s*async\s+def\s+/.test(l) ||
          /\bawait\s+\w/.test(l) ||
          /\basyncio\b/.test(l) ||
          /^import\s+asyncio/.test(l),
      ),
  },
  {
    name: 'Protocol structural typing',
    score: 8,
    technicalDetail: 'typing.Protocol (PEP 544) — structural subtyping (duck typing) checked statically by mypy, without explicit inheritance.',
    explanation: 'Protocol lets you define an interface without requiring explicit inheritance. Any class with the right methods satisfies it — duck typing made static.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /class\s+\w+\s*\(\s*Protocol\s*\)/.test(l) ||
          /from\s+typing\s+import.*\bProtocol\b/.test(l),
      ),
  },
  {
    name: 'lru_cache / functools optimization',
    score: 7,
    technicalDetail: 'functools.lru_cache or functools.cache — memoizes function results with a Least Recently Used cache, trading memory for CPU time.',
    explanation: 'A single decorator makes a function remember its previous results. Repeated calls with the same arguments return instantly from cache instead of recomputing.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /^\s*@lru_cache/.test(l) ||
          /^\s*@functools\.lru_cache/.test(l) ||
          /^\s*@cache\b/.test(l) ||
          /^\s*@functools\.cache/.test(l),
      ),
  },
  {
    name: 'context manager',
    score: 7,
    technicalDetail: 'Custom context manager — __enter__/__exit__ or @contextmanager, ensuring deterministic resource cleanup via the `with` statement.',
    explanation: 'A context manager guarantees cleanup runs even if an exception is raised. Files, locks, and connections open and close reliably without try/finally boilerplate.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /def\s+__enter__\s*\(/.test(l) ||
          /def\s+__exit__\s*\(/.test(l) ||
          /^\s*@contextmanager/.test(l) ||
          /from\s+contextlib\s+import/.test(l),
      ),
  },
  {
    name: 'generator / lazy evaluation',
    score: 7,
    technicalDetail: 'Python generator — functions using yield to produce values lazily, processing data one item at a time without loading the entire sequence into memory.',
    explanation: 'Generators produce values one at a time instead of building the full list. Processing a million-row CSV becomes constant memory — the generator never holds more than one row.',
    detect: (lines) =>
      lines.some(
        (l) => /\byield\s+from\b/.test(l) || (/\byield\b/.test(l) && !/yield_/.test(l)),
      ),
  },
];

export class PythonPatternsModule implements CodeAnalyzer {
  readonly id = 'python_patterns';
  readonly name = 'Python Patterns';
  readonly category = 'python_patterns' as const;
  readonly applicableLanguages = ['Python'];

  async analyze(ctx: AnalysisContext): Promise<ModuleResult> {
    let hasBilateral = false;

    for (const diff of ctx.diffs) {
      if (!diff.patch || diff.status === 'removed') continue;
      if (diff.language !== 'Python') continue;

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
        if (pattern.detect(addedLines) && pattern.detect(removedLines)) {
          hasBilateral = true;
        }
      }
    }

    return hasBilateral ? { kind: 'delta_hit' as const, topic: this.id, strength: 2 as const } : null;
  }
}
