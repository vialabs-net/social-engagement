import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { openDb } from './lib/db.js';
import type {
  HumanLabel,
  PublishReadiness,
  DeclineJudgment,
  StructuralCheck,
} from './lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../out');
const LABEL_DIR = join(OUT_DIR, 'for-labeling');

interface MappingEntry {
  file: string;
  group_id: string;
  origin: 'organic' | 'adversarial' | 'control';
  variant: 'FOCAL' | 'ARCO' | 'SINGLE';
}

interface ParsedClaim {
  index: number;
  label: HumanLabel | null;
  notes: string;
}

interface ParsedPost {
  declined: boolean;
  claims: ParsedClaim[];
  publishReadiness: PublishReadiness | null;
  distrustReason: string;
  declineJudgment: DeclineJudgment | null;
}

// ── Parse a labeled markdown file ───────────────────────────────────────────

function parseMarkdown(md: string, declined: boolean): ParsedPost {
  const post: ParsedPost = {
    declined,
    claims: [],
    publishReadiness: null,
    distrustReason: '',
    declineJudgment: null,
  };

  if (declined) {
    if (/- \[[xX]\] sí, estos commits no eran un arco real/.test(md)) {
      post.declineJudgment = 'correct';
    } else if (/- \[[xX]\] no, había material válido para síntesis/.test(md)) {
      post.declineJudgment = 'incorrect';
    } else if (/- \[[xX]\] ambiguo/.test(md)) {
      post.declineJudgment = 'ambiguous';
    }
    const reasonMatch = md.match(/Razón:\s*(.+)/);
    if (reasonMatch) post.distrustReason = reasonMatch[1]?.trim() ?? '';
    return post;
  }

  // Claims table: | # | Claim | Pre-label (LLM) | Tu label | Notas |
  const lines = md.split('\n');
  const tableStart = lines.findIndex((l) => l.includes('| # | Claim | Pre-label (LLM) | Tu label | Notas |'));
  if (tableStart >= 0) {
    for (let i = tableStart + 2; i < lines.length; i++) {
      const line = lines[i]!;
      if (!line.trim().startsWith('|')) break;
      const cells = line.split('|').map((c) => c.trim());
      // cells[0] is empty (leading |), cells[1]=#, cells[2]=claim, cells[3]=prelabel, cells[4]=label, cells[5]=notes
      const idxStr = cells[1] ?? '';
      const label = cells[4] ?? '';
      const notes = cells[5] ?? '';
      const idx = parseInt(idxStr, 10);
      if (Number.isNaN(idx)) continue;
      const validLabels: HumanLabel[] = ['grounded', 'plausible_unsupported', 'contradicted', 'irrelevant', 'frame'];
      const normalizedLabel = validLabels.includes(label as HumanLabel) ? (label as HumanLabel) : null;
      post.claims.push({ index: idx, label: normalizedLabel, notes });
    }
  }

  // Publish readiness
  const readiness: Array<[RegExp, PublishReadiness]> = [
    [/\[[xX]\]\s*publish_asis/, 'publish_asis'],
    [/\[[xX]\]\s*light_edit/, 'light_edit'],
    [/\[[xX]\]\s*rewrite/, 'rewrite'],
    [/\[[xX]\]\s*discard/, 'discard'],
  ];
  for (const [re, value] of readiness) {
    if (re.test(md)) {
      post.publishReadiness = value;
      break;
    }
  }

  const distrustMatch = md.match(/¿Qué te haría desconfiar del post\?\*\*\s*(.+)/);
  if (distrustMatch) post.distrustReason = distrustMatch[1]?.trim() ?? '';

  return post;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = openDb();

  const mappingPath = join(LABEL_DIR, '_mapping.json');
  if (!existsSync(mappingPath)) {
    console.error(`[analyze] ${mappingPath} missing. Run npm run export first.`);
    process.exit(1);
  }
  const mapping = JSON.parse(readFileSync(mappingPath, 'utf8')) as MappingEntry[];

  // Check that all labeling files exist
  const files = new Set(readdirSync(LABEL_DIR));
  for (const m of mapping) {
    if (!files.has(m.file)) {
      console.error(`[analyze] Missing labeled file: ${m.file}`);
      process.exit(1);
    }
  }

  // Parse all files and load into human_labels + post_level_labels
  const parsedByGroup = new Map<string, { mapping: MappingEntry; parsed: ParsedPost }>();
  for (const m of mapping) {
    const md = readFileSync(join(LABEL_DIR, m.file), 'utf8');
    const declinedRow = db
      .prepare(`SELECT declined FROM synthesis_posts WHERE group_id = ?`)
      .get(m.group_id) as { declined: number } | undefined;
    const declined = declinedRow?.declined === 1;
    const parsed = parseMarkdown(md, declined);
    parsedByGroup.set(m.group_id, { mapping: m, parsed });

    // Persist human_labels
    db.prepare(`DELETE FROM human_labels WHERE group_id = ?`).run(m.group_id);
    for (const c of parsed.claims) {
      if (!c.label) continue;
      db.prepare(`
        INSERT INTO human_labels (group_id, claim_index, label, notes)
        VALUES (?, ?, ?, ?)
      `).run(m.group_id, c.index, c.label, c.notes || null);
    }
    db.prepare(`DELETE FROM post_level_labels WHERE group_id = ?`).run(m.group_id);
    db.prepare(`
      INSERT INTO post_level_labels (group_id, publish_readiness, decline_judgment, distrust_reason)
      VALUES (?, ?, ?, ?)
    `).run(m.group_id, parsed.publishReadiness, parsed.declineJudgment, parsed.distrustReason || null);
  }

  // ── Metrics ────────────────────────────────────────────────────────────
  const normalPosts = [...parsedByGroup.values()].filter((p) => !p.parsed.declined);
  const declinedPosts = [...parsedByGroup.values()].filter((p) => p.parsed.declined);

  // Per-post contamination
  function isContaminated(p: ParsedPost): boolean {
    const readiness = p.publishReadiness;
    if (readiness !== 'rewrite' && readiness !== 'discard') return false;
    const contradicted = p.claims.filter((c) => c.label === 'contradicted').length;
    const plausible = p.claims.filter((c) => c.label === 'plausible_unsupported').length;
    return contradicted >= 1 || plausible >= 2;
  }

  const contaminatedAll = normalPosts.filter((p) => isContaminated(p.parsed));
  const contaminationRate = normalPosts.length > 0 ? contaminatedAll.length / normalPosts.length : 0;

  function rateByOriginVariant(
    origin: MappingEntry['origin'] | 'any',
    variant: MappingEntry['variant'] | 'any',
  ): { n: number; contaminated: number; rate: number } {
    const filtered = normalPosts.filter(
      (p) => (origin === 'any' || p.mapping.origin === origin) && (variant === 'any' || p.mapping.variant === variant),
    );
    const c = filtered.filter((p) => isContaminated(p.parsed)).length;
    return { n: filtered.length, contaminated: c, rate: filtered.length > 0 ? c / filtered.length : 0 };
  }

  // Per-claim hallucination rate
  const totalClaims = normalPosts.reduce((a, p) => a + p.parsed.claims.length, 0);
  const frameClaims = normalPosts.reduce((a, p) => a + p.parsed.claims.filter((c) => c.label === 'frame').length, 0);
  const hallucinated = normalPosts.reduce(
    (a, p) =>
      a + p.parsed.claims.filter((c) =>
        c.label === 'plausible_unsupported' || c.label === 'contradicted' || c.label === 'irrelevant',
      ).length,
    0,
  );
  const claimHallucinationRate = totalClaims - frameClaims > 0 ? hallucinated / (totalClaims - frameClaims) : 0;

  // Fase B vs control
  const organicRate = rateByOriginVariant('organic', 'any');
  const controlRate = rateByOriginVariant('control', 'SINGLE');

  // Decline metrics
  const advDeclined = declinedPosts.filter((p) => p.mapping.origin === 'adversarial');
  const advDeclineCorrect = advDeclined.filter((p) => p.parsed.declineJudgment === 'correct').length;
  const declineAccuracyAdversarial = advDeclined.length > 0 ? advDeclineCorrect / advDeclined.length : 0;

  const orgDeclined = declinedPosts.filter((p) => p.mapping.origin === 'organic');
  const orgDeclineIncorrect = orgDeclined.filter((p) => p.parsed.declineJudgment === 'incorrect').length;
  const declineOverreachOrganic = orgDeclined.length > 0 ? orgDeclineIncorrect / orgDeclined.length : 0;

  // Pre-label metrics
  const prelabelRows = db
    .prepare(`
      SELECT p.group_id, p.claim_index, p.structural_check, h.label as human_label
      FROM prelabels p
      LEFT JOIN human_labels h ON h.group_id = p.group_id AND h.claim_index = p.claim_index
    `)
    .all() as Array<{ group_id: string; claim_index: number; structural_check: StructuralCheck; human_label: HumanLabel | null }>;

  let groundedMatch = 0;
  let negativeMatch = 0;
  let countedForStructural = 0;
  let escalationCorrect = 0;
  let escalationTotal = 0;

  for (const row of prelabelRows) {
    if (!row.human_label) continue;
    if (row.structural_check === 'needs_human') {
      escalationTotal++;
      if (row.human_label === 'plausible_unsupported' || row.human_label === 'contradicted') {
        escalationCorrect++;
      }
      continue;
    }
    if (row.structural_check === 'frame') continue;

    countedForStructural++;
    if (row.structural_check === 'grounded') {
      if (['grounded', 'plausible_unsupported', 'frame'].includes(row.human_label)) groundedMatch++;
    } else {
      // symbol/number/file_not_in_diff
      if (['contradicted', 'irrelevant'].includes(row.human_label)) negativeMatch++;
    }
  }
  const structuralAccuracy = countedForStructural > 0 ? (groundedMatch + negativeMatch) / countedForStructural : 0;
  const escalationQuality = escalationTotal > 0 ? escalationCorrect / escalationTotal : 0;

  // Recommendation
  const organicPostRate = organicRate.rate;
  let recommendation: string;
  if (organicPostRate < 0.15) {
    recommendation = `SHIP FASE B as specified. Add only pattern_kind=null escape in Haiku.`;
  } else if (organicPostRate <= 0.4) {
    recommendation = `MANDATORY: end-to-end evidence anchoring in Capa 4 prompt + forced citation.
Re-run experiment with 10 additional organic groups after implementation.`;
  } else {
    recommendation = `REDESIGN: synthesis as generative step is not viable at this rate.
Consider deterministic template over signals or drop Fase B.`;
  }

  const organicPoolWarning = normalPosts.filter((p) => p.mapping.origin === 'organic').length < 15;

  // ── Build report ───────────────────────────────────────────────────────
  const lines: string[] = [];
  lines.push('# Synthesis Hallucination Baseline — Analysis Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');

  if (organicPoolWarning) {
    lines.push(`> ⚠️ **Reduced sample** (${normalPosts.filter((p) => p.mapping.origin === 'organic').length} organic posts). Results directional, not conclusive. Re-run with ≥ 15 organic posts before final decision.`);
    lines.push('');
  }

  lines.push('## Headline metrics');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Per-post contamination (all normal) | ${(contaminationRate * 100).toFixed(1)}% (${contaminatedAll.length}/${normalPosts.length}) |`);
  lines.push(`| Per-post contamination (organic only) | ${(organicRate.rate * 100).toFixed(1)}% (${organicRate.contaminated}/${organicRate.n}) |`);
  lines.push(`| Per-post contamination (control SINGLE) | ${(controlRate.rate * 100).toFixed(1)}% (${controlRate.contaminated}/${controlRate.n}) |`);
  lines.push(`| Per-claim hallucination (excl frame) | ${(claimHallucinationRate * 100).toFixed(1)}% (${hallucinated}/${totalClaims - frameClaims}) |`);
  lines.push(`| Decline accuracy adversarial | ${(declineAccuracyAdversarial * 100).toFixed(1)}% (${advDeclineCorrect}/${advDeclined.length}) |`);
  lines.push(`| Decline overreach organic | ${(declineOverreachOrganic * 100).toFixed(1)}% (${orgDeclineIncorrect}/${orgDeclined.length}) |`);
  lines.push(`| Pre-label structural accuracy | ${(structuralAccuracy * 100).toFixed(1)}% (${groundedMatch + negativeMatch}/${countedForStructural}) |`);
  lines.push(`| Pre-label escalation quality | ${(escalationQuality * 100).toFixed(1)}% (${escalationCorrect}/${escalationTotal}) |`);
  lines.push('');

  lines.push('## Breakdown by origin × variant (normal posts)');
  lines.push('');
  lines.push(`| origin | variant | n | contaminated | rate |`);
  lines.push(`|---|---|---|---|---|`);
  for (const origin of ['organic', 'adversarial', 'control'] as const) {
    for (const variant of ['FOCAL', 'ARCO', 'SINGLE'] as const) {
      const r = rateByOriginVariant(origin, variant);
      if (r.n === 0) continue;
      lines.push(`| ${origin} | ${variant} | ${r.n} | ${r.contaminated} | ${(r.rate * 100).toFixed(1)}% |`);
    }
  }
  lines.push('');

  lines.push('## Decline breakdown');
  lines.push('');
  lines.push(`| origin | declined count | correct | incorrect | ambiguous |`);
  lines.push(`|---|---|---|---|---|`);
  for (const origin of ['organic', 'adversarial', 'control'] as const) {
    const filtered = declinedPosts.filter((p) => p.mapping.origin === origin);
    if (filtered.length === 0) continue;
    const c = filtered.filter((p) => p.parsed.declineJudgment === 'correct').length;
    const i = filtered.filter((p) => p.parsed.declineJudgment === 'incorrect').length;
    const a = filtered.filter((p) => p.parsed.declineJudgment === 'ambiguous').length;
    lines.push(`| ${origin} | ${filtered.length} | ${c} | ${i} | ${a} |`);
  }
  lines.push('');

  lines.push('## Warnings');
  lines.push('');
  if (structuralAccuracy < 0.85) {
    lines.push(`- **Pre-label structural accuracy (${(structuralAccuracy * 100).toFixed(1)}%) below 85%.** LLM pre-label is unreliable; human labeling cannot be shortened until prompt improves.`);
  }
  if (escalationQuality < 0.5) {
    lines.push(`- **Pre-label escalation quality (${(escalationQuality * 100).toFixed(1)}%) below 50%.** needs_human is not catching real hallucinations.`);
  }
  if (declineOverreachOrganic > 0.3) {
    lines.push(`- **Decline overreach organic (${(declineOverreachOrganic * 100).toFixed(1)}%).** Sonnet declines too many valid organic groups. Soften the \`<no_post/>\` instruction.`);
  }
  if (declineAccuracyAdversarial < 0.6) {
    lines.push(`- **Decline accuracy adversarial (${(declineAccuracyAdversarial * 100).toFixed(1)}%) below 60%.** Sonnet misses fake arcs → predicts production problems with low-cohesion groups not caught by Capa 3.5.`);
  }
  if (lines[lines.length - 1] === '') {
    lines.push('- (none)');
  }
  lines.push('');

  lines.push('## Recommendation');
  lines.push('');
  if (organicPoolWarning) {
    lines.push(`> Preliminary recommendation based on reduced sample. Requires re-run with full sample before implementation.`);
    lines.push('');
  }
  lines.push('```');
  lines.push(recommendation);
  lines.push('```');
  lines.push('');

  writeFileSync(join(OUT_DIR, 'analysis-report.md'), lines.join('\n'));
  console.log(`\n[analyze] Report written to ${join(OUT_DIR, 'analysis-report.md')}\n`);
}

main().catch((err) => {
  console.error('[analyze] Unexpected error:', String(err));
  process.exit(1);
});
