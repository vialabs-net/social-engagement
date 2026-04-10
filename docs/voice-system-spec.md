# devcast — Voice System Spec

| Field | Value |
|-------|-------|
| Version | 1.14.3 |
| Status | Design — replaces Phase 3 voice extraction subsystem and `anti-parrot-spec.md` |
| Last updated | 2026-04-10 |
| Owner | Liliana Castellanos / Vialabs Spa |
| Parent spec | `devcast-spec.md` v1.5.17 — Phase 3 (Voice Profile + Content Strategy) |
| Replaces | `anti-parrot-spec.md` v1.0.0 (entirely) |
| Phase | Phase 3.5 — modifies Phase 3 voice subsystem, does not touch Phase 1 or Phase 2 |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.14.3 | 2026-04-10 | **All hard line-number references to master spec replaced with section-header anchors.** 19 references like `master spec line 2082` replaced with `master spec §computeEditRatio() contract`. Section headers do not shift when lines are added above them. Affects: authoritative references table, override table, VoiceProfile interface comment, bootstrap relationship comments, hashtag priority text, IVoiceStorage extension text, process-job pseudocode comments, emoji note, voice_summary section. No logic changes. |
| 1.14.2 | 2026-04-10 | **`IVoiceStorage` exposure/moves contract resynchronized.** The `getPublishedForExposure()` signature had already been updated to include `platform`, but the surrounding storage section still implied both storage methods shared the same query shape. Fixed: (1) `getPublishedForExposure()` comment now clearly documents the per-platform filter as part of the method contract; (2) `getPublishedForMoves()` comment now explicitly documents the cross-platform query used by `refreshVoiceMoves()` — no `platform` parameter, no `platform` filter, `LIMIT 30`; (3) the “thin wrappers around those queries” note in Files affected is now unambiguous: exposure wraps the per-platform query, moves wraps the cross-platform query. This now matches both the Voice Exposure section and the Loop 1 algorithm. |
| 1.14.1 | 2026-04-10 | **Exposure Pool docs aligned with platform-keyed storage.** The Voice Exposure chapter still described `voice.voice_examples_pool` as a flat `string[]` even though v1.14.0 had already changed the type and `process-job.ts` integration to platform-keyed storage. Fixed: (1) pool description now says `voice_examples_pool` is `{ linkedin?: string[]; instagram?: string[] }`; (2) `refreshExposurePool()` is explicitly documented as returning the pool for ONE platform, with `refreshVoiceMoves()` responsible for calling it per platform and storing the merged keyed object; (3) this now matches the master-spec requirement that runtime example selection preserves `platform` boundaries. |
| 1.14.0 | 2026-04-10 | **Platform propagation — v1.9.0 fix completed.** v1.9.0 added `platform` param to `refreshExposurePool` signature but left 4 call sites desynchronized. Fixed: (1) `refreshVoiceMoves` now calls `refreshExposurePool` twice (linkedin + instagram) and merges into `pool = { linkedin, instagram }`; (2) `voice_examples_pool` type in VoiceProfile interface changed from `string[]` to `{ linkedin?: string[]; instagram?: string[] }` — per-platform keyed object; (3) `getPublishedForExposure` in IVoiceStorage extended with `platform: string` parameter; (4) `process-job.ts` integration reads `voice.voice_examples_pool?.[platform]` instead of the flat array. All three paths in `refreshVoiceMoves` (Path 1/2/3) now store the keyed structure. |
| 1.13.0 | 2026-04-10 | **Path 2 comment fixed — same spread behavior as Path 1.** Path 2 (`warming`) had the same misleading `// voice_moves deliberately NOT set` comment as Path 1 before v1.10.0. Replaced with accurate documentation: spread preserves existing `voice_moves` by design (same rationale as Path 1 — calibrated dice survive a transient regression). Key addition: documents that preserved `voice_moves` are **inert during Stage 2** — `buildProgressiveVoiceBlocks` only injects `<voice_moves>` at `stage === 'established'`. Stale dice sit in JSONB but produce no prompt output until Stage 3 is re-reached and Path 3 recalibrates them. Not a memory leak — bounded and self-healing. |
| 1.12.0 | 2026-04-10 | **Contradictory edit_ratio text fixed.** Stage 2 section said "`edit_ratio` is NOT used as a filter" immediately before "posts with ratio < 0.30 are excluded" — which is a filter. Rewritten to accurately describe the system: a weight with a minimum floor (0.30 hard exclusion for total rewrites, graded weights above that). Added explicit contrast with the master spec's 0.70 hard gate and the rationale for why exposure needs different logic than extraction. |
| 1.11.0 | 2026-04-10 | **Runtime bug fix in `buildVoiceBlocks` decision guard.** Changed `||` to `&&` in the progressive path condition. With `||`, a Stage 3 author who purges their published history would throw at runtime: `countUniquePublished` drops to 0 → stage becomes `'cold'` → Path 1 preserves `voice_moves` (intentional) → `voice_moves` truthy + `||` routes to `buildProgressiveVoiceBlocks` → function throws on `stage='cold'`. With `&&`, stage `'cold'` always routes to legacy path regardless of `voice_moves` state. Preserved stale dice wait for data recovery; Path 3 overwrites when posts accumulate again. |
| 1.10.0 | 2026-04-10 | **Path 1 regression behavior declared.** Replaced misleading `// voice_moves deliberately NOT set` comment with explicit documentation: the spread preserves existing `voice_moves` intentionally when an author falls back to Path 1 (e.g., deleted posts, scanner gap). An author who previously reached Stage 3 keeps their calibrated dice during the transient minimum. Path 3 overwrites when data recovers. Stale calibrated voice > no voice for a transient minimum. |
| 1.9.0 | 2026-04-10 | **Platform architecture decision.** Eliminated `social_platforms: string[]` from `MoveDefinition` interface and all 44 registry entries — field was declared but never consumed anywhere in the spec. Replaced by an explicit architectural rule: exposure pool (`refreshExposurePool`) is per-platform (added `platform` parameter and `.eq('platform', platform)` filter); move measurement (`refreshVoiceMoves`) and stage computation are cross-platform (added explicit no-filter comment explaining why). Override table row added documenting the split decision and the removal of `MoveDefinition.social_platforms`. |
| 1.8.0 | 2026-04-10 | **Cross-spec consistency pass.** Override table extended with 7 new rows: (1) Loop 1 `edit_ratio` threshold rationale (0.30 for exposure/moves, 0.70 remains for Loop 4 — different purposes, not a conflict); (2) Stage 3 drops `TONE_INSTRUCTIONS` + `RHYTHM_INSTRUCTIONS` + `STRUCTURE_MAP` explicitly (not just `style_patterns`/`voice_devices`); (3) Chapter Context System skip logic added as override (master has no commit skip based on module saturation); (4) Opening Type Memory (`opening_move` column, `recent_opening_sequence`, `<variety_constraint>` block) documented as pure addition; (5) Chapter Context System (`getRecentTopFindings`, `buildChapterContext`, `<chapter_context>` block) documented as pure addition; (6) `generation_system` column documented as pure addition. `getRecentTopFindings()` added to `IVoiceStorage` extension block. Master spec (`devcast-spec.md`) updated with `> Replaced by voice-system-spec.md` notices at §Runtime voice_history Selection, §3-Tier Voice System, §Voice Extractor, §Loop 1, §Integration In process-job.ts. |
| 1.7.0 | 2026-04-09 | **Scanner corruption guard.** `refreshExposurePool` deduplication comment expanded with full root-cause explanation: the sent-scanner can assign the same Buffer published post to multiple `voice_posts` rows (different `commit_sha`, identical `published` text) when two drafts are similar. The application-level dedup by `LEFT(published, 80)` is the last defense before examples reach Claude — documented as intentional, not incidental. Null-safety fixes: `published.data ?? []` and explicit `as string` casts. |
| 1.6.0 | 2026-04-09 | **Chapter Context System.** Added skip-vs-chapter decision in `process-job.ts` before Claude call: if top module `fireCount >= 2` AND `draftIndexToday > 0` → skip commit (log `module_saturation`); otherwise → chapter mode. Added `getRecentTopFindings(authorLogin, moduleId, limit)` to `IVoiceStorage` and `SupabaseStorage`. Added `buildChapterContext()` in `src/ai/prompt-builder.ts` — injects `<chapter_context>` into the USER prompt (after `<findings>`, before `<task>`) when the module has prior published history. Chapter number = `fireCount + 1`. Replaces the vague `<module_variety_hint>` framing when chapter context is available — both can coexist. No new DB columns needed. |
| 1.5.0 | 2026-04-09 | **Opening Type Memory.** Added `voice_posts.opening_move` column (detected at draft-save time). Added `voice.recent_opening_sequence` (last 5 published opening types, computed in Loop 1). Added `detectOpeningMove()` helper in `src/voice/exposure.ts`. Added `buildVarietyConstraint()` in `src/ai/prompt-builder.ts`: injects `<variety_constraint>` block when same-day posts repeat an opening type or when the last 3 posts all used the same opening. Constraint active from Stage 1 onward — does not require dice or Stage 3. Updated `process-job.ts` integration: fetches today's first draft opening type when `draftIndexToday > 0`. Updated block order to place `<variety_constraint>` between `<preferences>` and `<voice_signals>`. Updated "What this spec does not do" to clarify anti-repetition at phrase level vs structural level. |
| 1.4.0 | 2026-04-09 | `refreshVoiceMoves` restructured into 3 explicit paths: (Path 1) insufficient data — persists stage + pool + proto-summary without voice_moves, (Path 2) Stage 2 warming — persists proto-summary + pool + hashtags without dice, (Path 3) Stage 3 established — full move measurement + smoothing + dice summary. `computeProtoSummary` defined: derives voice_summary from coarse signals (length, opening register, hashtags) for Stage 2 UI. Upsert of author-specific row moved before stage computation. Override table header now includes explicit acceptance declaration. |
| 1.3.0 | 2026-04-09 | **Five consistency fixes.** (A) `StoredVoiceProfile` / `DEFAULT_VOICE_PROFILE` unwrapping made explicit in process-job: `stored = getVoiceProfile()`, `voice = stored?.voice ?? DEFAULT_VOICE_PROFILE`, `voiceVersion = stored?.version ?? 0`. No more ambiguous `?? DEFAULT` comment. (B) `refreshVoiceMoves` now checks for author-specific `voice_profiles` row and creates one (seeded from tenant default) if it doesn't exist, before persisting moves. Prevents silent no-op when author only has tenant-default fallback. (C) Emoji rule removed from `<never>` hard rules — stays in Layer 2 as master spec defines (line 2408). Added explicit note that emojis in exposure examples are correct Layer 3 behavior. (D) `voice_summary` defined: computed on-write during Loop 1 from top-3 measured move descriptions, stored in same `voice.voice_summary` field the master spec uses. No UI change needed. Added to override table. (E) `computeVoiceStage` in `refreshVoiceMoves` now uses `countUniquePublished()` (all published, no edit_ratio filter) instead of the quality-filtered `posts.length`. Smoothing loop dead code removed. |
| 1.2.0 | 2026-04-09 | **Master spec alignment fixes (9 issues).** (1) New fields live inside `voice JSONB` as VoiceProfile interface extensions, not as top-level columns — no ALTER TABLE on voice_profiles. (2) All voice_profiles queries use `github_author_login` (matching master), voice_posts queries use `author_login`. (3) Pseudocode reads `voice.voice_moves`, `voice.bootstrap_posts` consistently from JSONB. (4) IVoiceStorage extension follows master's parameter pattern with tenant-scoping note. (5) `generation_system` marking matches activation: v2_progressive for all progressive stages (1–3), not just when voice_moves exists. (6) `draftIndexToday` uses `existingDraft.created_at` on retry in both the utility section and process-job pseudocode. (7) Override table expanded with master spec section references and conflict resolution rationale for edit_ratio 0.30 and `<never>` block changes. (8) Hashtag priority defined: `voice.hashtags` + `hashtags_mode` (user-configured) wins over `always_hashtags` (auto-detected); always_hashtags is additive only. (9) Bootstrap relationship clarified: `tenants.voice_bootstrap` stays raw input per master §voice_profiles table, `voice.bootstrap_posts` is parsed array. |
| 1.1.0 | 2026-04-09 | Registry validation procedure (20 writers, 4 criteria, 6-step process). Utility function contracts (FNV-1a hash, Mulberry32 RNG, exponential-sort weighted shuffle). `draftIndexToday` computation and retry semantics. `analyze-voice.ts` and `validate-registry.ts` script contracts. `buildProgressiveVoiceBlocks` full implementation with per-stage assembly logic. `buildVoiceSignals` for Stage 2 proto-moves. `process-job.ts` integration pseudocode. Loop 2/3/4 interaction clarified. Helper functions (`syntheticVoicePost`, `moduleIdToLabel`, `countUniquePublished`). Prompt length budget (4000 chars). Bootstrap post deletion behavior. Reference writer list expanded from 8 to 20. Files affected updated. Weighted shuffle call signature corrected in `selectExposureExamples`. |
| 1.0.0 | 2026-04-09 | Initial spec. Progressive Voice System with 4 stages, Voice Exposure, Voice Dice, MOVES_REGISTRY with 42 entries validated against 12 published posts and 8 reference writers. |

---

## Why this exists

Phase 3 of the master spec captures the developer's voice by extracting `style_patterns` (400 chars) and `voice_devices` (300 chars) via a Haiku call, then injecting those compressed descriptions as instructions into the generation prompt. This produces accurate voice replication for the first 5–10 posts. After that, a self-reinforcing loop degrades quality:

1. The compressed extraction destills the author's tics into rigid rules ("Frases cortas. Cierra con lección. Usa metáforas de cocina.")
2. The model obeys those rules literally in every generation
3. New posts trained on the same rules reinforce the same patterns
4. The author's voice stops varying — every post opens the same way, closes the same way, uses the same rhetorical moves

**Measured evidence from production data (94 voice_posts, 12 unique LinkedIn published, 39 scheduled drafts):**

| Signal | Published freq | Draft freq | Ratio | Interpretation |
|--------|---------------|------------|-------|----------------|
| `em_dash` (—) | 8% | 82% | 10.2× | AI massively overuses |
| `"I'm building [X]"` context | 8% | 64% | 8.0× | AI massively overuses |
| `opens_with_number` | 17% | 54% | 3.2× | AI overuses (also violates `<never>` block) |
| `"zero removed/deleted"` | 0% | 26% | ∞ | AI invented this — user never uses it |
| `inline_code` in post | 0% | 18% | ∞ | AI invented this — user never uses it |
| `"very X. very Y."` | 67% | 69% | 1.0× | Correct — matches user's real frequency |
| `"frankly"` | 42% | 38% | 0.9× | Correct |
| `self_deprecating` | 50% | 49% | 1.0× | Correct |

The problem is not that the AI uses the author's tics — it's that it uses some tics 10× more often than the author does, invents tics the author never uses, and applies all tics to every post instead of varying them naturally.

**Additional structural finding:** the author's median `edit_ratio` is 0.47. Phase 3 uses `edit_ratio >= 0.70` as the quality gate for voice training. This discards 13 of 17 published posts, leaving only 4 posts as training signal. The system is starving itself of its own best data.

This spec replaces the compressed voice extraction with a **Progressive Voice System** that:

1. Shows the model examples of the author's writing directly (voice exposure) instead of compressed rules
2. Uses a measured, probabilistic catalog of the author's voice moves (voice dice) instead of prescriptive instructions
3. Progresses through 4 stages as data accumulates, never pretending to know more than it does
4. Eliminates the Haiku extraction call entirely — the voice is measured statistically, not extracted by AI

---

## What this spec replaces

### In `devcast-spec.md` (Phase 3)

This spec **overrides** the following sections of the master spec. The master spec remains authoritative for everything not listed here. Each override references the specific master spec location it contradicts.

**All overrides in this table have been reviewed and accepted as intentional divergences from the master spec.** They are not bugs or omissions — each one has a measured rationale documented in the "Conflict resolution" column. An implementor should treat them as authoritative for the scope of this spec.

| Master spec section | Line/ref | Override | Conflict resolution |
|---|---|---|---|
| `voice-extractor.ts` — Haiku call to extract `style_patterns` + `voice_devices` | §Voice Extractor | Replaced by `voice-moves-calculator.ts` (statistical measurement, zero AI calls) | voice-extractor.ts continues to exist for legacy path; new system bypasses it |
| `prompt-builder.ts` — Tier 1 voice block injection (`<voice_patterns>`, `<voice_devices>`) | §3-Tier Voice System | Replaced by `<voice_exposure>` + `<voice_moves>` blocks | Legacy blocks injected when `voice.voice_moves` is absent; new blocks when present |
| `voice_history` selection — `edit_ratio >= 0.70` exclusion gate | §Runtime voice_history Selection | For voice exposure (example selection): `edit_ratio >= 0.30` with weighting. For Loop 4 (feedback scoring): `edit_ratio >= 0.70` unchanged. | Two different uses of edit_ratio have different thresholds. The master's 0.70 was designed for extraction training data quality; exposure uses 0.30 because the published text IS the author's voice regardless of how much they edited |
| `voice_history` selection — `platform = $3` filter | §Runtime voice_history Selection | Split by layer: **exposure pool** (`refreshExposurePool`) is per-platform — Claude sees examples in the same format it will generate. **Move measurement** (`refreshVoiceMoves`) is cross-platform — the author's stylistic moves are not platform-specific and filtering by platform would halve the signal. **Stage computation** (`computeVoiceStage`) is cross-platform — the author's total publication history determines maturity. `MoveDefinition.social_platforms` field removed entirely — the registry treats all moves as platform-universal. | Format matters for example selection (LinkedIn ≠ Instagram in length and structure). Voice patterns do not vary by platform for the same author. |
| `voice_history` selection — deterministic top-5 by recency | §Runtime voice_history Selection | Randomized selection within quality filter, commit-seeded for reproducibility | Master's deterministic recency selection caused the same examples to appear for weeks |
| Loop 1 — Haiku refresh every 5 publications | §Loop 1 — Style refresh | Replaced by statistical recalculation of move probabilities (zero AI calls) | Only when `voice.voice_moves` is present; authors without it still use Haiku refresh |
| `VoiceProfile` interface — `style_patterns`, `voice_devices` fields | §VoiceProfile JSONB contract | Extended with `voice_moves`, `voice_stage`, `voice_examples_pool`, `always_hashtags`, `bootstrap_posts` inside same `voice` JSONB. Existing fields NOT removed. | Prompt-builder reads old fields when `voice_moves` absent, new fields when present |
| `<never>` block — `"No lead with counts or quantities"` hard rule | §Rule Layers > Layer 1 | Moved to voice dice as `opens_with_number` with probability ~0.10 — no longer a hard rule | Production data shows the author uses number openings 17% of the time. A hard ban contradicts their real voice. The dice makes it rare (~10%) instead of forbidden. Platform-safety rules remain in `<never>` |
| Onboarding bootstrap — Haiku extraction from pasted posts | §/settings/voice — Org member setup | Replaced by direct storage as `voice.bootstrap_posts` array (no extraction) | `tenants.voice_bootstrap` remains the raw textarea input per master spec §voice_profiles table. The parsed array lives in `voice_profiles.voice.bootstrap_posts` |
| `voice_summary` — Haiku-generated UI summary | §VoiceProfile JSONB contract, §Voice Extractor | Replaced by computed summary from measured move descriptions during Loop 1 | Same field, different producer. Legacy authors keep Haiku-generated summary; progressive authors get computed summary. No UI change needed |
| Loop 1 — `edit_ratio >= 0.70` input filter | §Loop 1 — Style refresh | Loop 1 is wholly replaced by statistical move measurement. The new Loop 1 uses `edit_ratio >= 0.30` for the exposure pool (showing examples) and no threshold filter for move frequency counting (all published posts count toward pattern frequency). The 0.70 threshold was the Haiku extractor's quality gate — it needed high-signal input to extract style rules. Statistical counting does not need that gate: a post with `edit_ratio = 0.45` still published with its moves intact. Loop 4 retains `edit_ratio >= 0.70` unchanged. | The two thresholds serve different purposes and coexist without conflict. |
| Prompt builder — Tier 2 `TONE_INSTRUCTIONS` + `RHYTHM_INSTRUCTIONS` + `STRUCTURE_MAP` blocks | §3-Tier Voice System, §Tone And Structure | Tier 2 blocks are used only for Stages 0–1 (cold/bootstrap) via the legacy path. From Stage 2 onward, `<voice_signals>` replaces them. At Stage 3, all three are dropped entirely — voice exposure examples and voice moves already encode the author's actual tone, rhythm, and narrative shape. TONE_INSTRUCTIONS apply when the user configured a preference but has no published history yet. Once history exists, the examples are authoritative and static instructions add noise. | Already partially covered by the `<voice_patterns>/<voice_devices>` row above; this row makes the TONE/RHYTHM/STRUCTURE drop explicit. |
| `process-job.ts` — commit pipeline has no module-saturation skip logic | §Integration In process-job.ts | Chapter Context System (§Chapter Context System) adds a skip-vs-chapter decision before the Claude call: if `top_module_id` has `fireCount >= 2` AND `draftIndexToday > 0`, skip the commit and log `module_saturation`. If `fireCount >= 1` AND `draftIndexToday = 0`, chapter mode activates instead. Master spec pipeline has no such skip. | The skip prevents variety collapse when a module fires repeatedly on the same day. It does not skip across days — only within a single generation session (same tenant, same author, same calendar day). |
| Opening Type Memory — not in master spec | New | `voice_posts.opening_move TEXT DEFAULT NULL` column added to track the structural opening type of each generated draft. `voice.recent_opening_sequence: string[]` field added to VoiceProfile JSONB — last 5 published opening types, computed in Loop 1. `<variety_constraint>` block injected in the system prompt from Stage 1 onward when the same-day or last-3-posts opening pattern repeats. `detectOpeningMove()` classifies the draft opening at save time. | Pure addition — no master spec behavior is changed. The constraint block is injected between `<preferences>` and `<voice_signals>` in the prompt block order. |
| Chapter Context System — not in master spec | New | `getRecentTopFindings(authorLogin, moduleId, limit)` added to `IVoiceStorage`. `buildChapterContext()` added to prompt-builder — injects `<chapter_context>` in the user prompt (after `<findings>`, before `<task>`) when the module has prior published history. Chapter number = `fireCount + 1`. Replaces the vague `<module_variety_hint>` framing when chapter context is available. | Pure addition. `<module_variety_hint>` remains for cases where chapter context is absent. |
| `voice_posts.generation_system` column — not in master spec | New | New column tracking which generation system produced each draft: `'v1'` (current production, pre-voice-spec) or `'v2_progressive'` (this spec). Written at draft-save time in `process-job.ts`. Used to segment analytics and rollback detection. | Pure addition. Already applied to `database/schema.sql` via `ALTER TABLE IF NOT EXISTS`. |

### `anti-parrot-spec.md`

Entirely replaced. Of the 4 mechanisms:

| Mechanism | Status |
|---|---|
| 1 — Anti-repetition memory | Eliminated. Voice dice + voice exposure cover this by design. |
| 2 — Voice observations | Eliminated. Voice moves replaces compressed extraction entirely. |
| 3 — Voice history rotation | **Absorbed** into this spec (Section: Voice Exposure). |
| 4 — Structure breaks | Eliminated. Shape variation emerges from diverse examples + dice roll. |

### What is NOT overridden

Everything else in Phase 3 stays as-is:

- `ContentStrategy` (content_preferences, audience, platform rules)
- `<never>` block for platform-safety rules (no LinkedIn headers, no engagement-bait questions, no code blocks)
- Loops 2, 3, 4 (edit analysis, discouraged hooks, industry context preference)
- `STRUCTURE_MAP[tone]` and `TONE_INSTRUCTIONS[tone]` (used in Stages 0–1 only)
- `voice_posts` table and state machine
- `process-job.ts` integration flow (modified to call new voice system, but same overall structure)
- `IVoiceStorage` contract (extended, not replaced)
- Optimistic locking on `voice_profiles.version`

---

## Authoritative references (do not redefine)

| Item | Source |
|------|--------|
| `voice_posts` schema and state machine | master spec |
| `computeEditRatio()` tokenization contract | master spec §`computeEditRatio()` contract |
| `ContentStrategy` and `content_preferences` | master spec §`VoiceProfile` JSONB contract |
| `<never>` block (platform-safety subset only) | master spec §Rule Layers > Layer 1 |
| `STRUCTURE_MAP[tone]` | master spec §Tone And Structure |
| `IVoiceStorage` base interface | master spec §Individual Voice, Always > Storage contract |
| `process-job.ts` integration points | master spec |
| Loop 2, 3, 4 logic | master spec |
| `IEmbedder`, `IAIClient` interfaces | master spec |

If anything in this document conflicts with the master spec on an item NOT listed in the "What this spec replaces" section, the master spec wins.

---

## Out of scope

- Changes to Phase 1 or Phase 2 in any way
- Changes to `ContentStrategy`, audience, or platform rules
- Cross-author move detection (each author is analyzed in isolation)
- Semantic similarity detection between posts (only regex-based move detection)
- AI-powered move discovery (the MOVES_REGISTRY is human-curated and code-maintained)
- Per-post confidence scoring or selection explainability UI
- Instagram-specific voice logic (Instagram drafts follow the same system; platform-specific formatting is handled by `ContentStrategy`)

---

## Progressive Voice System — four stages

The system adapts its voice replication strategy based on how much signal it has from each author. No stage pretends to know more than the data supports.

### Stage transitions

```
cold ──[bootstrap textarea filled]──→ bootstrap
bootstrap ──[5 published posts]──→ warming
warming ──[15 published posts]──→ established
```

A "published post" means a `voice_posts` row with `status = 'published'` and `published IS NOT NULL`. Reposts of the same content (same `published` text, first 80 chars match) count as one post.

The stage is **computed dynamically** from the count of unique published posts for that author, not stored separately. However, `voice.voice_stage` (inside `voice_profiles.voice` JSONB) caches the last computed stage for UI display and logging. It is recalculated on every generation and every Loop 1 run.

```typescript
function computeVoiceStage(uniquePublishedCount: number, hasBootstrap: boolean): VoiceStage {
  if (uniquePublishedCount >= 15) return 'established';
  if (uniquePublishedCount >= 5) return 'warming';
  if (hasBootstrap) return 'bootstrap';
  return 'cold';
}
```

### Stage 0 — Cold (0 published, no bootstrap)

The user installed devcast and started pushing commits without pasting any examples.

**What the model receives:**

- Tier 3 baseline: "Write clearly and directly. Professional but human. No filler."
- `TONE_INSTRUCTIONS[tone]` if a tone was selected in onboarding
- `STRUCTURE_MAP[tone]` for narrative shape
- `audience` description
- `<never>` block (platform-safety rules only)
- **No** voice exposure, **no** voice moves, **no** extraction

**What the model produces:**

Generic posts in the selected tone. They will not sound like the user. The user will edit heavily. This is expected and acceptable — the edits feed future stages.

**What the system must NOT do:**

- Invent moves or voice patterns
- Extract rules from zero data
- Claim to know the user's voice

### Stage 1 — Bootstrap (0 published, 1–5 examples pasted)

The user pasted 1–5 posts in the onboarding textarea. There is curated signal but no behavioral data.

**What the model receives:**

- Everything from Stage 0
- The 1–5 bootstrap posts as voice exposure examples in `<voice_exposure>` block
- Instruction: "These are examples the author wrote and approved. Write something new in the same range of voice. Do not copy phrases literally from the examples."
- **No** `style_patterns` or `voice_devices` extraction from bootstrap (this is a key difference from Phase 3 current)

**Why no extraction from bootstrap:**

1–5 posts is insufficient to measure variability. If all 3 pasted posts use "frankly", a Haiku extraction will output "uses frankly" as a rule. In the author's real writing, "frankly" may appear in only 42% of posts. Extraction from small samples always overfits.

The model already sees the full examples — distilling them into 700 chars adds noise, not signal.

**Bootstrap post storage:**

Bootstrap posts are stored in `voice.bootstrap_posts` inside the `voice_profiles.voice` JSONB — an array of `{ text: string, pasted_at: string }`. They are NOT inserted into `voice_posts`. They are used as examples until enough real published posts exist to replace them.

**Relationship to `tenants.voice_bootstrap`:** the master spec (§tenants schema, §voice_profiles table) defines `tenants.voice_bootstrap` as the raw textarea input, read-only after save. When the user saves, the system parses this text into the `voice.bootstrap_posts` array. `tenants.voice_bootstrap` remains the source of truth for the raw input. If the user re-edits the textarea, `voice.bootstrap_posts` is re-parsed from it.

**What the system must NOT do:**

- Run Haiku on bootstrap posts to extract patterns
- Generate `voice_moves` from bootstrap (insufficient data)
- Treat bootstrap posts as equivalent to published posts for Loop calculations

### Stage 2 — Warming (5–15 published posts)

The system has real behavioral data but not enough for fine-grained move detection.

**What the model receives:**

- Everything from Stage 1, but bootstrap posts are mixed with real published posts in the exposure pool (bootstrap posts phase out as published posts accumulate)
- Voice exposure: up to 3 examples from the pool, selected with commit-seeded rotation (see Voice Exposure section)
- `<voice_signals>` block: 4–6 soft, descriptive observations derived from proto-moves detection

**Proto-moves detection:**

With 5–15 posts, only coarse signals are statistically reliable. The system measures:

1. **Hashtags that appear in ≥80% of posts** → category "always" (e.g., `#lilicurl`, `#codingWithHumor`)
2. **Dominant opening register** — first person ("I shipped…") vs third person ("The bug…") vs abstract noun ("A type guard…") — which appears most
3. **Typical post length** — mean ± standard deviation in characters
4. **Presence/absence of formatting patterns** — em-dashes, arrow bullets, semicolons (binary: used/not used)

These are injected as descriptive text, not prescriptive instructions:

```xml
<voice_signals>
This author typically writes posts of 1000–1300 characters. They always
include #lilicurl and #codingWithHumor at the end. They open most posts
in first person ("I shipped…", "I deleted…"). They make moderate use of
short-sentence rhythms.
</voice_signals>
```

Language is deliberately soft: "typically", "most posts", "moderate use". The model receives information about the range, not rules to apply.

**edit_ratio for voice exposure in this stage:**

`edit_ratio` is used as a **weight with a minimum floor**, not as a strict quality gate. The master spec uses `edit_ratio >= 0.70` as a hard gate — only high-fidelity drafts enter the voice history. This spec lowers that to a soft system with one hard exclusion:

- Posts with `edit_ratio < 0.30` are **excluded** — total rewrites where the published text has no connection to the AI draft. Counting these as "the author's voice" would be measuring the author's rewrite, not Claude's voice signal.
- Posts with `edit_ratio` between 0.30–0.65 are **slightly preferred** — the most collaborative signal: the user edited significantly, producing text that is genuinely theirs.
- Posts with `edit_ratio` between 0.65–0.90 receive **normal weight**.
- Posts with `edit_ratio > 0.90` are **slightly deprioritized** — Claude was already close, so less new voice signal.

The rationale: a post with `edit_ratio = 0.45` was approved and published by the author — it IS their voice. The low ratio reflects the draft quality, not the published quality. The 0.70 gate made sense for AI extraction (feeding garbage text to Haiku produced garbage patterns). It does not make sense for exposure (showing the published text directly to Claude).

Weighting formula for exposure selection:

```typescript
function exposureWeight(editRatio: number): number {
  if (editRatio < 0.30) return 0;    // total rewrite — exclude
  if (editRatio <= 0.65) return 1.2;  // collaborative — slight boost
  if (editRatio <= 0.90) return 1.0;  // polish — normal
  return 0.8;                         // AI nailed it — slight deprioritize
}
```

### Stage 3 — Established (15+ published posts)

Full voice dice system active. The system has enough data to measure individual moves with acceptable statistical error.

**What the model receives:**

- Voice exposure: up to 3 examples from pool, commit-seeded rotation
- `<voice_moves>` block: full dice roll with AVAILABLE/NOT THIS TIME per move
- `<never>` block: platform-safety rules only (voice-related rules like "no lead with counts" are now handled probabilistically by the dice)
- **No** `style_patterns`, **no** `voice_devices`, **no** `STRUCTURE_MAP`

**Why `STRUCTURE_MAP` is dropped at this stage:**

The voice exposure examples already demonstrate the author's structural preferences. Adding `STRUCTURE_MAP` on top would conflict with the dice roll that controls narrative shape. The author's preferred structures emerge from the examples, not from a static map.

`TONE_INSTRUCTIONS` are also dropped — the tone is implicit in the examples.

---

## Utility function contracts

These functions are referenced throughout the spec. Each must be implemented in `src/voice/utils.ts`. An implementor must NOT invent alternative algorithms — the choice of algorithm affects determinism and reproducibility.

### `hash(input: string): number`

Produces a 32-bit unsigned integer from a string. Used to seed the RNG.

**Algorithm:** FNV-1a 32-bit. Chosen because it is fast, well-distributed, and has a trivial implementation (~10 lines). Do NOT use MD5, SHA-256, or any cryptographic hash — they are overkill for this purpose and slower.

```typescript
function hash(input: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return h >>> 0; // unsigned
}
```

### `seededRandom(seed: number): number`

Returns a float in [0, 1) from a 32-bit seed. Must be deterministic: same seed → same output, always.

**Algorithm:** Mulberry32. Chosen because it produces good distribution from a single 32-bit seed with one function call (no state object needed).

```typescript
function seededRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
```

### `weightedShuffle<T>(items: Array<{ item: T; weight: number }>, rng: () => number): T[]`

Produces a shuffled array where higher-weight items are more likely to appear earlier. Used for exposure example selection.

**Algorithm:** For each item, compute `sortKey = -Math.log(rng()) / weight` (the exponential sort trick). Sort ascending by `sortKey`. Items with higher weight get lower expected sort keys and therefore appear earlier.

```typescript
function weightedShuffle<T>(
  items: Array<{ item: T; weight: number }>,
  rng: () => number,
): T[] {
  return items
    .map(({ item, weight }) => ({
      item,
      sortKey: -Math.log(rng()) / Math.max(weight, 0.001),
    }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ item }) => item);
}
```

Note: the `rng` parameter here is NOT the single-call `seededRandom` above. For `weightedShuffle`, create a simple stateful RNG seeded once:

```typescript
function createRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

### `draftIndexToday` computation

`draftIndexToday` is the count of `voice_posts` rows created today (UTC) for this author in this tenant, **before** the current draft. It is computed at the start of `process-job.ts` when creating a new draft:

```typescript
// On first attempt: anchor to today's date
// On retry of existing draft: anchor to draft's created_at to preserve dice determinism
const todayAnchor = existingDraft?.created_at
  ? new Date(existingDraft.created_at).toISOString().split('T')[0]
  : new Date().toISOString().split('T')[0];

const draftIndexToday = await db
  .from('voice_posts')
  .select('id', { count: 'exact', head: true })
  .eq('tenant_id', tenantId)
  .eq('author_login', authorLogin)   // voice_posts uses author_login
  .gte('created_at', todayAnchor + 'T00:00:00Z');

// Pass to prompt builder
const voiceBlocks = buildVoiceBlocks(
  voiceProfile, exposurePool, bootstrapPosts, commit.sha,
  draftIndexToday.count ?? 0, stage
);
```

On retry of the same job (same `voice_posts.id`), the count must be the same as the original attempt — otherwise the dice roll changes. The implementor must use the draft's `created_at` date, not `NOW()`, when computing the count for a retry. The pseudocode above shows this via `existingDraft?.created_at`.

---

## Voice Exposure

Voice exposure replaces compressed voice extraction. Instead of telling the model "this is how the author writes" in 700 chars of rules, the system shows the model 2–3 complete examples of the author's published posts.

### Pool management

The **exposure pool** is the set of published posts eligible for selection as examples. It is stored as `voice.voice_examples_pool` inside the `voice_profiles.voice` JSONB as a per-platform keyed object:

```typescript
{
  linkedin?: string[];   // voice_posts.id values for LinkedIn exposure
  instagram?: string[];  // voice_posts.id values for Instagram exposure
}
```

Each value is an array of `voice_posts.id` strings for that platform only. This preserves the master-spec rule that runtime example selection must respect `platform` boundaries.

**Pool refresh:** every time Loop 1 runs (every 5 publications), the pool is recalculated:

```typescript
async function refreshExposurePool(
  tenantId: string,
  authorLogin: string,
  platform: string,              // 'linkedin' | 'instagram' — pool is per-platform
  db: SupabaseClient,
): Promise<string[]> {
  // Pool is filtered by platform: Claude must see examples in the same format
  // it will generate (LinkedIn 1200–1800 chars vs Instagram short/visual).
  // Voice MOVES measurement (refreshVoiceMoves) is cross-platform — the author's
  // stylistic patterns are not platform-specific. Only the examples shown are.
  // Stage computation (computeVoiceStage) is also cross-platform — the author's
  // total publication history determines maturity, not per-platform counts.
  const published = await db
    .from('voice_posts')
    .select('id, edit_ratio, published, top_module_id, published_at')
    .eq('tenant_id', tenantId)
    .eq('author_login', authorLogin)
    .eq('platform', platform)    // per-platform: examples must match generation format
    .eq('status', 'published')
    .not('published', 'is', null)
    .gte('edit_ratio', 0.30)     // exclude total rewrites
    .order('published_at', { ascending: false })
    .limit(40);                   // cap pool at 40

  // Deduplicate by first 80 chars of published text.
  //
  // WHY: the sent-scanner (scan-sent-posts cron) matches Buffer published posts
  // back to voice_posts rows by text similarity. When two commits produce similar
  // drafts, the scanner can assign the same published Buffer post to multiple
  // voice_posts rows — resulting in different commit_shas sharing identical
  // `published` text. Feeding the same text twice to Claude as two "separate"
  // examples corrupts the voice signal (over-indexes that style).
  //
  // The UNIQUE index on (commit_sha, platform) prevents exact duplicates within
  // a single commit, but does NOT prevent two different commits from receiving
  // the same published text via the scanner.
  //
  // This dedup is the last defense before examples reach the prompt.
  // It is intentionally applied here (pool refresh) not at query time,
  // so the pool stored in voice_examples_pool is already clean.
  const seen = new Set<string>();
  const unique = (published.data ?? []).filter(p => {
    const key = (p.published as string).substring(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.map(p => p.id as string);
}
```

`refreshExposurePool()` returns the pool for **one** platform. `refreshVoiceMoves()` calls it once per platform that the author has published on and stores the merged result as:

```typescript
voice_examples_pool: {
  linkedin?: string[];
  instagram?: string[];
}
```

**Pool size:** 20–40 posts. With 15+ published posts (Stage 3 minimum) and 0.30 edit_ratio threshold, most authors will have 12–30 eligible posts.

### Example selection per generation

For each draft generation, the system selects 2–3 examples from the pool using **commit-seeded randomization**:

```typescript
function selectExposureExamples(
  pool: VoicePost[],
  commitSha: string,
  draftIndexToday: number,
  maxExamples: number = 3,
): VoicePost[] {
  if (pool.length === 0) return [];
  if (pool.length <= maxExamples) return pool;

  // Seed = commit SHA + draft index → deterministic but varied
  const seed = hash(commitSha + ':' + draftIndexToday);
  const rng = createRng(seed);

  // Weight by edit_ratio
  const weighted = pool.map(p => ({
    item: p,
    weight: exposureWeight(p.edit_ratio),
  }));

  // Weighted shuffle
  const shuffled = weightedShuffle(weighted, rng);

  // Diversity constraint: max 1 example per top_module_id
  const selected: VoicePost[] = [];
  const modulesSeen = new Set<string>();
  for (const post of shuffled) {
    if (selected.length >= maxExamples) break;
    if (post.top_module_id && modulesSeen.has(post.top_module_id)) {
      if (modulesSeen.size < 3) continue; // skip if we can still diversify
    }
    selected.push(post);
    if (post.top_module_id) modulesSeen.add(post.top_module_id);
  }

  return selected;
}
```

**Why commit-seeded:** the same commit regenerated always produces the same examples (idempotent for debugging). Two different commits from the same author on the same day produce different examples (variety for same-day posts).

**Why `draftIndexToday`:** if two commits from the same author land the same day, each sees a different seed. `draftIndexToday` is the count of drafts already generated today for this author (0-indexed).

### Bootstrap integration

In Stages 1–2, bootstrap posts are included in the exposure pool alongside published posts. Bootstrap posts have a synthetic `edit_ratio` of 1.0 (the user pasted them — they are 100% their own writing).

As published posts accumulate, bootstrap posts naturally get displaced from the random selection because the pool grows. By Stage 3 (15+ published), bootstrap posts are explicitly excluded from the pool — the system has enough real data.

### Prompt injection format

```xml
<voice_exposure>
The following are real posts this author wrote and approved for publication.
Write something new in the same range of voice and register. Do not copy
phrases literally from these examples. The examples show the author's range
— sometimes they write one way, sometimes another. Vary naturally within
that range.

--- Example 1 (topic: performance debugging) ---
[full published text of post 1]

--- Example 2 (topic: AI-assisted coding) ---
[full published text of post 2]

--- Example 3 (topic: landing page shipping) ---
[full published text of post 3]
</voice_exposure>
```

The topic annotation is derived from `top_module_id` and is included so the model understands the diversity is intentional, not accidental.

---

## Voice Moves Registry

The MOVES_REGISTRY is a global, code-maintained catalog of syntactic patterns commonly found in technical and personal writing. It is NOT per-user. It lives in `src/voice/moves-registry.ts`, versioned in git, and is the same for all users.

The registry exists for one purpose: to **detect and measure** which moves each user already uses, and how often. It does not prescribe moves, lend moves, or suggest moves. If a move in the registry never matches a user's published posts, that move's probability is 0 for that user and the dice never activates it.

### Derivation sources

The registry was derived from three sources and must be validated against a fourth before deployment.

1. **Measured moves from production data** — 25 patterns identified in 12 unique published LinkedIn posts from the first production user, with frequency measured against 39 scheduled drafts to identify overrepresentation (papagayo signal). These 25 patterns form the core of the initial 42 entries.
2. **Stylometric literature** — patterns from rhetorical analysis (Williams' *Style: Lessons in Clarity and Grace*, Pennebaker's LIWC categories, forensic linguistics authorship attribution features). These contributed ~17 additional patterns not found in the production data but common in technical/personal writing.
3. **Validation against 20 reference writers** — described in detail in "Registry Validation Procedure" below. Each writer must activate a different subset of the registry, confirming the registry captures genuine individual variation, not universal patterns.

### Registry validation procedure

This procedure validates and expands the MOVES_REGISTRY before deployment. It is a one-time task that produces a validated `moves-registry.ts`. It must be completed before Phase 3.5.2 ships.

#### Step 1 — Select 20 reference writers

Select 20 writers who publish their own content without marketing team editing. The selection must cover diversity across these axes:

- **Genre:** technical blog posts, personal essays, opinion columns, developer logs, newsletters
- **Tone:** formal, casual, humorous, dry, confessional, analytical
- **Length:** short-form (tweet-length to 500 words), medium (500–2000), long-form (2000+)
- **Platform:** personal blogs, LinkedIn, newsletters, Twitter/X threads

**Selection criteria per writer:**

1. The writer has a publicly accessible archive of ≥20 posts (blog, newsletter archive, or public social media)
2. The writer has a recognizable individual voice (not corporate/ghostwritten)
3. The writer publishes in English (the registry is English-language; other languages are a future extension)
4. The content is legally accessible (personal blogs, public newsletters, public social media — not behind paywalls or scraping-prohibited platforms)

**Starting list (expand or replace as needed to reach 20 diverse writers):**

| Writer | Primary platform | Tone archetype | Why included |
|--------|-----------------|----------------|--------------|
| Paul Graham | paulgraham.com | Analytical, essay-length | Long compound sentences, minimal formatting |
| Simon Willison | simonwillison.net | Enthusiastic, detailed | Heavy use of inline code, lists, links |
| Julia Evans | jvns.ca | Curious, accessible | Questions as structure, exclamation marks, simple vocabulary |
| Dan Luu | danluu.com | Dry, data-driven | Very long paragraphs, no formatting, numeric evidence |
| Charity Majors | charity.wtf | Emphatic, opinionated | Bold claims, profanity, short punchy sentences |
| Gergely Orosz | blog.pragmaticengineer.com | Professional, structured | Headers, numbered lists, industry-insider framing |
| Patrick McKenzie | kalzumeus.com | Narrative, strategic | Parenthetical asides, financial metaphors, long-form |
| Will Larson | lethain.com | Measured, systematic | Framework-oriented, passive voice, impersonal |
| Maciej Cegłowski | idlewords.com | Satirical, literary | Extended metaphors, irony, cultural references |
| Gwern Branwen | gwern.net | Academic, exhaustive | Footnotes, hedging language, Bayesian reasoning |
| Jeff Atwood | blog.codinghorror.com | Conversational, pop-culture | Movie/book references, rhetorical questions |
| Sarah Drasner | sarahdrasner.com | Warm, instructional | "You" address, step-by-step, encouraging tone |
| Swizec Teller | swizec.com | Casual, diary-like | First-person narrative, "today I learned" framing |
| Thorsten Ball | thorstenball.com | Precise, minimal | Short posts, no filler, code-adjacent metaphors |
| Hillel Wayne | hillelwayne.com | Contrarian, formal-logic | "Actually…" framing, counterexamples, proofs |
| Xe Iaso | xeiaso.net | Playful, experimental | Dialogue format, character voices, unconventional structure |
| Rachel Kroll | rachelbythebay.com | Terse, war-story | No introduction, straight to the bug, minimal opinion |
| Jessie Frazelle | blog.jessfraz.com | Direct, systems-level | Short paragraphs, imperative mood, infrastructure focus |
| Kelsey Hightower | Various (talks/posts) | Aphoristic, demo-driven | One-liners, live-demo framing, "just works" reveals |
| Cindy Sridharan | copyconstruct.medium.com | Thorough, systems-thinking | Long-form analysis, multiple perspectives, industry context |

If any writer's content is inaccessible at the time of validation, replace them with another writer that covers the same tone archetype. The goal is 20 writers with diverse voices, not these specific 20 writers.

#### Step 2 — Fetch content per writer

For each writer, collect 5–10 representative posts. Prioritize diversity within each writer's archive (not their 10 most recent — pick posts that show their range).

**How to fetch:**

1. **Personal blogs:** Use `@extractus/article-extractor` (already in the devcast stack) or `web_fetch` to retrieve full article text from public URLs. Prefer the blog's archive/index page to find post URLs, then fetch each post individually.
2. **Newsletters:** If the newsletter has a public archive (e.g., Substack archives), fetch from there. If not, skip that writer or find their blog instead.
3. **Social media posts (LinkedIn, Twitter/X):** Do NOT scrape directly from the platform. Instead, search the web for the writer's posts as quoted or cited in other sources (news articles, blog aggregators, HackerNews discussions). If social media posts are the writer's primary medium and no secondary source exists, skip that writer and replace with another.
4. **Talks/transcripts:** For writers who primarily give talks (e.g., Kelsey Hightower), search for published transcripts or blog-post versions of their talks.

**What to store per post:**

```typescript
interface ReferencePost {
  writer_name: string;       // "Paul Graham"
  url: string;               // source URL
  title: string;             // post title
  text: string;              // full text, HTML stripped
  word_count: number;        // for filtering
  fetched_at: string;        // ISO date
}
```

Store all fetched posts in `scripts/registry-validation/reference-posts.json`. This file is used only for validation and is NOT deployed to production.

**Minimum viable fetch:** at least 5 posts per writer, at least 100 total posts across all 20 writers. If a writer yields fewer than 5 fetchable posts, replace that writer.

#### Step 3 — Run the registry against all reference posts

For each reference post, run every regex in MOVES_REGISTRY against the post text and record matches.

```typescript
// scripts/validate-registry.ts
import { MOVES_REGISTRY } from '../src/voice/moves-registry';
import referencePosts from './registry-validation/reference-posts.json';

interface WriterProfile {
  writer: string;
  total_posts: number;
  move_frequencies: Record<string, number>;  // move_id → frequency (0.0–1.0)
  activated_moves: string[];                  // moves with freq > 0.05
  top_5_moves: string[];                      // highest frequency moves
}

const writerProfiles: WriterProfile[] = [];

const writers = [...new Set(referencePosts.map(p => p.writer_name))];

for (const writer of writers) {
  const posts = referencePosts.filter(p => p.writer_name === writer);
  const freqs: Record<string, number> = {};

  for (const move of MOVES_REGISTRY) {
    let matches = 0;
    for (const post of posts) {
      if (move.regex.test(post.text)) matches++;
    }
    freqs[move.id] = matches / posts.length;
  }

  const activated = Object.entries(freqs)
    .filter(([_, f]) => f > 0.05)
    .map(([id]) => id);

  const top5 = Object.entries(freqs)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id);

  writerProfiles.push({
    writer,
    total_posts: posts.length,
    move_frequencies: freqs,
    activated_moves: activated,
    top_5_moves: top5,
  });
}
```

#### Step 4 — Validate the registry meets four criteria

The registry passes validation if and only if ALL four conditions hold:

**Criterion 1 — Discrimination:** No two writers activate the same top-5 moves in the same order. If two writers have identical top-5, the registry lacks discriminating power and needs additional moves that differentiate them.

**Criterion 2 — Coverage:** Every move in the registry is activated (freq > 0.05) by at least one writer. Moves activated by zero writers are dead weight — either the regex is too narrow, or the move is too rare to be useful. Remove dead moves or fix their regex.

**Criterion 3 — No universals:** No move is activated by all 20 writers. A move that everyone uses is not a voice differentiator — it is a baseline of English writing. Either remove it, or make the regex more specific to capture only the distinctive variant.

**Criterion 4 — Spread:** The average number of activated moves per writer is between 10 and 25 (out of the full registry). If average < 10, the registry is too specific and most moves will be dead for most users. If average > 25, the registry is too broad and the dice has too many moves to roll meaningfully.

**If validation fails:**

- Criterion 1 fails → Add moves from stylometric literature that target the specific dimension where the two writers differ (e.g., sentence length distribution, question frequency, vocabulary tier)
- Criterion 2 fails → Remove the dead move, or widen its regex, or replace it with a variant that captures the intended pattern more broadly
- Criterion 3 fails → Make the regex more specific (e.g., `em_dash_rhythm` matching any em-dash is too broad if everyone uses em-dashes; narrow to "em-dash followed by a short reveal clause")
- Criterion 4 fails → Add or remove moves as needed

After fixing, re-run Step 3. Iterate until all 4 criteria pass.

#### Step 5 — Check for missing patterns

For each writer, manually read 2–3 of their posts and note any distinctive stylistic pattern that the registry did NOT detect. Examples of patterns that might be missing:

- A writer who always opens with a one-sentence paragraph
- A writer who uses footnotes or endnotes
- A writer who embeds code snippets as metaphors (not literal code)
- A writer who structures posts as numbered lessons
- A writer who uses blockquotes from other sources as anchors

For each identified missing pattern:

1. Define a regex that detects it
2. Write a positive example and a negative example
3. Add it to the registry
4. Re-run validation

The registry may grow beyond 42 entries. That is acceptable — the dice handles any registry size. The cap is practical, not architectural: registries above ~60 entries produce prompt bloat when injecting the dice roll. If the registry grows past 60, split moves into "core" (always rolled) and "extended" (rolled only for authors who activate them).

#### Step 6 — Produce the validation report

The output of this procedure is:

1. **Updated `src/voice/moves-registry.ts`** with any new/modified entries
2. **`scripts/registry-validation/validation-report.md`** containing:
   - The 20 writers used and their post counts
   - Per-writer activated moves table
   - Whether each criterion passed/failed and what was changed
   - Any new moves added and why
   - Final registry size
3. **`scripts/registry-validation/reference-posts.json`** (the fetched posts, for reproducibility)

This report is committed to git. It is the evidence that the registry was validated, not just authored. Any future registry change should re-run validation and update the report.

### The `analyze-voice.ts` script

This script runs the MOVES_REGISTRY against a specific user's published posts and outputs their voice profile. It is used for:

1. Debugging: "what moves does this user activate?"
2. Onboarding diagnostics: "does this user's voice have enough signal for Stage 3?"
3. Registry expansion: "is there a pattern in this user's writing that the registry doesn't capture?"

```typescript
// scripts/analyze-voice.ts
//
// Usage: npx tsx scripts/analyze-voice.ts --tenant <id> --author <login>
// Or:    npx tsx scripts/analyze-voice.ts --file <path-to-csv>
//
// Output: a JSON report to stdout with:
//   - total posts analyzed
//   - per-move frequency and calibrated probability
//   - activated moves (prob > 0)
//   - suggested always-hashtags
//   - detected opening register distribution
//   - draft vs published comparison (if both are available in the data)
//
// The script reuses MOVES_REGISTRY and calibrateMoveProbability() from
// src/voice/moves-registry.ts and src/voice/dice.ts respectively.
// It does NOT write to the database. It is read-only and diagnostic.

import { MOVES_REGISTRY } from '../src/voice/moves-registry';
import { calibrateMoveProbability } from '../src/voice/dice';

interface AnalysisResult {
  total_posts: number;
  activated_moves: Array<{
    id: string;
    category: string;
    description: string;
    frequency: number;        // raw: matches / total_posts
    calibrated_prob: number;  // after calibrateMoveProbability()
  }>;
  inactive_moves: string[];   // move IDs with 0 matches
  always_hashtags: string[];
  opening_register: {
    first_person_action: number;  // percentage of posts opening with "I [verb]"
    third_person_subject: number;
    question: number;
    number_count: number;
    mid_action: number;
    other: number;
  };
  papagayo_signals?: Array<{
    move_id: string;
    published_freq: number;
    draft_freq: number;
    ratio: number;  // draft_freq / published_freq — >1.5 is overrepresentation
  }>;
}
```

The script must be runnable independently of the database by passing `--file` with a CSV containing columns `published` (text) and optionally `ai_draft` (text) and `status` (string). This allows running it against exported Buffer data without database access.

### Registry structure

```typescript
// src/voice/moves-registry.ts

export interface MoveDefinition {
  id: string;                    // unique identifier, snake_case
  regex: RegExp;                 // detection pattern
  category: MoveCategory;       // rhythm | lexical | opening | structural | emphasis | closing | rhetorical | meta
  description: string;           // human-readable, injected into prompt when available
  example: string;               // positive example
  negative_example?: string;     // case that must NOT match
  min_post_length?: number;      // minimum post length (chars) where this move is detectable
}

export type MoveCategory =
  | 'rhythm'
  | 'lexical'
  | 'opening'
  | 'structural'
  | 'emphasis'
  | 'closing'
  | 'rhetorical'
  | 'meta';
```

### Complete registry (42 entries)

#### Rhythm moves (7)

```typescript
{
  id: 'very_single',
  regex: /\bvery\s+\w+[.!]/i,
  category: 'rhythm',
  description: "'Very X.' as standalone ironic intensifier",
  example: "Very slow. Very necessary.",
  negative_example: "It was very interesting to see",  // mid-sentence 'very' ≠ this move

},
{
  id: 'very_paired',
  regex: /\bvery\s+\w+[.\s,]+very\s+\w+/i,
  category: 'rhythm',
  description: "'Very X. Very Y.' paired adjective rhythm for contrast",
  example: "Very clean. Very new.",

},
{
  id: 'triple_cadence',
  regex: /(?:^|\.\s+)([A-Z][^.]{3,30}\.)\s+([A-Z][^.]{3,30}\.)\s+([A-Z][^.]{3,30}\.)/m,
  category: 'rhythm',
  description: "Three short declarative sentences in a row (X. Y. Z.)",
  example: "It compiled. It deployed. It broke.",

},
{
  id: 'em_dash_rhythm',
  regex: /—/,
  category: 'rhythm',
  description: "Em-dash for parenthetical or dramatic pause",
  example: "The fix was obvious — in retrospect.",

},
{
  id: 'semicolon_join',
  regex: /;\s+[a-z]/,
  category: 'rhythm',
  description: "Semicolon joining two independent clauses",
  example: "The test passed; the deploy didn't.",

},
{
  id: 'parenthetical_aside',
  regex: /\([^)]{10,80}\)/,
  category: 'rhythm',
  description: "Parenthetical aside or self-correction",
  example: "I shipped the fix (or what I thought was the fix).",

},
{
  id: 'ellipsis_pause',
  regex: /\.\.\./,
  category: 'rhythm',
  description: "Ellipsis for trailing thought or dramatic pause",
  example: "I checked the logs and...",

},
```

#### Lexical moves (9)

```typescript
{
  id: 'frankly_adverb',
  regex: /\bfrankly\b/i,
  category: 'lexical',
  description: "'Frankly' as self-aware conversational adverb",
  example: "Frankly, I expected it to break.",

},
{
  id: 'exactly_emphasis',
  regex: /\bexactly\b/i,
  category: 'lexical',
  description: "'Exactly' to pin down a precise point",
  example: "That is exactly the problem.",

},
{
  id: 'beautiful_intensifier',
  regex: /\bbeautiful\b/i,
  category: 'lexical',
  description: "'Beautiful' as intensifier for technical elegance",
  example: "A beautiful abstraction.",

},
{
  id: 'incredible_reaction',
  regex: /\bincredible\b/i,
  category: 'lexical',
  description: "'Incredible' as genuine reaction word",
  example: "The performance improvement was incredible.",

},
{
  id: 'literally_emphasis',
  regex: /\bliterally\b/i,
  category: 'lexical',
  description: "'Literally' for emphasis (often hyperbolic)",
  example: "It literally took 3 days.",

},
{
  id: 'spoiler_tag',
  regex: /\bspoiler\b/i,
  category: 'lexical',
  description: "'Spoiler:' as casual foreshadowing device",
  example: "Spoiler: it didn't work.",

},
{
  id: 'self_deprecating_word',
  regex: /\b(wrong|mistake|broke|failed|embarrassing|humiliating|stupid)\b/i,
  category: 'lexical',
  description: "Self-deprecating vocabulary (owning failure)",
  example: "I was completely wrong about the architecture.",

},
{
  id: 'trump_cadence',
  regex: /\b(tremendous|believe me|many people|nobody|everybody knows)\b/i,
  category: 'lexical',
  description: "Hyperbolic intensifiers in the Trump style (ironic or playful)",
  example: "Tremendous improvement. Believe me.",

},
{
  id: 'sound_like_me',
  regex: /\bsound(s)?\s+like\s+me\b/i,
  category: 'lexical',
  description: "'Sound(s) like me' as meta-voice reference",
  example: "That doesn't sound like me at all.",

},
```

#### Opening moves (7)

```typescript
{
  id: 'opens_with_number',
  regex: /^[\d,]+\s+(lines?|files?|commits?|decisions?|hours?|days?|minutes?)/im,
  category: 'opening',
  description: "Opens with a numeric count (lines added, hours spent)",
  example: "313 lines added. Zero removed.",
  negative_example: "I spent 3 hours debugging",  // number mid-sentence ≠ this move

},
{
  id: 'opens_first_person_action',
  regex: /^I\s+(shipped|deleted|added|wrote|built|pushed|created|fixed|removed|broke|deployed|refactored)/im,
  category: 'opening',
  description: "Opens with 'I [action verb]' — first-person, concrete",
  example: "I shipped a landing page for Devcast today.",

},
{
  id: 'opens_third_person_subject',
  regex: /^(The|A|An|Claude|My|This|That|Every|One|Two|Three)\s+\w+/im,
  category: 'opening',
  description: "Opens naming a third-person subject or abstract noun",
  example: "The bug was in the routing logic.",

},
{
  id: 'opens_with_question',
  regex: /^(What|Why|How|When|Where|Who|Did|Is|Are|Do|Can|Should|Have)\s+/im,
  category: 'opening',
  description: "Opens with a question",
  example: "What happens when your type guard fails silently?",

},
{
  id: 'opens_mid_action',
  regex: /^(So|Then|And|But|Yesterday|Today|Last\s+\w+|This\s+(morning|afternoon|week))/im,
  category: 'opening',
  description: "Opens mid-action or with temporal anchor",
  example: "Yesterday I deleted 400 lines of code.",

},
{
  id: 'opens_bold_thesis',
  regex: /^[A-Z][^.?!]{10,60}[.!]$/m,
  category: 'opening',
  description: "Opens with a bold declarative thesis statement",
  example: "Most developers build things the world never sees.",
  negative_example: "Hi everyone, today I want to talk about...",

},
{
  id: 'opens_confession',
  regex: /^(I\s+(admit|confess|was wrong|didn't know|had no idea)|Confession|Honest(ly)?)/im,
  category: 'opening',
  description: "Opens with a confession or admission",
  example: "I had no idea what I was doing when I started.",

},
```

#### Structural moves (7)

```typescript
{
  id: 'im_building_context',
  regex: /I'm building\b/i,
  category: 'structural',
  description: "'I'm building [project]' context sentence near the top",
  example: "I'm building Devcast, an open-source tool that turns GitHub commits into social media posts.",

},
{
  id: 'arrow_bullets',
  regex: /→/,
  category: 'structural',
  description: "Arrow bullet lists (→) for enumerations",
  example: "→ fetch → dedup → classify → embed",

},
{
  id: 'colon_reveal',
  regex: /:\s+[a-z]/,
  category: 'structural',
  description: "Colon followed by a reveal or explanation",
  example: "The real problem: nobody tested it.",

},
{
  id: 'numbered_inline_list',
  regex: /\b[1-3]\)\s+\w+/,
  category: 'structural',
  description: "Numbered inline list (1) thing 2) thing 3) thing)",
  example: "Three things: 1) the deploy 2) the rollback 3) the postmortem.",

},
{
  id: 'contrast_before_after',
  regex: /\b(before|without)\b.{5,60}\b(after|with|now)\b/i,
  category: 'structural',
  description: "Before/after or without/with contrast pair",
  example: "Before the refactor: 800ms. After: 120ms.",

},
{
  id: 'zero_quantity',
  regex: /\bzero\s+(removed|deleted|errors?|bugs?|downtime|issues?|complaints?)/i,
  category: 'structural',
  description: "'Zero [noun]' for emphasis on absence",
  example: "Zero removed. Zero errors. Zero complaints.",

},
{
  id: 'the_fix_was',
  regex: /\bthe\s+(fix|solution|answer|trick|key)\s+(was|is|turned out)\b/i,
  category: 'structural',
  description: "'The fix/solution/key was…' resolution framing",
  example: "The fix was a single line change.",

},
```

#### Emphasis moves (4)

```typescript
{
  id: 'all_caps_word',
  regex: /\b[A-Z]{4,}\b/,
  category: 'emphasis',
  description: "ALL CAPS for emphasis on a single word",
  example: "That is NOT the same thing.",
  negative_example: "API, HTTP, DNS",  // acronyms ≠ emphasis

},
{
  id: 'italic_emphasis',
  regex: /\*[^*]+\*/,
  category: 'emphasis',
  description: "Italic (*word*) for emphasis or foreign terms",
  example: "It *almost* worked.",

},
{
  id: 'repetition_for_emphasis',
  regex: /(\b\w{3,}\b).{0,10}\1/i,
  category: 'emphasis',
  description: "Deliberate word repetition for rhetorical effect",
  example: "Simple is simple. That's the whole point.",

},
{
  id: 'short_sentence_impact',
  regex: /(?:^|\.\s+)([A-Z]\w{0,8}\.)\s/m,
  category: 'emphasis',
  description: "One-word or very short sentence for impact",
  example: "Done.",

},
```

#### Closing moves (3)

```typescript
{
  id: 'closes_with_lesson',
  regex: /(lesson|learned|takeaway|moral|principle).{0,60}$/im,
  category: 'closing',
  description: "Closes with an explicit lesson or takeaway",
  example: "The lesson: always read the logs first.",

},
{
  id: 'closes_with_future',
  regex: /(tomorrow|next\s+(week|time|step)|soon|eventually|we'll see).{0,40}$/im,
  category: 'closing',
  description: "Closes pointing to the future or next steps",
  example: "Landing page tomorrow. Certainty today.",

},
{
  id: 'closes_with_reversal',
  regex: /(but|except|plot twist|turns out|ironically).{0,60}$/im,
  category: 'closing',
  description: "Closes with an ironic reversal or twist",
  example: "Turns out, the real bug was in my test.",

},
```

#### Rhetorical moves (3)

```typescript
{
  id: 'rhetorical_question',
  regex: /\?\s*\n/,
  category: 'rhetorical',
  description: "Rhetorical question as transition or emphasis",
  example: "Why does this matter?\n\nBecause…",

},
{
  id: 'analogy_comparison',
  regex: /\b(like|as if|imagine|think of it as|picture|same way)\b/i,
  category: 'rhetorical',
  description: "Analogy or comparison to explain a concept",
  example: "Think of it as a circuit breaker for your API.",

},
{
  id: 'direct_address',
  regex: /\b(you (know|should|can|will|might|probably)|your)\b/i,
  category: 'rhetorical',
  description: "Direct second-person address to the reader",
  example: "You know that feeling when the deploy goes green?",

},
```

#### Meta moves (2)

```typescript
{
  id: 'epistemic_hedge',
  regex: /\b(I think|I believe|probably|maybe|not sure|might be)\b/i,
  category: 'meta',
  description: "Epistemic hedging — expressing uncertainty",
  example: "I think this is the right approach, but I'm not sure.",

},
{
  id: 'meta_writing_reference',
  regex: /\b(this post|I('m| am) writing|I wanted to (share|talk|write))\b/i,
  category: 'meta',
  description: "Meta-reference to the act of writing or sharing",
  example: "I wanted to share what I learned this week.",

},
```

### Hashtag moves (always-on, not dice-rolled)

Hashtags that appear in ≥80% of an author's published posts are classified as "always" moves. They are not subject to the dice roll — they appear in every post.

Detection: during Loop 1, measure hashtag frequency across published posts. Any hashtag appearing in ≥80% is marked as `always`.

```typescript
{
  id: 'hashtag_always',
  // Not regex-based — dynamically detected per author
  category: 'meta',
  description: "Hashtags that appear in nearly every post (auto-detected per author)",

}
```

---

## Voice Dice

The voice dice mechanism controls which voice moves are available for each specific post generation. It prevents the model from using all of the author's tics in every post, creating the natural variation that distinguishes a human writer from a parrot.

### How it works

1. For each author, `voice.voice_moves` (inside `voice_profiles.voice` JSONB) stores a JSON object mapping move IDs to measured probabilities
2. Before each generation, the system rolls the dice for every move using a seeded random number generator
3. The result — which moves are AVAILABLE and which are NOT THIS TIME — is injected into the prompt
4. The model uses available moves naturally, and finds alternative phrasings for unavailable ones

### Dice roll algorithm

```typescript
function rollVoiceDice(
  moves: Record<string, number>,  // { move_id: probability }
  commitSha: string,
  draftIndexToday: number,
): RolledMoves {
  const available: MoveDefinition[] = [];
  const unavailable: MoveDefinition[] = [];

  for (const [moveId, probability] of Object.entries(moves)) {
    if (probability <= 0) continue;      // move not used by this author
    if (probability >= 1.0) continue;     // always-on (handled separately)

    const move = MOVES_REGISTRY.find(m => m.id === moveId);
    if (!move) continue;

    // Seeded RNG: same commit + move always produces the same roll
    const seed = hash(commitSha + ':' + draftIndexToday + ':' + moveId);
    const roll = seededRandom(seed);  // 0.0 to 1.0

    if (roll < probability) {
      available.push(move);
    } else {
      unavailable.push(move);
    }
  }

  return { available, unavailable };
}
```

**Determinism:** the same commit SHA regenerated always produces the same dice roll (reproducible for debugging). Two different commits produce different rolls. Two drafts from the same commit on the same day produce different rolls (because `draftIndexToday` differs).

### Prompt injection format

```xml
<voice_moves>
This author has a specific voice. For THIS post, the dice roll has selected
which moves are available. The goal is not to hit every available move — use
2–4 naturally where they fit. The author's voice comes through in the rhythm
and register, not in having every tic present.

Always present:
- #lilicurl
- #codingWithHumor

Available for this post (use if they fit naturally, never force):
- "Very X." as standalone ironic intensifier
- Triple short-sentence rhythm (X. Y. Z.)
- "Frankly" as self-aware adverb
- Opens with "I shipped/deleted/added" first-person action
- Analogy or comparison to explain a concept

NOT available for this post (find different phrasings):
- "Very X. Very Y." paired rhythm
- "I'm building [project]" context framing
- Opens with a line count
- Em-dash for parenthetical pause
- "Exactly" to pin down a point
</voice_moves>
```

**Key language choice:** "Available" and "NOT available" instead of "use" and "don't use". The model should treat available moves as a palette, not a checklist. "NOT available" means "the author uses this sometimes, but not in this post — find a different phrasing that does the same rhetorical work."

### Probability calibration

Probabilities come from measuring the author's published posts. The formula:

```typescript
function calibrateMoveProbability(
  matchCount: number,
  totalPosts: number,
): number {
  if (totalPosts < 5) return 0;   // insufficient data
  const raw = matchCount / totalPosts;
  if (raw < 0.05) return 0;       // noise threshold — move not part of this author's voice
  if (raw > 0.90) return 0.90;    // cap at 0.90 — even dominant moves should occasionally be absent
  return Math.round(raw * 20) / 20;  // round to nearest 0.05 for simplicity
}
```

The cap at 0.90 is critical. Without it, a move used in 100% of published posts (like `triple_cadence` for the first production user) would appear in every generated post — exactly the parrot problem. The cap ensures that even dominant moves are absent ~10% of the time, creating natural variation.

### Calibration from production data

For the first production user (12 unique published LinkedIn posts, measured):

| Move | Published freq | Calibrated prob |
|---|---|---|
| `very_single` | 83% | 0.80 |
| `very_paired` | 67% | 0.65 |
| `triple_cadence` | 100% | 0.90 (capped) |
| `frankly_adverb` | 42% | 0.40 |
| `exactly_emphasis` | 50% | 0.50 |
| `beautiful_intensifier` | 33% | 0.35 |
| `incredible_reaction` | 17% | 0.15 |
| `opens_with_number` | 17% | 0.15 |
| `opens_first_person_action` | 33% | 0.35 |
| `opens_with_question` | 42% | 0.40 |
| `self_deprecating_word` | 50% | 0.50 |
| `trump_cadence` | 42% | 0.40 |
| `analogy_comparison` | 67% | 0.65 |
| `rhetorical_question` | 42% | 0.40 |
| `arrow_bullets` | 25% | 0.25 |
| `sound_like_me` | 17% | 0.15 |
| `em_dash_rhythm` | 8% | 0.10 |
| `im_building_context` | 8% | 0.10 |
| `closes_with_lesson` | 25% | 0.25 |

Moves not detected in published posts (probability = 0): `zero_quantity`, `spoiler_tag`, `italic_emphasis`, `numbered_inline_list`, and others. These never activate for this author but may activate for other users.

---

## Loop 1 — Statistical recalculation (replaces Haiku extraction)

Phase 3 current: Loop 1 runs every 5 publications and calls Haiku to re-extract `style_patterns` + `voice_devices` from the last N published posts. Cost: ~$0.02 per refresh.

This spec: Loop 1 runs every 5 publications and recalculates move probabilities by running regex matches against published posts. Cost: $0.00.

### Algorithm

```typescript
async function refreshVoiceMoves(
  tenantId: string,
  authorLogin: string,
  db: SupabaseClient,
): Promise<void> {
  // Move measurement is cross-platform: the author's stylistic patterns
  // (rhythm, emphasis, closings, rhetorical devices) are not platform-specific.
  // A move the author uses on LinkedIn they also use on Instagram — they are
  // properties of the person's writing, not the format. Filtering by platform
  // would halve the signal and produce different dice profiles per platform
  // for the same author. Only the exposure pool (refreshExposurePool) is
  // per-platform, because format matters for what Claude sees as examples.
  const recent = await db
    .from('voice_posts')
    .select('id, published, edit_ratio, published_at, top_module_id')
    .eq('tenant_id', tenantId)
    .eq('author_login', authorLogin)
    // no platform filter — cross-platform by design (see comment above)
    .eq('status', 'published')
    .not('published', 'is', null)
    .gte('edit_ratio', 0.30)
    .order('published_at', { ascending: false })
    .limit(30);

  // Deduplicate
  const seen = new Set<string>();
  const posts = recent.data.filter(p => {
    const key = p.published.substring(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // ── Ensure author-specific row exists ──────────────────────
  // refreshVoiceMoves MUST write to an author-specific row
  // (github_author_login = authorLogin), never to the tenant default.
  const authorRow = await db
    .from('voice_profiles')
    .select('id, voice, version')
    .eq('tenant_id', tenantId)
    .eq('github_author_login', authorLogin)
    .maybeSingle();

  if (!authorRow.data) {
    const tenantDefault = await db
      .from('voice_profiles')
      .select('voice')
      .eq('tenant_id', tenantId)
      .is('github_author_login', null)
      .maybeSingle();

    const seedVoice = tenantDefault?.data?.voice ?? {};
    await db.from('voice_profiles').insert({
      tenant_id: tenantId,
      github_author_login: authorLogin,
      voice: seedVoice,
      version: 1,
    });
  }

  // Re-fetch the now-guaranteed author-specific row
  const current = await db
    .from('voice_profiles')
    .select('voice, version')
    .eq('tenant_id', tenantId)
    .eq('github_author_login', authorLogin)
    .single();

  const currentVoice = current.data?.voice ?? {};
  const currentVersion = current.data?.version ?? 0;

  // ── Compute stage and shared data (needed by all paths) ────
  const totalUniquePublished = await countUniquePublished(tenantId, authorLogin, db);
  const stage = computeVoiceStage(totalUniquePublished, !!currentVoice.bootstrap_posts?.length);
  // Pool is refreshed per-platform. refreshVoiceMoves is called once per author
  // per scanner run, but must produce separate pools for each platform the author
  // has published on. LinkedIn and Instagram pools are stored separately inside
  // voice_examples_pool as { linkedin: string[], instagram: string[] }.
  // If the author has only published on one platform, the other key is absent.
  const linkedinPool = await refreshExposurePool(tenantId, authorLogin, 'linkedin', db);
  const instagramPool = await refreshExposurePool(tenantId, authorLogin, 'instagram', db);
  const pool = { linkedin: linkedinPool, instagram: instagramPool };

  // Detect always-on hashtags (useful from Stage 2 onward)
  const hashtagCounts = new Map<string, number>();
  const hashtagRegex = /(?<=^|\s)#[A-Za-z0-9_]+/g;
  for (const post of posts) {
    const hashtags = post.published.match(hashtagRegex) || [];
    for (const tag of new Set(hashtags)) {
      hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
    }
  }
  const alwaysHashtags: string[] = [];
  if (posts.length > 0) {
    for (const [tag, count] of hashtagCounts) {
      if (count / posts.length >= 0.80) {
        alwaysHashtags.push(tag);
      }
    }
  }

  // ── Path 1: insufficient data for move measurement ─────────
  // Less than 5 quality-filtered posts. Persist stage + pool + proto-summary
  // but do NOT compute voice_moves (dice not ready).
  if (posts.length < 5) {
    const updatedVoice = {
      ...currentVoice,
      voice_stage: stage,
      voice_examples_pool: pool,           // { linkedin: string[], instagram: string[] }
      always_hashtags: alwaysHashtags,
      voice_summary: posts.length >= 3
        ? computeProtoSummary(posts, alwaysHashtags)
        : currentVoice.voice_summary ?? '',
      // voice_moves is NOT written here — but the spread above preserves any
      // existing voice_moves from currentVoice. This is intentional: if an author
      // previously reached Stage 3 (dice calibrated) and temporarily falls to
      // Path 1 (e.g., deleted posts, scanner gap), they keep their existing dice
      // rather than losing calibrated voice data for a transient minimum.
      // When they accumulate enough posts again, Path 3 will overwrite voice_moves
      // with freshly measured probabilities. The preserved dice may be slightly
      // stale, but a stale calibrated voice is better than no voice at all.
    };

    await db.from('voice_profiles').update({
      voice: updatedVoice,
      version: currentVersion + 1,
    })
    .eq('tenant_id', tenantId)
    .eq('github_author_login', authorLogin)
    .eq('version', currentVersion);

    logger.info('voice.moves.refresh_skipped', {
      author_login: authorLogin,
      reason: 'insufficient_quality_posts_for_moves',
      quality_filtered_count: posts.length,
      total_unique_published: totalUniquePublished,
      stage,
    });
    return;
  }

  // ── Path 2: Stage 2 (warming) — proto-summary, no dice ────
  if (stage === 'warming') {
    const updatedVoice = {
      ...currentVoice,
      voice_stage: stage,
      voice_examples_pool: pool,           // { linkedin: string[], instagram: string[] }
      always_hashtags: alwaysHashtags,
      voice_summary: computeProtoSummary(posts, alwaysHashtags),
      // voice_moves is NOT written here — but the spread above preserves any
      // existing voice_moves from currentVoice. Same behavior as Path 1, same
      // rationale: if the author fell from Stage 3 to warming (e.g., some posts
      // expired or were deleted), their calibrated dice are preserved rather than
      // discarded. Path 3 will overwrite them when the author reaches Stage 3 again.
      //
      // Important: preserved voice_moves are INERT during Stage 2. buildProgressiveVoiceBlocks
      // only injects <voice_moves> when stage === 'established'. In warming, only
      // <voice_signals> is injected. The stale dice sit in the JSONB but produce
      // no prompt output until Stage 3 is re-reached and Path 3 recalibrates them.
      // They are zombi data — harmless, not memory-leaked (bounded by the JSONB size),
      // and self-healing when data recovers.
    };

    const { error } = await db.from('voice_profiles').update({
      voice: updatedVoice,
      version: currentVersion + 1,
    })
    .eq('tenant_id', tenantId)
    .eq('github_author_login', authorLogin)
    .eq('version', currentVersion);

    if (error) {
      logger.warn('voice.moves.refresh_conflict', { author_login: authorLogin });
      return;
    }

    logger.info('voice.moves.refreshed', {
      author_login: authorLogin,
      stage,
      moves_count: 0,
      always_hashtags: alwaysHashtags,
      pool_size: pool.length,
      posts_analyzed: posts.length,
    });
    return;
  }

  // ── Path 3: Stage 3 (established) — full move measurement ──
  const newMoves: Record<string, number> = {};
  for (const move of MOVES_REGISTRY) {
    let matchCount = 0;
    for (const post of posts) {
      if (move.regex.test(post.published)) {
        matchCount++;
      }
    }
    const prob = calibrateMoveProbability(matchCount, posts.length);
    if (prob > 0) {
      newMoves[move.id] = prob;
    }
  }

  // Smooth with current values (avoid wild swings from a single week)
  const smoothed: Record<string, number> = {};
  if (currentVoice.voice_moves) {
    for (const [moveId, newProb] of Object.entries(newMoves)) {
      const oldProb = currentVoice.voice_moves[moveId] || newProb;
      smoothed[moveId] = Math.round((0.6 * oldProb + 0.4 * newProb) * 20) / 20;
    }
  } else {
    Object.assign(smoothed, newMoves);
  }

  const updatedVoice = {
    ...currentVoice,
    voice_moves: smoothed,
    voice_stage: stage,
    voice_examples_pool: pool,
    always_hashtags: alwaysHashtags,
    voice_summary: computeVoiceSummary(smoothed),
  };

  const { error } = await db
    .from('voice_profiles')
    .update({
      voice: updatedVoice,
      version: currentVersion + 1,
    })
    .eq('tenant_id', tenantId)
    .eq('github_author_login', authorLogin)
    .eq('version', currentVersion);

  if (error) {
    logger.warn('voice.moves.refresh_conflict', { author_login: authorLogin });
    return;
  }

  logger.info('voice.moves.refreshed', {
    author_login: authorLogin,
    stage,
    moves_count: Object.keys(smoothed).length,
    always_hashtags: alwaysHashtags,
    pool_size: pool.length,
    posts_analyzed: posts.length,
  });
}
```

### Smoothing rationale

The 60/40 smoothing (60% old, 40% new) prevents wild probability swings from a single batch of posts. If an author uses "frankly" in 3 of 5 recent posts but their historical rate is 40%, the smoothed probability becomes 0.6 × 0.40 + 0.4 × 0.60 = 0.48, not 0.60. This prevents the dice from overreacting to short-term patterns.

---

## Schema changes

### `voice_profiles.voice` JSONB — interface extension

The master spec defines `voice_profiles.voice` as a `JSONB NOT NULL DEFAULT '{}'` column containing the `VoiceProfile` interface. This spec **extends** that interface with new optional fields. No new top-level columns are added to `voice_profiles`.

```typescript
// Extension to VoiceProfile interface (master spec §VoiceProfile JSONB contract)
// All new fields are optional — existing profiles without them are valid.
interface VoiceProfile {
  // ... all existing fields from master spec (tone, rhythm, hashtags, etc.) ...

  // ── New fields added by voice-system-spec ──

  voice_moves?: Record<string, number>;  // { move_id: calibrated_probability }
                                          // null = system has not measured moves yet (Stages 0–2)
                                          // present = Stage 3 (established), dice is active

  voice_stage?: 'cold' | 'bootstrap' | 'warming' | 'established';
                                          // cached last computed stage, recalculated on each generation
                                          // null = treat as 'cold'

  voice_examples_pool?: {                 // per-platform pools (pool is per-platform; moves are cross-platform)
    linkedin?: string[];                  // UUIDs of linkedin voice_posts eligible for exposure
    instagram?: string[];                 // UUIDs of instagram voice_posts eligible for exposure
  };                                      // refreshed by Loop 1, used by selectExposureExamples
                                          // null/absent = no pool yet (Stages 0–1)

  always_hashtags?: string[];             // hashtags auto-detected in ≥80% of published posts
                                          // these are ADDITIVE to voice.hashtags (see Hashtag Priority below)
                                          // null = not yet detected

  recent_opening_sequence?: string[];
                                          // opening_move values of the last 5 PUBLISHED posts, oldest-first
                                          // computed by Loop 1 from voice_posts.opening_move
                                          // used to detect multi-week structural repetition
                                          // null = not yet computed

  bootstrap_posts?: BootstrapPost[];
  // null = user did not paste bootstrap posts
  // Relationship to tenants.voice_bootstrap:
  //   tenants.voice_bootstrap is the raw textarea input (master spec §tenants schema, §voice_profiles table)
  //   voice.bootstrap_posts is the parsed array stored here on save
  //   tenants.voice_bootstrap remains the source of truth for the raw input
  //   if the user edits the textarea, voice.bootstrap_posts is re-parsed from it
}

// Type alias for bootstrap post entries
interface BootstrapPost {
  text: string;       // full post text, stored as-is
  pasted_at: string;  // ISO timestamp of when the user pasted it
}
```

**Migration:** no SQL migration needed. The `voice` column is `JSONB DEFAULT '{}'` — new fields appear as the system writes them. Existing profiles with `voice = '{}'` or with only the old fields continue working. The prompt builder checks `voice.voice_moves` presence to decide which system to use.

**Existing fields (`style_patterns`, `voice_devices`) are NOT removed from the interface.** They stop being read by the prompt-builder when `voice_moves` is present. This allows gradual rollout and rollback.

### Hashtag priority

The master spec defines `voice.hashtags: string[]` + `voice.hashtags_mode: 'always' | 'prefer'` (master spec §VoiceProfile JSONB contract, §Hashtag Injection). This spec adds `voice.always_hashtags: string[]` (auto-detected from published posts).

Priority rules:

1. `voice.hashtags` + `hashtags_mode` are **user-configured** (set in `/settings/voice`). They always win.
2. `voice.always_hashtags` are **system-detected** (measured by Loop 1 from published posts).
3. If `hashtags_mode = 'always'`: inject `voice.hashtags` exactly as the master spec says. Then, for the `<voice_moves>` "Always present" section, include only those `always_hashtags` that are NOT already in `voice.hashtags`. This avoids duplicates.
4. If `hashtags_mode = 'prefer'`: inject `voice.hashtags` as preferred per master spec. `always_hashtags` not in `voice.hashtags` are also listed as "Always present" in `<voice_moves>`.
5. If the user has no `voice.hashtags` configured: `always_hashtags` are the only hashtags injected as "Always present".

**An implementor must NOT replace the master spec's hashtag injection logic.** The `<voice_moves>` "Always present" section is additive — it comes after the master's hashtag block in the prompt, not instead of it.

### `voice_posts` table — new columns

```sql
ALTER TABLE voice_posts
  ADD COLUMN IF NOT EXISTS generation_system TEXT DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS opening_move      TEXT DEFAULT NULL;
```

`generation_system` values: `'v1'` (current production system), `'v2_progressive'` (this spec). Used for analytics and A/B comparison, not visible to the user.

`opening_move` values: one of the opening move IDs from MOVES_REGISTRY (`'opens_with_number'`, `'opens_first_person_action'`, `'opens_third_person_subject'`, `'opens_with_question'`, `'opens_mid_action'`, `'opens_bold_thesis'`, `'opens_confession'`, `'unknown'`). Detected from the generated `ai_draft` text at draft-save time and written to the row. Used to compute `voice.recent_opening_sequence` during Loop 1 and to enforce same-day structural variety.

### `IVoiceStorage` extension

The master spec defines `IVoiceStorage` with `getVoiceProfile(tenantId: string, authorLogin: string | null): Promise<StoredVoiceProfile | null>` (master spec §Individual Voice, Always > Storage contract). The master's contract takes `tenantId` as a parameter.

This spec adds two methods following the same pattern:

```typescript
interface IVoiceStorage {
  // ... existing method from master spec ...

  // Returns published posts eligible for the exposure pool.
  // Query: voice_posts WHERE tenant_id = tenantId
  //   AND author_login = authorLogin
  //   AND platform = platform           ← per-platform: examples must match generation format
  //   AND status = 'published' AND published IS NOT NULL
  //   AND edit_ratio >= 0.30
  //   ORDER BY published_at DESC LIMIT 40
  // Deduplicates by first 80 chars of published text.
  getPublishedForExposure(
    tenantId: string,
    authorLogin: string,
    platform: string,                    // 'linkedin' | 'instagram'
  ): Promise<VoicePost[]>;

  // Returns published posts for move frequency measurement.
  // Query: voice_posts WHERE tenant_id = tenantId
  //   AND author_login = authorLogin
  //   AND status = 'published' AND published IS NOT NULL
  //   AND edit_ratio >= 0.30
  //   ORDER BY published_at DESC LIMIT 30
  // No platform filter — move measurement is cross-platform by design.
  // Deduplicates by first 80 chars of published text.
  getPublishedForMoves(
    tenantId: string,
    authorLogin: string,
  ): Promise<VoicePost[]>;

  // Returns the top_finding text of recent published posts for a given module and author.
  // Used by Chapter Context System to tell Claude which angles have already been covered.
  // Query: voice_posts WHERE tenant_id = tenantId AND author_login = authorLogin
  //   AND top_module_id = moduleId AND status = 'published'
  //   ORDER BY published_at DESC LIMIT limit
  // Full contract and Supabase implementation: §Chapter Context System → getRecentTopFindings()
  getRecentTopFindings(
    authorLogin: string | null,
    moduleId: string,
    limit: number,
  ): Promise<Array<{ top_finding: string; published_at: string }>>;
}
```

All methods return their respective types. `getPublishedForExposure` and `getPublishedForMoves` return `VoicePost[]` with at minimum: `id`, `published`, `edit_ratio`, `published_at`, `top_module_id`. The difference is semantic, not structural: exposure is per-platform because Claude must see same-format examples; moves are cross-platform because stylistic move frequency belongs to the author, not the channel.

**Note on tenant scoping:** if the actual implementation scopes `IVoiceStorage` by tenant at instantiation (e.g., `new SupabaseVoiceStorage(tenantId)`) and methods do not take `tenantId` as a parameter, the implementor must adapt these signatures to match the existing pattern. The spec follows the master spec's interface contract. What matters is the query semantics, not the parameter passing style.

---

## Prompt builder integration

The prompt builder in `src/ai/prompt-builder.ts` must be modified to read from the new voice system when `voice.voice_moves` is present (not null/undefined) in the VoiceProfile.

### Decision logic

```typescript
function buildVoiceBlocks(
  voiceProfile: VoiceProfile,
  exposurePool: VoicePost[],
  bootstrapPosts: BootstrapPost[],
  commitSha: string,
  draftIndexToday: number,
  stage: VoiceStage,
  varietyConstraint?: string,
): string {
  // New system active only when BOTH conditions are true:
  // 1. voice_moves exists (progressive system was previously calibrated)
  // 2. stage is not 'cold' (author has enough published posts to determine stage)
  //
  // WHY &&, not ||:
  // Using || causes a runtime throw when an author purges their published history:
  //   Stage 3 (voice_moves populated) → posts deleted → countUniquePublished = 0
  //   → Loop 1 Path 1 preserves voice_moves (intentional, see refreshVoiceMoves)
  //   → computeVoiceStage returns 'cold'
  //   → voice_moves is still truthy → || would enter buildProgressiveVoiceBlocks
  //   → buildProgressiveVoiceBlocks throws on stage='cold' (line below)
  //
  // With &&: stage='cold' always routes to legacy path, regardless of voice_moves.
  // Stale voice_moves is preserved for when data recovers (Path 3 will overwrite).
  if (voiceProfile.voice_moves && stage !== 'cold') {
    return buildProgressiveVoiceBlocks(voiceProfile, exposurePool, bootstrapPosts, commitSha, draftIndexToday, stage, varietyConstraint);
  }
  // Fallback to Phase 3 current (stage='cold', or legacy author without voice_moves)
  return buildLegacyVoiceBlocks(voiceProfile, exposurePool);
}
```

### Block order in prompt (new system)

```
<never>...</never>                         <!-- platform-safety only -->
<preferences>...</preferences>             <!-- behavioral overrides from Loop 3 -->
<variety_constraint>...</variety_constraint> <!-- Stages 1–3: structural opening exclusion -->
<voice_signals>...</voice_signals>         <!-- Stage 2 only: soft descriptive observations -->
<voice_moves>...</voice_moves>             <!-- Stage 3 only: dice roll available/unavailable -->
<voice_exposure>...</voice_exposure>       <!-- Stages 1–3: 2–3 full example posts -->
```

**Order rationale:** `<never>` and `<preferences>` are hard constraints. `<variety_constraint>` is a structural constraint (active from Stage 1 — does not require dice). `<voice_signals>` / `<voice_moves>` is probabilistic guidance. `<voice_exposure>` is reference material. Constraints first, then guidance, then examples.

### `buildProgressiveVoiceBlocks` implementation

This is the core function that assembles voice prompt blocks differently per stage. An implementor must follow this logic exactly — do not merge stages or skip conditional branches.

```typescript
function buildProgressiveVoiceBlocks(
  voiceProfile: VoiceProfile,
  exposurePool: VoicePost[],       // from voice.voice_examples_pool, pre-fetched
  bootstrapPosts: BootstrapPost[], // from voice.bootstrap_posts
  commitSha: string,
  draftIndexToday: number,
  stage: VoiceStage,
  varietyConstraint?: string,      // from buildVarietyConstraint(), null if no constraint
): string {
  const blocks: string[] = [];

  // ── Stage 0: cold ─────────────────────────────────────────
  // No voice blocks at all. Only STRUCTURE_MAP + TONE_INSTRUCTIONS
  // are injected by the legacy code path (buildLegacyVoiceBlocks
  // handles this). This function should NOT be called for Stage 0.
  if (stage === 'cold') {
    throw new Error('buildProgressiveVoiceBlocks must not be called for stage=cold');
  }

  // ── Voice Exposure (Stages 1–3) ───────────────────────────
  // Select 2–3 examples with commit-seeded rotation
  let examples: Array<{ text: string; topic: string }>;

  if (stage === 'bootstrap') {
    // Stage 1: only bootstrap posts, no published posts yet
    examples = bootstrapPosts.slice(0, 3).map((bp, i) => ({
      text: bp.text,
      topic: `bootstrap example ${i + 1}`,
    }));
  } else {
    // Stages 2–3: select from published pool (+ bootstrap in Stage 2)
    const pool = stage === 'warming' && exposurePool.length < 5
      ? [...exposurePool, ...bootstrapPosts.map(bp => ({
          ...syntheticVoicePost(bp),
          edit_ratio: 1.0,
          top_module_id: null,
        }))]
      : exposurePool;

    const selected = selectExposureExamples(pool, commitSha, draftIndexToday, 3);
    examples = selected.map(p => ({
      text: p.published ?? p.text,  // published for real posts, text for bootstrap
      topic: p.top_module_id
        ? moduleIdToLabel(p.top_module_id)
        : 'general',
    }));
  }

  // Truncate examples if total exceeds 4000 chars (prompt budget)
  // Prefer shorter examples over truncating any single example
  const MAX_EXPOSURE_CHARS = 4000;
  let totalChars = examples.reduce((sum, e) => sum + e.text.length, 0);
  while (totalChars > MAX_EXPOSURE_CHARS && examples.length > 1) {
    // Remove the longest example
    const longestIdx = examples.reduce(
      (maxIdx, e, i) => e.text.length > examples[maxIdx].text.length ? i : maxIdx, 0
    );
    examples.splice(longestIdx, 1);
    totalChars = examples.reduce((sum, e) => sum + e.text.length, 0);
  }
  // If a single remaining example is still too long, truncate it
  if (totalChars > MAX_EXPOSURE_CHARS && examples.length === 1) {
    examples[0].text = examples[0].text.substring(0, MAX_EXPOSURE_CHARS) + '\n[truncated]';
  }

  if (examples.length > 0) {
    const exampleText = examples
      .map((e, i) => `--- Example ${i + 1} (topic: ${e.topic}) ---\n${e.text}`)
      .join('\n\n');

    blocks.push(`<voice_exposure>
The following are real posts this author wrote and approved for publication.
Write something new in the same range of voice and register. Do not copy
phrases literally from these examples. The examples show the author's range
— sometimes they write one way, sometimes another. Vary naturally within
that range.

${exampleText}
</voice_exposure>`);
  }

  // ── Variety Constraint (Stages 1–3) ───────────────────────
  // Injected before voice_signals and voice_moves so it reads as a constraint,
  // not as optional guidance. Not injected in Stage 0 (cold) — no baseline to vary from.
  if (varietyConstraint) {
    blocks.push(varietyConstraint);
  }

  // ── Voice Signals (Stage 2 only) ──────────────────────────
  if (stage === 'warming') {
    const signals = buildVoiceSignals(voiceProfile, exposurePool);
    if (signals) {
      blocks.push(`<voice_signals>\n${signals}\n</voice_signals>`);
    }
  }

  // ── Voice Dice (Stage 3 only) ─────────────────────────────
  if (stage === 'established' && voiceProfile.voice_moves) {
    const { available, unavailable } = rollVoiceDice(
      voiceProfile.voice_moves, commitSha, draftIndexToday
    );
    const alwaysHashtags = voiceProfile.always_hashtags ?? [];

    const alwaysSection = alwaysHashtags.length > 0
      ? `Always present:\n${alwaysHashtags.map(h => `- ${h}`).join('\n')}\n\n`
      : '';

    const availableSection = available.length > 0
      ? `Available for this post (use if they fit naturally, never force):\n${available.map(m => `- ${m.description}`).join('\n')}\n\n`
      : '';

    const unavailableSection = unavailable.length > 0
      ? `NOT available for this post (find different phrasings):\n${unavailable.map(m => `- ${m.description}`).join('\n')}`
      : '';

    blocks.push(`<voice_moves>
This author has a specific voice. For THIS post, the dice roll has selected
which moves are available. The goal is not to hit every available move — use
2–4 naturally where they fit. The author's voice comes through in the rhythm
and register, not in having every tic present.

${alwaysSection}${availableSection}${unavailableSection}
</voice_moves>`);
  }

  return blocks.join('\n\n');
}
```

### `buildVoiceSignals` — Stage 2 proto-moves to descriptive text

This function produces the soft, descriptive `<voice_signals>` text for Stage 2 (warming). It reads the author's published posts and produces 4–6 human-readable observations.

```typescript
function buildVoiceSignals(
  voiceProfile: VoiceProfile,
  publishedPosts: VoicePost[],
): string | null {
  if (publishedPosts.length < 5) return null;

  const observations: string[] = [];

  // 1. Always-on hashtags
  if (voiceProfile.always_hashtags?.length) {
    observations.push(
      `They always include ${voiceProfile.always_hashtags.join(' and ')} at the end.`
    );
  }

  // 2. Dominant opening register
  const openingCounts = { first_person: 0, third_person: 0, question: 0, other: 0 };
  for (const post of publishedPosts) {
    const text = post.published ?? '';
    if (/^I\s+(shipped|deleted|added|wrote|built|pushed|created|fixed)/im.test(text)) {
      openingCounts.first_person++;
    } else if (/^(The|A|An|Claude|My|This|That)\s/im.test(text)) {
      openingCounts.third_person++;
    } else if (/^(What|Why|How|When|Where|Who|Did|Is|Are)\s/im.test(text)) {
      openingCounts.question++;
    } else {
      openingCounts.other++;
    }
  }
  const dominant = Object.entries(openingCounts)
    .sort(([, a], [, b]) => b - a)[0];
  const dominantPct = dominant[1] / publishedPosts.length;
  if (dominantPct > 0.4) {
    const labels: Record<string, string> = {
      first_person: 'in first person ("I shipped…", "I deleted…")',
      third_person: 'naming a subject ("The bug…", "A type guard…")',
      question: 'with a question',
      other: 'with varied approaches',
    };
    observations.push(
      `They open most posts ${labels[dominant[0]] ?? 'with varied approaches'}.`
    );
  }

  // 3. Typical post length
  const lengths = publishedPosts.map(p => (p.published ?? '').length);
  const mean = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  const stddev = Math.round(Math.sqrt(
    lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length
  ));
  observations.push(
    `This author typically writes posts of ${mean - stddev}–${mean + stddev} characters.`
  );

  // 4. Formatting presence (binary)
  const hasEmDash = publishedPosts.some(p => /—/.test(p.published ?? ''));
  const hasArrows = publishedPosts.some(p => /→/.test(p.published ?? ''));
  const hasSemicolon = publishedPosts.some(p => /;\s+[a-z]/.test(p.published ?? ''));
  const formatting: string[] = [];
  if (hasEmDash) formatting.push('em-dashes');
  if (hasArrows) formatting.push('arrow bullets');
  if (hasSemicolon) formatting.push('semicolons');
  if (formatting.length > 0) {
    observations.push(
      `They make use of ${formatting.join(', ')} in their writing.`
    );
  }

  // 5. Short-sentence rhythm presence
  const tripleRegex = /(?:^|\.\s+)([A-Z][^.]{3,30}\.)\s+([A-Z][^.]{3,30}\.)\s+([A-Z][^.]{3,30}\.)/m;
  const tripleCount = publishedPosts.filter(p => tripleRegex.test(p.published ?? '')).length;
  if (tripleCount / publishedPosts.length > 0.3) {
    observations.push('They make moderate use of short-sentence rhythms.');
  }

  return observations.join(' ');
}
```

**Language rules for signals text:**
- Use "typically", "most posts", "moderate use" — never "always" (except for hashtags above 80%)
- Use "They" not "You" — the signal is about the author, addressed to the model
- Never list specific phrases the author uses — that is what dice does in Stage 3
- If fewer than 3 observations are generated, return `null` (insufficient signal to be useful)

### Opening Type Memory

This mechanism ensures structural variety across posts, both within the same day and across weeks. It is independent of Voice Dice — it is active from Stage 1 onward and requires no statistical data.

**The problem it solves:** even with different topics, the AI defaults to the same structural opening (e.g., "I shipped X today" for every commit). After several posts, a reader notices they all feel like the same paragraph, just with different nouns. This is the structural parrot problem — distinct from the lexical parrot problem (same moves in every post) that Voice Dice handles.

**Two triggers for variety constraint:**

1. **Same-day trigger:** the author can publish up to 2 posts per day. If `draftIndexToday > 0`, the second post of the day must not open with the same structural type as the first.
2. **Recency trigger:** if the last 3 published posts all used the same opening type, the next generation must avoid it. Three-in-a-row is the threshold because two identical openings can be coincidence; three is a pattern.

#### `detectOpeningMove()`

Detects the structural opening type of a post from its first non-empty line. Defined in `src/voice/exposure.ts`.

Uses the same regexes as the corresponding entries in MOVES_REGISTRY — do not define parallel regexes.

```typescript
type OpeningMoveType =
  | 'opens_with_number'
  | 'opens_first_person_action'
  | 'opens_third_person_subject'
  | 'opens_with_question'
  | 'opens_mid_action'
  | 'opens_bold_thesis'
  | 'opens_confession'
  | 'unknown';

function detectOpeningMove(text: string): OpeningMoveType {
  const firstLine = (text ?? '').split('\n').find(l => l.trim().length > 0) ?? '';

  if (/^[\d,]+\s+(lines?|files?|commits?|decisions?|hours?|days?|minutes?)/im.test(firstLine))
    return 'opens_with_number';
  if (/^I\s+(shipped|deleted|added|wrote|built|pushed|created|fixed|removed|broke|deployed|refactored)/im.test(firstLine))
    return 'opens_first_person_action';
  if (/^(What|Why|How|When|Where|Who|Did|Is|Are|Do|Can|Should|Have)\s+/im.test(firstLine))
    return 'opens_with_question';
  if (/^(I\s+(admit|confess|was wrong|didn't know|had no idea)|Confession|Honest(ly)?)/im.test(firstLine))
    return 'opens_confession';
  if (/^(So|Then|And|But|Yesterday|Today|Last\s+\w+|This\s+(morning|afternoon|week))/im.test(firstLine))
    return 'opens_mid_action';
  if (/^(The|A|An|Claude|My|This|That|Every|One|Two|Three)\s+\w+/im.test(firstLine))
    return 'opens_third_person_subject';
  if (/^[A-Z][^.?!]{10,60}[.!]$/m.test(firstLine))
    return 'opens_bold_thesis';
  return 'unknown';
}
```

Order of checks matters: more specific patterns first (number, first-person action, question, confession, mid-action), then broad patterns (third-person, bold thesis), then fallback.

#### `buildVarietyConstraint()`

Produces the `<variety_constraint>` prompt block. Defined in `src/ai/prompt-builder.ts`.

```typescript
const OPENING_LABELS: Record<string, string> = {
  opens_with_number:          'opening with a numeric count ("313 lines added…")',
  opens_first_person_action:  'opening with "I [verb]" first-person action ("I shipped…", "I deleted…")',
  opens_third_person_subject: 'opening by naming a subject ("The bug…", "A type guard…")',
  opens_with_question:        'opening with a question',
  opens_mid_action:           'opening mid-action or with a time anchor ("Yesterday…", "Today…", "So…")',
  opens_bold_thesis:          'opening with a bold declarative statement',
  opens_confession:           'opening with a confession or admission ("I had no idea…")',
};

function buildVarietyConstraint(
  recentOpeningSequence: string[],   // voice.recent_opening_sequence — last 5 published, oldest-first
  draftIndexToday: number,
  todayFirstOpeningMove?: string,    // opening_move of the first draft generated today (if draftIndexToday > 0)
): string | null {
  const excluded = new Set<string>();

  // Trigger 1: same-day — second post must differ from first
  if (draftIndexToday > 0 && todayFirstOpeningMove && todayFirstOpeningMove !== 'unknown') {
    excluded.add(todayFirstOpeningMove);
  }

  // Trigger 2: recency — last 3 published all same type → exclude it
  const last3 = recentOpeningSequence.slice(-3);
  if (
    last3.length >= 3 &&
    last3.every(o => o === last3[0]) &&
    last3[0] !== 'unknown'
  ) {
    excluded.add(last3[0]);
  }

  if (excluded.size === 0) return null;

  const labels = [...excluded]
    .map(e => OPENING_LABELS[e] ?? e)
    .join(' and ');

  return `<variety_constraint>
For structural variety, avoid ${labels} in this post. Recent posts have used this opening pattern — choose a different structural approach for the first sentence. Any of the other opening types is fine.
</variety_constraint>`;
}
```

**What "excluded" means:** the model must use a different structural pattern for the *first sentence only*. The rest of the post is not constrained. The constraint is not about avoiding a topic — it is purely about the first-sentence structure.

**What counts as a "published" opening for the sequence:** `voice_posts.opening_move` on rows with `status = 'published'`. Rows without an `opening_move` value (older rows before this spec) are skipped.

#### Loop 1 update: compute `recent_opening_sequence`

Add to `refreshVoiceMoves` in all paths (Path 1, Path 2, Path 3) before the `updatedVoice` object construction:

```typescript
// Fetch last 5 published posts' opening types, oldest-first
const recentOpening = await db
  .from('voice_posts')
  .select('opening_move')
  .eq('tenant_id', tenantId)
  .eq('author_login', authorLogin)
  .eq('status', 'published')
  .not('opening_move', 'is', null)
  .not('opening_move', 'eq', 'unknown')
  .order('published_at', { ascending: false })
  .limit(5);

const recentOpeningSequence = (recentOpening.data ?? [])
  .map(r => r.opening_move)
  .reverse();  // oldest-first for buildVarietyConstraint logic
```

Then include `recent_opening_sequence: recentOpeningSequence` in the `updatedVoice` object for all three paths.

#### `process-job.ts` update: detect and persist `opening_move`

Add two steps around draft generation:

```typescript
// After generatePosts() returns draftId and linkedinPost:

// A. Detect the opening move of the generated draft
const openingMove = detectOpeningMove(linkedinPost);
await db.from('voice_posts')
  .update({ opening_move: openingMove })
  .eq('id', draftId);

// B. Before building voice blocks — fetch today's first draft opening type
// (needed for same-day variety constraint)
let todayFirstOpeningMove: string | undefined;
if (draftIndexToday.count && draftIndexToday.count > 0) {
  const todayFirst = await db
    .from('voice_posts')
    .select('opening_move')
    .eq('tenant_id', tenantId)
    .eq('author_login', authorLogin)
    .gte('created_at', todayAnchor + 'T00:00:00Z')
    .not('opening_move', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1);
  todayFirstOpeningMove = todayFirst.data?.[0]?.opening_move ?? undefined;
}

// Then pass to prompt builder:
const varietyConstraint = buildVarietyConstraint(
  voice.recent_opening_sequence ?? [],
  draftIndexToday.count ?? 0,
  todayFirstOpeningMove,
);
```

`varietyConstraint` is passed into `buildProgressiveVoiceBlocks` and injected as the `<variety_constraint>` block. In Stage 0 (cold), this block is NOT injected — the model has no examples to vary from.

**Timing note:** step B (fetching today's first opening) runs BEFORE generating the current draft. Step A (persisting the current draft's opening) runs AFTER. This order is correct — the constraint is about what already exists today, not the draft being generated right now.

### Chapter Context System

The freshness multiplier in `pipeline.ts` already penalizes repeated modules by dividing their score. But it does not prevent a high-scoring module from winning when it is the only strong finding — and it gives Claude no information about what was said in those previous posts.

Chapter Context solves the remaining problem: **when the same module fires again, Claude knows what angle was already taken and must not repeat it**. Instead of starting from scratch on the same topic, it builds forward — deeper, different consequence, different entry point.

A human writer who has covered type guards before does not explain what a type guard is again in the next post about type guards. They assume the reader has context and go to the next level. This mechanism gives Claude that same assumption.

**This is a USER PROMPT addition** — it lives alongside the findings, not in the system prompt with voice instructions. It is topic-aware, not voice-aware.

#### Skip vs Chapter decision

This logic runs in `process-job.ts` after `runPipeline()` returns findings and before calling `generatePosts()`:

```typescript
const topModuleId = pipelineFindings[0]?.moduleId;
const fireCounts = new Map<string, number>();
for (const id of recentModuleIds) {
  fireCounts.set(id, (fireCounts.get(id) ?? 0) + 1);
}
const topModuleFireCount = topModuleId ? (fireCounts.get(topModuleId) ?? 0) : 0;

// Skip: module is saturated AND we already published something today
// → prefer variety, this commit is not worth a post right now
if (topModuleFireCount >= 2 && (draftIndexToday.count ?? 0) > 0) {
  logger.info('worker.commit.skip.module_saturation', {
    sha: commit.sha,
    module: topModuleId,
    fireCount: topModuleFireCount,
    draftIndexToday: draftIndexToday.count,
    reason: 'module repeated and already published today — prefer variety',
  });
  continue;
}

// Chapter: module appeared before but this is the first post today (or first ever repeat)
// → generate but with chapter context so Claude knows what was said before
let chapterContext: string | undefined;
if (topModuleId && topModuleFireCount >= 1) {
  const previousFindings = await storage.getRecentTopFindings(
    commit.authorLogin ?? null,
    topModuleId,
    2,
  );
  if (previousFindings.length > 0) {
    chapterContext = buildChapterContext(topModuleId, previousFindings, topModuleFireCount + 1);
  }
}
```

**Decision table:**

| `fireCount` | `draftIndexToday` | Result |
|---|---|---|
| 0 | any | Normal generation, no chapter context |
| 1 | 0 | Chapter 2 context injected |
| 1 | > 0 | Chapter 2 context injected (still first time repeating) |
| ≥ 2 | 0 | Chapter N context injected (first post of the day — generate) |
| ≥ 2 | > 0 | **Skip** — already published today, module saturated |

The threshold of 2 is intentional: seeing the same module once is a repeat, seeing it 3+ times with an already-published post today means this commit is actively reducing variety and should wait.

#### `getRecentTopFindings()`

New method on `IVoiceStorage`. Returns the `top_finding` text of recent published posts for a specific module and author. Used to tell Claude what angles have already been covered.

```typescript
// In IVoiceStorage interface (src/voice/storage.ts):
getRecentTopFindings(
  authorLogin: string | null,
  moduleId: string,
  limit: number,
): Promise<Array<{ top_finding: string; published_at: string }>>;
```

Supabase implementation:

```typescript
async getRecentTopFindings(
  authorLogin: string | null,
  moduleId: string,
  limit: number,
): Promise<Array<{ top_finding: string; published_at: string }>> {
  let query = this.db
    .from('voice_posts')
    .select('top_finding, published_at')
    .eq('tenant_id', this.tenantId)
    .eq('top_module_id', moduleId)
    .eq('status', 'published')
    .not('top_finding', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (authorLogin) {
    query = query.eq('author_login', authorLogin);
  }

  const { data, error } = await query;
  if (error) throw new Error(`getRecentTopFindings failed: ${error.message}`);
  return (data ?? []) as Array<{ top_finding: string; published_at: string }>;
}
```

No new DB columns needed — `top_module_id`, `top_finding`, and `status` already exist.

#### `buildChapterContext()`

Defined in `src/ai/prompt-builder.ts`. Injected into the **user prompt**, after `</findings>` and before `</task>`.

```typescript
function buildChapterContext(
  moduleId: string,
  previousFindings: Array<{ top_finding: string }>,
  chapterNumber: number,
): string {
  const moduleName = moduleId.replace(/_/g, ' ');
  const previousList = previousFindings
    .map(f => `- "${f.top_finding}"`)
    .join('\n');

  return `<chapter_context>
This is post #${chapterNumber} this author has written about ${moduleName}.
Previous posts on this topic covered:
${previousList}

For this post: go deeper, shift the angle, or approach the same concept from a different consequence.
Do not repeat the same entry point, framing, or lesson as the previous posts.
The reader may have already seen what was covered before — assume they have context and build forward.
</chapter_context>`;
}
```

**What "chapter number" means:** it is `fireCount + 1`, where `fireCount` is the count of times this module appeared in `recentModuleIds` (last 30 days of `voice_posts`). It is an approximation — the exact chapter number in the author's full history requires a more expensive query. The 30-day window is sufficient for practical narrative continuity.

**Where it injects in the user prompt** (updated order inside `buildUserPrompt()`):

```
<examples>...</examples>           (voice exposure — existing)
<commit>...</commit>
<findings>...</findings>
<module_variety_hint>...</module_variety_hint>   (existing, still injected always)
<chapter_context>...</chapter_context>           (NEW — only when chapterContext present)
<industry_context>...</industry_context>         (Phase 2 — when match found)
<task>...</task>
```

`<module_variety_hint>` stays because it covers the general case (variety across all modules). `<chapter_context>` is more specific: it names the module, provides the previous findings, and instructs forward progression. When both are present, `<chapter_context>` takes precedence for the specific module — `<module_variety_hint>` still helps for secondary findings.

**What Claude must NOT do with chapter context:**
- Mention explicitly "in my last post I said…" — the post should be self-contained
- Reference the chapter number in the text — this is an internal navigation concept, not a series label
- Summarize or quote the previous post — only use it to know what NOT to repeat

### Helper functions used by the prompt builder

These are small utility functions referenced in `buildProgressiveVoiceBlocks`. Define them in `src/voice/exposure.ts`.

```typescript
// Convert a bootstrap post object into a shape compatible with VoicePost
// for use in the exposure pool during Stage 2
function syntheticVoicePost(bp: BootstrapPost): Partial<VoicePost> {
  return {
    published: bp.text,
    edit_ratio: 1.0,        // user wrote it entirely — 100% theirs
    top_module_id: null,     // no module association for bootstrap
  };
}

// Map a top_module_id to a human-readable label for the exposure topic annotation
// This is the same module ID used in the master spec's findings pipeline.
// Example: 'observability' → 'observability', 'react_patterns' → 'React patterns'
function moduleIdToLabel(moduleId: string): string {
  return moduleId.replace(/_/g, ' ');
}

// Count unique published posts for stage computation
// "Unique" = deduplicated by first 80 chars of published text (to exclude reposts)
async function countUniquePublished(
  tenantId: string,
  authorLogin: string,
  db: SupabaseClient,
): Promise<number> {
  const all = await db
    .from('voice_posts')
    .select('published')
    .eq('tenant_id', tenantId)
    .eq('author_login', authorLogin)
    .eq('status', 'published')
    .not('published', 'is', null);

  const seen = new Set<string>();
  let count = 0;
  for (const row of all.data ?? []) {
    const key = (row.published ?? '').substring(0, 80);
    if (!seen.has(key)) {
      seen.add(key);
      count++;
    }
  }
  return count;
}
```

### Prompt length budget

The `<voice_exposure>` block is the largest variable-size component in the prompt. Three full LinkedIn posts can reach 3000–5000 characters (~800–1300 tokens). The budget is capped at `MAX_EXPOSURE_CHARS = 4000` characters (~1000 tokens).

If the combined examples exceed this budget, the longest example is dropped (not truncated) until the budget is met. Only if a single example exceeds the budget is it truncated with `[truncated]` marker.

This budget is a constant in `src/voice/exposure.ts`, not configurable per user. If future models have larger context windows and lower per-token cost, this constant can be raised.

### Bootstrap post deletion

If a user deletes their bootstrap posts from `/settings/voice`:

1. Set `voice.bootstrap_posts = null` in the `voice_profiles.voice` JSONB (update the voice object, not a top-level column)
2. If the user has < 5 published posts, their stage drops from `bootstrap` → `cold` on the next generation. The prompt falls back to `STRUCTURE_MAP[tone]` + `TONE_INSTRUCTIONS[tone]` only.
3. If the user has ≥ 5 published posts, the stage stays at `warming` or `established` — bootstrap posts were already excluded from the pool anyway.
4. Already-generated drafts are not affected — they were generated with the examples available at generation time.

### `process-job.ts` integration

The following changes are required in `process-job.ts` to wire the new system:

```typescript
// In the draft generation flow, after commit enrichment and before prompt assembly:

// 0. Resolve voice profile — explicit unwrapping
// getVoiceProfile() returns StoredVoiceProfile | null (master spec §Individual Voice, Always > Storage contract)
// The caller owns the DEFAULT_VOICE_PROFILE fallback (master spec §Individual Voice, Always > Contract rules)
const stored = await voiceStorage.getVoiceProfile(tenantId, authorLogin);
const voice: VoiceProfile = stored?.voice ?? DEFAULT_VOICE_PROFILE;
const voiceVersion: number = stored?.version ?? 0;

// 1. Compute voice stage
// countUniquePublished counts ALL unique published posts regardless of edit_ratio
// because stage measures volume, not quality
const uniquePublished = await countUniquePublished(tenantId, authorLogin, db);
const hasBootstrap = (voice.bootstrap_posts?.length ?? 0) > 0;
const voiceStage = computeVoiceStage(uniquePublished, hasBootstrap);

// 2. Compute draftIndexToday
// On retry: use the existing draft's created_at, NOT NOW(), to preserve dice determinism
const todayAnchor = existingDraft?.created_at
  ? new Date(existingDraft.created_at).toISOString().split('T')[0]
  : new Date().toISOString().split('T')[0];
const draftIndexToday = await db
  .from('voice_posts')
  .select('id', { count: 'exact', head: true })
  .eq('tenant_id', tenantId)
  .eq('author_login', authorLogin)          // voice_posts uses author_login
  .gte('created_at', todayAnchor + 'T00:00:00Z');

// 3. Fetch exposure pool posts for the current platform (if stage >= bootstrap)
// voice_examples_pool is { linkedin?: string[], instagram?: string[] } — per-platform.
// We read only the pool for the platform we are generating for (e.g., 'linkedin').
let exposurePool: VoicePost[] = [];
const poolIds = voice.voice_examples_pool?.[platform as 'linkedin' | 'instagram'];
if (voiceStage !== 'cold' && poolIds?.length) {
  exposurePool = await db
    .from('voice_posts')
    .select('id, published, edit_ratio, top_module_id')
    .in('id', poolIds);
}

// 4a. Fetch today's first draft opening type (for same-day variety constraint)
// Only needed when draftIndexToday > 0 (i.e., a second post is being generated today)
let todayFirstOpeningMove: string | undefined;
if ((draftIndexToday.count ?? 0) > 0) {
  const todayFirst = await db
    .from('voice_posts')
    .select('opening_move')
    .eq('tenant_id', tenantId)
    .eq('author_login', authorLogin)
    .gte('created_at', todayAnchor + 'T00:00:00Z')
    .not('opening_move', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1);
  todayFirstOpeningMove = todayFirst.data?.[0]?.opening_move ?? undefined;
}

// 4b. Build variety constraint (active from Stage 1, no dice required)
const varietyConstraint = voiceStage !== 'cold'
  ? buildVarietyConstraint(
      voice.recent_opening_sequence ?? [],
      draftIndexToday.count ?? 0,
      todayFirstOpeningMove,
    )
  : undefined;

// 4c. Build voice blocks (new or legacy)
// buildVoiceBlocks receives the unwrapped VoiceProfile (inner object),
// NOT the StoredVoiceProfile wrapper. This matches the master spec pattern
// where the prompt builder reads style_patterns/voice_devices directly.
const voiceBlocks = buildVoiceBlocks(
  voice,
  exposurePool,
  voice.bootstrap_posts ?? [],
  commit.sha,
  draftIndexToday.count ?? 0,
  voiceStage,
  varietyConstraint ?? undefined,
);

// 5. Mark generation system and persist opening_move on the new draft row
// opening_move is detected from the generated linkedinPost text (the draft)
// generation_system: v2_progressive for all progressive stages (1–3)
const isProgressive = !!voice.voice_moves || voiceStage !== 'cold';
const openingMove = detectOpeningMove(linkedinPost);
await db.from('voice_posts').update({
  generation_system: isProgressive ? 'v2_progressive' : 'v1',
  opening_move: openingMove,
}).eq('id', draftId);
```

**What process-job.ts must NOT do:**
- Call `voice-extractor.ts` (Haiku) when the progressive system is active (any stage except `cold` with no bootstrap, or when `voice.voice_moves` is present)
- Compute `draftIndexToday` using `NOW()` on retry — must use draft's `created_at` to preserve dice determinism
- Fetch the full `voice_posts` table when only pool IDs are needed
- Set `generation_system = 'v1'` when the progressive path was actually used (Stages 1–3)
- Skip persisting `opening_move` — it is required for the variety constraint to work across posts

### Interaction with Loops 2, 3, 4 (from master spec)

Loops 2, 3, and 4 are NOT modified by this spec. They continue to operate as defined in the master spec. However, their outputs interact with the progressive voice system:

**Loop 2 (edit analysis):** continues to compute `edit_ratio`, `hook_changed`, `closing_changed`, `industry_context_removed`. These metrics feed Loop 4. No change.

**Loop 3 (discouraged hooks):** continues to write `<preferences>` overrides. These are injected BEFORE `<voice_moves>` in the prompt, so they take priority. Example: if Loop 3 learns "avoid rhetorical question hooks" but the dice rolls `rhetorical_question` as AVAILABLE, the `<preferences>` block wins and the model should not use it. This is correct — Loop 3 represents learned negative feedback from the user's editing behavior, which trumps statistical frequency.

**Loop 4 (industry context preference):** continues to adjust `industry_context_preference`. No interaction with voice system — industry context is orthogonal to voice.

**Loop 1 (voice refresh):** IS modified by this spec. See "Loop 1 — Statistical recalculation" section.

### What is removed from the prompt

When the new system is active, the following blocks are NOT injected:

- `<voice_patterns>` (old `style_patterns`)
- `<voice_devices>` (old `voice_devices`)
- `STRUCTURE_MAP[tone]` structure instructions (Stage 3 only — Stages 0–1 still use it)
- `TONE_INSTRUCTIONS[tone]` (Stage 3 only)

### `<never>` block modifications

The following rules are **removed** from `<never>` and become voice dice probabilities instead:

| Old `<never>` rule | New location |
|---|---|
| "No lead with counts or quantities" | `opens_with_number` with prob ~0.10–0.15 |

All platform-safety rules remain in `<never>`:

- No LinkedIn article headers (##, ###)
- No engagement-bait questions ("What do you think?", "Agree?")
- No code blocks (triple backtick)
- No "I'm an AI" self-reference

**Note on emojis:** the master spec (§Layer 2 — Default style preferences) treats emojis as a Layer 2 preference ("discouraged by default, but allowed if present in user voice"), not a Layer 1 hard rule. This spec does NOT promote emojis to `<never>`. Emoji handling stays in Layer 2 as defined in the master spec. If the author's exposure examples contain emojis, the model will see them and may reproduce them — this is correct behavior per Layer 3 (master spec §Layer 3 — User voice).

---

## UX considerations

### `/settings/voice` display

The settings page shows the user their voice stage and a human-readable summary of their detected moves.

**Stage display:**

```
Voice Stage: Warming (8 of 15 posts toward Established)
━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░ 53%
```

**Detected moves display (Stage 3 only):**

Group moves by frequency tier and show as a descriptive paragraph, not a raw probability table:

```
Your voice signature:
• You almost always use short-sentence rhythms and ironic intensifiers
• You frequently use self-deprecating language, rhetorical questions, and analogies
• You occasionally open with first-person action verbs or use arrow-bullet lists
• You rarely open with numeric counts
```

**Move probability adjustment (future, not V1):**

In a future version, the user can adjust probabilities manually via sliders in `/settings/voice`. For V1, probabilities are measured-only — the user cannot override them. This is intentional: the first priority is proving that measured probabilities produce good results. Manual overrides add complexity before validation.

### `voice_summary` handling

The master spec defines `voice.voice_summary` (≤200 chars, UI only, master spec §VoiceProfile JSONB contract) as a human-readable summary generated by the Haiku extractor (master spec §Voice Extractor). Since this spec eliminates Haiku extraction, `voice_summary` must be derived differently.

**Stages 0–1:** `voice_summary` is not computed. The UI shows the stage display only.

**Stages 2–3:** `voice_summary` is computed on-write during Loop 1 (`refreshVoiceMoves`), derived from the measured moves. It is NOT generated by AI — it is assembled from the move descriptions:

```typescript
function computeVoiceSummary(moves: Record<string, number>): string {
  const active = Object.entries(moves)
    .filter(([_, prob]) => prob > 0)
    .sort(([, a], [, b]) => b - a);

  if (active.length === 0) return '';

  const top3 = active.slice(0, 3).map(([id]) => {
    const move = MOVES_REGISTRY.find(m => m.id === id);
    return move?.description ?? id;
  });

  return top3.join('; ').substring(0, 200);
}
```

This value is stored in `voice.voice_summary` (same field as the master spec). The master spec's voice_summary continues to work for legacy authors. For progressive authors, it is overwritten by the computed version during Loop 1.

**Stage 2 proto-summary:** when `refreshVoiceMoves` runs for a warming author (or an established author with insufficient quality-filtered posts), it uses `computeProtoSummary` instead. This reuses the same coarse signals that `buildVoiceSignals` computes for the prompt, but formatted for the UI:

```typescript
function computeProtoSummary(
  posts: VoicePost[],
  alwaysHashtags: string[],
): string {
  const parts: string[] = [];

  // Typical length
  const lengths = posts.map(p => (p.published ?? '').length);
  const mean = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  parts.push(`~${mean} chars`);

  // Dominant opening register
  let fpCount = 0;
  for (const post of posts) {
    if (/^I\s+(shipped|deleted|added|wrote|built|pushed|created|fixed)/im.test(post.published ?? '')) {
      fpCount++;
    }
  }
  if (fpCount / posts.length > 0.4) {
    parts.push('opens in first person');
  }

  // Always hashtags
  if (alwaysHashtags.length > 0) {
    parts.push(`always ${alwaysHashtags.join(' ')}`);
  }

  return parts.join('. ').substring(0, 200);
}
```

Example output: `"~1200 chars. opens in first person. always #lilicurl #codingWithHumor"`

**The UI reads `voice.voice_summary` regardless of which system produced it.** No UI code change is needed for this field.

### Onboarding flow

The onboarding textarea for bootstrap posts should clearly communicate expectations:

```
Paste 1–5 posts you've written and are proud of.
These can be from LinkedIn, a blog, Twitter — anywhere.
The system will use them as voice references until you've
published enough posts for it to learn your voice directly.

Tip: pick posts that are DIFFERENT from each other.
A short punchy one, a longer technical one, and something
with humor — that gives the system your range, not your average.
```

The bootstrap posts are stored as-is. No extraction, no classification, no Haiku call. The only processing is trimming whitespace and capping at 5 entries.

---

## Observability

### Log keys

```typescript
// Stage computation
logger.info('voice.stage.computed', {
  author_login,
  stage,
  unique_published_count,
  has_bootstrap,
});

// Dice roll
logger.info('voice.dice.rolled', {
  author_login,
  commit_sha,
  draft_index_today,
  moves_available: available.length,
  moves_unavailable: unavailable.length,
  available_ids: available.map(m => m.id),
});

// Exposure selection
logger.info('voice.exposure.selected', {
  author_login,
  commit_sha,
  pool_size,
  examples_returned,
  modules_represented,
  includes_bootstrap: boolean,
});

// Loop 1 refresh
logger.info('voice.moves.refreshed', {
  author_login,
  stage,
  moves_count,
  always_hashtags,
  pool_size,
  posts_analyzed,
});

// Variety constraint applied
logger.info('voice.variety.constraint', {
  author_login,
  commit_sha,
  draft_index_today,
  excluded_opening_types: [...excluded],   // from buildVarietyConstraint
  trigger: draftIndexToday > 0 ? 'same_day' : 'recency', // which trigger fired
});

// Papagayo detection (monthly health check)
logger.info('voice.papagayo.check', {
  author_login,
  overrepresented_moves: [], // moves where draft_freq > 1.5 * published_freq
  underrepresented_moves: [], // moves where draft_freq < 0.5 * published_freq
  invented_moves: [],          // moves appearing in drafts but never in published
});
```

### Monthly health check

Add to `health-reporter.ts`: for each author with ≥10 published posts under the new system (`generation_system = 'v2_progressive'`), compare move frequency in recent drafts vs published posts. If any move shows >1.5× overrepresentation, log a warning. This is the papagayo detector — it tells you if the dice is miscalibrated.

---

## Rollout plan

### Prerequisites

```
[ ] Phase 3 of master spec deployed on trunk
[ ] At least one author has ≥5 published posts (to reach Stage 2)
[ ] voice_posts.generation_system column added via migration
[ ] voice_profiles.voice JSONB contract extended (no new columns, no migration needed)
[ ] MOVES_REGISTRY coded in src/voice/moves-registry.ts
[ ] Registry validation procedure completed (20 writers, 4 criteria pass, report committed)
[ ] analyze-voice.ts script functional and tested against production user's CSV
[ ] Utility functions (hash, seededRandom, createRng, weightedShuffle) implemented in src/voice/utils.ts
```

### Phase 3.5.1 — Voice exposure + rotation (Stages 0–2 only)

Ship the exposure mechanism and commit-seeded rotation. This is the lowest-risk change: it adds examples to the prompt and randomizes their selection. The old voice extraction still runs in parallel.

**Ship gate:** no quality regression in `edit_ratio` over 2 weeks.

### Phase 3.5.2 — Voice dice (Stage 3)

Ship the full dice mechanism for authors who reach Stage 3 (15+ published posts). The old voice extraction is bypassed when `voice.voice_moves` is present in the profile.

**Ship gate:** Phase 3.5.1 has been live for ≥2 weeks with no regression. The first 10 dice-generated posts per author must be reviewed by the author before letting the mechanism run unattended.

### Phase 3.5.3 — Loop 1 statistical recalculation

Replace Haiku extraction in Loop 1 with the statistical recalculation. This is the point of no return for the old extraction system.

**Ship gate:** Phase 3.5.2 has been live for ≥2 weeks with no regression. `edit_ratio` of dice-generated posts is comparable to or better than Haiku-extracted posts.

If at any phase `edit_ratio` drops more than 0.05 average over the previous 2 weeks, **roll back** that phase and diagnose. Do not stack phases on top of a regression.

---

## Files affected

| File | Change |
|------|--------|
| `src/voice/moves-registry.ts` | **New file.** Complete MOVES_REGISTRY with 42+ entries (may grow after validation). |
| `src/voice/utils.ts` | **New file.** `hash()`, `seededRandom()`, `createRng()`, `weightedShuffle()`. All algorithms specified in this spec — do not substitute alternatives. |
| `src/voice/dice.ts` | **New file.** `rollVoiceDice()`, `calibrateMoveProbability()`. |
| `src/voice/exposure.ts` | **New file.** `selectExposureExamples()`, `refreshExposurePool()`, `exposureWeight()`, `detectOpeningMove()`, `syntheticVoicePost()`, `moduleIdToLabel()`, `countUniquePublished()`. |
| `src/voice/moves-calculator.ts` | **New file.** `refreshVoiceMoves()` — replaces `voice-extractor.ts` for the new system. |
| `src/voice/stage.ts` | **New file.** `computeVoiceStage()`. |
| `scripts/analyze-voice.ts` | **New file.** Diagnostic script: runs MOVES_REGISTRY against a user's posts, outputs move frequencies and papagayo signals. Read-only, does not write to DB. Runnable with `--file` for CSV input or `--tenant`/`--author` for DB input. |
| `scripts/validate-registry.ts` | **New file.** Validation script: runs MOVES_REGISTRY against 20 reference writers' posts, outputs validation report. One-time use before deployment. |
| `scripts/registry-validation/` | **New directory.** Contains `reference-posts.json` (fetched posts) and `validation-report.md` (output). Committed to git for reproducibility. |
| `src/voice/storage.ts` | Extend `IVoiceStorage` with `getPublishedForExposure()`, `getPublishedForMoves()`. See signatures below. |
| `src/voice/supabase-storage.ts` | Implement new `IVoiceStorage` methods. `getPublishedForExposure()` is a thin wrapper around the per-platform query shown in `refreshExposurePool`; `getPublishedForMoves()` is a thin wrapper around the cross-platform query shown in `refreshVoiceMoves`. |
| `src/ai/prompt-builder.ts` | Add `buildProgressiveVoiceBlocks()`, `buildVarietyConstraint()`, `OPENING_LABELS`. Modify `buildVoiceBlocks()` to accept and pass through `varietyConstraint`. |
| `src/worker/process-job.ts` | Set `generation_system = 'v2_progressive'` and `opening_move` on new drafts. Fetch today's first draft opening for same-day constraint. Build `varietyConstraint` and pass to prompt builder. |
| `src/worker/main-scan-tenants.ts` | Call `refreshVoiceMoves()` instead of `refreshVoiceExtraction()` when `voice.voice_moves` is present in the author's profile. |
| `database/schema.sql` | Add `generation_system TEXT DEFAULT 'v1'` and `opening_move TEXT DEFAULT NULL` to `voice_posts`. No changes to `voice_profiles` schema (new fields live inside existing `voice JSONB`). |

No files are deleted. `voice-extractor.ts` continues to exist for the legacy path.

---

## Definition of Done

```
[ ] Utility functions implemented in src/voice/utils.ts (hash=FNV-1a, seededRandom=Mulberry32, createRng, weightedShuffle=exponential sort)
[ ] MOVES_REGISTRY implemented in src/voice/moves-registry.ts with 42+ entries
[ ] Registry validation completed: 20 writers, 4 criteria pass, validation-report.md committed
[ ] All regex patterns have unit tests (positive + negative examples)
[ ] analyze-voice.ts script implemented and tested against production CSV
[ ] rollVoiceDice() implemented and unit-tested
[ ] selectExposureExamples() implemented with commit-seeded rotation
[ ] refreshVoiceMoves() implemented (statistical recalculation, no AI calls)
[ ] computeVoiceStage() implemented with 4-stage logic
[ ] prompt-builder branches on voice_moves presence
[ ] <voice_exposure> block injected with 2–3 examples
[ ] <voice_moves> block injected with dice roll results
[ ] voice_profiles.voice JSONB extended with voice_moves, voice_stage, voice_examples_pool, always_hashtags, bootstrap_posts (no new top-level columns)
[ ] voice_posts.generation_system column added
[ ] voice_posts.opening_move column added
[ ] detectOpeningMove() implemented with 7 types + unknown fallback
[ ] buildVarietyConstraint() implemented with same-day and recency triggers
[ ] Loop 1 computes recent_opening_sequence from last 5 published opening_move values
[ ] process-job.ts persists opening_move after each draft generation
[ ] <variety_constraint> block injected in Stage 1+ when triggered
[ ] Old columns (style_patterns, voice_devices) NOT deleted
[ ] Onboarding stores bootstrap_posts without Haiku extraction
[ ] /settings/voice shows voice stage and detected moves summary
[ ] All log keys emitted
[ ] Monthly papagayo health check added to health-reporter.ts
[ ] Phase 3.5.1 shipped, monitored, no regression
[ ] Phase 3.5.2 shipped, first 10 posts per author reviewed
[ ] Phase 3.5.3 shipped, Loop 1 recalculation confirmed working
[ ] Master spec updated to reference voice-system-spec.md
[ ] anti-parrot-spec.md marked as replaced
```

---

## What this spec deliberately does not do

**No AI-powered move discovery.** The MOVES_REGISTRY is curated by humans, not discovered by AI. An LLM could theoretically scan posts and discover new patterns, but (a) the regex-based approach is deterministic and debuggable, (b) AI-discovered patterns are hard to name and describe in prompts, and (c) the registry can be expanded manually as new patterns emerge from user data.

**No "voice aspiration" feature.** The registry detects what the author already does, it does not suggest what they could do. A future feature could let users browse moves from other writers and opt into trying them, but that is a separate product decision with different implications.

**No cross-author move analysis.** Each author's moves are measured in isolation. If two developers in the same org both use "frankly" at 40%, that's coincidence, not data to share.

**No per-platform probability tuning.** The dice uses the same probabilities for LinkedIn and Instagram. Platform differences are handled by `ContentStrategy`, not by voice moves. If LinkedIn posts are longer and Instagram posts shorter, the move frequency will naturally differ because shorter posts have less surface area for moves to appear in.

**No phrase-level anti-repetition memory.** The original anti-parrot spec tracked specific phrases to avoid ("never use X again"). This spec does not do that. Voice dice handles lexical variation (probabilistic move selection), and Opening Type Memory handles structural variation (opening type exclusion). Neither mechanism tracks specific sentences or phrases — the combination of dice + exposure rotation + opening constraint produces natural variation without a phrase blacklist.

**Structural repetition IS tracked, phrase repetition is not.** Opening Type Memory enforces variety at the structural level (first-sentence pattern) but does not prevent the model from using a specific word or phrase it used in a previous post. If the user edits out a specific phrase repeatedly, Loop 3 (discouraged hooks) will learn that preference — it is the right mechanism for phrase-level feedback.

**No semantic deduplication of voice_history examples.** If two posts in the exposure pool are semantically similar but textually different, both can appear as examples. The commit-seeded selection makes this unlikely for any single generation, and the module diversity constraint further reduces it.