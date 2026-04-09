# Content Generator v2 — Modular Analysis Architecture

This document describes the modular code analysis pipeline that sits between commit detection and AI post generation.

---

## The Core Idea

Code is words in another language. This system translates code into social media posts.

But translating code is not one skill — it's many. Reading a design pattern requires different
expertise than evaluating cyclomatic complexity, which requires different expertise than
explaining a Redis integration.

So the system uses **specialized modules**, each an expert in one aspect of code quality.
Each module reads the same diff through its own lens and outputs a structured finding.
The AI post generator receives the top findings and translates them into a post in Liliana's voice.

The AI does **not** analyze code. The modules do. The AI writes.

---

## Module Interface

```typescript
// src/analysis/types.ts

export interface CodeAnalyzer {
  readonly id: string;
  readonly name: string;
  readonly category: AnalysisCategory;
  readonly applicableLanguages?: string[];  // undefined = works on all languages

  analyze(ctx: AnalysisContext): Promise<Finding | null>;
  // Returns null if nothing interesting found — this is normal and expected
}

export interface AnalysisContext {
  commit: EnrichedCommit;
  parsedDiff: FileDiff[];      // structured diff (not raw patch string)
  detectedLanguages: string[]; // ['typescript', 'python', etc.]
}

export interface FileDiff {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  addedLines: string[];    // lines starting with + (without the + prefix)
  removedLines: string[];  // lines starting with - (without the - prefix)
  patch: string;           // raw unified diff for this file
}

export interface Finding {
  analyzerId: string;
  analyzerName: string;
  category: AnalysisCategory;
  interestScore: number;         // 1–10: pipeline sorts by this
  headline: string;              // "Reduced cyclomatic complexity from 12 to 4"
  technicalDetail: string;       // keywords for Claude's context
  teachingAngle: string;         // what other developers learn from this
  evidence?: {
    before?: string;             // code snippet (before state)
    after?: string;              // code snippet (after state)
    metric?: {
      name: string;
      before: string | number;
      after: string | number;
    };
  };
}

export type AnalysisCategory =
  | 'complexity'
  | 'design_pattern'
  | 'clean_code'
  | 'type_system'
  | 'integration'
  | 'testing'
  | 'ai_assisted'
  | 'performance'    // future
  | 'security'       // future
  | 'architecture';  // future
```

---

## Module Registry — The Extension Point

```typescript
// src/analysis/modules/index.ts
// THIS IS THE ONLY FILE THAT CHANGES WHEN ADDING A MODULE

import { ComplexityModule } from './complexity';
import { DesignPatternsModule } from './design-patterns';
import { CleanCodeModule } from './clean-code';
import { TypeSystemModule } from './type-system';
import { IntegrationModule } from './integration';
import { TestingModule } from './testing';
import { AiAssistedModule } from './ai-assisted';

export const MODULE_REGISTRY: CodeAnalyzer[] = [
  new ComplexityModule(),
  new DesignPatternsModule(),
  new CleanCodeModule(),
  new TypeSystemModule(),    // TypeScript/typed languages only
  new IntegrationModule(),
  new TestingModule(),
  new AiAssistedModule(),
];
```

To add a new module: create the file, implement `CodeAnalyzer`, add one line here.
No other code changes.

---

## Pipeline

```typescript
// src/analysis/pipeline.ts

export async function runAnalysis(
  ctx: AnalysisContext,
  topN = 3
): Promise<Finding[]> {
  // Filter modules applicable to detected languages
  const applicable = MODULE_REGISTRY.filter(
    m => !m.applicableLanguages ||
      m.applicableLanguages.some(l => ctx.detectedLanguages.includes(l))
  );

  // Run ALL applicable modules in parallel
  // Promise.allSettled: one module crashing does NOT crash the pipeline
  const results = await Promise.allSettled(
    applicable.map(m => m.analyze(ctx))
  );

  const findings = results
    .filter((r): r is PromiseFulfilledResult<Finding> =>
      r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value)
    .sort((a, b) => b.interestScore - a.interestScore);

  logger.info('analysis_complete', {
    modulesRun: applicable.length,
    findingsFound: findings.length,
    topScore: findings[0]?.interestScore,
    topFinding: findings[0]?.headline,
  });

  // If no findings → caller skips Claude call (saves tokens)
  return findings.slice(0, topN);
}
```

**Key decisions:**
- `Promise.allSettled` instead of `Promise.all` → module isolation
- Modules run in parallel → typically < 5ms total (pure string matching, no I/O)
- Returns empty array if no findings → zero Claude API calls on boring commits
- `topN = 3` is configurable but 3 is the sweet spot for prompt context budget

---

## MVP Modules (7)

### 1. ComplexityModule

**What it detects**: Significant reduction in decision branches and function splitting.

**Heuristic**: Count decision keywords (`if`, `else if`, `switch case`, `&&`, `||`, `?:`, `??`) in added vs. removed lines. If the commit removes more branches than it adds (delta ≥ 3), it's interesting.

**Interest score**: 4 + floor(delta / 2), max 10.

**Example finding**:
```json
{
  "headline": "Reduced decision complexity by ~8 branches, splitting into 3 focused functions",
  "technicalDetail": "Cyclomatic complexity reduction, single responsibility, extract method refactoring",
  "teachingAngle": "High cyclomatic complexity is the most reliable predictor of bugs. Each branch you remove is a test case you never have to write.",
  "evidence": {
    "metric": { "name": "Decision branches", "before": 12, "after": 4 }
  },
  "interestScore": 8
}
```

---

### 2. DesignPatternsModule

**What it detects**: Implementation of known design patterns via structural keyword signatures.

**Patterns recognized (MVP)**:

| Pattern | Signals |
|---|---|
| Strategy | `interface *Strategy|Handler|Processor`, `processors[`, `handlers[` |
| Repository | `Repository`, `findById`, `findAll`, `save(`, `delete(` (2+ signals) |
| Observer | `.on(`, `.emit(`, `EventEmitter`, `subscribe`, `publish` (2+ signals) |
| Factory | `factory`, `.create(`, `createFrom`, `build(` (2+ signals) |
| Adapter | `Adapter`, `wrap(`, `transform(`, adapter naming conventions |

**Interest score**: 9 (design patterns are almost always post-worthy).

**Example finding**:
```json
{
  "headline": "Implemented Strategy pattern for 3 payment processors — Stripe, MercadoPago, manual transfer now share one interface",
  "technicalDetail": "Strategy pattern, polymorphism, Open/Closed principle",
  "teachingAngle": "When you're adding a 4th if-else to a type check, that's Strategy pattern calling your name.",
  "interestScore": 9
}
```

---

### 3. CleanCodeModule

**What it detects**: Significant line reduction, DRY extractions, KISS simplifications.

**Signals**:
- Net line reduction ≥ 30% (files changed by this commit)
- New small functions appearing (added function declarations < 10 lines)
- Removal of duplicated code blocks (same pattern appearing multiple times in removed lines)

**Interest score**: 6 + bonus for evidence quality, max 9.

**Example finding**:
```json
{
  "headline": "Applied KISS — replaced 40-line nested conditional with 12-line lookup table",
  "technicalDetail": "KISS principle, lookup table pattern, reduced cognitive complexity",
  "teachingAngle": "Lookup tables are underrated. When your if-else has more than 4 cases, ask yourself if a dictionary would be cleaner.",
  "evidence": {
    "metric": { "name": "Lines", "before": 40, "after": 12 }
  },
  "interestScore": 8
}
```

---

### 4. TypeSystemModule

**Applicable languages**: TypeScript only (`applicableLanguages: ['typescript']`)

**What it detects**: Advanced TypeScript type system usage that improves correctness or DX.

**Signals**:

| Signal | Pattern |
|---|---|
| Discriminated union | Added `type` with `\|` and literal types |
| Generic constraints | `<T extends`, `<T, K extends keyof T>` |
| Branded types | `& { _brand:`, `declare const _brand` |
| Type guard | `is` return type, `asserts` |
| `never` for exhaustive check | `satisfies never`, `never` in switch default |
| Removing `any` | `- : any` followed by `+ :` with real type |

**Interest score**: 7–9 depending on signal complexity.

**Example finding**:
```json
{
  "headline": "Discriminated unions model 3 transaction states — compiler now catches unhandled states at build time",
  "technicalDetail": "TypeScript discriminated unions, exhaustive pattern matching, never type",
  "teachingAngle": "If your error handling is runtime guessing, discriminated unions are the type-level fix. The compiler becomes your QA team.",
  "evidence": {
    "after": "type TransactionState = { status: 'pending' } | { status: 'success'; id: string } | { status: 'failed'; error: Error }"
  },
  "interestScore": 8
}
```

---

### 5. IntegrationModule

**What it detects**: New connections to external services, databases, APIs, caches.

**Recognized services**:

| Service | Package patterns |
|---|---|
| Redis | `ioredis`, `redis` |
| Stripe | `stripe` |
| Anthropic | `@anthropic-ai/sdk` |
| OpenAI | `openai` |
| Prisma | `@prisma/client` |
| Supabase | `@supabase/supabase-js` |
| MongoDB | `mongodb`, `mongoose` |
| Twilio | `twilio` |
| SendGrid | `@sendgrid/mail` |
| MercadoPago | `mercadopago` |

**Also extracts**: TTL values, timeout config, retry settings from the added lines.

**Interest score**: 8 (new integrations are consistently engaging content).

---

### 6. TestingModule

**What it detects**: New tests, parametrized tests, edge case coverage.

**Signals**:
- New test files (`*.test.ts`, `*.spec.ts`, `*.test.py`, etc.)
- New `it(`, `test(`, `describe(` blocks
- Parametrized tests: `test.each`, `it.each`, `@pytest.mark.parametrize`
- Edge case keywords in test names: `edge`, `timeout`, `overflow`, `empty`, `null`, `undefined`, `error`, `boundary`, `invalid`
- Count new test blocks added

**Interest score**: 6–8 depending on parametrization and edge case signals.

**Example finding**:
```json
{
  "headline": "Added 5 parametrized tests covering currency rounding edge cases, including half-cent scenarios",
  "technicalDetail": "Parametrized tests, financial precision, edge case coverage",
  "teachingAngle": "Financial rounding bugs have killed companies. Test.each with boundary values is how you sleep at night.",
  "interestScore": 8
}
```

---

### 7. AiAssistedModule

**What it detects**: Evidence of AI-assisted development in the commit.

**Signals**:
- Commit message contains: `claude`, `gpt`, `ai`, `copilot`, `generated`, `assisted`
- New files: `.cursorrules`, `AGENTS.md`, prompt files
- Code patterns typical of AI output (very long type signatures, comprehensive JSDoc)
- Import of AI SDKs (Anthropic, OpenAI)

**Interest score**: 7 (AI collaboration is on-brand for Liliana's content).

**Example finding**:
```json
{
  "headline": "Used Claude to scaffold the Redis connection boilerplate, then customized TTL strategy and fallback logic manually",
  "technicalDetail": "AI-assisted development, human-AI collaboration, prompt engineering",
  "teachingAngle": "AI is best at generating the boring 80%. Your judgment is the interesting 20% — what you changed and why.",
  "interestScore": 7
}
```

---

## How Findings Go to Claude

After the pipeline runs, the top N findings are serialized into the prompt as structured text — not JSON, but readable natural language that Claude can easily cite in the post:

```
[PRE-ANALYZED FINDINGS — sorted by interest score, highest first]
These findings were detected by specialized analysis modules. Feature the most compelling one.

FINDING 1 [category: design_pattern | score: 9/10]
Headline: "Implemented Strategy pattern for 3 payment processors"
Technical context: Strategy pattern, polymorphism, Open/Closed principle
Teaching angle: When you're adding a 4th if-else to a type check, that's Strategy pattern calling.

FINDING 2 [category: type_system | score: 8/10]
Headline: "Discriminated unions model 3 transaction states — compiler enforces exhaustive handling"
Technical context: TypeScript discriminated unions, exhaustive checking, never type
Evidence after: type TransactionState = { status: 'pending' } | ...
Teaching angle: If your error handling is runtime guessing, discriminated unions are the fix.

FINDING 3 [category: testing | score: 7/10]
...
```

Claude receives this pre-analyzed context and focuses entirely on voice, storytelling, and teaching — not code analysis.

---

## Adding a New Module — The Complete Guide

1. Create `src/analysis/modules/your-module.ts`:

```typescript
import type { CodeAnalyzer, AnalysisContext, Finding, AnalysisCategory } from '../types';

export class YourModule implements CodeAnalyzer {
  readonly id = 'your_module';
  readonly name = 'Your Module Name';
  readonly category: AnalysisCategory = 'performance';  // pick the right category

  // Optional: restrict to specific languages
  // readonly applicableLanguages = ['typescript', 'javascript'];

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    const addedLines = ctx.parsedDiff.flatMap(f => f.addedLines);

    // Your detection logic here
    // Return null if nothing interesting
    const isInteresting = addedLines.some(line => /* your signal */);
    if (!isInteresting) return null;

    return {
      analyzerId: this.id,
      analyzerName: this.name,
      category: this.category,
      interestScore: 7,  // 1-10
      headline: 'What was done, specifically',
      technicalDetail: 'Keywords and patterns for Claude context',
      teachingAngle: 'What other developers learn from this',
      evidence: {  // optional but adds interest
        before: 'code before',
        after: 'code after',
      },
    };
  }
}
```

2. Add to `src/analysis/modules/index.ts`:

```typescript
import { YourModule } from './your-module';  // add this import

export const MODULE_REGISTRY: CodeAnalyzer[] = [
  // ... existing modules ...
  new YourModule(),  // add this line
];
```

3. Done. The pipeline picks it up automatically.

---

## Planned Future Modules (Post-MVP)

| Module | Detects |
|---|---|
| PerformanceModule | O(n²) → O(n) improvements, memoization, lazy loading, batching |
| SecurityModule | Auth patterns, input validation, secrets management improvements |
| ArchitectureModule | Layer boundary enforcement, dependency direction, circular import removal |
| DocumentationModule | JSDoc additions, README changes, API docs |
| DevOpsModule | CI/CD changes, Docker, IaC, monitoring additions |
| DatabaseModule | Migration additions, index changes, query optimization |

Each future module: implement `CodeAnalyzer`, add to `MODULE_REGISTRY`. One file per module.
