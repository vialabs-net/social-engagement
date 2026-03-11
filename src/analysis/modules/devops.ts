import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';

interface DevopsPattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  detect(addedLines: readonly string[], filename: string): boolean;
}

const DEVOPS_FILE_REGEX = /(?:Dockerfile|\.ya?ml$|\.github\/workflows|Makefile|Jenkinsfile|\.gitlab-ci|Helm|Chart\.yaml|values.*\.yaml)/i;

const PATTERNS: readonly DevopsPattern[] = [
  {
    name: 'multi-stage Docker build',
    score: 9,
    technicalDetail: 'Multi-stage Dockerfile — separates build and runtime stages to produce minimal production images without build tools or source code.',
    explanation: 'A multi-stage build compiles in one stage and copies only the binary to the final image. The production container has no compiler, no source code, no dev dependencies — smaller, faster, more secure.',
    detect: (lines, filename) => {
      if (!/Dockerfile/i.test(filename)) return false;
      const fromCount = lines.filter((l) => /^\s*FROM\s+/i.test(l)).length;
      return fromCount >= 2;
    },
  },
  {
    name: 'CI workflow',
    score: 7,
    technicalDetail: 'CI/CD pipeline — automated build, test, and deploy steps triggered by code changes.',
    explanation: 'A CI workflow runs tests and builds on every push. Bugs are caught before merge, deploys are automated, and "works on my machine" stops being an excuse.',
    detect: (lines, filename) => {
      if (!/(\.github\/workflows|\.gitlab-ci|Jenkinsfile)/i.test(filename)) return false;
      return lines.some((l) =>
        /\b(runs-on|steps|jobs|stage|pipeline)\b/.test(l),
      );
    },
  },
  {
    name: 'health check',
    score: 8,
    technicalDetail: 'Container health check — a periodic probe that tells the orchestrator whether the container is alive and ready to serve traffic.',
    explanation: 'A HEALTHCHECK in Docker or a livenessProbe in Kubernetes tells the orchestrator when a container is broken. Without it, traffic keeps flowing to a dead process.',
    detect: (lines, filename) => {
      if (!/Dockerfile|values.*\.ya?ml|deployment/i.test(filename)) return false;
      return lines.some((l) =>
        /\bHEALTHCHECK\b/.test(l) ||
        /\b(livenessProbe|readinessProbe|startupProbe)\b/.test(l),
      );
    },
  },
  {
    name: 'non-root container',
    score: 8,
    technicalDetail: 'Non-root container user — running the process as a non-privileged user to limit the blast radius of container escapes.',
    explanation: 'Running as root inside a container means a vulnerability gives the attacker root access. A non-root USER directive limits the damage — the process can only access what it owns.',
    detect: (lines, filename) => {
      if (!/Dockerfile/i.test(filename)) return false;
      return lines.some((l) =>
        /^\s*USER\s+(?!root)\w+/.test(l),
      );
    },
  },
  {
    name: 'Helm chart',
    score: 8,
    technicalDetail: 'Helm chart — templated Kubernetes manifests with configurable values for reproducible, version-controlled deployments.',
    explanation: 'Helm charts template Kubernetes YAML so one chart serves dev, staging, and production. Values change per environment, but the structure is consistent and versioned.',
    detect: (lines, filename) => {
      if (!/Chart\.ya?ml|values.*\.ya?ml|templates\//i.test(filename)) return false;
      return lines.some((l) =>
        /\bapiVersion\s*:\s*v\d|^\s*name\s*:\s*\w|^\s*{{/.test(l),
      );
    },
  },
  {
    name: 'secret management',
    score: 8,
    technicalDetail: 'Infrastructure secret management — using sealed secrets, external secret operators, or vault references instead of plaintext secrets in manifests.',
    explanation: 'Plaintext secrets in YAML end up in git history forever. Sealed secrets or external secret operators fetch credentials at deploy time — the secret never touches the repo.',
    detect: (lines, filename) => {
      if (!/\.ya?ml$/i.test(filename)) return false;
      return lines.some((l) =>
        /\b(SealedSecret|ExternalSecret|SecretProviderClass|vault\.hashicorp)\b/.test(l) ||
        /\bsecretKeyRef\b/.test(l),
      );
    },
  },
  {
    name: 'resource limits',
    score: 7,
    technicalDetail: 'Kubernetes resource limits — CPU and memory bounds that prevent a single pod from consuming all cluster resources.',
    explanation: 'Without resource limits, one pod with a memory leak can starve the entire cluster. Limits and requests ensure fair scheduling and prevent one workload from killing others.',
    detect: (lines, filename) => {
      if (!/\.ya?ml$/i.test(filename)) return false;
      return lines.some((l) =>
        /\b(resources|limits|requests)\s*:/.test(l) &&
        /\b(cpu|memory)\b/.test(lines.join('\n')),
      );
    },
  },
];

export class DevopsModule implements CodeAnalyzer {
  readonly id = 'devops';
  readonly name = 'DevOps Patterns';
  readonly category = 'devops' as const;

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    for (const diff of ctx.diffs) {
      if (!diff.patch || diff.status === 'removed') continue;
      if (!DEVOPS_FILE_REGEX.test(diff.filename)) continue;

      const addedLines = diff.patch
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1));

      if (addedLines.length === 0) continue;

      for (const pattern of PATTERNS) {
        if (pattern.detect(addedLines, diff.filename)) {
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
