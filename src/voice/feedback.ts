import type { ContentPreferences, HookStyle } from '../config/schema.js';
import type { EditAnalysis, VoicePost } from './storage.js';
import { computeEditRatio, sharedTokenCount, tokenize } from './similarity.js';

const HASHTAG_REGEX = /(?<=^|\s)#[A-Za-z0-9_]+/g;
const COUNT_WORDS = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']);

export function computeEditAnalysis(post: VoicePost, publishedText: string): EditAnalysis {
  const aiDraft = post.ai_draft;
  const hookDraft = extractHook(aiDraft);
  const hookPublished = extractHook(publishedText);
  const closingDraft = extractClosing(aiDraft);
  const closingPublished = extractClosing(publishedText);

  const hookChanged = hasEnoughTokens(hookDraft, hookPublished)
    ? computeEditRatio(hookDraft, hookPublished) < 0.5
    : false;
  const closingChanged = hasEnoughTokens(closingDraft, closingPublished)
    ? computeEditRatio(closingDraft, closingPublished) < 0.5
    : false;

  const suggestedHashtags = extractHashtags(aiDraft);
  const publishedHashtags = new Set(extractHashtags(publishedText).map((tag) => tag.toLowerCase()));
  const keptSuggestedHashtags = suggestedHashtags.filter((tag) => publishedHashtags.has(tag.toLowerCase())).length;

  const contextTokens = tokenize(post.match_connection ?? '');
  const industryContextRemoved = (
    !post.has_industry_context
    || !post.match_connection
    || contextTokens.length < 6
  )
    ? false
    : (sharedTokenCount(post.match_connection, publishedText) / Math.max(contextTokens.length, 1)) < 0.5;

  const editRatio = computeEditRatio(aiDraft, publishedText);
  return {
    hook_changed: hookChanged,
    closing_changed: closingChanged,
    length_delta: publishedText.length - aiDraft.length,
    hashtags_kept_ratio: keptSuggestedHashtags / Math.max(suggestedHashtags.length, 1),
    industry_context_removed: industryContextRemoved,
    edit_type: classifyEditType(editRatio),
  };
}

export function classifyHookStyle(text: string): HookStyle {
  const hook = extractHook(text).trim();
  const lower = hook.toLowerCase();

  if (hook.endsWith('?')) return 'question';
  if (/^(\d+|[\d.,]+%)/.test(hook) || [...COUNT_WORDS].some((word) => lower.startsWith(`${word} `))) {
    return 'statistic';
  }
  if (/^(i|we|when i|today i)\b/.test(lower)) return 'anecdote';
  if (/\b(but|except|turns out|the irony)\b/.test(lower)) return 'contradiction';
  if (/\b(bug|incident|timeout|error|outage|failed)\b/.test(lower)) return 'problem-first';
  return 'declarative';
}

export function deriveContentPreferences(outcomes: VoicePost[], now = new Date()): ContentPreferences {
  const published = outcomes.filter((post) => post.status === 'published');
  // Exclude linkedin_direct (edit_ratio hardcoded 1.0) and 👎-rated posts (author
  // explicitly rejected them) from hook/length signal computation.
  const latestPublished = published
    .filter((post) => post.publish_source !== 'linkedin_direct' && post.voice_rating !== 1)
    .slice(0, 10);
  const recentWindowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const moduleStats = new Map<string, { published: number; expired: number }>();
  for (const outcome of outcomes) {
    if (!outcome.top_module_id) continue;
    const current = moduleStats.get(outcome.top_module_id) ?? { published: 0, expired: 0 };
    if (outcome.status === 'published') current.published += 1;
    if (outcome.status === 'expired') current.expired += 1;
    moduleStats.set(outcome.top_module_id, current);
  }

  const preferredModules = [...moduleStats.entries()]
    .map(([moduleId, stats]) => ({
      moduleId,
      publishRate: stats.published / Math.max(stats.published + stats.expired, 1),
      published: stats.published,
    }))
    .filter((entry) => entry.published > 0)
    .sort((left, right) => right.publishRate - left.publishRate || right.published - left.published)
    .slice(0, 3)
    .map((entry) => entry.moduleId);

  const hookStats = new Map<HookStyle, { total: number; changed: number }>();
  for (const post of latestPublished) {
    if (!post.edit_analysis) continue;
    const hookStyle = classifyHookStyle(post.ai_draft);
    const current = hookStats.get(hookStyle) ?? { total: 0, changed: 0 };
    current.total += 1;
    if ((post.edit_analysis['hook_changed'] as boolean | undefined) === true) current.changed += 1;
    hookStats.set(hookStyle, current);
  }

  const discouragedHookStyles = [...hookStats.entries()]
    .filter(([, stats]) => stats.total >= 3 && stats.changed / stats.total >= 0.7)
    .map(([style]) => style);

  const lengthDeltas = latestPublished
    .map((post) => post.edit_analysis?.['length_delta'])
    .filter((value): value is number => typeof value === 'number');
  const typicalLengthDelta = lengthDeltas.length > 0
    ? Math.round(lengthDeltas.reduce((sum, value) => sum + value, 0) / lengthDeltas.length)
    : undefined;

  const recentOutcomes = outcomes.filter((post) => {
    const timestamp = post.published_at ?? post.created_at;
    return new Date(timestamp) >= recentWindowStart;
  });
  const expiredRate30d = recentOutcomes.length > 0
    ? recentOutcomes.filter((post) => post.status === 'expired').length / recentOutcomes.length
    : 0;

  const attemptedContextPosts = published
    .filter((post) => post.context_status === 'matched' || post.context_status === 'no_match')
    .slice(0, 5);
  const matchedContextPosts = attemptedContextPosts.filter((post) => post.context_status === 'matched');
  const removedCount = matchedContextPosts.filter(
    (post) => post.edit_analysis?.['industry_context_removed'] === true,
  ).length;
  const matchedAverageEditRatio = matchedContextPosts.length > 0
    ? matchedContextPosts.reduce((sum, post) => sum + (post.edit_ratio ?? 0), 0) / matchedContextPosts.length
    : 0;
  const attemptedAverageEditRatio = attemptedContextPosts.length > 0
    ? attemptedContextPosts.reduce((sum, post) => sum + (post.edit_ratio ?? 0), 0) / attemptedContextPosts.length
    : 0;

  let industryContextPreference: ContentPreferences['industry_context_preference'] = 'neutral';
  if (matchedContextPosts.length === 5 && removedCount >= 3) {
    industryContextPreference = 'avoid';
  } else if (
    matchedContextPosts.length === 5
    && removedCount === 0
    && matchedAverageEditRatio >= 0.8
  ) {
    industryContextPreference = 'prefer';
  } else if (
    attemptedContextPosts.length === 5
    && removedCount === 0
    && attemptedAverageEditRatio >= 0.8
  ) {
    industryContextPreference = 'neutral';
  }

  return {
    ...(preferredModules.length > 0 && { preferred_modules: preferredModules }),
    ...(discouragedHookStyles.length > 0 && { discouraged_hook_styles: discouragedHookStyles }),
    ...(typicalLengthDelta !== undefined && { typical_length_delta: typicalLengthDelta }),
    industry_context_preference: industryContextPreference,
    expired_rate_30d: Number(expiredRate30d.toFixed(3)),
    updated_at: now.toISOString(),
  };
}

function classifyEditType(editRatio: number): EditAnalysis['edit_type'] {
  if (editRatio >= 0.85) return 'polish';
  if (editRatio >= 0.6) return 'restructure';
  return 'rewrite';
}

function extractHook(text: string): string {
  return extractLeadingSpan(text, 280);
}

function extractClosing(text: string): string {
  return extractTrailingSpan(text, 280);
}

function extractLeadingSpan(text: string, cap: number): string {
  const trimmed = text.trim();
  const firstParagraph = trimmed.split(/\n\s*\n/)[0] ?? trimmed;
  if (trimmed.includes('\n\n')) return firstParagraph.slice(0, cap);
  const firstSentence = trimmed.match(/^.*?[.!?](?:\s|$)/)?.[0] ?? trimmed;
  return firstSentence.slice(0, cap);
}

function extractTrailingSpan(text: string, cap: number): string {
  const trimmed = text.trim();
  const paragraphs = trimmed.split(/\n\s*\n/).filter(Boolean);
  if (paragraphs.length > 1) {
    const lastParagraph = paragraphs[paragraphs.length - 1] ?? trimmed;
    return lastParagraph.slice(-cap);
  }

  const sentences = trimmed.match(/[^.!?]+[.!?]?/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
  const lastSentence = sentences[sentences.length - 1] ?? trimmed;
  return lastSentence.slice(-cap);
}

function hasEnoughTokens(left: string, right: string): boolean {
  return tokenize(left).length >= 5 && tokenize(right).length >= 5;
}

function extractHashtags(text: string): string[] {
  return text.match(HASHTAG_REGEX) ?? [];
}
