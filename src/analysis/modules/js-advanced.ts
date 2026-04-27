import type { CodeAnalyzer, AnalysisContext, Finding, ModuleResult } from '../types.js';
import { extractRemovedLines, extractFirstHunkSnippet } from '../diff-parser.js';

interface JsAdvancedPattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  detect(addedLines: readonly string[]): boolean;
}

const PATTERNS: readonly JsAdvancedPattern[] = [
  {
    name: 'Proxy / Reflect metaprogramming',
    score: 9,
    technicalDetail: 'Proxy/Reflect — intercepts fundamental object operations (get, set, has, delete) to add custom behavior without modifying the target object.',
    explanation: 'A Proxy wraps an object and intercepts every operation on it. You can validate property assignments, log access, implement lazy loading, or build reactive systems — all transparently to the caller.',
    detect: (lines) => lines.some((l) =>
      /\bnew\s+Proxy\s*\(/.test(l) ||
      /\bReflect\.(get|set|has|deleteProperty|apply|construct|ownKeys)\s*\(/.test(l),
    ),
  },
  {
    name: 'WeakRef / FinalizationRegistry',
    score: 9,
    technicalDetail: 'WeakRef/FinalizationRegistry — weak references that do not prevent garbage collection, with optional cleanup callbacks when objects are collected.',
    explanation: 'WeakRef holds a reference to an object without preventing it from being garbage collected. FinalizationRegistry runs cleanup code when the object is collected. Together they solve cache invalidation and resource cleanup without memory leaks.',
    detect: (lines) => lines.some((l) =>
      /\bnew\s+WeakRef\s*\(/.test(l) ||
      /\bnew\s+FinalizationRegistry\s*\(/.test(l),
    ),
  },
  {
    name: 'iterator / generator protocol',
    score: 8,
    technicalDetail: 'Iterator protocol — custom iteration with generators (function*), Symbol.iterator, or async iteration (for await...of) for lazy, on-demand data processing.',
    explanation: 'Generators produce values one at a time instead of building an entire array upfront. A generator that yields database rows processes millions of records with constant memory — each row is fetched only when requested.',
    detect: (lines) => lines.some((l) =>
      /\bfunction\s*\*/.test(l) ||
      /\basync\s+function\s*\*/.test(l) ||
      /\bSymbol\.iterator\b/.test(l) ||
      /\bSymbol\.asyncIterator\b/.test(l) ||
      /\bfor\s+await\s*\(/.test(l),
    ),
  },
];

export class JsAdvancedModule implements CodeAnalyzer {
  readonly id = 'js_advanced';
  readonly name = 'Advanced JavaScript';
  readonly category = 'js_advanced' as const;

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
        if (pattern.detect(addedLines) && !pattern.detect(removedLines)) {
          return {
            moduleId: this.id,
            aspect: pattern.name,
            finding: `${pattern.name} in ${diff.filename}`,
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
