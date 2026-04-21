# Spec — Experimento de Medición de Alucinación Fase B

**Versión:** 1.4
**Fecha:** 2026-04-21
**Objetivo:** Obtener tasa base de alucinación en posts de síntesis antes de implementar Fase B. Termina con una recomendación automática: (a) ship Fase B tal cual, (b) ship con anclaje end-to-end, o (c) rediseñar síntesis.
**Destinatario:** IA que implementa. No modifica código de producción. Solo crea archivos nuevos e importa el repo principal read-only.

> **Regla de integridad:** toda cita de código existente debe incluir `file_path:line_number`. Cualquier regex, firma o constante que se presente como "actual" y no tenga referencia explícita es sospechosa de fabricación. Verificar leyendo el archivo antes de citarlo.

---

## 1. Scope

### Sí
- Reconstruir el commit stream real de los autores candidatos desde **git local**, no desde voice_posts.
- Ejecutar los 24 módulos del pipeline **localmente** sobre cada commit (sin LLM) para poblar un banco de señales simulado.
- Seleccionar 20-30 grupos FOCAL/ARCO candidatos desde ese banco — lo que Fase B vería en producción.
- Simular Haiku Capa 2 + Sonnet Capa 4 sobre cada grupo usando el `voice_profile` real del autor.
- Pre-labeling estructural con Haiku (modelo distinto al generador Sonnet).
- Generar markdown para labeling humano por Liliana.
- Persistir todo en SQLite local.

### No
- **No escribe a Supabase producción.** Todas las queries son `SELECT`.
- No hace `git fetch` / `git pull` automático — se respeta el estado local.
- No clona repos automáticamente — los que falten se loguean como skipped.
- No publica a Buffer.
- No modifica `src/analysis/pipeline.ts`, módulos, ni ningún archivo del repo principal — solo importa `MODULE_REGISTRY` y types read-only.
- No usa perfiles de voz sintéticos/genéricos — grupos sin perfil real se descartan.
- No corre `runPipeline()` directo — filtra score ≥ 5 y necesitamos 1-10.

---

## 2. Estructura de archivos

```
experiments/synthesis-hallucination-baseline/
├── README.md
├── db/
│   ├── experiment.db                  (SQLite, gitignored)
│   ├── schema.sql
│   ├── author-emails.json             (cache de emails por autor, gitignored)
│   ├── voice-profiles-cache.json      (gitignored)
│   └── resample-manifest.json         (HEAD sha de cada repo escaneado)
├── src/
│   ├── preflight.ts
│   ├── resample-signals.ts
│   ├── select-groups.ts
│   ├── generate-synthesis.ts
│   ├── prelabel.ts
│   ├── export-for-labeling.ts
│   ├── analyze-results.ts
│   ├── lib/
│   │   ├── anthropic-client.ts
│   │   ├── supabase-readonly.ts
│   │   ├── git-local.ts
│   │   ├── split-claims.ts
│   │   ├── logger-shim.ts
│   │   └── types.ts
│   └── prompts/
│       ├── haiku-signal-extract.ts
│       ├── sonnet-synthesize.ts
│       └── haiku-prelabel.ts
├── config/
│   └── authors.json                   (lista de autores a incluir, exclusiones)
├── out/
│   ├── for-labeling/                  (markdown editable por Liliana)
│   ├── NEXT-STEP.md                   (al terminar export)
│   └── analysis-report.md             (al terminar analyze)
└── package.json
```

**Scripts npm:**
- `npm run preflight`
- `npm run resample` — fetch git local + correr módulos → `simulated_signals` + `commit_cache`
- `npm run resample:stats` — imprime distribución sin escribir, para sanity check
- `npm run select`
- `npm run generate`
- `npm run prelabel`
- `npm run export`
- `npm run analyze` (solo tras labeling humano)

**Variables de entorno requeridas:**
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — readonly, solo para `voice_profiles` y `voice_posts.distinct repos`
- `REPOS_ROOT` — ruta base de repos locales (default `~/Documents/git/`)

---

## 3. Modelo de datos (SQLite)

```sql
-- Cache de commits extraídos de git local
CREATE TABLE commit_cache (
  commit_sha     TEXT PRIMARY KEY,
  repo           TEXT NOT NULL,           -- 'owner/repo'
  author_login   TEXT,
  author_email   TEXT,
  commit_date    TIMESTAMP NOT NULL,
  commit_message TEXT NOT NULL,
  commit_body    TEXT,
  diff_json      TEXT NOT NULL,           -- JSON array de FileDiff (mismo shape que AnalysisContext.diffs)
  languages_json TEXT NOT NULL,           -- JSON array de strings
  files_count    INTEGER,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_cc_author_date ON commit_cache(author_login, commit_date);
CREATE INDEX idx_cc_repo_date   ON commit_cache(repo, commit_date);

-- Findings crudos de los 24 módulos (score 1-10, sin filtro)
CREATE TABLE simulated_signals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_sha      TEXT NOT NULL REFERENCES commit_cache(commit_sha),
  repo            TEXT NOT NULL,
  author_login    TEXT NOT NULL,
  tenant_id       TEXT,
  module_id       TEXT NOT NULL,          -- AnalysisCategory (topic)
  finding_score   INTEGER NOT NULL,       -- 1-10 raw
  finding_text    TEXT,                   -- aspect + finding para debugging
  commit_date     TIMESTAMP NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(commit_sha, module_id)
);
CREATE INDEX idx_sig_grouping ON simulated_signals(author_login, repo, module_id, commit_date);

-- Grupos seleccionados para la simulación de Fase B
CREATE TABLE synthesis_groups (
  id                TEXT PRIMARY KEY,
  author_login      TEXT NOT NULL,
  tenant_id         TEXT,
  repo              TEXT NOT NULL,
  topic             TEXT NOT NULL,
  variant           TEXT NOT NULL,        -- 'FOCAL' | 'ARCO' | 'SINGLE'
  origin            TEXT NOT NULL,        -- 'organic' | 'adversarial' | 'control'
  coherence_score   REAL,
  commit_shas       TEXT NOT NULL,        -- JSON array
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Señales que Haiku extrae por commit del grupo (Capa 2 simulada)
CREATE TABLE weak_signals (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id          TEXT NOT NULL REFERENCES synthesis_groups(id),
  commit_sha        TEXT NOT NULL,
  haiku_raw         TEXT NOT NULL,        -- JSON output crudo
  topic             TEXT,
  strength          INTEGER,
  pattern_kind      TEXT,                 -- NULL permitido
  affected_symbols  TEXT,
  specific_change   TEXT,
  evidence_snippet  TEXT
);

-- Posts generados por Sonnet (Capa 4 simulada)
CREATE TABLE synthesis_posts (
  group_id          TEXT PRIMARY KEY REFERENCES synthesis_groups(id),
  sonnet_input      TEXT NOT NULL,
  sonnet_output     TEXT NOT NULL,
  declined          INTEGER NOT NULL DEFAULT 0,  -- 1 si Sonnet devolvió <no_post/>
  claim_count       INTEGER NOT NULL DEFAULT 0,  -- 0 si declined=1
  cost_usd          REAL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pre-labels estructurales (Haiku distinto al generador)
CREATE TABLE prelabels (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id          TEXT NOT NULL REFERENCES synthesis_groups(id),
  claim_index       INTEGER NOT NULL,
  claim_text        TEXT NOT NULL,
  structural_check  TEXT NOT NULL,        -- grounded | symbol_not_in_diff | number_not_in_diff | file_not_in_diff | frame | needs_human
  evidence          TEXT
);

-- Labels humanos (Liliana)
CREATE TABLE human_labels (
  group_id          TEXT NOT NULL REFERENCES synthesis_groups(id),
  claim_index       INTEGER NOT NULL,
  label             TEXT NOT NULL,        -- grounded | plausible_unsupported | contradicted | irrelevant | frame
  notes             TEXT,
  PRIMARY KEY(group_id, claim_index)
);

CREATE TABLE post_level_labels (
  group_id          TEXT PRIMARY KEY REFERENCES synthesis_groups(id),
  publish_readiness TEXT,                 -- publish_asis | light_edit | rewrite | discard
  decline_judgment  TEXT,                 -- correct | incorrect | ambiguous (solo declined=1)
  distrust_reason   TEXT
);
```

---

## 4. `config/authors.json` — pool de autores

Archivo editable, versionado. Plantilla inicial:

```json
{
  "included": ["lilicurl", "Khalzz", "odtorres", "korutx"],
  "excluded": [
    { "login": "vialabs-net", "reason": "service account, no representative of Fase B use case" }
  ],
  "korutx_coverage_note": "microboxlabs/modulariot repos are not cloned locally. Accept partial coverage or clone before running."
}
```

`preflight.ts` lee este archivo. Si algún autor incluido no tiene `voice_profile` en Supabase ni ≥10 commits locales, abortar con detalle.

---

## 5. Preflight (`src/preflight.ts`)

### Verificaciones en orden

1. **Env vars presentes:** `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REPOS_ROOT`. Falta alguna → abort.

2. **Herramientas locales:** `git --version` disponible. `REPOS_ROOT` existe y es directorio.

3. **Supabase readonly OK:** probar `SELECT 1 FROM voice_profiles LIMIT 1`. Documentar que ninguna query posterior usará INSERT/UPDATE/DELETE.

4. **Schema checks via `information_schema.columns` antes de cualquier query de datos:**
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'voice_profiles'
     AND column_name IN ('tenant_id', 'github_author_login');
   ```
   < 2 filas → abort: "voice_profiles schema no coincide. Verificar proyecto Supabase."

   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'voice_posts'
     AND column_name IN ('author_login', 'repo', 'commit_sha');
   ```
   < 3 filas → abort similar.

5. **Perfiles de voz disponibles para los autores incluidos:** para cada `login` en `config/authors.json#included`:
   ```sql
   SELECT tenant_id FROM voice_profiles
   WHERE github_author_login = :login
   ORDER BY updated_at DESC LIMIT 1;
   ```
   Si algún autor no retorna fila → abort: "Autor {login} sin voice_profile. Excluirlo de config/authors.json o onboard."
   Cachear resultado en `db/voice-profiles-cache.json`.

6. **Author emails discovery:** para cada autor, ejecutar una vez:
   ```bash
   git -C $REPO log --all --format='%an <%ae>' | sort -u | grep -i $LOGIN
   ```
   sobre cualquier repo que sepamos contiene sus commits (query a `voice_posts` para descubrir repos). Cachear en `db/author-emails.json`. Si 0 emails descubiertos para algún autor → abort con mensaje accionable.

7. **Repos locales disponibles:** query distinct repos de `voice_posts` últimos 120d para los autores incluidos. Para cada `owner/repo`, verificar que `$REPOS_ROOT/$repo` existe. Loguear tabla:
   ```
   REPO                          LOCAL     AUTOR(ES) CON COMMITS EN 120D
   vialabs-net/idauto-crm        ✓         lilicurl, Khalzz
   vialabs-net/scrappers         ✓         lilicurl
   microboxlabs/modulariot       ✗ skip    korutx
   ```
   Si un autor queda con 0 repos locales cubriéndolo → abort con mensaje explícito listando qué clonar.

Guardar resultado completo en `db/preflight-report.json`.

---

## 6. Resample signals (`src/resample-signals.ts`)

### Lógica

1. **Manifest:** para cada repo local, registrar `{ repo, head_sha, head_date, run_started_at }` en `db/resample-manifest.json`. **No `git fetch`** — estado local es la base.

2. **Listar commits por autor** usando emails del cache:
   ```bash
   cd $REPOS_ROOT/$REPO
   git log \
     --author="<login>@" --author="<login> <" \
     $(for email in $emails; do echo "--author=<$email>"; done) \
     --since="120 days ago" \
     --format='%H|%aI|%an|%ae|%s'
   ```
   Emails del cache previenen false-positives del `--author=<login>` substring.

3. **Por cada commit nuevo** (no en `commit_cache`):
   - `git show --unified=3 --stat --format='%H%n%aI%n%an%n%ae%n%s%n%b%n---BODY_END---' $SHA`
   - Parsear output en formato de `FileDiff[]` (mismo shape que `src/analysis/diff-parser.ts` produce). Truncar patches a 150 líneas para match del config de producción.
   - Detectar `languages` desde extensiones de archivos.
   - Insert en `commit_cache`.

4. **Por cada commit en `commit_cache` sin señales en `simulated_signals`:**
   - Construir `AnalysisContext` (diffs, commitMessage, commitBody, languages, repo, sha).
   - Importar `MODULE_REGISTRY` de `src/analysis/modules/index.js` (repo principal, read-only).
   - **Loop directo sobre módulos** (no `runPipeline()` — filtra ≥ 5):
     ```typescript
     for (const mod of MODULE_REGISTRY) {
       if (mod.applicableLanguages &&
           !mod.applicableLanguages.some(l => ctx.languages.includes(l))) continue;
       const result = await mod.analyze(ctx);
       if (result === null) continue;
       // Insert en simulated_signals con finding_score = result.interestScore (1-10)
     }
     ```
   - Si algún módulo importa `../utils/logger.js`, usar shim en `lib/logger-shim.ts` (no-op).

5. **Modo `--stats`:** no escribir; imprimir:
   ```
   Commits escaneados:           N
   Commits con ≥ 1 finding:      M  (X%)
   Distribución de scores:       {1: a, 2: b, ..., 10: z}
   Buckets (author, repo, topic) con ≥ 3 signals en ventana 21d: K
   Buckets multi-topic cohesivos (Jaccard archivos ≥ 0.3): L
   ```
   Liliana decide si K ≥ 15 (modo normal) o K < 15 (modo reducido) antes de correr `select-groups`.

---

## 7. Select groups (`src/select-groups.ts`)

### Organic FOCAL

```sql
WITH windowed AS (
  SELECT author_login, repo, module_id,
         commit_sha, commit_date,
         LAG(commit_date, 2) OVER (
           PARTITION BY author_login, repo, module_id
           ORDER BY commit_date
         ) AS third_oldest_in_window
  FROM simulated_signals
  WHERE commit_date > datetime('now', '-120 days')
)
SELECT author_login, repo, module_id,
       GROUP_CONCAT(commit_sha) as shas,
       COUNT(*) as n,
       MIN(commit_date) as win_start,
       MAX(commit_date) as win_end
FROM windowed
WHERE third_oldest_in_window IS NOT NULL
  AND julianday(commit_date) - julianday(third_oldest_in_window) <= 21
GROUP BY author_login, repo, module_id
HAVING n >= 3;
```

Cada fila = 1 candidato FOCAL. `variant='FOCAL'`, `origin='organic'`.

### Organic ARCO

Grupos de ≥ 4 commits del mismo autor tocando ≥ 3 topics distintos en ventana 21d **y** con Jaccard de archivos ≥ 0.3 entre commits del cluster (implementar inline ~30 líneas — reusar la heurística de §8 del spec principal v2.5.1).

### Adversarial

- **3 FOCAL adversarial:** 3 commits del mismo topic, mismo autor, Jaccard de archivos = 0 (topics "iguales" pero archivos completamente distintos).
- **2 ARCO adversarial:** 4-5 commits con Jaccard de archivos alto pero topics aleatorios no relacionados.

### Control

Commits individuales donde **el pipeline en producción hubiera disparado** gatillador 1 o 2:
```sql
SELECT commit_sha, repo, author_login, module_id, MAX(finding_score) as top_score
FROM simulated_signals
WHERE finding_score >= 5
  AND commit_date > datetime('now', '-120 days')
  AND author_login IN (<autores incluidos>)
GROUP BY commit_sha
ORDER BY RANDOM()
LIMIT 5;
```
`variant='SINGLE'`, `origin='control'`.

### Target y modo reducido

```
total_organic ≥ 15           → modo normal: 20 orgánicos + 5 adversariales + 5 control = 30
6 ≤ total_organic < 15       → modo reducido: todos los orgánicos + 3 adversariales + 3 control
total_organic < 6            → abort: "insuficiente historia. Esperar más data o ampliar pool de autores"
```

Sin extender ventana a 180d — el commit stream completo ya está disponible. Si falta, falta.

Insert en `synthesis_groups`. Imprimir resumen por variant/origin.

---

## 8. Generación de síntesis (`src/generate-synthesis.ts`)

### Por cada grupo `FOCAL`/`ARCO`

**Paso A — extracción de señales (Haiku):**

Para cada commit del grupo, leer diff de `commit_cache.diff_json`. Prompt `prompts/haiku-signal-extract.ts`:

```
SYSTEM: You extract structured weak signals from a code diff for downstream analysis.
Return JSON matching this schema. If the diff is trivial (whitespace, rename, auto-format),
return exactly {"trivial": true}.

{
  "topic": "<one of the 24 categories>",
  "strength": 1-10,
  "pattern_kind": "new_abstraction"|"contract_change"|"semantic_refactor"|"config_change"|"dependency_update"|"behavioral_change"|null,
  "affected_symbols": ["verbatim_from_diff", ...],
  "specific_change": "one-sentence, max 120 chars, cite concrete elements"
}

Rules:
- If pattern_kind does not cleanly fit, return null (do NOT force a category).
- affected_symbols must be verbatim from the diff. Do not invent.
- specific_change must cite concrete elements present in the diff.

USER: <commit_message>...</commit_message><diff>...</diff>
```

Persistir en `weak_signals`. Guardar `evidence_snippet` = primeras 6 líneas `+` del primer hunk no trivial del diff.

**Paso B — síntesis (Sonnet):**

Cargar `voice_profile` del autor desde `voice-profiles-cache.json`. Construir system prompt reusando `buildSystemPrompt()` de `src/ai/prompt-builder.ts` (read-only import). User prompt según variante:

**FOCAL:**
```xml
<commit_series>
  <commit date="..." sha="..." message="..." repo="...">
    <signal topic="..." strength="..." pattern_kind="...">
      <description>specific_change de Haiku</description>
      <evidence>
        <!-- 6 líneas del diff raw -->
      </evidence>
    </signal>
  </commit>
  ...
</commit_series>
<synthesis_task>
  Write a post about what this developer did in [topic] across N commits
  spanning X days. Focus on depth and quality in this single area.
  Every factual claim in your post must be traceable to a commit above.
  If you cannot write a post anchored to the commits, return <no_post/>.
</synthesis_task>
```

**ARCO:** idéntico pero con `<coherence_evidence><shared_files>...</shared_files><span_days>...</span_days></coherence_evidence>` antes del task; task menciona "the arc spanning [topics]".

**Manejo de `<no_post/>`:** si `sonnet_output` es `<no_post/>` exacto o lo contiene como única salida no-whitespace, persistir con `declined=1`, `claim_count=0`.

**Persistencia normal:** `sonnet_input`, `sonnet_output`, `declined=0`, `claim_count`, `cost_usd` en `synthesis_posts`.

### Grupos `SINGLE` (control)

Reutilizar `src/ai/post-generator.ts` tal cual, con el diff cargado de `commit_cache`. Persistir en `synthesis_posts` con mismo esquema.

### División en claims (`src/lib/split-claims.ts`)

Multi-paso para tolerar oraciones cortas con saltos de línea y evitar split en abreviaturas:

```typescript
function splitClaims(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const claims: string[] = [];
  for (const para of paragraphs) {
    const parts = para.split(/(?<=[.!?])\s+(?=[A-Z])/);
    claims.push(...parts.map(s => s.trim()).filter(Boolean));
  }
  return claims.filter(c => c.split(/\s+/).length > 3);
}
```

`claim_index` asignado por orden de aparición.

---

## 9. Pre-labeling (`src/prelabel.ts`)

**Modelo: Haiku**, distinto al generador. Skip posts con `declined=1`.

Prompt `prompts/haiku-prelabel.ts`:

```
SYSTEM: You verify whether a claim about code is structurally supported by the diff.

Return ONE of:
- grounded: every named symbol, file path, and number in the claim appears in the diff or commit message.
- symbol_not_in_diff: the claim names a function/class/variable NOT in the diff.
- number_not_in_diff: specific number (timeout, line count, etc.) not present.
- file_not_in_diff: file path named not in the diff.
- frame: stylistic/narrative, no verifiable factual content.
- needs_human: structural elements check out, but semantic claim ("intent", "to prepare for", "because X")
               cannot be verified from diff alone.

Do NOT interpret whether the claim is true — only whether its structural elements exist.

USER: <claim>...</claim><diffs>...</diffs><commit_messages>...</commit_messages>

OUTPUT JSON: {"check": "...", "evidence": "short explanation"}
```

Persistir en `prelabels`.

---

## 10. Export para labeling humano (`src/export-for-labeling.ts`)

Un markdown por grupo en `out/for-labeling/`. **Orden aleatorizado.** Archivos `post-001.md`, `post-002.md`, ... Mapa en `out/for-labeling/_mapping.json` (no visible a Liliana).

### Plantilla — posts normales (`declined=0`)

```markdown
# Post 001

## Post generado

> <sonnet_output>

## Commits de origen

### Commit 1: <sha[:7]>
**Message:** ...
**Diff:**
\`\`\`diff
<patch>
\`\`\`

<repetir por cada commit>

## Claims a labelar

Opciones: `grounded` | `plausible_unsupported` | `contradicted` | `irrelevant` | `frame`

| # | Claim | Pre-label (LLM) | Tu label | Notas |
|---|-------|-----------------|----------|-------|
| 0 | <claim_0> | grounded | | |
| 1 | <claim_1> | needs_human | | |

## Post-level

- **Publish readiness:** [ ] publish_asis [ ] light_edit [ ] rewrite [ ] discard
- **¿Qué te haría desconfiar del post?** _______
```

### Plantilla — posts declinados (`declined=1`)

```markdown
# Post XXX — Sonnet declinó anclar

Sonnet recibió este grupo y devolvió `<no_post/>`. No hay claims.

## Commits de origen
<commits + diffs>

## Evaluación del rechazo

¿El rechazo fue correcto?
- [ ] sí, estos commits no eran un arco real — Sonnet acertó en declinar
- [ ] no, había material válido para síntesis — Sonnet fue demasiado conservador
- [ ] ambiguo — explicar abajo

Razón: _______
```

Al terminar, escribir `out/NEXT-STEP.md` y echo a consola:

```
========================================
NEXT STEP — ACCIÓN REQUERIDA POR LILIANA
========================================

Se generaron N archivos en:
  experiments/synthesis-hallucination-baseline/out/for-labeling/
  (K son posts declinados por Sonnet — formato distinto)

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
```

La IA implementadora **no** corre `analyze`.

---

## 11. Análisis (`src/analyze-results.ts`)

Parsear markdown editado, persistir en `human_labels` y `post_level_labels`.

### Métricas

**Posts normales (declined=0):**

- **Per-post contamination rate:** `|{publish_readiness ∈ {rewrite, discard} AND (≥1 contradicted OR ≥2 plausible_unsupported)}| / total_normal_posts`. Breakdown por `origin` y `variant`.

- **Per-claim hallucination rate:** `(plausible_unsupported + contradicted + irrelevant) / (total_claims - frame_claims)`.

- **Fase B vs control:** `contamination_rate(FOCAL+ARCO organic) - contamination_rate(SINGLE)`.

**Posts declinados (declined=1):**

- **decline_accuracy_adversarial:** `|{origin='adversarial' AND decline_judgment='correct'}| / |{origin='adversarial' AND declined=1}|`. Esperamos alto.
- **decline_overreach_organic:** `|{origin='organic' AND decline_judgment='incorrect'}| / |{origin='organic' AND declined=1}|`. Esperamos bajo.

**Pre-label (solo posts normales):**

- **prelabel_structural_accuracy:** el pre-labeler verifica presencia estructural, no intención. Un `grounded` correcto es compatible con `plausible_unsupported` humano (símbolos presentes, intención inverificable).
  ```
  grounded_match  = count(prelabel='grounded' AND human ∈ {grounded, plausible_unsupported, frame})
  negative_match  = count(prelabel ∈ {symbol_not_in_diff, number_not_in_diff, file_not_in_diff}
                          AND human ∈ {contradicted, irrelevant})
  total           = count(prelabel NOT IN ('needs_human', 'frame'))
  structural_accuracy = (grounded_match + negative_match) / total
  ```

- **prelabel_escalation_quality:**
  ```
  escalation_correct = count(prelabel='needs_human' AND human ∈ {plausible_unsupported, contradicted})
  escalation_total   = count(prelabel='needs_human')
  escalation_quality = escalation_correct / escalation_total
  ```

### Reporte `out/analysis-report.md`

0. **Nota de muestra:** si `total_organic < 15`, incluir al principio:
   > "⚠️ Muestra reducida (N orgánicos). Resultados direccionales, no concluyentes. Re-correr con ≥ 15 orgánicos antes de decisión final."
1. Tabla resumen (6-8 números clave).
2. Breakdown por origin/variant.
3. Tabla de decline (esperado vs observado orgánicos/adversariales).
4. 5 ejemplos concretos: 2 mejores, 2 peores, 1 adversarial declinado correctamente.
5. Recomendación automática (§12).

---

## 12. Criterios de decisión (emitidos por el reporte)

```
per_post_contamination = contamination_rate(origin='organic', declined=0)

if per_post_contamination < 0.15:
    "SHIP FASE B as specified. Add only pattern_kind=null escape in Haiku."
elif per_post_contamination <= 0.40:
    "MANDATORY: end-to-end evidence anchoring in Capa 4 prompt + forced citation.
     Re-run experiment with 10 additional organic groups after implementation."
else:
    "REDESIGN: synthesis as generative step is not viable at this rate.
     Consider deterministic template over signals or drop Fase B."
```

**Muestra reducida (N < 15):** los 3 criterios son **direccionales, no definitivos**. Imprimir:
> "Recomendación preliminar: <X>. Requiere re-run con muestra completa antes de implementar."

**Warnings adicionales:**

- `prelabel_structural_accuracy < 0.85` OR `prelabel_escalation_quality < 0.5`:
  > "LLM pre-label no es confiable. En re-runs no se puede recortar tiempo humano hasta mejorar el prompt de pre-label."

- `decline_overreach_organic > 0.3`:
  > "Sonnet declina demasiados grupos orgánicos válidos. Considerar suavizar la instrucción `<no_post/>`."

- `decline_accuracy_adversarial < 0.6`:
  > "Sonnet no detecta arcos fantasma en adversariales. Predice problemas en producción con grupos de baja cohesión no detectados por Capa 3.5."

---

## 13. Invariantes y guardrails

- **Supabase readonly:** `src/lib/supabase-readonly.ts` envuelve el cliente oficial, expone `.select()` e intercepta `.insert/.update/.delete` tirando excepción. El cliente nunca se instancia con escritura.
- **No tocar código de producción:** importar módulos del repo principal como read-only. Si algún import transitivo falla (p.ej. `logger.js`), crear shim local en `lib/logger-shim.ts`.
- **No publicar a Buffer:** linter opcional que rechaza `import '.*/src/buffer/.*'`.
- **Cap de costos:** $5 USD total. Cada script tracks `cost_usd` acumulado y aborta si lo cruza.
- **Idempotencia:** cada script detecta trabajo ya hecho y lo salta (por `commit_sha`, `group_id`, etc.).
- **Dry-run:** cada script acepta `--dry-run` que imprime qué haría.
- **Sin `git fetch` automático:** manifest graba HEAD sha al inicio. Para datos más frescos, Liliana hace pull manual antes del run.

---

## 14. Orden de ejecución

1. Crear la estructura de §2 completa.
2. Implementar en este orden: `preflight → resample-signals → select-groups → generate-synthesis → prelabel → export-for-labeling → analyze-results`.
3. `package.json` con scripts npm.
4. `README.md` breve con precondiciones (env vars, `config/authors.json`, acceso readonly, `REPOS_ROOT`).
5. Correr:
   ```
   npm run preflight
   npm run resample
   npm run resample:stats     # sanity check antes de continuar
   npm run select
   npm run generate
   npm run prelabel
   npm run export
   ```
6. Al terminar `export`, se imprime y escribe `NEXT-STEP.md`.
7. **No correr `analyze`** — depende de labeling humano.

---

## 15. Decisiones resueltas

| Decisión | Resolución |
|---|---|
| Sampling frame | Commit stream completo desde git local + 24 módulos ejecutados localmente. No voice_posts. |
| Perfiles de voz | Reales desde Supabase `voice_profiles` (readonly). Grupos sin perfil se descartan. |
| Fetch git | No auto-fetch. Estado local + HEAD sha registrado en manifest. |
| Repos faltantes | Log como skipped. No cloneo automático. |
| Autores excluidos | `vialabs-net` (service account, no representativo). `korutx` entra con coverage parcial si `microboxlabs/modulariot` no están localmente — documentar en reporte final. |
| Matcheo de autor en git log | Emails descubiertos en preflight (cache `author-emails.json`) + patrón `--author="<login>@" --author="<login> <"`. |
| Invocación de módulos | Loop directo sobre `MODULE_REGISTRY`, no `runPipeline()` (filtra ≥ 5). |
| Control | Commits con `MAX(finding_score) ≥ 5` en `simulated_signals`, random 5. Proxy válido del path actual. |
| Threshold muestra | `< 6 orgánicos → abort`. `6-14 → modo reducido con caveat`. `≥ 15 → normal`. |
| `<no_post/>` | Flag `declined`, plantilla alternativa, métricas `decline_accuracy_*`. |
| Claim splitting | Multi-paso: párrafos → puntuación + mayúscula. |
| `prelabel_structural_accuracy` | `grounded` match incluye `plausible_unsupported` humano (correcto estructuralmente aunque inverificable semánticamente). |

---

## 16. Entregables finales

Tras `npm run analyze`:

- `out/analysis-report.md` — recomendación automática.
- `db/experiment.db` — datos crudos auditables.
- `out/for-labeling/*.md` — labels humanos (historial).

Ese paquete es la entrada de la siguiente conversación: ship Fase B según spec v2.5.1, ship con anclaje reforzado, o rediseñar.

---

## 17. Cambios v1.0 → v1.4

| Área | v1.0 | v1.4 |
|---|---|---|
| Backend | Opcional sqlite/supabase | Supabase readonly + git local, ambos requeridos |
| Sampling frame | `voice_posts` filtrado por `top_module_id` | Commit stream completo de git local + módulos ejecutados localmente |
| Perfiles de voz | Permitía perfil genérico | Solo perfil real de producción, obligatorio |
| Preflight | No existía | Paso 0 con schema checks via `information_schema`, repos locales, emails discovery |
| Pool de autores | Implícito | `config/authors.json` con includes/excludes explícitos (vialabs-net excluido por defecto) |
| Invocación pipeline | Ambiguo ("dry-run") | Loop directo sobre `MODULE_REGISTRY` (no `runPipeline`, que filtra ≥ 5) |
| `<no_post/>` | Sin especificar | Flag `declined`, plantilla alternativa, métricas de decline |
| Claim splitting | Regex ingenuo | Multi-paso (párrafos → puntuación + mayúscula) |
| Pre-label metric | Taxonomías mezcladas | `structural_accuracy` + `escalation_quality` con mapping explícito; `plausible_unsupported` humano cuenta como match de `grounded` LLM |
| Modo reducido | No existía | `< 6 → abort`, `6-14 → reducido con caveat`, `≥ 15 → normal` |
| Control | "pipeline dry-run" (no existe) | Commits de `simulated_signals` con `MAX(finding_score) ≥ 5`, random 5 |
| Manifest | No existía | `db/resample-manifest.json` con HEAD sha por repo |

---

**Precondición antes de correr:** confirmar que `SUPABASE_SERVICE_ROLE_KEY` está en el entorno, `REPOS_ROOT` apunta a los clones locales, y `config/authors.json` refleja la decisión sobre korutx (parcial o excluido). El wrapper readonly es salvaguarda técnica; la política es humana: **nada escribe a producción durante este experimento**.