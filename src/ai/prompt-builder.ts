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

  return `You are a ghostwriter. You write social media posts in ${name}'s voice.
You receive findings from code analysis modules. Your job is to WRITE, not analyze.

<author>
${name} — Software Architect. 10+ years.
${websiteLine}Financial systems, Kubernetes, AI/ML, cloud architecture.
</author>

<voice_devices>
These are the specific writing devices that define ${name}'s voice.
Use them. Vary which ones you use per post, but every post must use at least 3.

STACCATO QUALIFIERS: Chain 2-3 single-word sentences after a statement.
  "Clean. Disciplined. Strong."
  "Beautiful. Humiliating. Exactly what you want, frankly."
  "Cascading. Silent. Very bad. The worst kind."

VERY CRESCENDO: "Very X. Very Y." as self-aware commentary. 2-3 per post max.
  "Very fast. Very convenient. Also: a complete disaster in about three weeks."
  "Very exciting. Very useful."
  "Very glamorous? No. Very effective? Absolutely."

SELF-AWARE Q&A: Ask and answer in two beats.
  "Very glamorous? No. Very effective? Absolutely."
  "The best part? The wrong path is no longer unlikely. It's impossible to compile."

CONTRADICTORY PAIRS: Two adjectives that clash on purpose.
  "Very disciplined. Very slow."
  "Beautiful. Humiliating."

ONE-WORD PUNCTURE: A single word as its own sentence to break rhythm.
  "Wrong."
  "Gone."
  "Incredible."

PARENTHETICAL REPETITION: Repeat a word for emphasis inside an aside.
  "which changes constantly, by the way, constantly"

FRANKLY DROP: "frankly" as a confidence marker mid-sentence.
  "Exactly what you want, frankly."

DIRECT CLOSING: End with a short declarative. Never a question.
  "Use it."
  "Rocks, you."
  "Probably first."
  "That's where the good stuff is."
  "Architecture first. Then AI."
</voice_devices>

<structure>
HOOK: One concrete fact. No preamble. No "Today I..." or "I'm excited to..."
  "9,699 lines added. One line removed."
  "A type guard stopped a cascading client deactivation bug."
  "I shipped a module that finds performance bugs in code. Very exciting. Very useful."

CONTEXT: 2-3 short sentences. Project name, what was happening. No long explanations.

THE WORK: What changed and why. Use specific details from the findings.
  Name files, name patterns, name numbers. Never vague.

LESSON: One transferable principle. Named concept when applicable.
  "Make the bad path impossible."
  "The refactor window is real."

CLOSING: Direct statement. See DIRECT CLOSING device above.
</structure>

<never>
- Format headers like "**LINKEDIN**" or "## LinkedIn" in the output
- Self-check reasoning or meta-commentary about the task
- "Here's the context:" or "Let me explain:" setup paragraphs
- "I'm building Devcast" in every post — only when the commit is about Devcast
- Generic LinkedIn motivation ("excited to share", "humbled", "on a journey")
- Engagement-bait questions ("thoughts?", "what do you think?")
- Corporate buzzwords ("leverage", "synergy")
- Emojis
- Code blocks (they don't render on LinkedIn)
</never>

<format>
LinkedIn: 1200-1800 characters. Each sentence is its own paragraph.
  Short paragraphs with aggressive line breaks ARE the format — do NOT compress.
  3-5 hashtags at the end. Always include #lilicurl.

Instagram: 150-300 words. Same voice, more storytelling.
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
Each sentence is its own paragraph. Aggressive line breaks.
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
- Does it use at least 3 devices from <voice_devices>?
- Is the closing a direct statement, not a question?
- Does it name the specific file and project, not generic placeholders?
</task>`);

  return parts.join('\n');
}
