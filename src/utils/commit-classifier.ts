import type { PrContext } from '../github/commit-enricher.js';

export type CommitIntent =
  | 'urgent_fix'
  | 'planned_feature'
  | 'tech_debt'
  | 'optimization'
  | 'unknown';

const BRANCH_URGENT_RE  = /\/hotfix\//i;
const BRANCH_FIX_RE     = /\/fix\//i;
const BRANCH_FEATURE_RE = /\/(feat|feature)\//i;
const BRANCH_DEBT_RE    = /\/(refactor|chore|cleanup)\//i;
const BRANCH_PERF_RE    = /\/perf\//i;

const MSG_URGENT_RE  = /^(fix|hotfix|patch)(\([^)]+\))?!?\s*:|\b(critical|urgent|cve|security[\s-]patch)\b/i;
const MSG_FEATURE_RE = /^feat(\([^)]+\))?!?\s*:|^(add|introduce|implement)\b/i;
const MSG_DEBT_RE    = /^(refactor|chore|cleanup|remove|extract)(\([^)]+\))?!?\s*:/i;
const MSG_PERF_RE    = /^perf(\([^)]+\))?!?\s*:|\b(optim|cache|batch|memoiz)\w*\b/i;

const URGENT_MODULES  = new Set(['security', 'error_resilience']);
const FEATURE_MODULES = new Set(['architecture_patterns', 'api_design', 'integration']);
const DEBT_MODULES    = new Set(['clean_code', 'evolutionary', 'type_system']);
const PERF_MODULES    = new Set(['performance', 'concurrency']);

export interface IntentInput {
  readonly message:    string;
  readonly branchRef?: string;
  readonly prTitle?:   string;
  readonly moduleIds?: string[];
}

export function detectCommitIntent(input: IntentInput): CommitIntent {
  const { message, branchRef = '', prTitle = '', moduleIds = [] } = input;
  const scores: Record<CommitIntent, number> = {
    urgent_fix: 0, planned_feature: 0, tech_debt: 0, optimization: 0, unknown: 0,
  };

  // Branch ref — weight 3 (highest confidence)
  if (BRANCH_URGENT_RE.test(branchRef))  scores.urgent_fix      += 3;
  if (BRANCH_FIX_RE.test(branchRef))     scores.urgent_fix      += 2;
  if (BRANCH_FEATURE_RE.test(branchRef)) scores.planned_feature += 3;
  if (BRANCH_DEBT_RE.test(branchRef))    scores.tech_debt       += 3;
  if (BRANCH_PERF_RE.test(branchRef))    scores.optimization    += 3;

  // Commit message — weight 2
  if (MSG_URGENT_RE.test(message))  scores.urgent_fix      += 2;
  if (MSG_FEATURE_RE.test(message)) scores.planned_feature += 2;
  if (MSG_DEBT_RE.test(message))    scores.tech_debt       += 2;
  if (MSG_PERF_RE.test(message))    scores.optimization    += 2;

  // PR title — weight 2 (more deliberate than commit message)
  if (MSG_URGENT_RE.test(prTitle))  scores.urgent_fix      += 2;
  if (MSG_FEATURE_RE.test(prTitle)) scores.planned_feature += 2;
  if (MSG_DEBT_RE.test(prTitle))    scores.tech_debt       += 2;
  if (MSG_PERF_RE.test(prTitle))    scores.optimization    += 2;

  // Module IDs — weight 1 (semantic diff signal, not declarative)
  for (const id of moduleIds) {
    if (URGENT_MODULES.has(id))  scores.urgent_fix      += 1;
    if (FEATURE_MODULES.has(id)) scores.planned_feature += 1;
    if (DEBT_MODULES.has(id))    scores.tech_debt       += 1;
    if (PERF_MODULES.has(id))    scores.optimization    += 1;
  }

  const best = (Object.entries(scores) as [CommitIntent, number][])
    .filter(([k]) => k !== 'unknown')
    .sort((a, b) => b[1] - a[1])[0];

  return best && best[1] > 0 ? best[0] : 'unknown';
}

export function computeCollaborationWeight(prContext: PrContext | undefined): number {
  if (!prContext) return 1.0;

  const comments = prContext.timelineItemsCount ?? 0;

  if (
    prContext.outcome === 'closed_superseded' &&
    prContext.supersededEvidence?.confidence === 'high'
  ) {
    return 1.4;
  }

  if (comments >= 10) return 1.3;
  if (comments >= 5)  return 1.15;
  if (comments >= 2)  return 1.05;
  return 1.0;
}
