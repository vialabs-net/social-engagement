import { describe, it, expect } from 'vitest';
import { isInteresting, type CommitSummary, type FilterConfig } from '../utils/commit-filter.js';

const BASE_CONFIG: FilterConfig = {
  excludeRepos: [],
  excludePatterns: [],
  minChangedLines: 10,
};

const REAL_COMMIT: CommitSummary = {
  sha: '704723a',
  message: 'feat: wire slot-manager into publisher',
  authorLogin: 'lilicurl',
  totalAdditions: 45,
  totalDeletions: 8,
  repo: 'vialabs-net/social-engagement',
};

describe('isInteresting', () => {
  it('passes a real substantive commit', () => {
    const result = isInteresting(REAL_COMMIT, BASE_CONFIG);
    expect(result.interesting).toBe(true);
  });

  it('rejects a merge commit', () => {
    const result = isInteresting(
      { ...REAL_COMMIT, message: 'Merge pull request #21 from feat/fix-events' },
      BASE_CONFIG,
    );
    expect(result.interesting).toBe(false);
    expect(result.reason).toBe('merge commit');
  });

  it('rejects merge branch format', () => {
    const result = isInteresting(
      { ...REAL_COMMIT, message: 'Merge branch main into feat/fix' },
      BASE_CONFIG,
    );
    expect(result.interesting).toBe(false);
  });

  it('rejects dependabot author', () => {
    const result = isInteresting(
      { ...REAL_COMMIT, authorLogin: 'dependabot[bot]' },
      BASE_CONFIG,
    );
    expect(result.interesting).toBe(false);
    expect(result.reason).toContain('bot author');
  });

  it('rejects renovate author', () => {
    const result = isInteresting(
      { ...REAL_COMMIT, authorLogin: 'renovate' },
      BASE_CONFIG,
    );
    expect(result.interesting).toBe(false);
  });

  it('rejects a diff below minChangedLines', () => {
    const result = isInteresting(
      { ...REAL_COMMIT, totalAdditions: 3, totalDeletions: 2 },
      BASE_CONFIG,
    );
    expect(result.interesting).toBe(false);
    expect(result.reason).toContain('5 lines changed');
  });

  it('accepts a diff exactly at minChangedLines', () => {
    const result = isInteresting(
      { ...REAL_COMMIT, totalAdditions: 7, totalDeletions: 3 },
      BASE_CONFIG,
    );
    expect(result.interesting).toBe(true);
  });

  it('rejects a repo in the excludeRepos list (short name)', () => {
    const result = isInteresting(REAL_COMMIT, {
      ...BASE_CONFIG,
      excludeRepos: ['social-engagement'],
    });
    expect(result.interesting).toBe(false);
    expect(result.reason).toContain('repo excluded');
  });

  it('rejects a repo in the excludeRepos list (full slug)', () => {
    const result = isInteresting(REAL_COMMIT, {
      ...BASE_CONFIG,
      excludeRepos: ['vialabs-net/social-engagement'],
    });
    expect(result.interesting).toBe(false);
  });

  it('rejects a commit matching an excludePattern', () => {
    const result = isInteresting(
      { ...REAL_COMMIT, message: 'chore: bump version to 1.2.3' },
      { ...BASE_CONFIG, excludePatterns: ['^chore:'] },
    );
    expect(result.interesting).toBe(false);
    expect(result.reason).toContain('matches exclude pattern');
  });

  it('does not crash on an invalid regex in excludePatterns', () => {
    const result = isInteresting(REAL_COMMIT, {
      ...BASE_CONFIG,
      excludePatterns: ['[invalid(regex'],
    });
    // Invalid regex is skipped — commit should still pass other checks
    expect(result.interesting).toBe(true);
  });

  it('rejects a wip commit via pattern', () => {
    const result = isInteresting(
      { ...REAL_COMMIT, message: 'WIP: debugging slot race' },
      { ...BASE_CONFIG, excludePatterns: ['^WIP'] },
    );
    expect(result.interesting).toBe(false);
  });
});
