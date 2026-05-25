import { buildSystemPrompt, type VoicePromptContext } from './prompt-builder.js';
import type { CoherenceScore } from '../analysis/coherence-router.js';
import type { SignalEvent } from '../voice/storage.js';
import type { VoiceStage } from '../voice/storage.js';
import type { BootstrapPost, Config, VoiceProfile } from '../config/schema.js';
import type { VoicePost } from '../voice/storage.js';

export interface SynthesisCommitGroup {
  readonly commitSha: string;
  readonly accumulatedAt: string; // ISO timestamp of the most recent signal in this commit
  readonly repo: string;
  readonly signals: Pick<SignalEvent, 'topic' | 'strength' | 'pattern_kind' | 'specific_change'>[];
}

export interface SynthesisPromptInput {
  readonly gatillador: 'focal' | 'arco' | 'focal_multiple';
  readonly topics: string[];
  readonly commitGroups: SynthesisCommitGroup[]; // oldest first
  readonly coherenceScore?: CoherenceScore;       // only for arco
  readonly lastPostSummary?: string;
  readonly developmentalAngle?: string;           // R3 arc guidance block
  readonly industryContext?: string;              // editorial tension frame from article match
  readonly voiceProfile: VoiceProfile;
  readonly voiceStage: VoiceStage;
  readonly config: Config;
  readonly exposurePool: VoicePost[];
  readonly bootstrapPosts: BootstrapPost[];
  readonly draftIndexToday: number;
  readonly commitSha: string; // representative sha for the draft record
}

export function buildSynthesisSystemPrompt(input: SynthesisPromptInput): string {
  const voiceCtx: VoicePromptContext = {
    stage: input.voiceStage,
    exposurePool: input.exposurePool,
    bootstrapPosts: input.bootstrapPosts,
    commitSha: input.commitSha,
    draftIndexToday: input.draftIndexToday,
  };
  return buildSystemPrompt(input.config, input.voiceProfile, voiceCtx);
}

export function buildSynthesisUserPrompt(input: SynthesisPromptInput): string {
  const parts: string[] = [];

  // Commit series block
  parts.push('<commit_series>');
  for (const group of input.commitGroups) {
    const date = new Date(group.accumulatedAt).toISOString().slice(0, 10);
    parts.push(`  <commit date="${date}" sha="${group.commitSha.slice(0, 8)}" repo="${group.repo}">`);
    for (const sig of group.signals) {
      parts.push(`    <signal module="${sig.topic}" strength="${sig.strength}" pattern="${sig.pattern_kind}">`);
      parts.push(`      ${sig.specific_change}`);
      parts.push('    </signal>');
    }
    parts.push('  </commit>');
  }
  parts.push('</commit_series>');

  // Coherence evidence for arco (anchors Sonnet to structural justification)
  if (input.gatillador === 'arco' && input.coherenceScore) {
    parts.push('');
    parts.push('<coherence_evidence>');
    parts.push(`  <structural_score>${input.coherenceScore.structural.toFixed(2)}</structural_score>`);
    parts.push(`  <span_days>${computeSpanDays(input.commitGroups)}</span_days>`);
    parts.push(`  <topics>${input.topics.join(', ')}</topics>`);
    parts.push('</coherence_evidence>');
  }

  // Industry context (editorial tension frame)
  if (input.industryContext) {
    parts.push('');
    parts.push('<industry_context>');
    parts.push(input.industryContext);
    parts.push('</industry_context>');
  }

  // Synthesis task
  const spanDays = computeSpanDays(input.commitGroups);
  const lastPostNote = input.lastPostSummary
    ? `Last post on related topics: ${input.lastPostSummary}`
    : 'No previous post on these topics.';

  parts.push('');
  parts.push('<synthesis_task>');

  if (input.gatillador === 'focal') {
    const topic = input.topics[0] ?? 'this area';
    parts.push(`Write a post about what this developer worked on in [${topic}] across ${input.commitGroups.length} commits spanning ${spanDays} days.`);
    parts.push('Focus on the depth and quality of the work in this single area.');
    parts.push('Do NOT try to connect it to other topics not mentioned here.');
  } else {
    const topicList = input.topics.join(' and ');
    parts.push(`Write a post about the arc spanning [${topicList}] across these commits.`);
    parts.push('The commits share structural context — emphasize the evolution and how the topics connect in this work.');
    parts.push('Do NOT invent connections beyond what the code shows.');
  }

  parts.push(lastPostNote);

  // R4: technical accuracy constraint — signals carry no verified fact list
  parts.push('');
  parts.push('Do not state specific percentages, timing measurements, or line counts — they cannot be verified from the signal descriptions provided.');
  parts.push('You may describe structural changes (e.g., "removed nested branching") but not quantify them (e.g., "removed 40% of branches").');
  parts.push('</synthesis_task>');

  if (input.developmentalAngle) {
    parts.push('');
    parts.push(input.developmentalAngle);
  }

  parts.push('');
  parts.push('Among all signals, identify the single decision or change that carries the strongest complete story (clearest tension + resolution). Write the post around that one decision only.');
  parts.push('The other signals are context for you to understand the work — do not mention them in the post.');

  const instagramEnabled = input.config.platforms.instagram.enabled;

  parts.push('');
  parts.push('Write the following variants. Wrap each in these XML tags exactly:');
  parts.push('');
  parts.push('<linkedin_draft>');
  parts.push('LinkedIn post here.');
  parts.push('</linkedin_draft>');
  parts.push('');
  if (instagramEnabled) {
    parts.push('- Instagram: first line ≤125 chars, must work as a standalone hook before "see more". Optional: 1-2 short supporting lines. Hashtags on last line only.');
    parts.push('');
    parts.push('<instagram_draft>');
    parts.push('Instagram caption here.');
    parts.push('</instagram_draft>');
    parts.push('');
  }
  parts.push('<opening_move>');
  parts.push('One-word label for the opening technique used (e.g. question, statistic, anecdote, contradiction, problem-first, declarative).');
  parts.push('</opening_move>');

  return parts.join('\n');
}

function computeSpanDays(groups: SynthesisCommitGroup[]): number {
  if (groups.length < 2) return 0;
  const times = groups.map((g) => new Date(g.accumulatedAt).getTime()).sort((a, b) => a - b);
  return Math.round((times[times.length - 1]! - times[0]!) / (24 * 60 * 60 * 1000));
}

/**
 * Group signal events by commit SHA, sorted oldest first.
 * Produces the SynthesisCommitGroup[] needed by buildSynthesisUserPrompt.
 */
interface MutableCommitGroup {
  commitSha: string;
  accumulatedAt: string;
  repo: string;
  signals: Pick<SignalEvent, 'topic' | 'strength' | 'pattern_kind' | 'specific_change'>[];
}

export function groupSignalsByCommit(signals: SignalEvent[]): SynthesisCommitGroup[] {
  const map = new Map<string, MutableCommitGroup>();

  for (const s of signals) {
    const existing = map.get(s.commit_sha);
    if (existing) {
      existing.signals.push(s);
      if (s.accumulated_at > existing.accumulatedAt) {
        existing.accumulatedAt = s.accumulated_at;
      }
    } else {
      map.set(s.commit_sha, {
        commitSha: s.commit_sha,
        accumulatedAt: s.accumulated_at,
        repo: s.repo,
        signals: [s],
      });
    }
  }

  return [...map.values()].sort((a, b) => a.accumulatedAt.localeCompare(b.accumulatedAt));
}
