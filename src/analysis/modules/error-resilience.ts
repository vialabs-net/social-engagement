import type { CodeAnalyzer, AnalysisContext, Finding, ModuleResult } from '../types.js';
import { extractRemovedLines, extractFirstHunkSnippet } from '../diff-parser.js';

interface ResiliencePattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  detect(addedLines: readonly string[]): boolean;
}

const PATTERNS: readonly ResiliencePattern[] = [
  {
    name: 'circuit breaker',
    score: 9,
    technicalDetail: 'Circuit breaker — stops calling a failing service after repeated failures, allowing it time to recover before retrying.',
    explanation: 'A circuit breaker prevents cascading failures. After enough errors, it stops making requests and returns a fallback instead of hammering a dying service. Once the service recovers, it gradually resumes.',
    detect: (lines) => lines.some((l) =>
      /\b(CircuitBreaker|circuitBreaker|circuit[_-]?breaker)\s*[.(]/.test(l) ||
      /\b(opossum|cockatiel|mollitia)/.test(l),
    ),
  },
  {
    name: 'retry with backoff',
    score: 8,
    technicalDetail: 'Retry with exponential backoff — automatically retrying failed operations with increasing delay between attempts.',
    explanation: 'Retrying with backoff gives transient failures time to resolve. Each retry waits longer — 1s, 2s, 4s — so you recover from blips without overwhelming a struggling service.',
    detect: (lines) => lines.some((l) =>
      /\b(withRetry|retryWith|retry)\s*\(/.test(l) ||
      /\b(exponentialBackoff|backoff|retryDelay)\b/.test(l) ||
      /\bp-retry\b/.test(l),
    ),
  },
  {
    name: 'graceful degradation',
    score: 8,
    technicalDetail: 'Graceful degradation — providing a reduced but functional response when a dependency fails instead of crashing.',
    explanation: 'When a service goes down, graceful degradation keeps the app running with reduced functionality. Users get a cached result or a default instead of an error page.',
    detect: (lines) => lines.some((l) =>
      /\b(fallback|withFallback|onFallback|gracefulShutdown|degradeGracefully|getDefault[A-Z])\s*[.(]/.test(l),
    ),
  },
  {
    name: 'request timeout',
    score: 7,
    technicalDetail: 'Request timeout — bounding how long a network call can take to prevent indefinite blocking.',
    explanation: 'Without a timeout, a slow service can block your entire application indefinitely. Explicit timeouts ensure you fail fast and free resources instead of waiting forever.',
    detect: (lines) => lines.some((l) =>
      /\bAbortSignal\.timeout\s*\(/.test(l) ||
      /\b(axios|fetch|http|request|got)\b.*\btimeout\s*[:=]/.test(l) ||
      /\btimeout\s*[:=].*\b(axios|fetch|http|request|got)\b/.test(l),
    ),
  },
  {
    name: 'health check endpoint',
    score: 7,
    technicalDetail: 'Health check — a dedicated endpoint that reports service status for load balancers and orchestrators.',
    explanation: 'A /health endpoint lets Kubernetes, load balancers, and monitoring tools know if the service is alive. Without it, traffic keeps flowing to a broken instance.',
    detect: (lines) => lines.some((l) =>
      /\b(router|app)\.(get|all)\s*\(\s*['"`]\/(health|ready|liveness|readiness)/.test(l) ||
      /\b@Get\s*\(\s*['"`](health|ready|liveness)/.test(l),
    ),
  },
  {
    name: 'graceful shutdown',
    score: 8,
    technicalDetail: 'Graceful shutdown — listening for SIGINT/SIGTERM to close connections and flush buffers before the process exits.',
    explanation: 'When Kubernetes sends SIGTERM, a graceful shutdown finishes in-flight requests and closes DB connections. Without it, requests get cut mid-response and data can corrupt.',
    detect: (lines) => lines.some((l) =>
      /\bprocess\.on\s*\(\s*['"`](SIGINT|SIGTERM)['"`]/.test(l),
    ),
  },
];

export class ErrorResilienceModule implements CodeAnalyzer {
  readonly id = 'error_resilience';
  readonly name = 'Error Resilience';
  readonly category = 'error_resilience' as const;

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
