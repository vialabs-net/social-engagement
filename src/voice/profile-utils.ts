import type { Finding } from '../analysis/types.js';
import { DEFAULT_VOICE_PROFILE, type VoiceProfile } from '../config/schema.js';
import type { EnrichedCommit } from '../github/commit-enricher.js';

export function mergeVoiceProfile(profile: VoiceProfile | null | undefined): VoiceProfile {
  if (!profile) return DEFAULT_VOICE_PROFILE;
  return {
    ...DEFAULT_VOICE_PROFILE,
    ...profile,
    content_strategy: {
      ...DEFAULT_VOICE_PROFILE.content_strategy,
      ...profile.content_strategy,
    },
    post_length: {
      ...DEFAULT_VOICE_PROFILE.post_length,
      ...profile.post_length,
    },
  };
}

export function resolvePromptTier(voiceProfile: VoiceProfile): 1 | 2 | 3 {
  if (voiceProfile.style_patterns || voiceProfile.voice_devices) return 1;
  return hasManualVoiceSignal(voiceProfile) ? 2 : 3;
}

function hasManualVoiceSignal(voiceProfile: VoiceProfile): boolean {
  return (
    voiceProfile.tone !== DEFAULT_VOICE_PROFILE.tone
    || voiceProfile.rhythm !== DEFAULT_VOICE_PROFILE.rhythm
    || voiceProfile.hashtags.length > 0
    || voiceProfile.hashtags_mode !== DEFAULT_VOICE_PROFILE.hashtags_mode
    || voiceProfile.post_length.min !== DEFAULT_VOICE_PROFILE.post_length.min
    || voiceProfile.post_length.max !== DEFAULT_VOICE_PROFILE.post_length.max
    || (voiceProfile.content_strategy.focus_modules?.length ?? 0) > 0
    || voiceProfile.content_strategy.audience !== DEFAULT_VOICE_PROFILE.content_strategy.audience
    || voiceProfile.content_strategy.skip_patterns.length > 0
  );
}

export function filterFindingsByContentStrategy(
  findings: Finding[],
  voiceProfile: VoiceProfile,
): Finding[] {
  const focus = voiceProfile.content_strategy.focus_modules;
  if (!focus || focus.length === 0) return findings;
  const focusSet = new Set(focus);
  return findings.filter((finding) => focusSet.has(finding.moduleId));
}

export function matchesSkipPatterns(
  commit: EnrichedCommit,
  findings: Finding[],
  voiceProfile: VoiceProfile,
): string | null {
  const skipPatterns = voiceProfile.content_strategy.skip_patterns
    .map((pattern) => pattern.trim().toLowerCase())
    .filter(Boolean);
  if (skipPatterns.length === 0) return null;

  const haystack = [
    commit.repo,
    commit.message,
    ...findings.flatMap((finding) => [
      finding.finding,
      finding.plainLanguage,
      finding.contextHint ?? '',
      finding.technicalDetail,
    ]),
  ].join('\n').toLowerCase();

  return skipPatterns.find((pattern) => haystack.includes(pattern)) ?? null;
}
