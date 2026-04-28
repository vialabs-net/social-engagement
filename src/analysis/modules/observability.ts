import type { CodeAnalyzer, AnalysisContext, Finding, ModuleResult } from '../types.js';
import { extractRemovedLines, extractFirstHunkSnippet } from '../diff-parser.js';

interface ObservabilityPattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  detect(addedLines: readonly string[]): boolean;
}

const PATTERNS: readonly ObservabilityPattern[] = [
  {
    name: 'distributed tracing',
    score: 9,
    technicalDetail: 'Distributed tracing — propagating trace context across service boundaries to follow a request end-to-end.',
    explanation: 'Distributed tracing connects the dots across microservices. When a request touches 5 services, a trace shows exactly where it spent time and where it broke.',
    detect: (lines) => lines.some((l) =>
      /\b(tracer\.startSpan|trace\.getTracer|startActiveSpan|@opentelemetry\/|opentracing)\b/.test(l),
    ),
  },
  {
    name: 'structured logging',
    score: 8,
    technicalDetail: 'Structured logging — emitting log entries as key-value pairs instead of plain text for machine-parseable analysis.',
    explanation: 'Structured logs are searchable. Instead of grepping through "User 123 logged in", you query {event: "login", userId: 123}. Every log becomes a queryable data point.',
    detect: (lines) => lines.some((l) =>
      /\b(pino|winston|bunyan|log4js)\s*[.(]/.test(l) ||
      /\blogger\.(info|warn|error|debug)\s*\(\s*\{/.test(l),
    ),
  },
  {
    name: 'metrics instrumentation',
    score: 8,
    technicalDetail: 'Metrics — numeric measurements (counters, histograms, gauges) that track system behavior over time.',
    explanation: 'Metrics tell you what is happening right now. A counter tracks how many requests failed, a histogram shows response time distribution. Without metrics, you are flying blind.',
    detect: (lines) => lines.some((l) =>
      /\bnew\s+(Counter|Histogram|Gauge|Summary)\s*\(/.test(l) ||
      /\b(prometheus|prom-client|statsd|datadog-metrics)\b/.test(l) ||
      /\.(observe|timing)\s*\(/.test(l),
    ),
  },
  {
    name: 'error tracking',
    score: 7,
    technicalDetail: 'Error tracking — capturing exceptions with context and stack traces in a dedicated error monitoring service.',
    explanation: 'Error tracking services group, deduplicate, and alert on exceptions. Instead of searching logs for stack traces, you see every error ranked by frequency and impact.',
    detect: (lines) => lines.some((l) =>
      /\bSentry\.(captureException|captureMessage|init|withScope)\s*\(/.test(l) ||
      /\b(Bugsnag|bugsnag|@bugsnag\/|rollbar|Rollbar)\b/.test(l) ||
      /\b@sentry\//.test(l),
    ),
  },
  {
    name: 'correlation ID',
    score: 5,
    technicalDetail: 'Correlation ID — a unique identifier propagated through all services handling a single request for end-to-end traceability.',
    explanation: 'A correlation ID ties every log, error, and metric to one user request. When something breaks, you search one ID and see everything that happened across all services.',
    detect: (lines) => lines.some((l) =>
      /\b(correlationId|correlation[_-]id|requestId|request[_-]id|x-request-id|x-correlation-id)\b/i.test(l),
    ),
  },
];

export class ObservabilityModule implements CodeAnalyzer {
  readonly id = 'observability';
  readonly name = 'Observability';
  readonly category = 'observability' as const;

  async analyze(ctx: AnalysisContext): Promise<ModuleResult> {
    let hasBilateral = false;

    for (const diff of ctx.diffs) {
      if (!diff.patch || diff.status === 'removed') continue;
      if (diff.language === 'Markdown') continue;

      const addedLines = diff.patch
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1));

      if (addedLines.length === 0) continue;

      const removedText = extractRemovedLines(diff.patch);
      const removedLines = removedText.split('\n').filter(Boolean);

      for (const pattern of PATTERNS) {
        if (pattern.detect(addedLines) && !pattern.detect(removedLines)) {
          const triggerLine = addedLines.find((l) => pattern.detect([l]));
          const obsFacts: string[] = [
            `${pattern.name} detected in ${diff.filename} (${diff.status}: +${diff.additions}/-${diff.deletions} lines).`,
          ];
          if (triggerLine) obsFacts.push(`Trigger: "${triggerLine.trim().slice(0, 100)}".`);

          return {
            moduleId: this.id,
            aspect: pattern.name,
            finding: `${pattern.name} in ${diff.filename}`,
            technicalDetail: pattern.technicalDetail,
            plainLanguage: pattern.explanation,
            verifiableFacts: obsFacts,
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
