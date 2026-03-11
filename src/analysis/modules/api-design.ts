import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';

interface ApiPattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  detect(addedLines: readonly string[]): boolean;
}

const BACKEND_FILE_REGEX = /(?:route|controller|handler|middleware|server|api[\\/])/i;

const PAGINATION_KEYWORDS = ['limit', 'offset', 'cursor', 'page', 'per_page', 'pageSize'];

function hasPaginationCoOccurrence(lines: readonly string[]): boolean {
  const joined = lines.join('\n').toLowerCase();
  let matches = 0;
  for (const kw of PAGINATION_KEYWORDS) {
    if (joined.includes(kw)) matches++;
    if (matches >= 2) return true;
  }
  return false;
}

const PATTERNS: readonly ApiPattern[] = [
  {
    name: 'RESTful route definition',
    score: 5,
    technicalDetail: 'RESTful routing — HTTP verbs mapped to resource endpoints following REST conventions.',
    explanation: 'REST routes use HTTP verbs (GET, POST, PUT, DELETE) to express intent. A well-named route like GET /users/:id is self-documenting — the verb says the action, the path says the resource.',
    detect: (lines) => lines.some((l) =>
      /\b(router|app)\.(get|post|put|patch|delete)\s*\(\s*['"`]\//.test(l) ||
      /\b@(Get|Post|Put|Patch|Delete)\s*\(/.test(l),
    ),
  },
  {
    name: 'error response contract',
    score: 8,
    technicalDetail: 'Standardized error responses — consistent error envelope with status code, error code, and message.',
    explanation: 'A consistent error format means every client knows exactly what to expect when something fails. Status code for machines, message for humans, error code for programmatic handling.',
    detect: (lines) => lines.some((l) =>
      /\.status\(\d{3}\)\s*\.json\(\s*\{/.test(l) ||
      /\b(reply|response)\.(code|status)\(\d{3}\)/.test(l),
    ),
  },
  {
    name: 'API versioning',
    score: 7,
    technicalDetail: 'API versioning — URL path or header-based version prefix to maintain backwards compatibility.',
    explanation: 'Versioning lets you evolve the API without breaking existing clients. Old clients keep using /v1, new clients move to /v2. No surprise breaking changes.',
    detect: (lines) => lines.some((l) =>
      /['"`]\/(?:api\/)?v\d+/.test(l) ||
      /api-version|x-api-version/i.test(l),
    ),
  },
  {
    name: 'rate limiting',
    score: 7,
    technicalDetail: 'Rate limiting — restricting request frequency per client to protect against abuse and ensure fair resource usage.',
    explanation: 'Rate limiting prevents one client from overwhelming the server. Without it, a single script can exhaust your resources and take down the service for everyone.',
    detect: (lines) => lines.some((l) =>
      /\b(rateLimit|rateLimiter|throttle)\s*\(/.test(l) ||
      /\b@Throttle\s*\(/.test(l) ||
      /express-rate-limit|@nestjs\/throttler|rate-limiter-flexible/.test(l),
    ),
  },
  {
    name: 'pagination',
    score: 7,
    technicalDetail: 'Pagination — returning data in bounded pages instead of unbounded result sets.',
    explanation: 'Pagination keeps responses fast and predictable. Without it, a table with 100k rows returns everything at once — slow response, high memory, bad UX.',
    detect: (lines) => hasPaginationCoOccurrence(lines),
  },
];

export class ApiDesignModule implements CodeAnalyzer {
  readonly id = 'api_design';
  readonly name = 'API Design';
  readonly category = 'api_design' as const;

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    for (const diff of ctx.diffs) {
      if (!diff.patch || diff.status === 'removed') continue;
      if (!BACKEND_FILE_REGEX.test(diff.filename)) continue;

      const addedLines = diff.patch
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1));

      if (addedLines.length === 0) continue;

      for (const pattern of PATTERNS) {
        if (pattern.detect(addedLines)) {
          return {
            moduleId: this.id,
            aspect: pattern.name,
            finding: `${pattern.name} in ${diff.filename}`,
            technicalDetail: pattern.technicalDetail,
            plainLanguage: pattern.explanation,
            interestScore: pattern.score,
            contextHint: `${diff.filename} in ${ctx.repo}`,
          };
        }
      }
    }

    return null;
  }
}
