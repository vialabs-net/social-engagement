import type { AnalysisContext, FileDiff, Finding } from './types.js';

const MAX_RETRIEVAL_TERMS = 18;
const MAX_FILE_SIGNALS = 5;
const MAX_RETRIEVAL_TEXT_LENGTH = 2200;

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'when', 'then',
  'were', 'have', 'will', 'your', 'their', 'there', 'about', 'after', 'before',
  'used', 'using', 'user', 'users', 'code', 'repo', 'file', 'files', 'module',
  'modules', 'value', 'values', 'data', 'type', 'types', 'test', 'tests', 'line',
  'lines', 'more', 'less', 'very', 'over', 'under', 'same', 'such', 'only',
  'just', 'than', 'some', 'into', 'also', 'been', 'being', 'make', 'made',
  'does', 'did', 'done', 'adds', 'added', 'remove', 'removed', 'update',
  'updated', 'changes', 'change', 'logic', 'system', 'service', 'services',
  'client', 'clients', 'config', 'schema', 'unknown', 'null', 'true', 'false',
]);

const MODULE_HINTS: Record<string, readonly string[]> = {
  complexity: ['algorithmic complexity', 'query cost', 'performance hotspot'],
  design_patterns: ['design pattern', 'dependency inversion', 'abstraction boundary'],
  clean_code: ['readability', 'refactor', 'maintainability'],
  type_system: ['type safety', 'schema typing', 'inference'],
  integration: ['external service', 'api integration', 'client initialization'],
  testing: ['automated testing', 'test harness', 'regression safety'],
  ai_assisted: ['ai workflow', 'prompting', 'model integration'],
  performance: ['latency', 'throughput', 'resource usage'],
  security: ['security hardening', 'encryption', 'authentication', 'secrets management'],
  api_design: ['api contract', 'interface design', 'backward compatibility'],
  error_resilience: ['error handling', 'retry strategy', 'fault tolerance'],
  observability: ['tracing', 'logging', 'metrics', 'diagnostics'],
  concurrency: ['parallelism', 'race condition', 'synchronization'],
  dx: ['developer experience', 'tooling', 'validation'],
  dependency_health: ['dependency upgrade', 'versioning', 'supply chain'],
  evolutionary: ['modularization', 'migration', 'incremental refactor'],
  js_advanced: ['javascript runtime', 'async control flow', 'language feature'],
  react_patterns: ['react component design', 'state management', 'rendering'],
  devops: ['deployment', 'ci cd', 'infrastructure automation'],
  python_patterns: ['python architecture', 'async python', 'python tooling'],
  go_patterns: ['go services', 'goroutines', 'go observability'],
  java_patterns: ['java backend', 'spring or quarkus patterns', 'jvm services'],
  elixir_patterns: ['beam systems', 'otp', 'elixir architecture'],
  architecture_patterns: ['system boundaries', 'service decomposition', 'software architecture'],
};

function splitCamelCase(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean);
}

function tokenize(input: string): string[] {
  const rawParts = input
    .replace(/[@/.:()[\]{}]/g, ' ')
    .split(/[^A-Za-z0-9_-]+/)
    .filter(Boolean);

  const tokens: string[] = [];
  for (const part of rawParts) {
    const pieces = splitCamelCase(part).flatMap((piece) => piece.split(/[_-]+/));
    for (const piece of pieces) {
      const normalized = piece.trim().toLowerCase();
      if (
        normalized.length < 3
        || normalized.length > 32
        || STOP_WORDS.has(normalized)
        || /^\d+$/.test(normalized)
      ) {
        continue;
      }
      tokens.push(normalized);
    }
  }
  return tokens;
}

function pushUnique<T>(items: T[], value: T): void {
  if (!items.includes(value)) items.push(value);
}

function trimSnippet(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getFileSignals(diffs: readonly FileDiff[], contextHint?: string): string[] {
  const signals: string[] = [];
  if (contextHint) pushUnique(signals, contextHint);

  const rankedFiles = [...diffs]
    .sort((left, right) => (right.additions + right.deletions) - (left.additions + left.deletions))
    .slice(0, MAX_FILE_SIGNALS)
    .map((diff) => diff.filename);

  for (const filename of rankedFiles) {
    pushUnique(signals, filename);
  }

  return signals.slice(0, MAX_FILE_SIGNALS);
}

function getCodeSignals(diffs: readonly FileDiff[], commitMessage: string, commitBody?: string): string[] {
  const weights = new Map<string, number>();

  const addWeight = (token: string, amount: number): void => {
    weights.set(token, (weights.get(token) ?? 0) + amount);
  };

  for (const token of tokenize(commitMessage)) addWeight(token, 4);
  for (const token of tokenize(commitBody ?? '')) addWeight(token, 3);

  for (const diff of diffs) {
    for (const token of tokenize(diff.filename)) addWeight(token, 2);

    const addedLines = diff.patch
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .map((line) => line.slice(1))
      .filter(Boolean);

    for (const line of addedLines.slice(0, 80)) {
      const lineWeight = /\b(import|from|new |class |interface |function |const |let |type |enum )/.test(line) ? 2 : 1;
      for (const token of tokenize(line)) addWeight(token, lineWeight);
    }
  }

  return [...weights.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, MAX_RETRIEVAL_TERMS)
    .map(([token]) => token);
}

function buildRetrievalText(
  finding: Finding,
  ctx: AnalysisContext,
  retrievalTerms: readonly string[],
  fileSignals: readonly string[],
): string {
  const sections = [
    `Repository: ${ctx.repo}`,
    `Module: ${finding.moduleId}`,
    `Aspect: ${finding.aspect}`,
    `Headline: ${finding.finding}`,
    `Technical detail: ${finding.technicalDetail}`,
    `Commit subject: ${ctx.commitMessage}`,
    ctx.commitBody ? `Commit body: ${trimSnippet(ctx.commitBody, 280)}` : '',
    finding.contextHint ? `Code location: ${finding.contextHint}` : '',
    fileSignals.length > 0 ? `Touched files: ${fileSignals.join(', ')}` : '',
    MODULE_HINTS[finding.moduleId]?.length ? `Module themes: ${MODULE_HINTS[finding.moduleId]!.join(', ')}` : '',
    retrievalTerms.length > 0 ? `Concrete terms: ${retrievalTerms.join(', ')}` : '',
    `Developer-facing explanation: ${finding.plainLanguage}`,
  ].filter(Boolean);

  return trimSnippet(sections.join('\n'), MAX_RETRIEVAL_TEXT_LENGTH);
}

export function enrichFindingForRetrieval(finding: Finding, ctx: AnalysisContext): Finding {
  const fileSignals = getFileSignals(ctx.diffs, finding.contextHint);
  const retrievalTerms = [
    ...new Set([
      ...getCodeSignals(ctx.diffs, ctx.commitMessage, ctx.commitBody),
      ...tokenize(finding.finding),
      ...tokenize(finding.technicalDetail),
      ...(MODULE_HINTS[finding.moduleId] ?? []).flatMap((term) => tokenize(term)),
    ]),
  ].slice(0, MAX_RETRIEVAL_TERMS);

  return {
    ...finding,
    retrievalTerms,
    retrievalText: buildRetrievalText(finding, ctx, retrievalTerms, fileSignals),
  };
}

export function enrichFindingsForRetrieval(findings: readonly Finding[], ctx: AnalysisContext): Finding[] {
  return findings.map((finding) => enrichFindingForRetrieval(finding, ctx));
}
