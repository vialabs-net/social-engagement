import type { IAIClient } from '../ai/types.js';
import type { EnrichedCommit } from '../github/commit-enricher.js';
import { logger } from '../utils/logger.js';
import type { WeakSignal } from './types.js';

interface HaikuSignalResult {
  strength: number;
  pattern_kind: WeakSignal['pattern_kind'];
  affected_symbols: string[];
  specific_change: string;
}

interface HaikuResponse {
  result: HaikuSignalResult | null;
}

const HAIKU_MAX_DIFF_CHARS = 2000;

const SYSTEM_PROMPT = `You evaluate code diffs for semantic relevance to a given software engineering topic.

Return JSON with this exact shape:
{"result": {"strength": <1-4>, "pattern_kind": <kind>, "affected_symbols": [<names>], "specific_change": "<1 line>"}}

Or if no semantic value:
{"result": null}

Rules:
- strength 1 = minor; 4 = strong signal (max for this endpoint)
- pattern_kind must be one of: new_abstraction, contract_change, semantic_refactor, config_change, dependency_update, behavioral_change
- affected_symbols: 1-3 function/class/type names; empty array if none
- specific_change: one line, max 80 chars, concrete ("timeout 5s→30s in fetchUser")
- Return null if the change is: whitespace-only, auto-rename, purely cosmetic, import reorder, comment-only, or mechanical find-replace with no behavioral difference
- Return null if the change is in the added lines only but it exactly mirrors what was removed (mechanical substitution)
- Be conservative: when uncertain, return null`;

export async function extractSignalFromDiff(
  haiku: IAIClient,
  commit: EnrichedCommit,
  topic: string,
  tenantId: string,
  authorLogin: string,
): Promise<WeakSignal | null> {
  const diffsText = commit.diffs
    .map((d) => `=== ${d.filename} ===\n${d.patch.slice(0, HAIKU_MAX_DIFF_CHARS)}`)
    .join('\n\n')
    .slice(0, 4000);

  const userPrompt = `Topic: ${topic}
Commit: ${commit.sha.slice(0, 8)} — ${commit.message}
Repo: ${commit.repo}

${diffsText}

Evaluate if this commit contains semantic evidence for the topic "${topic}". Return JSON.`;

  let raw: string;
  try {
    raw = await haiku.complete(SYSTEM_PROMPT, userPrompt);
  } catch (err) {
    logger.warn('signal-extractor.haiku.failed', { sha: commit.sha, topic, error: String(err) });
    return null;
  }

  let parsed: HaikuResponse;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    parsed = JSON.parse(jsonMatch[0]) as HaikuResponse;
  } catch {
    logger.warn('signal-extractor.parse.failed', { sha: commit.sha, topic, raw: raw.slice(0, 200) });
    return null;
  }

  if (parsed.result === null || parsed.result === undefined) return null;

  const { strength, pattern_kind, affected_symbols, specific_change } = parsed.result;

  if (
    typeof strength !== 'number' ||
    strength < 1 ||
    strength > 4 ||
    typeof pattern_kind !== 'string' ||
    !Array.isArray(affected_symbols) ||
    typeof specific_change !== 'string'
  ) {
    logger.warn('signal-extractor.invalid.response', { sha: commit.sha, topic, result: parsed.result });
    return null;
  }

  return {
    topic,
    strength: Math.round(strength) as number,
    pattern_kind: pattern_kind as WeakSignal['pattern_kind'],
    source: 'haiku_lazy',
    affected_symbols: affected_symbols.filter((s): s is string => typeof s === 'string').slice(0, 3),
    affected_files: commit.diffs.map((d) => d.filename),
    specific_change: specific_change.slice(0, 80),
    commit_sha: commit.sha,
    repo: commit.repo,
    tenant_id: tenantId,
    github_author_login: authorLogin,
    accumulated_at: new Date().toISOString(),
  };
}
