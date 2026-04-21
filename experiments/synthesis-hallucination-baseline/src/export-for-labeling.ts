import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { openDb } from './lib/db.js';
import { splitClaims } from './lib/split-claims.js';
import type { FileDiff } from '../../../src/analysis/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../out');
const LABEL_DIR = join(OUT_DIR, 'for-labeling');

interface GroupRow {
  id: string;
  author_login: string;
  repo: string;
  topic: string;
  variant: string;
  origin: string;
  commit_shas: string;
}

interface PostRow {
  group_id: string;
  sonnet_output: string;
  declined: number;
}

interface PrelabelRow {
  claim_index: number;
  structural_check: string;
}

interface CommitRow {
  commit_sha: string;
  commit_message: string;
  commit_body: string | null;
  diff_json: string;
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function fenced(lang: string, body: string): string {
  return '```' + lang + '\n' + body + '\n```';
}

async function main(): Promise<void> {
  const db = openDb();

  const groups = db
    .prepare(`SELECT id, author_login, repo, topic, variant, origin, commit_shas FROM synthesis_groups`)
    .all() as GroupRow[];
  const posts = db
    .prepare(`SELECT group_id, sonnet_output, declined FROM synthesis_posts`)
    .all() as PostRow[];
  const postByGroup = new Map(posts.map((p) => [p.group_id, p]));

  const eligible = groups.filter((g) => postByGroup.has(g.id));
  if (eligible.length === 0) {
    console.error('[export] No groups have synthesis_posts. Run npm run generate first.');
    process.exit(1);
  }

  const shuffled = shuffle(eligible);

  mkdirSync(LABEL_DIR, { recursive: true });

  const mapping: Array<{ file: string; group_id: string; origin: string; variant: string }> = [];

  let declinedCount = 0;
  let normalCount = 0;

  for (let idx = 0; idx < shuffled.length; idx++) {
    const group = shuffled[idx]!;
    const post = postByGroup.get(group.id)!;
    const shas = JSON.parse(group.commit_shas) as string[];
    const commits = db
      .prepare(`SELECT commit_sha, commit_message, commit_body, diff_json FROM commit_cache WHERE commit_sha IN (${shas.map(() => '?').join(',')})`)
      .all(...shas) as CommitRow[];

    const num = String(idx + 1).padStart(3, '0');
    const filename = `post-${num}.md`;

    const commitsBlock = commits
      .map((c, i) => {
        const diffs = JSON.parse(c.diff_json) as FileDiff[];
        const patches = diffs
          .map((d) => `--- ${d.filename}\n${d.patch}`)
          .join('\n\n');
        return `### Commit ${i + 1}: ${c.commit_sha.slice(0, 7)}
**Message:** ${c.commit_message.split('\n')[0]}
${c.commit_body ? `\n**Body:**\n${c.commit_body}\n` : ''}
**Diff:**
${fenced('diff', patches)}`;
      })
      .join('\n\n');

    let body: string;

    if (post.declined === 1) {
      declinedCount++;
      body = `# Post ${num} — Sonnet declinó anclar

Sonnet recibió este grupo y devolvió \`<no_post/>\`. No hay claims.

## Commits de origen

${commitsBlock}

## Evaluación del rechazo

¿El rechazo fue correcto?
- [ ] sí, estos commits no eran un arco real — Sonnet acertó en declinar
- [ ] no, había material válido para síntesis — Sonnet fue demasiado conservador
- [ ] ambiguo — explicar abajo

Razón: _______
`;
    } else {
      normalCount++;
      const claims = splitClaims(post.sonnet_output);
      const prelabels = db
        .prepare(`SELECT claim_index, structural_check FROM prelabels WHERE group_id = ? ORDER BY claim_index`)
        .all(group.id) as PrelabelRow[];
      const prelabelByIndex = new Map(prelabels.map((p) => [p.claim_index, p.structural_check]));

      const tableRows = claims
        .map((claim, i) => {
          const pre = prelabelByIndex.get(i) ?? 'needs_human';
          const escaped = claim.replace(/\|/g, '\\|').slice(0, 200);
          return `| ${i} | ${escaped} | ${pre} | | |`;
        })
        .join('\n');

      body = `# Post ${num}

## Post generado

> ${post.sonnet_output.split('\n').join('\n> ')}

## Commits de origen

${commitsBlock}

## Claims a labelar

Opciones: \`grounded\` | \`plausible_unsupported\` | \`contradicted\` | \`irrelevant\` | \`frame\`

| # | Claim | Pre-label (LLM) | Tu label | Notas |
|---|-------|-----------------|----------|-------|
${tableRows}

## Post-level

- **Publish readiness:** [ ] publish_asis [ ] light_edit [ ] rewrite [ ] discard
- **¿Qué te haría desconfiar del post?** _______
`;
    }

    writeFileSync(join(LABEL_DIR, filename), body);
    mapping.push({ file: filename, group_id: group.id, origin: group.origin, variant: group.variant });
  }

  writeFileSync(join(LABEL_DIR, '_mapping.json'), JSON.stringify(mapping, null, 2));

  const nextStep = `========================================
NEXT STEP — ACCIÓN REQUERIDA POR LILIANA
========================================

Se generaron ${shuffled.length} archivos en:
  experiments/synthesis-hallucination-baseline/out/for-labeling/
  (${declinedCount} son posts declinados por Sonnet — formato distinto)

Liliana debe:
  1. Abrir cada post-XXX.md (aleatorizados; no abrir en orden).
  2. Posts normales: llenar "Tu label" por claim y marcar publish_readiness.
  3. Posts declinados: marcar si el rechazo fue correcto.
  4. Guardar.

Tiempo estimado: ~2 horas. Pre-label reduce carga — claims marcados
grounded/frame por LLM requieren menos esfuerzo.

Cuando termine TODOS:
  npm run analyze
========================================
`;

  writeFileSync(join(OUT_DIR, 'NEXT-STEP.md'), nextStep);
  console.log(nextStep);
  console.log(`Wrote ${normalCount} normal posts + ${declinedCount} declined posts to ${LABEL_DIR}\n`);
}

main().catch((err) => {
  console.error('[export] Unexpected error:', String(err));
  process.exit(1);
});
