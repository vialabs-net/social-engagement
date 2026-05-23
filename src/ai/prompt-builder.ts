import type { Finding } from '../analysis/types.js';
import type { BootstrapPost, Config, VoiceProfile } from '../config/schema.js';
import type { EnrichedCommit, PrContext } from '../github/commit-enricher.js';
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

export interface IndustryContextPromptInput {
  connection: string;
  articleUrl?: string | null;
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

  const languageInstruction = buildLanguageInstruction(voiceProfile.post_language);
  if (languageInstruction) {
    sections.push('');
    sections.push(languageInstruction);
  }

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
  sections.push('- No unsupported editorial opinions about code quality ("correct approach", "right way", "well-designed", "demonstrates senior-level judgment", "best practice"). Describe what was done and why (if stated in the commit). Do not evaluate whether the approach was correct.');
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
  parts.push(`Visibility: ${commit.isPrivateRepo ? 'private' : 'public'}`);
  parts.push(`Message: ${commit.message}`);
  if (commit.body.trim()) {
    parts.push(`Body:\n${commit.body.trim().split('\n').slice(0, 5).join('\n')}`);
  }
  parts.push(`Languages: ${commit.languages.join(', ') || 'mixed'}`);
  parts.push(`Changes: +${commit.totalAdditions} -${commit.totalDeletions} across ${commit.diffs.length} file${commit.diffs.length === 1 ? '' : 's'}`);
  if (commit.authorLogin) parts.push(`Author: ${commit.authorLogin}`);

  // File summary: up to 20 files; truncated if more. Gives Claude magnitude per file.
  const MAX_FILE_SUMMARY = 20;
  const fileSummaryLines = commit.diffs.slice(0, MAX_FILE_SUMMARY).map(
    (d) => `  ${d.filename} [${d.status}] +${d.additions}/-${d.deletions}${d.language ? ` (${d.language})` : ''}`,
  );
  if (commit.diffs.length > MAX_FILE_SUMMARY) {
    fileSummaryLines.push(`  ...and ${commit.diffs.length - MAX_FILE_SUMMARY} more`);
  }
  parts.push(`Files:\n${fileSummaryLines.join('\n')}`);

  parts.push('</commit>');
  parts.push('');

  parts.push('<findings>');
  for (const finding of findings) {
    parts.push(`<finding module="${finding.moduleId}" interest_score="${finding.interestScore}">`);
    parts.push(`Headline: ${finding.finding}`);
    parts.push(`Technical detail: ${finding.technicalDetail}`);
    if (finding.verifiableFacts && finding.verifiableFacts.length > 0) {
      parts.push('<facts>');
      finding.verifiableFacts.forEach((fact, i) => parts.push(`${i + 1}. ${fact}`));
      parts.push('</facts>');
    } else {
      parts.push(`Plain language: ${finding.plainLanguage}`);
    }
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
    parts.push('</industry_context>');
  }

  if (commit.prContext) {
    parts.push('');
    parts.push(buildContributorVoiceBlock(commit.prContext, commit.isPrivateRepo));
  }

  const hasVerifiableFacts = findings.some((f) => f.verifiableFacts && f.verifiableFacts.length > 0);

  parts.push('');
  parts.push('<task>');
  if (hasVerifiableFacts) {
    parts.push('Where a finding includes a <facts> block: you may state, rephrase, condense, or omit any listed fact. You may add ONE interpretive sentence connecting the facts to a broader engineering principle.');
    parts.push('You MAY NOT: state structural facts not in the list; compare to a prior state unless the commit body explicitly states the prior behavior; make absence claims about code you cannot see; describe internal logic of files whose contents are not in the facts list.');
    parts.push('');
  } else {
    parts.push('None of the findings include a verified-facts list.');
    parts.push('Do not state specific percentages, timing measurements, or line counts — they cannot be verified from the information provided.');
    parts.push('You may describe the structural change (e.g., "removed nested branching") but not quantify it (e.g., "removed 40% of branches").');
    parts.push('');
  }
  parts.push('Write one main post and one short variant.');
  parts.push('Feature the highest-value finding and only keep secondary findings when they sharpen the same story.');
  parts.push('Lead with the engineering decision or consequence, not the tool used to get there.');
  parts.push('Describe what changed in the system behavior, control surface, reliability, cost, or operational flexibility.');
  if (commit.isPrivateRepo) {
    parts.push('Visibility is private. The repository name, standard technical paths (src/, engine/, utils/, lib/), language-standard symbols (constants, types, type guards, enums), and platform APIs (localStorage, fetch, JSON.parse, Set, Map) are safe to mention — they are public engineering vocabulary, not sensitive.');
    parts.push('Abstract ONLY these categories when they appear: (a) namespace prefixes that look like company codes (e.g., "mintral:", "acme_"); (b) class or model names that combine business jargon with a specific name (e.g., "MintralServiceModel", "AcmeOrderProcessor"); (c) field or column names that encode customer-specific business semantics (e.g., "clientRut", "vendor_internal_code"); (d) internal product codenames not publicly announced.');
    parts.push('When you abstract, replace the name with the technical role it plays — for example "a customer identifier field on the core entity" instead of the actual field name. Keep concrete mechanism: data flow direction, layer involved, what the change makes possible or prevents. If you cannot describe the technical role without inventing detail, omit that point rather than fill the gap with vague phrases like "wires through the full stack" or "across the system".');
  }
  parts.push('Use concrete implementation details. Do not invent files, numbers, or project context.');
  parts.push('If a finding touches AI, translate that into the human-made constraint, interface, or behavior change. Do not give the model authorship credit for the commit.');
  parts.push('If <industry_context> is used, treat it as parallel validation from the industry, never as a citation or proof of the argument.');
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

export function buildIndustryContextBlock(input: IndustryContextPromptInput): string {
  const sourceFamily = inferIndustrySourceFamily(input.articleUrl);
  const lines = [
    'This is parallel industry signal, not source attribution.',
    'The author is speaking from their own code and judgment. Do not imply they read the matched article.',
    'Only use this if it reinforces a point already present in the commit and findings.',
    'Keep it subordinate to the main argument. If removed, the post should still work.',
    `Shared pattern: ${input.connection}`,
    'Use this pattern to position the author\'s specific decision within the broader industry movement.',
    'Be specific: name the pattern, say who else is navigating it (teams, companies, the field in general), and surface what is distinct or notable about how the author approached it.',
    'The goal is not to say "others do this too" — it is to show why this particular implementation choice is interesting given what the industry is wrestling with.',
    'Ask implicitly: who is dealing with this? are they solving it the same way? what is different here and why does that matter?',
    'Never mention the article title.',
    'Never write "according to", "as this article explains", "after reading", or "inspired by".',
    'Never use filler phrases like "more and more teams are doing this" without specifying the pattern and the tension it resolves.',
  ];

  if (sourceFamily) {
    lines.push(`If explicit naming helps, mention only the broader source family as an example: ${sourceFamily}.`);
  } else {
    lines.push('Prefer implicit industry language over naming any specific source.');
  }

  return lines.join('\n');
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
    lines.push('Industry context has often been edited out. Only use it when it adds clear value without competing with the main point.');
  } else if (preferences.industry_context_preference === 'prefer') {
    lines.push('Industry context has historically survived editing well. Use it as secondary validation when the match is strong.');
  }

  return lines;
}

function inferIndustrySourceFamily(articleUrl?: string | null): string | null {
  if (!articleUrl) return null;

  try {
    const hostname = new URL(articleUrl).hostname.toLowerCase().replace(/^www\./, '');

    if (hostname.includes('uber.com')) return "engineering blogs like Uber's";
    if (hostname.includes('bytebytego.com')) return 'architecture newsletters like ByteByteGo';
    if (hostname.includes('cloudflare.com')) return "engineering blogs like Cloudflare's";
    if (hostname.includes('linkedin.com')) return "engineering blogs like LinkedIn's";
    if (hostname.includes('netflix.com')) return "engineering blogs like Netflix's";
    if (hostname.includes('stripe.com')) return "engineering blogs like Stripe's";
    if (hostname.includes('aws.amazon.com')) return 'engineering writing like the AWS Builders Library';
  } catch {
    return null;
  }

  return null;
}

function buildContributorVoiceBlock(prContext: PrContext, isPrivateRepo: boolean): string {
  const {
    outcome, upstreamOwner, upstreamRepo, prNumber, prTitle, supersededEvidence,
    prDescription, closingIssues, reviewSummaries, changesRequestedCount,
  } = prContext;

  // Gate: medium confidence is not strong enough to assert incorporation in the post.
  const effectiveOutcome =
    outcome === 'closed_superseded' && supersededEvidence?.confidence !== 'high'
      ? 'closed_unmerged'
      : outcome;

  const outcomeText =
    effectiveOutcome === 'merged'
      ? `merged into ${upstreamOwner}/${upstreamRepo} as PR #${prNumber}`
    : effectiveOutcome === 'open'
      ? `open PR #${prNumber} in ${upstreamOwner}/${upstreamRepo} (not yet merged — under review)`
    : effectiveOutcome === 'closed_superseded'
      ? `closed PR #${prNumber} in ${upstreamOwner}/${upstreamRepo} — the maintainers incorporated this work in a separate commit`
    : `closed PR #${prNumber} in ${upstreamOwner}/${upstreamRepo} (not merged)`;

  const maintainerLine =
    effectiveOutcome === 'closed_superseded' && supersededEvidence?.maintainerComment
      ? `Maintainer reference: "${supersededEvidence.maintainerComment}"\n`
      : '';

  const descriptionBlock = prDescription
    ? `PR description (author's own words — use as context, do not quote directly):\n${prDescription}\n`
    : '';

  const privateNote = isPrivateRepo && prDescription
    ? 'This PR description comes from a private repository. Describe the engineering challenge and solution at the level of an engineering blog post (Uber Engineering, Slack Engineering). Safe to include: the technical pattern, the problem class, the design decision, the operational consequence. Do not include: internal service names, endpoint paths, customer-specific terminology, proprietary business logic, or specific numbers that reveal competitive position.\n'
    : '';

  const issueBlock = (() => {
    if (!closingIssues || closingIssues.length === 0) return '';
    const lines = closingIssues.map((issue) => {
      const statsStr = `${issue.totalReactions} reactions, ${issue.totalComments} comments`;
      const titleLine = `Closes #${issue.number} — "${issue.title}" (${statsStr})`;
      const bodyLine = issue.bodySnippet ? `Problem description: ${issue.bodySnippet}` : '';
      return bodyLine ? `${titleLine}\n${bodyLine}` : titleLine;
    });
    const privacyNote = isPrivateRepo
      ? '\nDescribe the engineering challenge and solution at the engineering blog level. Omit internal service names, endpoint paths, customer-specific details, and proprietary business logic. Focus on the pattern: what was the problem class, what was the decision, what was the consequence.'
      : '';
    return `Issue context (what this commit resolves):\n${lines.join('\n\n')}\n\nUse this as the tension source for the narrative. Do not invent additional problems beyond what is described here.${privacyNote}\n`;
  })();

  const reviewBlock = (() => {
    if (!reviewSummaries || reviewSummaries.length === 0) return '';
    const count = changesRequestedCount ?? 0;
    const header = count > 0
      ? `Review context (${count} change request${count !== 1 ? 's' : ''} before merge):`
      : 'Review context:';
    const lines = reviewSummaries.map((r) => `- ${r.state}: "${r.body}"`);
    return `${header}\n${lines.join('\n')}\n\nThe iteration process is part of the story — the author refined the design under reviewer feedback.\n`;
  })();

  return `<contributor_voice>
This commit is from a fork. PR context: ${outcomeText}.
PR title: "${prTitle}".
${descriptionBlock}${privateNote}${issueBlock}${reviewBlock}${maintainerLine}
Rules:
- Cite the project as ${upstreamOwner}/${upstreamRepo} (the upstream), not the fork.
- If outcome is open: describe the work as submitted and under review, not as accepted. Do not predict reviewer reactions. Acceptable: "I proposed X to ${upstreamOwner}/${upstreamRepo}." Not acceptable: "I added X to ${upstreamOwner}/${upstreamRepo}."
- If outcome is merged: you may say the developer contributed to ${upstreamOwner}/${upstreamRepo}.
- If outcome is closed_superseded: describe what the developer built. The maintainers incorporated this work — acknowledge the contribution accurately. Express the technical achievement, not the PR outcome.
- If outcome is closed_unmerged: focus on what was built and the technical decisions made. Do not dwell on the PR being closed.
</contributor_voice>`;
}

function buildLanguageInstruction(language: string | undefined): string | null {
  if (language === 'en-b2') {
    return '<language>\nWrite in English. Vocabulary level: B2 — clear and professional, no idioms or rarely-used expressions. Accessible to non-native English speakers without being simplistic.\n</language>';
  }
  if (language === 'es') {
    return '<language>\nEscribe en español. Tono natural de ingeniería de software en español latinoamericano. Sin anglicismos innecesarios.\n</language>';
  }
  return null;
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
