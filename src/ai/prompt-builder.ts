import type { Finding } from '../analysis/types.js';
import type { BootstrapPost, Config, VoiceProfile } from '../config/schema.js';
import type { EnrichedCommit } from '../github/commit-enricher.js';
import { rollVoiceDice } from '../voice/dice.js';
import {
  moduleIdToLabel,
  selectExposureExamples,
  syntheticVoicePost,
  trimExposureExamples,
} from '../voice/exposure.js';
import type { VoicePost, VoiceStage } from '../voice/storage.js';
import { resolvePromptTier } from '../voice/profile-utils.js';

const TONE_INSTRUCTIONS: Record<VoiceProfile['tone'], string> = {
  formal: 'Use precise, composed language with confident transitions.',
  professional: 'Sound experienced, direct, and useful without corporate filler.',
  casual: 'Write naturally and conversationally while keeping technical credibility.',
  humorous: 'Allow light wit, but keep the technical point sharper than the joke.',
  storytelling: 'Shape the post like a short narrative with a clear turn or lesson.',
  teaching: 'Explain the why behind the change so another engineer can reuse the insight.',
};

const RHYTHM_INSTRUCTIONS: Record<VoiceProfile['rhythm'], string> = {
  paragraphs: 'Prefer fuller paragraphs with deliberate transitions.',
  mixed: 'Mix short punchy lines with a few fuller paragraphs.',
  'short-sentences': 'Keep sentences compact and break aggressively for scanability.',
};

const STRUCTURE_MAP: Record<VoiceProfile['tone'] | 'professional_default', string> = {
  formal: 'Open with the decisive technical fact, add context, explain the tradeoff, end on the principle.',
  professional: 'Lead with the concrete decision or consequence, explain the work, land on the reusable lesson.',
  casual: 'Start with the real moment of friction, explain what changed, close with the takeaway.',
  humorous: 'Open with the sharpest contradiction or surprise, explain the fix, close with a dry lesson.',
  storytelling: 'Start in the middle of the moment, explain the turn, end with what changed your mind.',
  teaching: 'Open with the insight, walk through the implementation, close with the principle to reuse.',
  professional_default: 'Lead with the decision or surprise, explain the implementation, end with the reusable principle.',
};

const AUDIENCE_INSTRUCTIONS: Record<VoiceProfile['content_strategy']['audience'], string> = {
  peers: 'Assume the reader is an experienced engineer. Skip basics and focus on the tradeoff.',
  'hiring-managers': 'Make the technical judgment legible to senior evaluators without sounding self-promotional.',
  'general-tech': 'Explain significance without assuming deep stack-specific context.',
  mixed: 'Balance technical specificity with enough framing for a broader engineering audience.',
};

export const OPENING_LABELS: Record<string, string> = {
  opens_with_number: 'opening with a numeric count ("313 lines added…")',
  opens_first_person_action: 'opening with "I [verb]" first-person action ("I shipped…", "I deleted…")',
  opens_third_person_subject: 'opening by naming a subject ("The bug…", "A type guard…")',
  opens_with_question: 'opening with a question',
  opens_mid_action: 'opening mid-action or with a time anchor ("Yesterday…", "Today…", "So…")',
  opens_bold_thesis: 'opening with a bold declarative statement',
  opens_confession: 'opening with a confession or admission ("I had no idea…")',
};

export interface VoicePromptContext {
  stage: VoiceStage;
  exposurePool: VoicePost[];
  bootstrapPosts: BootstrapPost[];
  commitSha: string;
  draftIndexToday: number;
  varietyConstraint?: string;
}

export function buildSystemPrompt(
  config: Config,
  voiceProfile: VoiceProfile,
  context: VoicePromptContext,
): string {
  const sections: string[] = [
    `You are a ghostwriter for ${config.author.name}.`,
    'You receive already-analyzed software findings. Your job is to write a publishable post, not re-analyze the code.',
    '',
    '<author>',
    `${config.author.name}`,
    config.author.website ? `Website: ${config.author.website}` : null,
    '</author>',
    '',
  ].filter(Boolean) as string[];

  if (context.stage === 'cold') {
    sections.push(buildLegacyVoiceBlocks(voiceProfile));
  } else if (context.stage !== 'established') {
    sections.push('<voice>');
    sections.push(`${TONE_INSTRUCTIONS[voiceProfile.tone]} ${RHYTHM_INSTRUCTIONS[voiceProfile.rhythm]}`);
    sections.push('</voice>');
    sections.push('');
    sections.push('<structure>');
    sections.push(STRUCTURE_MAP[voiceProfile.tone]);
    sections.push('</structure>');
  }

  sections.push('');
  sections.push('<audience>');
  sections.push(AUDIENCE_INSTRUCTIONS[voiceProfile.content_strategy.audience]);
  sections.push('</audience>');

  sections.push('');
  sections.push('<hashtags>');
  sections.push(formatHashtagInstructions(voiceProfile));
  sections.push('</hashtags>');
  sections.push('');
  sections.push('<attribution>');
  sections.push('Default the agency to the author and the code change.');
  sections.push('Write about what the code now does, what decision became visible, what constraint changed, or what failure mode was removed.');
  sections.push('Do not frame AI, Claude, OpenAI, Copilot, or "the model" as the actor or source of credit unless the commit is explicitly about shipping AI behavior as a product capability.');
  sections.push('Even on AI-related commits, focus on the engineered system: constraints, interfaces, guardrails, cost controls, routing, observability, and operator controls.');
  sections.push('</attribution>');
  sections.push('');
  sections.push('<post_length>');
  sections.push(`Target ${voiceProfile.post_length.min}-${voiceProfile.post_length.max} characters for the main post.`);
  sections.push(`Hard cap: ${voiceProfile.post_length.max} characters, including hashtags and line breaks.`);
  sections.push('</post_length>');
  sections.push('');
  sections.push('<never>');
  sections.push('- No LinkedIn headers (**LINKEDIN**, ## LinkedIn)');
  sections.push('- No meta-commentary or chain-of-thought');
  sections.push('- No engagement-bait questions ("Thoughts?", "What do you think?")');
  sections.push('- No code blocks');
  sections.push('</never>');

  const preferenceLines = formatPreferenceLines(voiceProfile);
  if (preferenceLines.length > 0) {
    sections.push('');
    sections.push('<preferences>');
    sections.push(...preferenceLines);
    sections.push('</preferences>');
  }

  if (context.stage !== 'cold') {
    const progressiveBlocks = buildProgressiveVoiceBlocks(
      voiceProfile,
      context.exposurePool,
      context.bootstrapPosts,
      context.commitSha,
      context.draftIndexToday,
      context.stage,
      context.varietyConstraint,
    );
    if (progressiveBlocks) {
      sections.push('');
      sections.push(progressiveBlocks);
    }
  }

  return sections.join('\n');
}

export function buildUserPrompt(
  commit: EnrichedCommit,
  findings: Finding[],
  recentModuleIds: string[] = [],
  chapterContext?: string,
  industryContext?: string,
): string {
  const parts: string[] = [];

  parts.push('<commit>');
  parts.push(`Repository: ${commit.repo}`);
  parts.push(`Message: ${commit.message}`);
  parts.push(`Languages: ${commit.languages.join(', ') || 'mixed'}`);
  if (commit.authorLogin) parts.push(`Author: ${commit.authorLogin}`);
  parts.push('</commit>');
  parts.push('');

  parts.push('<findings>');
  for (const finding of findings) {
    parts.push(`<finding module="${finding.moduleId}" interest_score="${finding.interestScore}">`);
    parts.push(`Headline: ${finding.finding}`);
    parts.push(`Technical detail: ${finding.technicalDetail}`);
    parts.push(`Plain language: ${finding.plainLanguage}`);
    if (finding.contextHint) parts.push(`Context: ${finding.contextHint}`);
    if (finding.evidence?.before || finding.evidence?.after) {
      parts.push(`Evidence: before="${finding.evidence.before ?? ''}" after="${finding.evidence.after ?? ''}"`);
    }
    parts.push('</finding>');
  }
  parts.push('</findings>');

  if (recentModuleIds.length > 0) {
    const counts = new Map<string, number>();
    for (const moduleId of recentModuleIds) {
      counts.set(moduleId, (counts.get(moduleId) ?? 0) + 1);
    }
    const ranked = [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([moduleId, count]) => (count > 1 ? `${moduleId} ×${count}` : moduleId))
      .join(', ');
    parts.push('');
    parts.push('<module_variety_hint>');
    parts.push(`Recent posts covered these modules: ${ranked}. If today's top module repeats, keep the technical content but choose a fresh framing angle.`);
    parts.push('</module_variety_hint>');
  }

  if (chapterContext) {
    parts.push('');
    parts.push(chapterContext);
  }

  if (industryContext) {
    parts.push('');
    parts.push('<industry_context>');
    parts.push(industryContext);
    parts.push('Use this only if it strengthens the post naturally.');
    parts.push('</industry_context>');
  }

  parts.push('');
  parts.push('<task>');
  parts.push('Write one main post and one short variant.');
  parts.push('Feature the highest-value finding and only keep secondary findings when they sharpen the same story.');
  parts.push('Lead with the engineering decision or consequence, not the tool used to get there.');
  parts.push('Describe what changed in the system behavior, control surface, reliability, cost, or operational flexibility.');
  parts.push('Use concrete implementation details. Do not invent files, numbers, or project context.');
  parts.push('If a finding touches AI, translate that into the human-made constraint, interface, or behavior change. Do not give the model authorship credit for the commit.');
  parts.push('The main post must stay at or under the configured character cap.');
  parts.push('Keep the main post under the configured hard cap. If needed, prefer fewer points and cleaner sentences over extra explanation.');
  parts.push('If <voice_exposure> exists, match its level of directness and structure without copying phrases literally.');
  parts.push('');
  parts.push('<post_draft>');
  parts.push('Main post here.');
  parts.push('</post_draft>');
  parts.push('');
  parts.push('<short_draft>');
  parts.push('Short variant here.');
  parts.push('</short_draft>');
  parts.push('</task>');

  return parts.join('\n');
}

export function buildVarietyConstraint(
  recentOpeningSequence: string[],
  draftIndexToday: number,
  todayFirstOpeningMove?: string,
): string | null {
  const excluded = new Set<string>();

  if (draftIndexToday > 0 && todayFirstOpeningMove && todayFirstOpeningMove !== 'unknown') {
    excluded.add(todayFirstOpeningMove);
  }

  const last3 = recentOpeningSequence.slice(-3);
  if (last3.length >= 3 && last3.every((opening) => opening === last3[0]) && last3[0] !== 'unknown') {
    excluded.add(last3[0]!);
  }

  if (excluded.size === 0) return null;

  const labels = [...excluded].map((id) => OPENING_LABELS[id] ?? id).join(' and ');
  return `<variety_constraint>
For structural variety, avoid ${labels} in this post. Recent posts have used this opening pattern - choose a different structural approach for the first sentence. Any of the other opening types is fine.
</variety_constraint>`;
}

export function buildChapterContext(
  moduleId: string,
  previousFindings: Array<{ top_finding: string }>,
  chapterNumber: number,
): string {
  const moduleName = moduleId.replace(/_/g, ' ');
  const previousList = previousFindings
    .map((finding) => `- "${finding.top_finding}"`)
    .join('\n');

  return `<chapter_context>
This is post #${chapterNumber} this author has written about ${moduleName}.
Previous posts on this topic covered:
${previousList}

For this post: go deeper, shift the angle, or approach the same concept from a different consequence.
Do not repeat the same entry point, framing, or lesson as the previous posts.
The reader may have already seen what was covered before - assume they have context and build forward.
</chapter_context>`;
}

function buildLegacyVoiceBlocks(voiceProfile: VoiceProfile): string {
  const tier = resolvePromptTier(voiceProfile);
  const sections: string[] = [];

  if (tier === 1) {
    sections.push('<style>');
    sections.push(voiceProfile.style_patterns ?? 'Write with the structure implied by the approved examples.');
    sections.push('</style>');
    if (voiceProfile.voice_devices) {
      sections.push('');
      sections.push('<voice_devices>');
      sections.push(voiceProfile.voice_devices);
      sections.push('</voice_devices>');
    }
  } else if (tier === 2) {
    sections.push('<voice>');
    sections.push(`${TONE_INSTRUCTIONS[voiceProfile.tone]} ${RHYTHM_INSTRUCTIONS[voiceProfile.rhythm]}`);
    sections.push('</voice>');
  } else {
    sections.push('<voice>');
    sections.push('Write clearly and directly. Professional but human. No filler.');
    sections.push('</voice>');
  }

  sections.push('');
  sections.push('<structure>');
  sections.push(STRUCTURE_MAP[tier === 3 ? 'professional_default' : voiceProfile.tone]);
  sections.push('</structure>');

  return sections.join('\n');
}

function buildProgressiveVoiceBlocks(
  voiceProfile: VoiceProfile,
  exposurePool: VoicePost[],
  bootstrapPosts: BootstrapPost[],
  commitSha: string,
  draftIndexToday: number,
  stage: VoiceStage,
  varietyConstraint?: string,
): string {
  if (stage === 'cold') {
    throw new Error('buildProgressiveVoiceBlocks must not be called for stage=cold');
  }

  const blocks: string[] = [];
  const examples = buildExposureExamples(stage, exposurePool, bootstrapPosts, commitSha, draftIndexToday);

  if (varietyConstraint) blocks.push(varietyConstraint);

  if (stage === 'warming') {
    const signals = buildVoiceSignals(voiceProfile, exposurePool);
    if (signals) {
      blocks.push(`<voice_signals>\n${signals}\n</voice_signals>`);
    }
  }

  if (stage === 'established' && voiceProfile.voice_moves) {
    const { available, unavailable } = rollVoiceDice(voiceProfile.voice_moves, commitSha, draftIndexToday);
    const manualHashtags = new Set((voiceProfile.hashtags ?? []).map((tag) => tag.toLowerCase()));
    const alwaysHashtags = (voiceProfile.always_hashtags ?? []).filter((tag) => !manualHashtags.has(tag.toLowerCase()));

    const sections: string[] = [
      'This author has a specific voice. For THIS post, the dice roll has selected',
      'which moves are available. The goal is not to hit every available move - use',
      '2-4 naturally where they fit. The author\'s voice comes through in the rhythm',
      'and register, not in having every tic present.',
      '',
    ];

    if (alwaysHashtags.length > 0) {
      sections.push('Always present:');
      sections.push(...alwaysHashtags.map((tag) => `- ${tag}`));
      sections.push('');
    }
    if (available.length > 0) {
      sections.push('Available for this post (use if they fit naturally, never force):');
      sections.push(...available.map((move) => `- ${move.description}`));
      sections.push('');
    }
    if (unavailable.length > 0) {
      sections.push('NOT available for this post (find different phrasings):');
      sections.push(...unavailable.map((move) => `- ${move.description}`));
    }

    blocks.push(`<voice_moves>\n${sections.join('\n').trim()}\n</voice_moves>`);
  }

  if (examples.length > 0) {
    const exampleText = examples
      .map((example, idx) => `--- Example ${idx + 1} (topic: ${example.topic}) ---\n${example.text}`)
      .join('\n\n');

    blocks.push(`<voice_exposure>
The following are real posts this author wrote and approved for publication.
Write something new in the same range of voice and register. Do not copy
phrases literally from these examples. The examples show the author's range
- sometimes they write one way, sometimes another. Vary naturally within
that range.

${exampleText}
</voice_exposure>`);
  }

  return blocks.join('\n\n');
}

function buildExposureExamples(
  stage: VoiceStage,
  exposurePool: VoicePost[],
  bootstrapPosts: BootstrapPost[],
  commitSha: string,
  draftIndexToday: number,
): Array<{ text: string; topic: string }> {
  let examples: Array<{ text: string; topic: string }>;

  if (stage === 'bootstrap') {
    examples = bootstrapPosts.slice(0, 3).map((post, idx) => ({
      text: post.text,
      topic: `bootstrap example ${idx + 1}`,
    }));
  } else {
    const pool = stage === 'warming' && exposurePool.length < 5
      ? [
          ...exposurePool,
          ...bootstrapPosts.map((post) => syntheticVoicePost(post)),
        ]
      : exposurePool;

    const selected = selectExposureExamples(pool, commitSha, draftIndexToday, 3);
    examples = selected
      .map((post) => ({
        text: post.published ?? post.text ?? '',
        topic: post.top_module_id ? moduleIdToLabel(post.top_module_id) : 'general',
      }))
      .filter((example) => example.text.trim().length > 0);
  }

  return trimExposureExamples(examples);
}

function buildVoiceSignals(
  voiceProfile: VoiceProfile,
  publishedPosts: VoicePost[],
): string | null {
  if (publishedPosts.length < 5) return null;

  const observations: string[] = [];

  if (voiceProfile.always_hashtags?.length) {
    observations.push(`They always include ${voiceProfile.always_hashtags.join(' and ')} at the end.`);
  }

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

  const dominant = Object.entries(openingCounts).sort((left, right) => right[1] - left[1])[0];
  const dominantPct = dominant ? dominant[1] / publishedPosts.length : 0;
  if (dominant && dominantPct > 0.4) {
    const labels: Record<string, string> = {
      first_person: 'in first person ("I shipped...", "I deleted...")',
      third_person: 'naming a subject ("The bug...", "A type guard...")',
      question: 'with a question',
      other: 'with varied approaches',
    };
    observations.push(`They open most posts ${labels[dominant[0]] ?? 'with varied approaches'}.`);
  }

  const lengths = publishedPosts.map((post) => (post.published ?? '').length);
  const mean = Math.round(lengths.reduce((sum, value) => sum + value, 0) / lengths.length);
  const stddev = Math.round(Math.sqrt(
    lengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / lengths.length,
  ));
  observations.push(`This author typically writes posts of ${mean - stddev}-${mean + stddev} characters.`);

  const hasEmDash = publishedPosts.some((post) => /—/.test(post.published ?? ''));
  const hasArrows = publishedPosts.some((post) => /→/.test(post.published ?? ''));
  const hasSemicolon = publishedPosts.some((post) => /;\s+[a-z]/.test(post.published ?? ''));
  const formatting: string[] = [];
  if (hasEmDash) formatting.push('em-dashes');
  if (hasArrows) formatting.push('arrow bullets');
  if (hasSemicolon) formatting.push('semicolons');
  if (formatting.length > 0) {
    observations.push(`They make use of ${formatting.join(', ')} in their writing.`);
  }

  const tripleRegex = /(?:^|\.\s+)([A-Z][^.]{3,30}\.)\s+([A-Z][^.]{3,30}\.)\s+([A-Z][^.]{3,30}\.)/m;
  const tripleCount = publishedPosts.filter((post) => tripleRegex.test(post.published ?? '')).length;
  if (tripleCount / publishedPosts.length > 0.3) {
    observations.push('They make moderate use of short-sentence rhythms.');
  }

  if (observations.length < 3) return null;
  return observations.join(' ');
}

function formatPreferenceLines(voiceProfile: VoiceProfile): string[] {
  const lines: string[] = [];
  const preferences = voiceProfile.content_preferences;
  if (!preferences) return lines;

  if (preferences.discouraged_hook_styles?.length) {
    lines.push(`Avoid these opening patterns unless the finding strongly demands them: ${preferences.discouraged_hook_styles.join(', ')}.`);
  }

  if (preferences.industry_context_preference === 'avoid') {
    lines.push('Industry context has often been edited out. Only use it when it is essential and natural.');
  } else if (preferences.industry_context_preference === 'prefer') {
    lines.push('Industry context has historically survived editing well. Use it when the match is strong.');
  }

  return lines;
}

function formatHashtagInstructions(voiceProfile: VoiceProfile): string {
  const manualHashtags = voiceProfile.hashtags.join(' ');
  if (voiceProfile.hashtags_mode === 'always' && manualHashtags) {
    return `Always include these hashtags exactly as written at the end: ${manualHashtags}`;
  }
  if (voiceProfile.hashtags_mode === 'prefer' && manualHashtags) {
    return `Prefer these hashtags when they fit naturally: ${manualHashtags}`;
  }
  return 'Use 3-5 relevant hashtags at the end only if they fit the post naturally.';
}
