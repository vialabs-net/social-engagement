/**
 * replay-synthesis.ts — dry-run of the CEP synthesis path (Camino 2) for a given author/repo/topic.
 *
 * Fetches unconsumed signals from Supabase, loads the voice profile, calls generateBufferText()
 * exactly as runAccumulationCheck() would, but does NOT consume signals or save drafts.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/replay-synthesis.ts <author-login> <owner/repo> [topic]
 *
 * Example:
 *   npx tsx --env-file=.env.local scripts/replay-synthesis.ts korutx microboxlabs/ecm-coordinator complexity
 */

import { createClient } from '@supabase/supabase-js';
import { SupabaseStorage } from '../src/voice/supabase-storage.js';
import { AnthropicAdapter } from '../src/ai/anthropic-adapter.js';
import { generateBufferText } from '../src/ai/synthesis-generator.js';
import { check, checkCrossVolume } from '../src/analysis/accumulation-engine.js';
import { selectDevelopmentalAngle, buildAngleBlock, type ArcType } from '../src/ai/developmental-editor.js';
import { matchFindingsToArticles } from '../src/content/matcher.js';
import { buildIndustryContextBlock } from '../src/ai/prompt-builder.js';
import { createEmbedder, createAIClient } from '../src/ai/factory.js';
import { DEFAULT_VOICE_PROFILE } from '../src/config/schema.js';
import type { SignalBankEntry, SignalEvent } from '../src/voice/storage.js';

const SEP = '─'.repeat(72);

async function main(): Promise<void> {
  const [authorLogin, fullRepo, topicFilter] = process.argv.slice(2) as [string, string, string | undefined];

  if (!authorLogin || !fullRepo || !fullRepo.includes('/')) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/replay-synthesis.ts <author-login> <owner/repo> [topic]');
    process.exit(1);
  }

  const anthropicKey = process.env['ANTHROPIC_API_KEY'] ?? '';
  const supabaseUrl = process.env['SUPABASE_URL'] ?? '';
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  const tenantId = process.env['TENANT_ID'] ?? 'default';

  if (!anthropicKey) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }
  if (!supabaseUrl || !supabaseKey) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set'); process.exit(1); }

  const openaiKey = process.env['OPENAI_API_KEY'] ?? '';
  const db = createClient(supabaseUrl, supabaseKey);
  const storage = new SupabaseStorage(supabaseUrl, supabaseKey, tenantId);
  const ai = new AnthropicAdapter(anthropicKey);
  const matcherAi = createAIClient('anthropic', anthropicKey, 'claude-haiku-4-5-20251001', 400);
  const embedder = openaiKey ? createEmbedder('openai', openaiKey, 'text-embedding-3-small') : null;
  const nowIso = new Date().toISOString();

  // ── Stage 1: Signal bank ────────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log(`STAGE 1 — signal bank for ${authorLogin} / ${fullRepo}`);
  console.log(SEP);

  const entries = await storage.getSignalBankEntries(authorLogin, fullRepo);
  if (entries.length === 0) {
    console.log('No signal_bank entries — nothing to synthesize.');
    process.exit(0);
  }

  for (const e of entries) {
    const { shouldFire, reason, decayedWeight, thresholdEffective } = check(e, nowIso);
    const mark = shouldFire ? '✓ FIRE' : '  skip';
    console.log(`  ${mark}  topic=${e.topic.padEnd(22)} weight=${e.weight_sum.toFixed(1).padStart(6)} cnt=${e.signal_count.toString().padStart(3)} decayed=${decayedWeight.toFixed(2).padStart(6)} thresh=${thresholdEffective.toFixed(2).padStart(6)} reason=${reason ?? '-'}`);
  }

  const crossVolume = checkCrossVolume(entries, nowIso);
  if (crossVolume) console.log('\n  → cross-volume threshold crossed (sum decayed > 25)');

  const firedEntries = entries.filter((e: SignalBankEntry) => check(e, nowIso).shouldFire);
  if (firedEntries.length === 0 && !crossVolume) {
    console.log('\nNo topics at threshold. Nothing to synthesize right now.');
    process.exit(0);
  }

  const firedTopics = firedEntries.length > 0
    ? firedEntries.map((e: SignalBankEntry) => e.topic)
    : entries.map((e: SignalBankEntry) => e.topic);

  const topics = topicFilter ? firedTopics.filter((t) => t === topicFilter) : firedTopics;
  if (topics.length === 0) {
    console.log(`\nTopic '${topicFilter}' is not at threshold. Available fired topics: ${firedTopics.join(', ')}`);
    process.exit(0);
  }

  // ── Stage 2: Unconsumed signals ─────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log(`STAGE 2 — unconsumed signals for topic(s): ${topics.join(', ')}`);
  console.log(SEP);

  const allSignals = [];
  for (const topic of topics) {
    const sigs = await storage.getUnconsumedSignals(authorLogin, fullRepo, topic);
    console.log(`  topic=${topic}: ${sigs.length} unconsumed signals`);
    for (const s of sigs) {
      console.log(`    sha=${s.commit_sha.slice(0, 10)}  strength=${s.strength}  ${s.specific_change.slice(0, 80)}`);
    }
    allSignals.push(...sigs);
  }

  if (allSignals.length === 0) {
    console.log('\nAll signals already consumed — nothing to synthesize.');
    process.exit(0);
  }

  // ── Stage 3: Voice profile ───────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log(`STAGE 3 — voice profile for ${authorLogin}`);
  console.log(SEP);

  let voiceProfile = DEFAULT_VOICE_PROFILE;
  try {
    const stored = await storage.getVoiceProfile(authorLogin);
    if (stored) {
      voiceProfile = stored.voice;
      console.log(`  Found: tone=${voiceProfile.tone} rhythm=${voiceProfile.rhythm ?? 'default'} source=${stored.source}`);
    } else {
      console.log(`  No profile found — using DEFAULT_VOICE_PROFILE`);
    }
  } catch (e) {
    console.warn(`  Voice fetch failed (${String(e)}) — using DEFAULT`);
  }

  // ── Stage 4: R3 — narrative arc (fail-open) ─────────────────────────────
  console.log(`\n${SEP}`);
  console.log(`STAGE 4 — R3 narrative arc`);
  console.log(SEP);

  let developmentalAngle: string | undefined;
  try {
    const recentArcs = (await storage.getRecentArcTypes(authorLogin, 5)) as ArcType[];
    const synFindings = allSignals.map((s: SignalEvent) => ({
      moduleId: s.topic,
      aspect: s.topic.replace(/_/g, ' '),
      finding: s.specific_change,
      technicalDetail: s.specific_change,
      plainLanguage: s.specific_change,
      interestScore: s.strength * 2,
      contextHint: s.affected_files[0] ? `${s.affected_files[0]} in ${s.repo}` : undefined,
    }));
    const angle = selectDevelopmentalAngle({
      findings: synFindings,
      commitIntent: 'planned_feature',
      closingIssues: [],
      changesRequestedCount: 0,
      collaborationWeight: 0,
      recentArcTypes: recentArcs,
      discouragedArcTypes: (voiceProfile.content_preferences?.penalized_arc_types ?? []) as ArcType[],
    });
    if (angle) {
      developmentalAngle = buildAngleBlock(angle, 0);
      console.log(`  arc_type: ${angle.arcType}`);
      console.log(`  tension:  ${angle.tension}`);
    } else {
      console.log('  No arc selected (not enough evidence)');
    }
  } catch (e) {
    console.warn(`  R3 failed (${String(e)}) — skipping`);
  }

  // ── Stage 5: Industry context (fail-open) ───────────────────────────────
  console.log(`\n${SEP}`);
  console.log(`STAGE 5 — industry context`);
  console.log(SEP);

  let industryContext: string | undefined;
  let featuredSignal: string | undefined;
  if (embedder) {
    try {
      const synFindingsForMatch = allSignals.map((s: SignalEvent) => ({
        moduleId: s.topic,
        aspect: s.topic.replace(/_/g, ' '),
        finding: s.specific_change,
        technicalDetail: s.specific_change,
        plainLanguage: s.specific_change,
        interestScore: s.strength * 2,
        contextHint: s.affected_files[0] ? `${s.affected_files[0]} in ${s.repo}` : undefined,
      }));
      const match = await matchFindingsToArticles(synFindingsForMatch, embedder, matcherAi, db);
      if (match) {
        industryContext = buildIndustryContextBlock({ connection: match.connection, articleUrl: match.articleUrl });
        featuredSignal = match.matchedFinding;
        console.log(`  matched: ${match.articleTitle}`);
        console.log(`  featured signal: ${match.matchedFinding}`);
        console.log(`  connection: ${match.connection}`);
      } else {
        console.log('  No article match found');
      }
    } catch (e) {
      console.warn(`  Industry context failed (${String(e)}) — skipping`);
    }
  } else {
    console.log('  Skipped — OPENAI_API_KEY not set');
  }

  // ── Stage 6: Build synthesis input ──────────────────────────────────────
  const gatillador = 'focal' as const;
  const minConfig = {
    author: { name: authorLogin, github_login: authorLogin },
    platforms: { linkedin: { enabled: true }, instagram: { enabled: false } },
    pipeline: { max_daily_posts_per_author: 2 },
    voice: voiceProfile,
    github: { notification_repo: undefined },
  } as never;

  const input = {
    authorLogin,
    repo: fullRepo,
    gatillador,
    topics,
    signals: allSignals,
    voiceProfile,
    voiceStage: 'warming' as const,
    config: minConfig,
    exposurePool: [],
    bootstrapPosts: voiceProfile.bootstrap_posts ?? [],
    draftIndexToday: 0,
    developmentalAngle,
    industryContext,
    featuredSignal,
  };

  // ── Stage 7: Claude synthesis ────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log(`STAGE 7 — Claude synthesis (dry-run, signals NOT consumed)`);
  console.log(SEP);
  console.log(`  gatillador: ${gatillador}  topics: ${topics.join(', ')}  signals: ${allSignals.length}`);

  const result = await generateBufferText(ai, input);

  // ── Stage 8: Result ──────────────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('STAGE 8 — generated synthesis post');
  console.log(SEP);
  console.log('\n── POST ───────────────────────────────────────────────────────────────\n');
  console.log(result.bufferText);
  console.log('\n── STATS ──────────────────────────────────────────────────────────────');
  console.log(`chars:         ${result.bufferText.length}`);
  console.log(`opening_move:  ${result.openingMove}`);
  console.log(`repr sha:      ${result.representativeSha}`);
  console.log(`topics:        ${topics.join(', ')}`);
  console.log(`signals used:  ${allSignals.length}`);
  console.log('\n⚠  DRY RUN — signals NOT consumed, draft NOT saved to DB');
  console.log('');
}

main().catch((err) => {
  console.error('Fatal:', String(err));
  process.exit(1);
});
