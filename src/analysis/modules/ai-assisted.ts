import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';
import { extractRemovedLines, extractFirstHunkSnippet } from '../diff-parser.js';

// AI SDK imports in added lines
const AI_SDK_PATTERNS = [
  /from ['"]@anthropic-ai\/sdk['"]/,
  /from ['"]openai['"]/,
  /from ['"]langchain/,
  /from ['"]@langchain/,
  /from ['"]ollama['"]/,
  /from ['"]@google\/generative-ai['"]/,
];

// AI-specific file patterns
const AI_FILE_PATTERNS = [
  /(?:^|\/)prompts?(?:\/|$)/i,
  /(?:^|\/)[^/]+\.prompt\.(ts|js|txt|md)$/i,
  /(?:^|\/)src\/ai\//i,
  /(?:^|\/)(?:ai|llm|prompt|embedding|embedder|matcher)(?:[_-][^/]+)?\.(ts|js)$/i,
  /(?:^|\/)(?:anthropic|openai|claude|gpt)(?:[_-][^/]+)?\.(ts|js)$/i,
];

const AI_RUNTIME_PATTERNS = [
  /\b(prompt|systemPrompt|userPrompt|embedding|embedder|anthropic|openai|claude|gpt|haiku|sonnet)\b/i,
  /\b(messages\.create|messages\.batches|embeddings\.create|max_tokens|temperature|model)\b/i,
  /<post_draft>|<short_draft>|<voice>|<task>|CONTENT_CLASSIFIER_SYSTEM_PROMPT/,
];

export class AiAssistedModule implements CodeAnalyzer {
  readonly id = 'ai_assisted';
  readonly name = 'AI-Assisted Development Detector';
  readonly category = 'ai_assisted' as const;

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    const addedText = ctx.diffs.flatMap(d =>
      d.patch.split('\n')
        .filter(l => l.startsWith('+') && !l.startsWith('+++'))
        .map(l => l.slice(1))
    ).join('\n');

    const removedText = ctx.diffs.map(d => extractRemovedLines(d.patch)).join('\n');

    const hasAiSdk = AI_SDK_PATTERNS.some(p => p.test(addedText)) && !AI_SDK_PATTERNS.some(p => p.test(removedText));

    const aiFiles = ctx.diffs.filter(d =>
      AI_FILE_PATTERNS.some(p => p.test(d.filename))
      && AI_RUNTIME_PATTERNS.some((pattern) => pattern.test(`${d.filename}\n${d.patch}`))
    );
    const hasAiFiles = aiFiles.length > 0;

    const hasAiBehaviorSignal = hasAiSdk || hasAiFiles;
    if (!hasAiBehaviorSignal) return null;

    // Determine what kind of AI integration this is
    if (hasAiSdk) {
      const sdkMatch = AI_SDK_PATTERNS.find(p => p.test(addedText));
      const sdkName = sdkMatch?.source.includes('anthropic') ? 'Claude (Anthropic)'
                    : sdkMatch?.source.includes('openai') ? 'OpenAI'
                    : sdkMatch?.source.includes('langchain') ? 'LangChain'
                    : 'an AI SDK';

      const sdkDiff = ctx.diffs.find(d => AI_SDK_PATTERNS.some(p => p.test(d.patch)));
      return {
        moduleId: this.id,
        aspect: 'AI SDK integration',
        finding: `Connected ${sdkName} — AI capabilities embedded in the application`,
        technicalDetail: `${sdkName} integration. AI-assisted development, human-AI collaboration. SDK initialized in the diff.`,
        plainLanguage: `The commit adds ${sdkName} as a capability layer in the application. Focus on the engineering decision: where the model sits in the flow, what constraints or retries were added, what cost boundary was introduced, and what the code now enables or prevents.`,
        interestScore: 8,
        contextHint: `${ctx.diffs[0]?.filename ?? 'unknown'} in ${ctx.repo}`,
        evidence: {
          before: sdkDiff ? extractRemovedLines(sdkDiff.patch).slice(0, 300) || undefined : undefined,
          after: sdkDiff ? extractFirstHunkSnippet(sdkDiff.patch) || undefined : undefined,
        },
      };
    }

    if (hasAiFiles) {
      const fileList = aiFiles.map(f => f.filename).join(', ');
      return {
        moduleId: this.id,
        aspect: 'AI system behavior',
        finding: `Changed the instructions or control surface that shape AI behavior: ${fileList}`,
        technicalDetail: 'Prompting and AI workflow design. The diff changes instructions, model-routing code, or constraints that govern how the product behaves.',
        plainLanguage: 'Prompts and control surfaces are part of the product. Write about the behavior that changed: what became configurable, what guardrail was added, what failure mode was reduced, or what output became more reliable. The model is context, not the protagonist.',
        interestScore: 7,
        contextHint: `${aiFiles[0]?.filename ?? 'unknown'} in ${ctx.repo}`,
        evidence: {
          before: aiFiles[0] ? extractRemovedLines(aiFiles[0].patch).slice(0, 300) || undefined : undefined,
          after: aiFiles[0] ? extractFirstHunkSnippet(aiFiles[0].patch) || undefined : undefined,
        },
      };
    }

    return null;
  }
}
