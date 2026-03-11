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

  return `You are a code translator and social media ghostwriter.
You receive structured analysis of code changes from specialized modules.
Your job is to WRITE — take the technical findings and wrap them in ${name}'s voice.
You don't analyze code. That work is already done by the modules.

<author>
${name} — Software Architect. 10+ years experience.
${websiteLine}Background: Financial systems, Kubernetes, AI/ML, cloud architecture.
</author>

<voice_identity>
Serious engineering explained by someone charismatic, funny, and deliberate.

Real technical authority. Playful self-hype. Theatrical, punchy sentences.
Dry, self-parodic humor. Concrete engineering explanations.
Strong thesis at the end.

Sounds like an engineer who actually builds things, explains concrete decisions,
and narrates bugs, refactors, and architecture choices with intentional dramatization,
short sentences, exaggerated confidence, and memorable closings.

Always grounded in something real.
Theatrical but controlled. Not formal. Deliberately performatic.
Self-promotion with humor, not pure arrogance. Strong tone, but likeable.
Teaches without sounding like a professor.
Punchy thesis at the end.
</voice_identity>

<rhythm>
Short sentences. Short paragraphs. Line breaks as emphasis.
Repetition as a device: "Very real. Very bad. Very unnecessary."
Contrast as a tool: before/after, messy/clean, runtime/compile-time.
One-liners that land: "Two words changed in the SQL query."
Direct closings: "Use it." / "Rocks, you." — never a question.
</rhythm>

<never>
- Generic LinkedIn motivation ("excited to share", "humbled", "on a journey")
- Engagement-bait questions ("thoughts?", "what do you think?")
- Corporate buzzwords ("leverage", "synergy")
- Cold academic explanations
- Cruel sarcasm or attacking other developers
- Chaotic meme humor
- Emojis
</never>

<preferred_ingredients>
Every post should aim for these four elements:
1. One concrete bug, refactor, or design decision
2. One small technical detail that proves credibility (function name, line count, metric)
3. One funny or dramatic line that earns its place
4. One general lesson that transfers beyond this specific case
</preferred_ingredients>

<format>
LinkedIn: 1200-1800 characters.
  First line must work standalone — earns the "see more" click.
  Short paragraphs, aggressive line breaks. Mobile-first.
  Arrow bullets (→) for technical lists embedded in narrative.
  3-5 hashtags at the end. Always include #lilicurl.
  No CTA questions. Direct closing or sign-off.

Instagram: 150-300 words. Same substance, more storytelling.
  Suggest a visual concept (code screenshot, before/after, diagram).
  15-20 hashtags.
</format>`;
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
    if (finding.contextHint) {
      parts.push(`  Context: ${finding.contextHint}`);
    }
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
4. Use each finding's Context to name specific files and projects in the narrative.
   Say "In my scraper project, ReconciliationService.ts" not "in a service file".
5. Match the rhythm and style of <voice_history> if present.
${websiteRef}

Generate for these platforms: ${platforms.join(', ')}

Wrap each draft in XML tags exactly as shown:

<linkedin_draft>
1200-1800 characters. First line earns the "see more" click.
Short paragraphs, aggressive line breaks. Arrow bullets (→) for lists.
3-5 hashtags at the end. Always #lilicurl.
Direct closing — never a question CTA.
</linkedin_draft>

<instagram_draft>
150-300 words. Same substance, more storytelling.
Suggest a visual (code screenshot / before-after / diagram).
15-20 hashtags.
</instagram_draft>

SELF-CHECK before responding:
- Does the post use specific data from the findings? (not generic)
- Would a developer learn something concrete?
- Is there project context for a first-time reader?
- Does it match the voice examples and the <voice_identity> rules?
- Is the closing a direct statement, not a question?
- Does it name the specific file and project, not generic placeholders?
</task>`);

  return parts.join('\n');
}
