import type { CodeAnalyzer, AnalysisContext, Finding, ModuleResult } from '../types.js';
import { extractRemovedLines, extractFirstHunkSnippet } from '../diff-parser.js';

interface DxPattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  detect(addedLines: readonly string[], filename: string): boolean;
}

const CONFIG_FILE_REGEX = /(?:config|settings|options|env)\b/i;

const PATTERNS: readonly DxPattern[] = [
  {
    name: 'runtime config override',
    score: 8,
    technicalDetail: 'Runtime config override — a hardcoded operational decision is exposed through an environment variable or runtime input with parsing, validation, and a safe default.',
    explanation: 'Turning a hardcoded limit into a runtime control changes who can steer the system. Operators can tune behavior for one environment or one run without editing code, while the default keeps steady-state behavior predictable.',
    detect: (lines, filename) => {
      if (!/\.(ts|js|mjs|cjs|ya?ml)$/i.test(filename)) return false;
      const joined = lines.join('\n');
      const hasEnvRead = /\bprocess\.env\[['"][A-Z0-9_]+['"]\]/.test(joined);
      const hasRuntimeFallback =
        /\bDEFAULT_[A-Z0-9_]+\b/.test(joined)
        || /\bNumber\.parseInt\b/.test(joined)
        || /\bfallback\b/i.test(joined)
        || /\breturn DEFAULT_[A-Z0-9_]+\b/.test(joined);
      const hasWorkflowOverride =
        /(\.github\/workflows|\.ya?ml$)/i.test(filename)
        && lines.some((line) => /\binputs\s*:/.test(line) || /\$\{\{\s*(inputs|vars)\./.test(line));
      return (hasEnvRead && hasRuntimeFallback) || hasWorkflowOverride;
    },
  },
  {
    name: 'custom error class',
    score: 8,
    technicalDetail: 'Custom error class — domain-specific errors with descriptive names that communicate what went wrong and why.',
    explanation: 'A generic Error("something failed") tells you nothing. A BufferTokenExpiredError tells you exactly what happened, what service failed, and hints at the fix — without reading the stack trace.',
    detect: (lines) => lines.some((l) =>
      /\bclass\s+\w+Error\s+extends\s+(Error|BaseError|CustomError)\b/.test(l),
    ),
  },
  {
    name: 'config schema validation',
    score: 8,
    technicalDetail: 'Config schema validation — validating configuration at startup with a schema to catch misconfiguration before the app starts serving traffic.',
    explanation: 'Validating config at startup catches typos and missing values immediately. Without it, a misspelled key silently becomes undefined and the app crashes at 3am when that code path runs.',
    detect: (lines, filename) => {
      if (!CONFIG_FILE_REGEX.test(filename)) return false;
      return lines.some((l) =>
        /\b(z\.object|z\.string|z\.number|Joi\.object|\.safeParse|\.parse)\s*\(/.test(l),
      );
    },
  },
  {
    name: 'CLI setup',
    score: 7,
    technicalDetail: 'CLI framework — structured command-line interface with help text, options parsing, and usage documentation.',
    explanation: 'A CLI framework turns a script into a tool. Help text, typed options, and validation mean users discover features through --help instead of reading source code.',
    detect: (lines) => lines.some((l) =>
      /\b(program|commander|yargs|meow|cac)\b.*\.(description|option|command|parse)\s*\(/.test(l) ||
      /\bimport\b.*\b(commander|yargs|meow|cac)\b/.test(l),
    ),
  },
  {
    name: 'environment validation',
    score: 7,
    technicalDetail: 'Environment variable validation — verifying required env vars exist at startup and failing fast with clear messages if they are missing.',
    explanation: 'Validating env vars at startup catches deployment mistakes immediately. Without it, a missing API key goes unnoticed until the first request fails — hours or days later.',
    detect: (lines) => lines.some((l) =>
      /\benvalid\b/.test(l) ||
      /\bif\s*\(\s*!process\.env\[.*\]\s*\)\s*(throw|process\.exit)/.test(l) ||
      /\bprocess\.env\b.*\bz\.(string|number|enum)\s*\(/.test(l),
    ),
  },
  {
    name: 'descriptive assertion',
    score: 7,
    technicalDetail: 'Descriptive assertion — runtime invariant checks with human-readable messages that explain what assumption was violated.',
    explanation: 'An assertion with a message turns a cryptic crash into a diagnosis. "Expected userId to be defined after auth middleware" tells the next developer exactly what broke and where to look.',
    detect: (lines) => lines.some((l) =>
      /\b(assert|invariant)\s*\(.*,\s*['"`]/.test(l),
    ),
  },
  {
    name: 'callback to promise conversion',
    score: 7,
    technicalDetail: 'util.promisify — converts Node.js error-first callback APIs into promise-based functions for async/await usage.',
    explanation: 'Legacy Node.js APIs use error-first callbacks that nest deeply. util.promisify wraps them as promises so you can use async/await — flat, readable, and try/catch-friendly.',
    detect: (lines) => lines.some((l) =>
      /\butil\.promisify\s*\(/.test(l) ||
      /\bpromisify\b.*\brequire\s*\(\s*['"]util['"]/.test(l) ||
      /\bimport\b.*\bpromisify\b.*\bfrom\s*['"](?:node:)?util['"]/.test(l),
    ),
  },
];

export class DxModule implements CodeAnalyzer {
  readonly id = 'dx';
  readonly name = 'Developer Experience';
  readonly category = 'dx' as const;

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
        if (pattern.detect(addedLines, diff.filename) && !pattern.detect(removedLines, diff.filename)) {
          const triggerLine = addedLines.find((l) => pattern.detect([l], diff.filename));
          const dxFacts: string[] = [
            `${pattern.name} detected in ${diff.filename} (${diff.status}: +${diff.additions}/-${diff.deletions} lines).`,
          ];
          if (triggerLine) dxFacts.push(`Trigger: "${triggerLine.trim().slice(0, 100)}".`);

          return {
            moduleId: this.id,
            aspect: pattern.name,
            finding: `${pattern.name} in ${diff.filename}`,
            technicalDetail: pattern.technicalDetail,
            plainLanguage: pattern.explanation,
            verifiableFacts: dxFacts,
            interestScore: pattern.score,
            contextHint: `${diff.filename} in ${ctx.repo}`,
            evidence: {
              before: removedText.slice(0, 300) || undefined,
              after: extractFirstHunkSnippet(diff.patch) || undefined,
            },
          };
        }
        if (pattern.detect(addedLines, diff.filename) && pattern.detect(removedLines, diff.filename)) {
          hasBilateral = true;
        }
      }
    }

    return hasBilateral ? { kind: 'delta_hit' as const, topic: this.id, strength: 2 as const } : null;
  }
}
