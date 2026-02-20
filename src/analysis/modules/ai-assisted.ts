import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';

// Commit message signals
const AI_MESSAGE_PATTERNS = [
  /\bai[- ]assisted\b/i,
  /\bco-pilot\b/i,
  /\bgenerated (by|with)\b/i,
  /\bclaude\b/i,
  /\bgpt\b/i,
  /\bcopilot\b/i,
  /\bprompt(ed|ing)?\b/i,
];

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
  /prompts?\//,
  /\.prompt\.(ts|js|txt|md)$/,
  /ai[_-]?\w*\.(ts|js)$/,
  /llm[_-]?\w*\.(ts|js)$/,
  /embeddings?\.(ts|js)$/,
];

export class AiAssistedModule implements CodeAnalyzer {
  readonly id = 'ai_assisted';
  readonly name = 'AI-Assisted Development Detector';
  readonly category = 'ai_assisted' as const;

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    const hasAiMessage = AI_MESSAGE_PATTERNS.some(p => p.test(ctx.commitMessage));

    const addedText = ctx.diffs.flatMap(d =>
      d.patch.split('\n')
        .filter(l => l.startsWith('+') && !l.startsWith('+++'))
        .map(l => l.slice(1))
    ).join('\n');

    const hasAiSdk = AI_SDK_PATTERNS.some(p => p.test(addedText));

    const aiFiles = ctx.diffs.filter(d =>
      AI_FILE_PATTERNS.some(p => p.test(d.filename))
    );
    const hasAiFiles = aiFiles.length > 0;

    if (!hasAiMessage && !hasAiSdk && !hasAiFiles) return null;

    // Determine what kind of AI integration this is
    if (hasAiSdk) {
      const sdkMatch = AI_SDK_PATTERNS.find(p => p.test(addedText));
      const sdkName = sdkMatch?.source.includes('anthropic') ? 'Claude (Anthropic)'
                    : sdkMatch?.source.includes('openai') ? 'OpenAI'
                    : sdkMatch?.source.includes('langchain') ? 'LangChain'
                    : 'an AI SDK';

      return {
        moduleId: this.id,
        aspect: 'AI SDK integration',
        finding: `Connected ${sdkName} — AI capabilities embedded in the application`,
        technicalDetail: `${sdkName} integration. AI-assisted development, human-AI collaboration. SDK initialized in the diff.`,
        plainLanguage: `The commit adds ${sdkName} as a capability layer in the application. The interesting design decisions are usually not the SDK setup itself — it\'s the prompt structure, token budget, retry strategy, and where AI fits in the overall flow.`,
        interestScore: 8,
      };
    }

    if (hasAiFiles) {
      const fileList = aiFiles.map(f => f.filename).join(', ');
      return {
        moduleId: this.id,
        aspect: 'AI prompt engineering',
        finding: `Added/modified AI prompt files: ${fileList}`,
        technicalDetail: 'Prompt engineering, AI workflow design. Prompt files added or modified in the diff.',
        plainLanguage: 'Prompts are code. This commit adds or refines the instructions that shape how the AI behaves — the structure, constraints, examples, and task framing that turn a general model into a specialized tool.',
        interestScore: 7,
      };
    }

    // hasAiMessage only
    return {
      moduleId: this.id,
      aspect: 'AI-assisted development',
      finding: `Commit message signals AI-assisted development: "${ctx.commitMessage.slice(0, 80)}"`,
      technicalDetail: 'AI-assisted development, human-AI collaboration. Detected from commit message.',
      plainLanguage: 'The developer used AI assistance for this commit. The real story is usually the human judgment involved: what the AI wrote, what the developer changed, and why.',
      interestScore: 6,
    };
  }
}
