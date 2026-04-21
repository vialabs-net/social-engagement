import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';
import { extractRemovedLines, extractFirstHunkSnippet } from '../diff-parser.js';

interface SecurityPattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  readonly isConcern: boolean;
  readonly retrievalTerms?: readonly string[];
  detect(addedLines: readonly string[], filename: string): boolean;
}

const SECRET_REGEX = /(?:api[_-]?key|secret|token|password|credentials)\s*[:=]\s*['"][A-Za-z0-9+/=_-]{16,}['"]/i;
const SQL_CONCAT_REGEX = /(?:`SELECT|`INSERT|`UPDATE|`DELETE|`DROP).*\$\{|['"]SELECT.*['"]\s*\+|['"]INSERT.*['"]\s*\+/i;
const KMS_ENCRYPTION_REGEX = /@google-cloud\/kms|KeyManagementServiceClient|encrypted_dek|envelope encryption|createCipheriv|createDecipheriv|aes-256-gcm|getAuthTag|setAuthTag|kmsKeyName|resolveTenantSecrets|wrap(ped)? key|unwrap/i;
const TEST_FILE_REGEX = /\.(test|spec)\.(ts|tsx|js|jsx)$|__tests__\//;

const PATTERNS: readonly SecurityPattern[] = [
  {
    name: 'key management / envelope encryption',
    score: 9,
    isConcern: false,
    technicalDetail: 'Envelope encryption with KMS-backed key management — a KEK protects tenant-scoped DEKs, while local AES-GCM handles the actual payload encryption.',
    explanation: 'This is a serious security hardening step. Instead of leaving sensitive tokens in plaintext or relying on one shared secret, the system wraps per-tenant keys with a managed KMS boundary and decrypts data only when needed.',
    retrievalTerms: ['kms', 'envelope encryption', 'dek', 'kek', 'aes-256-gcm', 'tenant secrets'],
    detect: (lines, filename) => {
      if (TEST_FILE_REGEX.test(filename)) return false;
      return lines.some((line) => KMS_ENCRYPTION_REGEX.test(line));
    },
  },
  {
    name: 'hardcoded secret',
    score: 9,
    isConcern: true,
    technicalDetail: 'Hardcoded secret — API key, token, or password embedded directly in source code instead of environment variables.',
    explanation: 'Secrets in source code end up in version control, CI logs, and every developer\'s machine. One leaked commit exposes the key forever. Environment variables keep secrets out of the codebase.',
    detect: (lines, filename) => {
      if (TEST_FILE_REGEX.test(filename)) return false;
      return lines.some((l) => SECRET_REGEX.test(l));
    },
  },
  {
    name: 'SQL injection surface',
    score: 9,
    isConcern: true,
    technicalDetail: 'SQL injection — user input concatenated into a query string instead of using parameterized queries.',
    explanation: 'String-concatenated SQL lets an attacker inject arbitrary queries. Parameterized queries separate data from code, making injection impossible regardless of input.',
    detect: (lines, filename) => {
      if (TEST_FILE_REGEX.test(filename)) return false;
      return lines.some((l) => SQL_CONCAT_REGEX.test(l));
    },
  },
  {
    name: 'input validation',
    score: 8,
    isConcern: false,
    technicalDetail: 'Input validation — schema-based validation at system boundaries to reject malformed data before it reaches business logic.',
    explanation: 'Validating input at the boundary catches bad data early. A Zod schema or validator middleware rejects invalid requests before they touch the database or trigger unexpected behavior.',
    detect: (lines) => lines.some((l) =>
      /\b(z\.object\(|z\.string\(|z\.number\(|Joi\.|joi\.|\.validate\(|express-validator|sanitize|\.safeParse\(|schema\.parse\()/.test(l),
    ),
  },
  {
    name: 'authentication / authorization',
    score: 7,
    isConcern: false,
    technicalDetail: 'Auth layer — authentication verifies identity, authorization verifies permissions before granting access to protected resources.',
    explanation: 'Auth middleware ensures every request proves who it is and what it can do. Without it, any endpoint is public by default — one missing check and sensitive data leaks.',
    detect: (lines) => lines.some((l) =>
      /\b(verifyToken\(|requireRole\(|requireAuth\(|isAuthenticated|jwt\.verify\(|passport\.|auth[Mm]iddleware|\.useGuard\(|@Authorized|canActivate)/.test(l),
    ),
  },
  {
    name: 'security headers',
    score: 7,
    isConcern: false,
    technicalDetail: 'Security headers — HTTP headers like CSP, HSTS, and X-Frame-Options that instruct browsers to enforce security policies.',
    explanation: 'Security headers tell the browser what to trust. Helmet sets them all in one line — CSP blocks injected scripts, HSTS forces HTTPS, X-Frame-Options prevents clickjacking.',
    detect: (lines) => lines.some((l) =>
      /\b(helmet\(|cors\(|csp\(|Content-Security-Policy|X-Frame-Options|Strict-Transport-Security|\.enableCors\()/.test(l),
    ),
  },
];

export class SecurityModule implements CodeAnalyzer {
  readonly id = 'security';
  readonly name = 'Security Patterns';
  readonly category = 'security' as const;

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
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
          const prefix = pattern.isConcern ? 'Potential concern' : 'Added';
          return {
            moduleId: this.id,
            aspect: pattern.name,
            finding: `${prefix}: ${pattern.name} in ${diff.filename}`,
            technicalDetail: pattern.technicalDetail,
            plainLanguage: pattern.explanation,
            interestScore: pattern.score,
            contextHint: `${diff.filename} in ${ctx.repo}`,
            retrievalTerms: pattern.retrievalTerms ? [...pattern.retrievalTerms] : undefined,
            evidence: {
              before: removedText.slice(0, 300) || undefined,
              after: extractFirstHunkSnippet(diff.patch) || undefined,
            },
          };
        }
      }
    }

    return null;
  }
}
