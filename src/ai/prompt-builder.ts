import type { Finding } from '../analysis/types.js';
import type { VoicePost, Platform } from '../voice/storage.js';
import type { EnrichedCommit } from '../github/commit-enricher.js';
import type { Config } from '../config/schema.js';

/**
 * Assembles the prompt following Anthropic's long-context best practices:
 *
 * [SYSTEM — ~300 tokens]
 * [VOICE EXAMPLES — TOP of context, ordered edit_ratio DESC]
 * [COMMIT CONTEXT — middle]
 * [MODULE FINDINGS — below commit, above task]
 * [TASK INSTRUCTION — BOTTOM]
 */
export function buildSystemPrompt(config: Config): string {
  const { name, website } = config.author;
  const websiteLine = website ? `Site: ${website} — "The Art of Improving Without Starting Over"\n` : '';

  return `You are a code translator and social media ghostwriter. You receive structured analysis of code changes from specialized modules, and you translate them into engaging social media posts.

You don't need to analyze the code yourself — that work is already done. Your job is to WRITE: take the technical findings and wrap them in ${name}'s voice and teaching style.

<author>
${name} — Software Architect. 10+ years experience.
${websiteLine}Background: Financial systems, Kubernetes, AI/ML, cloud architecture.
</author>

<voice>
Precise, confident, earned wisdom. Dry wit — no forced humor.
Shows rather than tells. Technical substance in every post.
Every post leaves the reader knowing something concrete.
Teaches without performing. References personal experience only where it earns its place.
NEVER: generic LinkedIn motivation, "grateful for the journey", vibes-only content.
</voice>

<format_rules>
LinkedIn: 1200–1800 characters. Hook → context → technical finding → teaching moment → CTA.
Instagram: 150–300 words. Same content, more storytelling. Include visual suggestion.
First line must work as a standalone hook that triggers "see more".
</format_rules>`;
}

export function buildUserPrompt(
  commit: EnrichedCommit,
  findings: Finding[],
  voiceExamples: VoicePost[],
  platforms: Platform[],
  config: Config,
): string {
  const parts: string[] = [];

  // Voice examples at TOP (Anthropic best practice for long context)
  if (voiceExamples.length > 0) {
    parts.push('<voice_history>');
    parts.push(`Published posts ordered by edit ratio (1.0 = unchanged from AI draft = good match).\n`);
    for (const post of voiceExamples) {
      const ratio = post.edit_ratio !== null ? ` edit_ratio="${post.edit_ratio.toFixed(2)}"` : '';
      parts.push(`<published_post platform="${post.platform}"${ratio}>`);
      parts.push(post.published ?? post.ai_draft);
      parts.push('</published_post>');
    }
    parts.push('</voice_history>\n');
  }

  // Commit context
  parts.push('<commit>');
  parts.push(`Repository: ${commit.repo}`);
  parts.push(`Message: ${commit.message}`);
  parts.push(`Languages: ${commit.languages.join(', ') || 'mixed'}`);
  parts.push(`Changed: +${commit.totalAdditions} lines, -${commit.totalDeletions} lines`);
  parts.push('</commit>\n');

  // Module findings (natural language, not JSON)
  parts.push('<module_findings>');
  parts.push('The following findings come from specialized code analysis modules.');
  parts.push('Each finding has already been analyzed — your job is to WRITE, not re-analyze.\n');
  for (const finding of findings) {
    parts.push(`<finding module="${finding.moduleId}" interest_score="${finding.interestScore}">`);
    parts.push(`  What: ${finding.finding}`);
    parts.push(`  Technical detail: ${finding.technicalDetail}`);
    parts.push(`  Plain language: ${finding.plainLanguage}`);
    if (finding.evidence?.before || finding.evidence?.after) {
      parts.push(`  Evidence: before="${finding.evidence.before ?? ''}" after="${finding.evidence.after ?? ''}"`);
    }
    parts.push('</finding>');
  }
  parts.push('</module_findings>\n');

  // Task at BOTTOM
  const websiteRef = config.author.website
    ? `Reference ${config.author.website} when naturally relevant — not in every post.`
    : '';

  parts.push(`<task>
Write social media posts based on the module findings above.

Steps:
1. Feature the highest interest_score finding. Mention others only if they add context.
2. Include project context — don't assume the reader saw previous posts.
3. Use specific details from each finding's technical_detail. Real data, real names.
4. Match the rhythm and style of <voice_history> if present.
${websiteRef}

Generate for these platforms: ${platforms.join(', ')}

<linkedin_draft>
1200–1800 characters. Hook on line 1. Structure: Hook → context → finding → teaching moment → CTA.
3–5 hashtags at the end.
</linkedin_draft>

<instagram_draft>
150–300 words. Storytelling style. Same technical substance, more accessible.
Suggest a visual (code screenshot / carousel outline / concept).
15–20 hashtags.
</instagram_draft>

SELF-CHECK before responding:
- Does the post use specific data from the findings? (not generic)
- Would a developer learn something concrete?
- Is there project context for a first-time reader?
- Does it match the voice examples?
</task>`);

  return parts.join('\n');
}
