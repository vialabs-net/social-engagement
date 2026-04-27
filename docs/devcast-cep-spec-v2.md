# Devcast — Arquitectura de Evaluación de Commits

**Versión:** 2.6.0
**Fecha:** 2026-04-27
**Estado:** Draft — pendiente validación contra código

> **Regla de integridad del spec:** toda sección que cite regex o código `// ANTES` de un archivo existente debe incluir `file_path:line_number` exacto del código "ANTES". Sin esa referencia, el snippet "ANTES" no puede incluirse — puede ser fabricado.

---

## Tabla de contenidos

1. [Problema raíz](#1-problema-raíz)
2. [Patrones arquitectónicos empleados](#2-patrones-arquitectónicos-empleados)
3. [Mejora 0 — Delta-awareness en módulos](#3-mejora-0--delta-awareness-en-módulos)
   3.5. [Mejora 1 — PR-context awareness y anti-authority](#35-mejora-1--pr-context-awareness-y-anti-authority)
   3.6. [Mejora 2 — Idioma del post por perfil de desarrollador](#36-mejora-2--idioma-del-post-por-perfil-de-desarrollador)
4. [Arquitectura de 5 capas en cascada](#4-arquitectura-de-5-capas-en-cascada)
5. [Signal Accumulation con Decay Exponencial](#5-signal-accumulation-con-decay-exponencial)
6. [Refractory Period con Recuperación Exponencial](#6-refractory-period-con-recuperación-exponencial)
7. [Calibración por ritmo de usuario](#7-calibración-por-ritmo-de-usuario)
8. [Routing de coherencia (arco vs posts independientes)](#8-routing-de-coherencia-arco-vs-posts-independientes)
9. [Consumo de señales post-disparo](#9-consumo-de-señales-post-disparo)
10. [Database](#10-database)
11. [Componentes nuevos](#11-componentes-nuevos)
12. [Cambios a archivos existentes](#12-cambios-a-archivos-existentes)
13. [Protección anti-repetición](#13-protección-anti-repetición)
    - [Scheduling — 1 post/día/destino](#scheduling--1-postdíadestino)
14. [Costos por commit](#14-costos-por-commit)
15. [Orden de implementación](#15-orden-de-implementación)
16. [Verificación end-to-end](#16-verificación-end-to-end)
17. [Changelog vs v1](#17-changelog-vs-v1)

---

## 1. Problema raíz

### Tres ejes de alucinación

El sistema tiene tres fuentes de salida falsa, cada una con una solución distinta:

1. **Delta hallucination** — módulo dispara sobre sustitución mecánica porque solo lee líneas `+`. Solución: delta-awareness en módulos (Mejora 0, §3).
2. **Authority hallucination** — Claude emite juicios editoriales sobre calidad del código sin respaldo en el diff. Ejemplos reales: "this is the correct approach for production systems", "demonstrates senior-level judgment". Ningún juicio de ese tipo puede derivarse de un diff — es relleno semántico. Solución: regla anti-authority en system prompt (Mejora 1, §3.5).
3. **Context blindness** — el pipeline procesa commits de forks sin saber si el trabajo fue integrado upstream, rechazado, o incorporado bajo otro commit. El campo `repo` en el prompt puede mostrar el fork del contributor en lugar del repo upstream. Solución: fork detection + PR lookup (Mejora 1, §3.5).

Los tres ejes son independientes. Delta hallucination afecta el disparo del módulo. Authority hallucination y context blindness afectan el texto generado por Claude. Se implementan en ese orden.

---

### Delta-awareness ausente en módulos

**24 módulos en total.** Solo 1 de ellos compara el patrón en líneas `+` contra líneas `-`:
`dependency-health.ts`. **22 de los 24 tienen vulnerabilidad completa o parcial**: 21 solo leen líneas `+`, más `evolutionary` que solo lee `+` en la mayoría de sus detectores. No pueden
distinguir entre:
 
| Cambio | Líneas `+` | Líneas `-` | Realidad |
|--------|-----------|-----------|----------|
| Patrón genuinamente nuevo | tiene `Promise.all` | no tenía | disparar |
| Sustitución mecánica | mismo patrón, valor distinto | patrón existía | NO disparar |
| Refactor interno | tiene el patrón | también lo tenía | NO disparar |
 
**Ejemplo:** un módulo que busca un patrón en líneas `+` puede disparar sobre una
sustitución mecánica (cambiar `undefined` → `null`) porque el patrón estructural
sigue presente. Claude recibe una categoría abstracta sin código real y rellena el vacío
con lo que conoce del tópico — inventa una historia. Este problema afecta a cualquier
usuario del sistema.
 
**La solución no es añadir capas encima. Es corregir los módulos en el origen.**

> **Qué NO cambia:** `buildSystemPrompt()` con toda la voz, contexto de industria y
> reglas de escritura permanece intacto. Los patrones regex que definen qué es
> interesante no se tocan. Solo cambia la pregunta binaria: "¿este patrón apareció
> por primera vez, o ya existía?" Si el patrón es genuinamente nuevo → dispara igual.


**Estado real de delta-awareness (verificado en código):**
- `dependency-health.ts` — TRUE delta-aware: compara patrones en `+` vs `-`
- `clean-code.ts` — aggregate-based: usa `diff.deletions`/`diff.additions` (no vulnerable a sustitución mecánica, pero tampoco hace comparación regex)
- `evolutionary.ts` — sin delta-awareness en la mayoría de sus detectores (detectDeprecation solo mira líneas `+`)
- Los **21 módulos restantes** — solo líneas `+`, todos vulnerables
**Módulos que necesitan delta-awareness** (22 total: evolutionary + los 21 restantes; más `clean-code` para audit preventivo):
`type-system`, `performance`, `design-patterns`, `security`, `error-resilience`, `complexity`,
`observability`, `concurrency`, `dx`, `integration`, `testing`, `ai-assisted`,
`api-design`, `js-advanced`, `react-patterns`, `devops`, `python-patterns`,
`go-patterns`, `java-patterns`, `elixir-patterns`, `architecture-patterns`,
`evolutionary` (detectores sin delta-awareness).

`clean-code` — audit preventivo: usa agregados `diff.deletions`/`diff.additions`, no regex directo sobre patch. Verificar que ningún detector nuevo en el módulo rompa esa propiedad.
 
## Contexto y motivación
El sistema actual evalúa cada commit de forma independiente: o hay suficiente patrón
sintáctico en ese diff para generar un post, o silencio. Esto descarta dos tipos de
valor real:
 
1. **Developers de commits atómicos** — cada commit es pequeño pero la evolución
   a través de 3-5 commits cuenta una historia arquitectónica completa.
2. **Commits con múltiples hallazgos** — el sistema publica sobre el top finding y
   descarta el resto; ese material podría alimentar posts futuros.
Además, los módulos actuales son matchers de regex: detectan presencia de patrones
sintácticos pero no evalúan intención semántica. Un cambio de `undefined` a `null` en un
contrato de API crítico pasa invisible porque ningún regex lo captura.
 
**Solución:** dos fases en bloqueante estricto.


- **Fase A** (bloqueante): corrección de delta-awareness en origen. Sin esta corrección,
  la Fase B acumula señales espurias y los posts de síntesis tendrán el mismo problema
  de hallucination, solo más elaborado. **No se toca Fase B hasta que Fase A esté
  funcionando y verificada.**
- **Fase B** (solo después de Fase A): arquitectura CEP de 5 capas. Cada capa es más
  cara. Solo se escala cuando la anterior certifica que hay valor real.
**Multi-tenancy (implementado hoy):** cada instalación de la GitHub App es un **`tenants`** row (`tenant_id`). Un humano puede tener varias instalaciones (usuario + org); `voice_posts`, `job_queue`, etc. van con `tenant_id`. Las filas de **`voice_profiles`** siguen siendo por `(tenant_id, github_author_login)` en DDL, pero en **Supabase** la lectura del perfil de un autor con login usa la fila con **máximo `updated_at` entre todos los tenants** (voz materializada por instalación, efecto global al generar). **Fase B** en este documento usa `tenant_id` + `github_author_login` (no `user_id`/`org_id` ni `auth.users`) para alinearse con el producto real.

### Qué NO cambia

`buildSystemPrompt()` con toda la voz, contexto de industria (`buildIndustryContextBlock()` en `src/ai/prompt-builder.ts:237-261`) y reglas de escritura permanece intacto. Los patrones regex que definen qué es interesante no se tocan. Solo cambia la pregunta binaria interna: "¿este patrón apareció por primera vez aquí, o ya existía?"

---

## 2. Patrones arquitectónicos empleados

La arquitectura combina **cinco** patrones nombrados (cada uno con referencia y “Dónde aplica”). Se solapan parcialmente en la narrativa (p. ej. cascada y *tiered inference* hablan de costo), pero responden a preguntas distintas: **orden de etapas** vs **elección de modelo por complejidad** vs **eventos en el tiempo** vs **peso temporal de evidencia** vs **enfriamiento del umbral post-publicación**. Ninguno basta solo.

### 2.1. Cascading Classifier

**Referencia:** Viola-Jones (2001), detección de rostros en visión por computadora. Usado por OpenAI Moderation API en tiers, por Gmail para filtrado de spam.

**Qué resuelve:** optimización de costo computacional. Las capas baratas van primero y descartan la mayoría del volumen. Solo lo que sobrevive cada etapa pasa a la siguiente, más costosa.

**Dónde aplica:** la estructura de 5 capas en cascada (§4). Capa 0 es gratis (reglas). Capa 1 es gratis (regex). Capa 2 cuesta ~$0.005-0.008 (Haiku). Solo los commits que sobreviven todas las capas baratas llegan a Sonnet ($0.006).

### 2.2. Complex Event Processing (CEP)

**Referencia:** Luckham (2002) "The Power of Events"; implementado en Apache Flink CEP, Esper.

**Qué resuelve:** detección de patrones complejos a partir de eventos simples distribuidos en el tiempo. Un solo commit activando un solo detector no es interesante. Múltiples commits activando detectores relacionados (design_patterns + testing + error_resilience) en una ventana temporal sí constituyen una narrativa.

**Dónde aplica:** los 24 módulos de `src/analysis/modules/` son los detectores de eventos simples. Cada módulo emite una señal cuando detecta su patrón. La combinación de señales de distintos módulos sobre distintos commits de un mismo autor, correlacionadas por tema y ventana temporal, constituye un evento complejo que dispara la generación de un post de síntesis.

Las 24 categorías de detectores:

```
complexity, design_patterns, clean_code, type_system, integration,
testing, ai_assisted, performance, security, api_design,
error_resilience, observability, concurrency, dx, dependency_health,
evolutionary, js_advanced, react_patterns, devops, python_patterns,
go_patterns, java_patterns, elixir_patterns, architecture_patterns
```

### 2.3. Signal Accumulation con Decay

**Referencia:** Koren (2009) "Collaborative Filtering with Temporal Dynamics" (Netflix Prize). Los pesos de señales antiguas decaen exponencialmente, no linealmente.

**Qué resuelve:** acumulación de evidencia probabilística a lo largo del tiempo, donde las señales antiguas pierden relevancia gradualmente. Un commit de hace 3 semanas sigue existiendo pero ya no es una historia fresca.

**Dónde aplica:** el SignalBank (§5). Cada señal depositada decae según `exp(−λ × t)`. El post se dispara cuando la evidencia acumulada (con decay aplicado) supera el threshold.

### 2.4. Tiered Inference

**Referencia:** validado por DeepMind y Anthropic en "prompt routing" patterns.

**Qué resuelve:** aplicar el nivel correcto de inteligencia al nivel correcto de complejidad. No todos los commits necesitan un LLM caro.

**Dónde aplica:** dentro de la cascada. Capa 1 (regex, gratis) resuelve los casos obvios. Capa 2 (Haiku, barato) extrae semántica de los ambiguos. Capa 4 (Sonnet, caro) solo sintetiza cuando hay narrativa confirmada.

### 2.5. Refractory Period con Recuperación Exponencial

**Referencia:** Wozniak (1987) SM-2 spaced repetition — el intervalo entre revisiones crece según desempeño; Google SRE book — backoff exponencial para alertas con cooldown adaptativo; Netflix tech blog — Hystrix fallback cooldown.

**Qué resuelve:** evitar que el sistema publique repetidamente sobre el mismo tema. Después de generar un post, el threshold sube y decae gradualmente — nunca hay un corte abrupto.

**Dónde aplica:** protección anti-repetición post-disparo (§6).

---
## 3. Mejora 0 — Delta-awareness en módulos
 
## FASE A — Delta-awareness en módulos (BLOQUEANTE para Fase B)
 
### A1. `extractAddedLines()` + `extractRemovedLines()` en `src/analysis/diff-parser.ts`

Hoy los módulos extraen líneas `+` con lógica inline (cada módulo repite el mismo `.filter(l => l.startsWith('+')...`). Este paso centraliza ambas funciones en `diff-parser.ts` y agrega la simétrica para líneas `-`:

```typescript
export function extractAddedLines(patch: string): string {
  return patch
    .split('\n')
    .filter(l => l.startsWith('+') && !l.startsWith('+++'))
    .map(l => l.slice(1))
    .join('\n');
}

export function extractRemovedLines(patch: string): string {
  return patch
    .split('\n')
    .filter(l => l.startsWith('-') && !l.startsWith('---'))
    .map(l => l.slice(1))
    .join('\n');
}
```
 
### A2. Delta-awareness en los 22 módulos vulnerables

**Principio:** un módulo solo dispara si el patrón en líneas `+` NO estaba ya en
líneas `-`. Si existía antes → es sustitución → no hay historia nueva.

```typescript
// ANTES (solo added):
const addedText = extractAddedLines(diff.patch);
if (PATTERN.test(addedText)) return finding;

// DESPUÉS (delta-aware):
const addedText   = extractAddedLines(diff.patch);
const removedText = extractRemovedLines(diff.patch);
if (PATTERN.test(addedText) && !PATTERN.test(removedText)) return finding;
// Bilateral hit → sustitución mecánica → depositar WeakSignal(strength=2), no Finding
if (PATTERN.test(addedText) && PATTERN.test(removedText)) {
  return { kind: 'delta_hit', topic: MODULE_ID, strength: 2 };
}
return null;
```

> **Cambio de tipo requerido:** el caso bilateral requiere extender el tipo de retorno de `CodeAnalyzer` en `src/analysis/types.ts:69-92` para soportar `{ kind: 'delta_hit', topic: string, strength: number }` además de `Finding | null`. Ver §12.

**Módulos que necesitan guardia delta-aware (22):**
`type-system`, `performance`, `design-patterns`, `security`, `error-resilience`,
`observability`, `concurrency`, `dx`, `integration`, `testing`, `ai-assisted`, `complexity`,
`api-design`, `js-advanced`, `react-patterns`, `devops`, `python-patterns`,
`go-patterns`, `java-patterns`, `elixir-patterns`, `architecture-patterns`,
`evolutionary` (detectDeprecation).

Módulos que NO cambian: `dependency-health` (ya delta-aware).

**`clean-code` — audit preventivo (no delta-awareness):**
Usa agregados `diff.deletions`/`diff.additions`, no regex sobre patch — no es vulnerable.
Verificar antes de cerrar Fase A que ningún detector nuevo en el módulo haya introducido
match de patrón sobre líneas `+` individuales.
 
**Resultado esperado:** sustitución mecánica donde el patrón existía antes y después
→ ningún módulo dispara → 0 findings → no se llama a Claude → no se genera post.

### A3. `extractFirstHunkSnippet()` en `src/analysis/diff-parser.ts`
 
```typescript
export function extractFirstHunkSnippet(patch: string, maxLines = 6): string {
  // Extrae hasta `maxLines` líneas del primer hunk para evidence real
}
```
 
### A4. Evidence con código real en módulos sin evidence
 
Módulos prioritarios: `type-system`, `performance`, y todos los que no tienen
`evidence.before` / `evidence.after`. El snippet ancla el prompt de Claude al código
real, no a una categoría abstracta.
 
```typescript
evidence: {
  before: extractRemovedLines(diff.patch).slice(0, 300),
  after:  extractFirstHunkSnippet(diff.patch),
}
```
 
### A5. `commit.body` en `buildUserPrompt()` — `src/ai/prompt-builder.ts`
 
`EnrichedCommit.body` existe (verificado en `src/github/commit-enricher.ts`) y se pasa
via `AnalysisContext.commitBody` (verificado en `src/main-poll.ts:188` y
`src/worker/process-job.ts:391`), pero `buildUserPrompt()` (líneas 154–235) **no lo
incluye en el prompt**.
 
Cambio: añadir después de `Message:`:
```typescript
if (ctx.commitBody?.trim()) {
  parts.push(`Body:\n${ctx.commitBody.trim().split('\n').slice(0, 5).join('\n')}`);
}
```
 
⚠️ Impacto en tokens: un commit body de 5 líneas agrega ~100 tokens al user prompt.
Con prompt caching activo, este costo se amortiza en el cache hit del system prompt.
Limitar a 5 líneas para mantener el costo controlado.
 
### A5b. `FileDiff.hunks` en `src/analysis/types.ts` — campo NUEVO
 
`FileDiff` actualmente (verificado):
```typescript
export interface FileDiff {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  patch: string;
  language?: string;
}
```
 
Agregar campo nuevo (no existe hoy):
```typescript
  hunks?: Array<{ functionName?: string }>;
```
 
Y en `diff-parser.ts`, parsear headers `@@ -L,N +L,N @@ functionName` para poblar
`functionName` cuando el lenguaje tenga contexto de función (TypeScript, Go, Python).
---

## 3.5 Mejora 1 — PR-context awareness y anti-authority

### §3.5.1 Diagnóstico

**Authority hallucination:** Claude emite juicios editoriales sin respaldo en el diff. Caso real (korutx/alfresco PR #543): el post generado afirmó "this architectural decision demonstrates senior-level judgment" y "this is the correct approach for production systems" — ninguno derivable del diff. Es relleno semántico que el sistema injertó por no tener restricción explícita.

**Context blindness:** el pipeline procesa commits de forks con el mismo flujo que commits propios. Cuando un contributor hace push a su fork para preparar un PR, el sistema no sabe si el PR está abierto, fue mergeado, fue rechazado, o fue incorporado bajo otro commit por el maintainer.

**5 escenarios indistinguibles en el path actual:**

| Escenario | Observable en webhook | Realidad |
|-----------|----------------------|---------|
| `own_repo` | push en repo propio | trabajo en proyecto propio |
| `fork_pr_open` | push en fork | PR abierto o en preparación |
| `fork_pr_merged` | push en fork | código integrado upstream |
| `fork_pr_closed_unmerged` | push en fork | PR rechazado explícitamente |
| `fork_pr_closed_superseded` | push en fork | maintainer incorporó el código bajo commit/PR propio |

`closed_superseded` es terminología canónica de Bitbucket (Kalliamvakou et al., MSR 2014): el PR fue cerrado sin merge pero el código sí se incorporó, bajo autoría del maintainer.

**La solución no usa LLM.** Toda la detección vive en Capa 0/1 (commit-enricher + client), costo $0.000.

---

### §3.5.2 Fork detection (Capa 0 — commit-enricher)

`GitHubClient.getRepoVisibility()` (líneas 64–69 de `src/github/client.ts`) ya llama `this.octokit.repos.get({ owner, repo })`. La respuesta de GitHub incluye `fork: boolean`, `parent.owner.login` y `parent.name` — sin costo adicional, misma llamada REST.

**Cambio:** reemplazar `getRepoVisibility()` por `getRepoMeta()` que devuelve metadatos del fork:

```typescript
// src/github/client.ts — nuevo método (reemplaza getRepoVisibility)
interface RepoMeta {
  readonly isPrivate: boolean;
  readonly isFork: boolean;
  readonly defaultBranch: string;   // e.g. "main", "master", "trunk"
  readonly parentOwner?: string;    // definido solo cuando isFork === true
  readonly parentRepo?: string;     // definido solo cuando isFork === true
}

async getRepoMeta(owner: string, repo: string): Promise<RepoMeta>
// misma implementación: octokit.repos.get({ owner, repo })
// lee response.data.private, response.data.fork, response.data.default_branch,
//      response.data.parent?.owner?.login, response.data.parent?.name
```

`getRepoVisibility()` se elimina; `commit-enricher.ts` y cualquier otro caller pasan a usar `getRepoMeta()`.

**M3 — Riesgo de doble procesamiento fork+upstream (v2.7+, bajo prioridad):** si un developer instala devcast en su fork Y el maintainer también lo tiene instalado en el upstream, un merge con squash genera un commit de SHA diferente en el upstream. `hasDraft(sha)` no detecta el duplicado porque los SHAs difieren. El post se genera dos veces: una para el commit en el fork, otra para el squashed commit en el upstream. Alcance: solo afecta a pares de instalaciones (fork + upstream con devcast en ambos). No hay fix en Fase A.5 — documentar como gap conocido para v2.7.

**Cache de RepoMeta (in-memory, TTL 7 días):** `isFork` y `defaultBranch` no cambian para un repo dado. Un `Map<string, { meta: RepoMeta; cachedAt: number }>` keyed por `"${owner}/${repo}"` evita una `repos.get()` extra por commit del mismo repo. TTL de 7 días: los forks y el default branch raramente cambian de estado, y el impacto de un cache stale es bajo — post con contexto incorrecto, no pérdida de datos.

---

### §3.5.3 PR lookup vía GraphQL (Capa 0 — commit-enricher)

**Por qué GraphQL y no REST:** `GET /repos/{owner}/{repo}/commits/{sha}/pulls` (REST) no devuelve PRs en estado `closed`. `Ref.associatedPullRequests` (GraphQL) devuelve todos los estados: `OPEN`, `CLOSED`, `MERGED`.

**Prerequisito de dependencia:** `@octokit/rest` (ya en el proyecto) no incluye cliente GraphQL. Agregar `@octokit/graphql` como nueva dependencia, o usar `fetch` nativo (Node 18+) con POST a `https://api.github.com/graphql`. Elección de implementación en la fase de coding; el spec no prescribe cuál.

**Query:**
```graphql
query ListPullsForRef($owner: String!, $name: String!, $refName: String!) {
  repository(owner: $owner, name: $name) {
    ref(qualifiedName: $refName) {
      associatedPullRequests(states: [OPEN, CLOSED, MERGED], first: 5) {
        nodes {
          number
          title
          state
          url
          baseRepository {
            owner { login }
            name
          }
          timelineItems(itemTypes: [ISSUE_COMMENT], last: 20) {
            nodes {
              ... on IssueComment {
                body
                author { login }
              }
            }
          }
        }
      }
    }
  }
}
```

**Parámetros:** `owner` y `name` son del **fork** del contributor (no del upstream). `refName` viene del campo `ref` del job (`job.ref`, ya persistido en `job_queue` y disponible en `process-job.ts:138`), por ejemplo `"refs/heads/add-jdwp-debug"`. El PR resultante tendrá `baseRepository.owner.login + name` = upstream real.

**Nuevo método en `GitHubClient`:**
```typescript
// src/github/client.ts
async listPullsForRef(
  forkOwner: string,
  forkRepo: string,
  branchRef: string,
): Promise<PrLookupResult[]>

interface PrLookupResult {
  readonly number: number;
  readonly title: string;
  readonly state: 'OPEN' | 'CLOSED' | 'MERGED';
  readonly url: string;
  readonly upstreamOwner: string;
  readonly upstreamRepo: string;
  readonly timelineItems: ReadonlyArray<{
    readonly body: string;
    readonly authorLogin: string;
  }>;
}
```

**Cache de PR lookup (in-memory, TTL diferenciado por outcome — P3):**
keyed por `"${owner}/${repo}#${branchRef}"`. Los outcomes finales son inmutables; los no finales cambian.

| Outcome en cache | TTL |
|-----------------|-----|
| `merged` / `closed_*` | 7 días — inmutable, no va a cambiar |
| `open` | 12 horas — estado mutable; el maintainer puede mergear en cualquier momento |
| Sin PR encontrado (branch pre-PR) | 1 hora — puede aparecer un PR pronto |

Implementación: al escribir en el cache, calcular `expiresAt = now + TTL(outcome)`.

**Cuándo activar (P4 — condición revisada):** activar cuando el push es a una branch que **no es la default branch del repo**, independientemente de si es un fork. Esto cubre:
- Fork con feature branch → PR a upstream (caso korutx).
- Repo propio con feature branch → PR interno en orgs con push-access directa.

```typescript
const refBranch = branchRef.replace('refs/heads/', '');
const isPushToNonDefaultBranch = !!branchRef && refBranch !== repoMeta.defaultBranch;
if (isPushToNonDefaultBranch) → llamar listPullsForRef()
// push a main/master/trunk → prContext = undefined, sin llamada GraphQL
```

`defaultBranch` viene de `RepoMeta` (cero cost extra — mismo `repos.get()` ya ejecutado).

**Threading de `branchRef`:** `job.ref` ya está en el job record (verificado en `src/worker/process-job.ts:138`). Pasar como parámetro opcional a `enrichCommit(github, owner, repo, sha, fallbackAuthorLogin, branchRef?)`.

---

### §3.5.4 Tipos

```typescript
// Nuevos tipos — ubicación: src/github/commit-enricher.ts o src/github/pr-types.ts

export type PrOutcome =
  | 'open'
  | 'merged'
  | 'closed_unmerged'
  | 'closed_superseded';

export interface PrContext {
  readonly upstreamOwner: string;
  readonly upstreamRepo: string;
  readonly prNumber: number;
  readonly prUrl: string;
  readonly prTitle: string;
  readonly outcome: PrOutcome;
  readonly supersededEvidence?: {
    readonly supersededByPr?: number;      // número de PR en upstream que incorporó el código
    readonly maintainerComment?: string;   // primeros 200 chars del comentario del maintainer
    readonly confidence: 'high' | 'medium' | 'low';
  };
}

// Extensión de EnrichedCommit (src/github/commit-enricher.ts)
export interface EnrichedCommit {
  // ... campos existentes ...
  readonly prContext?: PrContext;  // definido solo cuando commit viene de un fork con PR asociado
}
```

---

### §3.5.5 Heurística de detección de closed_superseded (Capa 0 — commit-enricher)

**Input:** `PrLookupResult` con `state: 'CLOSED'`. La pregunta es si el PR fue rechazado explícitamente o si el maintainer incorporó el trabajo bajo otro commit.

**Regla de detección — sin LLM, sin llamada adicional de API (P1 + P2):**

La detección usa **co-presencia de señales**, no OR de regex independientes. El OR simple producía falsos positivos: un `#234` en "This conflicts with #234, closing" clasificaba como `closed_superseded`.

```
FUNCIÓN detectOutcome(pr: PrLookupResult, forkAuthorLogin: string):
  { outcome: PrOutcome; supersededEvidence?: SupersededEvidence }

  SI pr.state === 'OPEN'   → RETORNAR { outcome: 'open' }
  SI pr.state === 'MERGED' → RETORNAR { outcome: 'merged' }

  // pr.state === 'CLOSED' — distinguir closed_unmerged vs closed_superseded

  maintainerItems = pr.timelineItems.filter(item => item.authorLogin !== forkAuthorLogin)

  PARA CADA item EN maintainerItems:

    // HIGH: verbo de incorporación + referencia explícita (#N o hash)
    // Cubre: "Changes merged from #584, thanks for raising this initial work!"
    match_credit = item.body.match(
      /\b(merged|incorporated|applied|landed)\s+(in|from|via|as|under)\s+(#\d+|[0-9a-f]{7,40})/i
    )
    SI match_credit:
      prRef = item.body.match(/#(\d+)/)
      RETORNAR {
        outcome: 'closed_superseded',
        supersededEvidence: {
          maintainerComment: item.body.slice(0, 200),
          supersededByPr: prRef ? parseInt(prRef[1]) : undefined,
          confidence: 'high',
        }
      }

    // MEDIUM: agradecimiento + referencia al trabajo del contributor
    // Cubre: "Thanks for raising this! Applied in commit abc1234"
    match_thanks = item.body.match(
      /\b(thanks|thank you|appreciate)\b.{0,80}(#\d+|[0-9a-f]{7,40}|raising|initial work|this pr)/i
    )
    SI match_thanks:
      prRef = item.body.match(/#(\d+)/)
      RETORNAR {
        outcome: 'closed_superseded',
        supersededEvidence: {
          maintainerComment: item.body.slice(0, 200),
          supersededByPr: prRef ? parseInt(prRef[1]) : undefined,
          confidence: 'medium',
        }
      }

  // Sin señal de incorporación → rechazo o abandono
  RETORNAR { outcome: 'closed_unmerged', supersededEvidence: undefined }
```

**Niveles de confidence usados (P1 — alineados con el tipo):**

| Confidence | Señal | Ejemplo |
|-----------|-------|---------|
| `high` | Verbo de incorporación (`merged/applied/…`) + referencia explícita (`#N` o hash) | "merged from #584" |
| `medium` | Agradecimiento explícito + referencia al trabajo | "thanks for raising this, applied in abc1234" |
| `low` | Eliminado — demasiado ruidoso sin co-presencia de señales | — |

**En `<contributor_voice>`: solo `confidence === 'high'` activa el path `closed_superseded`.** `medium` se trata como `closed_unmerged` — evidencia ambigua, no suficiente para afirmar incorporación en el post.

**Integridad de datos:** `supersededEvidence.maintainerComment` almacena los primeros 200 caracteres — suficiente para identificar la referencia, sin persistir el texto completo en el prompt.

---

### §3.5.6 Cambios al prompt (src/ai/prompt-builder.ts)

**Dos problemas atacados simultáneamente:**

**A. Anti-authority (caso base y caso fork):** eliminar espacio para que Claude emita juicios de calidad no respaldados por evidence. Instrucción nueva en `buildSystemPrompt()`:

```
Do NOT add unsupported editorial opinions about code quality ("correct approach",
"right way", "well-designed", "demonstrates senior-level judgment", "best practice").
Describe what was done and why (if stated in the commit message). Do not evaluate
whether the approach was correct — you cannot determine that from a diff alone.
```

**B. Contexto de PR — bloque `<contributor_voice>` en `buildUserPrompt()`:**

```typescript
// Insertar antes de <task> en buildUserPrompt(), solo cuando ctx.prContext existe

if (ctx.prContext) {
  const { outcome, upstreamOwner, upstreamRepo, prNumber, prTitle, supersededEvidence } = ctx.prContext;

  const outcomeText =
    outcome === 'merged'
      ? `merged into ${upstreamOwner}/${upstreamRepo} as PR #${prNumber}`
    : outcome === 'open'
      ? `open PR #${prNumber} in ${upstreamOwner}/${upstreamRepo} (not yet merged)`
    : outcome === 'closed_unmerged'
      ? `closed PR #${prNumber} in ${upstreamOwner}/${upstreamRepo} (not merged)`
    : /* closed_superseded */
        `closed PR #${prNumber} in ${upstreamOwner}/${upstreamRepo} — the maintainers incorporated this work in a separate commit`;

  // Gate: closed_superseded solo se activa con confidence === 'high'.
  // Medium confidence cae en closed_unmerged — evidencia ambigua no es suficiente para afirmar incorporación.
  const effectiveOutcome =
    outcome === 'closed_superseded' && supersededEvidence?.confidence !== 'high'
      ? 'closed_unmerged'
      : outcome;

  const outcomeText =
    effectiveOutcome === 'merged'
      ? `merged into ${upstreamOwner}/${upstreamRepo} as PR #${prNumber}`
    : effectiveOutcome === 'open'
      ? `open PR #${prNumber} in ${upstreamOwner}/${upstreamRepo} (not yet merged — under review)`
    : effectiveOutcome === 'closed_unmerged'
      ? `closed PR #${prNumber} in ${upstreamOwner}/${upstreamRepo} (not merged)`
    : /* closed_superseded, confidence === 'high' */
        `closed PR #${prNumber} in ${upstreamOwner}/${upstreamRepo} — the maintainers incorporated this work in a separate commit`;

  parts.push(`<contributor_voice>
This commit is from a fork. PR context: ${outcomeText}.
PR title: "${prTitle}".
${effectiveOutcome === 'closed_superseded' && supersededEvidence?.maintainerComment ? `Maintainer reference: "${supersededEvidence.maintainerComment}"` : ''}

Rules:
- Cite the project as ${upstreamOwner}/${upstreamRepo} (the upstream), not the fork.
- If outcome is open: describe the work as submitted and under review, not as accepted.
  Do not predict reviewer reactions ("this should merge easily", "the team will love it").
  Acceptable: "I proposed X to ${upstreamOwner}/${upstreamRepo}." Not acceptable: "I added X to ${upstreamOwner}/${upstreamRepo}."
- If outcome is merged: you may say the developer contributed to ${upstreamOwner}/${upstreamRepo}.
- If outcome is closed_superseded: describe what the developer built. The maintainers incorporated this work — acknowledge the contribution accurately. Express the technical achievement, not the PR outcome. Do not say "contributed to" without the superseded context.
- If outcome is closed_unmerged: focus on what was built and the technical decisions made. Do not dwell on the PR being closed.
- Do NOT assert the code is "correct", "well-designed", or "the right approach".
</contributor_voice>`);
}
```

**Si no hay `prContext` (commit en repo propio):** no se inserta el bloque. El comportamiento existente es correcto — solo aplica la instrucción anti-authority del system prompt.

**M1 — Reglas pendientes para v2.7 (no bloqueantes):** si en producción se detectan casos donde Claude opina sobre las decisiones del maintainer o predice la recepción de la comunidad, agregar:
- `Do not editorialize on the maintainer's decision to close or accept the PR.`
- `Do not predict community reception ("this will be useful for many teams", "the community will benefit").`

Criterio de activación: > 2 casos reales detectados en revisión de posts.

---

## 3.6 Mejora 2 — Idioma del post por perfil de desarrollador

### Motivación

El sistema hoy genera todos los posts en inglés, sin instrucción explícita de nivel. Un desarrollador hispanohablante que quiera publicar en español no tiene forma de indicarlo. Y los posts en inglés no tienen una cota de vocabulario definida — Claude puede usar expresiones idiomáticas o vocabulario avanzado que dificulta la lectura para una audiencia no nativa.

### Estado: temporal (fase de prueba)

B2 forzado para todos los perfiles en inglés fue la decisión inicial pero se revisó antes de implementar. Razón del cambio: la fundadora hace dogfooding del producto y necesita posts legibles en su segundo idioma, pero los demás developers tienen inglés nativo o C1 y una cota artificial degradaría su voz.

**Decisión final:** `'en-b2'` como valor explícito separado de `'en'`, no como default.

**Cuándo revisar:** al salir de fase de prueba, evaluar tres alternativas:
1. Mantener `'en-b2'` como valor opt-in (si métricas muestran mejora de `edit_ratio` para lilicurl).
2. Promover `'en-b2'` como default si mejora también para otros autores.
3. Eliminar el bloque `<language>` para `'en'` y dejar que `voice_profile` decida completamente.

Criterio de decisión: comparar `mean_edit_ratio` pre/post B2 sobre los mismos autores. Si sube significativamente para autores que escriben naturalmente C1, considerar opción 3.

### Decisión de diseño

- **Idiomas soportados:** `'en'`, `'en-b2'`, `'es'`. Cerrado — no genérico por ahora.
- **`'en'` (default):** sin instrucción de idioma — preserva la voz natural del autor, comportamiento actual exacto.
- **`'en-b2'`:** inglés nivel B2 — claro, profesional, sin idioms ni vocabulario inusual. Para dogfooding de lilicurl.
- **`'es'`:** tono natural de ingeniería en español latinoamericano. Sin anglicismos innecesarios.
- **Ubicación:** campo `post_language` en `voice_profiles.voice` JSONB (por desarrollador, no por tenant). Se configura manualmente en la DB.

### Cambio en `src/config/schema.ts`

```typescript
// En VoiceProfileSchema — campo nuevo:
post_language: z.enum(['en', 'en-b2', 'es']).default('en'),

// En DEFAULT_VOICE_PROFILE:
post_language: 'en',
```

`VoiceProfileSchema` ya usa `.passthrough()`, así que los perfiles existentes sin el campo reciben el default `'en'` al pasar por Zod.

### Cambio en `src/ai/prompt-builder.ts`

Nueva función privada — retorna `null` para `'en'`, no emite bloque (preserva comportamiento existente):

```typescript
function buildLanguageInstruction(language: string | undefined): string | null {
  if (language === 'en-b2') {
    return '<language>\nWrite in English. Vocabulary level: B2 — clear and professional, no idioms or rarely-used expressions. Accessible to non-native English speakers without being simplistic.\n</language>';
  }
  if (language === 'es') {
    return '<language>\nEscribe en español. Tono natural de ingeniería de software en español latinoamericano. Sin anglicismos innecesarios.\n</language>';
  }
  // 'en' o undefined → sin instrucción, voz natural del autor
  return null;
}
```

Inyección en `buildSystemPrompt()`, justo después del bloque `<author>`:

```typescript
const languageInstruction = buildLanguageInstruction(voiceProfile.post_language);
if (languageInstruction) {
  sections.push('');
  sections.push(languageInstruction);
}
```

### Impacto en posts existentes

Perfiles sin `post_language` → default `'en'` → sin `<language>` block → **comportamiento idéntico al actual**. Solo los perfiles con `'en-b2'` o `'es'` reciben instrucción de idioma. Cero riesgo de regresión.

---

## 4. Arquitectura de 5 capas en cascada

```
CAPA 0 — Reglas (gratis)
isInteresting() en src/utils/commit-filter.ts
bots, merges, min lines, repos excluidos
Rechazado → descarta sin costo
        │
        ▼
CAPA 1 — Regex modules (gratis)
24 módulos en paralelo sobre el patch raw (delta-aware post Fase A)
        │
        ├─ score >= 5 → PATH ACTUAL → Sonnet → Post inmediato (gatillador 1 ó 2)
        │
        ├─ score 1-4  → un WeakSignal gratuito por topic → signal_bank
        │               un WeakSignal por cada topic con finding (strength = score del topic)
        │
        └─ score 0    → skip (ninguna señal, ningún costo)
        │
        ▼
CAPA 2 — Haiku lazy: solo cuando weight_sum ≥ threshold_effective(computed) × 0.7 (~$0.001 con caching) [TODO:CALIBRATE[CAL-2]]
Condición: weight_sum(decayed) para (tenant, author, repo, topic) ≥ threshold_effective(computed) × 0.7
           Y el commit actual tiene score 0 (ningún módulo disparó).
Solo entonces se llama Haiku para ese commit.
Evalúa si hay valor semántico real (cambio de contrato, refactor semántico).
Si sí → deposita WeakSignal con strength ajustada → Capa 3 evalúa threshold.
Si no → no se deposita, acumulación queda por debajo del threshold.
        │
        ▼
CAPA 3 — Haiku: evaluación de umbral (~$0.001)
Lee signal_bank acumulado para `(tenant_id, github_author_login, repo, topic)` (ámbito instalación + autor del commit)
Evalúa: ¿suficiente señal Y algo nuevo vs. último post de este tópico?
        │
        ├─ NO → acumula, decay en background
        │
        └─ SÍ → CAPA 3.5
             │
             ▼
CAPA 3.5 — Haiku: validación de coherencia narrativa (gate binario)
Jaccard(topics_A, topics_B) donde:
  topics_A = topics con señal en la mitad más antigua de commits del window
  topics_B = topics con señal en la mitad más reciente de commits del window
Si Jaccard < 0.4 ó sin progresión temporal → bloquea síntesis (sigue acumulando)
Si coherente → confirma gatillador 3 ó 4
Solo aplica cuando Capa 3 detecta acumulación multi-topic (gatillador 4 candidate)
             │
             ▼
CAPA 4 — Sonnet: síntesis (~$0.006)
Recibe <commit_series> con WeakSignals acumulados
Genera post sobre evolución/arco, no sobre un commit individual
  Reutiliza buildSystemPrompt() + buildIndustryContextBlock()
```
 
**4 gatilladores de post:**
1. **Individual mono-tema** — score ≥ 5, un solo módulo dispara (path actual, Capa 1)
2. **Individual multi-tema** — score ≥ 5, múltiples módulos en el mismo commit (path actual)
3. **Focal acumulado** — acumulación de señales del mismo tópico (Capa 3, por tópico)
4. **Arco narrativo** — señales de múltiples tópicos con progresión temporal (Capa 3, cross-topic)

**Costo por commit:**
- Trivial (Capa 0): $0.000
- Patrón fuerte (path actual): $0.006 (solo Sonnet)
- Score 1-4 (WeakSignal gratuito): $0.000
- Score 0 (skip): $0.000
- Near threshold, Haiku lazy (score 0, weight_sum ≥ threshold_effective(computed) × 0.7, con caching): ~$0.001-0.002
- Acumulación dispara síntesis (Haiku lazy + Sonnet, con caching): ~$0.008

### Invariantes de la cascada (para no ambiguar al implementar)

1. **Corte temprano:** si Capa 0 rechaza, no se ejecuta Capa 1 para ese commit. Si Capa 1 activa gatillador 1 o 2 (≥1 finding con score ≥ 5), **no** se llama Haiku de Capa 2–3 para ese mismo commit en el path de síntesis; el costo es el del post individual (p. ej. Sonnet).
2. **Capas 0–1 son por commit y síncronas** en el worker actual; encajan en un solo paso de pipeline antes de cualquier LLM “barato”.
3. **Capas 2–4 son stateful entre commits:** Capa 2 puede emitir `WeakSignal` y escribir en `signal_bank`; Capa 3 lee agregados **entre** ejecuciones (mismo `tenant_id` + autor + repo + topic). Por tanto la “cascada” no es solo una lista lineal en un único `for commit`: Capa 3/3.5/4 se conceptualizan como **evaluación periódica o post-hook** cuando el banco de señales cambia, no necesariamente inmediatamente después de cada `WeakSignal` en el mismo tick (el orden lógico del diagrama es el de **elegibilidad**, no exige un solo frame de CPU).
4. **Capa 3.5 solo aplica** cuando Capa 3 ya decidió que hay disparo **y** hay acumulación relevante **multi-topic** (routing arco vs focal); si solo un topic cruza umbral → gatillador 3 sin pasar por la heurística de §8.

### Qué alimenta Capa 2

Capa 2 ya **no corre en todos los commits débiles**. La fuente principal de acumulación son las señales generadas por delta-awareness y los findings de score bajo — ambas gratuitas.

**Dos fuentes de WeakSignal gratuitas (sin Haiku):**
1. **Delta-awareness hit**: módulo detecta patrón en added Y en removed → sustitución mecánica → `WeakSignal(strength=2, topic=módulo)`. El developer trabaja en esa área pero sin novedad aún.
2. **Finding score 1-4**: módulo dispara con patrón genuinamente nuevo pero contexto débil → `WeakSignal(strength=score, topic=módulo)`. Se deposita por cada topic que tenga finding, no solo el mayor.

**Capa 2 (Haiku lazy)** solo se activa cuando se cumplen **ambas** condiciones:
1. `weight_sum(decayed)` para `(tenant_id, github_author_login, repo, topic)` ≥ `threshold_effective(computed) × 0.7`.
2. El commit actual tiene score 0 — ningún módulo disparó (ni hit ni finding) para ese topic.

Commits con score 0 y `weight_sum < threshold_effective(computed) × 0.7` → **skip directo, costo $0.000**.

### Combinación Capa 1 + Capa 2 en Capa 3

Capa 3 combina señales de tres fuentes al evaluar acumulación:

- **Findings score ≥ 5** (gatilladores 1 y 2): sus señales se consumen inmediatamente (ver §9).
- **Findings score 1-4** (Capa 1, gratuitos): depositados directamente como WeakSignals sin pasar por Haiku. Fuente principal de acumulación.
- **Haiku lazy** (Capa 2, score 0 near-threshold): WeakSignal con strength ajustada por Haiku. Caso raro y de alto valor.

Cuando un commit dispara gatillador 1 ó 2 en un topic T, y simultáneamente tiene señales débiles en otro topic T', las señales débiles en T' siguen vivas y pueden contribuir a futura acumulación en T' junto con otros commits.

---

## 5. Signal Accumulation con Decay Exponencial

### Función de decay

Cada señal depositada en el SignalBank pierde valor con el tiempo según:

```
signal_value(t) = original_strength × exp(−λ × t)
```

Donde:

- `t` = días transcurridos desde que se registró la señal
- `λ = ln(2) / half_life_signal(author)` — tasa de decaimiento
- `half_life_signal(author)` = adaptativo por autor, **separado** del half_life del refractory period (ver §7)

### Propiedades

- A los `half_life_signal` días → 50% del valor original
- A los `2 × half_life_signal` → 25%
- Nunca llega a 0 (residual infinitesimal)
- Sin discontinuidades, sin piso arbitrario

### Por qué exponencial y no lineal

Con decay lineal, la señal llega a cero en un momento discreto — crea un corte abrupto donde un día la señal vale algo y al siguiente vale cero. Si la señal dura más que el período lineal, necesitas un floor arbitrario o la señal se vuelve negativa.

Con exponencial, la señal se vuelve infinitesimalmente pequeña pero nunca negativa ni cero. No hay piso arbitrario que elegir, no hay discontinuidad.

**Referencia:** Koren (2009) justifica exponencial sobre lineal en sistemas de recomendación — las preferencias del usuario cambian con el tiempo, los ratings viejos deben pesar menos, pero no cero.

### Truncamiento práctico

Para evitar arrastrar historial infinito, señales con valor decayed < `ε` (0.01) se marcan como expiradas y no se incluyen en el cálculo de acumulación. Esto introduce un piso práctico tan bajo que es irrelevante para la decisión.

---

## 6. Refractory Period con Recuperación Exponencial

Después de generar un post sobre un tópico, el threshold sube — se necesita más evidencia acumulada para disparar otro post sobre ese mismo tópico. El threshold luego decae gradualmente hacia el baseline.

### Fórmula

```
threshold(t) = baseline(author) + excess × exp(−μ × t)
```

Donde:

- `baseline(author)` = threshold base, adaptativo por perfil de autor (ver §7)
- `excess = baseline(author) × multiplier_actual` — cuánto sube el threshold al disparar
- `μ = ln(2) / half_life_refractory(author)` — tasa de recuperación
- `half_life_refractory(author)` = adaptativo por ritmo de commits del autor
- `multiplier_actual` = acumulado del historial de `edit_ratio` del autor (ver §11)
- `t` = días transcurridos desde el último disparo para ese autor/tópico

### Ejemplo numérico

Con baseline = 15, multiplier = 1.0 (corresponde a `mean_edit_ratio = 0.25`; el default es 0.5), half_life_refractory = 10 días:

- `excess = 15 × 1.0 = 15`
- `μ = ln(2) / 10 ≈ 0.0693`

| Días post-disparo | threshold | Exceso restante |
|-------------------|-----------|-----------------|
| 0 (acaba de disparar) | 30.0 | 100% |
| 10 | 22.5 | 50% |
| 20 | 18.75 | 25% |
| 40 | 15.9 | ~6% |

Nunca hay precipicio — se acerca al baseline asintóticamente.

> **Mejora vs v1:** el spec v1 usaba `threshold_current × 2` con decay lineal de 1pt/día. Eso es un decay lineal que llega a baseline en un tiempo fijo y crea una discontinuidad. El decay exponencial es heurística inicial (Google SRE book: backoff exponencial para alertas), sujeta a calibración con `edit_ratio`.

### Analogía con SM-2 (Wozniak, 1987)

En spaced repetition, el ease factor modula cuánto crece el intervalo entre revisiones según desempeño: si recuerdas bien, el intervalo crece (fácil). Si fallas, se acorta (difícil).

El `multiplier_actual` es nuestro ease factor: si el autor genera posts con bajo edit_ratio (poca edición), el multiplier baja → el exceso es menor → el período refractario es más corto → puede postear antes. Si genera posts con alto edit_ratio (mucha edición), el multiplier sube → período refractario más largo.

---

## 7. Calibración por ritmo de usuario

### Dos half-life independientes

El sistema usa dos constantes de tiempo separadas por autor, porque responden a preguntas distintas:

- **`half_life_signal`** — "¿cuánto vale este commit como evidencia?" Modela la relevancia narrativa del dato. Debe ser **más largo** porque un commit puede seguir siendo evidencia válida para un post futuro incluso después de que el sistema esté dispuesto a publicar de nuevo.
- **`half_life_refractory`** — "¿cuándo puedo volver a postear sobre este tema?" Modela la frecuencia de output del sistema. Debe ser **más corto** porque la disposición a publicar se recupera más rápido que la relevancia del material caduca.

**Justificación desde la literatura:**

En neurociencia, la intensidad de la señal entrante y el umbral de disparo de la neurona son parámetros independientes. Si fueran el mismo, el sistema perdería la capacidad de distinguir entre "estímulo débil" y "neurona en recuperación" (ScienceDirect, Refractory Period overview). Koren (2009) identifica tres efectos temporales distintos (sesgos de usuario, sesgos de ítem, preferencias) con dinámicas independientes — los enfoques de decay uniforme pierden demasiadas señales. SM-2 (Wozniak, 1987) y su sucesor FSRS asignan Difficulty, Stability y Retrievability como parámetros independientes por tarjeta.

### Derivación de ambos half_life

Ambos se derivan de la frecuencia de commits del autor, pero con multiplicadores (`k`) distintos:

```
median_interval        = mediana del intervalo entre commits (últimos 60 días)

half_life_signal(author)      = k_signal × median_interval
half_life_refractory(author)  = k_refractory × median_interval
```

Valores iniciales: `k_signal = 9`, `k_refractory = 6`. Esto da una proporción `half_life_signal ≈ 1.5× half_life_refractory`.

> **TODO:CALIBRATE[CAL-1]** ver §15 Fase C para criterios de ajuste de estos valores.

| Perfil | median_interval | half_life_signal | half_life_refractory | Efecto |
|--------|----------------|-----------------|---------------------|--------|
| Muy activo (5/día) | 0.2 días | 1.8 días | 1.2 días | Refractory se relaja rápido, señales retienen valor un poco más |
| Diario (1/día) | 1.0 días | 9 días | 6 días | Señales útiles ~18 días (25%), refractory relajado en ~12 días (25%) |
| Semanal (2/sem) | 3.5 días | 31.5 días | 21 días | Acumula pacientemente, refractory largo pero señales aún más largas |

**Por qué esta proporción:** cuando el refractory se ha relajado al ~25% del exceso (2× half_life_refractory), las señales más viejas todavía retienen ~40-50% de su valor — suficiente para contribuir a una síntesis si llegan señales nuevas. Si fueran iguales, al relajarse el refractory las señales ya habrían perdido el 75% de su valor, descartando material narrativo útil.

Se usa mediana y no promedio porque un developer que comitea 10 veces el lunes y nada el resto de la semana tiene un promedio engañoso. La mediana captura el ritmo real.

### Ventana de acumulación

Derivada del half_life_signal (no del refractory):

```
ventana_dias = max(7, min(28, round(2.5 × half_life_signal(author))))
```

- Developer diario (half_life_signal=9) → ventana ~23 días
- Developer semanal (half_life_signal=31.5) → ventana 28 días (máximo)
- Developer muy activo (half_life_signal=1.8) → ventana 7 días (mínimo)

### Fallback para cold start

Un usuario nuevo no tiene suficiente historial para calcular la mediana de intervalos. Se requieren al menos 10 commits con 7+ días de historial para una mediana estable.

Transición con blend suave (sin discontinuidad):

```
commits_count = count(commits, last_60d)
weight        = min(1, commits_count / 10)

half_life_signal      = weight × hl_signal_calculated + (1 - weight) × FALLBACK_HL_SIGNAL
half_life_refractory  = weight × hl_refractory_calculated + (1 - weight) × FALLBACK_HL_REFRACTORY
```

- `FALLBACK_HL_SIGNAL = 10 días` — conservador, retiene señales más tiempo durante cold start.
- `FALLBACK_HL_REFRACTORY = 7 días` — conservador, no spammea a un usuario desconocido.
- Con 5 commits: 50% calculado + 50% fallback.
- Con 10+ commits: 100% calculado.

El blend asegura que no hay salto abrupto cuando el usuario cruza el umbral de 10 commits.

### Resumen canónico (fuente única para implementación)

Usar **solo** este bloque para decay de señal, refractory del umbral y cold start. Evita mezclar con el bloque deprecado más abajo (antiguo borrador con `ventana_dias` fija y `t/21`).

**Entrada (por autor, ventana 60 d):**

- `commits_count` = número de commits del autor en los últimos 60 días.
- `median_interval` = mediana de días entre commits consecutivos (misma ventana 60 d; requiere historial suficiente — ver texto arriba).

**Cold start (blend):**

```
weight = min(1, commits_count / 10)

half_life_signal(author)     = weight × (k_signal × median_interval) + (1 − weight) × FALLBACK_HL_SIGNAL
half_life_refractory(author) = weight × (k_refractory × median_interval) + (1 − weight) × FALLBACK_HL_REFRACTORY
```

Constantes iniciales: `k_signal = 9`, `k_refractory = 6`, `FALLBACK_HL_SIGNAL = 10` días, `FALLBACK_HL_REFRACTORY = 7` días.

**Tasas (medio-vida en días → exponente por día `t` en días):**

```
λ_signal(author)     = ln(2) / half_life_signal(author)      // decay de evidencia / señal
μ_refractory(author) = ln(2) / half_life_refractory(author)   // recuperación del umbral post-disparo
```

**Valor decayed de una señal** (`t` = días desde `accumulated_at`):

```
signal_value(t) = original_strength × exp(−λ_signal(author) × t)
```

**Umbral refractario** tras un disparo (`t` = días desde ese disparo; `excess = baseline(author) × multiplier_actual`):

```
threshold(t) = baseline(author) + excess × exp(−μ_refractory(author) × t)
```

`baseline(author)` y `multiplier_actual` siguen §6 y §11 (edit_ratio). **Ventana de acumulación** para agrupar commits/señales: §7 (`ventana_dias` derivada de `half_life_signal`, no sustituye a `λ_signal` en la fórmula anterior).

---

## 8. Routing de coherencia (arco vs posts independientes)

Cuando Capa 3 detecta acumulación que cruza threshold en **múltiples topics**, debe decidir entre:

- **Gatillador 4 (arco narrativo):** un solo post multi-topic con narrativa de evolución
- **Gatillador 3 × N (posts focales):** un post por cada topic, independientes

Esta decisión es crítica — forzar un arco que no existe produce narrativa inventada, que es el peor error posible del sistema.

### Enfoque: heurística léxico-estructural (sin LLM)

Inspirado en Kuhn, Ducasse & Girba (2007) "Semantic Clustering: Identifying Topics in Source Code" (Information and Software Technology), que propone analizar vocabulario del código fuente — nombres de identificadores, paths, comentarios — para agrupar artefactos relacionados. El principio base es la hipótesis distribucional de Harris (1954): palabras con significados similares ocurren en contextos similares.

Adaptado a commits: los commits que pertenecen a una misma historia tienden a compartir archivos, ocurrir en proximidad temporal, y usar vocabulario similar en sus mensajes.

### Tres señales heurísticas

**1. Coherencia estructural — solapamiento de archivos (peso 0.5)**

Jaccard similarity entre los sets de archivos afectados por los commits candidatos:

```
files_union       = ∪ files(commit_i)  para todos los commits
files_intersection = ∩ files(commit_i)
coherencia_estructural = |files_intersection| / |files_union|
```

Si los commits tocan al menos un archivo en común en proporción significativa (ej. `>= 0.3`), hay fuerte evidencia de coherencia. Es la señal más confiable — commits que modifican los mismos archivos casi siempre están relacionados conceptualmente.

Variante: si la intersección directa es baja, evaluar solapamiento a nivel de **directorio** (primeros 2-3 niveles del path). Commits que tocan `src/auth/login.ts` y `src/auth/session.ts` no comparten archivos pero sí directorio, y probablemente están relacionados.

**2. Densidad temporal (peso 0.2)**

Binario: ¿están todos los commits dentro de una ventana corta?

```
span_dias = max(commits.date) - min(commits.date)
densidad_temporal = 1 si span_dias < 3 × median_commit_interval(author) else 0
```

Commits en un sprint corto (pocos días) tienen más probabilidad de pertenecer a la misma historia. Commits dispersos en semanas tienden a ser episodios independientes.

Se usa `median_commit_interval` en lugar de un valor fijo porque "corto" es relativo al ritmo del developer: 3 días es corto para un committer diario pero normal para uno semanal.

**3. Coherencia léxica — solapamiento en commit messages (peso 0.3)**

Jaccard similarity sobre tokens de los commit messages, después de:
- Eliminar stopwords (the, a, is, ...)
- Eliminar prefijos convencionales (feat:, fix:, chore:, refactor:, ...)
- Normalizar case
- Stemming básico opcional

```
tokens_i        = normalize(tokens(commit_i.message))
tokens_union    = ∪ tokens_i
tokens_intersection = ∩ tokens_i
coherencia_lexica = |tokens_intersection| / |tokens_union|
```

Es la señal más débil — los commit messages en proyectos reales suelen ser cortos y limitados en vocabulario.

### Fórmula de scoring

```
score_coherencia = 0.5 × coherencia_estructural
                 + 0.2 × densidad_temporal
                 + 0.3 × coherencia_lexica
```

### Threshold con banda gris (routing conservador)

```
score_coherencia >= 0.6         → Gatillador 4: ARCO NARRATIVO (un solo post)
0.3 < score < 0.6               → Gatillador 3 × N: POSTS FOCALES (default seguro)
score_coherencia <= 0.3         → Gatillador 3 × N: POSTS FOCALES (confianza alta)
```

La zona gris (0.3–0.6) siempre va a posts independientes. Solo cuando el score es claramente alto decide arco. Esto minimiza el riesgo de forzar arcos inventados.

### Calibración de pesos y threshold (sin datos etiquetados)

Los valores iniciales (0.5 / 0.2 / 0.3 con threshold 0.6) son heurísticos. Se refinan con tres técnicas:

**(a) Análisis de sensibilidad con casos sintéticos.** Construir fixtures que representen casos extremos con resultado esperado obvio y verificar que el scoring clasifique correctamente:

| Caso | Archivos | Tiempo | Mensajes | score esperado | Route esperada |
|------|---------|--------|----------|----------------|----------------|
| Arco puro | mismos | corto | solapan | alto (>0.7) | ARCO |
| Independientes puro | distintos | largo | distintos | bajo (<0.2) | FOCAL |
| Solo archivos | mismos | largo | distintos | medio (~0.5) | FOCAL (banda gris) |
| Solo tiempo | distintos | corto | distintos | bajo (~0.2) | FOCAL |
| Solo mensajes | distintos | largo | solapan | bajo (~0.3) | FOCAL |

Los tres últimos casos calibran el peso relativo de cada señal. Si "solo archivos" debiera ser ARCO, subir peso de archivos o bajar threshold. Si "solo tiempo" no debe ser ARCO, su peso no puede superar threshold por sí solo.

**(b) Feedback via edit_ratio una vez en producción.** El edit_ratio en posts publicados es proxy de calidad:

- Posts de arco (Gatillador 4) con `edit_ratio alto` consistentemente → el sistema está forzando arcos que no deberían existir. Subir threshold.
- Posts focales (Gatillador 3) publicados cerca del threshold inferior (score ~0.5-0.6) con edit_ratio bajo → el arco hubiera sido correcto. Bajar threshold superior.

No requiere labels manuales — usa el comportamiento de edición humana como señal de correctness.

**(c) Dashboard de observability.** Registrar en cada decisión de routing:
- `score_coherencia`, componentes individuales, decisión final
- `edit_ratio` resultante del post generado
- `author_login` (los pesos óptimos pueden variar por autor si sus patrones de trabajo son muy distintos)

Con 4+ developers y 2-3 semanas de datos, calibrar con correlación simple entre `score_coherencia` y `edit_ratio`.

### Migración futura a embeddings (Opción v3)

Si la heurística resulta insuficiente (más del 30% de las decisiones tienen edit_ratio alto), migrar a embeddings de diffs + commit messages + clustering con HDBSCAN (patrón de BERTopic). Costo: inferencia de embeddings por commit más complejidad operativa. No se justifica en v2.

### Cuándo NO aplica el routing de coherencia

Si la acumulación cruza threshold en **un solo topic**, no hay decisión de routing — es Gatillador 3 directo (focal acumulado). El scoring de coherencia solo se calcula cuando hay acumulación multi-topic.

---

## 9. Consumo de señales post-disparo

Cuando se dispara un post (cualquier gatillador), las señales que lo alimentaron deben marcarse como consumidas para evitar que el mismo material genere un post duplicado.

### Patrón estándar: Opción B (consumir todas las señales del topic)

Implementación elegida para v2. Es el patrón estándar de deduplicación en arquitecturas event-driven (ver Event Sourcing Projections, Domain Centric 2019; Calmops Event-Driven Architecture Guide).

**Regla:** al disparar un post sobre topic T para author A, marcar como `consumed` todas las `signal_events` no consumidas de ese author en ese topic dentro de la ventana temporal, y resetear el agregado en `signal_bank`.

```sql
-- Transacción atómica al disparar post
BEGIN;

-- Marcar señales consumidas (preservar con referencia a qué post las consumió)
UPDATE signal_events
SET consumed = TRUE,
    consumed_by_post_id = :post_id,
    consumed_at = NOW()
WHERE signal_bank_id IN (
  SELECT id FROM signal_bank
  WHERE tenant_id = :tenant
    AND github_author_login = :author
    AND topic = :T
)
  AND consumed = FALSE
  AND accumulated_at > NOW() - make_interval(days => :ventana_dias);

-- Resetear agregado y marcar refractory
-- threshold_effective se computa en runtime desde threshold_baseline + multiplier + last_fired_at (§6)
UPDATE signal_bank
SET weight_sum = 0,
    signal_count = 0,
    last_fired_at = NOW()
WHERE tenant_id = :tenant
  AND github_author_login = :author
  AND topic = :T;

COMMIT;
```

### Casos por gatillador

| Gatillador | Qué consume |
|-----------|-------------|
| 1 (individual mono-tema) | Señales acumuladas del mismo topic, si existen |
| 2 (individual multi-tema) | Por cada topic con finding score ≥ 5: consume señales del topic correspondiente |
| 3 (focal acumulado) | Señales del topic focal (las que dispararon + cualquier otra del mismo topic en ventana) |
| 4 (arco narrativo) | Señales de **todos** los topics involucrados en el arco |

### Rollback

Si el post es rechazado (mal formado, alucinación detectada, ver Observability en §10):

```sql
-- Revertir consumo
UPDATE signal_events
SET consumed = FALSE, consumed_by_post_id = NULL, consumed_at = NULL
WHERE consumed_by_post_id = :rejected_post_id;

-- Revertir refractory
UPDATE signal_bank
SET last_fired_at = <valor_anterior>
WHERE <...>;
```

Requiere persistir el estado previo antes del disparo. Ver tabla `post_disparo_audit` en §10.

### Limitaciones conocidas de Opción B — cuándo migrar a Opción C

La Opción B asume que **todas las señales de un topic son conceptualmente equivalentes**. Esto es falso en algunos casos:

**Caso problemático:** un developer trabaja dos aspectos distintos del mismo topic en paralelo. Por ejemplo, en `testing`:
- 3 commits sobre unit tests del módulo de auth
- 2 commits sobre integration tests del módulo de pagos

Si se dispara un post sobre los unit tests de auth, la Opción B consume también las señales de integration tests de pagos, descartando material legítimamente distinto.

### Criterios para migrar a Opción C (consumo selectivo)

Migrar cuando al menos una de estas condiciones se cumpla en producción:

1. **Señales de tiempo perdidas.** Más del 20% de las `signal_events` consumidas tienen `pattern_kind` divergente del commit que disparó el post. Métrica: comparar string similarity entre `pattern_kind` del commit disparador y `pattern_kind` de las señales consumidas. Si < 0.5 en más del 20% de casos, migrar.

2. **Quejas cualitativas de developers.** Si los developers reportan "hice mucho trabajo en X y nunca se publicó", investigar si el problema es consumo prematuro por señales de Y en el mismo topic.

3. **Acumulación insuficiente cronica.** Si ciertos topics nunca cruzan threshold a pesar de tener commits frecuentes, puede ser que señales legítimas estén siendo consumidas por disparos en aspectos distintos del mismo topic.

### Opción C — consumo selectivo por similaridad de pattern_hint

Cuando se migre, la regla será:

```sql
UPDATE signal_events
SET consumed = TRUE, consumed_by_post_id = :post_id, consumed_at = NOW()
WHERE signal_bank_id IN (
  SELECT id FROM signal_bank
  WHERE tenant_id = :tenant
    AND github_author_login = :author
    AND topic = :T
)
  AND consumed = FALSE
  AND similarity(pattern_kind, :disparador_pattern_kind) >= 0.6
  AND accumulated_at > NOW() - make_interval(days => :ventana_dias);
```

Donde `similarity()` es Jaccard sobre tokens normalizados de `pattern_hint`, o eventualmente cosine similarity sobre embeddings.

Complejidad operativa adicional: fine-tuning del threshold de similaridad (0.6 es heurística), riesgo de fragmentar señales cuando no corresponde (generar posts sobre un mismo aspecto repetidamente). Por eso no es default en v2.

---

## 10. Database

### Storage dual: Supabase + SQLite

> **Corrección vs v1:** el spec v1 solo mencionaba `src/voice/supabase-storage.ts`. El sistema tiene storage dual — `src/voice/sqlite-storage.ts` (dev local) y `src/voice/supabase-storage.ts` (prod), ambos implementando `IVoiceStorage`. Se eligen por presencia de `SUPABASE_URL` (ver `src/main-poll.ts:68`). Toda migración debe aplicarse a ambos backends.
 
### Extender `pending_batch` (ya existe en Supabase, sin usar)

`pending_batch` ya incluye `tenant_id` y `author_login` en el esquema real (`database/schema.sql`). Cualquier extensión CEP debe referenciar **`tenant_id` → tenants**, no `auth.users`.

```sql
ALTER TABLE pending_batch
  ADD COLUMN IF NOT EXISTS signal_strength   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS topic_categories  TEXT[],
  ADD COLUMN IF NOT EXISTS proto_findings    JSONB,
  ADD COLUMN IF NOT EXISTS expires_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consumed          BOOLEAN DEFAULT FALSE;
```
 
### Nueva tabla `signal_bank`
```sql
CREATE TABLE signal_bank (
  id                    SERIAL PRIMARY KEY,
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  github_author_login   TEXT NOT NULL,
  repo                  TEXT NOT NULL,
  topic                 TEXT NOT NULL,         -- moduleId category
  weight_sum            FLOAT DEFAULT 0,       -- suma de pesos con decay aplicado
  signal_count          INTEGER DEFAULT 0,
  threshold_baseline    FLOAT NOT NULL DEFAULT 15, -- umbral base; threshold_effective se computa en runtime (§6)
  multiplier            FLOAT NOT NULL DEFAULT 0.5, -- modula excess post-disparo; adaptativo por edit_ratio (§13)
  half_life_refractory  FLOAT,                 -- días; NULL = usar valor calculado de §7
  commit_frequency      FLOAT,                 -- commits/día, calculado automáticamente
  first_signal_at       TIMESTAMPTZ,
  last_signal_at        TIMESTAMPTZ,
  last_fired_at         TIMESTAMPTZ,
  UNIQUE(tenant_id, github_author_login, repo, topic)
);

CREATE TABLE signal_events (
  id             SERIAL PRIMARY KEY,
  signal_bank_id INTEGER REFERENCES signal_bank(id),
  commit_sha     TEXT NOT NULL,
  strength       INTEGER NOT NULL,        -- raw, antes de decay
  pattern_kind   TEXT NOT NULL,
  consumed       BOOLEAN NOT NULL DEFAULT FALSE,
  consumed_by_post_id TEXT,
  consumed_at    TIMESTAMPTZ,
  affected_symbols TEXT[],
  specific_change  TEXT,
  accumulated_at   TIMESTAMPTZ DEFAULT NOW()
);
```
 Optimistic locking para race conditions: usar `SELECT FOR UPDATE` con debounce de 60s
cuando múltiples commits del mismo repo/topic llegan simultáneamente.

```

El check de `last_fired_at < NOW() - 60s` actúa como ventana de debounce: no dispara dos veces en menos de 60 segundos.

### Nueva tabla `post_disparo_audit`

Persiste el estado pre-disparo para habilitar rollback (§9). Un row por disparo.

```sql
CREATE TABLE post_disparo_audit (
  id                          SERIAL PRIMARY KEY,
  voice_post_id               TEXT NOT NULL REFERENCES voice_posts(id),
  tenant_id                   UUID NOT NULL REFERENCES tenants(id),
  github_author_login         TEXT NOT NULL,
  gatillador                  TEXT NOT NULL,       -- 'individual_mono'|'individual_multi'|'focal'|'arco'
  topics_consumed             TEXT[] NOT NULL,     -- topics cuyos signals se consumieron
  signal_bank_snapshots       JSONB NOT NULL,      -- [{id, weight_sum, signal_count, last_fired_at}] previos
  consumed_signal_event_ids   INTEGER[] NOT NULL,  -- IDs de signal_events marcados consumed
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Nueva tabla `routing_decisions_audit`

Registra cada decisión de routing arco vs focal para calibración de pesos (§8, Fase C).

```sql
CREATE TABLE routing_decisions_audit (
  id                    SERIAL PRIMARY KEY,
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  github_author_login   TEXT NOT NULL,
  voice_post_id         TEXT REFERENCES voice_posts(id),  -- NULL hasta que el post se genere
  commit_shas           TEXT[] NOT NULL,
  score_coherencia      FLOAT NOT NULL,
  score_structural      FLOAT NOT NULL,
  score_temporal        FLOAT NOT NULL,
  score_lexical         FLOAT NOT NULL,
  decision              TEXT NOT NULL,    -- 'arco' | 'focal_multiple'
  edit_ratio_result     FLOAT,           -- llenado post-publicación; fuente para calibración
  decided_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 11. Componentes nuevos

## Componentes nuevos (Fase B)
 
### `src/analysis/signal-extractor.ts` — Capa 2 (lazy)
Wrapper de Haiku. Recibe `EnrichedCommit` + estado actual de `signal_bank` para el topic.
Solo se invoca cuando `weight_sum(decayed) >= threshold_effective(computed) × 0.7` y el commit tiene score 0.
Devuelve `WeakSignal | null`.
 
Reutiliza `src/ai/anthropic-adapter.ts` (modelo configurado en
`src/config/schema.ts` como `classify_model: 'claude-haiku-4-5'`).
 
Prompt de Haiku: structured output JSON, instrucción explícita de devolver `null`
si el diff es whitespace/rename automático/cambio puramente cosmético.
 
### `src/analysis/accumulation-engine.ts` — Capas 3 y 3.5
 
**Reglas de disparo** (cualquiera activa síntesis):
```
POR TÓPICO:    signal_count >= 3  AND  weight_sum >= threshold_effective
               -- threshold_effective computado en runtime (§6):
               if last_fired_at IS NULL:
                   threshold_effective = threshold_baseline          -- topic nunca disparó: sin refractory
               else:
                   t      = days_since(last_fired_at)
                   excess = threshold_baseline × multiplier
                   threshold_effective = threshold_baseline + excess × exp(−μ_refractory × t)
               -- donde μ_refractory = ln(2) / half_life_refractory(author)  (§7)
POR VOLUMEN:   weight_sum cross-topic >= 25 en los últimos ventana_dias
POR TIEMPO:    señal con más de 14 días y sin post → síntesis forzada
```
 
Después de calcular disparo posible → Capa 3.5 valida coherencia narrativa (solo si multi-topic):
```
// Divide commits del window en mitad antigua y mitad reciente
topics_A = distinct topics de commits[0 .. floor(n/2)]   // más antiguos
topics_B = distinct topics de commits[floor(n/2) .. n]   // más recientes
coherencia_jaccard = |topics_A ∩ topics_B| / |topics_A ∪ topics_B|
si coherencia_jaccard < 0.4 → bloquea síntesis (arco inventado), sigue acumulando
```
 
Post-disparo: actualizar `last_fired_at`.
Recalcular `commit_frequency` en cada inserción.
 
### `src/ai/synthesis-prompt-builder.ts` — Capa 4
 
System prompt: reutiliza `buildSystemPrompt()` existente — misma voz, mismas reglas,
mismos bloques de industria. No se toca.
 
User prompt:
```xml
<commit_series>
  <commit date="..." sha="..." message="..." repo="...">
    <signal module="performance" strength="6" pattern_kind="behavioral_change">
      timeout 5s→30s en fetchUser (símbolo: fetchUser)
    </signal>
  </commit>
  ...
</commit_series>
<synthesis_task>
  Write a post about the arc across these commits.
  Topic: performance. N commits over X days.
  Last post on this topic: [resumen del último post o "none"].
  Emphasize evolution and intent, not individual changes.
</synthesis_task>
```

### `src/ai/synthesis-generator.ts` — paralelo a `post-generator.ts`
Llama a Sonnet con el prompt de `synthesis-prompt-builder.ts`.
Pasa resultado al sistema de scheduling existente en `src/scheduling/`.

### `src/analysis/coherence-router.ts` — Routing arco vs focal (§8)

Calcula `score_coherencia` sin LLM a partir de commits candidatos. Implementa la heurística léxico-estructural basada en Kuhn (2007).

```typescript
interface CoherenceScore {
  structural: number;  // Jaccard de archivos (peso 0.5)
  temporal: number;    // densidad temporal (peso 0.2)
  lexical: number;     // Jaccard de tokens de commit messages (peso 0.3)
  total: number;       // weighted sum
  decision: 'arco' | 'focal_multiple';
}

function scoreCoherence(
  commits: EnrichedCommit[],
  author: AuthorProfile
): CoherenceScore {
  const structural = jaccardFiles(commits);
  const temporal   = computeTemporalDensity(commits, author.medianInterval);
  const lexical    = jaccardMessageTokens(commits);

  const total = 0.5 * structural + 0.2 * temporal + 0.3 * lexical;

  let decision: 'arco' | 'focal_multiple';
  if (total >= 0.6)      decision = 'arco';
  else                    decision = 'focal_multiple';  // incluye banda gris y bajo

  return { structural, temporal, lexical, total, decision };
}
```

**Helpers:**
- `jaccardFiles(commits)`: Jaccard similarity entre sets de file paths. Fallback a nivel de directorio si intersección directa < 0.2.
- `computeTemporalDensity(commits, medianInterval)`: devuelve 1 si `span < 3 × medianInterval`, 0 en caso contrario.
- `jaccardMessageTokens(commits)`: tokeniza commit messages, elimina stopwords y prefijos convencionales (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `style:`, `perf:`, `build:`, `ci:`), normaliza case, calcula Jaccard sobre sets de tokens.

Cada invocación registra un row en `routing_decisions_audit` (§10) para calibración futura.

### `src/analysis/signal-consumer.ts` — Consumo post-disparo (§9)

Implementa Opción B: al disparar un post, consume todas las señales no consumidas del topic(s) involucrado(s) y resetea el agregado.

```typescript
interface ConsumptionResult {
  postId: string;
  consumedSignalIds: number[];
  signalBankPrev: SignalBankSnapshot[];  // para rollback
}

async function consumeSignalsForPost(
  postId: string,
  gatillador: 'individual_mono' | 'individual_multi' | 'focal' | 'arco',
  topics: string[],
  author: string,
  tenant: string
): Promise<ConsumptionResult> {
  // 1. Persistir snapshot en post_disparo_audit
  // 2. Marcar signal_events como consumed (transacción)
  // 3. Resetear signal_bank agregado y set last_fired_at
  // 4. Retornar IDs para posible rollback
}

async function rollbackPostConsumption(postId: string, reason: string): Promise<void> {
  // Lee post_disparo_audit, revierte consumed y restaura signal_bank
}
```

### `src/ai/synthesis-prompt-builder.ts` — Prompts para Capa 4

Construye el prompt de Capa 4 según el gatillador. Reutiliza `buildSystemPrompt()` y `buildIndustryContextBlock()`.

**Variante FOCAL (Gatillador 3):**

```xml
<commit_series>
  <commit date="..." message="..." repo="...">
    <signal module="testing" strength="6">
      patternHint aquí
    </signal>
  </commit>
  ...
</commit_series>
<synthesis_task>
  Write a post about what this developer did in [topic] across N commits
  spanning X days. Focus on the depth and quality of the work in this
  single area. Do NOT try to connect it to other topics not mentioned.
  Last post on this topic: [resumen o "none"].
</synthesis_task>
```

**Variante ARCO (Gatillador 4):**

```xml
<commit_series>
  <commit date="..." message="..." repo="...">
    <signal module="design_patterns" strength="5">patternHint</signal>
    <signal module="testing" strength="4">patternHint</signal>
  </commit>
  ...
</commit_series>
<coherence_evidence>
  <shared_files>auth/login.ts, auth/session.ts, ...</shared_files>
  <span_days>4</span_days>
</coherence_evidence>
<synthesis_task>
  Write a post about the arc spanning [topics] across these commits.
  The commits share context (same files, short timespan) — emphasize the
  evolution and how the topics connect in this work. Do NOT invent
  connections beyond what the code shows.
  Last post on related topics: [resumen o "none"].
</synthesis_task>
```

La inclusión de `<coherence_evidence>` en el prompt de arco es intencional — ancla a Sonnet a la evidencia estructural que justificó el routing a arco, reduciendo el riesgo de alucinación narrativa.

### `src/ai/synthesis-generator.ts` — Sonnet Capa 4

Paralelo a `post-generator.ts`. Recibe la serie de commits y señales, genera el post de síntesis.

### `database/migrations/002_signal_bank.sql`

Schema de `signal_bank` + `signal_events` + `post_disparo_audit` + `routing_decisions_audit` + extensión de `pending_batch`.

### Observability para Capa 4

> **Corrección vs v1:** el spec v1 no tenía rollback ni observability para posts de síntesis.

- **Dead-letter queue:** posts rechazados (mal formados, alucinación detectada) se almacenan para análisis. Tabla `rejected_synthesis` con motivo de rechazo.
- **Métricas:** rate de `edit_ratio` en posts de síntesis vs posts individuales. Si síntesis consistentemente tiene mayor edit_ratio, el threshold POR TÓPICO necesita subir.
- **Rollback de threshold:** si un post de síntesis se rechaza, `last_fired_at` se revierte — `threshold_effective` se computa en runtime desde `last_fired_at`, así que revertirlo es suficiente.

---

## 12. Cambios a archivos existentes

| Archivo | Cambio |
|---------|--------|
| `src/analysis/diff-parser.ts` | `extractAddedLines(patch)` + `extractRemovedLines(patch)` — centralizan lógica hoy inline en cada módulo. `extractFirstHunkSnippet()` — snippets reales para evidence. Extraer `hunks[].functionName` de headers `@@ ... @@` |
| `src/analysis/types.ts` | `FileDiff.hunks?: Array<{functionName?: string}>`. Extender tipo de retorno de `CodeAnalyzer` para soportar `{ kind: 'delta_hit', topic: string, strength: number }` además de `Finding \| null` (necesario para bilateral hit de §3 A2) |
| `src/analysis/pipeline.ts` | Score ≥ 5 → post directo. Score 1-4 → un WeakSignal gratuito por topic con finding (strength = score del topic). Score 0 → skip. Si ≥ 2 findings score ≥ 5 en topics distintos → Gatillador 2 |
| `src/ai/prompt-builder.ts` | Incluir `commit.body` en `<commit>` si no está vacío |
| `src/ai/post-generator.ts` | Invocar una vez por finding score ≥ 5 en Gatillador 2. Consumir señales del topic respectivo vía `signal-consumer.ts` |
| `src/main-poll.ts` (y `src/worker/process-job.ts`) | Tras procesar commits, llamar `accumulationEngine.check(tenantId, githubAuthorLogin, repo)` |
| `src/voice/supabase-storage.ts` | Métodos para `signal_bank`, `signal_events`, `post_disparo_audit`, `routing_decisions_audit` y `pending_batch` extendido |
| `src/voice/sqlite-storage.ts` | **Migración paralela** de todas las tablas para dev local |
| `src/analysis/modules/*.ts` | Delta-awareness en los 22 módulos vulnerables (21 restantes + evolutionary) |
| `src/analysis/modules/index.ts` | Sin cambios — los exports no se tocan |
| `src/config/schema.ts` | Agregar `post_language: z.enum(['en', 'es']).default('en')` a `VoiceProfileSchema`. Agregar `post_language: 'en'` a `DEFAULT_VOICE_PROFILE` |
| `src/ai/prompt-builder.ts` (idioma) | Nueva función privada `buildLanguageInstruction(language)`. Llamar en `buildSystemPrompt()` después del bloque `<author>` |
| `src/github/client.ts` | Reemplazar `getRepoVisibility(): Promise<boolean>` por `getRepoMeta(): Promise<RepoMeta>` (misma llamada REST, más campos: `isPrivate`, `isFork`, `parentOwner?`, `parentRepo?`). Agregar `listPullsForRef(forkOwner, forkRepo, branchRef): Promise<PrLookupResult[]>` usando GitHub GraphQL API. Cache in-memory para ambos métodos (TTL 7 días). Nueva dependencia: `@octokit/graphql` o `fetch` nativo |
| `src/github/commit-enricher.ts` | Agregar `prContext?: PrContext` a `EnrichedCommit`. Agregar `branchRef?: string` como parámetro opcional a `enrichCommit()`. Usar `getRepoMeta()` en lugar de `getRepoVisibility()`. Si `isFork === true` y `branchRef` definido: llamar `listPullsForRef()` y `detectOutcome()`. Nuevos tipos: `PrOutcome`, `PrContext`, `PrLookupResult` |
| `src/ai/prompt-builder.ts` | Agregar instrucción anti-authority en `buildSystemPrompt()`. Agregar bloque `<contributor_voice>` en `buildUserPrompt()` cuando `ctx.prContext` existe, con `outcomeText` específico por `PrOutcome` y reglas de voz para `closed_superseded` |

---

## 13. Protección anti-repetición

### WeakSignal — estructura de señal (Capa 2 → Capa 3)
 
```typescript
interface WeakSignal {
  topic: string;              // moduleId category (e.g. 'performance', 'security')
  strength: number;           // 1–10 (Haiku evalúa)
  pattern_kind:               // enum para routing y coherencia
    | 'new_abstraction'
    | 'contract_change'
    | 'semantic_refactor'
    | 'config_change'
    | 'dependency_update'
    | 'behavioral_change';
  affected_symbols: string[]; // nombres de funciones/clases/tipos afectados
  specific_change: string;    // descripción en 1 línea: "timeout 5s→30s en fetchUser"
  commit_sha: string;
  repo: string;
  tenant_id: string;          // tenants.id (instalación GitHub App)
  github_author_login: string;
  accumulated_at: string;     // ISO timestamp, para decay
}
```
 
`pattern_kind` permite a Capa 3.5 verificar coherencia: un arco narrativo válido
mezcla tópicos compatibles (e.g., `new_abstraction` + `semantic_refactor`) pero no
`config_change` + `security` sin relación estructural.
 
---

---
 
## edit_ratio feedback loop
 
`edit_ratio` = (caracteres editados post-publicación) / (caracteres totales del post).
 
**Fórmula del multiplier:**
```
multiplier(github_author_login, topic) = 0.5 + 2.0 × mean_edit_ratio_last_10
```
Default: `0.5` (sin historial de publicaciones). Ejemplo: `mean_edit_ratio = 0.5` → `multiplier = 1.5`.

El `multiplier` modula el excess post-disparo (§6): `excess = threshold_baseline × multiplier`.
A mayor edit_ratio promedio → mayor excess → refractory más largo → más acumulación requerida
antes del próximo disparo en ese tópico.

**Cómo se recalcula:**
El multiplier se actualiza cada vez que se persiste un nuevo `edit_ratio` en `voice_posts`
(opción a: recalcular en escritura — barato a ~100 posts/autor/año). Hook en `sent-scanner.ts`:
tras persistir `edit_ratio`, recalcular `mean_edit_ratio_last_10` para `(github_author_login, topic)`
y actualizar `signal_bank.multiplier`.

**Protección adicional:**
- Haiku en Capa 3 evalúa novedad explícita: "¿hay algo nuevo vs. el último post de
  este tópico?" — no solo suficiencia de señal.
- El freshness multiplier existente (para módulos en posts individuales) se mantiene
  intacto.
---
 
## Scheduling — 1 post/día/destino
 
Los posts de síntesis (gatilladores 3 y 4) pasan por una capa de scheduling antes
de llegar a Buffer:
 - TTL máximo en cola: 72 horas (post expirado si no se publica → descarta)
- Prioridad: `strength_sum DESC, accumulated_at ASC` (más señal primero, más antiguo
  primero en empate)
- Límite: 1 post por día por destino (LinkedIn, Twitter, etc.)
- Scheduling integrado con el sistema existente en `src/scheduling/`
---

## 14. Costos por commit

> **Corrección vs v1:** el spec v1 estimaba Haiku en ~$0.001 por call. Eso solo es alcanzable con prompt caching.

### Pricing base (Anthropic, sin caching)

- Haiku 4.5: $1/MTok input, $5/MTok output
- Un commit típico: ~5K tokens input + ~500 tokens output = **~$0.0075 por call Haiku**

### Con prompt caching

Prompt caching reduce hasta 90% el costo de tokens de input cacheados. Para que funcione, el system prompt (instrucciones + formato de output) debe ser estable entre calls — solo el user prompt (diff + commit message) varía.

Con caching efectivo: ~$0.001-0.002 por call Haiku.

**Requisito:** diseñar prompts de Capa 2 y Capa 3 con estructura estable. El spec v1 no lo mencionaba.

### Tabla de costos por escenario

| Escenario | Capas ejecutadas | Costo sin caching | Costo con caching |
|-----------|-----------------|-------------------|-------------------|
| Trivial (Capa 0 descarta) | 0 | $0.000 | $0.000 |
| Patrón fuerte, post directo | 0 + 1 + Sonnet | $0.006 | $0.006 |
| Score 1-4, acumula (WeakSignal gratuito) | 0 + 1 | $0.000 | $0.000 |
| Score 0, skip | 0 + 1 | $0.000 | $0.000 |
| Near threshold, Haiku lazy (score 0, N-1 señales) | 0 + 1 + Haiku×1 | ~$0.008 | ~$0.002 |
| Acumulación dispara síntesis | 0 + 1 + Haiku lazy + Sonnet | ~$0.014 | ~$0.008 |
| PR lookup (feature branch, Fase A.5) | 1 GraphQL query | $0.000 | $0.000 |

**Nota sobre quota de GitHub GraphQL (P6):** cada query gasta ~5–8 points contra la quota horaria de 5,000 points para GitHub Apps autenticadas. A escala de 1,000 commits/día con una tasa de PR lookup del 30% (commits en feature branches): ~300 queries × 8 points = 2,400 points/hora — margen del 50% sobre la quota. A escala alta (10,000+ commits/día) monitorear `X-RateLimit-Remaining` en el response header de la query GraphQL.

---

## 15. Orden de implementación
 
### FASE A — Corrección de raíz ⛔ BLOQUEANTE para Fase B
 
1. `extractAddedLines(patch)` + `extractRemovedLines(patch)` en `src/analysis/diff-parser.ts`
2. Delta-awareness en los 22 módulos vulnerables (guardia `!pattern.test(removedText)`)
3. `extractFirstHunkSnippet(patch, maxLines)` en `src/analysis/diff-parser.ts`
4. Evidence con código real en módulos sin `evidence.before` / `evidence.after`
5. `commit.body` en `buildUserPrompt()` — máx 5 líneas, guard trim
**Verificación de Fase A antes de continuar:**
- Sustitución mecánica → 0 findings → no se llama a Claude ✓
- Patrón genuinamente nuevo → módulo dispara normalmente ✓
- `evidence.before` / `after` contienen snippet real ✓
- `commit.body` aparece en el user prompt cuando no está vacío ✓

### FASE A.5 — PR-context awareness y anti-authority (implementar tras Fase A, antes de Fase B)

A.5.1. `getRepoMeta()` en `src/github/client.ts` — misma llamada REST que `getRepoVisibility()`, devuelve `RepoMeta` con `isPrivate`, `isFork`, `parentOwner?`, `parentRepo?`. Cache in-memory TTL 7 días. Actualizar `commit-enricher.ts` para usar `getRepoMeta()`.

A.5.2. Dependencia GraphQL (`@octokit/graphql` o native `fetch`) + `listPullsForRef()` en `src/github/client.ts` con la query de §3.5.3. Cache in-memory TTL 7 días keyed por `"${forkOwner}/${forkRepo}#${branchRef}"`.

A.5.3. Tipos `PrOutcome`, `PrContext`, `PrLookupResult` en `src/github/commit-enricher.ts` (o `src/github/pr-types.ts`).

A.5.4. `detectOutcome()` — heurística de §3.5.5 en `commit-enricher.ts`. Sin LLM.

A.5.5. Extender `enrichCommit(github, owner, repo, sha, fallbackAuthorLogin, branchRef?)` para recibir `branchRef` y poblar `EnrichedCommit.prContext` cuando `isFork === true`.

A.5.6. Extender `EnrichedCommit` con campo `prContext?: PrContext`.

A.5.7. `buildUserPrompt()` — insertar bloque `<contributor_voice>` de §3.5.6 cuando `ctx.prContext` existe.

A.5.8. `buildSystemPrompt()` — agregar instrucción anti-authority de §3.5.6 (aplica a todos los casos, con y sin prContext).

A.5.9. `process-job.ts` — pasar `job.ref` (ya disponible en el job record, verificado en línea 138) a `enrichCommit()` como `branchRef`.

### FASE A.6 — Idioma del post (implementar tras Fase A.5, antes de Fase B)

A.6.1. `post_language: z.enum(['en', 'es']).default('en')` en `VoiceProfileSchema` + `DEFAULT_VOICE_PROFILE`.

A.6.2. `buildLanguageInstruction(language)` en `prompt-builder.ts` + inyección en `buildSystemPrompt()` después del bloque `<author>`.

**Verificación de Fase A.6:**
- Perfil sin `post_language` → default `'en'` → prompt incluye bloque B2 ✓
- Perfil con `post_language: 'es'` → prompt incluye bloque en español ✓
- Post en inglés → vocabulario B2, sin idioms ✓
- Post en español → sin anglicismos innecesarios ✓

**Verificación de Fase A.5 antes de continuar a Fase B:**
- Fork commit con PR merged → `prContext.outcome === 'merged'` → prompt incluye `<contributor_voice>` con upstream correcto ✓
- Fork commit con PR closed + maintainer comment con `#N` → `outcome === 'closed_superseded'`, `supersededEvidence.maintainerComment` poblado, `confidence === 'high'` ✓
- Fork commit con PR closed sin maintainer comment → `outcome === 'closed_unmerged'` ✓
- Fork sin PR asociado al branch → `prContext === undefined` → sin bloque contributor_voice ✓
- Commit en repo propio → `isFork === false` → `prContext === undefined` → comportamiento existente ✓
- Post generado → texto sin frases "correct approach", "well-designed", "right way" sin evidencia ✓

### FASE B — CEP (implementar tras Fase A, lanzar juntos)

> **BLOCKER[BLK-1]** `avg_edit_ratio = 0.00` en producción (verificado 2026-04-20) — el sent-scanner no está capturando edit_ratio. Si no se resuelve: `multiplier` de §13 se queda estático en `0.5` (default) y el período refractario de §6 no se adapta por autor. Investigar `src/buffer/sent-scanner.ts` antes de activar Fase B en producción. **Fase B requiere BLK-1 resuelto.**

6. `FileDiff.hunks` en `types.ts` + parser de `functionName` en `diff-parser.ts`
7. Migración DB: `database/migrations/YYYY-MM-DD-signal-bank.sql`
8. `supabase-storage.ts` — métodos para `signal_bank` y `signal_events`
9. `pipeline.ts` — delta-awareness hit → `WeakSignal(strength=2)`; findings score 1-4 → `WeakSignal(strength=score)` por topic; score 0 → skip
10. `signal-extractor.ts` — Haiku lazy (condición: `weight_sum >= threshold_effective(computed) × 0.7 AND score 0`)
11. `accumulation-engine.ts` — decay exponencial + Capa 3 + Capa 3.5
12. `synthesis-prompt-builder.ts` + `synthesis-generator.ts` — Capa 4
13. `src/main-poll.ts` + `src/worker/process-job.ts` — hook post-ciclo de acumulación

### Fase C — Calibración (en producción con datos reales)

> **Datos reales disponibles al 2026-04-20:** 5 autores (lilicurl, Khalzz, vialabs-net, odtorres, korutx), 122 posts totales. `type_system` disparó 6 veces en 16 días para lilicurl, 2 veces en 1 día para Khalzz. Con los parámetros iniciales (`threshold=3`), Fase B hubiera generado síntesis 2-3 veces en ese periodo. Los parámetros iniciales son razonables — calibrar con datos de los primeros 30 días post-lanzamiento.

> **TODO:CALIBRATE[CAL-1]** `k_signal = 9`, `k_refractory = 6` (§7) — calibrar con medianas reales de intervalos de commits por autor. Criterio de ajuste: si síntesis < 1/mes por autor activo → bajar `k_signal`; si > 3/semana → subirlo. Datos mínimos: 10+ commits por autor con 14+ días de historial.

> **TODO:CALIBRATE[CAL-2]** `LAZY_THRESHOLD_RATIO = 0.7` (§4, Capa 2 lazy) — calibrar midiendo cuántos Haiku calls se activan vs cuántos disparan WeakSignal. Si > 50% de calls devuelven `null` → subir ratio a 0.8. Si la síntesis tarda demasiado → bajar a 0.6.

> **TODO:CALIBRATE[CAL-3]** `threshold_baseline = 15` y `signal_count >= 3` (§11, accumulation-engine) — calibrar con frecuencia real de disparos en primeros 30 días. Criterio: 1-2 posts de síntesis por autor activo por mes es la zona objetivo.

> **TODO:CALIBRATE[CAL-4]** pesos de coherencia (0.5/0.2/0.3) y threshold (0.6) (§8) — calibrar con correlación `score_coherencia` ↔ `edit_ratio` de posts de arco. Requiere ≥ 20 posts de síntesis para tener señal estadística.

14. Análisis de sensibilidad con fixtures sintéticos de coherencia (§8)
15. Dashboard de correlación `score_coherencia` ↔ `edit_ratio`
16. Monitoreo de criterios de migración a Opción C (§9): % de señales consumidas con pattern_hint divergente

---

## 16. Verificación end-to-end
### Fase A (ejecutar antes de tocar Fase B)
 
1. **Sustitución mecánica**: commit con mismo patrón en `+` y en `-` (valor distinto,
   estructura igual) → módulo detecta en ambos lados → return null → 0 findings →
   no se llama a Claude → no se genera post.
2. **Patrón genuinamente nuevo**: commit que introduce patrón que no estaba en `-`
   → módulo dispara normalmente → finding con score ≥ 5 → post generado.
3. **Evidence real**: módulo dispara → `evidence.before` contiene snippet de líneas
   eliminadas, `evidence.after` contiene snippet de líneas añadidas.
4. **commit.body en prompt**: `EnrichedCommit` con body → user prompt incluye `Body:`
   con hasta 5 líneas del mensaje del ingeniero.
### Fase A.5 — PR-context awareness

14. **Fork con PR merged**: push event de fork, `job.ref = "refs/heads/feature-x"`, PR encontrado con `state: MERGED`, `baseRepository = upstream/project` → `EnrichedCommit.prContext.outcome === 'merged'` → user prompt incluye `<contributor_voice>` con `outcomeText` que cita el upstream, no el fork.
15. **Fork con PR closed_superseded**: PR `state: CLOSED`, timeline incluye comentario de maintainer que no es el fork author con texto `"Merged in #89"` → `outcome === 'closed_superseded'`, `supersededEvidence.maintainerComment` contiene los primeros 200 chars, `supersededEvidence.supersededByPr === 89`, `confidence === 'high'`.
16. **Fork con PR closed sin evidencia de incorporación**: PR `state: CLOSED`, timeline sin comentarios de maintainer con referencia → `outcome === 'closed_unmerged'`, `supersededEvidence === undefined`.
17. **Anti-authority en post generado**: commit con findings de devops → post generado → texto no contiene frases como "correct approach", "well-designed", "senior-level judgment", "best practice" sin respaldo en el commit message o diff.
18. **Idioma inglés B2**: perfil con `post_language: 'en'` (o sin el campo) → system prompt contiene bloque `<language>` con instrucción B2. Post generado no usa phrasal verbs oscuros, expresiones idiomáticas, ni vocabulario C1+.
19. **Idioma español**: perfil con `post_language: 'es'` → system prompt contiene bloque `<language>` en español → post generado en español latinoamericano.
20. **M2 — Race condition TTL `open`** (bajo prioridad): simular PR en cache con outcome `open`, TTL 12h. Después de 12h de mock, procesar otro commit del mismo branch → cache miss → re-query → outcome actualizado a `merged` si el PR fue mergeado durante ese intervalo. Verificar que el segundo post recibe el outcome correcto.

### Fase B (solo después de Fase A verificada)
 
5. **Capa 2**: commit con cambio semántico + message descriptivo → Haiku devuelve
   `WeakSignal` con `strength >= 4` y `pattern_kind` válido.
6. **Capa 2 con diff trivial**: diff solo de whitespace → Haiku devuelve `null` → no
   se deposita en `signal_bank`.
7. **Acumulación**: 3 `WeakSignals` del mismo `(tenant_id, github_author_login, repo, topic)` →
   `weight_sum` supera `threshold_effective(computed)` → `check()` señala disparo.
8. **Capa 3.5 coherencia**: señales de topics incompatibles → Jaccard < 0.4 → bloquea
   síntesis → sigue acumulando.
9. **Decay exponencial (§5 + §7 canónico):** con `t = half_life_signal(author)` días,
   `signal_value(t) / original_strength ≈ 0.5` (porque `λ_signal = ln(2)/half_life_signal`).
10. **Periodo refractario (§6 + §7 canónico):** tras disparo, con `t = half_life_refractory(author)`,
    el término `exp(−μ_refractory × t)` vale `0.5` (el exceso sobre `baseline` se reduce a la mitad).
11. **edit_ratio feedback**: 10 posts con edit_ratio=0.5 para un topic →
    `multiplier = 0.5 + 2.0 × 0.5 = 1.5` → `excess = threshold_baseline × 1.5` → refractory más largo.
12. **Path actual intacto**: commit con score ≥ 5 → post individual inmediato →
    no pasa por SignalBank → sin costo de Haiku.
13. **E2E manual**: 4 commits atómicos del mismo tópico → al 3er o 4to,
    `accumulation-engine` dispara → post llega a scheduling con `<commit_series>`

        como base narrativa → 1 post/día/destino respetado.


### Fase C — Calibración en producción

| Test | Qué verifica | Criterio de éxito |
|------|-------------|-------------------|
| Fixtures sintéticos de coherencia | Sanity check de pesos | 5 casos sintéticos (arco puro, independientes puro, solo archivos, solo tiempo, solo mensajes) clasifican según tabla esperada en §8 |
| Correlación score ↔ edit_ratio | Calibración basada en feedback | Posts de arco con `edit_ratio > 0.5` consistentemente → ajustar threshold hacia arriba; documentar ajuste |
| Criterios migración Opción C | Monitoreo continuo | Dashboard alerta si % de señales consumidas con `similarity(pattern_hint) < 0.5` supera 20% |

---

## 17. Changelog vs v1

### Novedades v2.6.0 — PR-context awareness y anti-authority

| Área | Antes (v2.5.1) | Ahora (v2.6.0) |
|------|----------------|----------------|
| §1 Problema raíz | Un eje de alucinación (delta hallucination) | Tres ejes: delta hallucination, authority hallucination, context blindness |
| §3.5 (nuevo) | No existía | Fork detection + PR lookup GraphQL + PrOutcome/PrContext + heurística `closed_superseded` + bloque `<contributor_voice>` + regla anti-authority |
| §12 | 10 filas | +3 filas: `client.ts` (getRepoMeta + listPullsForRef), `commit-enricher.ts` (prContext), `prompt-builder.ts` (contributor_voice + anti-authority) |
| §15 | Fase A → B → C | Fase A.5 añadida entre A y B (9 pasos + 6 criterios de verificación) |
| §16 | 13 tests | +4 tests (14–17) para PR context y anti-authority |
| Endpoint PR lookup | No especificado | GraphQL `Ref.associatedPullRequests` — único que devuelve PRs en estado CLOSED (REST omite closed-unmerged) |
| Terminología | N/A | `closed_superseded` (canónica: Bitbucket docs; Kalliamvakou et al., MSR 2014) |
| Detection layer | N/A | Capa 0/1 (commit-enricher) — sin LLM, sin costo adicional |
| `branchRef` en job | `job.ref` disponible en DB (verificado `process-job.ts:138`) pero no se pasaba a `enrichCommit` | Ahora se pasa como parámetro opcional — no requiere cambio de schema |
| §3.5.2 `RepoMeta.defaultBranch` | No incluido | Agregado `defaultBranch: string` a `RepoMeta` — sin costo extra, mismo `repos.get()`. Usado en P4 |
| §3.5.3 TTL de cache | TTL uniforme 7 días para todos los outcomes | TTL diferenciado: `open` → 12h, `merged/closed_*` → 7d, sin PR → 1h (P3) |
| §3.5.3 condición de activación | `isFork === true` | `isPushToNonDefaultBranch` — cubre también repos propios con feature branches (P4) |
| §3.5.3 GraphQL quota | No documentado | Nota de ~5–8 points/query, margen 50x a escala media. Monitorear `X-RateLimit-Remaining` a escala alta (P6) |
| §3.5.5 regex de detección | OR de 3 regex independientes → falsos positivos en mensajes de rechazo | Co-presencia de señales: verbo de incorporación + referencia, o agradecimiento + referencia (P2) |
| §3.5.5 confidence levels | `'high'` solo emitido; `'medium'`/`'low'` en el tipo pero nunca asignados | Tres niveles alineados con lógica: `high` = verbo+ref, `medium` = gracias+ref, `low` = eliminado (P1) |
| §3.5.6 gate en contributor_voice | Sin gate — `closed_superseded` se activaba con cualquier confidence | Gate explícito: solo `confidence === 'high'` activa path `closed_superseded`. `medium` → `closed_unmerged` (P2) |
| §3.5.6 regla para outcome `open` | No había regla explícita — Claude podría afirmar contribución aceptada | Regla explícita: describir como propuesto y en revisión, sin predecir reacciones. "I proposed" ✓ / "I added" ✗ (P5) |
| §14 tabla de costos | Sin fila para PR lookup | Fila añadida: `$0.000` monetario + nota de quota de GitHub GraphQL (P6) |
| §3.6 (nuevo) | No existía | Idioma del post por perfil: `'en'` (B2) o `'es'`. Campo `post_language` en `VoiceProfileSchema`. Bloque `<language>` en `buildSystemPrompt()`. Default `'en'` — todos los perfiles existentes pasan a B2 |
| §12 | 13 filas | +2 filas: `schema.ts` (post_language), `prompt-builder.ts` (buildLanguageInstruction) |
| §15 | Fase A → A.5 → B → C | Fase A.6 añadida entre A.5 y B (2 pasos + 4 criterios de verificación) |
| §16 | 17 tests | +2 tests (18–19) para idioma |

### Errores factuales corregidos

| ID | Error en v1 | Corrección |
|----|------------|------------|
| A1 | "17 de 19 módulos", "15 restantes" | 24 módulos totales, 22 sin delta-awareness completa (21 vulnerables + evolutionary parcial). Conteo verificado contra `src/analysis/modules/` |
| A2 | Solo menciona `supabase-storage.ts` | Storage dual: SQLite (dev) + Supabase (prod). Migración debe aplicarse a ambos |
| A3 | No existe tabla de señales individuales | Añadida tabla `signal_events` para registros crudos que alimentan Capa 4 |
| A4 | "Retornar weak findings en lugar de vacío" | Pipeline descarta definitivamente findings < 5. Capa 2 recibe commits completos, no weak findings |
| A5 | `isInteresting()` sin referencia a archivo | Referenciado correctamente: `src/utils/commit-filter.ts` |
| A6 | No menciona Haiku ya integrado | Haiku ya existe via `classify_model` en schema + `anthropic-adapter.ts`. Reutilizar, no duplicar |
| A7 | No menciona `buildIndustryContextBlock()` | Incluido explícitamente en Capa 4 |

### Errores de diseño corregidos

| ID | Error en v1 | Corrección |
|----|------------|------------|
| B1 | Sin estrategia para race conditions | `UPDATE ... RETURNING` con debounce de 60s en `last_fired_at` |
| B2 | Sin bootstrap de `commit_frequency` | Fallback de 7 días con blend suave (`weight = min(1, commits/10)`) |
| B3 | Regla POR TIEMPO fuerza síntesis con 1 señal | Requiere `signal_count >= 2` incluso en disparo por tiempo |
| B4 | Costos Haiku estimados en $0.001 | Costo real ~$0.005-0.008 sin caching. Requiere prompt caching para $0.001-0.002. Documentado |
| B5 | `edit_ratio` feedback loop sin especificar | Definido: fórmula de multiplier, umbrales, persistencia por developer/tenant |
| B6 | Sin rollback/observability para Capa 4 | Dead-letter queue, métricas de edit_ratio comparativas, rollback de threshold en rechazo |
| B7 | `signal_bank` sin `tenant_id` | Añadido `tenant_id` a PK compuesta de `signal_bank` y `signal_events` |

### Mejoras de diseño

| Área | v1 | v2 |
|------|----|----|
| Decay de señales | `peso = strength × max(0.3, 1 - dias/ventana)` (lineal con floor) | `strength × exp(−λ_signal × t)` (exponencial, sin floor arbitrario) |
| Threshold post-disparo | `× 2`, decay 1pt/día (lineal) | `baseline + excess × exp(−μ_refractory × t)` (exponencial, sin precipicio) |
| Half-life | Fijo (implícito en ventana_dias) | Dual y adaptativo por autor: `half_life_signal = k_signal × median_interval` (k=9), `half_life_refractory = k_refractory × median_interval` (k=6). Proporción ~1.5×. Fallback y blend para cold start. Justificación: Koren (2009), SM-2/FSRS, neurociencia computacional |
| Nomenclatura de patrones | "Arquitectura CEP" (impreciso) | 5 patrones nombrados y referenciados: Cascading Classifier, CEP, Signal Accumulation, Tiered Inference, Refractory Period |
| Costos | $0.001 por Haiku (sin caveats) | Tabla con/sin caching, requisito explícito de prompt caching |
| Capa 2 (Haiku) | Corre en todos los commits débiles (~$0.002/commit con caching) | Lazy: solo cuando `weight_sum >= threshold_effective(computed) × 0.7` y `score = 0`. Score 1-4 → WeakSignal gratuito desde módulos. La mayoría de commits acumulan a $0.000 |

### Novedades v2.5.1 — Correcciones de diseño: threshold runtime y multiplier

| Área | Antes (v2.5.0) | Ahora (v2.5.1) |
|------|----------------|----------------|
| §1 intro | "Los 23 restantes solo leen líneas +" (impreciso) | "22 de los 24 tienen vulnerabilidad completa o parcial" (21 + evolutionary parcial) |
| §17 A1 | "~20 sin delta-awareness" | "22 sin delta-awareness completa (21 vulnerables + evolutionary parcial)" |
| §3 A2 bilateral hit | Caía silencioso a `null` sin mecanismo de WeakSignal | Emite `{ kind: 'delta_hit', topic, strength: 2 }`. Nota de extensión de `CodeAnalyzer` en `types.ts:69-92` |
| §10 DDL signal_bank | `threshold_current FLOAT DEFAULT 15`, `threshold_edit_factor FLOAT DEFAULT 1.0` | `threshold_baseline FLOAT NOT NULL DEFAULT 15`, `multiplier FLOAT NOT NULL DEFAULT 0.5`, `half_life_refractory FLOAT` |
| §9 SQL post-disparo | `threshold_current = threshold_current * (1 + :multiplier)` en UPDATE | Eliminado — threshold_effective se computa en runtime |
| §9 Rollback | `threshold_current = <valor_anterior>` | Eliminado — rollback solo toca `last_fired_at` |
| §11 accumulation-engine | `threshold_effective = threshold_current × threshold_edit_factor` | Runtime con branch: `if last_fired_at IS NULL → threshold_effective = threshold_baseline` (sin refractory). Si hay disparo previo: `excess = threshold_baseline × multiplier; threshold_effective = threshold_baseline + excess × exp(−μ × t)`. Bug corregido: `t = 0` cuando NULL daría máximo, no baseline. |
| §4/§11/§15 condición lazy | `threshold_current × 0.7` | `threshold_effective(computed) × 0.7` |
| §13 multiplier | `threshold_adjusted = baseline × (1 + 2.0 × mean_edit_ratio)` + `threshold_edit_factor DEFAULT 1.0` (dos fórmulas conflictivas) | `multiplier = 0.5 + 2.0 × mean_edit_ratio_last_10`, default `0.5`. Recálculo via hook en sent-scanner al persistir edit_ratio |
| §15 BLK-1 | Mencionaba `threshold_edit_factor` | "Fase B requiere BLK-1 resuelto" — si no, multiplier estático en 0.5 |

### Novedades v2.5.0 — Correcciones estructurales al spec

| Área | Antes (v2.4) | Ahora (v2.5) |
|------|-------------|-------------|
| §1 conteo módulos | "22 restantes + 23 total" (inconsistente; clean-code duplicado) | 21 restantes + evolutionary = 22 necesitan delta-awareness; clean-code = audit preventivo separado en A2 |
| §3 A1 | `extractAddedLines` descrita como utilidad pre-existente | La fix crea AMBAS funciones (`extractAddedLines` + `extractRemovedLines`) desde cero en diff-parser.ts (hoy son inline en cada módulo) |
| §3 A2 | Lista de 23 mezclaba vulnerables con clean-code | Separado: "22 módulos con guardia delta-aware" + "`clean-code` audit preventivo" como sección explícita |
| §4 cascade diagram | `topic = módulo con mayor score` (un solo WeakSignal por commit) | Un WeakSignal por cada topic con finding (múltiples por commit posible) |
| §9 SQL | `weak_signals` | `signal_events` (nombre canónico resuelto) |
| §13 deprecated block | Bloque `<details>` con modelo deprecado contradictorio | Eliminado; fuente única: §5–§7 |
| Capa 3.5 input sets | `topics_A`, `topics_B` sin definir | `topics_A` = mitad antigua de commits, `topics_B` = mitad reciente |

> **Corrección post-publicación v2.5.0:** §3 A2b eliminado. El "ANTES" que describía para `security.ts` era fabricado — el módulo real ya tiene `SECRET_REGEX` con nombre de variable credencial (`api[_-]?key|secret|token|password|credentials`). `architecture-patterns.ts` no detecta patrones GoF (esos son de `design-patterns.ts`) sino hexagonal/CQRS/EventSourcing — el "DESPUÉS" propuesto hubiera mezclado responsabilidades entre módulos.

### Novedades v2.4.0 — Capa 2 lazy, WeakSignals gratuitos desde módulos

| Área | v2.3 | v2.4 |
|------|------|------|
| Fuente de WeakSignals | Haiku en cada commit débil | Findings score 1-4 de Capa 1 (gratis). Haiku solo near-threshold |
| Costo de acumulación | ~$0.002/commit con caching | $0.000 para score 1-4 y score 0 |
| Condición Haiku lazy | N/A | `weight_sum >= threshold_current × 0.7 AND score === 0` |
| Patrones arquitectónicos | Sin cambio | Sin cambio — Tiered Inference se refuerza: Haiku reservado para casos near-threshold de alto valor |
| Costo por post de síntesis (caching) | ~$0.022 (10 commits × $0.004 + $0.010) | ~$0.008 (Haiku lazy ×1 + Sonnet) |

### Novedades v2.2.0 — Cuatro gatilladores y routing de coherencia

| Área | v2.1 | v2.2 |
|------|------|------|
| Gatilladores de post | Implícitos: "path actual" vs "síntesis" | 4 gatilladores explícitos: individual mono-tema, individual multi-tema (split), focal acumulado, arco narrativo |
| Commit grande multi-tema | Top 3 findings → 1 post (descarta resto) | ≥ 2 findings score ≥ 5 en topics distintos → N posts independientes (hasta 3), uno por topic |
| Routing arco vs focal múltiple | No había distinción | Heurística léxico-estructural sin LLM basada en Kuhn (2007): `0.5 × jaccard_files + 0.2 × densidad_temporal + 0.3 × jaccard_messages`. Threshold 0.6 con banda gris conservadora (0.3-0.6 default a focal) |
| Consumo de señales post-disparo | Sin política definida | Opción B (consumir todas las del topic) como default. Criterios documentados para migrar a Opción C (consumo selectivo por similaridad de `pattern_hint`) |
| Prompts de Capa 4 | Un único prompt "síntesis" | Dos variantes: FOCAL (un topic, N commits) y ARCO (multi-topic con `<coherence_evidence>` anclada al routing) |
| Rollback | Mencionado, no implementable | Tabla `post_disparo_audit` persiste snapshot; rollback restaura `signal_events.consumed` y `signal_bank.last_fired_at` |
| Observability de coherencia | N/A | Tabla `routing_decisions_audit` permite correlacionar `score_coherencia` con `edit_ratio` resultante para calibración continua |
| Calibración | Solo cold-start | Fase C explícita: fixtures sintéticos (análisis de sensibilidad), correlación con edit_ratio, monitoreo de criterios de migración a Opción C |
