/**
 * Rule-based commit filtering — zero API cost.
 * Runs before any module analysis or Claude call.
 */

export interface CommitSummary {
  sha: string;
  message: string;
  authorLogin: string;
  totalAdditions: number;
  totalDeletions: number;
  repo: string;
}

export interface FilterConfig {
  excludeRepos: string[];
  excludePatterns: string[];
  minChangedLines: number;
}

export interface FilterResult {
  interesting: boolean;
  reason: string;
}

const BOT_PATTERNS = [
  /\[bot\]$/i,
  /dependabot/i,
  /renovate/i,
  /github-actions/i,
  /snyk-bot/i,
];

const MERGE_PATTERNS = [
  /^merge (pull request|branch|remote)/i,
  /^merged? /i,
];

const RELEASE_PATTERNS = [
  /^chore(\([^)]+\))?\s*:\s*(release|bump|version)/i,
  /^release\s+v?\d+/i,
  /^bump\s+(version|v?\d+)/i,
];

const DOCS_PATTERNS = [
  /^docs(\([^)]+\))?\s*:/i,
  /^documentation\b/i,
];

const REVERT_PATTERNS = [
  /^revert(\([^)]+\))?\s*:/i,
  /^revert\s+/i,
];

export function isInteresting(
  commit: CommitSummary,
  config: FilterConfig,
): FilterResult {
  // Exclude specific repos
  const repoName = commit.repo.split('/').pop() ?? commit.repo;
  if (config.excludeRepos.includes(repoName) || config.excludeRepos.includes(commit.repo)) {
    return { interesting: false, reason: `repo excluded: ${commit.repo}` };
  }

  // Skip bot commits
  if (BOT_PATTERNS.some(p => p.test(commit.authorLogin))) {
    return { interesting: false, reason: `bot author: ${commit.authorLogin}` };
  }

  // Skip merge commits
  if (MERGE_PATTERNS.some(p => p.test(commit.message))) {
    return { interesting: false, reason: 'merge commit' };
  }

  // Skip release/version-bump commits
  if (RELEASE_PATTERNS.some(p => p.test(commit.message))) {
    return { interesting: false, reason: 'release commit' };
  }

  // Skip documentation-only commits
  if (DOCS_PATTERNS.some(p => p.test(commit.message))) {
    return { interesting: false, reason: 'docs commit' };
  }

  // Skip revert commits
  if (REVERT_PATTERNS.some(p => p.test(commit.message))) {
    return { interesting: false, reason: 'revert commit' };
  }

  // Skip commits matching user-configured exclude patterns
  for (const pattern of config.excludePatterns) {
    try {
      if (new RegExp(pattern).test(commit.message)) {
        return { interesting: false, reason: `matches exclude pattern: ${pattern}` };
      }
    } catch {
      // Invalid regex in config — skip this pattern, don't crash the pipeline
    }
  }

  // Minimum lines changed
  const totalLines = commit.totalAdditions + commit.totalDeletions;
  if (totalLines < config.minChangedLines) {
    return {
      interesting: false,
      reason: `only ${totalLines} lines changed (min: ${config.minChangedLines})`,
    };
  }

  return { interesting: true, reason: 'passes all filters' };
}
