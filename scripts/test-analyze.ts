/**
 * test-analyze.ts — run the module pipeline on any commit SHA
 *
 * Usage: npm run test-analyze -- <sha> <owner/repo>
 * Example: npm run test-analyze -- abc1234 liliana/my-project
 *
 * Requires: GITHUB_TOKEN in environment
 */

import { GitHubClient } from '../src/github/client.js';
import { enrichCommit } from '../src/github/commit-enricher.js';
import { runPipeline } from '../src/analysis/pipeline.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const sha = args[0];
  const fullRepo = args[1];

  if (!sha || !fullRepo || !fullRepo.includes('/')) {
    console.error('Usage: npm run test-analyze -- <sha> <owner/repo>');
    console.error('Example: npm run test-analyze -- abc1234 liliana/devcast');
    process.exit(1);
  }

  const [owner, repo] = fullRepo.split('/') as [string, string];
  const token = process.env['GITHUB_TOKEN'] ?? '';

  if (!token) {
    console.error('GITHUB_TOKEN not set');
    process.exit(1);
  }

  console.log(`\nAnalyzing commit ${sha} in ${fullRepo}...\n`);

  const client = new GitHubClient(token);
  const commit = await enrichCommit(client, owner, repo, sha, 'unknown');

  console.log(`Message:   ${commit.message}`);
  console.log(`Languages: ${commit.languages.join(', ') || 'none detected'}`);
  console.log(`Changes:   +${commit.totalAdditions} / -${commit.totalDeletions} lines`);
  console.log(`Files:     ${commit.diffs.length}`);
  console.log('');

  const findings = await runPipeline({
    diffs: commit.diffs,
    commitMessage: commit.message,
    languages: commit.languages,
    repo: commit.repo,
    sha: commit.sha,
  });

  if (findings.length === 0) {
    console.log('No interesting findings. This commit would be skipped (no Claude call).');
    return;
  }

  console.log(`Found ${findings.length} finding(s):\n`);

  for (const finding of findings) {
    console.log(`[${'★'.repeat(finding.interestScore)}${' '.repeat(10 - finding.interestScore)}] score=${finding.interestScore} module=${finding.moduleId}`);
    console.log(`  Aspect:    ${finding.aspect}`);
    console.log(`  Finding:   ${finding.finding}`);
    console.log(`  Technical: ${finding.technicalDetail}`);
    console.log(`  Plain:     ${finding.plainLanguage.slice(0, 120)}...`);
    if (finding.evidence) {
      if (finding.evidence.before) console.log(`  Before:    ${finding.evidence.before}`);
      if (finding.evidence.after)  console.log(`  After:     ${finding.evidence.after}`);
    }
    console.log('');
  }

  console.log('These findings would be passed to Claude for post generation.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
