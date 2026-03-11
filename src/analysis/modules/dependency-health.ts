import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';

const SEMVER_REGEX = /["'][\^~]?(\d+)\.\d+\.\d+["']/;

const SECURITY_DEPS = new Set([
  'helmet', 'cors', 'bcrypt', 'bcryptjs', 'jsonwebtoken',
  'passport', 'express-rate-limit', 'csurf', 'hpp',
  'express-validator', 'zod', 'joi',
]);

interface DepPattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  detect(addedLines: readonly string[], removedLines: readonly string[]): boolean;
}

const PATTERNS: readonly DepPattern[] = [
  {
    name: 'security-sensitive dependency',
    score: 8,
    technicalDetail: 'Security dependency — a package dedicated to protecting the application from common attack vectors.',
    explanation: 'Adding a security package like helmet or bcrypt means someone is actively hardening the app. Each one closes a specific attack surface — CSRF, brute-force, injection.',
    detect: (added) => added.some((l) => {
      const match = l.match(/"([^"]+)":\s*"/);
      return match !== null && SECURITY_DEPS.has(match[1]!);
    }),
  },
  {
    name: 'major version bump',
    score: 8,
    technicalDetail: 'Major version upgrade — a semver major bump that may include breaking changes requiring code migration.',
    explanation: 'A major version bump means breaking changes. The maintainers changed the API, removed features, or restructured internals. It requires reading the migration guide and testing thoroughly.',
    detect: (added, removed) => {
      for (const addedLine of added) {
        const addedMatch = addedLine.match(/"([^"]+)":\s*"[\^~]?(\d+)\./);
        if (!addedMatch) continue;
        const depName = addedMatch[1];
        const addedMajor = addedMatch[2];
        if (!depName || !addedMajor) continue;
        for (const removedLine of removed) {
          const removedMatch = removedLine.match(new RegExp(`"${depName}":\\s*"[\\^~]?(\\d+)\\.`));
          if (removedMatch && removedMatch[1] !== addedMajor) return true;
        }
      }
      return false;
    },
  },
  {
    name: 'new dependency added',
    score: 5,
    technicalDetail: 'New dependency — a new package added to the project, expanding the dependency tree and attack surface.',
    explanation: 'Every new dependency is a bet on someone else\'s code. It solves a problem, but adds maintenance burden, security surface, and bundle size. The best dependency is one you don\'t need.',
    detect: (added, removed) => {
      const removedDeps = new Set(
        removed.map((l) => l.match(/"([^"]+)":\s*"/)?.[1]).filter(Boolean),
      );
      return added.some((l) => {
        const match = l.match(/"([^"]+)":\s*"/);
        return match !== null && SEMVER_REGEX.test(l) && !removedDeps.has(match[1]!);
      });
    },
  },
  {
    name: 'dependency removed',
    score: 7,
    technicalDetail: 'Dependency removal — reducing the dependency tree by eliminating an unused or replaced package.',
    explanation: 'Removing a dependency shrinks the attack surface, reduces install time, and eliminates a maintenance burden. Every removed package is code you no longer need to audit or update.',
    detect: (added, removed) => {
      const addedDeps = new Set(
        added.map((l) => l.match(/"([^"]+)":\s*"/)?.[1]).filter(Boolean),
      );
      return removed.some((l) => {
        const match = l.match(/"([^"]+)":\s*"/);
        return match !== null && SEMVER_REGEX.test(l) && !addedDeps.has(match[1]!);
      });
    },
  },
  {
    name: 'engine constraint',
    score: 5,
    technicalDetail: 'Engine constraint — pinning the required Node.js or npm version to prevent runtime incompatibilities.',
    explanation: 'An engine constraint in package.json prevents "works on my machine" problems. npm install fails immediately if the Node version is wrong — no mysterious runtime errors later.',
    detect: (added) => added.some((l) =>
      /["']engines["']|["']node["']\s*:\s*["'][><=^~]?\d+/.test(l),
    ),
  },
];

export class DependencyHealthModule implements CodeAnalyzer {
  readonly id = 'dependency_health';
  readonly name = 'Dependency Health';
  readonly category = 'dependency_health' as const;

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    for (const diff of ctx.diffs) {
      if (!diff.patch || diff.status === 'removed') continue;
      if (!diff.filename.endsWith('package.json')) continue;

      const lines = diff.patch.split('\n');
      const addedLines = lines
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1));
      const removedLines = lines
        .filter((l) => l.startsWith('-') && !l.startsWith('---'))
        .map((l) => l.slice(1));

      if (addedLines.length === 0 && removedLines.length === 0) continue;

      for (const pattern of PATTERNS) {
        if (pattern.detect(addedLines, removedLines)) {
          return {
            moduleId: this.id,
            aspect: pattern.name,
            finding: `${pattern.name} in ${diff.filename}`,
            technicalDetail: pattern.technicalDetail,
            plainLanguage: pattern.explanation,
            interestScore: pattern.score,
          };
        }
      }
    }

    return null;
  }
}
