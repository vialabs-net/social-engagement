import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';

interface TypePattern {
  name: string;
  pattern: RegExp;
  score: number;
  technicalDetail: string;
  explanation: string;
}

const TYPE_PATTERNS: TypePattern[] = [
  {
    name: 'discriminated union',
    pattern: /type\s+\w+\s*=[\s\S]*?\|\s*\{[\s\S]*?kind\s*:|type\s+\w+\s*=[\s\S]*?\|\s*\{[\s\S]*?type\s*:/,
    score: 9,
    technicalDetail: 'TypeScript discriminated unions, exhaustive checking with never type, type narrowing',
    explanation: 'Discriminated unions let the TypeScript compiler know exactly which fields are available in each state. Access a field from the wrong state and the code won\'t compile — the bug is caught before runtime.',
  },
  {
    name: 'branded type',
    pattern: /&\s*\{\s*readonly\s+\w+Brand|\s+__brand\s*:/,
    score: 8,
    technicalDetail: 'TypeScript branded types, nominal typing in a structural type system',
    explanation: 'Branded types prevent mixing up values that have the same shape but different semantics (e.g., UserId vs AccountId, both strings). The compiler rejects invalid assignments at the type level.',
  },
  {
    name: 'generic constraint',
    pattern: /<\w+\s+extends\s+\w+>|<T extends keyof|<K extends string/,
    score: 7,
    technicalDetail: 'TypeScript generics with constraints, type-safe reusable code',
    explanation: 'Generic constraints make reusable code type-safe without losing type information. The function works for any type that satisfies the constraint — and the compiler enforces that constraint at every call site.',
  },
  {
    name: 'exhaustive never check',
    pattern: /:\s*never\b[\s\S]{0,100}throw|assertNever|case\s+\w+\s*:\s*[\s\S]{0,50}never/,
    score: 8,
    technicalDetail: 'TypeScript never type, exhaustive switch/union handling',
    explanation: 'An exhaustive check with `never` means the compiler will refuse to compile if a new union member is added without handling it. The type system enforces completeness — you cannot forget a case.',
  },
  {
    name: 'utility type',
    pattern: /\b(Partial|Required|Readonly|Pick|Omit|Record|Exclude|Extract|NonNullable|ReturnType|Parameters|InstanceType)<\w/,
    score: 6,
    technicalDetail: 'TypeScript utility types — derived types without duplication',
    explanation: 'Utility types derive new types from existing ones without repeating definitions. If the source type changes, all derived types update automatically — no manual sync required.',
  },
  {
    name: 'type guard',
    pattern: /\w+\s+is\s+\w+|\binstanceof\b[\s\S]{0,30}return true/,
    score: 6,
    technicalDetail: 'TypeScript type guards, runtime type narrowing with compile-time awareness',
    explanation: 'Type guards let you narrow a type at runtime while keeping the compiler informed. After the guard, TypeScript knows exactly which type you\'re working with.',
  },
];

export class TypeSystemModule implements CodeAnalyzer {
  readonly id = 'type_system';
  readonly name = 'Type System Analyzer';
  readonly category = 'type_system' as const;
  readonly applicableLanguages = ['TypeScript'];

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    if (!ctx.languages.includes('TypeScript')) return null;

    const tsDiffs = ctx.diffs.filter(d => d.language === 'TypeScript');
    const addedText = tsDiffs
      .flatMap(d =>
        d.patch.split('\n')
          .filter(l => l.startsWith('+') && !l.startsWith('+++'))
          .map(l => l.slice(1))
      )
      .join('\n');

    if (!addedText) return null;

    const primaryFile = tsDiffs[0]?.filename ?? 'unknown';

    for (const tp of TYPE_PATTERNS) {
      if (tp.pattern.test(addedText)) {
        return {
          moduleId: this.id,
          aspect: tp.name,
          finding: `Used TypeScript ${tp.name} — type system encodes correctness constraints`,
          technicalDetail: tp.technicalDetail,
          plainLanguage: tp.explanation,
          interestScore: tp.score,
          contextHint: `${primaryFile} in ${ctx.repo}`,
        };
      }
    }

    return null;
  }
}
