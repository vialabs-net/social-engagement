import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';

interface PatternSignature {
  name: string;
  principle: string;
  // Patterns in added lines that suggest this design pattern
  addedPatterns: RegExp[];
  // Minimum number of addedPatterns that must match
  minMatches: number;
  interestScore: number;
  explanation: string;
}

const PATTERNS: PatternSignature[] = [
  {
    name: 'Strategy',
    principle: 'Open/Closed principle, polymorphism',
    addedPatterns: [
      /interface\s+\w*(Strategy|Handler|Processor|Executor)\w*/i,
      /implements\s+\w*(Strategy|Handler|Processor|Executor)\w*/i,
      /\bstrategy\b/i,
      /new Map\s*\(\s*\[[\s\S]*\]\s*\)/,
      /\.get\(type\)|\.get\(kind\)|\.get\(provider\)/i,
    ],
    minMatches: 2,
    interestScore: 9,
    explanation: 'The Strategy pattern replaces conditional branching (if/switch on type) with a lookup of pluggable implementations. Adding a new variant means adding a new class, not modifying the routing logic.',
  },
  {
    name: 'Repository',
    principle: 'Separation of concerns, data access abstraction',
    addedPatterns: [
      /interface\s+I?\w*Repository\w*/i,
      /class\s+\w*Repository\w*/i,
      /\bfindBy\w+|findAll|save\(|delete\(|update\(/i,
      /\brepository\b/i,
    ],
    minMatches: 2,
    interestScore: 8,
    explanation: 'The Repository pattern centralizes all data access for an entity in one place. It decouples business logic from storage details and makes the system easier to test (inject a mock repository).',
  },
  {
    name: 'Observer',
    principle: 'Loose coupling, event-driven design',
    addedPatterns: [
      /\.addEventListener|\.on\(/,
      /EventEmitter|Subject|Observable/i,
      /\.subscribe\(|\.publish\(|\.emit\(/i,
      /interface\s+\w*(Observer|Listener|Handler)\w*/i,
    ],
    minMatches: 2,
    interestScore: 8,
    explanation: 'The Observer pattern decouples event producers from consumers. Publishers don\'t need to know who\'s listening — they emit events and observers react independently.',
  },
  {
    name: 'Factory',
    principle: 'Creational pattern, encapsulated object creation',
    addedPatterns: [
      /\bcreate\w*\s*\(|factory\b/i,
      /class\s+\w*Factory\w*/i,
      /static\s+create\s*\(/,
      /interface\s+I?\w*Factory\w*/i,
    ],
    minMatches: 2,
    interestScore: 7,
    explanation: 'The Factory pattern encapsulates object creation logic. Callers get the right type without knowing how to construct it — the factory owns that knowledge.',
  },
  {
    name: 'Adapter',
    principle: 'Interface compatibility, wrapping external APIs',
    addedPatterns: [
      /class\s+\w*Adapter\w*/i,
      /\badapter\b/i,
      /wrapper|wraps/i,
      /implements\s+\w+\s*\{[\s\S]*?\/\/ adapts/i,
    ],
    minMatches: 2,
    interestScore: 7,
    explanation: 'The Adapter pattern wraps an incompatible interface to make it compatible with what the rest of the system expects. Useful when integrating external libraries without coupling to their API.',
  },
];

export class DesignPatternsModule implements CodeAnalyzer {
  readonly id = 'design_patterns';
  readonly name = 'Design Patterns Detector';
  readonly category = 'design_patterns' as const;

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    const addedLines = extractAddedLines(ctx.diffs);
    if (addedLines.length === 0) return null;

    const addedText = addedLines.join('\n');

    for (const pattern of PATTERNS) {
      const matches = pattern.addedPatterns.filter(p => p.test(addedText));
      if (matches.length >= pattern.minMatches) {
        return {
          moduleId: this.id,
          aspect: `${pattern.name} pattern`,
          finding: `Implemented ${pattern.name} pattern — ${pattern.principle}`,
          technicalDetail: `${pattern.name} pattern, ${pattern.principle}. Detected via structural signatures in the diff.`,
          plainLanguage: pattern.explanation,
          interestScore: pattern.interestScore,
        };
      }
    }

    return null;
  }
}

function extractAddedLines(diffs: { patch: string }[]): string[] {
  const lines: string[] = [];
  for (const diff of diffs) {
    for (const line of diff.patch.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        lines.push(line.slice(1));
      }
    }
  }
  return lines;
}
