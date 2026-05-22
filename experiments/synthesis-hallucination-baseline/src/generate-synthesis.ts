import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { openDb } from './lib/db.js';
import { callHaiku, callSonnet } from './lib/anthropic-client.js';
import { splitClaims } from './lib/split-claims.js';
import { HAIKU_SIGNAL_EXTRACT_SYSTEM, buildHaikuSignalExtractUser } from './prompts/haiku-signal-extract.js';
import { buildSonnetFocalUser, buildSonnetArcUser, buildSonnetSingleUser, type SignalForPrompt } from './prompts/sonnet-synthesize.js';
import type { SynthesisGroup, HaikuSignalOutput, VoiceProfileCacheEntry } from './lib/types.js';
import { buildSystemPrompt } from '../../../src/ai/prompt-builder.js';
import { VoiceProfileSchema, ConfigSchema } from '../../../src/config/schema.js';
import { extractFirstHunkSnippet } from '../../../src/analysis/diff-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VOICE_PROFILES_CACHE = join(__dirname, '../db/voice-profiles-cache.json');

const DRY_RUN = process.argv.includes('--dry-run');

function loadProfileCache(): VoiceProfileCacheEntry[] {
  try {
    return JSON.parse(readFileSync(VOICE_PROFILES_CACHE, 'utf8')) as VoiceProfileCacheEntry[];
  } catch {
    throw new Error('voice-profiles-cache.json not found — run npm run select first');
  }
}

function getProfile(cache: VoiceProfileCacheEntry[], authorLogin: string) {
  const entry = cache.find((p) => p.github_author_login === authorLogin);
  if (!entry) return null;
  const parsed = VoiceProfileSchema.safeParse(entry.voice);
  return parsed.success ? parsed.data : null;
}

function buildMinimalSystemPrompt(authorLogin: string, voiceProfileRaw: Record<string, unknown>): string {
  const voiceProfile = VoiceProfileSchema.parse(voiceProfileRaw);
  const config = ConfigSchema.parse({
    author: { github_username: authorLogin, name: authorLogin },
    buffer: { organization_id: 'experiment' },
    platforms: { linkedin: { enabled: true }, instagram: { enabled: false } },
    github: {},
    scheduling: {},
    posting: {},
    ai: {},
  });
  return buildSystemPrompt(config, voiceProfile, {
    stage: 'established',
    exposurePool: [],
    bootstrapPosts: [],
    commitSha: 'experiment',
    draftIndexToday: 0,
  });
}

function isDeclined(output: string): boolean {
  return /^\s*<no_post\s*\/>\s*$/.test(output) || output.trim() === '<no_post/>';
}

function extractEvidenceSnippet(patch: string): string {
  return extractFirstHunkSnippet(patch, 6);
}

async function processGroup(
  db: ReturnType<typeof openDb>,
  group: SynthesisGroup,
  profileCache: VoiceProfileCacheEntry[],
): Promise<void> {
  // Skip if already processed
  const existing = db.prepare('SELECT group_id FROM synthesis_posts WHERE group_id = ?').get(group.id);
  if (existing) return;

  const profile = getProfile(profileCache, group.author_login);
  if (!profile) {
    console.warn(`  [skip] No voice profile for ${group.author_login}`);
    return;
  }

  if (group.variant === 'SINGLE') {
    await processSingle(db, group, profileCache);
    return;
  }

  // ── Paso A: signal extraction per commit ──────────────────────────────
  const signals: SignalForPrompt[] = [];
  let totalCost = 0;

  for (let i = 0; i < group.commit_shas.length; i++) {
    const sha = group.commit_shas[i]!;
    const message = group.commit_messages[i] ?? '';
    const diff = group.commit_diffs[i] ?? '';

    const alreadySignal = db.prepare('SELECT id FROM weak_signals WHERE group_id = ? AND commit_sha = ?').get(group.id, sha);
    if (alreadySignal) {
      const row = db.prepare('SELECT * FROM weak_signals WHERE group_id = ? AND commit_sha = ?').get(group.id, sha) as {
        topic: string; strength: number; pattern_kind: string | null;
        affected_symbols: string; specific_change: string; evidence_snippet: string;
        haiku_raw: string;
      };
      signals.push({
        date: '',
        sha,
        message,
        repo: group.repo,
        topic: row.topic ?? group.topic,
        strength: row.strength ?? 5,
        pattern_kind: row.pattern_kind,
        description: row.specific_change ?? '',
        evidence: row.evidence_snippet ?? '',
      });
      continue;
    }

    if (DRY_RUN) {
      console.log(`    [dry-run] Haiku signal extract for ${sha.slice(0, 7)}`);
      continue;
    }

    const userPrompt = buildHaikuSignalExtractUser(message, diff);
    const { text, cost_usd } = await callHaiku(HAIKU_SIGNAL_EXTRACT_SYSTEM, userPrompt);
    totalCost += cost_usd;

    let parsed: HaikuSignalOutput & { trivial?: boolean } | null = null;
    try {
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const raw = JSON.parse(cleaned) as unknown;
      // Haiku sometimes returns an array of signals — take the first element
      parsed = (Array.isArray(raw) ? raw[0] : raw) as HaikuSignalOutput & { trivial?: boolean } | null;
    } catch {
      parsed = null;
    }

    const evidenceSnippet = extractEvidenceSnippet(diff);

    db.prepare(`
      INSERT OR IGNORE INTO weak_signals
        (group_id, commit_sha, haiku_raw, topic, strength, pattern_kind, affected_symbols, specific_change, evidence_snippet)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      group.id,
      sha,
      text,
      parsed?.trivial ? null : (parsed?.topic ?? null),
      parsed?.trivial ? null : (parsed?.strength ?? null),
      parsed?.trivial ? null : (parsed?.pattern_kind ?? null),
      JSON.stringify(parsed?.trivial ? [] : (parsed?.affected_symbols ?? [])),
      parsed?.trivial ? null : (parsed?.specific_change ?? null),
      evidenceSnippet || null,
    );

    if (parsed && !parsed.trivial) {
      signals.push({
        date: '',
        sha,
        message,
        repo: group.repo,
        topic: parsed.topic ?? group.topic,
        strength: parsed.strength ?? 5,
        pattern_kind: parsed.pattern_kind ?? null,
        description: parsed.specific_change ?? '',
        evidence: evidenceSnippet,
      });
    }
  }

  if (DRY_RUN) {
    console.log(`  [dry-run] Would call Sonnet for group ${group.id.slice(0, 8)} (${group.variant})`);
    return;
  }

  if (signals.length === 0) {
    console.warn(`  [skip] No non-trivial signals for group ${group.id.slice(0, 8)}`);
    return;
  }

  // ── Paso B: synthesis (Sonnet) ─────────────────────────────────────────
  const systemPrompt = buildMinimalSystemPrompt(group.author_login, profileCache.find((p) => p.github_author_login === group.author_login)!.voice);

  const dates = group.commit_shas.map((_, i) => {
    const created = group.commit_messages[i] ?? '';
    return created;
  });
  const spanMs = signals.length > 1
    ? 0
    : 0;

  // Compute span_days from DB commit dates (approximate using group record)
  const spanDays = 7; // approximate; real span would need stored dates

  let userPrompt: string;
  if (group.variant === 'FOCAL') {
    userPrompt = buildSonnetFocalUser(signals, group.topic, spanDays);
  } else {
    const topics = group.topic.split(',');
    const allFiles = signals.flatMap((s) => {
      // Extract file paths from evidence snippets as rough proxy
      const lines = s.evidence.split('\n').filter((l) => l.startsWith('---') || l.startsWith('+++'));
      return lines.map((l) => l.replace(/^[-+]{3} /, '').replace(/\t.*$/, '').trim());
    }).filter(Boolean);
    const sharedFiles = [...new Set(allFiles)].slice(0, 5);
    userPrompt = buildSonnetArcUser(signals, topics, sharedFiles, spanDays);
  }

  const { text: sonnetOutput, cost_usd: sonnetCost } = await callSonnet(systemPrompt, userPrompt);
  totalCost += sonnetCost;

  const declined = isDeclined(sonnetOutput) ? 1 : 0;
  const claims = declined ? [] : splitClaims(sonnetOutput);

  db.prepare(`
    INSERT OR REPLACE INTO synthesis_posts
      (group_id, sonnet_input, sonnet_output, declined, claim_count, cost_usd)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(group.id, `${systemPrompt}\n\n---\n\n${userPrompt}`, sonnetOutput, declined, claims.length, totalCost);

  const status = declined ? 'DECLINED' : `${claims.length} claims`;
  console.log(`  [done] group ${group.id.slice(0, 8)} ${group.variant}/${group.origin} → ${status}`);
}

async function processSingle(
  db: ReturnType<typeof openDb>,
  group: SynthesisGroup,
  profileCache: VoiceProfileCacheEntry[],
): Promise<void> {
  const sha = group.commit_shas[0]!;
  const message = group.commit_messages[0] ?? '';
  const diff = group.commit_diffs[0] ?? '';

  const profileEntry = profileCache.find((p) => p.github_author_login === group.author_login);
  if (!profileEntry) return;

  if (DRY_RUN) {
    console.log(`  [dry-run] SINGLE Sonnet for ${sha.slice(0, 7)}`);
    return;
  }

  const systemPrompt = buildMinimalSystemPrompt(group.author_login, profileEntry.voice);
  const userPrompt = buildSonnetSingleUser(message, group.repo, group.topic, message, diff);

  const { text: sonnetOutput, cost_usd } = await callSonnet(systemPrompt, userPrompt);
  const claims = splitClaims(sonnetOutput);

  db.prepare(`
    INSERT OR REPLACE INTO synthesis_posts
      (group_id, sonnet_input, sonnet_output, declined, claim_count, cost_usd)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(group.id, `${systemPrompt}\n\n---\n\n${userPrompt}`, sonnetOutput, 0, claims.length, cost_usd);

  console.log(`  [done] SINGLE ${sha.slice(0, 7)} → ${claims.length} claims`);
}

async function main(): Promise<void> {
  const db = openDb();
  const profileCache = loadProfileCache();

  const groups = db.prepare('SELECT * FROM synthesis_groups').all() as Array<{
    id: string; author_login: string; tenant_id: string | null;
    repo: string; topic: string; variant: string; origin: string;
    coherence_score: number | null; commit_shas: string; commit_messages: string; commit_diffs: string;
  }>;

  if (groups.length === 0) {
    console.log('[generate-synthesis] No groups found. Run npm run select first.');
    return;
  }

  console.log(`[generate-synthesis] Processing ${groups.length} groups...`);

  for (const raw of groups) {
    const group: SynthesisGroup = {
      ...raw,
      variant: raw.variant as SynthesisGroup['variant'],
      origin: raw.origin as SynthesisGroup['origin'],
      commit_shas: JSON.parse(raw.commit_shas) as string[],
      commit_messages: JSON.parse(raw.commit_messages) as string[],
      commit_diffs: JSON.parse(raw.commit_diffs) as string[],
    };

    console.log(`  Processing ${group.variant}/${group.origin} ${group.id.slice(0, 8)}...`);
    try {
      await processGroup(db, group, profileCache);
    } catch (err) {
      const msg = String(err);
      if (msg.includes('Cost cap')) {
        console.error(`[generate-synthesis] Cost cap reached: ${msg}`);
        process.exit(1);
      }
      console.error(`  [error] group ${group.id.slice(0, 8)}: ${msg}`);
    }
  }

  console.log('\n[generate-synthesis] Done. Run npm run prelabel next.\n');
}

main().catch((err) => {
  console.error('[generate-synthesis] Fatal:', String(err));
  process.exit(1);
});
