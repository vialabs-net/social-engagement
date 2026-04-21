import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { openDb } from './lib/db.js';
import { callHaiku, callSonnet, currentCostUsd, COST_CAP_USD } from './lib/anthropic-client.js';
import { splitClaims } from './lib/split-claims.js';
import {
  HAIKU_SIGNAL_EXTRACT_SYSTEM,
  buildHaikuSignalExtractUser,
} from './prompts/haiku-signal-extract.js';
import {
  buildSonnetFocalUser,
  buildSonnetArcUser,
  buildSonnetSingleUser,
  type SignalForPrompt,
} from './prompts/sonnet-synthesize.js';
import type { HaikuSignalOutput, VoiceProfileCacheEntry } from './lib/types.js';
import type { FileDiff } from '../../../src/analysis/types.js';
import { VoiceProfileSchema, type Config, type VoiceProfile } from '../../../src/config/schema.js';
import { buildSystemPrompt } from '../../../src/ai/prompt-builder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '../db');

const DRY_RUN = process.argv.includes('--dry-run');

interface GroupRow {
  id: string;
  author_login: string;
  tenant_id: string | null;
  repo: string;
  topic: string;
  variant: 'FOCAL' | 'ARCO' | 'SINGLE';
  origin: 'organic' | 'adversarial' | 'control';
  coherence_score: number | null;
  commit_shas: string;
}

interface CommitRow {
  commit_sha: string;
  repo: string;
  author_login: string | null;
  commit_date: string;
  commit_message: string;
  commit_body: string | null;
  diff_json: string;
  languages_json: string;
}

// ── Voice profile setup ─────────────────────────────────────────────────────

function loadVoiceProfileCache(): Map<string, VoiceProfileCacheEntry & { voice?: unknown }> {
  const raw = readFileSync(join(DB_DIR, 'voice-profiles-cache.json'), 'utf8');
  const arr = JSON.parse(raw) as Array<VoiceProfileCacheEntry & { voice?: unknown }>;
  const map = new Map<string, VoiceProfileCacheEntry & { voice?: unknown }>();
  for (const entry of arr) map.set(entry.github_author_login, entry);
  return map;
}

function minimalConfig(authorLogin: string): Config {
  return {
    author: {
      github_username: authorLogin,
      name: authorLogin,
    },
  } as unknown as Config;
}

function parseVoiceProfile(raw: unknown): VoiceProfile {
  const input = raw ?? {};
  return VoiceProfileSchema.parse(input);
}

function buildSonnetSystem(authorLogin: string, voiceRaw: unknown, commitSha: string): string {
  const config = minimalConfig(authorLogin);
  const voiceProfile = parseVoiceProfile(voiceRaw);
  return buildSystemPrompt(config, voiceProfile, {
    stage: 'established',
    exposurePool: [],
    bootstrapPosts: [],
    commitSha,
    draftIndexToday: 0,
  });
}

// ── Haiku signal extraction ────────────────────────────────────────────────

function extractFirstHunkSnippet(patch: string): string {
  // Find first '@@' hunk header, then collect up to 6 '+' lines (excluding '+++')
  const lines = patch.split('\n');
  let inHunk = false;
  const plusLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith('+++')) continue;
    if (line.startsWith('+')) plusLines.push(line);
    if (plusLines.length >= 6) break;
  }
  return plusLines.join('\n');
}

function parseHaikuSignalJson(text: string): HaikuSignalOutput | { trivial: true } | null {
  // Haiku sometimes wraps JSON in markdown fences or adds prose. Extract first {...}.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]) as Record<string, unknown>;
    if (obj['trivial'] === true) return { trivial: true };
    return {
      topic: typeof obj['topic'] === 'string' ? obj['topic'] : null,
      strength: typeof obj['strength'] === 'number' ? obj['strength'] : null,
      pattern_kind:
        typeof obj['pattern_kind'] === 'string'
          ? (obj['pattern_kind'] as HaikuSignalOutput['pattern_kind'])
          : null,
      affected_symbols: Array.isArray(obj['affected_symbols'])
        ? (obj['affected_symbols'] as unknown[]).filter((x): x is string => typeof x === 'string')
        : [],
      specific_change: typeof obj['specific_change'] === 'string' ? obj['specific_change'] : '',
    };
  } catch {
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = openDb();
  const voiceCache = loadVoiceProfileCache();

  const groups = db.prepare(`
    SELECT id, author_login, tenant_id, repo, topic, variant, origin, coherence_score, commit_shas
    FROM synthesis_groups
    ORDER BY origin, variant, created_at
  `).all() as GroupRow[];

  console.log(`\n[generate] Loaded ${groups.length} groups. Starting synthesis...\n`);
  console.log(`  Current cost: $${currentCostUsd().toFixed(4)} / cap $${COST_CAP_USD}\n`);

  if (DRY_RUN) {
    console.log('  [DRY RUN] No LLM calls, no DB writes. Printing plan only.\n');
    for (const group of groups) {
      const shas = JSON.parse(group.commit_shas) as string[];
      const nHaiku = group.variant === 'SINGLE' ? 0 : shas.length;
      console.log(`  would process ${group.origin}/${group.variant} ${group.author_login}/${group.topic.slice(0, 40)} (${shas.length} commits, ${nHaiku} Haiku + 1 Sonnet)`);
    }
    const totalHaiku = groups.reduce((a, g) => {
      const shas = JSON.parse(g.commit_shas) as string[];
      return a + (g.variant === 'SINGLE' ? 0 : shas.length);
    }, 0);
    console.log(`\n  Plan: ${totalHaiku} Haiku calls + ${groups.length} Sonnet calls.\n`);
    return;
  }

  let processed = 0;
  let skipped = 0;
  let declined = 0;

  for (const group of groups) {
    processed++;

    // Idempotence
    const existing = db
      .prepare('SELECT group_id FROM synthesis_posts WHERE group_id = ?')
      .get(group.id);
    if (existing) {
      skipped++;
      continue;
    }

    if (currentCostUsd() >= COST_CAP_USD) {
      console.warn(`[generate] Cost cap reached. Aborting after ${processed - 1} groups.`);
      break;
    }

    const shas = JSON.parse(group.commit_shas) as string[];
    const commits = db
      .prepare(`SELECT * FROM commit_cache WHERE commit_sha IN (${shas.map(() => '?').join(',')})`)
      .all(...shas) as CommitRow[];
    if (commits.length === 0) {
      console.warn(`  group ${group.id.slice(0, 8)} ${group.variant}/${group.origin}: no commits in cache, skip`);
      continue;
    }

    // Sort commits by date to keep temporal order in the prompt
    commits.sort((a, b) => a.commit_date.localeCompare(b.commit_date));

    const voiceEntry = voiceCache.get(group.author_login);
    const voiceRaw = voiceEntry?.voice ?? {};
    const system = buildSonnetSystem(group.author_login, voiceRaw, shas[0] ?? '');

    let userPrompt: string;

    if (group.variant === 'SINGLE') {
      // Control — single commit; no signal extraction
      const c = commits[0]!;
      const diff = (JSON.parse(c.diff_json) as FileDiff[])
        .map((d) => `--- ${d.filename}\n${d.patch}`)
        .join('\n\n');
      const signal: SignalForPrompt = {
        date: c.commit_date,
        sha: c.commit_sha,
        message: c.commit_message,
        repo: c.repo,
        topic: group.topic,
        strength: null,
        pattern_kind: null,
        description: c.commit_message,
        evidence: extractFirstHunkSnippet(diff) || diff.split('\n').slice(0, 20).join('\n'),
      };
      userPrompt = buildSonnetSingleUser(group.topic, signal);
    } else {
      // FOCAL / ARCO — extract signals via Haiku first, then synthesize with Sonnet
      const signals: SignalForPrompt[] = [];
      for (const c of commits) {
        const diffs = JSON.parse(c.diff_json) as FileDiff[];
        const diffText = diffs.map((d) => `--- ${d.filename}\n${d.patch}`).join('\n\n');

        if (currentCostUsd() >= COST_CAP_USD) {
          console.warn(`[generate] Cost cap reached mid-group. Skipping remaining commits.`);
          break;
        }

        const haikuUser = buildHaikuSignalExtractUser(c.commit_message, diffText);
        const { text: haikuText } = await callHaiku(HAIKU_SIGNAL_EXTRACT_SYSTEM, haikuUser, 512);

        const parsed = parseHaikuSignalJson(haikuText);
        const evidence = extractFirstHunkSnippet(diffText) || diffText.split('\n').slice(0, 6).join('\n');

        if (!DRY_RUN) {
          db.prepare(`
            INSERT INTO weak_signals
              (group_id, commit_sha, haiku_raw, topic, strength, pattern_kind, affected_symbols, specific_change, evidence_snippet)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            group.id,
            c.commit_sha,
            haikuText,
            parsed && 'topic' in parsed ? parsed.topic : null,
            parsed && 'strength' in parsed ? parsed.strength : null,
            parsed && 'pattern_kind' in parsed ? parsed.pattern_kind : null,
            parsed && 'affected_symbols' in parsed ? JSON.stringify(parsed.affected_symbols) : '[]',
            parsed && 'specific_change' in parsed ? parsed.specific_change : null,
            evidence,
          );
        }

        if (parsed && 'trivial' in parsed && parsed.trivial) continue;

        signals.push({
          date: c.commit_date,
          sha: c.commit_sha,
          message: c.commit_message,
          repo: c.repo,
          topic: (parsed && 'topic' in parsed ? parsed.topic : null) ?? group.topic,
          strength: (parsed && 'strength' in parsed ? parsed.strength : null),
          pattern_kind: (parsed && 'pattern_kind' in parsed ? parsed.pattern_kind : null),
          description: (parsed && 'specific_change' in parsed && parsed.specific_change)
            ? parsed.specific_change
            : c.commit_message,
          evidence,
        });
      }

      if (signals.length === 0) {
        console.warn(`  group ${group.id.slice(0, 8)}: all commits trivial, skip`);
        continue;
      }

      const firstDate = new Date(signals[0]!.date).getTime();
      const lastDate = new Date(signals[signals.length - 1]!.date).getTime();
      const spanDays = Math.max(1, Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24)));

      if (group.variant === 'FOCAL') {
        userPrompt = buildSonnetFocalUser(group.topic, signals, spanDays);
      } else {
        // ARCO
        const topics = group.topic.split(',');
        // Shared files: intersection across all commits
        const fileSets = commits.map(
          (c) => new Set((JSON.parse(c.diff_json) as FileDiff[]).map((d) => d.filename)),
        );
        const sharedFiles = [...fileSets[0] ?? []].filter((f) => fileSets.every((s) => s.has(f)));
        userPrompt = buildSonnetArcUser(topics, signals, spanDays, sharedFiles);
      }
    }

    // Synthesis call
    const { text: sonnetOutput, cost_usd: sonnetCost } = await callSonnet(system, userPrompt, 1600);

    const trimmed = sonnetOutput.trim();
    const isDeclined = /^\s*<no_post\s*\/>\s*$/.test(trimmed) || trimmed === '<no_post/>';

    let claimCount = 0;
    if (!isDeclined) {
      claimCount = splitClaims(trimmed).length;
    } else {
      declined++;
    }

    if (!DRY_RUN) {
      db.prepare(`
        INSERT INTO synthesis_posts
          (group_id, sonnet_input, sonnet_output, declined, claim_count, cost_usd)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(group.id, userPrompt, sonnetOutput, isDeclined ? 1 : 0, claimCount, sonnetCost);
    }

    const tag = isDeclined ? '  declined' : `  ${claimCount} claims`;
    console.log(`  [${processed}/${groups.length}] ${group.origin}/${group.variant} ${group.author_login}/${group.topic.slice(0, 30)} → ${tag} ($${currentCostUsd().toFixed(4)})`);
  }

  console.log(`\n[generate] Done.`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped (already done): ${skipped}`);
  console.log(`  Declined: ${declined}`);
  console.log(`  Total cost: $${currentCostUsd().toFixed(4)}\n`);
}

main().catch((err) => {
  console.error('[generate] Unexpected error:', String(err));
  process.exit(1);
});
