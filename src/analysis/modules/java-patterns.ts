import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';
import { extractRemovedLines, extractFirstHunkSnippet } from '../diff-parser.js';

interface JavaPattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  detect(addedLines: readonly string[], fullPatch: string): boolean;
}

const PATTERNS: readonly JavaPattern[] = [
  {
    name: 'Java record',
    score: 8,
    technicalDetail: 'Java record (JEP 395, Java 16+) — a transparent, immutable data carrier that auto-generates constructor, accessors, equals, hashCode, and toString.',
    explanation: 'A record replaces a 40-line data class with a single line. It is immutable by default, generates all boilerplate automatically, and makes the intent crystal clear.',
    detect: (lines) => lines.some((l) => /\brecord\s+\w+\s*\(/.test(l)),
  },
  {
    name: 'sealed class / pattern matching',
    score: 8,
    technicalDetail: 'Sealed classes (JEP 409) and pattern matching for switch (JEP 441) — exhaustive type hierarchies checked at compile time, enabling safe instanceof patterns.',
    explanation: 'Sealed classes declare exactly which subtypes exist. Combined with pattern matching, the compiler enforces that all cases are handled — no runtime surprises.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\bsealed\s+(class|interface)\b/.test(l) ||
          /\bpermits\b/.test(l) ||
          /\binstanceof\s+\w+\s+\w+/.test(l),
      ),
  },
  {
    name: 'virtual threads',
    score: 9,
    technicalDetail: 'Virtual threads (JEP 444, Java 21) — lightweight threads managed by the JVM, enabling millions of concurrent threads without the overhead of OS threads.',
    explanation: 'Virtual threads run on carrier threads managed by the JVM. A single machine can handle a million virtual threads — the same concurrency as async code, with blocking I/O syntax.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\bThread\.ofVirtual\(\)/.test(l) ||
          /\bExecutors\.newVirtualThreadPerTaskExecutor\(\)/.test(l) ||
          /\bThread\.startVirtualThread\b/.test(l),
      ),
  },
  {
    name: 'Stream API',
    score: 7,
    technicalDetail: 'Java Stream API — functional-style pipeline operations (filter, map, reduce, collect) on collections, with optional parallel execution.',
    explanation: 'Stream pipelines process collections functionally. The same code runs sequentially or in parallel with .parallelStream() — and the intent is clear without loops.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\.(stream|parallelStream)\s*\(\s*\)/.test(l) ||
          (/\.collect\s*\(/.test(l) && /\bCollectors\./.test(l)),
      ),
  },
  {
    name: 'Quarkus reactive (Mutiny)',
    score: 9,
    technicalDetail: 'Quarkus Mutiny reactive types (Uni<T>, Multi<T>) — non-blocking reactive streams integrated with the Vert.x event loop, zero threads blocked on I/O.',
    explanation: 'Uni handles a single async result; Multi handles a stream of them. The event loop thread never blocks — Quarkus handles thousands of requests on a handful of threads.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\bUni\s*</.test(l) ||
          /\bMulti\s*</.test(l) ||
          /\bio\.smallrye\.mutiny\b/.test(l) ||
          /\bUni\.createFrom\b/.test(l),
      ),
  },
  {
    name: 'Quarkus CDI / injection',
    score: 7,
    technicalDetail: 'Quarkus CDI — @ApplicationScoped, @RequestScoped, @Inject, @ConfigProperty for dependency injection and configuration binding at compile time (ArC).',
    explanation: 'Quarkus CDI is resolved at build time, not runtime. The container wiring happens during compilation — startup is instant and no classpath scanning at runtime.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /^\s*@ApplicationScoped\b/.test(l) ||
          /^\s*@RequestScoped\b/.test(l) ||
          /^\s*@Inject\b/.test(l) ||
          /^\s*@ConfigProperty\b/.test(l) ||
          /^\s*@QuarkusTest\b/.test(l),
      ),
  },
  {
    name: 'Panache ORM',
    score: 8,
    technicalDetail: 'Quarkus Panache — active record or repository pattern over Hibernate, reducing boilerplate with built-in find, persist, and listAll methods.',
    explanation: 'Panache lets an entity extend PanacheEntity and immediately gains find, persist, count, and listAll. The repository pattern is one class, not three layers of interfaces.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\bPanacheEntity\b/.test(l) ||
          /\bPanacheRepository\b/.test(l) ||
          /^\s*@Entity\b/.test(l) ||
          /\bPanacheEntityBase\b/.test(l),
      ),
  },
  {
    name: 'Optional chaining',
    score: 6,
    technicalDetail: 'Java Optional — a container type for nullable values that forces explicit handling of the absent case, eliminating null checks and NullPointerExceptions.',
    explanation: 'Optional makes the possibility of a missing value explicit in the type system. The caller cannot ignore it — they must handle both the present and absent cases.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\bOptional\.(of|ofNullable|empty)\s*\(/.test(l) ||
          /\b\.orElseThrow\s*\(/.test(l) ||
          /\b\.orElseGet\s*\(/.test(l),
      ),
  },
];

export class JavaPatternsModule implements CodeAnalyzer {
  readonly id = 'java_patterns';
  readonly name = 'Java / Quarkus Patterns';
  readonly category = 'java_patterns' as const;
  readonly applicableLanguages = ['Java', 'Kotlin'];

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    for (const diff of ctx.diffs) {
      if (!diff.patch || diff.status === 'removed') continue;
      if (diff.language !== 'Java' && diff.language !== 'Kotlin') continue;

      const addedLines = diff.patch
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1));

      if (addedLines.length === 0) continue;

      const removedText = extractRemovedLines(diff.patch);
      const removedLines = removedText.split('\n').filter(Boolean);

      for (const pattern of PATTERNS) {
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
      }
    }

    return null;
  }
}
