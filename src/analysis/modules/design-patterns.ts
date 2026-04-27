import type { CodeAnalyzer, AnalysisContext, Finding, ModuleResult } from '../types.js';
import { extractAddedLines, extractRemovedLines, extractFirstHunkSnippet } from '../diff-parser.js';

interface PatternSignature {
  name: string;
  principle: string;
  // Patterns in added lines that suggest this design pattern
  addedPatterns: RegExp[];
  // Minimum number of addedPatterns that must match
  minMatches: number;
  interestScore: number;
  explanation: string;
  // Indices into addedPatterns that are structural (class/interface declarations).
  // When ALL product diffs are new files, at least one of these must match;
  // prose-only matches (method names, keywords in comments) are not sufficient.
  structuralIndices: readonly number[];
}

const PATTERNS: PatternSignature[] = [
  {
    name: 'Strategy',
    principle: 'Open/Closed principle, polymorphism',
    addedPatterns: [
      /interface\s+\w*(Strategy|Handler|Processor|Executor)\w*/i,   // 0 structural
      /implements\s+\w*(Strategy|Handler|Processor|Executor)\w*/i,  // 1 structural
      /\bstrategy\b/i,                                              // 2 prose
      /new Map\s*\(\s*\[[\s\S]*\]\s*\)/,                           // 3 structural
      /\.get\(type\)|\.get\(kind\)|\.get\(provider\)/i,            // 4 structural
    ],
    minMatches: 2,
    interestScore: 9,
    structuralIndices: [0, 1, 3, 4],
    explanation: 'The Strategy pattern replaces conditional branching (if/switch on type) with a lookup of pluggable implementations. Adding a new variant means adding a new class, not modifying the routing logic.',
  },
  {
    name: 'Repository',
    principle: 'Separation of concerns, data access abstraction',
    addedPatterns: [
      /interface\s+I?\w*Repository\w*/i,        // 0 structural
      /class\s+\w*Repository\w*/i,              // 1 structural
      /\bfindBy\w+|findAll|save\(|delete\(|update\(/i, // 2 prose (method names)
      /\brepository\b/i,                        // 3 prose (keyword)
    ],
    minMatches: 2,
    interestScore: 8,
    structuralIndices: [0, 1],
    explanation: 'The Repository pattern centralizes all data access for an entity in one place. It decouples business logic from storage details and makes the system easier to test (inject a mock repository).',
  },
  {
    name: 'Observer',
    principle: 'Loose coupling, event-driven design',
    addedPatterns: [
      /\.addEventListener|\.on\(/,              // 0 structural
      /EventEmitter|Subject|Observable/i,       // 1 structural
      /\.subscribe\(|\.publish\(|\.emit\(/i,   // 2 structural
      /interface\s+\w*(Observer|Listener|Handler)\w*/i, // 3 structural
    ],
    minMatches: 2,
    interestScore: 8,
    structuralIndices: [0, 1, 2, 3],
    explanation: 'The Observer pattern decouples event producers from consumers. Publishers don\'t need to know who\'s listening — they emit events and observers react independently.',
  },
  {
    name: 'Factory',
    principle: 'Creational pattern, encapsulated object creation',
    addedPatterns: [
      /\bcreate\w*\s*\(|factory\b/i,           // 0 prose
      /class\s+\w*Factory\w*/i,                // 1 structural
      /static\s+create\s*\(/,                  // 2 structural
      /interface\s+I?\w*Factory\w*/i,          // 3 structural
    ],
    minMatches: 2,
    interestScore: 7,
    structuralIndices: [1, 2, 3],
    explanation: 'The Factory pattern encapsulates object creation logic. Callers get the right type without knowing how to construct it — the factory owns that knowledge.',
  },
  {
    name: 'Adapter',
    principle: 'Interface compatibility, wrapping external APIs',
    addedPatterns: [
      /class\s+\w*Adapter\w*/i,               // 0 structural
      /\badapter\b/i,                          // 1 prose
      /wrapper|wraps/i,                        // 2 prose
      /implements\s+\w+\s*\{[\s\S]*?\/\/ adapts/i, // 3 structural
    ],
    minMatches: 2,
    interestScore: 7,
    structuralIndices: [0, 3],
    explanation: 'The Adapter pattern wraps an incompatible interface to make it compatible with what the rest of the system expects. Useful when integrating external libraries without coupling to their API.',
  },
];

export class DesignPatternsModule implements CodeAnalyzer {
  readonly id = 'design_patterns';
  readonly name = 'Design Patterns Detector';
  readonly category = 'design_patterns' as const;

  // Paths that indicate auxiliary/migration/tooling files, not product architecture.
  private readonly AUXILIARY_PATH_RE = /\b(tools|scripts|migrations?|__tests__|\.github)\b/i;

  async analyze(ctx: AnalysisContext): Promise<ModuleResult> {
    // Exclude auxiliary files from pattern detection; they are not product architecture.
    const productDiffs = ctx.diffs.filter(
      (d) => !this.AUXILIARY_PATH_RE.test(d.filename),
    );

    const addedText = productDiffs
      .map((d) => extractAddedLines(d.patch, d.language))
      .join('\n');
    if (!addedText) return null;

    const removedText = productDiffs
      .map((d) => extractRemovedLines(d.patch, d.language))
      .join('\n');
    const primaryFile = productDiffs[0]?.filename ?? ctx.diffs[0]?.filename ?? 'unknown';

    // When every product diff is a new file, prose-only matches are unreliable
    // (method names, keywords in comments saturate the added text). Require at
    // least one structural signal (class/interface declaration) before firing.
    const allNew = productDiffs.length > 0 && productDiffs.every((d) => d.status === 'added');

    let hasBilateral = false;

    for (const pattern of PATTERNS) {
      const addedMatches = pattern.addedPatterns.filter(p => p.test(addedText));
      const removedMatches = pattern.addedPatterns.filter(p => p.test(removedText));
      if (addedMatches.length < pattern.minMatches || removedMatches.length >= pattern.minMatches) {
        if (addedMatches.length >= pattern.minMatches && removedMatches.length >= pattern.minMatches) {
          hasBilateral = true;
        }
        continue;
      }
      if (allNew) {
        const hasStructural = pattern.structuralIndices.some(
          (i) => pattern.addedPatterns[i]?.test(addedText),
        );
        if (!hasStructural) continue;
      }

      return {
        moduleId: this.id,
        aspect: `${pattern.name} pattern`,
        finding: `Implemented ${pattern.name} pattern — ${pattern.principle}`,
        technicalDetail: `${pattern.name} pattern, ${pattern.principle}. Detected via structural signatures in the diff.`,
        plainLanguage: pattern.explanation,
        interestScore: pattern.interestScore,
        contextHint: `${primaryFile} in ${ctx.repo}`,
        evidence: {
          before: removedText.slice(0, 300) || undefined,
          after: extractFirstHunkSnippet(ctx.diffs[0]?.patch ?? '') || undefined,
        },
      };
    }

    return hasBilateral ? { kind: 'delta_hit' as const, topic: this.id, strength: 2 as const } : null;
  }
}
