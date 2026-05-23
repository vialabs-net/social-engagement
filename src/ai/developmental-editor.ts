import type { Finding } from '../analysis/types.js';
import type { PrContext } from '../github/commit-enricher.js';
import type { CommitIntent } from '../utils/commit-classifier.js';

export type ArcType =
  | 'quantified_improvement'
  | 'broken_assumption'
  | 'tradeoff_made'
  | 'operational_consequence'
  | 'problem_dissolved'
  | 'design_shipped';

export interface R3Context {
  readonly findings:              Finding[];
  readonly commitIntent:          CommitIntent;
  readonly closingIssues:         PrContext['closingIssues'];
  readonly changesRequestedCount: number;
  readonly collaborationWeight:   number;
  readonly recentArcTypes:        ArcType[];
}

export interface NarrativeScore {
  readonly tension:     number;
  readonly resolution:  number;
  readonly consequence: number;
  total():     number;
  normalized(): number;
}

export interface DevelopmentalAngle {
  readonly arcType:         ArcType;
  readonly leadFinding:     Finding;
  readonly score:           NarrativeScore;
  readonly tension:         string;
  readonly resolution:      string;
  readonly consequence:     string;
  readonly angleHint:       string;
  readonly missingNote:     string;
  readonly arcPatternNote:  string;
}

function scoreNarrative(f: Finding, ctx: R3Context): NarrativeScore {
  let tension = 0, resolution = 0, consequence = 0;

  if (f.evidence?.before?.trim())                                                  tension++;
  if (/\b(was|caused|broke|assumed|failed|wrong|instead of)\b/i.test(f.technicalDetail)) tension++;
  if (['security', 'error_resilience', 'performance'].includes(f.moduleId))        tension++;
  if ((ctx.closingIssues ?? []).some((i) => i.totalReactions >= 5))                tension++;
  tension = Math.min(tension, 3);

  if (f.evidence?.after?.trim())                                                   resolution++;
  if ((f.verifiableFacts?.length ?? 0) >= 2)                                       resolution++;
  if (f.contextHint?.includes('/'))                                                resolution++;
  resolution = Math.min(resolution, 3);

  if (/\b(now|enables|prevents|no longer|users can|reduces)\b/i.test(`${f.plainLanguage} ${f.finding}`)) consequence++;
  if (/\d+(%|ms|x\b| lines| files)/.test(`${f.verifiableFacts?.join(' ') ?? ''}${f.technicalDetail}`))   consequence++;
  consequence = Math.min(consequence, 2);

  return {
    tension,
    resolution,
    consequence,
    total:      () => tension + resolution + consequence,
    normalized: () => (tension + resolution + consequence) / 8,
  };
}

function selectLeadFinding(
  findings: Finding[],
  ctx: R3Context,
): { finding: Finding; score: NarrativeScore } {
  const MAX_INTEREST = 10;
  const ranked = findings.map((f) => {
    const ns = scoreNarrative(f, ctx);
    const base = (f.interestScore / MAX_INTEREST) * 0.4 + ns.normalized() * 0.6;
    const composite = base * ctx.collaborationWeight;
    return { finding: f, score: ns, composite };
  });
  ranked.sort((a, b) => b.composite - a.composite);
  return ranked[0]!;
}

function candidateArcs(f: Finding, ctx: R3Context): ArcType[] {
  const arcs: ArcType[] = [];
  const facts = f.verifiableFacts?.join(' ') ?? '';
  const detail = f.technicalDetail;

  if (/\d+(%|ms|x\b| lines)/.test(facts + detail))
    arcs.push('quantified_improvement');

  if (
    f.evidence?.before?.trim() &&
    /\b(was wrong|assumed|turned out|actually|in fact)\b/i.test(`${detail}${f.finding}`)
  ) arcs.push('broken_assumption');

  if (
    /\b(instead of|over|rather than|vs\.?|chose)\b/i.test(detail) ||
    ctx.changesRequestedCount > 0
  ) arcs.push('tradeoff_made');

  if (
    ['observability', 'error_resilience', 'devops', 'security'].includes(f.moduleId) &&
    /\b(now|no longer|prevents|enables|users)\b/i.test(`${f.plainLanguage}${f.finding}`)
  ) arcs.push('operational_consequence');

  if (
    (ctx.closingIssues ?? []).length > 0 &&
    (ctx.commitIntent === 'urgent_fix' || f.evidence?.before?.trim())
  ) arcs.push('problem_dissolved');

  if (
    ['architecture_patterns', 'api_design', 'integration'].includes(f.moduleId) &&
    !f.evidence?.before?.trim()
  ) arcs.push('design_shipped');

  return arcs;
}

const INTENT_ARC_PREFERENCE: Partial<Record<CommitIntent, ArcType[]>> = {
  urgent_fix:      ['problem_dissolved', 'operational_consequence'],
  planned_feature: ['design_shipped', 'quantified_improvement'],
  tech_debt:       ['tradeoff_made', 'broken_assumption'],
  optimization:    ['quantified_improvement', 'operational_consequence'],
};

function selectArc(
  candidates: ArcType[],
  commitIntent: CommitIntent,
  recentArcTypes: ArcType[],
): { arc: ArcType; arcPatternNote: string } {
  if (candidates.length === 0) return { arc: 'design_shipped', arcPatternNote: '' };

  const arcFreq = new Map<ArcType, number>();
  for (const a of recentArcTypes) arcFreq.set(a, (arcFreq.get(a) ?? 0) + 1);
  const penalized = new Set(
    [...arcFreq.entries()].filter(([, n]) => n >= 3).map(([a]) => a),
  );

  const preferred = INTENT_ARC_PREFERENCE[commitIntent] ?? [];
  const intentMatch = preferred.find((a) => candidates.includes(a) && !penalized.has(a));
  if (intentMatch) return { arc: intentMatch, arcPatternNote: '' };

  const unpunished = candidates.find((a) => !penalized.has(a));
  if (unpunished) {
    const first = candidates[0]!;
    const note = penalized.has(first)
      ? `Arc pattern: ${first} used in ${arcFreq.get(first)} of last 5 posts — using ${unpunished} instead.`
      : '';
    return { arc: unpunished, arcPatternNote: note };
  }

  return { arc: candidates[0]!, arcPatternNote: 'All candidate arcs used recently — repeating best fit.' };
}

export function selectDevelopmentalAngle(ctx: R3Context): DevelopmentalAngle | null {
  if (ctx.findings.length === 0) return null;

  const { finding: lead, score } = selectLeadFinding(ctx.findings, ctx);
  const candidates = candidateArcs(lead, ctx);
  const { arc, arcPatternNote } = selectArc(candidates, ctx.commitIntent, ctx.recentArcTypes);

  const tension = lead.evidence?.before?.trim()
    ? lead.evidence.before.trim().slice(0, 150)
    : lead.finding;

  const resolution = lead.evidence?.after?.trim()
    ? lead.evidence.after.trim().slice(0, 150)
    : lead.technicalDetail.slice(0, 150);

  const verifiableStr = (lead.verifiableFacts?.join(' | ') ?? '').slice(0, 120);
  const consequence = verifiableStr || lead.plainLanguage.slice(0, 150);

  const missing: string[] = [];
  if (arc === 'quantified_improvement' && !verifiableStr)
    missing.push('No verified numbers in the diff — do not invent percentages or timings.');
  if (arc === 'problem_dissolved' && (ctx.closingIssues ?? []).length === 0)
    missing.push('No closing issue available — do not invent a user-reported problem.');
  if (!lead.evidence?.before?.trim())
    missing.push('Before state not in diff — do not describe what the old code looked like.');

  const arcLabel = arc === 'operational_consequence' ? 'consequence'
    : arc === 'problem_dissolved' ? 'problem'
    : 'decision';

  return {
    arcType:        arc,
    leadFinding:    lead,
    score,
    tension,
    resolution,
    consequence,
    angleHint:      `Lead with the ${arcLabel}, not the mechanism.`,
    missingNote:    missing.join(' '),
    arcPatternNote,
  };
}

export function buildAngleBlock(angle: DevelopmentalAngle, collaborationWeight = 1.0): string {
  const { arcType, score, tension, resolution, consequence, angleHint, missingNote, arcPatternNote } = angle;
  const totalScore = score.total();
  const completeness = totalScore >= 6 ? 'high' : totalScore >= 3 ? 'medium' : 'low';

  const lines: string[] = [
    `Arc: ${arcType}`,
    `Completeness: ${completeness} (tension: ${score.tension}/3, resolution: ${score.resolution}/3, consequence: ${score.consequence}/2)`,
    '',
  ];

  if (completeness !== 'low') {
    lines.push(`Tension: ${tension}`);
    lines.push(`Resolution: ${resolution}`);
    lines.push(`Consequence: ${consequence}`);
    lines.push('');
    lines.push(`Angle: ${angleHint}`);
  }
  if (missingNote)    lines.push(`Missing: ${missingNote}`);
  if (arcPatternNote) lines.push(`Arc pattern: ${arcPatternNote}`);

  if (collaborationWeight >= 1.4) {
    lines.push('Collaboration signal: high (PR merged into upstream by maintainer)');
    lines.push('→ The review process itself is part of the story — the author shipped work that required significant iteration.');
    lines.push('→ Prefer arcs that show reasoning process (tradeoff_made, broken_assumption) over result-only arcs.');
  } else if (collaborationWeight >= 1.15) {
    lines.push(`Collaboration signal: medium (active PR discussion)`);
    lines.push('→ This work went through review iteration — the decision process adds narrative value.');
  }

  return `<developmental_angle>\n${lines.join('\n')}\n</developmental_angle>`;
}
