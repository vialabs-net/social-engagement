# Post 007

## Post generado

> Four commits, five days, one recurring theme: the pipeline kept lying, and lilicurl kept making it tell the truth.
> 
> It started with the classifier. LLM outputs are slippery — markdown leaks in, encoding drifts, JSON comes back malformed or in the wrong shape entirely. The fix wasn't to trust the model more, it was to trust it less by design: dual-attempt retry, multi-candidate JSON parsing, cleanup passes before anything downstream touches the result. Defensive engineering, not optimism.
> 
> Then seed extraction got the same treatment. LinkedIn's CDN apparently responds differently depending on which hostname you knock on, so `www.linkedin.com` joined the fallback host list and retry logic with multiple request profiles got wired in. The crawler now negotiates, not assumes.
> 
> Phase 3 is where the architecture got genuinely interesting. The Haiku-based voice extraction got replaced with statistical move measurement and a 4-stage maturity model. Voice isn't something you declare anymore — it's something the system measures, then advances through stages, then samples probabilistically at generation time. A voice dice. Behavioral fidelity treated as a distribution problem rather than a template problem.
> 
> Then the last commit closed the loop on output integrity: hard cap at 1500 characters, length-aware truncation with boundary detection so sentences don't get guillotined mid-thought, and explicit anti-framing prompts injected to keep generated posts from crediting the model as the actor when a human engineer made a decision.
> 
> That last one is worth sitting with. The system now actively resists a bias it could easily reproduce — the tendency to say "AI did this" when a commit just wired up a constraint, a retry, or a measurement. The prompt injection isn't a filter. It's an editorial stance, encoded.
> 
> Five days of closing gaps between what the pipeline produced and what it was supposed to produce. Every fix earned by something that broke first.
> 
> #lilicurl #codingWithHumor

## Commits de origen

### Commit 1: 1773b27
**Message:** feat: tighten post length and reduce ai framing bias

**Diff:**
```diff
--- src/ai/post-generator.ts
diff --git a/src/ai/post-generator.ts b/src/ai/post-generator.ts
index 31982ab..c055c3e 100644
--- a/src/ai/post-generator.ts
+++ b/src/ai/post-generator.ts
@@ -73,7 +73,9 @@ export async function generatePosts(
 
   const rawResponse = await client.complete(systemPrompt, userPrompt);
 
-  const { post, shortPost } = parseResponse(rawResponse);
+  const parsed = parseResponse(rawResponse);
+  const post = enforceMainPostLength(parsed.post, options.voiceProfile.post_length.max);
+  const shortPost = parsed.shortPost;
 
   const topFinding = findings[0]?.finding;
   const topModuleId = findings[0]?.moduleId;
@@ -116,4 +118,68 @@ function parseResponse(raw: string): { post: string; shortPost: string } {
     shortPost: (shortMatch[1] ?? '').trim(),
   };
 }
+
+function enforceMainPostLength(post: string, maxChars: number): string {
+  const normalized = post.trim();
+  if (normalized.length <= maxChars) return normalized;
+
+  const { body, hashtags } = splitTrailingHashtags(normalized);
+  const reservedChars = hashtags ? hashtags.length + 2 : 0;
+  const availableForBody = Math.max(200, maxChars - reservedChars);
+  const trimmedBody = trimToBoundary(body, availableForBody);
+  const next = hashtags ? `${trimmedBody}\n\n${hashtags}` : trimmedBody;
+
+  logger.warn('ai.generate.post_truncated', {
+    original_length: normalized.length,
+    max_chars: maxChars,
+    final_length: next.length,
+  });
+
+  return next.length <= maxChars ? next : trimToBoundary(next, maxChars);
+}
+
+function splitTrailingHashtags(text: string): { body: string; hashtags: string } {
+  const match = text.match(/(?:\n|^)(#[^\s#]+(?:\s+#[^\s#]+)*)\s*$/);
+  if (!match || match.index === undefined) {
+    return { body: text, hashtags: '' };
+  }
+
+  return {
+    body: text.slice(0, match.index).trimEnd(),
+    hashtags: match[1] ?? '',
+  };
+}
+
+function trimToBoundary(text: string, maxChars: number): string {
+  const normalized = text.trim();
+  if (normalized.length <= maxChars) return normalized;
+
+  const minBoundaryIndex = Math.floor(maxChars * 0.6);
+  const boundarySlice = normalized.slice(0, maxChars + 1);
+  const paragraphBoundary = boundarySlice.lastIndexOf('\n\n');
+  if (paragraphBoundary >= minBoundaryIndex) {
+    return boundarySlice.slice(0, paragraphBoundary).trimEnd();
+  }
+
+  const sentenceBoundary = findSentenceBoundary(boundarySlice, minBoundaryIndex);
+  if (sentenceBoundary >= minBoundaryIndex) {
+    return boundarySlice.slice(0, sentenceBoundary).trimEnd();
+  }
+
+  const fallbackIndex = normalized.lastIndexOf(' ', maxChars - 1);
+  const hardLimit = fallbackIndex >= minBoundaryIndex ? fallbackIndex : Math.max(0, maxChars - 1);
+  return `${normalized.slice(0, hardLimit).trimEnd()}…`;
+}
+
+function findSentenceBoundary(text: string, minBoundaryIndex: number): number {
+  for (let idx = text.length - 1; idx >= minBoundaryIndex; idx--) {
+    const char = text[idx];
+    if (char !== '.' && char !== '!' && char !== '?') continue;
+    const next = text[idx + 1];
+    if (next === undefined || /\s/.test(next)) {
+      return idx + 1;
+    }
+  }
+  return -1;
+}
 export type { PromptError } from './anthropic-adapter.js';


--- src/ai/prompt-builder.ts
diff --git a/src/ai/prompt-builder.ts b/src/ai/prompt-builder.ts
index fffa3c3..60a95d3 100644
--- a/src/ai/prompt-builder.ts
+++ b/src/ai/prompt-builder.ts
@@ -100,8 +100,16 @@ export function buildSystemPrompt(
   sections.push(formatHashtagInstructions(voiceProfile));
   sections.push('</hashtags>');
   sections.push('');
+  sections.push('<attribution>');
+  sections.push('Default the agency to the author and the code change.');
+  sections.push('Write about what the code now does, what decision became visible, what constraint changed, or what failure mode was removed.');
+  sections.push('Do not frame AI, Claude, OpenAI, Copilot, or "the model" as the actor or source of credit unless the commit is explicitly about shipping AI behavior as a product capability.');
+  sections.push('Even on AI-related commits, focus on the engineered system: constraints, interfaces, guardrails, cost controls, routing, observability, and operator controls.');
+  sections.push('</attribution>');
+  sections.push('');
   sections.push('<post_length>');
   sections.push(`Target ${voiceProfile.post_length.min}-${voiceProfile.post_length.max} characters for the main post.`);
+  sections.push(`Hard cap: ${voiceProfile.post_length.max} characters, including hashtags and line breaks.`);
   sections.push('</post_length>');
   sections.push('');
   sections.push('<never>');
@@ -201,7 +209,12 @@ export function buildUserPrompt(
   parts.push('<task>');
   parts.push('Write one main post and one short variant.');
   parts.push('Feature the highest-value finding and only keep secondary findings when they sharpen the same story.');
+  parts.push('Lead with the engineering decision or consequence, not the tool used to get there.');
+  parts.push('Describe what changed in the system behavior, control surface, reliability, cost, or operational flexibility.');
   parts.push('Use concrete implementation details. Do not invent files, numbers, or project context.');
+  parts.push('If a finding touches AI, translate that into the human-made constraint, interface, or behavior change. Do not give the model authorship credit for the commit.');
+  parts.push('The main post must stay at or under the configured character cap.');
+  parts.push('Keep the main post under the configured hard cap. If needed, prefer fewer points and cleaner sentences over extra explanation.');
   parts.push('If <voice_exposure> exists, match its level of directness and structure without copying phrases literally.');
   parts.push('');
   parts.push('<post_draft>');


--- src/analysis/modules/ai-assisted.ts
diff --git a/src/analysis/modules/ai-assisted.ts b/src/analysis/modules/ai-assisted.ts
index 987287a..3f7933c 100644
--- a/src/analysis/modules/ai-assisted.ts
+++ b/src/analysis/modules/ai-assisted.ts
@@ -1,16 +1,5 @@
 import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';
 
-// Commit message signals
-const AI_MESSAGE_PATTERNS = [
-  /\bai[- ]assisted\b/i,
-  /\bco-pilot\b/i,
-  /\bgenerated (by|with)\b/i,
-  /\bclaude\b/i,
-  /\bgpt\b/i,
-  /\bcopilot\b/i,
-  /\bprompt(ed|ing)?\b/i,
-];
-
 // AI SDK imports in added lines
 const AI_SDK_PATTERNS = [
   /from ['"]@anthropic-ai\/sdk['"]/,
@@ -23,11 +12,17 @@ const AI_SDK_PATTERNS = [
 
 // AI-specific file patterns
 const AI_FILE_PATTERNS = [
-  /prompts?\//,
-  /\.prompt\.(ts|js|txt|md)$/,
-  /ai[_-]?\w*\.(ts|js)$/,
-  /llm[_-]?\w*\.(ts|js)$/,
-  /embeddings?\.(ts|js)$/,
+  /(?:^|\/)prompts?(?:\/|$)/i,
+  /(?:^|\/)[^/]+\.prompt\.(ts|js|txt|md)$/i,
+  /(?:^|\/)src\/ai\//i,
+  /(?:^|\/)(?:ai|llm|prompt|embedding|embedder|matcher)(?:[_-][^/]+)?\.(ts|js)$/i,
+  /(?:^|\/)(?:anthropic|openai|claude|gpt)(?:[_-][^/]+)?\.(ts|js)$/i,
+];
+
+const AI_RUNTIME_PATTERNS = [
+  /\b(prompt|systemPrompt|userPrompt|embedding|embedder|anthropic|openai|claude|gpt|haiku|sonnet)\b/i,
+  /\b(messages\.create|messages\.batches|embeddings\.create|max_tokens|temperature|model)\b/i,
+  /<post_draft>|<short_draft>|<voice>|<task>|CONTENT_CLASSIFIER_SYSTEM_PROMPT/,
 ];
 
 export class AiAssistedModule implements CodeAnalyzer {
@@ -36,8 +31,6 @@ export class AiAssistedModule implements CodeAnalyzer {
   readonly category = 'ai_assisted' as const;
 
   async analyze(ctx: AnalysisContext): Promise<Finding | null> {
-    const hasAiMessage = AI_MESSAGE_PATTERNS.some(p => p.test(ctx.commitMessage));
-
     const addedText = ctx.diffs.flatMap(d =>
       d.patch.split('\n')
         .filter(l => l.startsWith('+') && !l.startsWith('+++'))
@@ -48,10 +41,12 @@ export class AiAssistedModule implements CodeAnalyzer {
 
     const aiFiles = ctx.diffs.filter(d =>
       AI_FILE_PATTERNS.some(p => p.test(d.filename))
+      && AI_RUNTIME_PATTERNS.some((pattern) => pattern.test(`${d.filename}\n${d.patch}`))
     );
     const hasAiFiles = aiFiles.length > 0;
 
-    if (!hasAiMessage && !hasAiSdk && !hasAiFiles) return null;
+    const hasAiBehaviorSignal = hasAiSdk || hasAiFiles;
+    if (!hasAiBehaviorSignal) return null;
 
     // Determine what kind of AI integration this is
     if (hasAiSdk) {
@@ -66,7 +61,7 @@ export class AiAssistedModule implements CodeAnalyzer {
         aspect: 'AI SDK integration',
         finding: `Connected ${sdkName} — AI capabilities embedded in the application`,
         technicalDetail: `${sdkName} integration. AI-assisted development, human-AI collaboration. SDK initialized in the diff.`,
-        plainLanguage: `The commit adds ${sdkName} as a capability layer in the application. The interesting design decisions are usually not the SDK setup itself — it\'s the prompt structure, token budget, retry strategy, and where AI fits in the overall flow.`,
+        plainLanguage: `The commit adds ${sdkName} as a capability layer in the application. Focus on the engineering decision: where the model sits in the flow, what constraints or retries were added, what cost boundary was introduced, and what the code now enables or prevents.`,
         interestScore: 8,
         contextHint: `${ctx.diffs[0]?.filename ?? 'unknown'} in ${ctx.repo}`,
       };
@@ -76,24 +71,15 @@ export class AiAssistedModule implements CodeAnalyzer {
       const fileList = aiFiles.map(f => f.filename).join(', ');
       return {
         moduleId: this.id,
-        aspect: 'AI prompt engineering',
-        finding: `Added/modified AI prompt files: ${fileList}`,
-        technicalDetail: 'Prompt engineering, AI workflow design. Prompt files added or modified in the diff.',
-        plainLanguage: 'Prompts are code. This commit adds or refines the instructions that shape how the AI behaves — the structure, constraints, examples, and task framing that turn a general model into a specialized tool.',
+        aspect: 'AI system behavior',
+        finding: `Changed the instructions or control surface that shape AI behavior: ${fileList}`,
+        technicalDetail: 'Prompting and AI workflow design. The diff changes instructions, model-routing code, or constraints that govern how the product behaves.',
+        plainLanguage: 'Prompts and control surfaces are part of the product. Write about the behavior that changed: what became configurable, what guardrail was added, what failure mode was reduced, or what output became more reliable. The model is context, not the protagonist.',
         interestScore: 7,
         contextHint: `${aiFiles[0]?.filename ?? 'unknown'} in ${ctx.repo}`,
       };
     }
 
-    // hasAiMessage only
-    return {
-      moduleId: this.id,
-      aspect: 'AI-assisted development',
-      finding: `Commit message signals AI-assisted development: "${ctx.commitMessage.slice(0, 80)}"`,
-      technicalDetail: 'AI-assisted development, human-AI collaboration. Detected from commit message.',
-      plainLanguage: 'The developer used AI assistance for this commit. The real story is usually the human judgment involved: what the AI wrote, what the developer changed, and why.',
-      interestScore: 6,
-      contextHint: `${ctx.diffs[0]?.filename ?? 'unknown'} in ${ctx.repo}`,
-    };
+    return null;
   }
 }


--- src/analysis/modules/devops.ts
diff --git a/src/analysis/modules/devops.ts b/src/analysis/modules/devops.ts
index c539ec5..7b34cbd 100644
--- a/src/analysis/modules/devops.ts
+++ b/src/analysis/modules/devops.ts
@@ -11,6 +11,20 @@ interface DevopsPattern {
 const DEVOPS_FILE_REGEX = /(?:Dockerfile|\.ya?ml$|\.github\/workflows|Makefile|Jenkinsfile|\.gitlab-ci|Helm|Chart\.yaml|values.*\.yaml)/i;
 
 const PATTERNS: readonly DevopsPattern[] = [
+  {
+    name: 'manual workflow override',
+    score: 8,
+    technicalDetail: 'Operator-facing workflow override — GitHub Actions inputs or variables expose a runtime knob so operators can change behavior per run without changing source code.',
+    explanation: 'A manual workflow input turns an internal constant into an operational control. You can run a one-off catch-up, backfill, or safer low-volume execution without branching the code or redeploying a special build.',
+    detect: (lines, filename) => {
+      if (!/(\.github\/workflows|\.ya?ml$)/i.test(filename)) return false;
+      return lines.some((line) =>
+        /\binputs\s*:/.test(line)
+        || /\$\{\{\s*inputs\./.test(line)
+        || /\$\{\{\s*vars\./.test(line),
+      );
+    },
+  },
   {
     name: 'multi-stage Docker build',
     score: 9,


--- src/analysis/modules/dx.ts
diff --git a/src/analysis/modules/dx.ts b/src/analysis/modules/dx.ts
index 39eeba5..e93fe95 100644
--- a/src/analysis/modules/dx.ts
+++ b/src/analysis/modules/dx.ts
@@ -11,6 +11,26 @@ interface DxPattern {
 const CONFIG_FILE_REGEX = /(?:config|settings|options|env)\b/i;
 
 const PATTERNS: readonly DxPattern[] = [
+  {
+    name: 'runtime config override',
+    score: 8,
+    technicalDetail: 'Runtime config override — a hardcoded operational decision is exposed through an environment variable or runtime input with parsing, validation, and a safe default.',
+    explanation: 'Turning a hardcoded limit into a runtime control changes who can steer the system. Operators can tune behavior for one environment or one run without editing code, while the default keeps steady-state behavior predictable.',
+    detect: (lines, filename) => {
+      if (!/\.(ts|js|mjs|cjs|ya?ml)$/i.test(filename)) return false;
+      const joined = lines.join('\n');
+      const hasEnvRead = /\bprocess\.env\[['"][A-Z0-9_]+['"]\]/.test(joined);
+      const hasRuntimeFallback =
+        /\bDEFAULT_[A-Z0-9_]+\b/.test(joined)
+        || /\bNumber\.parseInt\b/.test(joined)
+        || /\bfallback\b/i.test(joined)
+        || /\breturn DEFAULT_[A-Z0-9_]+\b/.test(joined);
+      const hasWorkflowOverride =
+        /(\.github\/workflows|\.ya?ml$)/i.test(filename)
+        && lines.some((line) => /\binputs\s*:/.test(line) || /\$\{\{\s*(inputs|vars)\./.test(line));
+      return (hasEnvRead && hasRuntimeFallback) || hasWorkflowOverride;
+    },
+  },
   {
     name: 'custom error class',
     score: 8,


--- src/config/schema.ts
diff --git a/src/config/schema.ts b/src/config/schema.ts
index ad1f930..6d7848d 100644
--- a/src/config/schema.ts
+++ b/src/config/schema.ts
@@ -56,9 +56,9 @@ export const VoiceProfileSchema = z.object({
   hashtags_mode: HashtagModeSchema.default('prefer'),
   post_length: z.object({
     min: z.number().int().min(300),
-    max: z.number().int().max(3000),
+    max: z.number().int().max(1500),
   }).refine(({ min, max }) => min < max, 'post_length.min must be lower than post_length.max')
-    .default({ min: 1200, max: 1800 }),
+    .default({ min: 1000, max: 1500 }),
   content_strategy: ContentStrategySchema.default({
     audience: 'mixed',
     skip_patterns: [],
@@ -82,7 +82,7 @@ export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
   rhythm: 'mixed',
   hashtags: [],
   hashtags_mode: 'prefer',
-  post_length: { min: 1200, max: 1800 },
+  post_length: { min: 1000, max: 1500 },
   content_strategy: {
     audience: 'mixed',
     skip_patterns: [],


--- src/webhook/handlers/onboard.ts
diff --git a/src/webhook/handlers/onboard.ts b/src/webhook/handlers/onboard.ts
index f9144a4..9c392d4 100644
--- a/src/webhook/handlers/onboard.ts
+++ b/src/webhook/handlers/onboard.ts
@@ -224,11 +224,11 @@ function html(
         <div class="split">
           <div>
             <label>Post length min</label>
-            <input type="number" name="post_length_min" min="300" max="3000" value="${voiceProfile.post_length.min}">
+            <input type="number" name="post_length_min" min="300" max="1500" value="${voiceProfile.post_length.min}">
           </div>
           <div>
             <label>Post length max</label>
-            <input type="number" name="post_length_max" min="300" max="3000" value="${voiceProfile.post_length.max}">
+            <input type="number" name="post_length_max" min="300" max="1500" value="${voiceProfile.post_length.max}">
           </div>
         </div>
       </div>

```

### Commit 2: 5d8845a
**Message:** fix: harden seed extraction for linkedin and uber

**Diff:**
```diff
--- config.example.yaml
diff --git a/config.example.yaml b/config.example.yaml
index f050a21..233a8f4 100644
--- a/config.example.yaml
+++ b/config.example.yaml
@@ -43,6 +43,7 @@ content:
     puppeteer_fallback_hosts:             # optional; can also use CONTENT_PUPPETEER_FALLBACK_HOSTS env var
       - "discord.com"
       - "stripe.com"
+      - "www.linkedin.com"
 
 # Optional: npm packages that extend devcast with custom analysis modules.
 # Each package must export a named `module` implementing CodeAnalyzer (devcast-sdk).


--- seed-articles.json
diff --git a/seed-articles.json b/seed-articles.json
index 229eb38..2ddd115 100644
--- a/seed-articles.json
+++ b/seed-articles.json
@@ -632,5 +632,101 @@
       "dependency_health",
       "security"
     ]
+  },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/search/reimagining-linkedins-search-stack",
+    "title": "Reimagining LinkedIn's search tech stack",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "Co-authors: Jiahao Xu , Xiaojing Ma , Sriram Vasudevan , Muchen Wu , Rachel Zheng , Benjamin Le , Shaobo Zhang , Sarang Metkar , Rupesh Gupta , Qianqi Kay Shen , Ali Hooshmand , David Nicol\u00e1s Racca , Vivek Katarya , Kayhan Behdin , Igor Lapchuk , Xueying Lu , Lingyu(Claire) Zhang , Gokulraj Mohanasundaram , Juan Pablo Bottaro , Lily(Jiayu) Li , Yanbo Li , Guoyao L. , Caleb Johnson , and Sundara Raman Ramachandran At LinkedIn, our mission is to connect professionals to opportunity. Search plays a central role in this by helping members discover jobs, people, and knowledge that move their careers forward. As the professional landscape evolves, we strive to deliver search experiences that feel relevant, intuitive, personalized, and predictive of what truly matters, from applying to the right job to forming the right connection. That\u2019s why we\u2019ve recently introduced AI Job Search and AI-powered People Search , which go beyond keyword matching and better understand member intent. These products reimagine LinkedIn search, using large language models (LLMs) to create a semantic search experience. Instead of relying on exact word overlap between queries and postings, it interprets natural language to infer user goals and preferences. This semantic representation allows for more flexible and accurate retrieval, overcoming vocabulary gaps and aligning search results with how members naturally express their career ambitions. Deploying LLMs at LinkedIn\u2019s scale\u2014serving millions of real-time queries per second\u2014requires innovation that balances quality and efficiency. In this blog, we\u2019ll share how we transformed our overarching search experience at LinkedIn, including the challenges and decisions that went into creating a scalable LLM-based stack and how the technology is powering a smarter, faster, and more personalized experience that helps every member find the most relevant opportunities and connections. Semantic search\u2019s high level infrastructure When a member submits a query in the search bar, a query understanding module processes the input text, creates a query embedding, and performs embedding-based retrieval (EBR) on CUDA-enabled GPUs using exhaustive vector search ( paper on GPU CUDA-based Search , paper on GPU PyTorch-based Search ) to assemble a broad set of candidate documents. The ranking stage then refines these candidates through a Cross-Encoder Small Language Model (SLM) deployed on SGLang, which combines the query, job, and member features to generate relevance and engagement scores for final ranking. To maintain scalability and efficiency, the ranking pipeline integrates several optimization techniques ( paper on efficient LLM inference infrastructure , context compression paper ): score caching, a ranking-depth controller to manage how many candidates progress to deeper ranking, and traffic shaping to balance load during peak times\u2014all designed to enhance latency and result quality. The features and concise job representations consumed by the SLM are produced through a hybrid inference pipeline: a large-scale offline workflow using Spark and Flyte, and a low-latency nearline system using Flink. These embeddings and summaries are stored in distributed storage and retrieved on demand with minimal latency. In the final stage, the auction layer applies budget and pacing strategies to balance user relevance, engagement, and business metrics, ensuring a healthy equilibrium between recall and precision while maximizing member satisfaction. Figure 1 below provides an overview of the system architecture. Figure 1. Overall pipeline of LinkedIn\u2019s semantic search Product policy relevance measurement Measuring relevance quality is essential to delivering a great search experience on LinkedIn. We define product policies that specify how to rate each query\u2013document pair on a five-point scale and use LLM judges to apply these ratings at a massive scale, far beyond what manual evaluation can achieve. These judges are tightly aligned with product managers and engineers through iterative feedback to ensure high agreement. They not only grade tens of millions of query\u2013document pairs daily for relevance measurement but also generate labeled data for training our retrieval and ranking systems, ensuring we optimize search quality according to product policy. Defining product policy and golden product manager grades A strong LLM judge begins with a clear product policy and high-quality product manager \u201cgolden\u201d grades that demonstrate how that policy should be applied. Product managers act as a \u201cSupreme Court,\u201d regularly calibrating to resolve judgment differences and maintain a shared definition of what constitutes a good query\u2013document match. These discussions refine the policy, making it clearer and less subjective. Once product managers reach high agreement (weighted Cohen\u2019s Kappa \u2265 0.8), their labels are considered reliable ground truth. To build a comprehensive golden dataset across diverse user queries, we first categorize queries by attributes (e.g., title\u2013company, name\u2013company, title\u2013skill). Each category is then split into existing user queries and aspirational queries that represent strategic areas we want to excel in. We stratify-sample query\u2013document pairs from each bucket to ensure broad coverage before sending them to product managers for grading. Training the LLM judge Our LLM judge must meet two requirements: high agreement with product managers and the ability to grade tens of millions of query\u2013document pairs daily. To maximize agreement, we collaborate with product managers to prompt-engineer state-of-the-art LLMs, optimizing the weighted Cohen\u2019s Kappa Score on golden data. The prompt encodes product-policy guidelines and few-shot examples to drive consistency. While these large models produce high-quality judgments, they cannot meet our throughput needs. To scale, we distill them into a smaller 8B-parameter evaluator LLM. Through supervised fine-tuning on a diverse dataset spanning all query categories and grades, we maintain only small drops in agreement\u2014verified via the Kappa Score on the golden set\u2014while achieving massive efficiency gains. Continuously measuring quality of search system Once we have our scalable LLM judge, we can finally build continuous relevance measurement of our system. On a regular basis, we build workflows that perform the following steps: Stratify sample or synthesize a diverse set of queries based on the query categories defined earlier Retrieve the documents returned from executing those queries Decorate documents with additional information required for the correct evaluation/judgement Grade the documents returned using our LLM judge Calculate aggregate precision, recall, and NDCG metrics Figure 2. Flow of the evaluation process This workflow serves three primary functions: Continuously monitoring the relevance of the overall system Evaluating experiments involving underlying ranking and retrieval subsystems Distilling student ranking and retrieval models by leveraging evaluation results Search quality modeling Search quality is a fundamental requirement for any search product, and achieving it depends on building the core components of a modern search engine. Below, we describe how we leveraged LLMs to enable query understanding, semantic embedding\u2013based retrieval, and cross-encoder ranking. Embedding-based retrieval Retrieval is the stage of a search system that identifies a broad set of potentially relevant results from a large corpus. Because no search engine can score every document for every query in real time, we need an efficient retrieval layer to narrow the search space before ranking. Our retrieval sits on top of our GPU-enabled embedding-based retrieval (EBR) system. We built the EBR model by fine-tuning an open-source LLM embedding model to encode queries and jobs into dense vectors. We train on millions of real query\u2013job pairs sampled from production logs, with relevance labels provided by an LLM-based judge. Each query includes its natural language text and query-understanding tags (e.g. workplace type or company), and each job is represented by structured metadata (title, company) plus its description. Importantly, this work also demonstrates a practical path for deploying LLM-based components in real production search systems. The semantic search can directly understand human language as queries, enabling much more intuitive search experiences. This has been a particularly inspiring aspect of the project: bringing modern LLM capabilities into a high-scale, real-time application that serves millions of users. EBR relevance modeling To ensure consistency between training and serving, every query is formatted using a lightweight prompt template: Instruct: Given a job search query, retrieve relevant job postings Query: {query} {Optional Aspect eg. Company}: {company} The model uses a dual-tower (bi-encoder) architecture: one encoder maps queries to embeddings and the other maps jobs, projecting them into a shared semantic space. Training is end-to-end: we fine-tune all model parameters using Hugging Face Accelerate (with PyTorch FSDP) across multiple GPUs. We optimize a contrastive InfoNCE loss combined with a margin-based ranking loss. For example, given a query q, a positive job d+ , and negatives {d-k} , we define: where sim(\u00b7, \u00b7) is the dot-product similarity of embeddings and \u03c4 is a temperature parameter. We also enhance training with hard positives and hard negatives mined from LLM-judged data. Hard positives are LLM-labeled relevant jobs that the current EBR model ranks low, and hard negatives are non-relevant jobs that the model ranks high. These examples reveal exactly where the model struggles. We then build targeted positive\u2013negative pairs. A pairwise margin loss is applied to these curated cases to explicitly lift hard positives and suppress hard negatives, improving ranking where it matters most: which encourages sim(q,d+) to exceed sim(q,d-) by a margin \u03b3. The total loss is a weighted sum, e.g.: combining the benefits of contrastive and pairwise ranking. We use multiple evaluation pipelines. First, we leverage production logs for counterfactual evaluation: re-ranking the historical candidate list for each query and computing precision, recall and NDCG against true labels. Second, we run offline KNN simulations: we embed held-out queries and job corpus, retrieve nearest neighbors, and directly measure retrieval metrics on this test set. Finally, we integrate the new model into our online serving stack on a subset of traffic to collect end-to-end metrics. These offline metrics provide quick feedback, and the counterfactual log analysis helps estimate the model\u2019s user impact without a full live experiment. Productionization of retrieval In production, we precompute and store all job embeddings in GPU-backed indexes. At runtime, the incoming query is encoded by the LLM with the prompt aligned with the LLM pre-training to produce its embedding. We then perform an exhaustive k-nearest-neighbor search over the job embedding index using dot-product similarity, returning the top\u2011K jobs. This offline indexing and fast online query encoding makes retrieval extremely efficient, enabling low-latency serving of industry-scale semantic search products. Query understanding At the moment a member enters a query into the search bar\u2014the entry point of semantic search\u2014we apply a unified LLM-based understanding layer that interprets intent and converts free text into structured signals. For both AI Job Search and AI-powered People Search, this layer uses fine-tuned 1.5\u20134B parameter models that meet LinkedIn\u2019s latency requirements while delivering high-precision structured outputs ( paper ). A single model handles intent classification, facet extraction, and profile-aware rewriting, replacing multiple brittle NER and heuristic components. The resulting attributes (e.g., title, company, school, location) feed directly into retrieval and ranking. An intelligent routing layer works alongside this. A lightweight encoder classifies query types at high QPS and performs policy-based safety checks before sending the query down the appropriate path\u2014LLM-powered semantic interpretation for ambiguous inputs or efficient keyword retrieval for precise name and entity lookups. Together, these components provide a consistent, centrally governed semantic interface for People and Job Search, boosting relevance, simplifying the system, and enabling Semantic Search to scale across LinkedIn\u2019s global traffic. Small language model ranking The ranking module of semantic search utilizes a Small Language Model (SLM) to estimate how relevant a user\u2019s search query q is to each retrieved job_i. The SLM follows a decoder-only architecture. For example, for job search we represent the structured attributes of a job \u2014 including its title, company, location, employment type, and remote-work status. Meanwhile people search uses information from the member\u2019s profile including their name, company information, position information, educational information and location. For each query\u2013job pair (q,i), we build a structured prompt defined as Here, the system prefix and suffix contain chat-template tags and explicit instructions guiding the model to determine whether the given job matches the query. When this prompt is passed through the decoder, it produces logits corresponding to the next token. Let logit yes and logit no represent the logits for the tokens \u201cyes\u201d and \u201cno,\u201d respectively. Following prior studies, we compute: which yields probabilities used to rank job items by their relevance to the user\u2019s query. SLM training pipeline for relevance quality Training of the SLM follows a multi-stage process. First, we distill the 7B-parameter teacher model into a compact 0.6B model that can generate graded relevance labels along with rationales. Next, the teacher\u2019s ordinal grades are converted into \u201csoft labels\u201d ( p yes ,p no ), representing probabilistic supervision. We then perform supervised fine-tuning (SFT) to minimize the Kullback\u2013Leibler (KL) divergence between the teacher\u2019s soft targets and the SLM\u2019s predicted probabilities\u2014effectively converting the reasoning-oriented model into a binary relevance classifier: We construct training labels by sampling real query\u2013item pairs from user interaction logs and annotating them using a full-scale Large Language Model (LLM). Each pair is evaluated through a structured prompt of the following format: [CRITERIA]: <matching guidelines> [EXAMPLES]: <reasoning and output format> [QUERY]: <query text> [CANDIDATE]: <item text> Analyze the query\u2013candidate pair and assess how well they align.Provide a single matching score (0, 1, 2, 3, or 4) along with a brief explanation of your reasoning. The LLM\u2019s response includes both a graded relevance score and an accompanying rationale, ensuring that the generated labels are interpretable and consistent with the defined matching criteria. The model is trained on logged pairs query\u2013job pairs for up to five epochs using the prompt structure. Since job descriptions dominate the input and vary substantially in length (median \u2248 900 tokens; maximum > 2300), we truncate them to ensure the total prompt length does not exceed 2048 tokens during both training and inference. For evaluation, we use a holdout dataset labeled by the teacher model. The SLM ranks job candidates based on p yes ,p no , and system performance is measured using Normalized Discounted Cumulative Gain at rank 10 (NDCG@10). Training for multiple objectives We extend the training paradigm to predict both relevance and engagement within the model, we train a smaller cross-encoder language model (the SLM) using multi-teacher, multi-task distillation. The teachers include: The product policy LLM for relevance scoring. Other large models that predict member actions\u2014such as job views, applies, recruiter accepts, or (in people search) view profile, connecting, messaging, or following. For training at scale, we use multiple 1.7B teacher models. To make this feasible, we first distilled our 7B product policy model into a smaller 1.7B version, which serves as a strong but efficient teacher alongside others. During the training process, these teachers run in real time on sampled production query\u2013document pairs, producing soft probability scores that act as supervision targets. The student SLM is trained with KL divergence loss to align its output distribution with the ensemble of teachers. This setup lets us train on real-world data at scale: teacher models provide rich, nuanced probability signals, and the distilled student captures much of their reasoning capacity while remaining lightweight enough to serve millions of queries per second in production. We have multiple steps of distillation to SLM described in Figure 3, and we show the metrics after distillation in Table 1. Figure 3. Multi-teacher distillation of SLM NDCG@10 Apply AUC Click AUC Relevance Teacher 1.7B 0.9484 - - Engagement Teacher 1.7B - 0.8049 0.6772 SLM 0.6B (distilled) 0.9239 0.8007 0.6704 Explainability in search To make LinkedIn\u2019s AI-powered People Search more transparent, we introduced semantic, context-aware snippets that show why a result matches a member\u2019s query. Snippets highlight the most relevant terms and maintain low latency through lazy loading, caching. The approach uses semantic similarity between the query embedding and precomputed phrase embeddings (unigrams/bigrams) from profile text, surfacing the highest-scoring phrases as natural, human-readable snippets. In the offline pipeline, we extract phrases from each profile section (e.g., summary, experience, education), encode them into embeddings in a Venice key-value store . This index is refreshed periodically to capture profile updates, with evaluation workflows ensuring quality and readability. At search time, the snippetting midtier receives the query embedding and candidate profiles, fetches stored phrase embeddings, computes cosine similarity, selects top phrases, and expands them into readable snippets using simple heuristics. The final output is a ranked list of profiles paired with snippets and highlighting metadata. Reasoning To improve transparency in search results, we introduced a lightweight reasoning module that explains how LinkedIn interprets a member\u2019s query. When a query is submitted, the LLM-based understanding model extracts facets, classifies intent, and\u2014using predefined guidelines\u2014produces a concise \u201cthinking state\u201d describing how the query is parsed, along with a brief summary of the types of profiles retrieved. For unsupported or negatively intended queries, the module instead provides a clear explanation of why results may be limited. For example, \u201cberkeley community development specialist msa professional services\u201d becomes \u201cSearching for community development specialist at MSA Professional Services affiliated with Berkeley.\u201d To keep latency low, reasoning outputs are cached in Couchbase and reused for repeated or semantically similar queries. SLM ranking model inference efficiency We employed multiple techniques to improve efficiency of the inference system at LinkedIn including: Model pruning, where we remove Fully Connected Layers and remove whole transformer layers. Context pruning, by summarization or embedding compression ( paper on AI modeling techniques for efficiency of SLM inference ). Model pruning To boost inference throughput, we apply model compression via structured pruning\u2014a technique that removes redundant components to reduce model size and computation with minimal quality loss. Because our models run on GPU infrastructure, we focus on structured pruning, which removes entire neurons, attention heads, or transformer layers so the resulting model can run efficiently on standard GPU kernels. This yields real throughput and latency gains, unlike unstructured pruning, which drops individual weights but often provides no meaningful speedup without specialized hardware. We prune hidden neurons in Multi-layer Perceptron (MLP) blocks and attention heads in self-attention modules, and we remove full transformer layers to study trade-offs between size, efficiency, and performance ( paper ). Pruning MLP neurons shrinks intermediate activations, while pruning layers reduces network depth\u2014both producing lighter, faster models. After pruning, we fine-tune the model to recover any accuracy loss, ensuring efficiency improvements do not compromise quality. Context pruning Item descriptions are long (median ~900 tokens and up to 2,300) making them over 94% of the SLM prompt and causing ~10% of inputs to be truncated at the 2,048-token limit. Removing descriptions severely degrades relevance quality, confirming they carry essential semantic information. To handle this, we use a slightly larger 1.7B LLM to summarize descriptions offline, where item-specific inference can be precomputed and refreshed via streaming updates. Because job descriptions include verbose, often irrelevant details, we train the summarizer with a semantics-preserving loss and a length-aware reward ( paper ). We fine-tune the model using RL to produce concise summaries, balancing (1) reduced input length and (2) preserved model quality. The reward combines: a semantic consistency term, measured via KL divergence between the SLM\u2019s output distributions on summarized vs. raw text, and a length penalty that discourages overly long summaries. The weighting factor w controls the trade-off between brevity and fidelity, enabling summaries that retain meaning while reducing inference cost. Embedding compression Since the computational cost of LLM inference increases quadratically with input length, reducing the number of tokens can greatly decrease overall inference expense. On top of model pruning and summarization, we invented a text\u2013embedding hybrid interaction architecture that condenses each item\u2019s text into a single-token embedding generated by an encoder LLM ( paper ). These embeddings are then merged with other textual signals and passed to a ranker LLM for relevance estimation. Because the item embeddings are precomputed and stored in a nearline cache, the volume of text processed during online inference is significantly reduced, resulting in notable improvements in efficiency. We jointly train the hierarchy of two language models, where one model is producing embedding of the item description and the other model does the ranking of the candidates. On the figure below we show we use two 0.6B models trained jointly. As a result we could replace most of the job description with just a single embedding. We may keep important raw fields with a limited number of text tokens such as title of the job, company name, location or member name in the input. Figure 4. Hierarchy of SLMs trained and served in production Overall modeling quality and throughput In the table below we show how quality and inference throughput changed as we improved the modeling technology. As part of the modeling improvement we introduced multitask learning with over 6 tasks of member actions to the model output predictions including relevance, and, for example, were able to improve Click AUC of the model from 0.61 ( baseline ) to 0.67 for Job Ranking. Setup NDCG@10 Throughput (ITEMS/SEC/GPU) SLM with raw-text 0.9432 290 Pruned SLM and SUMMARIZED TEXT 0.9218 2200 SLM with EMBEDDING COMPRESSION 0.9239 22000 Embedding based retrieval (EBR) baseline 0.838 >1.6B, exhaustive search on GPU Looking ahead We built a modern semantic search system by first establishing an LLM-based quality evaluation framework grounded in product policy. On top of this foundation, we introduced LLM-powered query understanding, semantic retrieval, and ranking models\u2014driving double-digit improvements in search quality and member engagement. Just as importantly, we achieved this while keeping inference costs comparable to traditional RecSys models previously running in production. As we continue refining Semantic Search, our focus remains on empowering every member to discover the right opportunity, connection, or insight\u2014at the right time. Acknowledgements To the more than 100 team members who\u2019ve contributed to AI-powered job search and people search across infrastructure, AI modeling, user experience, and data science: thank you for your creativity, grit, and teamwork. This milestone belongs to all of us.",
+    "quality_score": 8,
+    "modules": [
+      "architecture_patterns",
+      "performance",
+      "ai_assisted"
+    ]
+  },
+  {
+    "url": "https://www.uber.com/blog/from-static-rate-limiting-to-intelligent-load-management/",
+    "title": "How Uber Conquered Database Overload: The Journey from Static Rate-Limiting to Intelligent Load Management",
+    "source_name": "Uber Engineering",
+    "text": "Introduction Uber\u2019s thousands of microservices handle traffic for over 170 million monthly active users: riders, Uber Eats users, drivers, and couriers. At the heart of this infrastructure are Docstore and Schemaless , Uber\u2019s in-house distributed databases built on top of MySQL\u00ae. These databases span thousands of clusters, store tens of petabytes of operational data, and serve tens of millions of requests per second with billions of rows read or updated. They back some of the most latency-sensitive and mission-critical workloads, powering every business vertical at Uber: from rides and deliveries to maps, payments, and beyond. At this scale, even minor overloads aren\u2019t isolated events, they cascade. A brief spike in one part of the system can ripple outward: downstream services time out, retries pile up, and degradation amplifies into broader failure. In a multitenant environment, it\u2019s also critical to ensure fairness and prevent any tenant from hogging all the resources. With workloads varying in traffic shape, latency profiles, and system impact, building effective overload protection is a uniquely challenging problem. The cost of getting overload protection wrong is steep. This blog shares how we built an intelligent load manager that detects overload from multiple signals to keep our databases stable and fair under pressure. Docstore and Schemaless Before diving into the load manager that protects Uber\u2019s databases, let\u2019s walk through their architecture. While Docstore supports transactions with full CRUD operations and Schemaless is optimized for append-only workloads, both share a common architectural foundation. It comprises three primary layers: a stateless query engine, a stateful storage engine, and a control plane. For the scope of this blog, we\u2019ll focus on the query and storage engine layers. Figure 1: Docstore and Schemaless architecture. The stateless query engine is responsible for query planning, request routing, sharding, schema management, authorization, request parsing, and validation. It serves as the routing layer: coordinating and validating client requests before handing them off to the storage layer. The stateful storage engine handles transaction management, connection pooling, consensus, and replication. Data is sharded across multiple partitions, with each partition consisting of one leader and two followers, coordinated via Raft to ensure strong consistency. Each partition is backed by MySQL nodes with locally attached NVMe SSDs, built to support high-throughput, low-latency workloads at scale. Challenges Quota-Based Rate Limiting in the Query Engine Layer Figure 2: Quota-based rate-limiting setup. Initially, we explored a quota based rate-limiting approach within the stateless query engine layer. The concept was simple: assign each read and write request a capacity unit cost based on bytes processed, grant users fixed quotas, and return a 429 when those quotas were exceeded. Since routing nodes were stateless, we stored quota usage in a central Redis\u00ae cache. While conceptually sound, this approach didn\u2019t hold up in production. First, it added unnecessary complexity. Every request required a Redis call, introducing a new point of failure and the overhead of an additional network hop. Further, for the stateless routing layer to accurately shed requests for an overloaded storage partition, it\u2019d need to maintain realtime health and load information for thousands of partitions across the system. This introduced a lot of tracking overhead, undermining the scalability of the architecture. The cost model was also too imprecise. In Docstore and Schemaless, due to the way MySQL handles scanning and filtering, a query that performs a full table scan but returns a single row was assigned the same capacity cost as a query that only reads a single row. This fundamental flaw in our metering meant that lightweight and heavyweight operations were treated the same, making quota enforcement unreliable. Finally, quotas were defined statically, resulting in frequent requests from stakeholders to adjust their quotas, making them ineffective in multitenant environments. Despite its initial promise, this approach failed. But it gave us a crucial insight: overload management must live as close to the storage nodes as possible. That realization became a cornerstone of the final design in the stateful storage layer. Identifying the Right Signal for Overload A core challenge in designing a resilient load manager is choosing a reliable signal for overload. Simple QPS-based rate limiting is too coarse. It fails to account for workload variability, often shedding too late or too early. What can be more effective is concurrency: the number of operations currently in flight. It directly reflects system load, following Little\u2019s Law: Concurrency = Throughput \u00d7 Latency . In stateful systems, it maps closely to resource usage, making it a more dependable indicator. Balancing Resilience and Fairness Balancing resilience and fairness is a core challenge in multitenant systems. During \u200csystem-wide stress, we want to shed traffic by priority, dropping low-priority requests first. But when a single noisy actor hogs resources without triggering global overload, we also need per-tenant rate limiting that works independently of the system load. This dual requirement led us to combine dynamic overload detectors with fairness enforcement mechanisms that operate in parallel. Building the Foundation of a Unified Load Manager Figure 3: Initial load manager setup with CoDel queue. Controlled Delay: Smarter Queuing Under Pressure The load-shedding journey began with CoDel (Controlled Delay), a concept borrowed from networking to combat bufferbloat. Instead of shedding based on queue length, CoDel looks at how long requests wait in the queue: favoring responsiveness over volume. We implemented separate CoDel queues for each operation type: Read queue : for point lookups and light queries Write queue : for insert, update, and upsert operations Slow queue : for long-running and background operations like scans, deletes, or replication Each queue was managed independently, giving us better isolation across workloads. Figure 4: CoDel queue behavior. FIFO queuing wasn\u2019t enough because a pure FIFO queue processes requests in arrival order, which works well when traffic is stable. But under overload, FIFO creates a trap: old requests accumulate, wait too long, and often get abandoned or retried by the client. This results in wasted work. Meanwhile, fresh requests, still relevant and likely to succeed, sit idle at the end of the line. CoDel introduces adaptive LIFO to solve this. Figure 5 shows how it works. Figure 5: CoDel algorithm. Under normal load, the queue behaves as FIFO. Under pressure, it switches to LIFO, favoring newer requests that still have a chance to succeed. This simple shift improves responsiveness by failing fast, shedding stale work, and giving fresh requests priority. Scorecard Engine The Scorecard engine is a rule-based admission control component and a lightweight quota system designed to enforce per-tenant concurrency limits in multitenant environments. While load-shedding protects the system during overload, Scorecard ensures that no single tenant can dominate shared infrastructure, even in normal conditions. The configuration is simple and deterministic. Figure 6: Scorecard rules. The primary benefit of the Scorecard lies in incident containment. It helps pinpoint the source of disruption during outages or traffic spikes. It isolates and caps misbehaving tenants without disrupting others, balances stability during normal load with strict limits under stress, and reduces blast radius during overload events by enforcing boundaries quickly and deterministically. The Scorecard provides predictable fairness and blast radius control, especially when multiple tenants are competing for shared resources. Regulators While Scorecard protects against concurrency-based overuse, it doesn\u2019t cover all the ways a stateful database system can overload. Some forms of skews are subtle. They don\u2019t show up in concurrency saturation, but they can still degrade system performance if left unchecked. For example, a low QPS caller can still overload the system by sending large write payloads. Or, traffic skewed to one partition key can overload a single cluster while others sit idle. To guard against these skewed behaviors, we introduced plug-in regulators: node-local overload detectors that enforce invariants the system mustn\u2019t violate. They rarely trigger during healthy operation, and that\u2019s by design. At the same time, when users accidentally create hotspots or large data ingestions, regulators kick in to prevent cascading failures. We use these regulators: Write bytes regulator: Limits concurrent write volume to prevent I/O saturation Partition key regulator: Throttles traffic targeting hot partition keys Memory regulator: Tracks free process memory and throttles when we\u2019re low on memory Goroutines regulator: Tracks total number of goroutines and throttles when it exceeds threshold What Worked Well By shedding excess requests, our CoDel queues prevented runaway resource exhaustion, which led to improved stability and a higher success rate for accepted requests. This approach was particularly effective at ensuring that core system functionality remained available during overloads. Figure 7: Improved availability. The Scorecard engine successfully isolated misbehaving tenants by enforcing per-tenant concurrency limits. This allowed us to quickly contain disruptions from noisy neighbors without penalizing other users, ensuring that shared resources were used fairly. Limitations While this initial setup laid the foundation for overload protection and fairness, it came with a few limitations. First, CoDel treated all requests equally, dropping low-priority and user-facing traffic alike, leading to a bad customer experience and increased on-call load. CoDel also relied on fixed queue timeouts and static inflight concurrency limits, which can be a low-fidelity solution for a dynamic system, requiring frequent manual tuning and leading to operational toil. The fixed, static wait times in CoDel led to a thundering herd problem. When requests were eventually rejected, they\u2019d all retry at once, triggering repeated cycles of overload and rejection. During these periods, the lack of traffic differentiation meant even high-priority requests were dropped, leading to customer-visible errors and amplifying the blast radius. Ultimately, it kept things from breaking, but lacked the nuance and dynamism required for a high-quality user experience. This highlighted the need for dynamic and priority-aware queues. Evolving the Architecture Cinnamon Replaces CoDel We observed that many overloads stemmed from low-priority, asynchronous jobs: pipelines, aggregators, and internal garbage collection flows. These shouldn\u2019t have the same survivability as ride requests or real-time pricing queries. To address this, we replaced CoDel with Cinnamon , a priority-aware load shedder developed by the Delivery team at Uber. Cinnamon makes smarter shedding decisions by considering request rank, dynamic system state, and the relative importance of workloads. Request rank is derived from the priority attached to the request, and if no explicit priority is present, Cinnamon assigns a default based on the calling service. Priority is defined using a tiering model from tier 0 (t0) for the most critical traffic to tier 5 (t5) for the least. While t0 is reserved for a small subset of critical infrastructure services, t1 represents the most important user facing online traffic, the core workloads we aim to protect during overloads. This system allows Cinnamon to shed lower-priority traffic first during overload. With request priority awareness in place, we simplified the queue structure to just read and write queues. Long-running and background operations were marked with lower priority instead of having a separate queue. Figure 8: Updated load shedder setup with Cinnamon queue. Before Cinnamon, the CoDel queue load shedder was priority-agnostic and shedding during overload was indiscriminate. Figure 9: Priority Agnostic Load shedder setup with CoDel queue. After Cinnamon, the queue load shedder was priority-aware and shedding during overload happened in order of priority. Figure 10: Priority Aware Load shedder setup with Cinnamon queue. Performance and Stability Gains We saw performance and stability gains from the Cinnamon-based design. Requests are ranked, allowing Cinnamon to shed low-priority traffic first, protecting user facing flows. During overloads, critical user-facing requests are better protected with minimal impact. Figure 11: Prioritized shedding in action. Cinnamon also adapts queue timeout thresholds using P90 latency metrics, eliminating the need for manual tuning. Moreover, its Auto Tuner dynamically adjusts inflight limits, represented by the available slots in the blue box in Figure 10, to maximize throughput. It does this by continuously monitoring and reacting to realtime latency and error rate signals, ensuring stable and effective load shedding. Unlike CoDel\u2019s static approach, which aggressively rejects all requests after a fixed wait time, like 5 milliseconds, Cinnamon\u2019s PID-based control allows the system to absorb pressure without overreacting. It dynamically adjusts queue timeouts and inflight limits based on realtime latency and error signals, shedding only when necessary. This prevents a large class of premature shedding that would otherwise lead to unnecessary rejections, retries, and thundering herd effects. The result is smoother recovery, fewer 429s, and more consistent availability without compromising system health. Figure 12: Reduced premature shedding. Areas for Improvement Despite the gains from Cinnamon, some key challenges remained, highlighting the need for a unified platform. The load manager acted based on the local health of the server, tracking signals like inflight concurrency, write bytes, or memory usage. But in distributed systems, overload isn\u2019t always local. A leader node may need to shed traffic because follower nodes are lagging, even if it\u2019s healthy itself. We call this commit index lag. Traditionally, external components using token-bucket-based rate limiters handled such remote shedding decisions. These were easy to build but proved ineffective at scale, introducing split-brain behaviors and globally suboptimal shedding decisions. The initial design was excellent for concurrency-based shedding, but it wasn\u2019t built to be a reusable platform for future overload signals that would inevitably arise from a growing system. These insights led us to the final evolution of our system: transforming Cinnamon from a concurrency only shedder into a truly general purpose overload control engine. By consolidating all signals into a single, modular decision-making loop, we achieved holistic and consistent overload management. The Unified Load Shedding Engine Centralizing Overload Decisions We enhanced Cinnamon to support pluggable external signals like follower commit lags, enabling the system to make globally informed, priority-aware shedding decisions within the same admission control path. This shift unified local and remote overload logic into a single control loop, closing the gaps that previously caused instability. Figure 13: Unified load-shedding engine in Cinnamon. But shedding isn\u2019t always a one-size-fits-all decision and that\u2019s where the load manager architecture shines. Built on a BYOS (Bring Your Own Signal) ethos, it provides a pluggable framework that lets the team embed new overload signals and route them to the right control path. Whether the pressure is systemic or actor-specific, the load manager sheds broadly by priority or precisely by caller, based on the signal. Figure 14: Bring your own signal. The Payoff: Unified Control, Simplified Load Management The shift to a centralized, pluggable architecture made the system more stable and predictable, with real wins. Cinnamon sheds excess requests immediately using a PID controller, avoiding the memory and goroutine buildup caused by token bucket limiters. This led to lower tail latencies and a leaner resource usage profile, even under heavy load. We saw: 80% increase in throughput under overload (QPS average of 5,400 versus 3,000) ~70% reduction in P99 latency (upsert average of 1.0 seconds versus 3.1 seconds) ~93% fewer goroutines during overload (peak 10,000 versus 150,000) ~60% lower heap usage (1 GB max versus 5-6 GB spikes) Figure 15A: (Before) Token bucket latency and resource profile. Figure 15B: (After) Cinnamon latency and resource profile. We also saw smoother, more predictable shedding behavior. Without PID regulation, shedding acts like a hammer: reactive and abrupt. With it, it\u2019s more like a dimmer switch: smooth and stable. The difference is clear when comparing how commit lag stabilizes under a token bucket limiter versus Cinnamon\u2019s PID-based controller. Figure 16A: (Before) Token bucket spiky shedding pattern. Figure 16B: (After) Cinnamon\u2019s stable shedding pattern. Lessons Learned Prioritization is paramount. Effective load-shedding starts with deciding what matters most. Protect critical, user-facing traffic first. Everything else is secondary. Fail fast, don\u2019t block. Rejecting early is almost always better than holding requests in memory until they expire. It reduces wasted work, keeps latencies predictable, prevents OOMs, and makes the system more resilient under stress. PID regulation for stable shedding . Simple, reactive shedding based solely on current error rates often causes instability, overcorrecting too late, and too hard. PID based regulation brings balance by incorporating system history and directional trends, making it a critical tool for smooth, sustained, and resilient overload control. Place control close to the source of truth. The best shedding decisions happen where the state lives. Protection in the layer that has full context, typically the storage layer in stateful systems. Embrace dynamism. Avoid static configurations wherever possible. Your system should be intelligent enough to adapt to different scenarios, based on the context. Invest in visibility and monitoring. Good observability is the foundation for tuning and trust. Track what\u2019s being shed, why it\u2019s being shed, and how each component contributes to system pressure. Simplicity over complexity. This is a meta principle that guides all the other decisions. Conclusion Our journey to a resilient load manager was defined by the unique complexities of a large-scale, stateful, and distributed environment. By unifying disparate components into a single decision-making brain and adopting a Bring Your Own Signal model, we gained the flexibility to handle systemic overloads and localized noisy neighbor issues with precision. The result is a load management system that sheds smarter in a priority-aware manner, keeps tail latencies low, and drastically reduces operational toil. If you like challenges related to distributed systems, databases, storage, and cache, apply for open positions here . Acknowledgments A project of this scope is rarely accomplished alone. Our sincere thanks to Rich Porter, Jesper Nielsen, Piyush Patel, and the engineers from the Storage and Delivery teams for their guidance and collaboration throughout this journey. From design reviews to on-call insights, their contributions were instrumental in building a resilient system that now safeguards some of Uber\u2019s most critical infrastructure. MySQL is a registered trademark of Oracle and/or its affiliates. Other names may be trademarks of their respective owners. Redis is a trademark of Redis Labs Ltd. Any rights therein are reserved to Redis Labs Ltd. Any use herein is for referential purposes only and does not indicate any sponsorship, endorsement or affiliation between Redis and Uber.",
+    "quality_score": 9,
+    "modules": [
+      "error_resilience",
+      "performance",
+      "concurrency"
+    ]
+  },
+  {
+    "url": "https://www.uber.com/blog/how-uber-serves-over-150-million-reads/",
+    "title": "How Uber Serves over 150 Million Reads per Second from Integrated Cache with Stronger Consistency Guarantees",
+    "source_name": "Uber Engineering",
+    "text": "Introduction This is the second blog about the integrated cache infrastructure for Docstore , our online storage at Uber. In the previous blog, we presented CacheFront and outlined its core functionality, design principles, and architecture. In this blog, we share some exciting improvements we\u2019ve implemented since then as we scaled up its footprint by almost 4 times. CacheFront Recap The previous blog has a detailed explanation of the overall Docstore architecture. For this blog, it\u2019s sufficient to remember that CacheFront is implemented in our stateless query engine layer, which communicates with the stateful storage engine nodes to serve all read and write requests. Figure 1: CacheFront read and write paths. Reads The reads are intercepted at the query engine layer to first try fetching the rows from Redis \u2122 . The rows that weren\u2019t found in Redis are fetched directly from the storage engine and subsequently written to the cache to keep the cache warm. The read results are then merged and streamed back to the client. Writes Docstore generally supports two types of updates: Point writes: INSERT, UPDATE, DELETE queries that update a predefined set of rows, specified as the arguments of the DML query itself. Conditional updates: UPDATE or DELETE queries with a WHERE filter clause, where one or more rows can be updated based on the condition in the filter. The writes aren\u2019t intercepted at all, mainly because of the presence of conditional updates. Without knowing which rows are going to change or have changed as a result of running the DML query, we couldn\u2019t know which cache entries require invalidation. Waiting for rows to expire from Redis due to their time-to-live (TTL) value wasn\u2019t good enough. So, we also rely on Flux, our change data capture (CDC) stateless service that, among its other responsibilities, tails MySQL binlogs to see which rows have been updated and asynchronously invalidates or populates the Redis cache, usually within a subsecond delay. When invalidating, instead of deleting from Redis, Flux writes special invalidation markers to replace whatever entries are currently cached. Challenges As the scale of our CacheFront deployment increased, it became clear to us that there was a growing appetite for a higher cache hit rate and stronger consistency guarantees. The eventually consistent nature of using TTL and CDC for cache invalidations became a blocker for adoption in some cases. Additionally, to make caching more effective, engineers were tempted to increase the TTL for extending the lifespan of the rows in the cache. This, in return, resulted in a higher amount of stale/inconsistent values served from cache, and the service owners weren\u2019t happy about it. These challenges were as old as the idea of caching itself. To reiterate from the previous blog: \u201cThere are only two hard things in Computer Science: cache invalidation and naming things.\u201d \u2013 Phil Karlton The recent improvements we\u2019ve made to CacheFront have allowed us to prove Phil wrong\u2014showing that it\u2019s \u200cpossible to achieve both. The rest of this blog describes our journey. Reasons for Inconsistencies In CacheFront the inconsistencies manifest as stale values, where the value served from the cache is outdated. That is, its timestamp is older than the value that could have been read from the underlying database. There are several possible reasons for having stale values: Racing cache fills: In the presence of concurrent reads and writes of the same row, different query engine workers might attempt to cache different values for the row (depending on how these reads and writes interleave in time). This isn\u2019t a problem in CacheFront since we use a Lua script to deduplicate new entries written to Redis with those that are currently cached. Our previous blog explains in more detail how we avoid caching stale values through the use of row timestamps. Cache invalidation delays: Since the Flux tailer is an async process, it has some inherent delay in invalidating or populating the cache. A write to the database with a quick subsequent read served by the cache may return the previously cached value, violating the desired read-own-writes guarantee. Once Flux catches up, it overwrites the stale value and fixes the problem. The inconsistencies might stay longer in \u200ccases when Flux restarts, for example, due to ongoing deployments, rebalancing of workers, or stream reconnections due to storage topology changes. Cache invalidation failures: A Redis node can be temporarily sluggish, unresponsive, or unreachable, causing the invalidation to not go through, despite multiple retries attempted. This leaves the cache inconsistent with the database until the row is finally evicted due to TTL expiration. The higher the TTL, the longer the inconsistency remains and the longer the stale values might be served. Cache refills from followers: If, upon a cache-miss, the cache is refilled by reading the row from a lagging follower node which didn\u2019t yet have the chance to apply all the recent writes from its leader\u2014a stale entry might be cached. CacheFront allows choosing the preferred cache-refill policy, creating a tradeoff: Refilling from the leader node for stronger consistency guarantees, or Refilling from followers, freeing up the leader, resulting in better read load distribution Regardless of the cause, the inconsistencies typically manifest as: Read-own-writes inconsistency: A row that is read, cached, and then overwritten might still return the older stale value on subsequent reads, until it\u2019s either finally invalidated or expired from cache. Read-own-inserts inconsistency: Similarly, when negative caching is enabled (that is, caching the absence of a row in the underlying database), as long as the negative entry is present in cache, the reads would return a \u201cnot-found\u201d result for the row,\u200c possibly breaking assumptions of the service\u2019s business logic. This type of inconsistency is typically more visible to \u200cservice owners. Magnitude of Cache Staleness By now it\u2019s probably obvious that the duration of inconsistencies, which the upstream callers can observe, is always bounded by the value of the TTL expiration that\u2019s being used, and Flux only helps to shorten it. For this reason, the default TTL value we recommend when onboarding to CacheFront is just 5 minutes. Exceptions can be made if there\u2019s a valid justification, and typically we leave this decision to the service owners, since staleness directly affects business. The desired TTL value to use on a cache refill due to a cache-miss can be specified via an optional header when making read requests to Docstore. But there\u2019s a more subtle and probably not widely understood problem underlying the case of cache invalidation failures. Even if the TTL being used is short, it\u2019s still possible to observe a pretty high staleness value, if measured as the delta between the timestamp of the row stored in the database and the timestamp of the row currently cached. In fact, it\u2019s theoretically unbounded \u2026 Why? Imagine a write of some row to the database, which happened a whole one year ago. Then at time T, which is now, a read-modify-write is performed, and since the initial read is a cache miss, the row is read from the database and thereafter cached. But now suppose that when the modified row is written back to the database, the subsequent Flux invalidation just fails to go through. If the same row is read back again within the timespan of [T, T+TTL] \u2013 the one-year-old row will be returned on every read request. If, in an attempt to increase cache hit rate, the TTL used by some service owner was increased to one hour, then we\u2019re at risk of returning a one-year-old value for the entire next hour! Unbounded, indeed. Figure 2: Example of cache staleness magnitude. Changes to Conditional Updates Flow To recap, the main reason the cache couldn\u2019t be invalidated synchronously with the write requests was because of conditional updates\u2014it wasn\u2019t possible to know which rows were updated in the transaction and needed invalidation. Through gradual and continuous improvements to our storage engine layer over the last few years, we modified the writes flow so it could provide us with the actual set of rows that got updated as part of each transaction. Two design principles in particular enabled us to achieve that: First, we made sure all deletes are soft, setting a tombstone on the row. Those tombstoned rows are garbage-collected later by an async deletion job. Second, we switched to using strictly monotonic time for allocating MySQL \u00ae session timestamps (at microseconds precision), making them unique within a storage node and the Raft group it belongs to. Now, with the guarantees that even deleted rows are still internally visible, and that each transaction can be uniquely identified through its session timestamp \u2013 we could select all rows that were updated within this transaction. When rows are updated, we set their update timestamp column to the transaction\u2019s current, unique, and monotonic timestamp. Then, just before issuing a COMMIT, we read back all row keys that were modified within the transaction (including deletes, which are performed by updating a tombstone field rather than deleting the row). This is usually a very lightweight query, since at this point the data is anyways cached in the MySQL storage engine, and we also always maintain an index on the timestamp column for all our tables: Figure 3: Querying the updated rows. This approach enabled us to figure out exactly which rows have changed as part of \u200c conditional updates and return their keys back to the query engine. The example shown above is a slightly over-simplified version of the actual query in use. There\u2019s a bit of additional secret sauce which allows us to combine multiple different types of update and delete queries within the same client-side-driven shard-local transaction, but the general concept is the same. Note that point writes don\u2019t require this kind of logic, since the to-be-updated row keys are anyway known as part of the update query arguments, so we can just return them as is. Improving Cache Invalidation Logic Now that we could tell which rows were changed within each write transaction, we could improve our CacheFront invalidation logic. We intercepted each write API in the query engine layer, registering a callback that is invoked when a request to the storage engine returns. As part of the response to a write request, the storage engine was modified to also return the set of row keys affected by the transaction as well as the associated session timestamp. From this callback, we could now invalidate any previously cached entries in Redis, overwriting them with invalidation markers. In the background, we still kept Flux running, tailing MySQL binlogs and asynchronously doing cache-fills. Having three different ways of populating and/or invalidating the cache\u2014via TTL expirations, from Flux tailer, and now also directly from the write path of the query engine layer\u2014proved to be a superior approach in terms of consistency. Figure 4: CacheFront write path and invalidations. There are few things worth noting about this new invalidation flow. Invalidations can be performed either synchronously or asynchronously. Synchronously means that the cache invalidation is done within the context of the request, before returning the status to the calling client. This adds a bit of extra latency to \u200c write requests, but is better suited for read-own-writes and read-own-inserts flows. Note that if the request succeeded but the corresponding cache invalidation failed, we still return a success status to the client (that is, we don\u2019t fail the write request). Asynchronously means that \u200ccache invalidation requests are queued to run outside the client request context. This avoids the additional extra latency to \u200cwrite requests, but provides slightly weaker consistency guarantees. By also returning the session commit timestamp of the transaction from the storage engine, we could correctly deduplicate between the cache-fill entries and invalidation markers generated by the query engine and Flux tailer, respectively. Additionally, this allowed us to deprecate and completely remove the dedicated API mentioned in the previous blog , which we previously recommended for doing explicit cache invalidations of point writes. Since the invalidation timestamps were artificially generated using the current clock, subsequent cache fills weren\u2019t succeeding, causing more cache misses than expected, up until the invalidation markers expired from the cache. Using the correct row timestamps, generated by the database in the storage engine layer, was paramount to attaining higher cache hit rates. On top of that, automatically invalidating cache on any type of write and without having to do that ever explicitly was a big win usability wise. Finally, it\u2019s worth mentioning that caching is more suitable for read-heavy use cases, where the reads-to-writes ratio is typically 20 or even 100. The extra cache invalidations we introduced were driven by write QPS and hence didn\u2019t significantly increase the overall load, and, wherever needed, we could just easily upscale our query engine layer and/or Redis clusters to absorb the additional overhead. Cache Inspector \u201cYou can\u2019t improve what you can\u2019t measure.\u201d \u2013 Peter Drucker To measure the current cache staleness, quantify improvements, find potential bugs, or allow us to reason about whether the TTL can be further increased, we\u2019ve built a system called Cache Inspector. It\u2019s based on the same CDC pipeline, Flux, which tails the same MySQL binlogs with an induced delay of one minute (to let things stabilize after the writes). Instead of invalidating or populating the cache, the tailer compares the values obtained from the binlog events with those currently stored in the cache. It then exports metrics such as the number of entries inspected, the number of stale entries found, the per-table mismatch rate, histogram of staleness observed, and more. Figure 5: Cache Inspector results for a table using a 24 hour TTL. As can be seen from the image above, the number of stale values detected in a span of week is completely negligible compared to the total number of rows written to or read from the orderability_features_ping table. The new cache invalidation flow provided us with much stronger consistency guarantees, and the addition of Cache Inspector allowed us to measure and compare its efficiency. This, in turn, allowed us to increase the TTL for this table all the way to 24 hours, pushing the cache hit rate above 99.9%! Conclusion As of today, during peak hours, CacheFront is serving more than 150 million rows per second. Through years of continuous improvements, we\u2019ve added many features to CacheFront to make it better and stronger: Adaptive timeouts, negative caching, pipelined-reads\u2014for driving low latencies Sharding, cross region replication, and cache warming\u2014for improving resilience Lua scripts, TTLs, and invalidations through CDC pipeline\u2014for improving consistency Compare-cache mode and Cache Inspector\u2014for observing and measuring staleness Circuit breakers\u2014for dealing with unhealthy nodes Connection rate limiters\u2014for preventing connection storms Compression\u2014for reducing memory footprint, network bandwidth, and CPU utilization With the addition of automatic cache invalidations on writes to strengthen CacheFront\u2019s consistency guarantees\u2014we think we\u2019ve achieved a truly state-of-the-art integrated caching infrastructure at Uber. Figure 6: Total cache reads across all instances. If you like challenges related to distributed systems, databases, storage, and cache, please explore and apply for open positions here . Oracle, Java, MySQL, and NetSuite are registered trademarks of Oracle and/or its affiliates. Other names may be trademarks of their respective owners. Redis is a trademark of Redis Labs Ltd. Any rights therein are reserved to Redis Labs Ltd. Any use herein is for referential purposes only and does not indicate any sponsorship, endorsement or affiliation between Redis and Uber. Stay up to date with the latest from Uber Engineering\u2014follow us on LinkedIn for our newest blog posts and insights.",
+    "quality_score": 9,
+    "modules": [
+      "performance",
+      "architecture_patterns",
+      "error_resilience"
+    ]
+  },
+  {
+    "url": "https://www.uber.com/blog/ureview/",
+    "title": "uReview: Scalable, Trustworthy GenAI for Code Review at Uber",
+    "source_name": "Uber Engineering",
+    "text": "Introduction Code reviews are a core component of software development that help ensure the reliability, consistency, and safety of our codebase across tens of thousands of changes each week. However, as services grow more complex, traditional peer reviews face new challenges. Reviewers are overloaded with the increasing volume of code from AI-assisted code development, and have limited time to identify subtle bugs, security issues, or consistently enforce best practices. These limitations can lead to missed errors, slower feedback loops, and other issues, ultimately resulting in production incidents, wasted resources, and slow release cycles. To address these pain points at scale, we developed uReview, an AI code review platform designed to augment the code review process with a second AI reviewer. At the core of this system is Commenter, a modular, multi-stage GenAI system review system to identify functional bugs, error handling issues, security vulnerabilities, and adherence to internal coding standards. Building on this, Fixer proposes actual code changes in response to comments, whether those comments come from humans or AI. In this blog, we\u2019ll focus on Commenter and refer to it simply as uReview. The main challenge of AI code review is false positives from two sources: LLM hallucinations that generate incorrect comments and issues that are generally valid but not important in that specific scenario (like a performance issue in code that isn\u2019t performance sensitive). A high false\u2011positive rate undermines engineers\u2019 perception of the tool\u2019s accuracy and usefulness\u2014when they encounter many false-positive comments, they start to tune out and ignore them. We delve into how uReview tackles these challenges to achieve its main goals: to raise the signal-to-noise ratio in code reviews, minimize human effort, and provide Uber engineers with timely, high-quality feedback. uReview today analyzes over 90% of the weekly ~65,000 diffs (equivalent of pull requests) landed at Uber. Engineers who interact with the tool mark 75% of its comments as useful, and we see over 65% of its posted comments addressed. Figure 1 shows an example of an incorrect metric bug caught by uReview. Figure 1: Incorrect metric bug caught by uReview. How It Works uReview is a modular, multi-stage GenAI system designed to automate and enhance code reviews across Uber\u2019s engineering platforms. Its prompt-chaining-based architecture breaks down the code-review task into four simpler sub-tasks, and allows each sub-task\u2014comment generation, filtering, validation, and deduplication\u2014to evolve independently. We now discuss each in turn. Figure 2: uReview pipeline. Ingestion and Preprocessing When a developer submits a change on Uber\u2019s code review platform, uReview first determines which files are eligible for automated review. It filters out low-signal targets such as configuration files, generated code, and experimental directories. For the remaining files, the system builds a structured prompt that includes surrounding code context such as nearby functions, class definitions, and import statements. This context helps the language model produce precise and relevant suggestions. Comment Generation by Specialized Assistants uReview uses a pluggable assistant framework, where each assistant focuses on a specific class of issues. This pluggable framework allows each assistant to be developed and evaluated independently, and use customized prompts and context. uReview currently has three assistants in operation, but is\u200c actively expanding the list. The Standard Assistant detects bugs, incorrect exception handling, or logic flaws. The Best Practices Assistant enforces Uber-specific coding conventions by referencing a shared registry of style rules. The AppSec Assistant targets application-level security vulnerabilities. Post-Processing and Quality Filtering The main challenge with GenAI code reviews is that a simple standalone prompt results in many false-positive comments and many low-value true-positive comments that developers don\u2019t address. A key piece for tackling this challenge is robust post-processing and quality filtering. Once comments are generated, uReview runs them through a multi-layered filtering process: A secondary prompt evaluates each comment\u2019s quality and assigns a confidence score. The prompt is customized for each assistant type, and confidence thresholds for pruning are set at a fine-grained level (per assistant, per language, and comment category) based on developer feedback and evaluations. Next, a semantic similarity filter merges overlapping suggestions. Finally, a category classifier tags each comment (for example, correctness:null-check or readability:naming ) and suppresses those from categories with historically low developer value. These filters work together to surface only high-quality, actionable feedback. Comment Delivery and Feedback Collection The system posts validated comments directly on the code review platform, in line with the code. Developers can rate each comment as \u201cUseful\u201d or \u201cNot Useful\u201d and optionally add a note. All comments, along with their associated metadata\u2014including assistant origin, category, confidence score, and developer feedback\u2014are streamed to Apache Hive \u2122 via Apache Kafka \u00ae . This data supports long-term tracking, experimentation, and operational dashboards. For example, files that contain negative comments provide clear benchmark cases that future versions of uReview should avoid reproducing. Moreover, by assigning a predicted category to each comment, comment\u2011category filters can automatically eliminate categories that have historically attracted negative feedback within Uber. Evaluation and Continuous Improvement uReview evaluates its performance through automated and manual methods. It automatically evaluates if a given posted comment has been addressed by re-running uReview five times on the final commit. Because LLM is stochastic, a single rerun might skip a lingering issue or revive one that is already fixed, so we invoke it five times\u2014the minimal count that virtually eliminates missed detections while keeping cost and latency low. A comment is considered addressed if none of the re-runs reproduce a semantically similar comment (with adjustments for cases when code referenced in the comment is deleted). Manually, a curated benchmark of commits with known issues is used to evaluate comment precision, recall , and F1 scores against human-labeled annotations. The advantage of \u200cautomatic feedback is that it runs on thousands of commits in production daily. In contrast, the advantage of the manually curated benchmark set is that it allows us to evaluate and iterate on uReview locally before deploying a new feature. Feedback from both methods informs adjustments to confidence thresholds, prompts, and filtering logic. We aim to maintain a usefulness rate above 75% as the system expands to cover more languages and services. Impact and Evaluation uReview is now deployed across all six of Uber\u2019s monorepos (Go, Java, Android, iOS, Typescript, and Python), and reviews every commit as part of our CI process within a median of 4 minutes. We now briefly discuss its impact in terms of its usefulness rate, time savings, and our evaluation of third-party models and review tools. High Usefulness in Production uReview maintains a sustained usefulness rate above 75% across all deployed generators. In terms of our automated evaluation that checks if each review comment is addressed, we see on average 65% of comments being addressed in the same changeset. This performance significantly exceeds that of human reviewers. Internal audits show that only 51% of human-written comments are considered as bugs by the author and addressed in the same changeset. By focusing on precision and suppressing low-confidence or low-value suggestions, uReview has established itself as a trustworthy tool. Time Savings for Developers Each week, uReview processes over 10,000 commits, excluding configuration files. Internal benchmarks indicate that having a second human reviewer look for the kinds of issues identified by uReview would require 10 minutes per commit. This translates to approximately 1,500 hours saved weekly, equivalent to nearly 39 developer years annually. Further, uReview\u2019s feedback appears minutes after the commit is posted for review, thereby allowing the code author to address these bugs before the commit reaches a human reviewer. Empirical Model Evaluation To identify the optimal configuration for LLM performance, we conducted benchmark tests on a curated suite of commits containing annotated ground-truth issues (that is, a golden comments dataset). The evaluation compares uReview\u2019s identified issues against the ground-truth and computes standard metrics: precision, recall, and F-score. The most effective configuration paired Anthropic \u00ae Claude-4-Sonnet as the primary comment generator with OpenAI \u00ae o4-mini-high as the review grader. This combination achieved the highest F1 score across all tested setups, outperforming OpenAI \u00ae GPT-4.1, O3, and O1, Meta \u00ae Llama-4, and DeepSeek \u00ae R1. Claude\u20114\u2011Sonnet as the comment generator paired with OpenAI \u00ae GPT\u20114.1 as the review grader was the runner-up with 4.5 points below the leading setup. We periodically evaluate newer models using this approach and use the model combination with the highest F1 score. Third-Party Tools There are three main reasons why Uber invests in building an in-house AI code reviewer agent instead of using third-party tools. First, most third-party AI code-review tools require code to be hosted on GitHub \u00ae . Uber currently uses Phabricator \u2122 instead of GitHub as its primary code review platform. This architectural constraint limits our ability to deploy many off-the-shelf AI code review solutions, which are often tightly coupled with GitHub. Secondly, our evaluation of third-party tools on Uber code showed that they suffered from three main issues: many false positives, low-value true positives, and being unable to interact with internal systems at Uber. uReview, in comparison, doesn\u2019t face these issues because of its prioritization of precision, feedback loop, specialization to what works well at Uber, and ability to pull information from internal Uber systems. A third minor point is that given the scale of diffs at Uber (65,000 per month), we see that the AI-related costs of running uReview are an order of magnitude less than what typical third-party tools charge. Lessons Learned Building uReview at Uber offered deep insights into what it takes to create scalable, trustworthy AI tools for engineers. The most important lessons span model behavior, system design, developer experience, and organizational strategy. Precision Is More Valuable than Volume Early in development, we learned that comment quality matters far more than quantity. Developers quickly lose confidence in a tool that generates low-quality or irrelevant suggestions. To preserve trust, we focused on delivering fewer but more useful comments. By automatically rating every comment\u2019s confidence, pruning whole categories that historically add little value, and collapsing near\u2011duplicate remarks into a single concise note, we stripped away noise and surfaced only the insights that matter. This strategy led to stronger engagement and wider adoption. Feedback Must Be Built-in Real-time developer feedback proved essential for tuning the system. We embedded simple rating links into every comment, and our automated evaluation marked which comments were addressed by the final commit. These allowed us to collect feedback at scale, directly from users. By linking feedback to metadata like language, comment category, and assistant variant, we uncovered granular patterns and made targeted improvements, including better prompting, better model selection, and pruning underperforming comment types. Guardrails Are Just as Important as Prompts Even with high-performing models like o4-mini-high and Claude 4 Sonnet, single-shot prompting wasn\u2019t enough. Unfiltered outputs led to hallucinated issues, duplicate suggestions, and inconsistent quality. We introduced multi-stage chained prompts: one step to generate comments, another to grade them, and others to filter or consolidate. This pipeline approach improved reliability. Prompt design helped, but system architecture, and post-processing were even more critical. Developers Don\u2019t Like Readability and Stylistic Comments Developers don\u2019t like certain categories of comments from AI tools. Readability nits, minor logging tweaks, low-impact performance optimizations, and stylistic issues consistently received poor ratings. In contrast, correctness bugs, missing error handling, and coding best-practice violations\u2014especially when paired with examples or links to internal docs\u2014scored well. By focusing on high-signal categories, we increased value while avoiding developer fatigue. Better at Catching Bugs than Assessing System Design uReview today only has access to the code, and not to other artifacts like past PRs, feature flag configurations, database schemas, technical documentation, and so on, because of which it can\u2019t correctly assess overall correctness and review the system design. It\u2019s much better at catching bugs that are evident from analyzing the source code alone. However, we foresee that this may change in the future with MCP servers being built to access these other resources. Trust Grows with Gradual Rollout We introduced uReview in phases, one team or assistant at a time, instrumenting each stage with precision\u2011recall dashboards, comment\u2011address\u2011rate logs, and user\u2011reported false-positive counts. This allowed quick, data\u2011driven iteration and limited the scope of regressions. When early users surfaced issues\u2014such as noisy stylistic suggestions or missed security checks\u2014we A/B\u2011tested candidate fixes, tuned thresholds, and shipped improvements within a day. Early users gave precise feedback that we correlated with the metrics to make objective go/hold decisions for each release. This gradual approach helped us build credibility, adjust based on real\u2011world use, and scale with confidence. AI Reviews in the IDE Versus the Code Review Platform Even though some IDEs (or extensions) offer code reviews, we still want AI reviews on the code review platform (CI time) because we have less control over what the developer does locally. They may not use the AI code-review features or may ignore its warnings. This is analogous to the concept of running build and test at CI time in addition to making build and test available for developers locally. Enforcing Best Practices Using GenAI Versus Linters Traditionally, linters (or static analysis tools) have been used to enforce certain best practices. For simple or syntactic patterns, linters are accurate, reliable, and cheap\u2014we should continue using them. However, some properties are hard to check with linters. For example, the Uber Go style guide recommends using the time library for time-related operations. Here, one needs some semantic code understanding to know that a certain integer variable represents time, and LLMs perform far better in these cases. So, best practices that aren\u2019t checkable by linters are often a great fit for LLMs. What\u2019s Next The product ceiling for AI code review is high and the scope of impact is very large. So looking ahead, we plan to expand support for richer context, cover more review categories like performance and test coverage, and develop reviewer-focused tools to help with code understanding and identifying potential risks. These efforts aim to push AI-assisted review further while keeping engineers firmly in control. Conclusion uReview marks a meaningful shift in Uber\u2019s approach to code quality. It treats automation not as a substitute for human insight, but as a scalable partner that enhances engineering productivity. By pairing LLMs with carefully designed prompt-chaining, multi-stage grading, duplicate suppression, and integrated user feedback, uReview delivers high-quality, actionable review comments at scale. Its modular architecture and evaluation framework allow it to evolve rapidly, while the platform integrates seamlessly into developer workflows. Most importantly, it allows engineers to spend less time on repetitive checks and more time on higher-order tasks like system design and architectural decisions. With a usefulness rate consistently above 75%, thousands of developer hours saved each year, and steady adoption across teams, uReview has proven itself as both a technical solution and a product experience. The project also underscores broader lessons in GenAI deployment: prioritize precision, build trust through transparency, and design systems that invite feedback. Acknowledgments The progress described in this post wouldn\u2019t have been possible without the contributions of engineers across the Development Platform and Michelangelo teams. We\u2019re grateful to the early adopters of uReview, whose feedback and advocacy helped shape the system. Specifically, we\u2019d like to thank Kaia Lang and Uday Kiran Medisetty for championing uReview across our product teams. We\u2019d also like to thank former team members, Stefan Heule, Raajay Viswanathan, and Shrey Tiwari for their contributions to uReview. Anthropic \u00ae is a registered trademark of Anthropic PBC. Apache \u00ae , Apache Hive \u2122 , Apache Kafka \u00ae , HDFS \u2122 , and the star logo are either registered trademarks or trademarks of the Apache Software Foundation in the United States and/or other countries. No endorsement by The Apache Software Foundation is implied by the use of these marks. Cursor \u2122 is a trademark of Anysphere, Inc. GitHub and GitHub Copilot are registered trademarks or trademarks of GitHub, Inc. in the United States and/or other countries. Llama 4 \u00ae and its logos are registered trademarks of Meta \u00ae in the United States and other countries. No endorsement by Meta is implied by the use of these marks. OpenAI \u00ae and its logos are registered trademarks of OpenAI. Stay up to date with the latest from Uber Engineering\u2014follow us on LinkedIn for our newest blog posts and insights.",
+    "quality_score": 9,
+    "modules": [
+      "ai_assisted",
+      "security",
+      "testing"
+    ]
+  },
+  {
+    "url": "https://www.uber.com/blog/perfinsights/",
+    "title": "PerfInsights: Detecting Performance Optimization Opportunities in Go Code using Generative AI",
+    "source_name": "Uber Engineering",
+    "text": "Introduction At Uber, back-end service efficiency directly influences operational costs and user experience. In March 2024 alone, the top 10 Go services accounted for more than multi-million dollars in compute spend alone \u2014an unsustainable amount that underscored the need for systematic performance tuning. Traditionally, optimizing Go services has required deep expertise and significant manual effort. Profiling, benchmarking, and analyzing code could take days or even weeks. Performance tuning is prohibitively expensive and non-trivial for most teams. PerfInsights was born as an Uber Hackdayz 2024 finalist and has since evolved into a production-ready system that automatically detects performance antipatterns in Go services. It uses runtime CPU and memory profiles with GenAI-powered static analysis to pinpoint expensive hotpath functions and recommend optimizations. The results have been transformative. Tasks that once required days now take hours. Engineers can now deliver high-impact performance improvements without needing specialized knowledge of compilers or runtimes. What distinguishes PerfInsights is its emphasis on precision and developer trust. Beyond identifying optimization opportunities, PerfInsights validates them using large language model (LLM) juries to reduce hallucinations and increase confidence in its suggestions. With hundreds of diffs already generated and merged into Uber\u2019s Go monorepo, PerfInsights has turned optimization from a specialist endeavor into a scalable, repeatable practice. How It Works PerfInsights\u2019 optimization pipeline consists of two main stages: profiling-based function filtering and GenAI-driven antipattern detection. Together, these components surface high-impact optimization opportunities with minimal developer effort. Figure 1: Stages in PerfInsights\u2019 Optimization Pipeline Filtering Hotpath Functions PerfInsights leverages CPU and memory profiles from production services using Uber\u2019s daily fleet-wide profiler during peak traffic periods. For each service, it identifies the top 30 most expensive functions based on flat CPU usage. This is based on the observation that the top 30 most expensive functions account for the majority of CPU usage. Additionally, if runtime.mallocgc \u2014the Go runtime\u2019s memory allocation function\u2014accounts for more than 15% of CPU time, which means the runtime is spending a lot of time allocating memory, so PerfInsights also analyzes memory profiles to uncover potential allocation inefficiencies. To focus the analysis, PerfInsights applies a static filter that excludes open-source dependencies and internal runtime functions. This step trims noise from the candidate set, ensuring \u200cdownstream analysis focuses only on service-owned code that\u2019s most likely to benefit from optimization. Detecting Antipatterns with GenAI At the core of PerfInsights\u2019 detection engine is a curated catalog of performance antipatterns, informed by the Go Foundations team\u2019s past optimization work. These patterns reflect the most common sources of inefficiency encountered across Uber\u2019s Go services and align closely with best practices from Uber\u2019s Go style guide. They include issues such as unbounded memory allocations, redundant loop computations, and inefficient string operations. PerfInsights applies a two-stage detection process. Once hotpath functions are identified, PerfInsights passes their full source codes and a list of antipatterns to a large language model (LLM) for analysis. By combining profiling context with pattern awareness, the model can pinpoint inefficient constructs with high precision. For example, if a function appends to a slice without preallocating capacity, the LLM flags the behavior and recommends a more performant alternative. To boost confidence in its findings, PerfInsights layers two forms of validation: LLM juries and LLMCheck. LLMCheck is a framework designed to catch false positives by running through several domain-specific rule-based validators. LLMCheck also logs metrics on detection accuracy, tracking failure rates and signaling potential model drift. This dual-validation strategy has dramatically improved precision, reducing false positives from over 80% to the low teens. Antipattern and Detection Strategy In our initial attempts, a single-shot LLM-based antipattern detection produced inconsistent and unreliable results\u2014responses varied between runs, included hallucinations, and often generated non-runnable code. To address this, we first improved reliability by scoring only based on detected antipatterns. We then introduced several targeted prompt strategies to enhance accuracy. Few-Shot Prompting Few-shot prompting involves including a handful of illustrative examples in the prompt, enabling the GenAI model to generalize more effectively to new or less familiar cases and deliver more accurate results. Here\u2019s an example of prompt tuning to fix inaccuracy in detection: Antipattern : Use strings.EqualFold(a,b) over strings.ToLower(a)== string.ToLower(b) for more efficient for case-insensitive comparison. Issue : No case-insensitive string comparison was present in the code but was detected. Fix : Add few-shot prompting. Old prompt: Figure 2: The old prompt. New prompt with few-shot examples: Figure 3: The new prompt with some few-shot examples. Tailoring the Model\u2019s Role and Audience Specifying the audience and the model as Go experts helps the LLM focus its responses on advanced, relevant details, making its answers more accurate and appropriate for expert-level users. Ensuring Output Quality Another prompt strategy is asking the model to test its results for reliability and ensure the antipattern suggested fixes are runnable. Figure 4: Prompt section for Ensuring fixes are Runnable. Writing Clear and Focused Prompts These prompt writing tactics make the LLM understand instructions correctly, avoid confusion, and preserve context: Use very specific, positive instructions for improved reliability (avoid using \u201cdon\u2019t\u201d in instructions) Use one prompt per antipattern to conserve context and break down complex tasks into simpler ones Separate prompts for detection and validation Incentivize and penalize the model for correct/incorrect answers, respectively Confidence Scores Asking for confidence levels in the LLM\u2019s response for each prompt makes the model think more. Figure 5: Example of asking for confidence levels in the LLM\u2019s response. Validation of LLM Responses A core strength of PerfInsights lies in its robust validation pipeline, which includes two complementary systems: LLM juries and LLMCheck. Together, they dramatically reduce false positives and increase trust in the system\u2019s optimization suggestions. LLM Juries Rather than trusting a single model\u2019s judgment, PerfInsights leverages a jury of large language models to validate each detected antipattern. These models independently assess whether an antipattern is present and whether the suggested optimization is valid. This ensemble approach mitigates common hallucinations such as incorrectly detecting loop invariants or misinterpreting control structures. LLM Checker Even with LLM juries, LLM may still hallucinate, such as: Detecting antipatterns that don\u2019t exist Confusing maps with slices and vice versa Loop Invariant detected, but the variable is outside of the loop Identifying loop variables in the for statements as loop invariants PerfInsights employs a second layer of verification via LLMCheck by running through several domain-specific rule-based validators to evaluate LLM responses. There are several benefits: Non-generic: Evaluates highly specific, conditional projects. Extendable: Adds validators for various LLM-based projects. Standardized metrics: Tracks reductions in LLM response errors during prompt tuning. For example, ensuring that an identified loop invariant isn\u2019t mistakenly located outside the loop. The final output includes a confidence score of the function\u2019s optimisability and suggested improvements. These insights are fed into downstream tools for code transformation or manual review by developers. As a result, PerfInsights transforms static profiling data into actionable engineering outcomes within minutes. Impact and Results Since its launch, PerfInsights has transformed performance improvements at Uber. By reducing detection time from days to hours and removing the need for deep language expertise, PerfInsights has accelerated engineering velocity and driven scalable compute cost reductions across our Go services. PerfInsights seamlessly integrates with automated downstream tasks, with validated suggestions flowing directly into Optix, Uber\u2019s continuous code optimization tool. This has already produced hundreds of merged diffs, measurably improving performance and generating meaningful cost savings. Further, PerfInsights\u2019 power lies in its language-agnostic design, allowing it to read, understand, and optimize functions across various programming languages. Boosting Code Health Our static analysis tool has proven highly effective in improving code quality, with its findings validated through LLMCheck. In February, we averaged 265 validated detections, reaching a single-day high of 500. By June, the figure had dropped to 176\u2014a 33.5% reduction in just four months. Fewer antipatterns mean a cleaner codebase, shorter review cycles, and faster, safer releases. We will keep refining both the scanner and LLMCheck to drive this number even lower and sustain our commitment to exceptional code quality. Engineering Effort Saved Our performance\u2011analysis tool turns what used to be months of niche, manual diagnostics into hours of automated insight, freeing engineers to build rather than troubleshoot. Previously, uncovering performance antipatterns demanded immense, specialized effort. For instance: 5 critical antipatterns once required two engineers (including a Principal Engineer) for a full month (\u223c320 hours). 11 unique antipatterns consumed a four-person Go expert team for a full week (\u223c160 hours). A dedicated Go expert spent six months full-time on related optimization projects (\u223c960 hours). These manual efforts alone represent over 1,400 hours for just a handful of cases. Over four months, the number of antipatterns reduced from 265 to 176, a sustained reduction of 89 antipatterns. Projecting this annually, that\u2019s a reduction of 267 antipatterns. Addressing this volume manually, as the Go expert team would have consumed approximately 3,800 hours . By using our streamlined tool, we reduced the engineering time required to detect and fix an issue from 14.5 hours to almost 1 hour of tool runtime\u2014a 93.10% time savings.The impact goes beyond dollars saved. PerfInsights has also elevated engineering rigor. Dashboards powered by LLMCheck provide teams with visibility into detection accuracy, error patterns, and antipattern frequency. This transparency has helped cut hallucination rates by more than 80%, boosting trust in AI-assisted tooling. Most importantly, PerfInsights has redefined performance tuning as a continuous, data-driven discipline. Its integration into CI/CD pipelines and day-to-day developer workflows means optimization opportunities are surfaced regularly, not just when something breaks. What was once an expert-led, reactive task is now a proactive loop embedded across Uber\u2019s engineering life cycle. Lessons Learned Building PerfInsights into a production-ready system wasn\u2019t just a technical challenge\u2014it was a lesson in integrating GenAI tooling into a complex, high-scale engineering ecosystem. What worked wasn\u2019t just novel modeling techniques, but a relentless focus on developer experience, reliability, and iteration speed. Prompt Engineering and Model Selection Matter Early iterations suffered from noisy, inconsistent outputs. The Go Foundations team learned quickly that high input token limits were critical for passing large Go functions without truncation. More importantly, small adjustments in prompt phrasing and contextual cues dramatically influenced accuracy. By encoding explicit antipattern definitions and Go-specific idioms into the prompts, we improved detection precision and reduced false positives by 80%. Static Filtering Is the Unsung Hero Before any GenAI magic happens, PerfInsights performs aggressive static filtering using CPU and allocation profiles. By isolating just the top 30 flat% functions within service boundaries\u2014and ignoring OSS or non-relevant runtime functions\u2014we constrained the search space. This pre-processing transformed what could have been a brittle AI prototype into a focused optimization assistant that works effectively across services without overwhelming developers with noise. Validation Pipelines Build Trust To move beyond demos, we needed to give developers confidence in PerfInsights\u2019 recommendations. With LLMCheck dashboards tracking detection accuracy, false positive reasons, and model regressions, we could quantify improvement and respond to feedback with evidence. As a result, PerfInsights became not just usable, but dependable. Developers Respond to Clear Wins Landing the first 5 digits saving diff was a breakthrough moment. Engineers saw that this wasn\u2019t theoretical\u2014it worked! That early success helped unlock adoption, feedback loops, and ultimately made PerfInsights a part of the engineering toolkit. Conclusion PerfInsights marks a turning point in how we approach performance engineering at Uber\u2014from slow, expert-led investigations to scalable, GenAI-assisted optimization. By fusing real-world production data with targeted static analysis and validated LLM workflows, we\u2019ve built a system that delivers meaningful performance wins quickly and reliably. This shift has already paid dividends: freeing up developer time, lowering compute costs, and expanding access to performance best practices across teams. Tools like PerfInsights show the power of applying GenAI with precision, domain knowledge, and a bias for automation. These aren\u2019t just theoretical benefits\u2014they\u2019re actively improving our systems and driving measurable impact today. Cover Photo Attribution: gopher logo by @egonelbre is licensed under CC0 . Stay up to date with the latest from Uber Engineering\u2014follow us on LinkedIn for our newest blog posts and insights.",
+    "quality_score": 9,
+    "modules": [
+      "go_patterns",
+      "performance",
+      "ai_assisted"
+    ]
+  },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/infrastructure/how-design-patterns-power-linkedin-infrastructure",
+    "title": "Navigating the scale: how design patterns power LinkedIn's infrastructure",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "Managing a massive fleet of servers across our private data centers at LinkedIn is no small feat. The immense scale demands infrastructure solutions that not only expand capacity but also ensure performance, reliability, and efficiency as we grow. Building for scale involves creating systems that can handle increased loads, adapt to changing demands, and operate seamlessly. Design patterns are critical in this process. They provide reusable solutions to common architectural challenges, helping us structure components and manage interactions effectively. However, with numerous patterns to choose from, finding the right one for specific contexts can be complex. The time that goes into building proofs of concept, along with additional weeks of work for scalability testing to ensure these solutions are built for scale, can hinder time to market. Conversely, moving forward with an uncertain solution, only to realize it won't scale, can be very frustrating. Two common domain requirements for our infrastructure offerings are: Communicating with the entire fleet of hundreds of thousands of servers in our data centers. Processing data in near real-time. We\u2019ve found the Producer-Consumer pattern to be exceptionally effective in reaching these goals. This pattern has been successfully implemented in several of our core infrastructure systems, including the distributed server query system, server console monitoring, and network security monitoring. In this process, we have identified and built general solutions that are repeatable in similar environments, greatly improving engineering efficiency by leveraging proven methodologies. In this blog, we'll explore how we\u2019ve adapted the Producer-Consumer pattern for these systems, the design choices and trade-offs involved, and the insights gained from scaling our infrastructure. Join us as we delve into how this pattern has helped us tackle the complexities of building infrastructure at scale. The Producer-Consumer pattern Figure 1. Producer-Consumer design pattern In this pattern, the producer and consumer applications communicate asynchronously by using message queues. As the producers and consumers are decoupled this architecture allows us to scale them independently. There are three main concepts that drive the implementation details of the producer-consumer pattern: Queue, used for buffering the messages Workers, to produce and consume the messages Locking mechanism to provide concurrency control, if any Let us now look at the various implementations of this design pattern in building three of our large-scale distributed systems namely the distributed server query system, server console monitoring, and network security monitoring. Note: We\u2019ve implemented these distributed systems in Python, as such any references to programming language constructs will be concerning Python. Distributed server query system The first system we\u2019ll discuss is LinkedIn's next-generation distributed server query system that collects the system facts from across the server fleet and enables distributed querying. The requirements that drove the choice of technology for queues, workers, and locking mechanisms are the need for: processing TBs of data from hundreds of thousands of servers in near real-time data refresh intervals several times every hour maintenance of the last known good snapshot of system facts with defined retention period High-level architecture Figure 2. Architecture of backend server implementing the producer-consumer pattern with web workers as producer, redis as queue, and app workers as consumer We will now discuss the selection of queues, workers, and locks based on the product requirements. We considered only the features that are critically relevant to support the architectural characteristics in question while evaluating these options. The green tick marks our pick. Queue Workers Locking mechanism One of the tasks performed by the backend servers is to periodically mark the stale entries in the database as expired and further purge any expired entries that have breached the retention period. Since this involves updating and deleting entries in the database table, it needs to be run from a single backend server at any point in time and as a result requires a distributed locking mechanism for concurrency control. Impact The distributed server query system was originally designed for near real-time use cases. However, its scope later expanded to encompass analytical use cases that required access to historical data. Thanks to the system's extensible architecture, supporting this new data flow was straightforward. We established a dedicated cluster , complete with new actors to handle the additional data flow, all without impacting the existing near real-time use cases. Server console monitoring The second system is LinkedIn's distributed system to monitor the server console (a.k.a service processor) for their availability and accessibility from anywhere in the data centers. This system performs a series of out-of-band checks against the management console. The checks are performed sequentially and conditionally based on the result of the previous check by message passing. As a result, message durability and persistence become important for efficient processing. High-level architecture Figure 3. Architecture of satellite server implementing producer-consumer pattern Queue Workers Impact Since the checks are implemented as independent units of work, functioning as actors that communicate through message passing, this architecture enables the seamless extension of the system with any number of checks without encountering scaling issues. Additionally, because the checks are conditional, the system can short-circuit processing to avoid unnecessary computations, significantly enhancing both efficiency and performance. Network security monitoring Finally, our network security monitoring system aims to detect and remediate cross-security domain access policy violations on the servers. This is done by constantly performing port scans across all combinations of security domains within fixed SLAs for both IPv4 and IPv6 stacks. Given the criticality of protecting the servers from network security violations, scanning the sheer number of routes within fixed SLA, and the organic growth of the data centers, the system needs to be highly concurrent and scalable. High-level architecture Figure 4. Architecture of network security monitoring system implementing producer-consumer pattern with web workers as producer, in-built queue, and background workers as consumer Queue Workers Impact The beauty of this system lies in its straightforward architecture. Scaling it to accommodate any number of scan routes and servers is simply a matter of horizontally expanding both the scanner and backend applications. Key Takeaways Keep it simple. As seen in the network security monitoring, the task of persisting scan results to the database is I/O bound and as such we had two options for the choice of worker implementation namely Multithreading and AsyncIO. We went ahead with Multithreading as the native queue implementation is thread-safe and is simpler to debug compared to AsyncIO code. Don't repeat yourself. For instance, the choice of worker implementation is the same for both distributed server query system and server console monitoring. As a result, we have abstracted out the worker manager implementation into a general purpose library that is used to power the backend of both the systems. Avoid complicating things. In the distributed server query system, there is a need for a distributed locking mechanism to control the execution of updating and deleting database table rows from a single node at any given point in time. The technologies that come to mind are ZooKeeper, Consul, etcd, etc. However, this advantage comes at the cost of additional operational overhead of maintaining them. Therefore, we decided to use the vendor provided advisory lock of the database that was already in use by the system. Think beyond obvious technology choices. At LinkedIn, Kafka is extensively used for various use cases including message queues. However, it is not suited for IPC and short lived messages especially in latency sensitive applications as it introduces additional network hops as seen in network security monitoring. Acknowledgement I extend my heartfelt thanks to Derrick Joseph , Abhijeet Pandey , and Kumar Tej Gedala for their invaluable contributions to the development of the large-scale distributed systems mentioned above. Their dedication and expertise have been instrumental in our achievements. I would also like to express sincere gratitude to our management team, Nisheed Meethal and Deepu K , for their unwavering support and encouragement throughout the project. Their leadership has been crucial in ensuring the successful and timely completion of these initiatives.",
+    "quality_score": 9,
+    "modules": [
+      "design_patterns",
+      "concurrency",
+      "python_patterns"
+    ]
+  },
+  {
+    "url": "https://www.uber.com/blog/automating-efficiency-of-go-programs-with-pgo/",
+    "title": "Automating Efficiency of Go programs with Profile-Guided Optimizations",
+    "source_name": "Uber Engineering",
+    "text": "Introduction Profile-guided optimization improves the performance of compiled code by using runtime profiling data to inform compiler optimizations. This technique, recently integrated into Go, improves traditional optimizations such as function inlining, basic block and function reordering, register allocation, and more. At Uber, we\u2019ve implemented PGO (profile-guided optimization) in a continuous optimization framework that includes daily profile collection, service-specific enrollment, CI testing, deployment, and performance monitoring. We addressed initial challenges related to increased build times by introducing a profile preprocessing tool, which significantly reduced compilation times. While measuring the impact at a fleet-wide level is difficult, we conducted performance benchmarks and real-world service evaluations at Uber. The results showed efficiency gains and reduced resource utilization for some specific services, validating the effectiveness of PGO-driven optimizations. Support for PGO in Golang was introduced in v1.20 and later improved in later versions through our fruitful collaboration with Google \u00ae . This blog describes our experience building core components of PGO and deploying it at Uber. Background Profile-guided optimization uses the profile collected during a representative run to generate better code. At a high level, it can be divided into the following phases: profiling, analysis, and recompilation. Multiple languages already support PGO, including C/C++, Rust, Java, and Swift. However, this support was lacking for Golang, which led us to build this functionality in collaboration with Google. Many compiler optimizations, such as inlining, register allocation, and instruction scheduling often use statically inferred estimates related to caller-callee frequencies, basic-block frequencies, and branch probabilities to guide optimization. The static estimation of these metrics may lead to suboptimal code generated by the compiler. These optimizations can easily benefit from dynamic information collected by profiling an application. Traditionally, a PGO-based compilation begins with an instrumentation phase to generate an instrumented version of the application. Next, the instrumented program runs with training data to collect the profile (that is, edge profiles ). These profiles are later fed to the compiler and the application is recompiled to produce an optimized binary. During this process, the compiler updates and propagates profile information, including feeding them to compiler passes to optimize hot/code paths. Modern compilers such as LLVM have incorporated PGO and reported speed-ups of around 20%. Since the instrumented execution of an application incurs significant overhead, recent work has shown little or no performance loss by collecting execution profiles via sampling, leveraging tools like hardware performance counter and pprof . Go binaries are often large as they\u2019re statically linked and include all dependent packages and runtimes. For such large binaries, misses in the instruction cache and TLB can cause stalled cycles in the CPU\u2019s front end leading to performance degradation. Profile-guided code-layout optimization is known to alleviate this problem. Recent work including Meta \u00ae BOLT and Google \u00ae Propeller have shown more than 10% performance improvements by optimizing code locality in data center workloads. Code-layout optimization improves code locality and comprises basic-block layout, function splitting, and function reordering optimizations. To reap maximum performance benefits, these optimizations are typically performed during or post link-time using profiling information. Overview of PGO: Continuous Optimization Framework Figure 1: PGO in a continuous optimization framework. Let\u2019s review the timeline of key PGO features: PGO-driven inlining was introduced in version 1.20 In version 1.21, PGO-driven devirtualization was added, further optimizing execution efficiency A profile pre-processing tool was released in version 1.23 to drastically improve build times The PGO framework at Uber is a continuous optimization process. Profiles are collected and used during the GoPGO compilation process. Optimized executables are then deployed in production, with pre-processing steps included to improve build times. Enabling PGO in our build and deployment process involves several steps: We collect performance profiles daily to ensure we have up-to-date data for guiding optimizations. We maintain a configuration system to enroll specific services for Go PGO, ensuring that only selected services undergo these optimizations. We perform CI tests for the PGO SDK to validate the changes and ensure they don\u2019t introduce any stability issues. Once the tests pass, we deploy the PGO-built services into our production environment. Finally, we monitor the performance dashboard to track the impact of PGO on our services. By following these steps, we systematically integrate PGO into our build and deployment pipeline, enhancing the performance and efficiency of our services. \u200b\u200bInlining Function inlining is one of the most common optimizations that benefits from PGO. PGO inlining is a compiler technique that uses runtime profiling data to optimize function inlining decisions. The first step is collecting profiling data during program execution to identify frequently executed (hot) functions. Then, the compiler uses this data to selectively inline these hot functions, reducing function call overhead. This approach leads to more efficient code, unlike traditional static inlining heuristics, which don\u2019t account for actual runtime behavior. Profile Collection Figure 2: Profiling infrastructure for PGO. Our profiling infrastructure is designed to work seamlessly within a distributed system in production. We collect continuous profiling data from multiple instances and merge these profiles to create a representative profile. \u200b\u200b Preprocessing After deploying PGO in our production environment, we observed a significant increase in build times across multiple services, with some experiencing delays of up to 8 times. This increase posed challenges for developers and service owners, making it crucial to address the issue promptly. Figure 3: Timing breakdown for PGO compilation passes. To identify the root cause of the compilation time degradation, we analyzed the compiler\u2019s performance and found that pprof data parsing accounted for a significant portion\u2014up to 95%\u2014of the total compilation time when the PGO flow was enabled. Additionally, the repeated reading and parsing of the pprof file for each package compilation contributed significantly to the cumulative overhead. To mitigate the slow compilation, we proposed an offline tool to preprocess the profile. The PGO preprocessor tool involves extracting runtime profiling data, generating and caching intermediate call graphs, and using call graph information for further analysis and optimization during the compilation process in Go compiler. The tool is already up-streamed and approved into the community open-source version. Here are the basic steps involved in the PGO preprocessor in the Go compiler: Extract runtime profiling data : We use pprof profiles as input for the preprocessor tool. The new tool reads and parses profiling data once and extracts function call information of the Go program captured in the profiling data. Construct call graphs : The extracted profiling information is converted to a call graph with node and edge weights (called WeightedCallGraph). The call graph is cached in a certain format, including the information of the function caller, callee, address, and weights. The graph is used as input to guide optimizations in the Go compiler, specifically targeting hotpaths in the code. Optimizations such as inlining and devirtualization use profiling information to optimize hot paths for improved performance. Feed the output to the compiler : The optimized code produced by the PGO-enabled compiler is linked with the rest of the program to create the final executable. During this phase, we enable link-time code and data layout optimization based on profile information to order the functions and data. Figure 4: PGO profile preprocessing architecture. To make the compilation even faster, we execute the preprocessing tool on the most recently collected fleet-wide profiles every day. As a result, the production build can use the latest processed profile right away. Thanks to the preprocessing tool, PGO build times were significantly reduced, with most services experiencing only a minimal increase compared to their original durations. Performance Impact \u200b\u200bIn this section, we show the performance impact of PGO inlining on synthetic benchmarks and on Uber services. Synthetic benchmarks First, we show the performance impact of PGO on open-source synthetic benchmarks. The data is collected on a server with Intel \u00ae Xeon \u00ae Gold 6136 CPU, 128GB of memory, and Linux \u00ae version 6.8.0. go-json is one of the most widely used third-party JSON libraries in Go. It provides comprehensive benchmarks for \u200cperformance. We run the benchmarks on all standard encoding/JSON libraries with 20 iterations on all benchmarks. Figure 5: Performance benchmark of PGO on go-json. Overall, the PGO-driven inlining delivers a 12% performance improvement for the entire benchmark. A lot of microbenchmarks show more than 20% performance gain. The reason for the performance improvement can also be validated by inspecting the iTLB (instruction translation lookaside buffer) misses. Comparing the number of misses from the original benchmark and the PGO-compiled binary in Figure 6, we can see that PGO can greatly reduce the number of iTLB misses by 30%. Baseline PGO Change Instructions 2.84E+12 2.77E+12 -2.41% Cycles 9.34E+11 9.10E+11 -2.51% L1-icache-misses 2.22E+09 1.98E+09 -10.78% iTLB-misses 5.07E+06 3.31E+06 -34.64% We also investigated the profile of PGO and non-PGO runs. We found that the default inliner can\u2019t inline those hot functions (such as checkValid in Figure 7) since the body size is larger than the default inliner budget. After the inliner budget is increased with PGO build, those 3 functions can be inlined. We also noticed the PGO inliner slightly increases the number of inlining call sites. Figure 7: Call graph of checkValid function. We also investigated the reason for the performance improvement. In the baseline version, 35,545 call sites were inlined, where 36,544 call sites were inlined in the PGO version. Tally is a popular library for fast, buffered, and hierarchical stats collection. After we apply PGO-driven inlining, it delivers an average 10% performance gain, and some of the microbenchmarks show more than 50% improvement. Figure 8: Performance comparison of PGO on Tally benchmark suite. Enrolling Uber Services We currently enroll several thousand services at Uber with PGO. However, measuring PGO performance presents several challenges. One key difficulty is the lack of A/B performance measurement support in production with different compiled binaries, making it hard to directly compare PGO-optimized and non-optimized versions. Additionally, CPU usage can be significantly influenced by traffic variations (requests per second), which can fluctuate and skew results. The default autoscaling feature further complicates this by dynamically adjusting resources, making it difficult to isolate the impact of PGO. Moreover, ongoing changes to the service\u2019s source code during the measurement period can introduce variability, making it challenging to attribute performance improvements solely to PGO optimizations. After extensive exploration of different methodologies, we found the best approach to measure impact is by comparing performance metrics for 7 days before and 7 days after enabling PGO. Figure 9: CPU core allocation count for top 6 services of 5 months. We selected the top 6 services and measured CPU allocations with PGO enabled and disabled, as shown in Figure 9. The y-axis represents the number of CPU cores. The yellow line shows the number of cores when PGO is disabled, while the blue line represents the number of cores when PGO is enabled. Since 4/18/24, we\u2019ve observed a reduction in the number of cores with PGO enabled. However, due to \u200cautoscaling and varying RPS, we need to establish a method to correlate that the reduction in CPU allocation is directly related to PGO. To verify the measured gain of PGO is real, we compared the profiles of non-PGO (Figure 10a) and PGO (Figure 10b) runs. It\u2019s clear that the important functions such as checkValid aren\u2019t inlined by default, but will be inlined with the PGO build. Therefore, we can draw the conclusion that measured gain does mostly come from PGO. Figure 10a: Profile collected during baseline binary execution. Figure 10b: Profile collected during PGO binary execution. Conclusion Profile-guided optimizations can significantly enhance software performance by using runtime data to guide compiler optimizations. At Uber, PGO led to a ~4% performance gain through inlining optimizations and a reduction of 24,000 CPU cores across top services. Measuring PGO\u2019s impact can be complex, but this analysis demonstrates its value in optimizing resource utilization and achieving substantial performance improvements. Acknowledgments We\u2019d like to acknowledge former team member Jin Lin for designing, implementing, and upstreaming PGO inline and basic block reordering. Jin also measured PGO performance changes internally. We also extend our gratitude to former team manager Raj Barik for designing, implementing, and upstreaming type specialization. Additionally, we thank our former interns, Ghadeer Alabandi and Swastik Mittal, for their contributions. We\u2019re grateful to our colleagues at Uber, including Rasmus Vestergaard, Sung Wang, Zhongpeng Lin, Haiming Tian, Anthony Blelloch, Saurabh Agrawal, Tapan Thaker, Curtis Patrick, Lasse Vilhelmsen, Pawe\u0142 Kr\u00f3likowski, Sergey Balabanov, Niels Lindgren, Tony Alaniz, Cristian Velazquez, Kanad Sinha, Siyang Liu, Minglei Wang, Johan Mena, Taiwon Chung, Ryan Hang, and Jacob Oaks. Finally, we\u2019d like to thank Michael Pratt, Cherry Mui, and Austin Clements from the Google Go compiler team for their support and collaboration. Cover Photo Attribution: Image generated using the ImageGen3 AI model. Google \u00ae is a registered trademark of Google Inc. Linux \u00ae is the registered trademark of Linus Torvalds in the U.S. and other countries. Meta \u00ae is a registered trademark of Meta Inc. Java, MySQL, and NetSuite are registered trademarks of Oracle \u00ae and/or its affiliates. Swift \u00ae and the Swift logo are trademarks of Apple \u00ae Inc. Xeon \u00ae is a trademark of Intel\u00ae Corporation or its subsidiaries.",
+    "quality_score": 9,
+    "modules": [
+      "go_patterns",
+      "performance"
+    ]
+  },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/architecture/navigating-the-transition-adopting-azure-linux-as-linkedins-operatingsystem",
+    "title": "Navigating the transition: adopting Azure Linux as LinkedIn's operating system",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "As of April 2024, Azure Linux is the operating system running nearly all of LinkedIn\u2019s servers, virtual machines, and containers today. We migrated most of our fleet to Azure Linux as a key part of LinkedIn's evolution in building a modern compute stack, workload orchestration, and ML workload platforms. The move to Azure Linux supported two critical goals: providing a modern, secure operating system to reliably serve over 1 billion LinkedIn members worldwide; and delivering innovative new AI-powered features to members faster. Beyond these goals, other critical factors in our decision were cost-effectiveness, customization, scalability, community support, and compliance. In this post, we\u2019ll detail our migration journey including our goals, challenges, key steps in the process and performance monitoring strategies. Assessing the need for change The end of life for our CentOS 7 operating system (OS) was a primary driving force for our move to the more modern Azure Linux distribution. Adopting Azure Linux fleetwide helped us address numerous technical challenges, including reducing friction for teams when migrating their apps. We could also benefit from modern security and performance features in the kernel on the latest hardware. Technical challenges As we considered a new OS, we felt it was important to continue running the same Linux distribution across most of the LinkedIn platform, as we had with CentOS 7, to provide a stable and predictable environment. However, the new operating system needed to address some key technical challenges, including: User space: Legacy distributions of CentOS 7 suffered from outdated user-space. Many modern apps require modern system libraries, the latest SystemD features, better package management, and most notably better performance for certain workloads. Bootstrap time: Bootstrapping a large OS image took a long time, while putting pressure on network infrastructure with repeated installation of many default packages. Adopting Azure Linux allowed the opportunity to reflect and implement a completely different approach to build and bootstrap OS on bare metal servers and containers. As part of the project, OS images are now pre-built with most of the key components present in the image. Host specific configuration converges by config management tooling after OS image is applied. Bootstrap time went down from over an hour to 10-30 minutes. Security updates: As part of the compliance requirement driven by internal policies, the frequency for security updates to backport and integrate into OS images needs to be within a 30-day period. This requirement sets a high bar on how fast OS updates can be onboarded, verified, released and deployed. An OS Upgrade Automation project helped to orchestrate OS upgrades using LinkedIn MaaS (Metal-as-a-Service) with less developer engagement. Modern capabilities: The impending end of life for CentOS 7 prompted many vendors to cease support, necessitating a shift to a more modern operating system. LinkedIn\u2019s move towards a more modern operating system aligns with our various organizational needs, including cloud-native applications, containerization, and specific feature requirements that newer distributions provide out of the box. Vendor support: The lack of adequate community support was another reason we looked at other distributions. CentOS 8 was originally planned to receive updates until 2029, following the traditional model. However, with the shift to CentOS Stream, users felt uncertain about the project's direction and the timeline for updates. This uncertainty created some concerns about the reliability and support of CentOS as an operating system. Firmware updates: Modern hardware often requires firmware updates for optimal performance. The storage team, among others, sought a contemporary OS to leverage these updates. Azure Linux's adoption facilitated this, allowing for a more modern and efficient infrastructure. Business requirements The business requirements for the transition to Azure Linux centered around several key factors: Compliance : LinkedIn is subject to regulatory compliance requirements that mandate the use of secure and supported operating systems. Maintaining OS support helps LinkedIn adhere to industry standards and regulations, avoiding potential legal and financial consequences. Strong vendor support: Having support from the OS vendor or a reliable support provider ensures that businesses have access to expert assistance when facing technical issues. Vendor support includes help with troubleshooting, bug fixes, and general inquiries related to the operating system. Cost efficiencies: Periodic license renewals and support from third-party vendors gradually increased, while LinkedIn saw more value in partnership with Microsoft. Cost savings was one of the key objectives. Robust security: Regular security updates and patches are essential to address vulnerabilities and protect systems from potential threats. OS support ensures that security patches are promptly released and applied to keep the infrastructure secure. Security considerations were important to protect member data and harmful business disruption. Future proof: Being competitive means having a modern platform and tools to respond to the latest trends. Social platforms like LinkedIn should be one of the drivers of the change, while adopting modern innovations in the tech field. Making LinkedIn OS platform futureproof is an important investment in the ability to quickly adapt to any modern technology developments. Planning the transition For the migration to be a success, we needed to create strong alignment across the involved teams. Strong stakeholder collaboration is one of the cornerstones of LinkedIn success. We took the time to identify common trends in requirements across teams and align work performed by partner organizations. This gave us diverse perspectives on how teams were using Linux, enabled migration ownership and commitment, aligned organization goals, and established communication channels, among many other benefits. Pilot programs Our Infrastructure team was one of the first teams to fully migrate certain services to Azure Linux. The team oversees Core services, making it an easy choice to onboard the new OS. Additional teams were pulled into the pilot project to ensure Azure Linux would be usable on LinkedIn servers, including: The Systems Software Engineering team spearheaded Azure Linux adoption, by providing package management infrastructure running on Azure Linux while allowing for safe transition by other teams. The Information Security team assessed and made necessary updates to the security stack. The Services Infrastructure team used an experimental Azure Linux build pool to bootstrap most of the key packages. The Configuration Management team made custom configuration management modules more flexible in configuration of multiple OSes. The Productivity Engineering team made Developer VMs available as an early pilot for users. These pilot programs identified areas for improvement, helped us document necessary changes, and allowed the team to follow in each other's footsteps so the migration could move much faster. The expertise our core team accrued helped us develop a centralized approach to address most of the challenges the teams encountered. Implementation The pilot programs kicked off our implementation process and helped us establish stability with Azure Linux. This phase involved replicating package repositories and preparing the hardware auto-provisioning systems. We pinpointed essential packages and configurations for host initialization, with most configurations transitioning to the FireBird Image Build and post-imaging Configuration Management bootstrap processes. The Tools team facilitated Azure Linux variant builds for applications, while the Security team updated tools for proper host initialization. This collaborative effort ensured that the necessary tooling and security measures were in place to support the new operating system across LinkedIn's infrastructure. The CI/CD OS Testing team played a crucial role in testing and validating Azure Linux, leading to its general availability. The final step was the mass re-imaging of servers by various teams, marking the completion of the migration process. The high-level phase representation is shown in Figure 1 below. Figure 1. High level Azure Linux migration phases Infrastructure preparation The first host was born out of a container built on a laptop. While we managed to get a VM with Azure Linux internally, it was not flexible enough to break things many times. A typical container runs one process at a time. Enabling SystemD inside container, and validating various components required by MaaS helped us prepare an essential set of internal and external packages such as most UCM (Unified Configuration Management) packages, customized puppet, SSL key management packages, and others. Our MaaS team used this essential set of packages to integrate them into LinkedIn's MaaS automation. A few of the remarkable changes included moving to SystemD network configuration daemon and performing network discovery and registration. Choosing the XFS filesystem was an interesting challenge: it was not originally native to Azure Linux and configuring software RAID systems. Based on our system tests, XFS was a better performing system for most of our applications with a notable exception: Hadoop. It also felt more stable, comparing the number of issues that affected LinkedIn between XFS and EXT4. Our MaaS team was also moving towards a modern image-based installation process, during which the bare metal OS was baked into an image file and burned to disk. The Microsoft bare metal team was developing the Azure Linux Image Customizer at this time. This gave us the opportunity to align LinkedIn releases distribution versions with the Microsoft release process. Using Image Customizer, we could automatically perform LinkedIn releases from Microsoft releases along with LinkedIn customizations. LinkedIn uses various approaches to stateful and stateless applications. One of the easiest targets for migrations were stateful applications. The Tools team leveraged our existing Multi-Product Variant concept to create additional Azure Linux topologies and implement deployment workflows. Figure 2. Teams engaged in early migration phases Engaging teams during onboarding Azure Linux offered our teams a sense of familiarity mixed with novelty. Our core team delivered a series of prototype hosts, which came with a pre-set operating system, to our pilot teams. These hosts helped the teams get accustomed to the new OS, experiment with it, and enjoy the experience of discovering a modern operating system. The core team also extended personalized, in-depth assistance to help internal partner teams develop compatible software packages and set up operating system components according to the unique needs of different applications. To prepare engineers for the transition to Azure Linux OS, we shared insights from the pilot programs during technical talks, team meetings and casual office conversations. The transition significantly improved our deployment speed and system reliability, directly enhancing our ability to innovate and respond to market demands. The seamless integration with familiar tools boosted productivity, while extensive support from Azure Linux support team helped us minimize downtime. As a result, we\u2019ve strengthened trust and confidence in our engineering capabilities across our organization, which helps us make the case for future technological advancements and gives us a competitive edge in our operations. Data migration A sizable portion of the applications at LinkedIn are stateless, with deployment platform supporting seamless migration of the applications to pools of hosts with Azure Linux. Once an application supported the new OS, OS upgrade automation moved it to hosts with Azure Linux, and subsequently reimaged hosts that did not have any applications deployed. Stateful applications typically have data storage partitions separate from OS partitions. The MaaS team implemented a feature to maintain data partitions, while applications teams ensured all the required components were present in Azure Linux. MySQL database migration is one example of when many packages had to be rebuilt to support a new OS. In some cases, teams had to refactor application design to minimize downtime. For example, DNS-based failover method had to be replaced with a better suited application topology based one. Overcoming technical implementation challenges Encountering technical obstacles is a natural aspect of any migration process. Below, we\u2019ll discuss our strategies for addressing some of these hurdles. For instance, when data compatibility issues arose, we tailored custom scripts to ensure seamless data integration. Proactive communication with our Azure Linux support team allowed for swift identification and resolution of system discrepancies. Change management Azure Linux onboarding significantly increased the velocity and number of changes introduced to our production infrastructure. The migration to Azure Linux highlighted a challenging aspect of our existing change management process: the need to reduce changes that span multiple data centers or multiple groups of application services, which we call \u201cglobal changes.\u201d They were identified as one of the main reasons for service disruptions. To ensure the quality of the code and application deployment processes, LinkedIn engineering teams used diverse types of integration testing for applications and regular load testing to capture the behavior of critical user-facing components under stress. To mitigate accidental global changes, we introduced an initiative that strictly refused changes that might result in global impact. This forced teams to plan gradual transitions using a percentage of the deployment fleet or limiting the scope to data centers. Containers Even after making Azure Linux run on hardware machines, building containers that fulfilled LinkedIn security requirements for containers proved to be challenging. We used Microsoft-provided base image in the early adoption stages to build required packages, but LinkedIn production containers cannot use base images created outside of LinkedIn. We used the Container Image Builder tool to create CentOS and RHEL images, which ran on the RHEL7 host. Since the tool used OS package repository database for container built, it was incompatible with the Azure Linux repository. To build the first container base image with Azure Linux, we converted the package repository database during image creation. Once the base image was created, automation was able to build different container flavors based on the OS variant defined for a given application. Hardware drivers DKMS (Dynamic Kernel Module Support) was commonly used with legacy distributions used in LinkedIn, which provided several advantages, such as automatic rebuilding based on kernel version, customization and distribution independence. However, since Azure Linux kernel requires drivers to be signed by Microsoft, DKMS would not work. Since using signed drivers increases security, we worked with Microsoft to make drivers available for all the hardware SKUs used in LinkedIn. Now, LinkedIn relies on upstream Microsoft drivers built for Azure Linux. Azure Linux developer VMs The Productivity Engineering (PE) and Dev team performed an outstanding job building the dev pipeline for Azure Linux. Traditionally, LinkedIn hosted developer VMs with the OS at parity with production. This used to be a full-fledged CentOS desktop VM with a window manager that could be accessed by RDP and ssh connections. Transitioning to Azure Linux meant we would lose GUI access since Azure Linux does not currently support a window manager. The solution was to remotely connect IDE (integrated development environments), such as IntelliJ and Visual Studio Code, to the Azure Linux Developer VMs. The VMs are deployed across four different geographical regions that are closest to the users requesting them with a self-service tool. VMs with GPUs are provisioned on custom request. Since Azure Linux Marketplace Images are owned by Microsoft, we could directly use the Marketplace images, eliminating the need to maintain an OS image build pipeline. All LinkedIn customizations are then applied on top using Puppet. We also used this opportunity to leverage Systems Software Engineering\u2019s yum repositories for patch and LinkedIn Developer Tools (GULL) distribution. This eliminated duplicate RPM packages repositories that were previously maintained by PE. The Azure Linux Developer VMs are patched automatically within a 30-day patch cycle. During the pilot phase, early adopters could run Azure Linux Developer VMs. We gathered and addressed feedback before going to general availability (GA). Today, all VMs with legacy OSes have been gracefully shut down and deleted after a delay. We fully transitioned out of CentOS Developer Desktop VMs and are currently running a fleet of over 1.5k (and growing) Azure Linux Developer VMs. Remote development Remote development (RDev) is a service that enables engineers to use containers for their application development tasks, giving developers a production-like development experience. Providing an Azure Linux RDev experience equivalent to CentOS/RHEL was paramount for developer confidence in migrating to Azure Linux. The RDev container is self-contained with all the components required for an application to function in a dev environment. The RDev service takes in a container base image and applies customizations to make the container image suitable for developer workflows. We had to make the Azure Linux base image compatible with this workflow. There were issues when we were trying to build Azure Linux RDev image, for example: some RPM packages missing, older container runtime preventing RDev container to run, build tools not working inside the RDev image. By providing functional Azure Linux RDev early, before mass migration started, helped to maintain developer velocity through migration and quality of applications running on Azure Linux. Technical assistance Introducing Azure Linux into LinkedIn was a big endeavor that would have been impossible without high quality technical guidance for the new OS. We embraced Azure Linux support in various ways ranging from teaming up with Microsoft OS groups, to initiating support forums. The core team provided comprehensive documentation that we incorporated into our internal knowledge base. This allowed our engineers to quickly familiarize themselves with the new system and utilize its full potential, ensuring a smooth and efficient integration into production use. The core team also engaged subject matter experts in different fields to provide necessary support on issues such as rebuilding vendor specific libraries and applications, tuning memory consumption, filesystem performance, kernel tuning and automated configuration of a completely new network stack. We increased automation efforts to help us address the growing volume of application updates. Python-based applications, being the most prevalent, required substantial module upgrades, necessitating migration to newer versions of Python and SSL libraries upgrade. Automation was put in place to mass upgrade repositories for most of the common use cases. For more complex situations, the tools support team offered exemplary assistance. Monitoring and continuous improvement Performance monitoring While transitioning to Azure Linux, LinkedIn saw an unprecedented transformation of internal monitoring tooling. Outdated monitoring infrastructure was phased out in favor of a more contemporary setup that united both software and hardware monitoring into a single, streamlined interface. The new monitoring and performance observability stack improved the quality of our performance analysis of applications. Routine app performance evaluations indicated improvements in some areas while highlighting reduced performance in others, highlighting the need for performance tuning. For instance, we found that XFS\u2019s efficiency on RAID setups took a hit due to the default storage allocation configurations. By conducting thorough storage benchmarks and tweaking the XFS settings, we were able to fine-tune and enhance our storage performance. The adoption of new tools for monitoring, such as the inQuery and inLogs platforms, proved invaluable during the migration period by providing additional data points and logs that facilitated the troubleshooting and fine-tuning of different operating system components. Feedback loop We established several channels to capture our Azure Linux users\u2019 feedback. Teams could discuss their challenges during periodic meetings with our core team SMEs, although the lively discussions unfolded in the channel we dedicated to the Azure Linux migration. Every topic of discussion was captured in Jira and categorized. We performed periodic trend analysis; the data results helped us adjust our migration pace. After 95% of the migration was complete, we performed a post-migration analysis. We conducted \u201clessons learned\u201d sessions to help us formulate additional requirements for major OS upgrades in the future. Migration in numbers To monitor our migration, we used a common metric to track the number of hosts with Azure Linux. Thanks to an OS Upgrade Automation implemented before the migration to Azure Linux, the migration has proven to be trivial. Figure 3. Azure Linux migration trend, in % of the fleet Conclusion The migration of LinkedIn\u2019s fleet to Azure Linux was a strategic decision that entailed numerous considerations and challenges. Its successful execution yielded substantial benefits ranging from cost savings to enhanced security and flexibility. We achieved both critical goals: provide a modern, secure operating system to reliably serve LinkedIn members worldwide; and deliver innovative new AI-powered features to members faster. By embracing open-source solutions, LinkedIn, in partnership with Microsoft, harnessed the power of community-driven innovation and unlocked new levels of efficiency, agility, and competitiveness. Nevertheless, careful planning, comprehensive training and ongoing support were essential to making the transition smooth and maximizing the long-term value of the migration. Acknowledgements All this work is not possible without the contribution of many individuals. These are the top collaborators on this project that brought Azure Linux from Microsoft to LinkedIn. The seeds for choosing Azure Linux started with LinkedIn's Team consisting of Tim Crofts and Franck Martin who were invited to discuss their Linux fleet management with Kay Williams, a member of Microsoft's Linux Systems Group. LinkedIn Team: Executive Sponsors: Bruno Connelly , Neil Pinto , Milind Talekar Linux Strategy Leaders: Nick Berry , Franck Martin Linux Build Leader: Andreas Zaugg Systems Infrastructure: Zaheer Shaikh , Tim Crofts , Cliff McIntire , Ievgen Priadka , Maanas Alungh , Harish Shetty , Riya Agarwal , Vaibhav Singh Gour , Harpreet Lalwani , Rishika Wadhera , Sreegopal P , Pawan Pandey Hardware Provisioning: Nitin Sonawane , Rohit Jamuar , Bubby Rayber , Phincy Leo Pious Configuration Management: Martin Minkus , Lovell Felix Testing/Deployment: Ramadass Venkadasamy , Adam Debus , Rob West Dev and Tools: Dan Hicks , Samir Tata , Sweekar Pinto Hardware Certification: Kyle Reid , David Mackey TPM: Sameer Makada , Padmaja Mummaneni , Sean Patrick Microsoft Team: LinkedIn would like to thank the Azure Linux team at Microsoft notably the following individuals (in no order): Chris Co , Allen Pais , Rachel Menge , Deepu Thomas , Adelaida Amatangelo , Daniel McIlvaney , Henry Li , Adithya Jayachandran , Frank Swiderski, Ravi Rao , Brian Telfer , Jon Slobodzian , Jim Perrin , Kang Su Gatlin , Suresh Babu Chalamalasetty, Tyler Hicks , Roaa Sakr , Chris Gunn , Neha Agarwal, Frank Swiderski , Krishna Ganugapati.",
+    "quality_score": 9,
+    "modules": [
+      "evolutionary",
+      "devops",
+      "security",
+      "dependency_health"
+    ]
   }
 ]


--- seed-extraction-failures.json
diff --git a/seed-extraction-failures.json b/seed-extraction-failures.json
index 6fe6e9f..fe51488 100644
--- a/seed-extraction-failures.json
+++ b/seed-extraction-failures.json
@@ -1,42 +1 @@
-[
-  {
-    "id": "9",
-    "url": "https://www.linkedin.com/blog/engineering/search/reimagining-linkedins-search-stack",
-    "reason": "extractor_returned_null"
-  },
-  {
-    "id": "12",
-    "url": "https://www.uber.com/blog/from-static-rate-limiting-to-intelligent-load-management/",
-    "reason": "extractor_returned_null"
-  },
-  {
-    "id": "13",
-    "url": "https://www.uber.com/blog/how-uber-serves-over-150-million-reads/",
-    "reason": "extractor_returned_null"
-  },
-  {
-    "id": "14",
-    "url": "https://www.uber.com/blog/ureview/",
-    "reason": "extractor_returned_null"
-  },
-  {
-    "id": "15",
-    "url": "https://www.uber.com/blog/perfinsights/",
-    "reason": "extractor_returned_null"
-  },
-  {
-    "id": "23",
-    "url": "https://www.linkedin.com/blog/engineering/infrastructure/how-design-patterns-power-linkedin-infrastructure",
-    "reason": "extractor_returned_null"
-  },
-  {
-    "id": "25",
-    "url": "https://www.linkedin.com/blog/engineering/architecture/navigating-the-transition-adopting-azure-linux-as-linkedins-operatingsystem",
-    "reason": "extractor_returned_null"
-  },
-  {
-    "id": "39",
-    "url": "https://www.uber.com/blog/automating-efficiency-of-go-programs-with-pgo/",
-    "reason": "extractor_returned_null"
-  }
-]
+[]


--- src/content/article-extractor.ts
diff --git a/src/content/article-extractor.ts b/src/content/article-extractor.ts
index beb790a..3269469 100644
--- a/src/content/article-extractor.ts
+++ b/src/content/article-extractor.ts
@@ -5,16 +5,24 @@ import { logger } from '../utils/logger.js';
 import type { ArticleText } from './types.js';
 
 const EXTRACT_TIMEOUT_MS = 30_000;
+const EXTRACT_RETRY_DELAY_MS = 1_500;
 const PUPPETEER_LAUNCH_TIMEOUT_MS = 20_000;
 const PUPPETEER_TOTAL_TIMEOUT_MS = 45_000;
+const BROWSER_CLOSE_TIMEOUT_MS = 2_000;
 const MIN_WORD_COUNT_RESULT = 100;   // below this = extraction failed
 const MIN_WORD_COUNT_ACCEPT = 300;   // below this = use Puppeteer fallback for curated
-const USER_AGENT = 'devcast/1.0 (+https://devcast.lilicurl.com)';
+const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
 const DEFAULT_PUPPETEER_FALLBACK_HOSTS = [
   'discord.com',
   'stripe.com',
+  'www.linkedin.com',
 ] as const;
 
+interface UrlRequestProfile {
+  readonly name: string;
+  readonly headers: Record<string, string>;
+}
+
 interface ExtractionPolicy {
   readonly puppeteerFallbackHosts: Set<string>;
   readonly source: 'default' | 'env' | 'config';
@@ -114,29 +122,52 @@ function parseRssText(raw: string): ArticleText | null {
 }
 
 async function extractFromUrl(url: string): Promise<ArticleText | null> {
-  try {
-    const signal = AbortSignal.timeout(EXTRACT_TIMEOUT_MS);
-    const article = await extract(url, {}, { signal, headers: { 'User-Agent': USER_AGENT } });
-    if (!article?.content) return null;
-
-    const text = stripHtml(article.content);
-    const wordCount = countWords(text);
-    if (wordCount < MIN_WORD_COUNT_RESULT) return null;
+  const host = getHostname(url);
+  const requestProfiles = getUrlRequestProfiles(url);
+
+  for (let index = 0; index < requestProfiles.length; index++) {
+    const profile = requestProfiles[index]!;
+
+    try {
+      if (index > 0) {
+        await sleep(EXTRACT_RETRY_DELAY_MS);
+      }
+
+      const signal = AbortSignal.timeout(EXTRACT_TIMEOUT_MS);
+      const article = await extract(url, {}, { signal, headers: profile.headers });
+      if (!article?.content) return null;
+
+      const text = stripHtml(article.content);
+      const wordCount = countWords(text);
+      if (wordCount < MIN_WORD_COUNT_RESULT) return null;
+
+      return {
+        title: article.title ?? '',
+        text,
+        wordCount,
+        publishedAt: article.published ? new Date(article.published) : null,
+      };
+    } catch (err) {
+      logger.debug('content.extract.url.fail', {
+        url,
+        host,
+        profile: profile.name,
+        error: String(err),
+      });
 
-    return {
-      title: article.title ?? '',
-      text,
-      wordCount,
-      publishedAt: article.published ? new Date(article.published) : null,
-    };
-  } catch (err) {
-    logger.debug('content.extract.url.fail', {
-      url,
-      host: getHostname(url),
-      error: String(err),
-    });
-    return null;
+      if (index < requestProfiles.length - 1) {
+        logger.info('content.extract.url.retry', {
+          url,
+          host,
+          fromProfile: profile.name,
+          toProfile: requestProfiles[index + 1]!.name,
+        });
+        continue;
+      }
+    }
   }
+
+  return null;
 }
 
 async function extractWithPuppeteer(url: string): Promise<ArticleText | null> {
@@ -147,6 +178,7 @@ async function extractWithPuppeteer(url: string): Promise<ArticleText | null> {
       setDefaultNavigationTimeout(timeout: number): void;
       setDefaultTimeout(timeout: number): void;
       setUserAgent(userAgent: string): Promise<void>;
+      setExtraHTTPHeaders(headers: Record<string, string>): Promise<void>;
       goto(url: string, options: { waitUntil: 'domcontentloaded'; timeout: number }): Promise<unknown>;
       waitForSelector(selector: string, options: { timeout: number }): Promise<unknown>;
       waitForNetworkIdle(options: { idleTime: number; timeout: number }): Promise<unknown>;
@@ -172,11 +204,11 @@ async function extractWithPuppeteer(url: string): Promise<ArticleText | null> {
         });
 
         const page = await browser.newPage();
+        const headers = getBaseBrowserHeaders();
         page.setDefaultNavigationTimeout(EXTRACT_TIMEOUT_MS);
         page.setDefaultTimeout(EXTRACT_TIMEOUT_MS);
-        await page.setUserAgent(
-          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
-        );
+        await page.setUserAgent(BROWSER_USER_AGENT);
+        await page.setExtraHTTPHeaders(withoutUserAgentHeader(getHostSpecificBrowserHeaders(url, headers)));
         await page.goto(url, { waitUntil: 'domcontentloaded', timeout: EXTRACT_TIMEOUT_MS });
         await page.waitForSelector('body', { timeout: 5_000 }).catch(() => undefined);
         await page.waitForNetworkIdle({ idleTime: 750, timeout: 5_000 }).catch(() => undefined);
@@ -208,9 +240,7 @@ async function extractWithPuppeteer(url: string): Promise<ArticleText | null> {
     logger.warn('content.extract.puppeteer.fail', { url, error: String(err) });
     return null;
   } finally {
-    if (!skipBrowserClose) {
-      await browser?.close();
-    }
+    await closeBrowserSafely(browser, skipBrowserClose, url);
   }
 }
 
@@ -250,6 +280,20 @@ export function countWords(text: string): number {
   return text.split(/\s+/).filter((w) => w.length > 0).length;
 }
 
+function getUrlRequestProfiles(url: string): UrlRequestProfile[] {
+  const baseHeaders = getBaseBrowserHeaders();
+  const hostHeaders = getHostSpecificBrowserHeaders(url, baseHeaders);
+
+  if (headersEqual(baseHeaders, hostHeaders)) {
+    return [{ name: 'browser-default', headers: baseHeaders }];
+  }
+
```

### Commit 3: 5f082bc
**Message:** fix: harden seed classifier retries

**Diff:**
```diff
--- seed-articles.json
diff --git a/seed-articles.json b/seed-articles.json
index ecbab5a..604be47 100644
--- a/seed-articles.json
+++ b/seed-articles.json
@@ -87,8 +87,7 @@
     "modules": [
       "architecture_patterns",
       "performance",
-      "concurrency",
-      "design_patterns"
+      "concurrency"
     ]
   },
   {
@@ -107,7 +106,7 @@
     "url": "https://www.linkedin.com/blog/engineering/infrastructure/introducing-northguard-and-xinfra",
     "title": "Introducing Northguard and Xinfra: scalable log storage at LinkedIn",
     "source_name": "LinkedIn Engineering Blog",
-    "text": "Data is at the heart of our thousands of services at LinkedIn. Services want to subscribe to data published by other services. These subscribers need to process all the data from the originating services, or publishers, not just the latest updates. But these subscribers can have bugs, so it's desirable for these services to be able to reprocess the data as well. This allows for them to fix their bugs, reprocess the data, and verify their service is working correctly. To make this possible, 15 years ago we developed Kafka, a centralized pipeline for these publishers and subscribers. Kafka solved common problems in distributed systems such as storing large amounts of data in a consistent, replayable, and fault-tolerant way. It became the backbone of our infrastructure, supporting not just user activity events but also logging, metrics, tracing, application-to-application messaging, near real-time applications, stream processing, data lake import/export, AI features, and even database replication. This ordered data pipeline is known as a log, and the pattern of separating data producers from data consumers is called the Pub/Sub pattern. However, as LinkedIn grew and our use cases became more demanding, it became increasingly difficult to scale and operate Kafka. That’s why we’re moving to the next step on our journey with Northguard, a log storage system with improved scalability and operability. In this blog, we’ll discuss how we built Northguard and its benefits. We'll also introduce Xinfra, a virtualized Pub/Sub layer over Northguard, and explain how we transitioned from Kafka to Northguard. Why we needed a new solution In 2010, LinkedIn had 90 million members. Today, we serve over 1.2 billion members on LinkedIn. Unsurprisingly, this increase has created some challenges over the years, making it difficult to keep up with the rapid growth in the number, volume, and complexity of Kafka use cases. Supporting these use-cases meant running Kafka at a scale of over 32T records/day at 17 PB/day on 400K topics distributed across 10K+ machines within 150 clusters. Some of the main challenges: Scalability – Onboarding more use cases not only resulted in more traffic, but also more metadata, and more machines to support the added traffic. Metadata and cluster size bottlenecks were getting harder to tackle and meant setting up more clusters. Operability – Added traffic led to load balancing challenges, and with the over 100 clusters we were now running, we now needed an ecosystem of services just to manage all the clusters. Availability – limited by partitions being a heavyweight unit for replication. Consistency – was often traded off in favor of availability due to the availability impact of partitions being the unit of replication. Durability – Relatively weak guarantees were insufficient for our more critical applications. We needed a system that scales well not just in terms of data, but also in terms of its metadata and cluster size, all while supporting lights-out operations with even load distribution by design and fast cluster deployments, regardless of scale. Additionally, we required strong consistency in both our data and metadata, along with high throughput, low latency, highly available, high durability, low cost, compatibility with various types of hardware, pluggability, and testability. Introducing Northguard Northguard is a log storage system with a focus on scalability and operability. To achieve high scalability, Northguard shards its data and metadata, maintains minimal global state, and uses a decentralized group membership protocol. Its operability leans on log striping to distribute load across the cluster evenly by design. Northguard is run as a cluster of brokers which only interact with clients that connect to them and other brokers within the cluster. Let's delve into the foundational elements that power Northguard: its data model, metadata model, and protocols that underpin it. Data model Clients produce and consume records, the most granular unit of data to be read or written. Records (figure 1) are composed of a key, a value, as well as user-defined headers, all of which are just a sequence of bytes. Figure 1. a lone record A segment (figure 2) is a sequence of records. Segments are the unit of replication. They can either be active or sealed, where an active one can have records appended to it and a sealed one is immutable. Records in a segment are stamped with a logical offset relative to the start of the segment. A segment can be sealed either due to replica failure, the segment reaching a size limit of 1GB, or from the segment being active for over an hour. Figure 2. A segment with multiple records A range (figure 3) acts as Northguard's log abstraction. It's a sequence of segments associated with a contiguous range of a keyspace. Ranges can either be active or sealed. An active range could potentially have no segments at all, could have only sealed segments, or could potentially have its most recent segment be active. A sealed range could potentially have no segments at all, or could have only sealed segments, but cannot have an active segment. Figure 3. A range containing three segments A topic (figure 4) is a named collection of ranges that covers the full keyspace when combined. A topic's ranges can be split or merged. Splitting a range seals that range and creates two new ranges. Merging two ranges seals those two ranges and creates a new child range. A range can only be merged with its unique buddy range, exactly the same way that the buddy memory allocator algorithm works. A topic can be sealed or deleted. Sealing a topic seals all of its ranges. Deleting a topic deletes all of its ranges. Figure 4. A topic with a few ranges that have been split and merged A topic is configured with a storage policy. Storage policies are provided by administrators of the cluster. A storage policy has a name, a retention period that defines when segments should be deleted, as well as a set of constraints. A constraint has an expression that defines which brokers are allowed to be chosen as a replica of a segment, and how many. These expressions are based on keys and values bound to brokers called attributes. These attributes are bound to a broker process by administrators. Policies and attributes are a powerful abstraction. For example, Northguard itself has no native understanding of racks, datacenters, etc. Administrators at LinkedIn just encode this state in the policies and attributes on the brokers we deploy, making policies and attributes a generalized solution to rack-aware replica assignment. We even use policies and attributes to distribute replicas in a way that allows us to safely deploy builds and configs to clusters in constant time regardless of cluster size. Log striping The more coarse-grained your unit of replication, the more you need to worry about resource skew in your cluster. Balancing out the resource skew is difficult, and you might even rely on an entire system, like LinkedIn’s Cruise Control , just to balance resource distribution across the cluster. When your unit of replication is as coarse-grained as the log, each replica is responsible for storing a copy of the entire log. This causes a number of resource skew problems: Resource skew if brokers have more logs than other brokers. New brokers added to the cluster will remain unused until new logs are assigned onto it or move existing logs onto it. Logs are created infrequently, and moving existing logs causes operability pain. Resource skew if an unlucky broker has more resource intensive logs than other brokers. Northguard ranges avoid these issues by implementing log striping, meaning that it breaks a log into smaller chunks for balancing IO load. These chunks have their own replica sets as opposed to the log. Ranges and segments are the Northguard analog of logs and chunks. Since segments are created relatively often, we don’t need to move existing segments onto new brokers. New brokers just organically start becoming segment replicas of new segments. This also means that unlucky combinations of segments landing on a broker aren’t an issue, as it will sort itself out when new segments are created and assigned to other brokers. The cluster balances on its own. Figure 5. A cluster with a newly added Broker 5 Figure 6. A new segment gets added to the range and gets assigned to Broker 5 Ranges vs. indexed partitions When deciding how to scale throughput to topics with these striped logs, we wanted to: have correct record-to-log placement by clients minimize interruption to unrelated logs maintain some level of ordering guarantees facilitate stream processing frameworks in avoiding shuffles Ranges checked all the boxes for us. Whereas indexed partitions would’ve required a “stop-the-world” synchronization barrier for producing clients to continue to send records to the right log, ranges only interrupt clients producing to the range being split. This range split acts as the synchronization barrier, and forces clients to react to the changes made to the topic before continuing to produce. On top of that, you get some nice ordering guarantees, with range splits and merges still offering a total ordering: if a range R1 is split into R2 and R3: all records in R1 happens-before records in R2 all records in R1 happens-before records in R3 if ranges R2 and R3 are merged into R4: all records in R2 happens-before records in R4 all records in R3 happens-before records in R4 Stream processing jobs often involve joining multiple streams. To perform the join, records with the same join key across these streams need to be processed together. We can do this effortlessly by leveraging the key partitioning provided by the log storage system, as long as the partitioning of the join keys across these streams is aligned. However, if the streams being joined have unaligned partitioning of the join keys (e.g., one stream with 10 partitions and another with 16 partitions), the stream processing jobs may need to introduce a shuffle stage to repartition the records, which can be costly. Ranges offer a better solution for stream processing, as Northguard’s buddy-style ranges of different topics inherently align. We can avoid the shuffle step entirely. Metadata model Northguard has metadata for managing topics, ranges, and segments. A cluster has one or more vnodes, each storing a shard of the cluster's metadata. A vnode is a fault-tolerant replicated state machine backed by Raft and acts as the core building block behind Northguard's distributed metadata storage and metadata management. Figure 7. A vnode’s Raft group A coordinator is the leader of a given vnode. It manages all the metadata owned by a vnode. This is where the “business logic” of the metadata lives. When the vnode's state machine elects a new leader, the coordinator of the vnode moves to the new leader as well. The coordinator persists state in the vnode state machine so that a newly elected coordinator can pick up from where the previous one left off. For topics owned by a vnode, the coordinator tracks changes such as sealing or deleting the topic and splitting or merging ranges from that topic. For ranges owned by a vnode, the coordinator tracks metadata like the range's active/sealed/deleting state, the creation time, the retention, and the topic name. It also stores metadata on the segments like the segment's replica set, the active/sealed/reassigning state of the segment, the start offset and length of the segment, the create time, and seal time of the segment. The coordinator uses this segment state to initiate sealed segment replication for under-replicated segments, making Northguard self-healing. The Dynamically-Sharded Replicated State Machine (DS-RSM) is a collection of vnodes covering a hash ring. Metadata is sharded across vnodes using consistent hashing. Topic metadata is hashed by topic name, while range and segment metadata is hashed by range ID. This minimizes metadata hotspots. Figure 8. A DS-RSM with 3 vnodes A cluster can be configured with a metadata policy provided by administrators of the cluster. A metadata policy has a name and one or more constraints. These constraints behave exactly the same as the ones in storage policies, where its expressions are once again based on the attribute keys and values bound to brokers by administrators. The metadata policy defines how replicas of the vnodes are chosen. Cluster state and membership Northguard uses SWIM as its scalable group membership protocol. SWIM employs random probing for failure detection but infection-style dissemination for membership changes and broadcasts. We use this broadcast mechanism to distribute minimal global cluster state such as basic host, port, and attributes of the brokers in the cluster as well as minimal information about this DS-RSM hash ring such as each vnode's hash ring start and end boundaries, the vnode leader, vnode current term, and vnode replicas. This facilitates routing of certain requests to the appropriate vnode leader. Figure 9. The SWIM protocol in action Protocols Northguard’s metadata protocols are unary: one request results in one response. Examples include CreateTopicRequest, DeleteTopicRequest, TopicMetadataRequest, and SegmentMetadataRequest. Clients send these requests to any broker in the cluster, which acts as a proxy. The broker uses its local copy of gossipped global state to determine which vnode can serve the request and relays it to the leader of that vnode. The response follows the same path back to the client. While metadata protocols are unary, Northguard’s produce, consume, and replication protocols are all sessionized streaming protocols. We sessionize state to the stream to avoid protocol overhead. These protocols use pipelining to keep data moving and windowing to control how much can be pipelined at any time. Let’s take produce streams as an example. The producing client generates a stream ID and initiates a handshake with the active segment leader, learning the initial window size accepted by the broker. The producer sends multiple Appends to the broker as long as the records haven’t exceeded the window. Each append contains the stream ID, sequence number, and one or more records. The broker can send M Acks for N Appends and is only allowed to send the producer an Ack for records that have been committed. These Acks include an acknowledgement number correlating with the sequence number from Append and an updated window for more Appends. Figure 10. A producer sending records and getting acknowledgements over a produce stream Consume streams are very similar to produce streams but with records flowing in the reverse direction and the client determining the window size. After the handshake, the consumer sends Reads telling the broker their progression of the stream and potentially updated window size. Brokers send Pushes as long as the records being pushed haven’t exceeded the window. Figure 11. A consumer receiving records and asking for more over a consume stream Active segment replication works similarly to produce streams, using record offsets instead of sequence numbers. ReplicaAppends also include a committed state for followers to track progress of what’s been committed. Figure 12. An active segment follower receiving records and asking for more over a replica stream Sealed segment replication replenishes under-replicated segments, and is literally the consume protocol, but between two brokers. Segment storage Segment storage in Northguard is pluggable, but the primary implementation, called the “fps store,” has a write-ahead-log (WAL), creates a file-per-segment, uses Direct I/O, and maintains a sparse index in RocksDB. Appends are accumulated in a batch until sufficient time has passed (ex: 10 ms), the batch exceeds a configurable size, or the batch exceeds a configurable number of appends. Once ready to flush the batch, the store synchronously writes to the WAL, appends records to one or more segment files, fsyncs these files, and updates the index. With Direct I/O, Northguard avoids double buffering, and instead uses application-level caching that leverages its knowledge of established consume streams to populate the cache. Direct I/O also enhances Northguard's durability by maintaining consistent state across fsync failures. It helps us avoid cache degradation issues we might’ve otherwise seen in the page cache on replicas that clients aren’t consuming from, or when, for example, consumers or sealed segment replication wants to consume old segments. Testing On top of having thousands of tests, microbenchmarks, and a rigorous certification pipeline, we also run Northguard under deterministic simulation. This means we run a cluster as well as clients under a single thread and swap out nondeterministic components with deterministic versions of them. We simulate years of activity under various scenarios every day, where the scenarios are injecting many kinds of faults into the simulation: broker shutdown rolling restarts network partition packet loss packet corruption disk corruption disk io errors config deployments We can easily share, replay, and step through failed runs, and this helps us catch bugs before they happen in production. Evaluation Let’s recap some of the key points: Kafka Northguard Scalability: Data logs bounded by machine disk capacity logs bounded by cluster disk capacity Scalability: Metadata Control Plane Bottlenecked by: 1 controller 1 replicated state machine Stressed at millions of partition replicas. N (128+) coordinators N (128+) sharded replicated state machines Does fine with millions of segment replicas. Scalability: Metadata Distribution Global topic metadata state Minimal global state Scalability: Cluster Size Centralized group membership heartbeating to controller Scalable gossip group membership Operability: Cluster Count 80%+ fewer Operability: Balanced Data Distribution External service to keep the cluster balanced. Balanced by design Operability: Metadata Distribution N/A (metadata isn’t sharded) Balanced by design Operability: Adding Brokers External service to move existing data onto the new broker to keep the cluster balanced. No need to move existing data onto new brokers. Operability: Replenish Replication Factor External service to restore replication factor while keeping the cluster balanced. Self-healing Availability Produce availability degrades as replicas fail Striping gives us higher availability. Producers move onto new segments when a segment replica fails. Consistency Partitions as the unit of replication means long periods to replenish. We configured topics to sacrifice consistency for produce availability. Segments as the unit of replication and log striping means that we don't need to sacrifice consistency in order to preserve produce availability when brokers start to fail. Durability Lazy syncs: 10 seconds 20k records Fsync on all replicas before produce ack: 10 milliseconds 20k records 10 MB Performance Meets LinkedIn’s SLOs for Kafka with better durability. Migrating from Kafka to Northguard Migrating user topics from one Kafka cluster to another is difficult, and migrating users from one Pub/Sub system (Kafka) to another (Northguard) is even harder. Thousands of applications, including mission-critical ones, need to be migrated. We’re talking about migrating several hundreds of thousands of topics and hundreds of clusters. Application downtime is unacceptable during migration, and handling individual applications separately is not scalable. Part of the migration challenge comes from users relying on the Kafka client, which talks to a single Kafka cluster at a time. The lack of virtualization complicates the transition to a new system with a different data model and protocols. Another challenge in LinkedIn’s infrastructure is that adding a new cluster to handle traffic growth is often not transparent to the users. Pub/Sub Virtualization can help by hiding physical aspects of a Pub/Sub cluster, making it possible to virtually grow a cluster without requiring changes from applications. Introducing Xinfra Xinfra (pronounced as ZIN-frah) is a virtualized Pub/Sub layer supporting both Northguard and Kafka. It offers a unified Pub/Sub experience for customers. With virtualization, a Xinfra topic is no longer tied to a single Kafka cluster. A Xinfra topic has epochs (which captures the topic change history), allowing it to have an epoch in a Kafka cluster and another in a Northguard cluster, as seen below in figure 13. Figure 13. An example Xinfra topic with multiple epochs This means users don't need to change the topic when it is migrated between clusters at runtime. Topic virtualization also allows grouping topics located in different physical clusters under the same virtualized cluster. This enables Xinfra to federate multiple physical clusters to support large use cases that would otherwise be infeasible with a single physical cluster. Figure 14. An example use case where a consumer subscribes to three topics under the same virtual cluster, with each topic located in different clusters Users interact with Northguard and Kafka via Xinfra clients, which provide a unified API for accessing pub/sub infrastructure at LinkedIn. Each epoch in a Xinfra topic contains a list of shards (similar to topic partition in Kafka). Xinfra producers offer \"produce to a topic\" and \"produce to a shard\" APIs. Xinfra consumers provide both manual shard assignment-based consumption and consumer group management-based consumption. The Xinfra-metadata-service is a robust Pub/Sub ecosystem management system for Xinfra clients. It provides a virtualized and unified view across multiple Pub/Sub systems, streamlining operations and abstracting away the complexities of underlying infrastructure. Additionally, it offers essential Pub/Sub capabilities, such as consumer group management and checkpoint storage, at the virtual layer—ensuring a seamless and consistent experience for the users. Xinfra-metadata-service handles virtual topics and clusters, including mapping between virtual and physical topics/shards. It also enables essential operations such as creating, updating, deleting, and migrating topics at the virtual layer. To ensure persistence, all metadata for both virtual and physical topics/clusters is stored in MySQL. Xinfra-metadata-service also keeps track of all connected Xinfra producers and consumers, providing consumer group management and checkpoint storage over the virtual layer, ensuring a seamless experience for users. Xinfra-metadata-service leverages Zookeeper to maintain cluster consistency, handling membership, leadership, and group allocation during consumer group management. It ensures incremental group rebalancing, fair shard allocation within consumer groups, and resilience against network partitions or crashes. For checkpoint storage, Xinfra-metadata-service utilizes Vitess, a sharded MySQL solution, along with a coalescing buffer for efficiency. Additionally, it integrates Couchbase as a caching layer to achieve low-latency checkpoint reads and writes. The Xinfra-metadata-service Xinfra-based pub/sub migration Xinfra natively supports topic migration from one cluster to another and from one Pub/Sub system to another. It leverages dual-write approaches and staged migration steps to migrate user topics. At a high level, the migration process begins by creating a new topic epoch in the target cluster. Producers are migrated first, followed by consumers. Producers perform dual writes during the migration period to allow a safe rollback in case of migration failure. Ordering guarantees are maintained through the migration process. The migration is transparent to users, and the migration state is delivered via Xinfra topic metadata update to the client. Producers and consumers continue to work throughout the migration process. The final stage of migration involves turning off dual writes. Post-migration, consumers can still read through epochs, including data in the previous epoch, until the data is deleted by retention policy. Current state and what’s next Xinfra has been widely adopted within LinkedIn, with over 90% applications running Xinfra clients. We have successfully migrated thousands of topics from Kafka to Northguard, accounting for trillions of records per day. Looking ahead, our focus will be on driving even greater adoption of Northguard and Xinfra, adding features such as auto-scaling topics based on traffic growth, and enhancing fault tolerance for virtualized topic operations. We are thrilled to continue this journey!",
+    "text": "Skip to main content\n\nInfrastructure\n\nIntroducing Northguard and Xinfra: scalable log storage at LinkedIn\nAuthored by\nOnur Karaman\n\nJune 25, 2025\n\nCo-authors: \nCo-authored by\nOnur Karaman and \nCo-authored by\nXiongqi Wu\n\nData is at the heart of our thousands of services at LinkedIn. Services want to subscribe to data published by other services. These subscribers need to process all the data from the originating services, or publishers, not just the latest updates. But these subscribers can have bugs, so it's desirable for these services to be able to reprocess the data as well. This allows for them to fix their bugs, reprocess the data, and verify their service is working correctly.\n\n\nTo make this possible, 15 years ago we developed Kafka, a centralized pipeline for these publishers and subscribers. Kafka solved common problems in distributed systems such as storing large amounts of data in a consistent, replayable, and fault-tolerant way. It became the backbone of our infrastructure, supporting not just user activity events but also logging, metrics, tracing, application-to-application messaging, near real-time applications, stream processing, data lake import/export, AI features, and even database replication. This ordered data pipeline is known as a log, and the pattern of separating data producers from data consumers is called the Pub/Sub pattern.\n\n\nHowever, as LinkedIn grew and our use cases became more demanding, it became increasingly difficult to scale and operate Kafka. That’s why we’re moving to the next step on our journey with Northguard, a log storage system with improved scalability and operability.\n\n\nIn this blog, we’ll discuss how we built Northguard and its benefits. We'll also introduce Xinfra, a virtualized Pub/Sub layer over Northguard, and explain how we transitioned from Kafka to Northguard.\n\nWhy we needed a new solution\n\nIn 2010, LinkedIn had 90 million members. Today, we serve over 1.2 billion members on LinkedIn. Unsurprisingly, this increase has created some challenges over the years, making it difficult to keep up with the rapid growth in the number, volume, and complexity of Kafka use cases. Supporting these use-cases meant running Kafka at a scale of over 32T records/day at 17 PB/day on 400K topics distributed across 10K+ machines within 150 clusters. Some of the main challenges:\n\nScalability – Onboarding more use cases not only resulted in more traffic, but also more metadata, and more machines to support the added traffic. Metadata and cluster size bottlenecks were getting harder to tackle and meant setting up more clusters.\nOperability – Added traffic led to load balancing challenges, and with the over 100 clusters we were now running, we now needed an ecosystem of services just to manage all the clusters.\nAvailability – limited by partitions being a heavyweight unit for replication.\nConsistency – was often traded off in favor of availability due to the availability impact of partitions being the unit of replication.\nDurability – Relatively weak guarantees were insufficient for our more critical applications.\n\nWe needed a system that scales well not just in terms of data, but also in terms of its metadata and cluster size, all while supporting lights-out operations with even load distribution by design and fast cluster deployments, regardless of scale. Additionally, we required strong consistency in both our data and metadata, along with high throughput, low latency, highly available, high durability, low cost, compatibility with various types of hardware, pluggability, and testability.\n\nIntroducing Northguard\n\nNorthguard is a log storage system with a focus on scalability and operability. To achieve high scalability, Northguard shards its data and metadata, maintains minimal global state, and uses a decentralized group membership protocol. Its operability leans on log striping to distribute load across the cluster evenly by design.\n\n\nNorthguard is run as a cluster of brokers which only interact with clients that connect to them and other brokers within the cluster.\n\n\nLet's delve into the foundational elements that power Northguard: its data model, metadata model, and protocols that underpin it.\n\nData model\n\nClients produce and consume records, the most granular unit of data to be read or written. Records (figure 1) are composed of a key, a value, as well as user-defined headers, all of which are just a sequence of bytes.\n\nFigure 1. a lone record\n\nA segment (figure 2) is a sequence of records. Segments are the unit of replication. They can either be active or sealed, where an active one can have records appended to it and a sealed one is immutable. Records in a segment are stamped with a logical offset relative to the start of the segment. A segment can be sealed either due to replica failure, the segment reaching a size limit of 1GB, or from the segment being active for over an hour.\n\nFigure 2. A segment with multiple records\n\nA range (figure 3) acts as Northguard's log abstraction. It's a sequence of segments associated with a contiguous range of a keyspace. Ranges can either be active or sealed. An active range could potentially have no segments at all, could have only sealed segments, or could potentially have its most recent segment be active. A sealed range could potentially have no segments at all, or could have only sealed segments, but cannot have an active segment.\n\nFigure 3. A range containing three segments\n\nA topic (figure 4) is a named collection of ranges that covers the full keyspace when combined. A topic's ranges can be split or merged. Splitting a range seals that range and creates two new ranges. Merging two ranges seals those two ranges and creates a new child range. A range can only be merged with its unique buddy range, exactly the same way that the buddy memory allocator algorithm works. A topic can be sealed or deleted. Sealing a topic seals all of its ranges. Deleting a topic deletes all of its ranges.\n\nFigure 4. A topic with a few ranges that have been split and merged\n\nA topic is configured with a storage policy. Storage policies are provided by administrators of the cluster. A storage policy has a name, a retention period that defines when segments should be deleted, as well as a set of constraints. A constraint has an expression that defines which brokers are allowed to be chosen as a replica of a segment, and how many. These expressions are based on keys and values bound to brokers called attributes. These attributes are bound to a broker process by administrators. Policies and attributes are a powerful abstraction. For example, Northguard itself has no native understanding of racks, datacenters, etc. Administrators at LinkedIn just encode this state in the policies and attributes on the brokers we deploy, making policies and attributes a generalized solution to rack-aware replica assignment. We even use policies and attributes to distribute replicas in a way that allows us to safely deploy builds and configs to clusters in constant time regardless of cluster size.\n\nLog striping\n\nThe more coarse-grained your unit of replication, the more you need to worry about resource skew in your cluster. Balancing out the resource skew is difficult, and you might even rely on an entire system, like LinkedIn’s Cruise Control, just to balance resource distribution across the cluster. When your unit of replication is as coarse-grained as the log, each replica is responsible for storing a copy of the entire log. This causes a number of resource skew problems:\n\nResource skew if brokers have more logs than other brokers. New brokers added to the cluster will remain unused until new logs are assigned onto it or move existing logs onto it. Logs are created infrequently, and moving existing logs causes operability pain.\nResource skew if an unlucky broker has more resource intensive logs than other brokers.\n\n\nNorthguard ranges avoid these issues by implementing log striping, meaning that it breaks a log into smaller chunks for balancing IO load. These chunks have their own replica sets as opposed to the log. Ranges and segments are the Northguard analog of logs and chunks. Since segments are created relatively often, we don’t need to move existing segments onto new brokers. New brokers just organically start becoming segment replicas of new segments. This also means that unlucky combinations of segments landing on a broker aren’t an issue, as it will sort itself out when new segments are created and assigned to other brokers. The cluster balances on its own.\n\nFigure 5. A cluster with a newly added Broker 5\nFigure 6. A new segment gets added to the range and gets assigned to Broker 5\nRanges vs. indexed partitions\n\nWhen deciding how to scale throughput to topics with these striped logs, we wanted to:\n\nhave correct record-to-log placement by clients\nminimize interruption to unrelated logs\nmaintain some level of ordering guarantees\nfacilitate stream processing frameworks in avoiding shuffles\n\nRanges checked all the boxes for us. Whereas indexed partitions would’ve required a “stop-the-world” synchronization barrier for producing clients to continue to send records to the right log, ranges only interrupt clients producing to the range being split. This range split acts as the synchronization barrier, and forces clients to react to the changes made to the topic before continuing to produce.\n\nOn top of that, you get some nice ordering guarantees, with range splits and merges still offering a total ordering:\n\nif a range R1 is split into R2 and R3:\nall records in R1 happens-before records in R2\nall records in R1 happens-before records in R3\nif ranges R2 and R3 are merged into R4:\nall records in R2 happens-before records in R4\nall records in R3 happens-before records in R4\n\nStream processing jobs often involve joining multiple streams. To perform the join, records with the same join key across these streams need to be processed together. We can do this effortlessly by leveraging the key partitioning provided by the log storage system, as long as the partitioning of the join keys across these streams is aligned. However, if the streams being joined have unaligned partitioning of the join keys (e.g., one stream with 10 partitions and another with 16 partitions), the stream processing jobs may need to introduce a shuffle stage to repartition the records, which can be costly.\n\n\nRanges offer a better solution for stream processing, as Northguard’s buddy-style ranges of different topics inherently align. We can avoid the shuffle step entirely.\n\nMetadata model\n\nNorthguard has metadata for managing topics, ranges, and segments.\n\n\nA cluster has one or more vnodes, each storing a shard of the cluster's metadata. A vnode is a fault-tolerant replicated state machine backed by Raft and acts as the core building block behind Northguard's distributed metadata storage and metadata management.\n\nFigure 7. A vnode’s Raft group\n\nA coordinator is the leader of a given vnode. It manages all the metadata owned by a vnode. This is where the “business logic” of the metadata lives. When the vnode's state machine elects a new leader, the coordinator of the vnode moves to the new leader as well. The coordinator persists state in the vnode state machine so that a newly elected coordinator can pick up from where the previous one left off.\n\n\nFor topics owned by a vnode, the coordinator tracks changes such as sealing or deleting the topic and splitting or merging ranges from that topic. For ranges owned by a vnode, the coordinator tracks metadata like the range's active/sealed/deleting state, the creation time, the retention, and the topic name. It also stores metadata on the segments like the segment's replica set, the active/sealed/reassigning state of the segment, the start offset and length of the segment, the create time, and seal time of the segment. The coordinator uses this segment state to initiate sealed segment replication for under-replicated segments, making Northguard self-healing.\n\n\nThe Dynamically-Sharded Replicated State Machine (DS-RSM) is a collection of vnodes covering a hash ring. Metadata is sharded across vnodes using consistent hashing. Topic metadata is hashed by topic name, while range and segment metadata is hashed by range ID. This minimizes metadata hotspots.\n\n\nFigure 8. A DS-RSM with 3 vnodes\n\nA cluster can be configured with a metadata policy provided by administrators of the cluster. A metadata policy has a name and one or more constraints. These constraints behave exactly the same as the ones in storage policies, where its expressions are once again based on the attribute keys and values bound to brokers by administrators. The metadata policy defines how replicas of the vnodes are chosen.\n\nCluster state and membership\n\nNorthguard uses SWIM as its scalable group membership protocol. SWIM employs random probing for failure detection but infection-style dissemination for membership changes and broadcasts. We use this broadcast mechanism to distribute minimal global cluster state such as basic host, port, and attributes of the brokers in the cluster as well as minimal information about this DS-RSM hash ring such as each vnode's hash ring start and end boundaries, the vnode leader, vnode current term, and vnode replicas. This facilitates routing of certain requests to the appropriate vnode leader.\n\nFigure 9. The SWIM protocol in action\nProtocols\n\nNorthguard’s metadata protocols are unary: one request results in one response. Examples include CreateTopicRequest, DeleteTopicRequest, TopicMetadataRequest, and SegmentMetadataRequest. Clients send these requests to any broker in the cluster, which acts as a proxy. The broker uses its local copy of gossipped global state to determine which vnode can serve the request and relays it to the leader of that vnode. The response follows the same path back to the client.\n\nWhile metadata protocols are unary, Northguard’s produce, consume, and replication protocols are all sessionized streaming protocols. We sessionize state to the stream to avoid protocol overhead. These protocols use pipelining to keep data moving and windowing to control how much can be pipelined at any time.\n\nLet’s take produce streams as an example. The producing client generates a stream ID and initiates a handshake with the active segment leader, learning the initial window size accepted by the broker. The producer sends multiple Appends to the broker as long as the records haven’t exceeded the window. Each append contains the stream ID, sequence number, and one or more records. The broker can send M Acks for N Appends and is only allowed to send the producer an Ack for records that have been committed. These Acks include an acknowledgement number correlating with the sequence number from Append and an updated window for more Appends.\n\nFigure 10. A producer sending records and getting acknowledgements over a produce stream\n\nConsume streams are very similar to produce streams but with records flowing in the reverse direction and the client determining the window size. After the handshake, the consumer sends Reads telling the broker their progression of the stream and potentially updated window size. Brokers send Pushes as long as the records being pushed haven’t exceeded the window.\n\nFigure 11. A consumer receiving records and asking for more over a consume stream\n\nActive segment replication works similarly to produce streams, using record offsets instead of sequence numbers. ReplicaAppends also include a committed state for followers to track progress of what’s been committed.\n\nFigure 12. An active segment follower receiving records and asking for more over a replica stream\n\nSealed segment replication replenishes under-replicated segments, and is literally the consume protocol, but between two brokers.\n\nSegment storage\n\nSegment storage in Northguard is pluggable, but the primary implementation, called the “fps store,” has a write-ahead-log (WAL), creates a file-per-segment, uses Direct I/O, and maintains a sparse index in RocksDB. Appends are accumulated in a batch until sufficient time has passed (ex: 10 ms), the batch exceeds a configurable size, or the batch exceeds a configurable number of appends. Once ready to flush the batch, the store synchronously writes to the WAL, appends records to one or more segment files, fsyncs these files, and updates the index.\n\n\nWith Direct I/O, Northguard avoids double buffering, and instead uses application-level caching that leverages its knowledge of established consume streams to populate the cache. Direct I/O also enhances Northguard's durability by maintaining consistent state across fsync failures. It helps us avoid cache degradation issues we might’ve otherwise seen in the page cache on replicas that clients aren’t consuming from, or when, for example, consumers or sealed segment replication wants to consume old segments.\n\nTesting\n\nOn top of having thousands of tests, microbenchmarks, and a rigorous certification pipeline, we also run Northguard under deterministic simulation. This means we run a cluster as well as clients under a single thread and swap out nondeterministic components with deterministic versions of them. We simulate years of activity under various scenarios every day, where the scenarios are injecting many kinds of faults into the simulation:\n\nbroker shutdown\nrolling restarts\nnetwork partition\npacket loss\npacket corruption\ndisk corruption\ndisk io errors\nconfig deployments\n\n\nWe can easily share, replay, and step through failed runs, and this helps us catch bugs before they happen in production.\n\nEvaluation\n\nLet’s recap some of the key points:\n\n \tKafka\tNorthguard\nScalability: Data\tlogs bounded by machine disk capacity\tlogs bounded by cluster disk capacity\nScalability: Metadata Control Plane\t\n\nBottlenecked by:\n\n1 controller\n\n1 replicated state machine\n\n\n\n\nStressed at millions of partition replicas.\n\n\t\n\nN (128+) coordinators\n\nN (128+) sharded replicated state machines\n\n\n\n\nDoes fine with millions of segment replicas.\n\n\nScalability: Metadata Distribution\tGlobal topic metadata state\tMinimal global state\nScalability: Cluster Size\tCentralized group membership heartbeating to controller\tScalable gossip group membership\nOperability: Cluster Count\t \t80%+ fewer\nOperability: Balanced Data Distribution\tExternal service to keep the cluster balanced.\tBalanced by design\nOperability: Metadata Distribution\tN/A (metadata isn’t sharded)\tBalanced by design\nOperability: Adding Brokers\tExternal service to move existing data onto the new broker to keep the cluster balanced.\tNo need to move existing data onto new brokers.\nOperability: Replenish Replication Factor\tExternal service to restore replication factor while keeping the cluster balanced.\tSelf-healing\nAvailability\tProduce availability degrades as replicas fail\tStriping gives us higher availability. Producers move onto new segments when a segment replica fails.\nConsistency\tPartitions as the unit of replication means long periods to replenish. We configured topics to sacrifice consistency for produce availability.\tSegments as the unit of replication and log striping means that we don't need to sacrifice consistency in order to preserve produce availability when brokers start to fail.\nDurability\t\n\nLazy syncs:\n\n10 seconds\n\n20k records\n\n\t\n\nFsync on all replicas before produce ack:\n\n10 milliseconds\n\n20k records\n\n10 MB\n\n\nPerformance\t \tMeets LinkedIn’s SLOs for Kafka with better durability.\nMigrating from Kafka to Northguard\n\nMigrating user topics from one Kafka cluster to another is difficult, and migrating users from one Pub/Sub system (Kafka) to another (Northguard) is even harder. Thousands of applications, including mission-critical ones, need to be migrated. We’re talking about migrating several hundreds of thousands of topics and hundreds of clusters. Application downtime is unacceptable during migration, and handling individual applications separately is not scalable.\n\n\nPart of the migration challenge comes from users relying on the Kafka client, which talks to a single Kafka cluster at a time. The lack of virtualization complicates the transition to a new system with a different data model and protocols. Another challenge in LinkedIn’s infrastructure is that adding a new cluster to handle traffic growth is often not transparent to the users. Pub/Sub Virtualization can help by hiding physical aspects of a Pub/Sub cluster, making it possible to virtually grow a cluster without requiring changes from applications.\n\nIntroducing Xinfra\n\nXinfra (pronounced as ZIN-frah) is a virtualized Pub/Sub layer supporting both Northguard and Kafka. It offers a unified Pub/Sub experience for customers. With virtualization, a Xinfra topic is no longer tied to a single Kafka cluster. A Xinfra topic has epochs (which captures the topic change history), allowing it to have an epoch in a Kafka cluster and another in a Northguard cluster, as seen below in figure 13.\n\nFigure 13. An example Xinfra topic with multiple epochs\n\nThis means users don't need to change the topic when it is migrated between clusters at runtime. Topic virtualization also allows grouping topics located in different physical clusters under the same virtualized cluster. This enables Xinfra to federate multiple physical clusters to support large use cases that would otherwise be infeasible with a single physical cluster.\n\nFigure 14. An example use case where a consumer subscribes to three topics under the same virtual cluster, with each topic located in different clusters\n\nUsers interact with Northguard and Kafka via Xinfra clients, which provide a unified API for accessing pub/sub infrastructure at LinkedIn. Each epoch in a Xinfra topic contains a list of shards (similar to topic partition in Kafka). Xinfra producers offer \"produce to a topic\" and \"produce to a shard\" APIs. Xinfra consumers provide both manual shard assignment-based consumption and consumer group management-based consumption.\n\n\nThe Xinfra-metadata-service is a robust Pub/Sub ecosystem management system for Xinfra clients. It provides a virtualized and unified view across multiple Pub/Sub systems, streamlining operations and abstracting away the complexities of underlying infrastructure. Additionally, it offers essential Pub/Sub capabilities, such as consumer group management and checkpoint storage, at the virtual layer—ensuring a seamless and consistent experience for the users.\n\n\nXinfra-metadata-service handles virtual topics and clusters, including mapping between virtual and physical topics/shards. It also enables essential operations such as creating, updating, deleting, and migrating topics at the virtual layer. To ensure persistence, all metadata for both virtual and physical topics/clusters is stored in MySQL.\n\n\nXinfra-metadata-service also keeps track of all connected Xinfra producers and consumers, providing consumer group management and checkpoint storage over the virtual layer, ensuring a seamless experience for users.\n\n\nXinfra-metadata-service leverages Zookeeper to maintain cluster consistency, handling membership, leadership, and group allocation during consumer group management. It ensures incremental group rebalancing, fair shard allocation within consumer groups, and resilience against network partitions or crashes.\n\n\nFor checkpoint storage, Xinfra-metadata-service utilizes Vitess, a sharded MySQL solution, along with a coalescing buffer for efficiency. Additionally, it integrates Couchbase as a caching layer to achieve low-latency checkpoint reads and writes.\n\nThe Xinfra-metadata-service\nXinfra-based pub/sub migration\n\nXinfra natively supports topic migration from one cluster to another and from one Pub/Sub system to another. It leverages dual-write approaches and staged migration steps to migrate user topics. At a high level, the migration process begins by creating a new topic epoch in the target cluster. Producers are migrated first, followed by consumers. Producers perform dual writes during the migration period to allow a safe rollback in case of migration failure. Ordering guarantees are maintained through the migration process. The migration is transparent to users, and the migration state is delivered via Xinfra topic metadata update to the client. Producers and consumers continue to work throughout the migration process. The final stage of migration involves turning off dual writes. Post-migration, consumers can still read through epochs, including data in the previous epoch, until the data is deleted by retention policy.\n\nCurrent state and what’s next\n\nXinfra has been widely adopted within LinkedIn, with over 90% applications running Xinfra clients. We have successfully migrated thousands of topics from Kafka to Northguard, accounting for trillions of records per day.\n\n\nLooking ahead, our focus will be on driving even greater adoption of Northguard and Xinfra, adding features such as auto-scaling topics based on traffic growth, and enhancing fault tolerance for virtualized topic operations. We are thrilled to continue this journey!\n\nTopics: Data Streaming/Processing Scalability Infrastructure\n\nRelated articles\n\nAI\n\nAI helping build better AI: How agents accelerate model experi...\n\nAnimesh Singh \n\n \n\nMar 27, 2026\n\nAI\n\nThe LinkedIn Generative AI Application Tech Stack: Personaliza...\n\nPraveen Kumar Bodigutla \n\n \n\nMar 26, 2026\n\nFeed\n\nEngineering the next generation of LinkedIn’s Feed\n\nHristo Danchev \n\n \n\nMar 12, 2026",
     "quality_score": 9,
     "modules": [
       "architecture_patterns",
@@ -115,6 +114,43 @@
       "performance"
     ]
   },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/generative-ai/behind-the-platform-the-journey-to-create-the-linkedin-genai-application-tech-stack",
+    "title": "Behind the platform: the journey to create the LinkedIn GenAI application tech stack",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "Skip to main content\n\nGenerative AI\n\nBehind the platform: the journey to create the LinkedIn GenAI application tech stack\nAuthored by\nKarthik Ramgopal\n\nDistinguished Engineer @ LinkedIn | Full Stack + GenAI | Speaker\n\nNovember 26, 2024\n\nCo-authors: \nCo-authored by\nKarthik Ramgopal, \nCo-authored by\nXiaofeng Wang, and \nCo-authored by\nSandeep Jha\n\nIn early 2023, we started rolling out a completely reimagined product portfolio, including for the first time features that leveraged Generative AI (GenAI). These GenAI features have enabled our members and customers to work more efficiently, using tools such as collaborative articles, AI-assisted Recruiter, AI-powered insights, and most recently, our first AI agent, Hiring Assistant.\n\nIn the short period of time since the first GenAI feature made its way onto the platform, we’ve undergone remarkable change, learning and growth in our approach to building these unique product features and experiences. We went from launching products based on simple “prompt in, string out” solutions to crafting assistive agent experiences that offered multi-turn conversation capabilities supported by advanced contextual memory. In parallel, we gradually realized our early vision of building a GenAI application tech stack to power these products, which included continuously optimizing between time to market goals and long-term leverage.\n\nThis blog post will cover the work that happens below the surface of our AI-powered products and focus on our journey in building the GenAI application tech stack that enables them. As we delve deeper into various decisions around GenAI frameworks, programming languages, and the intricacies of bridging offline development with online deployment, you will get a peek into what it takes to build AI-first products at LinkedIn scale.\n\nGenesis and evolution\n\nOne of the earliest challenges we faced is not an uncommon one for any new technology being adopted rapidly at scale - building a shared technology foundation to maximize leverage. The solution manifested as a framework to act as the hub of GenAI application development at LinkedIn, providing standard mechanisms for common tasks like prompt construction, inference, memory access and more.\n\nSince most of the LinkedIn online serving stack was programmed in Java, our initial pragmatic approach was to build a shared Java midtier for all GenAI products encapsulating common functionality as built-in reusable Java code. As the number of use cases grew, this midtier became a development and operational bottleneck, prompting us to split things up into multiple different use-case specific Java midtier services.\n\nThe AI engineers working on the offline Large Language Model (LLM)-based workflows, prompt engineering and evaluations preferred Python given the plethora of open source Python solutions in this domain. Rather than be blocked by the onerous task of rebuilding this tooling in Java or getting our online serving stack to support Python, we made a conscious call to start with fragmented online and offline stacks with basic tooling to bridge them. \n\nMoving forward with the fragmented approach helped keep our momentum in the short-term, but we quickly faced challenges in maintaining that direction as we scaled. It required substantial effort to prevent divergence across the various Java midtier services and keep logic mirrored across the offline Python and online Java stacks. Maintaining all of this amidst active product development and updates to underlying framework versions proved taxing. \n\nAs the GenAI landscape and associated open source libraries continued to evolve primarily in Python, it became clear that staying on Java for serving was a suboptimal long-term choice. We decided to invest in Python as a first-class language for both offline iteration and online serving at LinkedIn.\n\nBy this time, significant momentum had built around the LangChain open source project, including our own adoption of it for our offline stack. Our collaborative and productive relationship with the LangChain developers, and a deep analysis of areas like functionality, operability, open source community involvement, evolution track record, and future extensibility convinced us to use it for online serving as well.\n\nSince LinkedIn had historically used Java almost exclusively for online serving, a lot of our online infrastructure for RPC, storage access, request context passing, distributed tracing and more, only had Java client implementations. Considering our emphasis on Python, we kicked off an initiative to enable Python support for critical infrastructure dependencies with few key principles in mind.\n\nPragmatic prioritization: While it would have been great to have Python equivalents of everything available in Java, doing so was rather expensive. We resorted to stack ranking requirements while coming up with creative solutions to bridge the gaps. For example, we implemented only a part of the request context spec in Python, because we didn’t need some functionality like bidirectional context passing for our GenAI applications, significantly reducing scope. We did not build a native Python client for Espresso (our online distributed document store) and instead used an existing REST proxy to talk to it.\nOpportunistic alignment with migrations to future tech: Rather than building support for Python clients for existing infrastructure, we looked at the state and adoption progress of upcoming tech, and opportunistically built support only for future tech. For example, LinkedIn is transitioning RPCs from rest.li to grpc; so rather than building support and closing gaps for several key RPC-related infrastructure pieces (such as request context passing, distributed tracing, call logging, service to service ACLs, etc.) atop both rest.li and gRPC, we built them only for gRPC.\nFirst-class developer experience: We wanted the Python developer experience to feel native without any shortcuts affecting debuggability or operability. This has translated to investing in Python native builds (in lieu of our legacy grade based build system), re-engineering solutions that involve Python code calling C/C++ code in parts that developers frequently debug to be fully Python native, tooling automation to ease importing open source Python libraries for use within LinkedIn, and investing in tooling and processes to ensure that we stay on a reasonably new version of the Python language and runtime.\n\nOur GenAI application framework is now a thin wrapper atop LangChain, bridging it with LinkedIn infrastructure for logging, instrumentation, storage access and more. It is vended as a versioned internal library that is now mandated for use by all new GenAI applications at LinkedIn.\n\nTop Takeaway: Given the relative recency and rapid evolution of GenAI, there is no one-size-fits-all formula for scalable product development. So engineering organizations - from practitioners to leaders - should make calculated framework investments that balance pragmatism and time to market with long-term leverage.\n\nPrompt management\n\nPrompt engineering is core to building GenAI applications with prompts providing the primary mechanism to “program” Large Language Models (LLMs). Prompt management refers to the system and processes in place to manage and curate these prompts across GenAI applications. \n\nOur initial approach was manual string interpolation in code. While sufficient for basic use cases, this quickly proved error-prone and unscalable. \n\nAs we considered more complex approaches to prompt engineering, we made some initial observations that were critical in shaping our ultimate path forward. \n\nWe noticed many use cases benefited from partial or full prompts for shared functionality. Since Trust and Responsible AI are core requirements for all our products, there was an opportunity to universally inject guardrails that supported both into all our prompts. \nIt was also essential to ramp new prompt versions gradually to ensure that they did not break or worsen existing product experiences.\n\nTo provide more structure around modularization and versioning, we introduced a Prompt Source of Truth component. We standardized the use of the Jinja template language for authoring prompts, and built a Java prompt resolution library to avoid common string interpolation bugs. \n\nAfter we built our standard application framework in Python atop LangChain, we subsumed the prompt resolution library into it, rewriting it in Python. Since Jinja offers Python-like expressions, the developer experience became even more fluent and native post this switch.\n\nAs conversational assistants with multi-turn conversational UIs emerged, we enhanced this component to provide more structure around human and AI roles in conversations, eventually converging on the OpenAI Chat Completions API once it was released and widely adopted.\n\nAll prompt engineers at LinkedIn today author prompts using the prompt source of truth guidelines. Developers are also required to adhere to the modularization and versioning requirements imposed by this component for storing their prompts, and in exchange receive fluent sharing across prompts as well as seamless integration into the rest of the application framework.\n\nTop Takeaway: Prompt management can start off as deceptively simple string management, but there is a ton of nuance that includes (but is not limited to) providing systems and developer guidance for managing templating, versioning and prompt structure to make it work at scale for engineering complex GenAI applications.\n\nTask automation via skills\n\nLinkedIn has been a strong proponent of a skills-based approach to many aspects of work. A skill can be a particular attribute that is acquired either via learning or experience and useful for completing tasks associated with a job. We extended the same abstraction to our GenAI applications to use skill as a mechanism to enable task automation.\n\nThe skill abstraction in our framework enables LLMs to move beyond vanilla text generation and use function calling for Retrieval Augmented Generation (RAG) or task automation by converting natural language instructions in the prompts into API calls. In our product, this manifests itself as skills for viewing profiles, searching for posts, querying internal analytics systems and even accessing external tools like Bing for search and news.\n\nInitially, we built this within each GenAI product as custom code that wrapped existing LinkedIn internal and external APIs (like Bing Search) using LLM friendly JSON schemas that could be used with the LangChain tool API. However, this approach ran into some scaling bottlenecks.\n\nTeams often re-implement the same skills in different products. While we tried to consolidate some popular ones via internal libraries, keeping the libraries up to date and working with various minor product differences became cumbersome.\nAs the downstream invoked by the skill evolves, the skill also needs to be updated in tandem.\nApplication developers need to manually specify the skill or set of skills to use in the prompt.\n\nTo overcome these issues, we came up with Skill Inversion. Instead of the calling applications defining skills over the implementing downstreams, the downstreams define the skill and expose it to the calling application, thus organically eliminating the duplication and evolution problems.\n\nWe have eased the process of skill access, development and operations by building the following:\n\nA centralized skill registry service that allows definitions to be added and retrieved (via skill ID or semantic search) at runtime.\nBuild plugins that easily enable downstream applications to annotate their endpoint implementations and automatically register them in the skill registry service with the necessary validations around schema structure and documentation, as part of the build.\nA dynamic LangChain tool that retrieves skill definitions from the skill registry and invokes the actual skill with the supplied arguments, eliminating developer specified skills in prompts and giving significantly larger agency to LLMs.\n\nWith this infrastructure in place, we are gradually evolving our tech stack by creating skill abstractions for all APIs, enabling LLMs to interact seamlessly with them to achieve richer, more impactful outcomes.\n\nTop Takeaway: There is significant product value unlocked by using GenAI for task automation vis-a-vis content generation. However, intentional full stack tooling is necessary to enable GenAI applications to perform task automation by scalably leveraging the same APIs called by human developers using imperative code.\n\nContextual awareness and personalization\n\nContextualization and personalization are considered essential for a great GenAI product experience, but are not available out of the box since LLMs are stateless by default (i.e., each incoming query is processed independently of other interactions). \n\nThe workaround for this limitation is to build a Conversational Memory Infrastructure to store LLM interactions, retrieve past context and inject it into future prompts, to share “state” with the LLM and offer a coherent product experience.\n\nOur initial solution to this problem used Couchbase or Espresso databases as storage. Application teams were responsible for repetitive tasks such as setting up databases, writing requests/responses to the databases, and reading from memory before inference.\n\nHowever, we soon needed more than raw conversation storage and retrieval. Since LLM context windows are limited and increasing input tokens has cost/latency implications, it was important to retrieve only the relevant parts of the conversation rather than the entire conversation history. To enable this, we needed semantic search (using embeddings) and summarization capabilities.\n\nRather than build yet another system ground up to solve this at scale, we decided to leverage the LinkedIn messaging stack for a few reasons:\n\nThe conversations between a human and GenAI applications were akin to human to human conversations, so much of the functionality of the messaging stack could be reused as-is.\nThe stack was proven to work in production with high availability and reliability.\nEnhancements we needed, like semantic search and summarization, would also be useful for product use cases outside of GenAI applications.  \nLeverage was created by the low-latency reliable delivery of messages to mobile/web clients and state synchronization across devices.\n\nWe have now integrated our LinkedIn messaging based Conversational Memory infrastructure into our GenAI application framework using the LangChain Conversational Memory abstraction, making integration seamless for application developers.\n\nAs our GenAI applications became more advanced, we noticed a trend of needing to derive signals based on the experience of user-application interactions. Examples of such signals in our product include voice and tone for authoring text, preferred notification channel (in-app vs push vs email), choice of UI templates for visualizing AI-generated content. We call this Experiential Memory (i.e. memory derived based on experience) and offer a solution with drop-in GenAI application framework integration, and support for partial retrievals and updates.\n\nTop Takeaway: Memory is core to the ability to learn from activities or interactions, incorporate feedback and preferences, and build expected personalized and beneficial experiences in product. Depending on the use case, memory is fast becoming a critical capability that requires thoughtful integration into tech stacks.\n\nModel inference and fine tuning\n\nThe advent of GenAI with powerful foundational LLMs that could be prompted to perform a wide variety of tasks turned traditional AI modeling paradigms on their head. Our initial GenAI applications wholeheartedly embraced this new trend and solely used LLMs provided by the Azure OpenAI service. All requests were routed via a centralized GenAI proxy which offered functionalities like Trust and Responsible AI checks, seamless support for new models and model versions, incremental response streaming to reduce user-perceived latency and quota management to ensure fair use of relatively expensive LLM resources across various products.\n\nOur GenAI applications have increasingly started depending on our AI platform, which is built atop open source frameworks like PyTorch, DeepSpeed, vLLM and provides a robust and highly scalable fine-tuning and serving infrastructure. In our experience, LLMs like Llama, when fine-tuned for LinkedIn specific tasks, often achieve comparable or better quality as state of the art commercial foundational models on these tasks, but at much lower costs and latencies. In keeping with LinkedIn’s ‘members first’ ethos, we also built a setting to enable LinkedIn members to more easily control whether their data is used for training or fine-tuning these models.\n\nTo make the experience of application developers transparent across external and internal models, we have invested in the following areas:\n\nOur inference layer exposes an OpenAI Chat Completions API for all LLMs in use. This always allows application developers to program to this API regardless of the underlying model.\nConfiguration hooks in the application framework allow easy switching between on-prem and external models, without application developers having to worry about the routing details. This also allows developers to easily experiment with different underlying models for the same use case for local debugging and A/B tests in production.\n\nTop Takeaway: Both proprietary and open-source LLMs are evolving at a rapid pace. There is often no one-size fits all solution, and there are various nuanced trade-offs around quality, cost, latency and more to navigate. Engineering organizations that strategically build their tech stack with sufficient abstractions to reuse the same core infrastructure across different models will see long-term benefits and leverage in efficiency and the capabilities of their products.\n\nMigration\n\nAs our GenAI application stack developed and evolved, it was important to rapidly migrate off legacy bespoke solutions to more standardized ones, to minimize tech debt and increase leverage. We handled these migrations using a lean team combining engineers with deep knowledge of our historical Java stack and engineers working on the new stack. Our migration followed the following principles:\n\nIncrementality: Rather than do a big bang migration of all components, we decided to migrate individual components one by one. For example, as soon as the LinkedIn messaging based conversational memory infrastructure was ready, we migrated many of the Java based GenAI applications to it, without waiting for the Python LangChain GenAI application framework migration. For the arguably larger GenAI application framework migration, we started with the simpler and smaller apps first before handling the more complex and larger ones. Each migration followed a depth first approach with a small team first prototyping, identifying gaps and fixing them in a small part of the app. This would be followed by a larger team going breadth first across the app doing the actual migration and setting up the A/B tests to ramp the new stack gradually. This led to progressive learnings and wins, ensured high levels of operational stability, and minimized the impact to the product roadmap of application teams.\nUpskilling talent: Many of our senior engineers were proficient Java developers but needed to gain more Python experience. We paired them up with earlier in career but more experienced Python developers, to learn on the job, and take an “accelerated Python class”.\n\nWe have successfully migrated many of our existing applications to our new stack, with a handful of stragglers expected to finish within the next month.\n\nFinal thoughts\n\nOur new GenAI application tech stack embraces AI-first development, lays a solid foundation for building GenAI apps efficiently and responsibly, and accelerates innovation in collaboration with the AI community. This technological groundwork is crucial in achieving our vision to bring economic opportunity to every member of the global workforce.\n\nThis blog only covered part of the tech stack centered around the GenAI application framework and its immediate adjacencies. To build and launch production-grade GenAI applications, we also depend on several other critical areas like our AI platform, in-house modeling, Observability and Monitoring stack, Responsible AI/Trust services and Evaluation process/frameworks, some of which we may cover in a future blog post.\n\nDespite reaching significant milestones, numerous challenges remain. As the cutting edge of product experiences moves from conversational assistants to AI agents, we are seeing an influx of additional functional and operational requirements for our rapidly evolving tech stack. Stay tuned for more technical details around these areas as we build and learn.\n\nAcknowledgement\n\nBuilding our application tech stack amidst the rapid evolution of the GenAI landscape is truly a collaborative effort. We would like to thank Donald Thompson, Xavier Amatriain and Ya Xu for their vision and leadership in architecting and initiating our GenAI platform initiatives, along with the entire leadership team:, Kapil Surlaker, Zheng Li, Animesh Singh, Swapnil Ghike, Praveen Bodigutla, Grace Tang, Mary Hearne, Tyler Grant, Chanh Nguyen. \n\nA special thanks goes to our engineering teams who developed the critical components of our tech stack: David Tag, Yi Liu, Nicolas Nkiere, Xiaonan Ding, Don Jung, Eugene Jin from the GenAI Foundations team; Suruchi Shah, Tiffany Zhou, Shangjin Zhang, Jason Belmonti, Ali Naqvi, Sasha Ovsankin from the AI Platform team; Han Wang, Tony Guan from the Python team; Benny Soetarman, Qishen Li, Pantelis Apostolopoulos from the System Infra team; Adam Kaplan, Tim Chao, Eddy Li from the Product Engineering team, and Priyanka Gariba, Sunil Ayyappan, Manish Khanna, Alex Xia, and Naqeeb Abbasi from the TPM team.\n\nFinally, we want to express our deepest appreciation to our product engineering teams who are not only dedicated to building exceptional GenAI products but also providing us with invaluable feedback. This includes Juan Bottaro, Chenglong Hao, Daniel Hewlett, Xie Lu, Haichao Wei, Christopher Lloyd, Lukasz Karolewski, Parvez Ahammad, Lijun Peng, Avi Romascanu, Pierre Monestie and many others. Your passion and contributions are the driving force behind our success.\n\nTopics: Generative AI AI Infrastructure\n\nRelated articles\n\nAI\n\nAI helping build better AI: How agents accelerate model experi...\n\nAnimesh Singh \n\n \n\nMar 27, 2026\n\nAI\n\nThe LinkedIn Generative AI Application Tech Stack: Personaliza...\n\nPraveen Kumar Bodigutla \n\n \n\nMar 26, 2026\n\nFeed\n\nEngineering the next generation of LinkedIn’s Feed\n\nHristo Danchev \n\n \n\nMar 12, 2026",
+    "quality_score": 9,
+    "modules": [
+      "ai_assisted",
+      "integration",
+      "python_patterns",
+      "dx"
+    ]
+  },
+  {
+    "url": "https://www.uber.com/blog/from-static-rate-limiting-to-intelligent-load-management/",
+    "title": "How Uber Conquered Database Overload: The Journey from Static Rate-Limiting to Intelligent Load Management",
+    "source_name": "Uber Engineering",
+    "text": "Skip to main content\nJanuary 13, 2026\nHow Uber Conquered Database Overload: The Journey from Static Rate-Limiting to Intelligent Load Management\nChaitanya Yalamanchili\nDhyanam Vaidya\nPrathamesh Deshpande\n1+\nShare this article\nIntroduction\n\nUber’s thousands of microservices handle traffic for over 170 million monthly active users: riders, Uber Eats users, drivers, and couriers. At the heart of this infrastructure are Docstore and Schemaless, Uber’s in-house distributed databases built on top of MySQL®. These databases span thousands of clusters, store tens of petabytes of operational data, and serve tens of millions of requests per second with billions of rows read or updated. They back some of the most latency-sensitive and mission-critical workloads, powering every business vertical at Uber: from rides and deliveries to maps, payments, and beyond. \n\nAt this scale, even minor overloads aren’t isolated events, they cascade. A brief spike in one part of the system can ripple outward: downstream services time out, retries pile up, and degradation amplifies into broader failure. In a multitenant environment, it’s also critical to ensure fairness and prevent any tenant from hogging all the resources. With workloads varying in traffic shape, latency profiles, and system impact, building effective overload protection is a uniquely challenging problem.\n\nThe cost of getting overload protection wrong is steep. This blog shares how we built an intelligent load manager that detects overload from multiple signals to keep our databases stable and fair under pressure.\n\nDocstore and Schemaless\n\nBefore diving into the load manager that protects Uber’s databases, let’s walk through their architecture.\n\nWhile Docstore supports transactions with full CRUD operations and Schemaless is optimized for append-only workloads, both share a common architectural foundation. It comprises three primary layers: a stateless query engine, a stateful storage engine, and a control plane. For the scope of this blog, we’ll focus on the query and storage engine layers.\n\nFigure 1: Docstore and Schemaless architecture.\n\nThe stateless query engine is responsible for query planning, request routing, sharding, schema management, authorization, request parsing, and validation. It serves as the routing layer: coordinating and validating client requests before handing them off to the storage layer.\n\nThe stateful storage engine handles transaction management, connection pooling, consensus, and replication. Data is sharded across multiple partitions, with each partition consisting of one leader and two followers, coordinated via Raft to ensure strong consistency. Each partition is backed by MySQL nodes with locally attached NVMe SSDs, built to support high-throughput, low-latency workloads at scale.\n\nChallenges\nQuota-Based Rate Limiting in the Query Engine Layer\nFigure 2: Quota-based rate-limiting setup.\n\nInitially, we explored a quota based rate-limiting approach within the stateless query engine layer. The concept was simple: assign each read and write request a capacity unit cost based on bytes processed, grant users fixed quotas, and return a 429 when those quotas were exceeded. Since routing nodes were stateless, we stored quota usage in a central Redis® cache. While conceptually sound, this approach didn’t hold up in production.\n\nFirst, it added unnecessary complexity. Every request required a Redis call, introducing a new point of failure and the overhead of an additional network hop.\n\nFurther, for the stateless routing layer to accurately shed requests for an overloaded storage partition, it’d need to maintain realtime health and load information for thousands of partitions across the system. This introduced a lot of tracking overhead, undermining the scalability of the architecture.\n\nThe cost model was also too imprecise. In Docstore and Schemaless, due to the way MySQL handles scanning and filtering, a query that performs a full table scan but returns a single row was assigned the same capacity cost as a query that only reads a single row. This fundamental flaw in our metering meant that lightweight and heavyweight operations were treated the same, making quota enforcement unreliable.\n\nFinally, quotas were defined statically, resulting in frequent requests from stakeholders to adjust their quotas, making them ineffective in multitenant environments. \n\nDespite its initial promise, this approach failed. But it gave us a crucial insight: overload management must live as close to the storage nodes as possible. That realization became a cornerstone of the final design in the stateful storage layer.\n\nIdentifying the Right Signal for Overload\n\nA core challenge in designing a resilient load manager is choosing a reliable signal for overload. Simple QPS-based rate limiting is too coarse. It fails to account for workload variability, often shedding too late or too early. What can be more effective is concurrency: the number of operations currently in flight. It directly reflects system load, following Little’s Law: Concurrency = Throughput × Latency. In stateful systems, it maps closely to resource usage, making it a more dependable indicator.\n\nBalancing Resilience and Fairness\n\nBalancing resilience and fairness is a core challenge in multitenant systems. During ‌system-wide stress, we want to shed traffic by priority, dropping low-priority requests first. But when a single noisy actor hogs resources without triggering global overload, we also need per-tenant rate limiting that works independently of the system load. This dual requirement led us to combine dynamic overload detectors with fairness enforcement mechanisms that operate in parallel.\n\nBuilding the Foundation of a Unified Load Manager\nFigure 3: Initial load manager setup with CoDel queue.\nControlled Delay: Smarter Queuing Under Pressure\n\nThe load-shedding journey began with CoDel (Controlled Delay), a concept borrowed from networking to combat bufferbloat. Instead of shedding based on queue length, CoDel looks at how long requests wait in the queue: favoring responsiveness over volume.\n\nWe implemented separate CoDel queues for each operation type:\n\nRead queue: for point lookups and light queries\nWrite queue: for insert, update, and upsert operations\nSlow queue: for long-running and background operations like scans, deletes, or replication\n\nEach queue was managed independently, giving us better isolation across workloads.\n\nFigure 4: CoDel queue behavior.\n\nFIFO queuing wasn’t enough because a pure FIFO queue processes requests in arrival order, which works well when traffic is stable. But under overload, FIFO creates a trap: old requests accumulate, wait too long, and often get abandoned or retried by the client. This results in wasted work. Meanwhile, fresh requests, still relevant and likely to succeed, sit idle at the end of the line.\n\nCoDel introduces adaptive LIFO to solve this. Figure 5 shows how it works.\n\nFigure 5: CoDel algorithm.\n\nUnder normal load, the queue behaves as FIFO. Under pressure, it switches to LIFO, favoring newer requests that still have a chance to succeed. This simple shift improves responsiveness by failing fast, shedding stale work, and giving fresh requests priority. \n\nScorecard Engine\n\nThe Scorecard engine is a rule-based admission control component and a lightweight quota system designed to enforce per-tenant concurrency limits in multitenant environments. While load-shedding protects the system during overload, Scorecard ensures that no single tenant can dominate shared infrastructure, even in normal conditions. \n\nThe configuration is simple and deterministic.\n\nFigure 6: Scorecard rules.\n\nThe primary benefit of the Scorecard lies in incident containment. It helps pinpoint the source of disruption during outages or traffic spikes. It isolates and caps misbehaving tenants without disrupting others, balances stability during normal load with strict limits under stress, and reduces blast radius during overload events by enforcing boundaries quickly and deterministically.\n\nThe Scorecard provides predictable fairness and blast radius control, especially when multiple tenants are competing for shared resources.\n\nRegulators\n\nWhile Scorecard protects against concurrency-based overuse, it doesn’t cover all the ways a stateful database system can overload. Some forms of skews are subtle. They don’t show up in concurrency saturation, but they can still degrade system performance if left unchecked.\n\nFor example, a low QPS caller can still overload the system by sending large write payloads. Or, traffic skewed to one partition key can overload a single cluster while others sit idle.\n\nTo guard against these skewed behaviors, we introduced plug-in regulators: node-local overload detectors that enforce invariants the system mustn’t violate. They rarely trigger during healthy operation, and that’s by design. At the same time, when users accidentally create hotspots or large data ingestions, regulators kick in to prevent cascading failures.\n\nWe use these regulators:\n\nWrite bytes regulator: Limits concurrent write volume to prevent I/O saturation\nPartition key regulator: Throttles traffic targeting hot partition keys\nMemory regulator: Tracks free process memory and throttles when we’re low on memory\nGoroutines regulator: Tracks total number of goroutines and throttles when it exceeds threshold\nWhat Worked Well\n\nBy shedding excess requests, our CoDel queues prevented runaway resource exhaustion, which led to improved stability and a higher success rate for accepted requests. This approach was particularly effective at ensuring that core system functionality remained available during overloads.\n\nFigure 7: Improved availability.\n\nThe Scorecard engine successfully isolated misbehaving tenants by enforcing per-tenant concurrency limits. This allowed us to quickly contain disruptions from noisy neighbors without penalizing other users, ensuring that shared resources were used fairly.\n\nLimitations\n\nWhile this initial setup laid the foundation for overload protection and fairness, it came with a few limitations. First, CoDel treated all requests equally, dropping low-priority and user-facing traffic alike, leading to a bad customer experience and increased on-call load.\n\nCoDel also relied on fixed queue timeouts and static inflight concurrency limits, which can be a low-fidelity solution for a dynamic system, requiring frequent manual tuning and leading to operational toil.\n\nThe fixed, static wait times in CoDel led to a thundering herd problem. When requests were eventually rejected, they’d all retry at once, triggering repeated cycles of overload and rejection. During these periods, the lack of traffic differentiation meant even high-priority requests were dropped, leading to customer-visible errors and amplifying the blast radius.\n\nUltimately, it kept things from breaking, but lacked the nuance and dynamism required for a high-quality user experience. This highlighted the need for dynamic and priority-aware queues.\n\nEvolving the Architecture\nCinnamon Replaces CoDel\n\nWe observed that many overloads stemmed from low-priority, asynchronous jobs: pipelines, aggregators, and internal garbage collection flows. These shouldn’t have the same survivability as ride requests or real-time pricing queries.\n\nTo address this, we replaced CoDel with Cinnamon, a priority-aware load shedder developed by the Delivery team at Uber. Cinnamon makes smarter shedding decisions by considering request rank, dynamic system state, and the relative importance of workloads. \n\nRequest rank is derived from the priority attached to the request, and if no explicit priority is present, Cinnamon assigns a default based on the calling service. Priority is defined using a tiering model from tier 0 (t0) for the most critical traffic to tier 5 (t5) for the least. While t0 is reserved for a small subset of critical infrastructure services, t1 represents the most important user facing online traffic, the core workloads we aim to protect during overloads. This system allows Cinnamon to shed lower-priority traffic first during overload.\n\nWith request priority awareness in place, we simplified the queue structure to just read and write queues. Long-running and background operations were marked with lower priority instead of having a separate queue.\n\nFigure 8: Updated load shedder setup with Cinnamon queue.\n\nBefore Cinnamon, the CoDel queue load shedder was priority-agnostic and shedding during overload was indiscriminate.\n\nFigure 9: Priority Agnostic Load shedder setup with CoDel queue.\n\nAfter Cinnamon, the queue load shedder was priority-aware and shedding during overload happened in order of priority.\n\nFigure 10: Priority Aware Load shedder setup with Cinnamon queue.\nPerformance and Stability Gains\n\nWe saw performance and stability gains from the Cinnamon-based design. Requests are ranked, allowing Cinnamon to shed low-priority traffic first, protecting user facing flows. During overloads, critical user-facing requests are better protected with minimal impact. \n\nFigure 11: Prioritized shedding in action.\n\nCinnamon also adapts queue timeout thresholds using P90 latency metrics, eliminating the need for manual tuning. Moreover, its Auto Tuner dynamically adjusts inflight limits, represented by the available slots in the blue box in Figure 10, to maximize throughput. It does this by continuously monitoring and reacting to realtime latency and error rate signals, ensuring stable and effective load shedding.\n\nUnlike CoDel’s static approach, which aggressively rejects all requests after a fixed wait time, like 5 milliseconds, Cinnamon’s PID-based control allows the system to absorb pressure without overreacting. It dynamically adjusts queue timeouts and inflight limits based on realtime latency and error signals, shedding only when necessary. This prevents a large class of premature shedding that would otherwise lead to unnecessary rejections, retries, and thundering herd effects. The result is smoother recovery, fewer 429s, and more consistent availability without compromising system health.\n\nFigure 12: Reduced premature shedding.\nAreas for Improvement\n\nDespite the gains from Cinnamon, some key challenges remained, highlighting the need for a unified platform.\n\nThe load manager acted based on the local health of the server, tracking signals like inflight concurrency, write bytes, or memory usage. But in distributed systems, overload isn’t always local. A leader node may need to shed traffic because follower nodes are lagging, even if it’s healthy itself. We call this commit index lag. Traditionally, external components using token-bucket-based rate limiters handled such remote shedding decisions. These were easy to build but proved ineffective at scale, introducing split-brain behaviors and globally suboptimal shedding decisions.\n\nThe initial design was excellent for concurrency-based shedding, but it wasn’t built to be a reusable platform for future overload signals that would inevitably arise from a growing system.\n\nThese insights led us to the final evolution of our system: transforming Cinnamon from a concurrency only shedder into a truly general purpose overload control engine. By consolidating all signals into a single, modular decision-making loop, we achieved holistic and consistent overload management.\n\n\nThe Unified Load Shedding Engine\nCentralizing Overload Decisions\n\nWe enhanced Cinnamon to support pluggable external signals like follower commit lags, enabling the system to make globally informed, priority-aware shedding decisions within the same admission control path. This shift unified local and remote overload logic into a single control loop, closing the gaps that previously caused instability.\n\nFigure 13: Unified load-shedding engine in Cinnamon.\n\nBut shedding isn’t always a one-size-fits-all decision and that’s where the load manager architecture shines. Built on a BYOS (Bring Your Own Signal) ethos, it provides a pluggable framework that lets the team embed new overload signals and route them to the right control path. Whether the pressure is systemic or actor-specific, the load manager sheds broadly by priority or precisely by caller, based on the signal. \n\nFigure 14: Bring your own signal.\nThe Payoff: Unified Control, Simplified Load Management\n\nThe shift to a centralized, pluggable architecture made the system more stable and predictable, with real wins.\n\nCinnamon sheds excess requests immediately using a PID controller, avoiding the memory and goroutine buildup caused by token bucket limiters. This led to lower tail latencies and a leaner resource usage profile, even under heavy load. We saw: \n\n80% increase in throughput under overload (QPS average of 5,400 versus 3,000)\n~70% reduction in P99 latency (upsert average of 1.0 seconds versus 3.1 seconds)\n~93% fewer goroutines during overload (peak 10,000 versus 150,000)\n~60% lower heap usage (1 GB max versus 5-6 GB spikes)\nFigure 15A: (Before) Token bucket latency and resource profile.\nFigure 15B: (After) Cinnamon latency and resource profile.\n\n\nWe also saw smoother, more predictable shedding behavior. Without PID regulation, shedding acts like a hammer: reactive and abrupt. With it, it’s more like a dimmer switch: smooth and stable. The difference is clear when comparing how commit lag stabilizes under a token bucket limiter versus Cinnamon’s PID-based controller.\n\nFigure 16A: (Before) Token bucket spiky shedding pattern.\nFigure 16B: (After) Cinnamon’s stable shedding pattern.\nLessons Learned \nPrioritization is paramount. Effective load-shedding starts with deciding what matters most. Protect critical, user-facing traffic first. Everything else is secondary.\nFail fast, don’t block. Rejecting early is almost always better than holding requests in memory until they expire. It reduces wasted work, keeps latencies predictable, prevents OOMs, and makes the system more resilient under stress.\nPID regulation for stable shedding. Simple, reactive shedding based solely on current error rates often causes instability, overcorrecting too late, and too hard. PID based regulation brings balance by incorporating system history and directional trends, making it a critical tool for smooth, sustained, and resilient overload control.\nPlace control close to the source of truth. The best shedding decisions happen where the state lives. Protection in the layer that has full context, typically the storage layer in stateful systems.\nEmbrace dynamism. Avoid static configurations wherever possible. Your system should be intelligent enough to adapt to different scenarios, based on the context.\nInvest in visibility and monitoring. Good observability is the foundation for tuning and trust. Track what’s being shed, why it’s being shed, and how each component contributes to system pressure.\nSimplicity over complexity. This is a meta principle that guides all the other decisions. \nConclusion\n\nOur journey to a resilient load manager was defined by the unique complexities of a large-scale, stateful, and distributed environment. By unifying disparate components into a single decision-making brain and adopting a Bring Your Own Signal model, we gained the flexibility to handle systemic overloads and localized noisy neighbor issues with precision. The result is a load management system that sheds smarter in a priority-aware manner, keeps tail latencies low, and drastically reduces operational toil. \n\nIf you like challenges related to distributed systems, databases, storage, and cache, apply for open positions here.\n\nAcknowledgments\n\nA project of this scope is rarely accomplished alone. Our sincere thanks to Rich Porter, Jesper Nielsen, Piyush Patel, and the engineers from the Storage and Delivery teams for their guidance and collaboration throughout this journey. From design reviews to on-call insights, their contributions were instrumental in building a resilient system that now safeguards some of Uber’s most critical infrastructure.\n\nCover Photo Attribution: “Heavy Traffic Jam in Urban City Center” by Dapur Melodi\n\nMySQL is a registered trademark of Oracle and/or its affiliates. Other names may be trademarks of their respective owners.\n\nRedis is a trademark of Redis Labs Ltd. Any rights therein are reserved to Redis Labs Ltd. Any use herein is for referential purposes only and does not indicate any sponsorship, endorsement or affiliation between Redis and Uber.\n\nCategory\nEngineering\nBackend\nWritten by\n\nChaitanya Yalamanchili\n\nChaitanya Yalamanchili is a Sr. Manager and technical lead on Uber’s Storage Platform team. He leads the development of online distributed storage systems with a focus on providing a world-class platform that powers all the critical business functions and lines of business at Uber. The platform serves tens of millions of QPS and stores tens of Petabytes of operational data.\n\nDhyanam Vaidya\n\nDhyanam Vaidya is a Software Engineer on Uber’s Storage Platform team. He’s contributed to the design and implementation of many Docstore features. His work focuses on improving the reliability, resilience, and operational efficiency of Uber’s distributed databases at scale.\n\nPrathamesh Deshpande\n\nPrathamesh Deshpande is a Staff Engineer on Uber’s Storage Platform team, building database features and distributed storage systems that meet Uber’s global reliability and performance requirements. His work focuses on large-scale data management, distributed database storage systems, and platform reliability.\n\nMike Ma\n\nMike Ma is a Staff Software Engineer on Uber’s Storage Platform team, where he has contributed to multiple core components of both Schemaless and Docstore. His work focuses on scalability, reliability, performance, and operational excellence across Uber’s large scale distributed databases.\n\nRelated Articles\n6 articles\nBackend\nEngineering\nHow Uber Executed A JUnit Migration at Massive Scale\nApril 7, 2026\nData / ML\nEngineering\nUnder the Hood: Scaling Responsible AI at Uber\nApril 2, 2026\nData / ML\nEngineering\nUber AI\nHow Uber Built an Agentic System to Automate Design Specs in Minutes\nMarch 11, 2026\nData / ML\nEngineering\nUber AI\nTransforming Ads Personalization with Sequential Modeling and Hetero-MMoE at Uber\nMarch 10, 2026\nBackend\nEngineering\nBuilding High Throughput Payment Account Processing\nMarch 5, 2026\nData / ML\nEngineering\nSecurity\nSuperuser Gateway: Guardrails for Privileged Command Execution\nFebruary 26, 2026\nWe use cookies\n\nSelect “Accept” to enable Uber to use cookies to personalize this site. We use cookies to remember your location, deliver ads, and measure ad effectiveness on other apps and websites, including social media. Customize your preferences in your Cookie Settings, or select Reject if you only want us to use essential cookies. Learn more in our Cookie Notice.\n\nCookie settings\nReject\nAccept",
+    "quality_score": 9,
+    "modules": [
+      "error_resilience",
+      "performance",
+      "concurrency"
+    ]
+  },
+  {
+    "url": "https://www.uber.com/blog/perfinsights/",
+    "title": "PerfInsights: Detecting Performance Optimization Opportunities in Go Code using Generative AI",
+    "source_name": "Uber Engineering",
+    "text": "Skip to main content\nJuly 22, 2025\nPerfInsights: Detecting Performance Optimization Opportunities in Go Code using Generative AI\nRyan Hang\nSung Whang\nJoseph Wang\n1+\nShare this article\nIntroduction\n\nAt Uber, back-end service efficiency directly influences operational costs and user experience. In March 2024 alone, the top 10 Go services accounted for more than multi-million dollars in compute spend alone —an unsustainable amount that underscored the need for systematic performance tuning.\n\nTraditionally, optimizing Go services has required deep expertise and significant manual effort. Profiling, benchmarking, and analyzing code could take days or even weeks. Performance tuning is prohibitively expensive and non-trivial for most teams.\n\nPerfInsights was born as an Uber Hackdayz 2024 finalist and has since evolved into a production-ready system that automatically detects performance antipatterns in Go services. It uses runtime CPU and memory profiles with GenAI-powered static analysis to pinpoint expensive hotpath functions and recommend optimizations.\n\nThe results have been transformative. Tasks that once required days now take hours. Engineers can now deliver high-impact performance improvements without needing specialized knowledge of compilers or runtimes.\n\nWhat distinguishes PerfInsights is its emphasis on precision and developer trust. Beyond identifying optimization opportunities, PerfInsights validates them using large language model (LLM) juries to reduce hallucinations and increase confidence in its suggestions. With hundreds of diffs already generated and merged into Uber’s Go monorepo, PerfInsights has turned optimization from a specialist endeavor into a scalable, repeatable practice.\n\nHow It Works\n\nPerfInsights’ optimization pipeline consists of two main stages: profiling-based function filtering and GenAI-driven antipattern detection. Together, these components surface high-impact optimization opportunities with minimal developer effort.\n\nFigure 1: Stages in PerfInsights’ Optimization Pipeline \n\n\nFiltering Hotpath Functions\n\nPerfInsights leverages CPU and memory profiles from production services using Uber’s daily fleet-wide profiler during peak traffic periods. For each service, it identifies the top 30 most expensive functions based on flat CPU usage. This is based on the observation that the top 30 most expensive functions account for the majority of CPU usage. Additionally, if runtime.mallocgc—the Go runtime’s memory allocation function—accounts for more than 15% of CPU time, which means the runtime is spending a lot of time allocating memory, so PerfInsights also analyzes memory profiles to uncover potential allocation inefficiencies. \n\nTo focus the analysis, PerfInsights applies a static filter that excludes open-source dependencies and internal runtime functions. This step trims noise from the candidate set, ensuring ‌downstream analysis focuses only on service-owned code that’s most likely to benefit from optimization.\n\n\nDetecting Antipatterns with GenAI\n\nAt the core of PerfInsights’ detection engine is a curated catalog of performance antipatterns, informed by the Go Foundations team’s past optimization work. These patterns reflect the most common sources of inefficiency encountered across Uber’s Go services and align closely with best practices from Uber’s Go style guide. They include issues such as unbounded memory allocations, redundant loop computations, and inefficient string operations.\n\nPerfInsights applies a two-stage detection process. Once hotpath functions are identified, PerfInsights passes their full source codes and a list of antipatterns to a large language model (LLM) for analysis. By combining profiling context with pattern awareness, the model can pinpoint inefficient constructs with high precision. For example, if a function appends to a slice without preallocating capacity, the LLM flags the behavior and recommends a more performant alternative.\n\nTo boost confidence in its findings, PerfInsights layers two forms of validation: LLM juries and LLMCheck.  LLMCheck is a framework designed to catch false positives by running through several domain-specific rule-based validators. LLMCheck also logs metrics on detection accuracy, tracking failure rates and signaling potential model drift. This dual-validation strategy has dramatically improved precision, reducing false positives from over 80% to the low teens.\n\nAntipattern and Detection Strategy\n\nIn our initial attempts, a single-shot LLM-based antipattern detection produced inconsistent and unreliable results—responses varied between runs, included hallucinations, and often generated non-runnable code. To address this, we first improved reliability by scoring only based on detected antipatterns. We then introduced several targeted prompt strategies to enhance accuracy.\n\n\nFew-Shot Prompting \n\nFew-shot prompting involves including a handful of illustrative examples in the prompt, enabling the GenAI model to generalize more effectively to new or less familiar cases and deliver more accurate results.\n\nHere’s an example of prompt tuning to fix inaccuracy in detection:  \n\nAntipattern: Use strings.EqualFold(a,b) over strings.ToLower(a)== string.ToLower(b) for more efficient for case-insensitive comparison.\n\nIssue: No case-insensitive string comparison was present in the code but was detected.\n\nFix: Add few-shot prompting.\n\nOld prompt:\n\nFigure 2: The old prompt. \n\nNew prompt with few-shot examples:\n\nFigure 3: The new prompt with some few-shot examples. \n\nTailoring the Model’s Role and Audience\n\nSpecifying the audience and the model as Go experts helps the LLM focus its responses on advanced, relevant details, making its answers more accurate and appropriate for expert-level users.\n\n \nEnsuring Output Quality\n\nAnother prompt strategy is asking the model to test its results for reliability and ensure the antipattern suggested fixes are runnable.\n\nFigure 4: Prompt section for Ensuring fixes are Runnable. \n\n\nWriting Clear and Focused Prompts\n\nThese prompt writing tactics make the LLM understand instructions correctly, avoid confusion, and preserve context:\n\nUse very specific, positive instructions for improved reliability (avoid using “don’t” in instructions)\nUse one prompt per antipattern to conserve context and break down complex tasks into simpler ones\nSeparate prompts for detection and validation\nIncentivize and penalize the model for correct/incorrect answers, respectively\n\nConfidence Scores\n\nAsking for confidence levels in the LLM’s response for each prompt makes the model think more.\n\nFigure 5: Example of asking for confidence levels in the LLM’s response. \n\nValidation of LLM Responses\n\nA core strength of PerfInsights lies in its robust validation pipeline, which includes two complementary systems: LLM juries and LLMCheck. Together, they dramatically reduce false positives and increase trust in the system’s optimization suggestions.\n\nLLM Juries\n\nRather than trusting a single model’s judgment, PerfInsights leverages a jury of large language models to validate each detected antipattern. These models independently assess whether an antipattern is present and whether the suggested optimization is valid. This ensemble approach mitigates common hallucinations such as incorrectly detecting loop invariants or misinterpreting control structures.\n\n\nLLM Checker\n\nEven with LLM juries, LLM may still hallucinate, such as:\n\nDetecting antipatterns that don’t exist\nConfusing maps with slices and vice versa\nLoop Invariant detected, but the variable is outside of the loop\nIdentifying loop variables in the for statements as loop invariants\n\nPerfInsights employs a second layer of verification via LLMCheck by running through several domain-specific rule-based validators to evaluate LLM responses. There are several benefits:\n\nNon-generic: Evaluates highly specific, conditional projects.\nExtendable: Adds validators for various LLM-based projects.\nStandardized metrics: Tracks reductions in LLM response errors during prompt tuning.\n\nFor example, ensuring that an identified loop invariant isn’t mistakenly located outside the loop.\n\nThe final output includes a confidence score of the function’s optimisability and suggested improvements. These insights are fed into downstream tools for code transformation or manual review by developers. As a result, PerfInsights transforms static profiling data into actionable engineering outcomes within minutes.\n\nImpact and Results\n\nSince its launch, PerfInsights has transformed performance improvements at Uber. By reducing detection time from days to hours and removing the need for deep language expertise, PerfInsights has accelerated engineering velocity and driven scalable compute cost reductions across our Go services. PerfInsights seamlessly integrates with automated downstream tasks, with validated suggestions flowing directly into Optix, Uber’s continuous code optimization tool. This has already produced hundreds of merged diffs, measurably improving performance and generating meaningful cost savings. Further, PerfInsights’ power lies in its language-agnostic design, allowing it to read, understand, and optimize functions across various programming languages.\n\n\nBoosting Code Health\n\nOur static analysis tool has proven highly effective in improving code quality, with its findings validated through LLMCheck. In February, we averaged 265 validated detections, reaching a single-day high of 500. By June, the figure had dropped to 176—a 33.5% reduction in just four months.\n\nFewer antipatterns mean a cleaner codebase, shorter review cycles, and faster, safer releases. We will keep refining both the scanner and LLMCheck to drive this number even lower and sustain our commitment to exceptional code quality.\n\n\nEngineering Effort Saved\n\nOur performance‑analysis tool turns what used to be months of niche, manual diagnostics into hours of automated insight, freeing engineers to build rather than troubleshoot.\n\nPreviously, uncovering performance antipatterns demanded immense, specialized effort. For instance:\n\n5 critical antipatterns once required two engineers (including a Principal Engineer) for a full month (∼320 hours).\n11 unique antipatterns consumed a four-person Go expert team for a full week (∼160 hours).\nA dedicated Go expert spent six months full-time on related optimization projects (∼960 hours). \n\nThese manual efforts alone represent over 1,400 hours for just a handful of cases.\n\nOver four months, the number of antipatterns reduced from 265 to 176, a sustained reduction of 89 antipatterns. Projecting this annually, that’s a reduction of 267 antipatterns. Addressing this volume manually, as the Go expert team would have consumed approximately 3,800 hours. By using our streamlined tool, we reduced the engineering time required to detect and fix an issue from 14.5 hours to almost 1 hour of tool runtime—a 93.10% time savings.The impact goes beyond dollars saved. PerfInsights has also elevated engineering rigor. Dashboards powered by LLMCheck provide teams with visibility into detection accuracy, error patterns, and antipattern frequency. This transparency has helped cut hallucination rates by more than 80%, boosting trust in AI-assisted tooling.\n\nMost importantly, PerfInsights has redefined performance tuning as a continuous, data-driven discipline. Its integration into CI/CD pipelines and day-to-day developer workflows means optimization opportunities are surfaced regularly, not just when something breaks. What was once an expert-led, reactive task is now a proactive loop embedded across Uber’s engineering life cycle.\n\nLessons Learned\n\nBuilding PerfInsights into a production-ready system wasn’t just a technical challenge—it was a lesson in integrating GenAI tooling into a complex, high-scale engineering ecosystem. What worked wasn’t just novel modeling techniques, but a relentless focus on developer experience, reliability, and iteration speed.\n\n\nPrompt Engineering and Model Selection Matter\n\nEarly iterations suffered from noisy, inconsistent outputs. The Go Foundations team learned quickly that high input token limits were critical for passing large Go functions without truncation. More importantly, small adjustments in prompt phrasing and contextual cues dramatically influenced accuracy. By encoding explicit antipattern definitions and Go-specific idioms into the prompts, we improved detection precision and reduced false positives by 80%.\n\n\nStatic Filtering Is the Unsung Hero\n\nBefore any GenAI magic happens, PerfInsights performs aggressive static filtering using CPU and allocation profiles. By isolating just the top 30 flat% functions within service boundaries—and ignoring OSS or non-relevant runtime functions—we constrained the search space. This pre-processing transformed what could have been a brittle AI prototype into a focused optimization assistant that works effectively across services without overwhelming developers with noise.\n\n\nValidation Pipelines Build Trust\n\nTo move beyond demos, we needed to give developers confidence in PerfInsights’ recommendations. With LLMCheck dashboards tracking detection accuracy, false positive reasons, and model regressions, we could quantify improvement and respond to feedback with evidence. As a result, PerfInsights became not just usable, but dependable.\n\n\nDevelopers Respond to Clear Wins\n\nLanding the first 5 digits saving diff was a breakthrough moment. Engineers saw that this wasn’t theoretical—it worked! That early success helped unlock adoption, feedback loops, and ultimately made PerfInsights a part of the engineering toolkit.\n\nConclusion\n\nPerfInsights marks a turning point in how we approach performance engineering at Uber—from slow, expert-led investigations to scalable, GenAI-assisted optimization. By fusing real-world production data with targeted static analysis and validated LLM workflows, we’ve built a system that delivers meaningful performance wins quickly and reliably.\n\nThis shift has already paid dividends: freeing up developer time, lowering compute costs, and expanding access to performance best practices across teams. Tools like PerfInsights show the power of applying GenAI with precision, domain knowledge, and a bias for automation.  These aren’t just theoretical benefits—they’re actively improving our systems and driving measurable impact today.\n\nCover Photo Attribution: gopher logo by @egonelbre is licensed under CC0.\n\nStay up to date with the latest from Uber Engineering—follow us on LinkedIn for our newest blog posts and insights.\n\nCategory\nEngineering\nWritten by\n\nRyan Hang\n\nRyan Hang is a Senior Software Engineer on the Go Platform team at Uber.\n\nSung Whang\n\nSung Whang is a Staff Software Engineer and Tech Lead Manager of the Go Platform team at Uber.\n\nJoseph Wang\n\nJoseph Wang serves as a Principal Software Engineer on the AI Platform team at Uber, based in San Francisco. His notable achievements encompass designing the Feature Store, expanding the real-time model inference service, developing a model quality platform, and improving the performance of key models, along with establishing an evaluation framework. Presently, Wang is focusing his expertise on advancing the domain of generative AI.\n\nLavanya Verma\n\nLavanya Verma is a Software Engineer on the Development Platform team at Uber.\n\nRelated Articles\n6 articles\nBackend\nEngineering\nHow Uber Executed A JUnit Migration at Massive Scale\nApril 7, 2026\nData / ML\nEngineering\nUnder the Hood: Scaling Responsible AI at Uber\nApril 2, 2026\nData / ML\nEngineering\nUber AI\nHow Uber Built an Agentic System to Automate Design Specs in Minutes\nMarch 11, 2026\nData / ML\nEngineering\nUber AI\nTransforming Ads Personalization with Sequential Modeling and Hetero-MMoE at Uber\nMarch 10, 2026\nBackend\nEngineering\nBuilding High Throughput Payment Account Processing\nMarch 5, 2026\nData / ML\nEngineering\nSecurity\nSuperuser Gateway: Guardrails for Privileged Command Execution\nFebruary 26, 2026\nWe use cookies\n\nSelect “Accept” to enable Uber to use cookies to personalize this site. We use cookies to remember your location, deliver ads, and measure ad effectiveness on other apps and websites, including social media. Customize your preferences in your Cookie Settings, or select Reject if you only want us to use essential cookies. Learn more in our Cookie Notice.\n\nCookie settings\nReject\nAccept",
+    "quality_score": 9,
+    "modules": [
+      "go_patterns",
+      "performance",
+      "ai_assisted"
+    ]
+  },
   {
     "url": "https://github.blog/engineering/engineering-principles/how-githubs-developer-experience-team-improved-innerloop-development/",
     "title": "How GitHub's Developer Experience team improved innerloop development",
@@ -236,6 +272,18 @@
       "dependency_health"
     ]
   },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/infrastructure/journey-of-next-generation-control-plane-for-data-systems",
+    "title": "Journey of next generation control plane for data systems",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "Skip to main content\n\nInfrastructure\n\nJourney of next generation control plane for data systems\nAuthored by\nAashish Nagpal\n\nMarch 21, 2025\n\nCo-authors: \nCo-authored by\nAashish Nagpal, \nCo-authored by\nNishant Satya Lakshmikanth, \nCo-authored by\nRamnik Bhatia, and \nCo-authored by\nVivek Subramaniam\n\nIn LinkedIn’s fast-evolving data infrastructure, efficient resource management and monitoring are crucial. Resource provisioning used to be difficult, with application developers coordinating directly with infrastructure teams, often leading to prolonged back-and-forth communication, delays, and inefficiencies. Developers would spend days—sometimes weeks—handling infrastructure requests, while infrastructure teams faced daily repetitive manual work. To address this, we built Nuage, which provides an interface between the infrastructure and developer teams to simplify resource management and establish best practices and processes. \n\nEarlier iterations of Nuage focused on providing self service capabilities across over 30 infrastructure platforms, including storage (Espresso, Venice, Pinot, MySQL, Ambry), streaming (Kafka), managed search (Hosted Search), and managed stream processing (Samza). But as the scale grew and requirements became more complex, Nuage evolved from offering self-serve capabilities to a full fledged control plane solution that manages the entire resource lifecycle with key features like resource discoverability, access control and policy enforcement. \n\nIn this blog post, we’ll cover the evolution of Nuage as a control plane framework. Readers will learn more about various control plane requirements across Linkedin and how Nuage provides a centralized framework for building control planes.\n\nWhy we need a control plane\n\nA control plane for data infrastructure could be defined  as \"a scalable platform designed for global provisioning, management, and governance of resources.\" However, this lacks the depth needed to convey its full purpose and importance for data infrastructure. A clearer understanding emerges when considering the specific responsibilities it fulfills.\n\nFigure 1. Control Plane Requirements\n\nFor the teams building infrastructure, flexibility and control are crucial. Before Nuage, application developers navigated a cumbersome process of directly engaging with infrastructure teams for resource provisioning and management causing delays and inefficiencies. They needed an interface that encapsulates the essential business logic for infrastructure management, exposing only the components relevant to users. Beyond infrastructure provisioning, these teams often require streamlined processes for resource management. For instance, authorization mechanisms to ensure only authorized personnel can modify resources and approval workflow integration to ensure proper oversight with manual intervention for critical requests like a resource's quota increase. To keep systems running smoothly, infrastructure teams also rely on performance metrics like latency, error rates, and usage statistics, which help them optimize performance and resolve issues quickly.\n\nApplication developers benefit from easy resource discovery and management. A well-designed control plane allows developers to check resource usage, such as quota levels, which helps identify cost-saving opportunities. Beyond resource creation, developers need to define and manage access control, providing appropriate access to their resources. Insights into cost and usage patterns also allow developers to make informed decisions, ensuring efficient resource allocation and budget management.\n\nResources are designed to meet specific requirements to help ensure accountability and traceability. Each resource is assigned a designated owner to clearly assign responsibility. In addition, resources are tagged with compliance info, such as whether they contain personally identifiable information (PII), along with defined purge policies. A control plane enforces these regulations from the moment a dataset is provisioned. Robust auditing capabilities are also crucial to track all changes and provide transparency.\n\nNuage offers these capabilities with a comprehensive control plane framework, allowing infrastructure teams to build control planes for their infrastructure resources while adhering to the company's policies.\n\nBrief history of Nuage and motivations for Nuage 3.0 \nNuage 1.0\n\nNuage was initially developed to reduce the manual work involved in provisioning and managing data infrastructure resources through a self-service platform. The vision was to centralize essential capabilities—like authorization, discoverability, search, and auditing—in a single control plane, so infrastructure teams wouldn't have to build these functionalities independently. The first version of Nuage was a monolithic service, offering control plane endpoints for various infrastructure resources like Espresso, Venice and Kafka. Each type of resource had its specific business logic bundled in separate modules, while common functionality was managed centrally.\n\nNuage 2.0\n\nAs LinkedIn’s data infrastructure expanded, so did the number and complexity of supported resources. The number of platforms increased significantly, from a few initial services to more than ten distinct infrastructure platforms. With this growth, the business logic required for each resource also became more complicated. For example, database creation in the storage system now included cluster selection algorithms to optimize for resource utilization. This added complexity created a bottleneck, as the monolithic design couldn’t scale efficiently across multiple teams. \n\nTo address these limitations, we introduced Nuage 2.0, shifting the control plane development to a decentralized model. Core functionalities, such as authorization and search, were packaged into a library, allowing infrastructure teams to build their own resource providers independently. However, dependencies on a single shared persistence layer and tight coupling between the library and resource provider components continued to present challenges. For more background, see previous tech blogs about solving the control plane problems at scale. Although Nuage 2.0 introduced a decentralized approach through the nuage-sdk this architecture presented new challenges:\n\nSecurity: Nuage metadata exists as a shared storage across all Resource Providers. There is no tenant isolation while reading/writing to this shared storage. Inefficiencies arose because performance in one resource provider could directly impact others, as suboptimal queries from one provider would slow down the entire system.\nOnboarding experience: Currently, all the Resource Providers make use of a shared persistence layer (via SDK) to persist metadata. Onboarding onto Nuage requires understanding of Nuage configs and deployment topology, which complicates the learning curve for infrastructure partners and often involves Nuage engineers' involvement for onboarding. \nUser experience: The Nuage client layer leverages auto generated UI for building UX. However, default layouts use screen space sub-optimally with less scope for customizations. UX controls are not always intuitive, impacting customer satisfaction.\nOwnership: Tight coupling of control plane logic (Nuage SDK) and business logic in Resource Providers makes it very hard for individual teams to own Resource Providers. A more scalable model where infrastructure partners own their respective resource providers is needed.\nError triaging and analysis: Lack of clear contracts between Control Plane and Resource Providers often delays error triaging, leading to poor accountability and slower time to resolution.\nFigure 2. Evolution of Nuage\nNuage 3.0\n\n\nTo address these issues, Nuage 3.0 was developed with the following goals:\n\nCentralized management: Streamlining resource management through a centralized service that exposes uniform APIs and enforces consistent interfaces across all platforms.\nDecoupling of logic: Separating horizontal control plane capabilities from infrastructure-specific logic to reduce operational overhead and improve scalability.\nEnhanced security: Implementing stricter access controls via new RBAC model and removing the shared storage to help prevent unauthorized modifications and help ensure secure communications.\nImproved performance: Optimizing query performance and minimizing latency by establishing better resource API and data modeling practices \nSimplified onboarding: Making it easier for new resource providers to integrate by eliminating shared persistence issues and providing a clear separation of concerns.\nNuage's comprehensive control plane capabilities for data infrastructure\nFigure 3. Control Plane capabilities\n\nNuage offers a comprehensive control plane framework that enhances discoverability, security, resource management, and monitoring for LinkedIn’s data infrastructure. Let’s explore the key features that make Nuage essential.\n\nClient interaction\n\nNuage provides an intuitive user interface through a web portal, public APIs, and CLI. These tools make it easy for users to interact with the control plane, while a dedicated admin interface simplifies resource configuration and management.\n\nFront door capabilities\n\nNuage maintains the integrity, security, and efficiency of the system by managing how external interactions are handled right from the start with:\n\nRequest validation and sanitization: Requests go through a thorough validation and sanitization process before it’s executed, for for security and compliance purposes.\nIntelligent request routing: Nuage uses smart routing to direct requests to the appropriate environment, such as staging or production, optimizing resource handling.\nAuditing: Incoming requests are logged. These audit logs are accessible via a user-friendly audit log application, where users can filter through various criteria to track activity.\nDiscoverability\n\nWith advanced search with multi-criteria filtering, Nuage allows users to refine their searches by combining filters like name, environment, ownership, tags, timestamps, and status. Additionally, platform teams can extend search capabilities to include custom platform-specific properties, making it easier for onboarding teams to find exactly what they need.\n\nResource provisioning and management\n\nNuage offers consistent CRUD (Create, Read, Update, Delete) interfaces across platforms. This contract-first approach ensures that APIs are designed and standardized before implementation. Payloads are validated for mandatory fields, and asynchronous operations are handled smoothly to ensure reliable resource provisioning.\n\nAccess and policy control\n\nTo prevent unintended changes, Nuage enforces strict access controls, including authorization checks (only owners or admins can perform certain actions), ACL checks, and multi-level approval workflows for critical tasks. It also supports phased rollouts and live traffic checks to ensure safe deployment across environments.\n\nMonitoring\n\nNuage equips infrastructure teams with real-time insights into system performance through key error and latency metrics. It also generates managed dashboards with pre-configured critical alerts during resource creation, providing greater visibility and enabling proactive management.\n\nNuage 3.0 architecture\nFigure 4. Nuage 3.0 architecture\nResource provider\n\nA resource provider exposes APIs to provision and manage infrastructure resources, such as a Kafka resource provider manages Kafka topics. Each provider integrates with Nuage's resource manager and adheres to operational contracts to ensure uniform resource management. These API and data model contracts guarantee a consistent experience across all resources in Nuage.\n\n\nWhile resource providers typically expose CRUD (Create, Read, Update, Delete) operations, they may also offer custom actions, such as increasing resource quotas, registering schemas, fetching resource insights and cost data, configuring the alerting mechanisms, and monitoring system health and traffic patterns and surfacing it via dashboards.\n\nResource provider contracts and guidelines\n\nThe process starts by defining resource data models using data contracts and creating resource classes to expose RESTful endpoints. In Nuage 3.0, resource providers must implement API and data model contracts, adhering to Nuage defined contracts. This ensures consistent interface design by:\n\nOrganizing APIs around resources to create intuitive and easily navigable endpoints.\nExposing standard CRUD operations providing consistent Create, Read, Update, and Delete (CRUD) endpoints to interact with resources\nModeling resource relationships for better performance such as defining relationships between resources (e.g., parent-child) to allow efficient data retrieval and minimize redundant requests.\nFollowing consistent URI structures adhering to a predictable, hierarchical structure. For example: “/nuageKafkaTopics” represents a collection resource endpoint whereas “/nuageKafkaTopics/{topic_id}” represents a single entity endpoint. Similarly subresources URI represents the full hierarchy such as “databases/{database_id}/table/{table_id}” \nApplying uniform HTTP patterns for requests and responses, with consistent methods (e.g., GET for reads, POST for creation), standard status codes (e.g., 200 for success, 404 for not found), and structured JSON responses for predictability\nNuage resource manager\n\nNuage Resource Manager (NRM) is a centralized managed service acting as a gateway between Nuage client and resource providers exposing resource management operations. It enables management features for the resource entities, like request routing, authN/authZ, search, validation, audit logging, async workflow management.\n\nRouting\n\nNRM acts as the central hub for all incoming requests, directing them to the appropriate resource provider within the correct environment. It leverages the URI to identify the resource path and determine the resource hierarchy. If a resource provider is registered for that path in the NRM resource manifest, the request is directed to that provider. Moreover, NRM employs intelligent routing logic to ascertain the destination environment where the request should be handled. For example: for a resource id “urn:li:nuageResource:(PROD,KAFKA_TOPIC, id)”, the request needs to go to production service\n\nIn accordance with the Network Topology section, each resource provider manages resources within its designated environment. Therefore, if a client in the production (PROD) environment intends to execute an operation on a resource staging (EI) environment, NRM in PROD is responsible for routing this request to the appropriate Resource Provider in the EI environment. This ensures that requests are seamlessly directed to the correct environment for processing.\n\nAuthorization\n\nEvery resource that exists on Nuage must have an owner associated with it. Resource owners are responsible for operating the resource (allowing them to update/delete it) and ensuring that it's compliant by providing schema annotations and other compliance information required. Owners are recognized as crew, an entity which represents the encoded structure of our teams and organization.\n\nNuage Resource Manager leverages role based access control to provide fine-grained access management of resources on Nuage. Nuage RBAC helps you manage who has access to resources, what they can do with those resources, and what areas they have access to. Resource provider admins can also create custom roles for the resource providers (via resource provider manifest) , and configure access control based on those roles. By default the following roles exist on the Nuage platform:\n\nOperation\tVIEWER\tCONTRIBUTOR\n(user with this role has R/W access to the resource, but cannot change role assignments)\tCREW_MEMBER\n(member of the resource owning crew)\tRESOURCE_PROVIDER_ADMIN\n(member of resource provider team)\nSearch & find a resource, view the resource details\tX\tX\tX\tX\nUpdate the resource\t \tX\tX\tX\nDelete the resource\t \tX\tX\tX\nTransfer to another crew\t \t \tX\tX\nSearch\n\nNuage offers capabilities to efficiently search over resources across different scopes out of the box, without having to query all the RPs for all the resources in all scopes. Nuage Resource Manager maintains a persistent cache (MySQL) to provide faster search. Out of the box search support is provided over common fields: name, environment, ownership, tags, created/updated timestamp, status. \n\nResource providers also have the option to extend the search support over the platform specific attributes of a resource. This is done via a Data Model annotation. Nuage Resource Manager uses Resource Provider’s RestSpec to determine which fields to cache.\n\nCache is updated only on operations that are CRUD. This enforces that resource providers follow certain data and resource modeling guidelines to keep the cache consistent.\n\nAudit Log\n\nNRM offers audit logging capabilities by default. All write operations performed through Nuage are meticulously logged for auditing purposes. These logs are conveniently accessible through a separate audit log application. Users can effortlessly filter through a multitude of criteria including resource name, resource URI, user, call trace id, request method, and date range, providing efficient and thorough monitoring of user activity.\n\nValidations\n\nNuage offers multiple ways to validate resource schemas and APIs. Basic static validations can be implemented using built-in Rest.li annotations or custom logic in a dedicated validator class. These validations are enforced for all incoming and outgoing data at the schema level.\n\nFor more dynamic scenarios, where validation depends on multiple fields, Nuage provides a framework for dynamic validations through API contracts. Resource providers implement the validate method, which is called by the Nuage Resource Manager to collect and process validation errors. These validations can be applied at both field and method levels.\n\nAsynchronous operations\n\nNRM provides a consistent framework for handling asynchronous operations by enforcing Asynchronous API contracts. It provides consistent way to trigger, monitor and manage asynchronous operations via Nuage resource manager irrespective of from where workflow is triggered (NRM or Resource Providers) or underlying workflow engine (Temporal, Airflow, Helix Task Framework, Parseq or any custom workflow orchestrator). Apart from this it provides:\n\nAbility to query for all asynchronous operations on attributes such as,which user triggered them, which resource the operation is linked to, all operations in a time period, etc\nMaintain execution history for all async operations for six months for debuggability and auditing. \nFacilitating data governance & compliance\n\nData governance is the critical aspect of metadata management, where ensuring dataset discoverability and maintaining metadata integrity are essential prerequisites. In LinkedIn, Data Governance and compliance is enabled by Datahub.\n\nFigure 5. MCE Pipeline via Nuage\n\nBeing a control plane, Nuage ensures that metadata aspects such as schema, ownership, status are up to date on Datahub at the time of provisioning which also resonates with Linkedin’s shift left strategy. This is achieved by an automated Metadata Change Event (MCE) emission flow as part of CRUD workflows.\n\nControl Plane Horizontal Services\nACL Management Service\n\nACL Management Service manages access control for LinkedIn’s resources through a user-friendly interface for handling Datavault ACLs. Its key features include ACL deployment across environments, rule creation, management of temporary and permanent access, related ACL navigation, and support for ownership changes. ACL Management Service also enables easy comparison between different ACLs and offers seamless navigation between Nuage and ACLin, streamlining access control management across platforms.\n\nApproval Workflow Service\n\nApproval Workflow Service introduces manual intervention into the business logic by automating approval workflows where human oversight is required. It allows resource providers to assign designated reviewers for requests, ensuring critical decisions are made with appropriate checks. Reviewers can evaluate, approve, and notify clients, who can then take the necessary actions. The system also supports delegation during absence of key approvers, ensuring uninterrupted workflow management. Additionally, Approval service offers real-time visibility into approval statuses, tracks request history, and integrates with communication channels to streamline notifications and updates, enhancing operational efficiency.\n\nResource monitoring and alerting\n\nThe resource monitoring and alerting service enables resource providers to create resource-specific monitoring dashboards with preconfigured alerts. Platform teams can define dashboard templates with key metrics like quota usage and read/write QPS, and set up alerts with resource owners automatically added as recipients. This process is fully automated during resource provisioning, providing users with a ready-to-use, auto-generated monitoring dashboard once provisioning is complete.\n\nClient Interfaces\n\nAs infrastructure services evolve, teams require diverse ways to interact with the control plane, ensuring they can easily manage, provision, and modify resources. A comprehensive client interface simplifies the process for both infrastructure providers and users, reducing friction and minimizing the need for manual intervention. By offering intuitive UIs, public APIs, and CLIs, Nuage enables seamless automation, faster onboarding, and consistent operations, catering to a variety of technical and automation-centric use cases.\n\nNuage portal\n\nWe have improved the user experience in Nuage 3.0 by delivering more intuitive and user-friendly interfaces. Compared to previous iterations, Nuage 3.0 features:\n\nConsistent design language: Nuage 3.0 offers standardized layouts backed by clear contracts for our partners. The CRUD pages follow a unified design across all platform applications, ensuring consistency. In addition to the page layouts, enhanced navigation simplifies interaction with control plane services. Users can easily view pending approvals on a resource, navigate directly to the ACL page from the resource page, track asynchronous workflows on the detail page, and much more.\nMetrics driven UX: Nuage 3.0 has made substantial enhancements in performance and reduction in error-rate, propelled by our observability strategy. Each Nuage 3.0 application is equipped with a Live Metrics dashboard which gives further insights into some key performance and resiliency numbers. Recent UX improvements have led to ~40% reduction in Nuage Landing Page load time. New UX provides clear, concise, and actionable error messages with appropriate resolution details (next steps, who to reach out, JIRA)\nLow code UI onboarding: The Nuage team streamlined UX onboarding for partners by developing an in-house tool called ZenX. ZenX is a self-serve, low-code/no-code UI generation tool that simplifies the process of onboarding new applications with the Nuage 3.0 theme. It allows for easy UI customizations, even for partner teams without dedicated UI engineers, significantly reducing the workload on the Nuage team. ZenX has reduced the onboarding time for creating vanilla CRUD UIs from two weeks down to just three to four days, accelerating development and reducing toil.\n\n\nPublic APIs\n\nAll Nuage APIs are public APIs which LinkedIn applications can use to integrate directly with Nuage functionalities. Applications can programmatically create, update, and delete resources using the Java Rest.li client. These APIs enable seamless automation and customization, allowing teams to embed infrastructure management directly into their application workflows.\n\n\nCommand Line Interfaces (CLIs)\n\nTeams are increasingly leveraging Nuage APIs to build custom CLIs for technical and automation-focused use cases. For example, Espresso, LinkedIn’s document database solution, has developed an SRE CLI tool called esretool, which allows users to efficiently create, update, promote, and delete Espresso databases.\n\n\nInfrastructure as Code (IAC)\n\nWe are planning to implement IaC as a future client integrated with Nuage APIs to provide even greater flexibility and provisioning experience via code where developers can simply add the infrastructure resources in their source code.\n\nBenefits\nAgility in Partner Onboarding\n\nA key success metric for Nuage is how easily platform teams can onboard and develop resource providers. With Nuage 3.0, zero support is required from the Nuage team to create a new resource provider. Resource provider development is now guided by Data Model and API contracts, eliminating the need to extend nuage-sdk interfaces. Additionally, we have a self serve UI generator, a one-click, low-code UI tool, simplifies building UI applications without prior experience. This reduced MySQL onboarding efforts by over 70%, from 12 to 2 developer months.\n\nClear Ownership\n\nInfrastructure teams can now fully own their resource providers, a significant improvement over the previous architecture where the Nuage team had to manage and maintain many resource providers. Nuage 3.0 introduces a clear separation between the control plane and infrastructure-specific business logic. Nuage resource manager handles platform logic, while resource providers are dedicated solely to infrastructure-specific business logic.\n\nPerformance \n\nThe previous architecture struggled with high UI page load times due to improper resource modeling. Nuage 3.0 resolves this by supporting parent-child relationships between resources, allowing clients to retrieve only the necessary data. This has significantly improved performance and reduced network overhead. For instance, Espresso saw over a 3X improvement in P90 latency for Read flows, dropping from 10 seconds to under 3 seconds, while Kafka experienced a nearly 2X improvement in read latency (8 to 4 seconds) and a 6X improvement in search latency (17 to 3 seconds).\n\nSecurity\n\nNuage 3.0 manages metadata through a centralized service, Nuage Resource Manager, which has helped resolve the security issues related to shared metadata storage that existed in the previous architecture. The new architecture also helps ensure secure and reliable resource management across all environments for all clients, as the resource provider operates within each environment, preventing requests from crossing security domains. As a result, the number of firewall exceptions required for the Espresso application has been reduced from 15 to just 2.\n\nFuture Considerations\n\nToday, Nuage supports 30+ applications, serving 4.5K monthly unique users and over 35K monthly active users, 100K write operations each month—streamlining resource management at LinkedIn's scale.\n\n\nSelf serve onboarding\n\nWe are introducing a new Self-Serve Onboarding feature to streamline the onboarding process for Resource Providers in Nuage. Currently, setting up a basic \"Hello World\" application that enables CRUD flows requires manual work, including development, deployment, and infrastructure setup, which takes approximately two weeks. With the new Self-Serve onboarding feature, users can complete the entire onboarding process through an intuitive interface that collects all necessary information upfront. Once submitted, the system automatically triggers an onboarding workflow that handles everything, from infrastructure setup to deployment in EI, eliminating manual intervention and significantly reducing the time required.\n\nInfrastructure as code\n\nInfrastructure as Code (IaC) offers standardized, code-driven infrastructure management that simplifies resource provisioning and boosts consistency. We aim to cut developer toil by over 50%, especially in complex, multi-tool environments where users have to navigate multiple interfaces. By adopting an Infrastructure as Code (IaC) approach, we aim to align our infrastructure development with application code development, including source code management, change review, artifact build, versioning, and much more.\n\nNuage AI Assistant\n\nNuage assistant will be LinkedIn’s AI assistant for data infrastructure management, powered by Large Language Models (LLMs). It will leverage AI to reduce operational toil, provide developers with quick, accurate responses in under 10 seconds, and deliver insights on optimizing costs, ensuring compliance, and managing resources. By using LLM-driven reasoning to select and execute tasks, it will enhance efficiency across over 30 applications.\n\nAcknowledgements\n\nWe extend our gratitude to the many colleagues: Adrish Banerjee, Prateek Singh, Khushboo Sangal, Arnava Agrawal, Allabakash, Amandeep Srivastava, Anshul Sharma, Dhirendra Kumar, Vivek Subramaniam, Lohitaksh Trehan, Abhijit Yadav, Eklove Singh and the entire team for their contribution, dedication and collaborative spirit all along.\n\n\nSpecial thanks to Nishant Lakshmikanth and Ramnik Singh for their exceptional role as a reviewer, offering unwavering support and insightful feedback over the years on Nuage’s architecture and its evolution which has been crucial in shaping our work, realizing the team’s vision and mission, fostering customer adoption, keeping pace with industry trends, and acting as a pillar of strategic guidance since the team’s inception.  \n\nWe would like to thank the contributions from all the individuals including our LinkedIn alumni, (names in no particular order) Mohamed Battisha, Vishal Gupta, Terry Fu, Ji Ma, Yifang Liu, Changran Wei, Yinlong Su, Darby Perez, Tyler Corley, and Micah Stubbs.\n\nSpecial thanks to those who gave their time to review and edit this blog: Bhupendra Kumar Jain, Prateek Singh and Nishant Lakshmikanth\n\n\nHuge thanks to our management Sandeep Singhal, Kartik Paramasivam, Arun Mahapatro, Jagadish Venkatraman for your strong support as exemplary engineering leaders. Finally, we are grateful for our fellow data infra platform teams for all the ways in which they have supported this work.\n\nTopics: Architecture Distributed Systems Infrastructure\n\nRelated articles\n\nAI\n\nAI helping build better AI: How agents accelerate model experi...\n\nAnimesh Singh \n\n \n\nMar 27, 2026\n\nAI\n\nThe LinkedIn Generative AI Application Tech Stack: Personaliza...\n\nPraveen Kumar Bodigutla \n\n \n\nMar 26, 2026\n\nFeed\n\nEngineering the next generation of LinkedIn’s Feed\n\nHristo Danchev \n\n \n\nMar 12, 2026",
+    "quality_score": 9,
+    "modules": [
+      "evolutionary",
+      "integration",
+      "design_patterns"
+    ]
+  },
   {
     "url": "https://engineering.fb.com/2024/12/19/developer-tools/glean-open-source-code-indexing/",
     "title": "Indexing code at scale with Glean",
@@ -343,8 +391,7 @@
     "modules": [
       "clean_code",
       "testing",
-      "complexity",
-      "ai_assisted"
+      "complexity"
     ]
   },
   {
@@ -383,6 +430,17 @@
       "evolutionary"
     ]
   },
+  {
+    "url": "https://www.uber.com/blog/automating-efficiency-of-go-programs-with-pgo/",
+    "title": "Automating Efficiency of Go programs with Profile-Guided Optimizations",
+    "source_name": "Uber Engineering",
+    "text": "Skip to main content\nMarch 13, 2025\nAutomating Efficiency of Go programs with Profile-Guided Optimizations\nYufan Xu\nShauvik Roy Choudhary\nChris Zhang\n1+\nShare this article\nIntroduction\n\nProfile-guided optimization improves the performance of compiled code by using runtime profiling data to inform compiler optimizations. This technique, recently integrated into Go, improves traditional optimizations such as function inlining, basic block and function reordering, register allocation, and more. At Uber, we’ve implemented PGO (profile-guided optimization) in a continuous optimization framework that includes daily profile collection, service-specific enrollment, CI testing, deployment, and performance monitoring. We addressed initial challenges related to increased build times by introducing a profile preprocessing tool, which significantly reduced compilation times. While measuring the impact at a fleet-wide level is difficult, we conducted performance benchmarks and real-world service evaluations at Uber. The results showed efficiency gains and reduced resource utilization for some specific services, validating the effectiveness of PGO-driven optimizations. Support for PGO in Golang was introduced in v1.20 and later improved in later versions through our fruitful collaboration with Google®. This blog describes our experience building core components of PGO and deploying it at Uber.\n\nBackground\n\nProfile-guided optimization uses the profile collected during a representative run to generate better code. At a high level, it can be divided into the following phases: profiling, analysis, and recompilation. Multiple languages already support PGO, including C/C++, Rust, Java, and Swift. However, this support was lacking for Golang, which led us to build this functionality in collaboration with Google. \n\nMany compiler optimizations, such as inlining, register allocation, and instruction scheduling often use statically inferred estimates related to caller-callee frequencies, basic-block frequencies, and branch probabilities to guide optimization. The static estimation of these metrics may lead to suboptimal code generated by the compiler. These optimizations can easily benefit from dynamic information collected by profiling an application.\n\nTraditionally, a PGO-based compilation begins with an instrumentation phase to generate an instrumented version of the application. Next, the instrumented program runs with training data to collect the profile (that is, edge profiles). These profiles are later fed to the compiler and the application is recompiled to produce an optimized binary. During this process, the compiler updates and propagates profile information, including feeding them to compiler passes to optimize hot/code paths. Modern compilers such as LLVM have incorporated PGO and reported speed-ups of around 20%. Since the instrumented execution of an application incurs significant overhead, recent work has shown little or no performance loss by collecting execution profiles via sampling, leveraging tools like hardware performance counter and pprof.\n\nGo binaries are often large as they’re statically linked and include all dependent packages and runtimes. For such large binaries, misses in the instruction cache and TLB can cause stalled cycles in the CPU’s front end leading to performance degradation. Profile-guided code-layout optimization is known to alleviate this problem. Recent work including Meta® BOLT and Google® Propeller have shown more than 10% performance improvements by optimizing code locality in data center workloads. Code-layout optimization improves code locality and comprises basic-block layout, function splitting, and function reordering optimizations. To reap maximum performance benefits,  these optimizations are typically performed during or post link-time using profiling information.\n\nOverview of PGO: Continuous Optimization Framework\nFigure 1: PGO in a continuous optimization framework.\n\nLet’s review the timeline of key PGO features:\n\nPGO-driven inlining was introduced in version 1.20\nIn version 1.21, PGO-driven devirtualization was added, further optimizing execution efficiency\nA profile pre-processing tool was released in version 1.23 to drastically improve build times\n\nThe PGO framework at Uber is a continuous optimization process. Profiles are collected and used during the GoPGO compilation process. Optimized executables are then deployed in production, with pre-processing steps included to improve build times.\n\nEnabling PGO in our build and deployment process involves several steps:\n\nWe collect performance profiles daily to ensure we have up-to-date data for guiding optimizations.\nWe maintain a configuration system to enroll specific services for Go PGO, ensuring that only selected services undergo these optimizations.\nWe perform CI tests for the PGO SDK to validate the changes and ensure they don’t introduce any stability issues.\nOnce the tests pass, we deploy the PGO-built services into our production environment.\nFinally, we monitor the performance dashboard to track the impact of PGO on our services.\n\nBy following these steps, we systematically integrate PGO into our build and deployment pipeline, enhancing the performance and efficiency of our services.\n\n\n​​Inlining\n\nFunction inlining is one of the most common optimizations that benefits from PGO. PGO inlining is a compiler technique that uses runtime profiling data to optimize function inlining decisions. The first step is collecting profiling data during program execution to identify frequently executed (hot) functions. Then, the compiler uses this data to selectively inline these hot functions, reducing function call overhead. This approach leads to more efficient code, unlike traditional static inlining heuristics, which don’t account for actual runtime behavior.\n\n\nProfile Collection\nFigure 2: Profiling infrastructure for PGO. \n\nOur profiling infrastructure is designed to work seamlessly within a distributed system in production.\n\nWe collect continuous profiling data from multiple instances and merge these profiles to create a representative profile.\n\n​​\nPreprocessing\n\nAfter deploying PGO in our production environment, we observed a significant increase in build times across multiple services, with some experiencing delays of up to 8 times. This increase posed challenges for developers and service owners, making it crucial to address the issue promptly. \n\nFigure 3: Timing breakdown for PGO compilation passes.\n\n\nTo identify the root cause of the compilation time degradation, we analyzed the compiler’s performance and found that pprof data parsing accounted for a significant portion—up to 95%—of the total compilation time when the PGO flow was enabled. Additionally, the repeated reading and parsing of the pprof file for each package compilation contributed significantly to the cumulative overhead.\n\nTo mitigate the slow compilation, we proposed an offline tool to preprocess the profile. The PGO preprocessor tool involves extracting runtime profiling data, generating and caching intermediate call graphs, and using call graph information for further analysis and optimization during the compilation process in Go compiler. The tool is already up-streamed and approved into the community open-source version.\n\nHere are the basic steps involved in the PGO preprocessor in the Go compiler:\n\nExtract runtime profiling data: We use pprof profiles as input for the preprocessor tool. The new tool reads and parses profiling data once and extracts function call information of the Go program captured in the profiling data.\nConstruct call graphs: The extracted profiling information is converted to a call graph with node and edge weights (called WeightedCallGraph). The call graph is cached in a certain format, including the information of the function caller, callee, address, and weights. The graph is used as input to guide optimizations in the Go compiler, specifically targeting hotpaths in the code. Optimizations such as inlining and devirtualization use profiling information to optimize hot paths for improved performance. \nFeed the output to the compiler: The optimized code produced by the PGO-enabled compiler is linked with the rest of the program to create the final executable. During this phase, we enable link-time code and data layout optimization based on profile information to order the functions and data.\nFigure 4: PGO profile preprocessing architecture.\n\nTo make the compilation even faster, we execute the preprocessing tool on the most recently collected fleet-wide profiles every day. As a result, the production build can use the latest processed profile right away.\n\nThanks to the preprocessing tool, PGO build times were significantly reduced, with most services experiencing only a minimal increase compared to their original durations.\n\nPerformance Impact\n\n​​In this section, we show the performance impact of PGO inlining on synthetic benchmarks and on Uber services.\n\nSynthetic benchmarks\n\nFirst, we show the performance impact of PGO on open-source synthetic benchmarks. The data is collected on a server with Intel® Xeon® Gold 6136 CPU, 128GB of memory, and Linux® version 6.8.0.\n\ngo-json is one of the most widely used third-party JSON libraries in Go. It provides comprehensive benchmarks for ‌performance. We run the benchmarks on all standard encoding/JSON libraries with 20 iterations on all benchmarks. \n\nFigure 5: Performance benchmark of PGO on go-json.\n\nOverall, the PGO-driven inlining delivers a 12% performance improvement for the entire benchmark. A lot of microbenchmarks show more than 20% performance gain.\n\nThe reason for the performance improvement can also be validated by inspecting the iTLB (instruction translation lookaside buffer) misses. Comparing the number of misses from the original benchmark and the PGO-compiled binary in Figure 6, we can see that PGO can greatly reduce the number of iTLB misses by 30%.\n\n\tBaseline\tPGO\tChange\nInstructions\t2.84E+12\t2.77E+12\t-2.41%\nCycles\t9.34E+11\t9.10E+11\t-2.51%\nL1-icache-misses\t2.22E+09\t1.98E+09\t-10.78%\niTLB-misses\t5.07E+06\t3.31E+06\t-34.64%\n\nWe also investigated the profile of PGO and non-PGO runs. We found that the default inliner can’t inline those hot functions (such as checkValid in Figure 7) since the body size is larger than the default inliner budget. After the inliner budget is increased with PGO build, those 3 functions can be inlined. We also noticed the PGO inliner slightly increases the number of inlining call sites.\n\nFigure 7: Call graph of checkValid function.\n\nWe also investigated the reason for the performance improvement. In the baseline version, 35,545 call sites were inlined, where 36,544 call sites were inlined in the PGO version.\n\nTally is a popular library for fast, buffered, and hierarchical stats collection. After we apply PGO-driven inlining, it delivers an average 10% performance gain, and some of the microbenchmarks show more than 50% improvement.\n\nFigure 8: Performance comparison of PGO on Tally benchmark suite. \n\nEnrolling Uber Services\n\nWe currently enroll several thousand services at Uber with PGO. However, measuring PGO performance presents several challenges. One key difficulty is the lack of A/B performance measurement support in production with different compiled binaries, making it hard to directly compare PGO-optimized and non-optimized versions. Additionally, CPU usage can be significantly influenced by traffic variations (requests per second), which can fluctuate and skew results. The default autoscaling feature further complicates this by dynamically adjusting resources, making it difficult to isolate the impact of PGO. Moreover, ongoing changes to the service’s source code during the measurement period can introduce variability, making it challenging to attribute performance improvements solely to PGO optimizations.\n\nAfter extensive exploration of different methodologies, we found the best approach to measure impact is by comparing performance metrics for 7 days before and 7 days after enabling PGO.\n\nFigure 9: CPU core allocation count for top 6 services of 5 months.\n\nWe selected the top 6 services and measured CPU allocations with PGO enabled and disabled, as shown in Figure 9. The y-axis represents the number of CPU cores. The yellow line shows the number of cores when PGO is disabled, while the blue line represents the number of cores when PGO is enabled. Since 4/18/24, we’ve observed a reduction in the number of cores with PGO enabled. However, due to ‌autoscaling and varying RPS, we need to establish a method to correlate that the reduction in CPU allocation is directly related to PGO.\n\nTo verify the measured gain of PGO is real, we compared the profiles of non-PGO (Figure 10a) and PGO (Figure 10b) runs. It’s clear that the important functions such as checkValid aren’t inlined by default, but will be inlined with the PGO build. Therefore, we can draw the conclusion that measured gain does mostly come from PGO.\n\nFigure 10a: Profile collected during baseline binary execution.\nFigure 10b: Profile collected during PGO binary execution. \n\nConclusion\n\nProfile-guided optimizations can significantly enhance software performance by using runtime data to guide compiler optimizations. At Uber, PGO led to a ~4% performance gain through inlining optimizations and a reduction of 24,000 CPU cores across top services. Measuring PGO’s impact can be complex, but this analysis demonstrates its value in optimizing resource utilization and achieving substantial performance improvements.\n\nAcknowledgments\n\nWe’d like to acknowledge former team member Jin Lin for designing, implementing, and upstreaming PGO inline and basic block reordering. Jin also measured PGO performance changes internally. We also extend our gratitude to former team manager Raj Barik for designing, implementing, and upstreaming type specialization.\n\nAdditionally, we thank our former interns, Ghadeer Alabandi and Swastik Mittal, for their contributions. We’re grateful to our colleagues at Uber, including Rasmus Vestergaard, Sung Wang, Zhongpeng Lin, Haiming Tian, Anthony Blelloch, Saurabh Agrawal, Tapan Thaker, Curtis Patrick, Lasse Vilhelmsen, Paweł Królikowski, Sergey Balabanov, Niels Lindgren, Tony Alaniz, Cristian Velazquez, Kanad Sinha, Siyang Liu, Minglei Wang, Johan Mena, Taiwon Chung, Ryan Hang, and Jacob Oaks.\n\nFinally, we’d like to thank Michael Pratt, Cherry Mui, and Austin Clements from the Google Go compiler team for their support and collaboration.\n\nCover Photo Attribution: Image generated using the ImageGen3 AI model.\n\nGoogle® is a registered trademark of Google Inc.\n\nLinux® is the registered trademark of Linus Torvalds in the U.S. and other countries.\n\nMeta® is a registered trademark of Meta Inc.\n\nJava, MySQL, and NetSuite are registered trademarks of Oracle® and/or its affiliates.\n\nSwift® and the Swift logo are trademarks of Apple® Inc.\n\nXeon® is a trademark of Intel® Corporation or its subsidiaries.\n\nCategory\nEngineering\nBackend\nWritten by\n\nYufan Xu\n\nYufan Xu is a Software Engineer on the Programming System team at Uber. His research interests include compiler and ML system optimization.\n\nShauvik Roy Choudhary\n\nShauvik Roy Choudhary is the Engineering Manager of the Programming Systems team at Uber. He’s an experienced leader in the developer tools and AI/ML space, building innovative solutions to improve software quality and performance.\n\nChris Zhang\n\nChris Zhang is a Software Engineer on the Programming System team at Uber. His research interests include computer architecture, compilers, operating systems, and microservices.\n\nMilind Chabbi\n\nMilind Chabbi is a Senior Staff Researcher on the Programming Systems Research team at Uber. He leads research initiatives across Uber in the areas of compiler optimizations, high-performance parallel computing, synchronization techniques, and performance analysis tools to make large, complex computing systems reliable and efficient.\n\nRelated Articles\n6 articles\nBackend\nEngineering\nHow Uber Executed A JUnit Migration at Massive Scale\nApril 7, 2026\nData / ML\nEngineering\nUnder the Hood: Scaling Responsible AI at Uber\nApril 2, 2026\nData / ML\nEngineering\nUber AI\nHow Uber Built an Agentic System to Automate Design Specs in Minutes\nMarch 11, 2026\nData / ML\nEngineering\nUber AI\nTransforming Ads Personalization with Sequential Modeling and Hetero-MMoE at Uber\nMarch 10, 2026\nBackend\nEngineering\nBuilding High Throughput Payment Account Processing\nMarch 5, 2026\nData / ML\nEngineering\nSecurity\nSuperuser Gateway: Guardrails for Privileged Command Execution\nFebruary 26, 2026\nWe use cookies\n\nSelect “Accept” to enable Uber to use cookies to personalize this site. We use cookies to remember your location, deliver ads, and measure ad effectiveness on other apps and websites, including social media. Customize your preferences in your Cookie Settings, or select Reject if you only want us to use essential cookies. Learn more in our Cookie Notice.\n\nCookie settings\nReject\nAccept",
+    "quality_score": 9,
+    "modules": [
+      "go_patterns",
+      "performance"
+    ]
+  },
   {
     "url": "https://engineering.fb.com/2025/08/26/open-source/enabling-kotlin-incremental-compilation-on-buck2/",
     "title": "Enabling Kotlin incremental compilation on Buck2",
@@ -453,39 +511,5 @@
       "js_advanced",
       "performance"
     ]
-  },
-  {
-    "url": "https://blog.cloudflare.com/go-and-enhance-your-calm/",
-    "title": "Go and enhance your calm: demolishing an HTTP/2 interop problem",
-    "source_name": "Cloudflare Blog",
-    "text": "2025-10-31 6 min read In September 2025, a thread popped up in our internal engineering chat room asking, \"Which part of our stack would be responsible for sending ErrCode=ENHANCE_YOUR_CALM to an HTTP/2 client?\" Two internal microservices were experiencing a critical error preventing their communication and the team needed a timely answer. In this blog post, we describe the background to well-known HTTP/2 attacks that trigger Cloudflare defences, which close connections. We then document an easy-to-make mistake using Go's standard library that can cause clients to send PING flood attacks and how you can avoid it. HTTP/2 is powerful – but it can be easy to misuse HTTP/2 defines a binary wire format for encoding HTTP semantics . Request and response messages are encoded as a series of HEADERS and DATA frames, each associated with a logical stream, sent over a TCP connection using TLS. There are also control frames that relate to the management of streams or the connection as a whole. For example, SETTINGS frames advertise properties of an endpoint, WINDOW_UPDATE frames provide flow control credit to a peer so that it can send data, RST_STREAM can be used to cancel or reject a request or response, while GOAWAY can be used to signal graceful or immediate connection closure. HTTP/2 provides many powerful features that have legitimate uses. However, with great power comes responsibility and opportunity for accidental or intentional misuse. The specification details a number of denial-of-service considerations . Implementations are advised to harden themselves: \"An endpoint that doesn't monitor use of these features exposes itself to a risk of denial of service. Implementations SHOULD track the use of these features and set limits on their use.\" Cloudflare implements many different HTTP/2 defenses, developed over years in order to protect our systems and our customers. Some notable examples include mitigations added in 2019 to address \" Netflix vulnerabilities \" and in 2023 to mitigate Rapid Reset and similar style attacks. When Cloudflare detects that HTTP/2 client behaviour is likely malicious, we close the connection using the GOAWAY frame and include the error code ENHANCE_YOUR_CALM . One of the well-known and common attacks is CVE-2019-9512 , aka PING flood: \"The attacker sends continual pings to an HTTP/2 peer, causing the peer to build an internal queue of responses. Depending on how efficiently this data is queued, this can consume excess CPU, memory, or both.\" Sending a PING frame causes the peer to respond with a PING acknowledgement (indicated by an ACK flag). This allows for checking the liveness of the HTTP connection, along with measuring the layer 7 round-trip time – both useful things. The requirement to acknowledge a PING, however, provides the potential attack vector since it generates work for the peer. A client that PINGs the Cloudflare edge too frequently will trigger our CVE-2019-9512 mitigations, causing us to close the connection. Shortly after we launched support for gRPC in 2020, we encountered interoperability issues with some gRPC clients that sent many PINGs as part of a performance optimization for window tuning . We also discovered that the Rust Hyper crate had a feature called Adaptive Window that emulated the design and triggered a similar problem until Hyper made a fix . Solving a microservice miscommunication mystery When that thread popped up asking which part of our stack was responsible for sending the ENHANCE_YOUR_CALM error code, it was regarding a client communicating over HTTP/2 between two internal microservices. We suspected that this was an HTTP/2 mitigation issue and confirmed it was a PING flood mitigation in our logs. But taking a step back, you may wonder why two internal microservices are communicating over the Cloudflare edge at all, and therefore hitting our mitigations. In this case, communicating over the edge provides us with several advantages: We get to dogfood our edge infrastructure and discover issues like this! We can use Cloudflare Access for authentication. This allows our microservices to be accessed securely by both other services (using service tokens) and engineers (which is invaluable for debugging). Internal services that are written with Cloudflare Workers can easily communicate with services that are accessible at the edge. The question remained: Why was this client behaving this way? We traded some ideas as we attempted to get to the bottom of the issue. The client had a configuration that would indicate that it didn't need to PING very frequently: t2.PingTimeout = 2 * time.Second t2.ReadIdleTimeout = 5 * time.Second However, in situations like this it is generally a good idea to establish ground truth about what is really happening \"on the wire.\" For instance, grabbing a packet capture that can be dissected and explored in Wireshark can provide unequivocal evidence of precisely what was sent over the network. The next best option is detailed/trace logging at the sender or receiver, although sometimes logging can be misleading, so caveat emptor. In our particular case, it was simpler to use logging with GODEBUG=http2debug=2 . We built a simplified minimal reproduction of the client that triggered the error, helping to eliminate other potential variables. We did some group log analysis, combined with diving into some of the Go standard library code to understand what it was really doing. Issac Asimov is commonly credited with the quote \"The most exciting phrase to hear in science, the one that heralds new discoveries, is not 'Eureka!' but 'That's funny...'\" and sure enough, within the hour someone declared– the funny part I see is this: 2025/09/02 17:33:18 http2: Framer 0x14000624540: wrote RST_STREAM stream=9 len=4 ErrCode=CANCEL 2025/09/02 17:33:18 http2: Framer 0x14000624540: wrote PING len=8 ping=\"j\\xe7\\xd6R\\xdaw\\xf8+\" every ping seems to be preceded by a RST_STREAM Observant readers will recall the earlier mention of Rapid Reset. However, our logs clearly indicated ENHANCE_YOUR_CALM being triggered due to the PING flood. A bit of searching landed us on this mailing list thread and the comment \"Sending a PING frame along with an RST_STREAM allows a client to distinguish between an unresponsive server and a slow response.\" That seemed quite relevant. We also found a change that was committed related to this topic. This partly answered why there were so many PINGs, but it also raised a new question: Why so many stream resets? So we went back to the logs and built up a little more context about the interaction: 2025/09/02 17:33:18 http2: Transport received DATA flags=END_STREAM stream=47 len=0 data=\"\" 2025/09/02 17:33:18 http2: Framer 0x14000624540: wrote RST_STREAM stream=47 len=4 ErrCode=CANCEL 2025/09/02 17:33:18 http2: Framer 0x14000624540: wrote PING len=8 ping=\"\\x97W\\x02\\xfa>\\xa8\\xabi\" The interesting thing here is that the server had sent a DATA frame with the END_STREAM flag set. Per the HTTP/2 stream state machine , the stream should have transitioned to closed when a frame with END_STREAM was processed. The client doesn't need to do anything in this state – sending a RST_STREAM is entirely unnecessary. A little more digging and noodling and an engineer proclaimed: I noticed that the reset+ping only happens when you call r esp.Body.Close() I believe Go's HTTP library doesn't actually read the response body automatically, but keeps the stream open for you to use until you call r esp.Body.Close() , which you can do at any point you like. The hilarious thing in our example was that there wasn't actually any HTTP body to read. From the earlier example: received DATA flags=END_STREAM stream=47 len=0 data=\"\" . Science and engineering are at times weird and counterintuitive. We decided to tweak our client to read the (absent) body via io.Copy(io.Discard, resp.Body) before closing it. Sure enough, this immediately stopped the client sending both a useless RST_STREAM and, by association, a PING frame. Mystery solved? To prove we had fixed the root cause, the production client was updated with a similar fix. A few hours later, all the ENHANCE_YOUR_CALM closures were eliminated. Reading bodies in Go can be unintuitive It’s worth noting that in some situations, ensuring the response body is always read can sometimes be unintuitive in Go. For example, at first glance it appears that the response body will always be read in the following example: resp, err := http.DefaultClient.Do(req) if err != nil { return err } defer resp.Body.Close() if err := json.NewDecoder(resp.Body).Decode(&respBody); err != nil { return err } However, json.Decoder stops reading as soon as it finds a complete JSON document or errors. If the response body contains multiple JSON documents or invalid JSON, then the entire response body may still not be read. Therefore, in our clients, we’ve started replacing defer response.Body.Close() with the following pattern to ensure that response bodies are always fully read: resp, err := http.DefaultClient.Do(req) if err != nil { return err } defer func() { io.Copy(io.Discard, resp.Body) resp.Body.Close() }() if err := json.NewDecoder(resp.Body).Decode(&respBody); err != nil { return err } Actions to take if you encounter ENHANCE_YOUR_CALM HTTP/2 is a protocol with several features. Many implementations have implemented hardening to protect themselves from misuse of features, which can trigger a connection to be closed. The recommended error code for closing connections in such conditions is ENHANCE_YOUR_CALM. There are numerous HTTP/2 implementations and APIs, which may drive the use of HTTP/2 features in unexpected ways that could appear like attacks. If you have an HTTP/2 client that encounters closures with ENHANCE_YOUR_CALM, we recommend that you try to establish ground truth with packet captures (including TLS decryption keys via mechanisms like SSLKEYLOGFILE ) and/or detailed trace logging. Look for patterns of frequent or repeated frames that might be similar to malicious traffic. Adjusting your client may help avoid it getting misclassified as an attacker. If you use Go, we recommend always reading HTTP/2 response bodies (even if empty) in order to avoid sending unnecessary RST_STREAM and PING frames. This is especially important if you use a single connection for multiple requests, which can cause a high frequency of these frames. This was also a great reminder of the advantages of dogfooding our own products within our internal services. When we run into issues like this one, our learnings can benefit our customers with similar setups. Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . HTTP2 Go DDoS",
-    "quality_score": 8,
-    "modules": [
-      "go_patterns",
-      "error_resilience"
-    ]
-  },
-  {
-    "url": "https://blog.cloudflare.com/improving-platform-resilience-at-cloudflare/",
-    "title": "Improving platform resilience at Cloudflare through automation",
-    "source_name": "Cloudflare Blog",
-    "text": "2024-10-09 8 min read Failure is an expected state in production systems, and no predictable failure of either software or hardware components should result in a negative experience for users. The exact failure mode may vary, but certain remediation steps must be taken after detection. A common example is when an error occurs on a server, rendering it unfit for production workloads, and requiring action to recover. When operating at Cloudflare’s scale, it is important to ensure that our platform is able to recover from faults seamlessly. It can be tempting to rely on the expertise of world-class engineers to remediate these faults, but this would be manual, repetitive, unlikely to produce enduring value, and not scaling. In one word: toil; not a viable solution at our scale and rate of growth. In this post we discuss how we built the foundations to enable a more scalable future, and what problems it has immediately allowed us to solve. Growing pains The Cloudflare Site Reliability Engineering (SRE) team builds and manages the platform that helps product teams deliver our extensive suite of offerings to customers. One important component of this platform is the collection of servers that power critical products such as Durable Objects, Workers, and DDoS mitigation. We also build and maintain foundational software services that power our product offerings, such as configuration management, provisioning, and IP address allocation systems. As part of tactical operations work, we are often required to respond to failures in any of these components to minimize impact to users. Impact can vary from lack of access to a specific product feature, to total unavailability. The level of response required is determined by the priority, which is usually a reflection of the severity of impact on users. Lower-priority failures are more common — a server may run too hot, or experience an unrecoverable hardware error. Higher-priority failures are rare and are typically resolved via a well-defined incident response process, requiring collaboration with multiple other teams. The commonality of lower-priority failures makes it obvious when the response required, as defined in runbooks, is “toilsome”. To reduce this toil, we had previously implemented a plethora of solutions to automate runbook actions such as manually-invoked shell scripts, cron jobs, and ad-hoc software services. These had grown organically over time and provided solutions on a case-by-case basis, which led to duplication of work, tight coupling, and lack of context awareness across the solutions. We also care about how long it takes to resolve any potential impact on users. A resolution process which involves the manual invocation of a script relies on human action, increasing the Mean-Time-To-Resolve (MTTR) and leaving room for human error. This risks increasing the amount of errors we serve to users and degrading trust. These problems proved that we needed a way to automatically heal these platform components. This especially applies to our servers, for which failure can cause impact across multiple product offerings. While we have mechanisms to automatically steer traffic away from these degraded servers, in some rare cases the breakage is sudden enough to be visible. Solving the problem To provide a more reliable platform, we needed a new component that provides a common ground for remediation efforts. This would remove duplication of work, provide unified context-awareness and increase development speed, which ultimately saves hours of engineering time and effort. A good solution would not allow only the SRE team to auto-remediate, it would empower the entire company. The key to adding self-healing capability was a generic interface for all teams to self-service and quickly remediate failures at various levels: machine, service, network, or dependencies. A good way to think about auto-remediation is in terms of workflows. A workflow is a sequence of steps to get to a desired outcome. This is not dissimilar to a manual shell script which executes what a human would otherwise do via runbook instructions. Because of this logical fit with workflows and durable execution, we decided to adopt an open-source platform called Temporal . The concept of durable execution is useful to gracefully manage infrastructure failures such as network outages and transient failures in external service endpoints. This capability meant we only needed to build a way to schedule “workflow” tasks and have the code provide reliability guarantees by default, using Temporal. This allowed us to focus on building out the orchestration system to support the control and flow of workflow execution in our data centers. Temporal’s documentation provides a good introduction to writing Temporal workflows. Below, we describe how our automatic remediation system works. It is essentially a way to schedule tasks across our global network with built-in reliability guarantees. With this system, teams can serve their customers more reliably. An unexpected failure mode can be recognized and immediately mitigated, while the root cause can be determined later via a more detailed analysis. Step one: we need a coordinator After our initial testing of Temporal, it was now possible to write workflows. But we needed a way to schedule workflow tasks from other internal services. The coordinator was built to serve this purpose, and became the primary mechanism for the authorisation and scheduling of workflows. The most important roles of the coordinator are authorisation, workflow task routing, and safety constraints enforcement. Each consumer is authorized via mTLS authentication , and the coordinator uses an ACL to determine whether to permit the execution of a workflow. An ACL configuration looks like the following example. server_config { enable_tls = true [...] route_rule { name = \"global_get\" method = \"GET\" route_patterns = [\"/*\"] uris = [\"spiffe://example.com/worker-admin\"] } route_rule { name = \"global_post\" method = \"POST\" route_patterns = [\"/*\"] uris = [\"spiffe://example.com/worker-admin\"] allow_public = true } route_rule { name = \"public_access\" method = \"GET\" route_patterns = [\"/metrics\"] uris = [] allow_public = true skip_log_match = true } } Each workflow specifies two key characteristics: where to run the tasks and the safety constraints, using an HCL configuration file. Example constraints could be whether to run on only a specific node type (such as a database), or if multiple parallel executions are allowed: if a task has been triggered too many times, that is a sign of a wider problem that might require human intervention. The coordinator uses the Temporal Visibility API to determine the current state of the executions in the Temporal cluster. An example of a configuration file is shown below: task_queue_target = \"<target>\" # The following entries will ensure that # 1. This workflow is not run at the same time in a 15m window. # 2. This workflow will not run more than once an hour. # 3. This workflow will not run more than 3 times in one day. # constraint { kind = \"concurency\" value = \"1\" period = \"15m\" } constraint { kind = \"maxExecution\" value = \"1\" period = \"1h\" } constraint { kind = \"maxExecution\" value = \"3\" period = \"24h\" is_global = true } Step two: Task Routing is amazing An unforeseen benefit of using a central Temporal cluster was the discovery of Task Routing. This feature allows us to schedule a Workflow/Activity on any server that has a running Temporal Worker, and further segment by the type of server, its location, etc. For this reason, we have three primary task queues — the general queue in which tasks can be executed by any worker in the datacenter, the node type queue in which tasks can only be executed by a specific node type in the datacenter, and the individual node queue where we target a specific node for task execution. We rely on this heavily to ensure the speed and efficiency of automated remediation. Certain tasks can be run in datacenters with known low latency to an external resource, or a node type with better performance than others (due to differences in the underlying hardware). This reduces the amount of failure and latency we see overall in task executions. Sometimes we are also constrained by certain types of tasks that can only run on a certain node type, such as a database. Task Routing also means that we can configure certain task queues to have a higher priority for execution, although this is not a feature we have needed so far. A drawback of task routing is that every Workflow/Activity needs to be registered to the target task queue, which is a common gotcha. Thankfully, it is possible to catch this failure condition with proper testing. Step three: when/how to self-heal? None of this would be relevant if we didn’t put it to good use. A primary design goal for the platform was to ensure we had easy, quick ways to trigger workflows on the most important failure conditions. The next step was to determine what the best sources to trigger the actions were. The answer to this was simple: we could trigger workflows from anywhere as long as they are properly authorized and detect the failure conditions accurately. Example triggers are an alerting system, a log tailer, a health check daemon, or an authorized engineer via a chatbot. Such flexibility allows a high level of reuse, and permits to invest more in workflow quality and reliability. As part of the solution, we built a daemon that is able to poll a signal source for any unwanted condition and trigger a configured workflow. We have initially found Prometheus useful as a source because it contains both service-level and hardware/system-level metrics. We are also exploring more event-based trigger mechanisms, which could eliminate the need to use precious system resources to poll for metrics. We already had internal services that are able to detect widespread failure conditions for our customers, but were only able to page a human. With the adoption of auto-remediation, these systems are now able to react automatically. This ability to create an automatic feedback loop with our customers is the cornerstone of these self-healing capabilities, and we continue to work on stronger signals, faster reaction times, and better prevention of future occurrences. The most exciting part, however, is the future possibility. Every customer cares about any negative impact from Cloudflare. With this platform we can onboard several services (especially those that are foundational for the critical path) and ensure we react quickly to any failure conditions, even before there is any visible impact. Step four: packaging and deployment The whole system is written in golang , and a single binary can implement each role. We distribute it as an apt package or a container for maximum ease of deployment. We deploy a Temporal-based worker to every server we intend to run tasks on, and a daemon in datacenters where we intend to automatically trigger workflows based on the local conditions. The coordinator is more nuanced since we rely on task routing and can trigger from a central coordinator, but we have also found value in running coordinators locally in the datacenters. This is especially useful in datacenters with less capacity or degraded performance, removing the need for a round-trip to schedule the workflows. Step five: test, test, test Temporal provides native mechanisms to test an entire workflow, via a comprehensive test suite that supports end-to-end, integration, and unit testing, which we used extensively to prevent regressions while developing. We also ensured proper test coverage for all the critical platform components, especially the coordinator. Despite the ease of written tests, we quickly discovered that they were not enough. After writing workflows, engineers need an environment as close as possible to the target conditions. This is why we configured our staging environments to support quick and efficient testing. These environments receive the latest changes and point to a different (staging) Temporal cluster, which enables experimentation and easy validation of changes. After a workflow is validated in the staging environment, we can then do a full release to production. It seems obvious, but catching simple configuration errors before releasing has saved us many hours in development/change-related-task time. Deploying to production As you can guess from the title of this post, we put this in production to automatically react to server-specific errors and unrecoverable failures. To this end, we have a set of services that are able to detect single-server failure conditions based on analyzed traffic data. After deployment, we have successfully mitigated potential impact by taking any errant single sources of failure out of production. We have also created a set of workflows to reduce internal toil and improve efficiency. These workflows can automatically test pull requests on target machines, wipe and reset servers after experiments are concluded, and take away manual processes that cost many hours in toil. Building a system that is maintained by several SRE teams has allowed us to iterate faster, and rapidly tackle long-standing problems. We have set ambitious goals regarding toil elimination and are on course to achieve them, which will allow us to scale faster by eliminating the human bottleneck. Looking to the future Our immediate plans are to leverage this system to provide a more reliable platform for our customers and drastically reduce operational toil, freeing up engineering resources to tackle larger-scale problems. We also intend to leverage more Temporal features such as Workflow Versioning , which will simplify the process of making changes to workflows by ensuring that triggered workflows run expected versions. We are also interested in how others are solving problems using durable execution platforms such as Temporal, and general strategies to eliminate toil. If you would like to discuss this further, feel free to reach out on the Cloudflare Community and start a conversation! If you’re interested in contributing to projects that help build a better Internet, our engineering teams are hiring . Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . Edge Engineering Serverless Developer Platform Developers Go Reliability Speed & Reliability",
-    "quality_score": 8,
-    "modules": [
-      "error_resilience",
-      "go_patterns",
-      "devops"
-    ]
-  },
-  {
-    "url": "https://blog.cloudflare.com/how-we-found-a-bug-in-gos-arm64-compiler/",
-    "title": "How we found a bug in Go's arm64 compiler",
-    "source_name": "Cloudflare Blog",
-    "text": "2025-10-08 10 min read This post is also available in 日本語 . Every second, 84 million HTTP requests are hitting Cloudflare across our fleet of data centers in 330 cities. It means that even the rarest of bugs can show up frequently. In fact, it was our scale that recently led us to discover a bug in Go's arm64 compiler which causes a race condition in the generated code. This post breaks down how we first encountered the bug, investigated it, and ultimately drove to the root cause. Investigating a strange panic We run a service in our network which configures the kernel to handle traffic for some products like Magic Transit and Magic WAN . Our monitoring watches this closely, and it started to observe very sporadic panics on arm64 machines. We first saw one with a fatal error stating that traceback did not unwind completely . That error suggests that invariants were violated when traversing the stack, likely because of stack corruption. After a brief investigation we decided that it was probably rare stack memory corruption. This was a largely idle control plane service where unplanned restarts have negligible impact, and so we felt that following up was not a priority unless it kept happening. And then it kept happening. Coredumps per hour When we first saw this bug we saw that the fatal errors correlated with recovered panics. These were caused by some old code which used panic/recover as error handling. At this point, our theory was: All of the fatal panics happen within stack unwinding. We correlated an increased volume of recovered panics with these fatal panics. Recovering a panic unwinds goroutine stacks to call deferred functions. A related Go issue (#73259) reported an arm64 stack unwinding crash. Let’s stop using panic/recover for error handling and wait out the upstream fix? So we did that and watched as fatal panics stopped occurring as the release rolled out. Fatal panics gone, our theoretical mitigation seemed to work, and this was no longer our problem. We subscribed to the upstream issue so we could update when it was resolved and put it out of our minds. But, this turned out to be a much stranger bug than expected. Putting it out of our minds was premature as the same class of fatal panics came back at a much higher rate. A month later, we were seeing up to 30 daily fatal panics with no real discernible cause; while that might account for only one machine a day in less than 10% of our data centers, we found it concerning that we didn’t understand the cause. The first thing we checked was the number of recovered panics, to match our previous pattern, but there were none. More interestingly, we could not correlate this increased rate of fatal panics with anything. A release? Infrastructure changes? The position of Mars? At this point we felt like we needed to dive deeper to better understand the root cause. Pattern matching and hoping was clearly insufficient. We saw two classes of this bug -- a crash while accessing invalid memory and an explicitly checked fatal error. Fatal Error goroutine 153 gp=0x4000105340 m=324 mp=0x400639ea08 [GC worker (active)]: /usr/local/go/src/runtime/asm_arm64.s:244 +0x6c fp=0x7ff97fffe870 sp=0x7ff97fffe860 pc=0x55558d4098fc runtime.systemstack(0x0) /usr/local/go/src/runtime/mgc.go:1508 +0x68 fp=0x7ff97fffe860 sp=0x7ff97fffe810 pc=0x55558d3a9408 runtime.gcBgMarkWorker.func2() /usr/local/go/src/runtime/mgcmark.go:1102 runtime.gcDrainMarkWorkerIdle(...) /usr/local/go/src/runtime/mgcmark.go:1188 +0x434 fp=0x7ff97fffe810 sp=0x7ff97fffe7a0 pc=0x55558d3ad514 runtime.gcDrain(0x400005bc50, 0x7) /usr/local/go/src/runtime/mgcmark.go:212 +0x1c8 fp=0x7ff97fffe7a0 sp=0x7ff97fffe6f0 pc=0x55558d3ab248 runtime.markroot(0x400005bc50, 0x17e6, 0x1) /usr/local/go/src/runtime/mgcmark.go:238 +0xa8 fp=0x7ff97fffe6f0 sp=0x7ff97fffe6a0 pc=0x55558d3ab578 runtime.markroot.func1() /usr/local/go/src/runtime/mgcmark.go:887 +0x290 fp=0x7ff97fffe6a0 sp=0x7ff97fffe560 pc=0x55558d3acaa0 runtime.scanstack(0x4014494380, 0x400005bc50) /usr/local/go/src/runtime/traceback.go:447 +0x2ac fp=0x7ff97fffe560 sp=0x7ff97fffe4d0 pc=0x55558d3eeb7c runtime.(*unwinder).next(0x7ff97fffe5b0?) /usr/local/go/src/runtime/traceback.go:566 +0x110 fp=0x7ff97fffe4d0 sp=0x7ff97fffe490 pc=0x55558d3eed40 runtime.(*unwinder).finishInternal(0x7ff97fffe4f8?) /usr/local/go/src/runtime/panic.go:1073 +0x38 fp=0x7ff97fffe490 sp=0x7ff97fffe460 pc=0x55558d403388 runtime.throw({0x55558de6aa27?, 0x7ff97fffe638?}) runtime stack: fatal error: traceback did not unwind completely stack=[0x4015d6a000-0x4015d8a000 runtime: g8221077: frame.sp=0x4015d784c0 top=0x4015d89fd0 Segmentation fault goroutine 187 gp=0x40003aea80 m=13 mp=0x40003ca008 [GC worker (active)]: /usr/local/go/src/runtime/asm_arm64.s:244 +0x6c fp=0x7fff2afde870 sp=0x7fff2afde860 pc=0x55557e2d98fc runtime.systemstack(0x0) /usr/local/go/src/runtime/mgc.go:1489 +0x94 fp=0x7fff2afde860 sp=0x7fff2afde810 pc=0x55557e279434 runtime.gcBgMarkWorker.func2() /usr/local/go/src/runtime/mgcmark.go:1112 runtime.gcDrainMarkWorkerDedicated(...) /usr/local/go/src/runtime/mgcmark.go:1188 +0x434 fp=0x7fff2afde810 sp=0x7fff2afde7a0 pc=0x55557e27d514 runtime.gcDrain(0x4000059750, 0x3) /usr/local/go/src/runtime/mgcmark.go:212 +0x1c8 fp=0x7fff2afde7a0 sp=0x7fff2afde6f0 pc=0x55557e27b248 runtime.markroot(0x4000059750, 0xb8, 0x1) /usr/local/go/src/runtime/mgcmark.go:238 +0xa8 fp=0x7fff2afde6f0 sp=0x7fff2afde6a0 pc=0x55557e27b578 runtime.markroot.func1() /usr/local/go/src/runtime/mgcmark.go:887 +0x290 fp=0x7fff2afde6a0 sp=0x7fff2afde560 pc=0x55557e27caa0 runtime.scanstack(0x40042cc000, 0x4000059750) /usr/local/go/src/runtime/traceback.go:458 +0x188 fp=0x7fff2afde560 sp=0x7fff2afde4d0 pc=0x55557e2bea58 runtime.(*unwinder).next(0x7fff2afde5b0) goroutine 0 gp=0x40003af880 m=13 mp=0x40003ca008 [idle]: PC=0x55557e2bea58 m=13 sigcode=1 addr=0x118 SIGSEGV: segmentation violation Now we could observe some clear patterns. Both errors occur when unwinding the stack in (*unwinder).next . In one case we saw an intentional fatal error as the runtime identified that unwinding could not complete and the stack was in a bad state. In the other case there was a direct memory access error that happened while trying to unwind the stack. The segfault was discussed in the GitHub issue and a Go engineer identified it as dereference of a go scheduler struct, m , when unwinding . A review of Go scheduler structs Go uses a lightweight userspace scheduler to manage concurrency. Many goroutines are scheduled on a smaller number of kernel threads – this is often referred to as M:N scheduling. Any individual goroutine can be scheduled on any kernel thread. The scheduler has three core types – g (the goroutine), m (the kernel thread, or “machine”), and p (the physical execution context, or “processor”). For a goroutine to be scheduled a free m must acquire a free p , which will execute a g. Each g contains a field for its m if it is currently running, otherwise it will be nil . This is all the context needed for this post but the go runtime docs explore this more comprehensively. At this point we can start to make inferences on what’s happening: the program crashes because we try to unwind a goroutine stack which is invalid. In the first backtrace, if a return address is null, we call finishInternal and abort because the stack was not fully unwound . The segmentation fault case in the second backtrace is a bit more interesting: if instead the return address is non-zero but not a function then the unwinder code assumes that the goroutine is currently running. It'll then dereference m and fault by accessing m.incgo (the offset of incgo into struct m is 0x118, the faulting memory access). What, then, is causing this corruption? The traces were difficult to get anything useful from – our service has hundreds if not thousands of active goroutines. It was fairly clear from the beginning that the panic was remote from the actual bug. The crashes were all observed while unwinding the stack and if this were an issue any time the stack was unwound on arm64 we would be seeing it in many more services. We felt pretty confident that the stack unwinding was happening correctly but on an invalid stack. Our investigation stalled for a while at this point – making guesses, testing guesses, trying to infer if the panic rate went up or down, or if nothing changed. There was a known issue on Go’s GitHub issue tracker which matched our symptoms almost exactly, but what they discussed was mostly what we already knew. At some point when looking through the linked stack traces we realized that their crash referenced an old version of a library that we were also using – Go Netlink. goroutine 1267 gp=0x4002a8ea80 m=nil [runnable (scan)]: runtime.asyncPreempt2() /usr/local/go/src/runtime/preempt.go:308 +0x3c fp=0x4004cec4c0 sp=0x4004cec4a0 pc=0x46353c runtime.asyncPreempt() /usr/local/go/src/runtime/preempt_arm64.s:47 +0x9c fp=0x4004cec6b0 sp=0x4004cec4c0 pc=0x4a6a8c github.com/vishvananda/netlink/nl.(*NetlinkSocket).Receive(0x14360300000000?) /go/pkg/mod/github.com/!data!dog/ [email protected] /nl/nl_linux.go:803 +0x130 fp=0x4004cfc710 sp=0x4004cec6c0 pc=0xf95de0 We spot-checked a few stack traces and confirmed the presence of this Netlink library. Querying our logs showed that not only did we share a library – every single segmentation fault we observed had happened while preempting NetlinkSocket.Receive . What’s (async) preemption? In the prehistoric era of Go (<=1.13) the runtime was cooperatively scheduled. A goroutine would run until it decided it was ready to yield to the scheduler – usually due to explicit calls to runtime.Gosched() or injected yield points at function calls/IO operations. Since Go 1.14 the runtime instead does async preemption. The Go runtime has a thread sysmon which tracks the runtime of goroutines and will preempt any that run for longer than 10ms (at time of writing). It does this by sending SIGURG to the OS thread and in the signal handler will modify the program counter and stack to mimic a call to asyncPreempt . At this point we had two broad theories: This is a Go Netlink bug – likely due to unsafe.Pointer usage which invoked undefined behavior but is only actually broken on arm64 This is a Go runtime bug and we're only triggering it in NetlinkSocket.Receive for some reason After finding the same bug publicly reported upstream, we were feeling confident this was caused by a Go runtime bug. However, upon seeing that both issues implicated the same function, we felt more skeptical – notably the Go Netlink library uses unsafe.Pointer so memory corruption was a plausible explanation even if we didn't understand why. After an unsuccessful code audit we had hit a wall. The crashes were rare and remote from the root cause. Maybe these crashes were caused by a runtime bug, maybe they were caused by a Go Netlink bug. It seemed clear that there was something wrong with this area of the code, but code auditing wasn’t going anywhere. Breakthrough At this point we had a fairly good understanding of what was crashing but very little understanding of why it was happening. It was clear that the root cause of the stack unwinder crashing was remote from the actual crash, and that it had to do with (*NetlinkSocket).Receive , but why? We were able to capture a coredump of a production crash and view it in a debugger. The backtrace confirmed what we already knew – that there was a segmentation fault when unwinding a stack. The crux of the issue revealed itself when we looked at the goroutine which had been preempted while calling (*NetlinkSocket).Receive . (dlv) bt 0 0x0000555577579dec in runtime.asyncPreempt2 at /usr/local/go/src/runtime/preempt.go:306 1 0x00005555775bc94c in runtime.asyncPreempt at /usr/local/go/src/runtime/preempt_arm64.s:47 2 0x0000555577cb2880 in github.com/vishvananda/netlink/nl.(*NetlinkSocket).Receive at /vendor/github.com/vishvananda/netlink/nl/nl_linux.go:779 3 0x0000555577cb19a8 in github.com/vishvananda/netlink/nl.(*NetlinkRequest).Execute at /vendor/github.com/vishvananda/netlink/nl/nl_linux.go:532 4 0x0000555577551124 in runtime.heapSetType at /usr/local/go/src/runtime/mbitmap.go:714 5 0x0000555577551124 in runtime.heapSetType at /usr/local/go/src/runtime/mbitmap.go:714 ... (dlv) disass -a 0x555577cb2878 0x555577cb2888 TEXT github.com/vishvananda/netlink/nl.(*NetlinkSocket).Receive(SB) /vendor/github.com/vishvananda/netlink/nl/nl_linux.go nl_linux.go:779 0x555577cb2878 fdfb7fa9 LDP -8(RSP), (R29, R30) nl_linux.go:779 0x555577cb287c ff430191 ADD $80, RSP, RSP nl_linux.go:779 0x555577cb2880 ff434091 ADD $(16<<12), RSP, RSP nl_linux.go:779 0x555577cb2884 c0035fd6 RET The goroutine was paused between two opcodes in the function epilogue. Since the process of unwinding a stack relies on the stack frame being in a consistent state, it felt immediately suspicious that we preempted in the middle of adjusting the stack pointer. The goroutine had been paused at 0x555577cb2880, between ADD $80, RSP, RSP and ADD $(16<<12), RSP, RSP . We queried the service logs to confirm our theory. This wasn’t isolated – the majority of stack traces showed that this same opcode was preempted. This was no longer a weird production crash we couldn’t reproduce. A crash happened when the Go runtime preempted between these two stack pointer adjustments. We had our smoking gun. Building a minimal reproducer At this point we felt pretty confident that this was actually just a runtime bug and it should be reproducible in an isolated environment without any dependencies. The theory at this point was: Stack unwinding is triggered by garbage collection Async preemption between a split stack pointer adjustment causes a crash What if we make a function which splits the adjustment and then call it in a loop? package main import ( \"runtime\" ) //go:noinline func big_stack(val int) int { var big_buffer = make([]byte, 1 << 16) sum := 0 // prevent the compiler from optimizing out the stack for i := 0; i < (1<<16); i++ { big_buffer[i] = byte(val) } for i := 0; i < (1<<16); i++ { sum ^= int(big_buffer[i]) } return sum } func main() { go func() { for { runtime.GC() } }() for { _ = big_stack(1000) } } This function ends up with a stack frame slightly larger than can be represented in 16 bits, and so on arm64 the Go compiler will split the stack pointer adjustment into two opcodes. If the runtime preempts between these opcodes then the stack unwinder will read an invalid stack pointer and crash. ; epilogue for main.big_stack ADD $8, RSP, R29 ADD $(16<<12), R29, R29 ADD $16, RSP, RSP ; preemption is problematic between these opcodes ADD $(16<<12), RSP, RSP RET After running this for a few minutes the program panicked as expected! SIGSEGV: segmentation violation PC=0x60598 m=8 sigcode=1 addr=0x118 goroutine 0 gp=0x400019c540 m=8 mp=0x4000198708 [idle]: runtime.(*unwinder).next(0x400030fd10) /home/thea/sdk/go1.23.4/src/runtime/traceback.go:458 +0x188 fp=0x400030fcc0 sp=0x400030fc30 pc=0x60598 runtime.scanstack(0x40000021c0, 0x400002f750) /home/thea/sdk/go1.23.4/src/runtime/mgcmark.go:887 +0x290 [...] goroutine 1 gp=0x40000021c0 m=nil [runnable (scan)]: runtime.asyncPreempt2() /home/thea/sdk/go1.23.4/src/runtime/preempt.go:308 +0x3c fp=0x40003bfcf0 sp=0x40003bfcd0 pc=0x400cc runtime.asyncPreempt() /home/thea/sdk/go1.23.4/src/runtime/preempt_arm64.s:47 +0x9c fp=0x40003bfee0 sp=0x40003bfcf0 pc=0x75aec main.big_stack(0x40003cff38?) /home/thea/dev/stack_corruption_reproducer/main.go:29 +0x94 fp=0x40003cff00 sp=0x40003bfef0 pc=0x77c04 Segmentation fault (core dumped) real 1m29.165s user 4m4.987s sys 0m43.212s A reproducible crash with standard library only? This felt like conclusive evidence that our problem was a runtime bug. This was an extremely particular reproducer! Even now with a good understanding of the bug and its fix, some of the behavior is still puzzling. It's a one-instruction race condition, so it’s unsurprising that small changes could have large impact. For example, this reproducer was originally written and tested on Go 1.23.4, but did not crash when compiled with 1.23.9 (the version in production), even though we could objdump the binary and see the split ADD still present! We don’t have a definite explanation for this behavior – even with the bug present there remain a few unknown variables which affect the likelihood of hitting the race condition. A single-instruction race condition window arm64 is a fixed-length 4-byte instruction set architecture. This has a lot of implications on codegen but most relevant to this bug is the fact that immediate length is limited. add gets a 12-bit immediate, mov gets a 16-bit immediate, etc. How does the architecture handle this when the operands don't fit? It depends – ADD in particular reserves a bit for \"shift left by 12\" so any 24 bit addition can be decomposed into two opcodes. Other instructions are decomposed similarly, or just require loading an immediate into a register first. The very last step of the Go compiler before emitting machine code involves transforming the program into obj.Prog structs. It's a very low level intermediate representation (IR) that mostly serves to be translated into machine code. //https://github.com/golang/go/blob/fa2bb342d7b0024440d996c2d6d6778b7a5e0247/src/cmd/internal/obj/arm64/obj7.go#L856 // Pop stack frame. // ADD $framesize, RSP, RSP p = obj.Appendp(p, c.newprog) p.As = AADD p.From.Type = obj.TYPE_CONST p.From.Offset = int64(c.autosize) p.To.Type = obj.TYPE_REG p.To.Reg = REGSP p.Spadj = -c.autosize Notably, this IR is not aware of immediate length limitations. Instead, this happens in asm7.go when Go's internal intermediate representation is translated into arm64 machine code. The assembler will classify an immediate in conclass based on bit size and then use that when emitting instructions – extra if needed. The Go assembler uses a combination of ( mov, add ) opcodes for some adds that fit in 16-bit immediates, and prefers ( add, add + lsl 12 ) opcodes for 16-bit+ immediates. Compare a stack of (slightly larger than) 1<<15 : ; //go:noinline ; func big_stack() byte { ; var big_stack = make([]byte, 1<<15) ; return big_stack[0] ; } MOVD $32776, R27 ADD R27, RSP, R29 MOVD $32784, R27 ADD R27, RSP, RSP RET With a stack of 1<<16 : ; //go:noinline ; func big_stack() byte { ; var big_stack = make([]byte, 1<<16) ; return big_stack[0] ; } ADD $8, RSP, R29 ADD $(16<<12), R29, R29 ADD $16, RSP, RSP ADD $(16<<12), RSP, RSP RET In the larger stack case, there is a point between ADD x, RSP, RSP opcodes where the stack pointer is not pointing to the tip of a stack frame. We thought at first that this was a matter of memory corruption – that in handling async preemption the runtime would push a function call on the stack and corrupt the middle of the stack. However, this goroutine is already in the function epilogue – any data we corrupt is actively in the process of being thrown away. What's the issue then? The Go runtime often needs to unwind the stack, which means walking backwards through the chain of function calls. For example: garbage collection uses it to find live references on the stack, panicking relies on it to evaluate defer functions, and generating stack traces needs to print the call stack. For this to work the stack pointer must be accurate during unwinding because of how golang dereferences sp to determine the calling function. If the stack pointer is partially modified, the unwinder will look for the calling function in the middle of the stack. The underlying data is meaningless when interpreted as directions to a parent stack frame and then the runtime will likely crash. //https://github.com/golang/go/blob/66536242fce34787230c42078a7bbd373ef8dcb0/src/runtime/traceback.go#L373 if innermost && frame.sp < frame.fp || frame.lr == 0 { lrPtr = frame.sp frame.lr = *(*uintptr)(unsafe.Pointer(lrPtr)) } When async preemption happens it will push a function call onto the stack but the parent stack frame is no longer correct because sp was only partially adjusted when the preemption happened. The crash flow looks something like this: Async preemption happens between the two opcodes that add x, rsp expands to Garbage collection triggers stack unwinding (to check for heap object liveness) The unwinder starts traversing the stack of the problematic goroutine and correctly unwinds up to the problematic function The unwinder dereferences sp to determine the parent function Almost certainly the data behind sp is not a function Crash We saw earlier a faulting stack trace which ended in (*NetlinkSocket).Receive – in this case stack unwinding faulted while it was trying to determine the parent frame. goroutine 90 gp=0x40042cc000 m=nil [preempted (scan)]: runtime.asyncPreempt2() /usr/local/go/src/runtime/preempt.go:306 +0x2c fp=0x40060a25d0 sp=0x40060a25b0 pc=0x55557e299dec runtime.asyncPreempt() /usr/local/go/src/runtime/preempt_arm64.s:47 +0x9c fp=0x40060a27c0 sp=0x40060a25d0 pc=0x55557e2dc94c github.com/vishvananda/netlink/nl.(*NetlinkSocket).Receive(0xff48ce6e060b2848?) /vendor/github.com/vishvananda/netlink/nl/nl_linux.go:779 +0x130 fp=0x40060b2820 sp=0x40060a27d0 pc=0x55557e9d2880 Once we discovered the root cause we reported it with a reproducer and the bug was quickly fixed. This bug is fixed in go1.23.12 , go1.24.6 , and go1.25.0 . Previously, the go compiler emitted a single add x, rsp instruction and relied on the assembler to split immediates into multiple opcodes as necessary. After this change, stacks larger than 1<<12 will build the offset in a temporary register and then add that to rsp in a single, indivisible opcode. A goroutine can be preempted before or after the stack pointer modification, but never during. This means that the stack pointer is always valid and there is no race condition. LDP -8(RSP), (R29, R30) MOVD $32, R27 MOVK $(1<<16), R27 ADD R27, RSP, RSP RET This was a very fun problem to debug. We don’t often see bugs where you can accurately blame the compiler. Debugging it took weeks and we had to learn about areas of the Go runtime that people don’t usually need to think about. It’s a nice example of a rare race condition, the sort of bug that can only really be quantified at a large scale. We’re always looking for people who enjoy this kind of detective work. Our engineering teams are hiring . Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . Deep Dive Go Programming",
-    "quality_score": 9,
-    "modules": [
-      "go_patterns",

--- seed-extraction-failures.json
diff --git a/seed-extraction-failures.json b/seed-extraction-failures.json
index 7739335..65c862c 100644
--- a/seed-extraction-failures.json
+++ b/seed-extraction-failures.json
@@ -1,14 +1,4 @@
 [
-  {
-    "id": "11",
-    "url": "https://www.linkedin.com/blog/engineering/generative-ai/behind-the-platform-the-journey-to-create-the-linkedin-genai-application-tech-stack",
-    "reason": "extractor_returned_null"
-  },
-  {
-    "id": "12",
-    "url": "https://www.uber.com/blog/from-static-rate-limiting-to-intelligent-load-management/",
-    "reason": "extractor_returned_null"
-  },
   {
     "id": "13",
     "url": "https://www.uber.com/blog/how-uber-serves-over-150-million-reads/",
@@ -18,20 +8,5 @@
     "id": "14",
     "url": "https://www.uber.com/blog/ureview/",
     "reason": "extractor_returned_null"
-  },
-  {
-    "id": "15",
-    "url": "https://www.uber.com/blog/perfinsights/",
-    "reason": "extractor_returned_null"
-  },
-  {
-    "id": "26",
-    "url": "https://www.linkedin.com/blog/engineering/infrastructure/journey-of-next-generation-control-plane-for-data-systems",
-    "reason": "extractor_returned_null"
-  },
-  {
-    "id": "39",
-    "url": "https://www.uber.com/blog/automating-efficiency-of-go-programs-with-pgo/",
-    "reason": "extractor_returned_null"
   }
 ]


--- src/content/classifier.ts
diff --git a/src/content/classifier.ts b/src/content/classifier.ts
index 3fa2ed9..9ee9daf 100644
--- a/src/content/classifier.ts
+++ b/src/content/classifier.ts
@@ -5,6 +5,8 @@ import type { ClassifierResult } from './types.js';
 const QUALITY_GATE = 6;
 const BATCH_POLL_INTERVAL_MS = 30_000;   // 30s between polls
 const BATCH_TIMEOUT_MS = 2 * 60 * 60 * 1000;  // 2 hours max wait
+const CLASSIFIER_MAX_TOKENS = 768;
+const CLASSIFIER_TEMPERATURE = 0;
 
 export const CONTENT_CLASSIFIER_SYSTEM_PROMPT = `You are evaluating a technical article for depth and originality.
 
@@ -55,7 +57,8 @@ export async function classifyArticlesBatch(
   // Submit batch
   const requests: Anthropic.MessageCreateParamsNonStreaming[] = articles.map((article) => ({
     model,
-    max_tokens: 512,
+    max_tokens: CLASSIFIER_MAX_TOKENS,
+    temperature: CLASSIFIER_TEMPERATURE,
     system: CONTENT_CLASSIFIER_SYSTEM_PROMPT,
     messages: [{ role: 'user', content: buildClassifierUserPrompt(article) }],
   }));
@@ -134,12 +137,17 @@ export async function classifyArticleRealtimeWithClient(
   client: Anthropic,
   model: string,
 ): Promise<ClassifierResult> {
-  const userPrompt = buildClassifierUserPrompt(article);
+  const baseUserPrompt = buildClassifierUserPrompt(article);
 
   for (let attempt = 0; attempt < 2; attempt++) {
+    const userPrompt = attempt === 0
+      ? baseUserPrompt
+      : `${baseUserPrompt}\n\nReturn ONLY valid JSON. Do not wrap it in markdown fences. Do not add commentary before or after the JSON object.`;
+
     const response = await client.messages.create({
       model,
-      max_tokens: 512,
+      max_tokens: CLASSIFIER_MAX_TOKENS,
+      temperature: CLASSIFIER_TEMPERATURE,
       system: CONTENT_CLASSIFIER_SYSTEM_PROMPT,
       messages: [{ role: 'user', content: userPrompt }],
     });
@@ -153,29 +161,39 @@ export async function classifyArticleRealtimeWithClient(
     if (parsed) {
       return parsed;
     }
+
+    logger.warn('content.classify.realtime_json_error', {
+      id: article.id,
+      attempt: attempt + 1,
+      preview: block.text.slice(0, 200),
+    });
   }
 
   throw new Error(`Classifier returned invalid JSON for article ${article.id}`);
 }
 
 export function parseClassifierResponse(raw: string): ClassifierResult | null {
-  // Strip markdown code fences if present
-  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
-  try {
-    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
-    const score = Number(parsed['quality_score']);
-    if (isNaN(score)) return null;
-
-    return {
-      quality_score: score,
-      summary: String(parsed['summary'] ?? ''),
-      main_thesis: String(parsed['main_thesis'] ?? ''),
-      key_insights: toStringArray(parsed['key_insights']),
-      tech_concepts: toStringArray(parsed['tech_concepts']),
-    };
-  } catch {
-    return null;
+  const candidates = buildJsonCandidates(raw);
+
+  for (const candidate of candidates) {
+    try {
+      const parsed = JSON.parse(candidate) as Record<string, unknown>;
+      const score = Number(parsed['quality_score']);
+      if (Number.isNaN(score)) continue;
+
+      return {
+        quality_score: score,
+        summary: String(parsed['summary'] ?? ''),
+        main_thesis: String(parsed['main_thesis'] ?? ''),
+        key_insights: toStringArray(parsed['key_insights']),
+        tech_concepts: toStringArray(parsed['tech_concepts']),
+      };
+    } catch {
+      continue;
+    }
   }
+
+  return null;
 }
 
 function toStringArray(val: unknown): string[] {
@@ -187,6 +205,50 @@ function buildClassifierUserPrompt(article: ArticleToClassify): string {
   return `Title: ${article.title}\n\n${article.text}`;
 }
 
+function buildJsonCandidates(raw: string): string[] {
+  const cleaned = stripMarkdownFences(raw);
+  const candidates = new Set<string>();
+
+  pushCandidate(candidates, cleaned);
+  pushCandidate(candidates, cleanupJsonLikeText(cleaned));
+
+  const extractedObject = extractJSONObject(cleaned);
+  if (extractedObject) {
+    pushCandidate(candidates, extractedObject);
+    pushCandidate(candidates, cleanupJsonLikeText(extractedObject));
+  }
+
+  return [...candidates];
+}
+
+function stripMarkdownFences(raw: string): string {
+  return raw
+    .replace(/^```(?:json)?\s*/i, '')
+    .replace(/\s*```$/i, '')
+    .trim();
+}
+
+function cleanupJsonLikeText(value: string): string {
+  return value
+    .replace(/,\s*([}\]])/g, '$1')
+    .replace(/[\u201C\u201D]/g, '"')
+    .replace(/[\u2018\u2019]/g, "'");
+}
+
+function extractJSONObject(value: string): string | null {
+  const start = value.indexOf('{');
+  const end = value.lastIndexOf('}');
+  if (start === -1 || end === -1 || end <= start) return null;
+  return value.slice(start, end + 1).trim();
+}
+
+function pushCandidate(target: Set<string>, candidate: string | null): void {
+  if (!candidate) return;
+  const trimmed = candidate.trim();
+  if (!trimmed) return;
+  target.add(trimmed);
+}
+
 function sleep(ms: number): Promise<void> {
   return new Promise((resolve) => setTimeout(resolve, ms));
 }
```

### Commit 4: afa2650
**Message:** feat: implement phase 3 progressive voice system

**Diff:**
```diff
--- .github/workflows/bootstrap-voice.yml
diff --git a/.github/workflows/bootstrap-voice.yml b/.github/workflows/bootstrap-voice.yml
index 01de730..554692b 100644
--- a/.github/workflows/bootstrap-voice.yml
+++ b/.github/workflows/bootstrap-voice.yml
@@ -19,13 +19,9 @@ jobs:
       - name: Install dependencies
         run: npm ci
 
-      - name: Write config
-        run: echo "$CONFIG_YAML" > config.yaml
-        env:
-          CONFIG_YAML: ${{ secrets.CONFIG_YAML }}
-
-      - name: Seed voice history from voice-bootstrap.md
+      - name: Store bootstrap exposure from voice-bootstrap.md
         env:
           SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
           SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
+          TENANT_ID: ${{ secrets.TENANT_ID }}
         run: npx tsx scripts/bootstrap-voice.ts


--- .github/workflows/deploy.yml
diff --git a/.github/workflows/deploy.yml b/.github/workflows/deploy.yml
index cbca72e..9bff63f 100644
--- a/.github/workflows/deploy.yml
+++ b/.github/workflows/deploy.yml
@@ -34,6 +34,9 @@ jobs:
       - name: Typecheck
         run: npm run typecheck
 
+      - name: Test
+        run: npm test
+
       - id: auth
         name: Authenticate to GCP
         uses: google-github-actions/auth@v2


--- .github/workflows/scan-sent-posts.yml
diff --git a/.github/workflows/scan-sent-posts.yml b/.github/workflows/scan-sent-posts.yml
index 9cda5d0..eb5ebbc 100644
--- a/.github/workflows/scan-sent-posts.yml
+++ b/.github/workflows/scan-sent-posts.yml
@@ -31,7 +31,7 @@ jobs:
 
       - name: Scan sent posts and update voice history
         env:
-          BUFFER_ACCESS_TOKEN: ${{ secrets.BUFFER_ACCESS_TOKEN }}
           SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
           SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
-        run: npx tsx src/main-scan.ts
+          GCP_KMS_KEY_NAME: ${{ secrets.GCP_KMS_KEY_NAME }}
+        run: npx tsx src/worker/main-scan-tenants.ts


--- README.md
diff --git a/README.md b/README.md
index a30d712..bea4de3 100644
--- a/README.md
+++ b/README.md
@@ -1,431 +1,164 @@
 # devcast
 
-> Turn every GitHub commit into a social media post — automatically, in your voice.
+> Turn GitHub commits into publishable LinkedIn and Buffer drafts, in the author's own voice.
 
-devcast monitors every commit you push across **all your GitHub repositories** and uses Claude AI
-to generate platform-native social media posts. You review drafts, edit them, and approve with
-a single comment. The system publishes to your Buffer queue — scheduled within your posting
-window — and stores your published text as training data for the next round of generation.
+`devcast` is a multi-tenant GitHub App. Each installation becomes a tenant. Pushes enqueue jobs, the worker analyzes commits with the 24-module pipeline, generates one post per interesting commit, and publishes either directly to LinkedIn or into Buffer Ideas. A scanner loop closes the feedback loop from published posts back into the voice system.
 
-**The AI gets better at sounding like you with every post you publish.**
-
-Built during a developer job search. The code is the portfolio.
-
----
-
-## How It Works
-
-```
-Your commits across all repos
-        ↓  (polls every 4h via GitHub Events API — account-level, no per-repo setup)
-Commit enrichment
-(diff analysis, file type detection, change classification)
-        ↓
-Trivial commits → weekly batch
-Interesting commits → Claude API
-        ↓
-Voice history retrieval
-(your 5 most recently published posts, weighted by how little you edited them)
-        ↓
-claude-sonnet-4-6 generates 3 platform-native drafts
-        ↓
-GitHub Issue opens for review
-(edit the issue body if needed, then comment /approve)
-        ↓
-Buffer schedules within 8am–7pm local window
-        ↓
-Published text stored in voice history
-(closes the self-training loop)
-```
-
----
-
-## Features
-
-| Feature | Details |
-|---|---|
-| **Install once** | GitHub Events API polling covers your entire account. New repos appear automatically. |
-| **Self-training voice** | AI improves with every post you publish — learns from your edits, not its own drafts |
-| **Human review required** | GitHub Issues inbox — no auto-publish path exists by design |
-| **Timezone-aware scheduling** | Posts only within 8am–7pm local time. Architecturally enforced. |
-| **Cost-minimal AI** | Batches trivial commits, caches all drafts, uses `claude-sonnet-4-6` |
-| **Buffer queue management** | Respects 10-post free tier limit, holds posts when full and retries |
-| **Free infrastructure** | GitHub Actions (public repo = unlimited minutes) + Supabase free tier |
-| **Forkable** | 8-step setup, documented credential flow, config template included |
-
----
-
-## Prerequisites
-
-- GitHub account with repos you want to monitor
-- [Buffer account](https://buffer.com) with LinkedIn/Twitter/Instagram channels connected
-- [Anthropic API key](https://console.anthropic.com) (only paid component — ~$0.006/post)
-- [Supabase account](https://supabase.com) (free tier, for voice history storage)
-
----
-
-## Setup — 8 Steps
+## Architecture
 
-### Step 1 — Fork and enable Actions
+Three Cloud Run runtimes share the same Docker image:
 
-Fork this repo to your GitHub account.
-Settings → Actions → "Allow all actions and reusable workflows"
+- `getdevcast-webhook`
+  Receives GitHub webhooks, serves onboarding at `/onboard`, and handles GitHub + LinkedIn OAuth callbacks.
+- `devcast-worker`
+  Claims jobs from `job_queue`, analyzes commits, matches content intelligence context, generates drafts, and publishes.
+- `devcast-scanner`
+  Scans Buffer sent posts, computes edit feedback, refreshes content preferences, and recalculates progressive voice state.
 
-### Step 2 — Create the database
+The canonical deploy path is:
 
-1. [supabase.com](https://supabase.com) → New project (free tier, pick any region)
-2. SQL Editor → paste contents of [`database/schema.sql`](database/schema.sql) → Run
-3. Settings → API → copy **Project URL** and **anon public key**
+`push to trunk` -> GitHub Actions -> Docker build -> Cloud Run deploy
 
-### Step 3 — Add secrets
+## Current Voice System
 
-Settings → Secrets and variables → Actions → New repository secret:
+Phase 3 uses the progressive voice subsystem from [`docs/voice-system-spec.md`](docs/voice-system-spec.md):
 
-| Secret | How to obtain |
-|---|---|
-| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys → Create key |
-| `BUFFER_ACCESS_TOKEN` | buffer.com → Settings → Apps → create app → complete OAuth → copy access token |
-| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
-| `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key |
+- `cold`
+  baseline voice only
+- `bootstrap`
+  bootstrap posts are used as exposure examples
+- `warming`
+  published examples plus soft voice signals
+- `established`
+  full exposure + voice dice + opening variety guard
 
-**Getting a Buffer access token (detailed):**
-1. [buffer.com/developers/apps](https://buffer.com/developers/apps) → Create a new app
-2. App name: anything (e.g., "devcast"). Callback URL: `http://localhost`
-3. Note your Client ID and Client Secret
-4. Complete the OAuth authorization flow once to exchange for an access token
-5. Copy the token — it is long-lived (months before expiry)
+Bootstrap posts live in `voice_profiles.voice.bootstrap_posts`. Published posts feed `voice_examples_pool`, `voice_moves`, `recent_opening_sequence`, and `voice_summary`.
 
-### Step 4 — Configure
+## Local Commands
 
 ```bash
 npm install
-cp config.example.yaml config.yaml
-```
-
-Edit `config.yaml`:
-
-```yaml
-author:
-  github_username: "your-github-username"  # required
-  name: "Your Name"
-  website: "https://yoursite.com"          # appears in LinkedIn CTAs
-```
-
-### Step 5 — Link Buffer channels
-
-```bash
-npm run setup-buffer
-```
-
-Prints your connected Buffer channels with IDs. Paste into `config.yaml`:
-

--- database/migrations/2026-04-10-phase3-progressive-voice-verify.sql
diff --git a/database/migrations/2026-04-10-phase3-progressive-voice-verify.sql b/database/migrations/2026-04-10-phase3-progressive-voice-verify.sql
new file mode 100644
index 0000000..493b103
--- /dev/null
+++ b/database/migrations/2026-04-10-phase3-progressive-voice-verify.sql
@@ -0,0 +1,58 @@
+-- Verification for 2026-04-10 Phase 3 + progressive voice migration
+
+SELECT table_name
+FROM information_schema.tables
+WHERE table_schema = 'public'
+  AND table_name IN ('voice_profiles', 'voice_posts')
+ORDER BY table_name;
+
+SELECT column_name
+FROM information_schema.columns
+WHERE table_schema = 'public'
+  AND table_name = 'voice_posts'
+  AND column_name IN (
+    'tenant_id',
+    'top_module_id',
+    'author_login',
+    'edit_analysis',
+    'context_status',
+    'has_industry_context',
+    'matched_article_id',
+    'matched_source_id',
+    'match_strength',
+    'match_connection',
+    'linkedin_urn',
+    'reactions_count',
+    'engagement_score',
+    'last_reactions_fetch_at',
+    'publish_source',
+    'generation_system',
+    'opening_move'
+  )
+ORDER BY column_name;
+
+SELECT column_name
+FROM information_schema.columns
+WHERE table_schema = 'public'
+  AND table_name = 'voice_profiles'
+  AND column_name IN (
+    'tenant_id',
+    'github_author_login',
+    'voice',
+    'version',
+    'created_at',
+    'updated_at'
+  )
+ORDER BY column_name;
+
+SELECT indexname
+FROM pg_indexes
+WHERE schemaname = 'public'
+  AND indexname IN (
+    'idx_voice_profiles_tenant_default',
+    'idx_voice_profiles_tenant_author',
+    'idx_voice_profiles_tenant',
+    'idx_voice_posts_tenant',
+    'idx_voice_retrieval'
+  )
+ORDER BY indexname;


--- database/migrations/2026-04-10-phase3-progressive-voice.sql
diff --git a/database/migrations/2026-04-10-phase3-progressive-voice.sql b/database/migrations/2026-04-10-phase3-progressive-voice.sql
new file mode 100644
index 0000000..31eb107
--- /dev/null
+++ b/database/migrations/2026-04-10-phase3-progressive-voice.sql
@@ -0,0 +1,50 @@
+-- Phase 3 + progressive voice subsystem readiness
+-- Safe to run manually in Supabase SQL Editor.
+-- Idempotent: uses IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
+
+CREATE TABLE IF NOT EXISTS voice_profiles (
+  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  tenant_id            UUID NOT NULL REFERENCES tenants(id),
+  github_author_login  TEXT,
+  voice                JSONB NOT NULL DEFAULT '{}',
+  version              INTEGER NOT NULL DEFAULT 1,
+  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
+);
+
+CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_default
+  ON voice_profiles(tenant_id)
+  WHERE github_author_login IS NULL;
+
+CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_author
+  ON voice_profiles(tenant_id, github_author_login)
+  WHERE github_author_login IS NOT NULL;
+
+CREATE INDEX IF NOT EXISTS idx_voice_profiles_tenant
+  ON voice_profiles(tenant_id);
+
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS tenant_id                 UUID REFERENCES tenants(id);
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS top_module_id             TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS author_login              TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS edit_analysis             JSONB;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS context_status            TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS has_industry_context      BOOLEAN NOT NULL DEFAULT FALSE;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_article_id        UUID REFERENCES content_items(id);
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_source_id         UUID REFERENCES content_sources(id);
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_strength            REAL;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection          TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS linkedin_urn              TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS reactions_count           INTEGER NOT NULL DEFAULT 0;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS engagement_score          REAL;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at   TIMESTAMPTZ;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source            TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS generation_system         TEXT DEFAULT 'v1';
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS opening_move              TEXT DEFAULT NULL;
+
+CREATE INDEX IF NOT EXISTS idx_voice_posts_tenant
+  ON voice_posts(tenant_id);
+
+DROP INDEX IF EXISTS idx_voice_retrieval;
+CREATE INDEX IF NOT EXISTS idx_voice_retrieval
+  ON voice_posts(platform, engagement_score DESC NULLS LAST, edit_ratio DESC NULLS LAST)
+  WHERE status = 'published';


--- database/schema.sql
diff --git a/database/schema.sql b/database/schema.sql
index ca27011..46451ae 100644
--- a/database/schema.sql
+++ b/database/schema.sql
@@ -14,15 +14,35 @@ CREATE TABLE IF NOT EXISTS voice_posts (
   published_at    TIMESTAMPTZ,
   buffer_post_id  TEXT,
   scheduled_at    TIMESTAMPTZ,             -- UTC time Buffer will publish
-  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'scheduled'|'published'|'queued'
+  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'scheduled'|'published'|'queued'|'expired'|'failed'
   top_finding     TEXT,                    -- headline of the top module finding
   findings_count  INTEGER NOT NULL DEFAULT 0,
   linkedin_urn    TEXT,                    -- urn:li:share:... captured from Buffer externalLink
   reactions_count INTEGER NOT NULL DEFAULT 0, -- LinkedIn reactions fetched from socialActions API
   engagement_score REAL,                  -- composite: edit_ratio*0.6 + normalized_reactions*0.4
+  generation_system TEXT,                 -- 'v1' | 'v2_progressive'
   tenant_id       UUID REFERENCES tenants(id) -- multi-tenant: scopes voice data per user
 );
 
+-- Per-tenant voice contract. One optional default row plus explicit author overrides.
+CREATE TABLE IF NOT EXISTS voice_profiles (
+  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  tenant_id            UUID NOT NULL REFERENCES tenants(id),
+  github_author_login  TEXT,                         -- NULL = tenant default
+  voice                JSONB NOT NULL DEFAULT '{}',
+  version              INTEGER NOT NULL DEFAULT 1,
+  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
+);
+
+CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_default
+  ON voice_profiles(tenant_id)
+  WHERE github_author_login IS NULL;
+
+CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_author
+  ON voice_profiles(tenant_id, github_author_login)
+  WHERE github_author_login IS NOT NULL;
+
 -- Uninteresting commits saved for optional weekly roundup
 CREATE TABLE IF NOT EXISTS pending_batch (
   id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
@@ -199,6 +219,8 @@ ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_strength           REAL;
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection         TEXT;
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at  TIMESTAMPTZ;
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source           TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS generation_system        TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS opening_move             TEXT;
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS author_login             TEXT;
 
 ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS leased_until               TIMESTAMPTZ;
@@ -282,6 +304,7 @@ $$;
 -- The anon key is only safe for local dev with SQLite (see .env.example).
 
 ALTER TABLE voice_posts              ENABLE ROW LEVEL SECURITY;
+ALTER TABLE voice_profiles           ENABLE ROW LEVEL SECURITY;
 ALTER TABLE pending_batch            ENABLE ROW LEVEL SECURITY;
 ALTER TABLE events_state             ENABLE ROW LEVEL SECURITY;
 ALTER TABLE scheduled_slots          ENABLE ROW LEVEL SECURITY;
@@ -299,6 +322,8 @@ ALTER TABLE content_pipeline_runs    ENABLE ROW LEVEL SECURITY;
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS linkedin_urn     TEXT;
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS reactions_count  INTEGER NOT NULL DEFAULT 0;
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS engagement_score REAL;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS generation_system TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS opening_move TEXT;
 
 ALTER TABLE tenants ADD COLUMN IF NOT EXISTS linkedin_access_token     TEXT;
 ALTER TABLE tenants ADD COLUMN IF NOT EXISTS linkedin_member_id        TEXT;
@@ -306,6 +331,7 @@ ALTER TABLE tenants ADD COLUMN IF NOT EXISTS linkedin_token_expires_at TIMESTAMP
 
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
 CREATE INDEX IF NOT EXISTS idx_voice_posts_tenant ON voice_posts(tenant_id);
+CREATE INDEX IF NOT EXISTS idx_voice_profiles_tenant ON voice_profiles(tenant_id);
 
 DROP INDEX IF EXISTS idx_voice_retrieval;
 CREATE INDEX IF NOT EXISTS idx_voice_retrieval


--- docs/devcast-spec.md
diff --git a/docs/devcast-spec.md b/docs/devcast-spec.md
index c227b89..38c042b 100644
--- a/docs/devcast-spec.md
+++ b/docs/devcast-spec.md
@@ -2296,6 +2296,9 @@ Audience is always manually selected by the user. The extractor may describe ton
 
 ## Runtime `voice_history` Selection
 
+> **Replaced by voice-system-spec.md** — §Voice Exposure (pool management, example selection, deduplication).
+> The `edit_ratio >= 0.70` gate and top-5 recency selection below are superseded by the progressive exposure pool when `voice.voice_moves` is present. Keep reading for legacy behavior (authors without `voice_moves`) and for the Loop 2/3/4 definitions that remain unchanged.
+
 `voice_history` remains the primary per-post quality driver, but it is now fully specified.
 
 **Phase 3 prerequisite:** this query is only valid once `voice_posts.author_login` is persisted for every generated draft. Without that column, org installs would mix multiple developers' voices in the same example pool. `top_module_id` must also be persisted before module diversification can work.
@@ -2350,6 +2353,9 @@ If no qualifying examples exist, omit the block entirely and rely on Tier 1 or T
 
 ## 3-Tier Voice System
 
+> **Replaced by voice-system-spec.md** — §Progressive Voice System (Stages 0–3), §Prompt builder integration.
+> The 3-tier fallback below (Tier 1 `style_patterns` → Tier 2 `TONE_INSTRUCTIONS` → Tier 3 baseline) is the legacy path used when `voice.voice_moves` is absent. When `voice.voice_moves` is present, `buildProgressiveVoiceBlocks()` takes over entirely. At Stage 3, `TONE_INSTRUCTIONS`, `RHYTHM_INSTRUCTIONS`, and `STRUCTURE_MAP` are all dropped — voice exposure examples and dice rolls encode the actual voice.
+
 **`buildSystemPrompt()` in this section [REPLACES CURRENT].**
 The prompt-builder behavior described in Implementation Status ("voice TOP + commit + findings + task BOTTOM") is the pre-Phase-3 state and must be fully replaced, not merged with this new contract.
 
@@ -2555,6 +2561,9 @@ TEACHING:
 
 ## Voice Extractor (`src/ai/voice-extractor.ts`)
 
+> **Replaced by voice-system-spec.md** — §Voice Moves Registry, §`voice-moves-calculator.ts`.
+> The Haiku extraction call below is superseded by statistical move measurement (zero AI calls) when `voice.voice_moves` is present. `voice-extractor.ts` continues to exist for the legacy path. New authors use the progressive system from day one.
+
 Haiku call. Two triggers:
 1. Bootstrap changed
 2. Scanner sees 5+ new published posts since `extracted_at`
@@ -2675,6 +2684,9 @@ The old loop only learned "how much was edited." Phase 3 uses four loops.
 
 ### Loop 1 — Style refresh (every 5 published posts)
 
+> **Replaced by voice-system-spec.md** — §Feedback Loops — Loop 1 (statistical move recalculation, zero AI calls).
+> The Haiku extractor input/output below is the legacy path. When `voice.voice_moves` is present, Loop 1 runs `refreshVoiceMoves()` instead: measures move frequencies against MOVES_REGISTRY, updates `voice.voice_moves` probabilities, refreshes the exposure pool, and computes `voice_summary` from move descriptions. Uses `edit_ratio >= 0.30` for pool eligibility (not 0.70 — see override table in voice-system-spec.md §What this spec replaces).
+
 Input:
 - up to 15 recent high-signal published posts (`edit_ratio >= 0.70`, `edit_type != 'rewrite'`, ordered by `published_at DESC`)
 - structured with signal quality, recency, and module metadata
@@ -2866,6 +2878,9 @@ Interpretation:
 
 ## Integration In `process-job.ts`
 
+> **Extended by voice-system-spec.md** — §Integration in `process-job.ts`.
+> The pseudocode below is the Phase 3 baseline. The voice spec adds: stage computation, `draftIndexToday` counter, exposure pool fetch, voice block assembly via `buildProgressiveVoiceBlocks()`, Opening Type Memory (variety constraint), Chapter Context System (skip-vs-chapter decision), and `generation_system = 'v2_progressive'` + `opening_move` persistence at draft-save time. The overall structure (fetch voice profile → filter findings → match articles → generate → publish) is unchanged.
+
 ```typescript
 const storedVoice = await storage.getVoiceProfile(tenant.id, commit.authorLogin);
 const voiceProfile = storedVoice?.voice ?? DEFAULT_VOICE_PROFILE;


--- docs/voice-system-spec.md
diff --git a/docs/voice-system-spec.md b/docs/voice-system-spec.md
new file mode 100644
index 0000000..5e73740
--- /dev/null
+++ b/docs/voice-system-spec.md
@@ -0,0 +1,2878 @@
+# devcast — Voice System Spec
+
+| Field | Value |
+|-------|-------|
+| Version | 1.14.3 |
+| Status | Design — replaces Phase 3 voice extraction subsystem and `anti-parrot-spec.md` |
+| Last updated | 2026-04-10 |
+| Owner | Liliana Castellanos / Vialabs Spa |
+| Parent spec | `devcast-spec.md` v1.5.17 — Phase 3 (Voice Profile + Content Strategy) |
+| Replaces | `anti-parrot-spec.md` v1.0.0 (entirely) |
+| Phase | Phase 3.5 — modifies Phase 3 voice subsystem, does not touch Phase 1 or Phase 2 |
+
+---
+
+## Changelog
+
+| Version | Date | Changes |
+|---------|------|---------|
+| 1.14.3 | 2026-04-10 | **All hard line-number references to master spec replaced with section-header anchors.** 19 references like `master spec line 2082` replaced with `master spec §computeEditRatio() contract`. Section headers do not shift when lines are added above them. Affects: authoritative references table, override table, VoiceProfile interface comment, bootstrap relationship comments, hashtag priority text, IVoiceStorage extension text, process-job pseudocode comments, emoji note, voice_summary section. No logic changes. |
+| 1.14.2 | 2026-04-10 | **`IVoiceStorage` exposure/moves contract resynchronized.** The `getPublishedForExposure()` signature had already been updated to include `platform`, but the surrounding storage section still implied both storage methods shared the same query shape. Fixed: (1) `getPublishedForExposure()` comment now clearly documents the per-platform filter as part of the method contract; (2) `getPublishedForMoves()` comment now explicitly documents the cross-platform query used by `refreshVoiceMoves()` — no `platform` parameter, no `platform` filter, `LIMIT 30`; (3) the “thin wrappers around those queries” note in Files affected is now unambiguous: exposure wraps the per-platform query, moves wraps the cross-platform query. This now matches both the Voice Exposure section and the Loop 1 algorithm. |
+| 1.14.1 | 2026-04-10 | **Exposure Pool docs aligned with platform-keyed storage.** The Voice Exposure chapter still described `voice.voice_examples_pool` as a flat `string[]` even though v1.14.0 had already changed the type and `process-job.ts` integration to platform-keyed storage. Fixed: (1) pool description now says `voice_examples_pool` is `{ linkedin?: string[]; instagram?: string[] }`; (2) `refreshExposurePool()` is explicitly documented as returning the pool for ONE platform, with `refreshVoiceMoves()` responsible for calling it per platform and storing the merged keyed object; (3) this now matches the master-spec requirement that runtime example selection preserves `platform` boundaries. |
+| 1.14.0 | 2026-04-10 | **Platform propagation — v1.9.0 fix completed.** v1.9.0 added `platform` param to `refreshExposurePool` signature but left 4 call sites desynchronized. Fixed: (1) `refreshVoiceMoves` now calls `refreshExposurePool` twice (linkedin + instagram) and merges into `pool = { linkedin, instagram }`; (2) `voice_examples_pool` type in VoiceProfile interface changed from `string[]` to `{ linkedin?: string[]; instagram?: string[] }` — per-platform keyed object; (3) `getPublishedForExposure` in IVoiceStorage extended with `platform: string` parameter; (4) `process-job.ts` integration reads `voice.voice_examples_pool?.[platform]` instead of the flat array. All three paths in `refreshVoiceMoves` (Path 1/2/3) now store the keyed structure. |
+| 1.13.0 | 2026-04-10 | **Path 2 comment fixed — same spread behavior as Path 1.** Path 2 (`warming`) had the same misleading `// voice_moves deliberately NOT set` comment as Path 1 before v1.10.0. Replaced with accurate documentation: spread preserves existing `voice_moves` by design (same rationale as Path 1 — calibrated dice survive a transient regression). Key addition: documents that preserved `voice_moves` are **inert during Stage 2** — `buildProgressiveVoiceBlocks` only injects `<voice_moves>` at `stage === 'established'`. Stale dice sit in JSONB but produce no prompt output until Stage 3 is re-reached and Path 3 recalibrates them. Not a memory leak — bounded and self-healing. |
+| 1.12.0 | 2026-04-10 | **Contradictory edit_ratio text fixed.** Stage 2 section said "`edit_ratio` is NOT used as a filter" immediately before "posts with ratio < 0.30 are excluded" — which is a filter. Rewritten to accurately describe the system: a weight with a minimum floor (0.30 hard exclusion for total rewrites, graded weights above that). Added explicit contrast with the master spec's 0.70 hard gate and the rationale for why exposure needs different logic than extraction. |
+| 1.11.0 | 2026-04-10 | **Runtime bug fix in `buildVoiceBlocks` decision guard.** Changed `||` to `&&` in the progressive path condition. With `||`, a Stage 3 author who purges their published history would throw at runtime: `countUniquePublished` drops to 0 → stage becomes `'cold'` → Path 1 preserves `voice_moves` (intentional) → `voice_moves` truthy + `||` routes to `buildProgressiveVoiceBlocks` → function throws on `stage='cold'`. With `&&`, stage `'cold'` always routes to legacy path regardless of `voice_moves` state. Preserved stale dice wait for data recovery; Path 3 overwrites when posts accumulate again. |
+| 1.10.0 | 2026-04-10 | **Path 1 regression behavior declared.** Replaced misleading `// voice_moves deliberately NOT set` comment with explicit documentation: the spread preserves existing `voice_moves` intentionally when an author falls back to Path 1 (e.g., deleted posts, scanner gap). An author who previously reached Stage 3 keeps their calibrated dice during the transient minimum. Path 3 overwrites when data recovers. Stale calibrated voice > no voice for a transient minimum. |
+| 1.9.0 | 2026-04-10 | **Platform architecture decision.** Eliminated `social_platforms: string[]` from `MoveDefinition` interface and all 44 registry entries — field was declared but never consumed anywhere in the spec. Replaced by an explicit architectural rule: exposure pool (`refreshExposurePool`) is per-platform (added `platform` parameter and `.eq('platform', platform)` filter); move measurement (`refreshVoiceMoves`) and stage computation are cross-platform (added explicit no-filter comment explaining why). Override table row added documenting the split decision and the removal of `MoveDefinition.social_platforms`. |
+| 1.8.0 | 2026-04-10 | **Cross-spec consistency pass.** Override table extended with 7 new rows: (1) Loop 1 `edit_ratio` threshold rationale (0.30 for exposure/moves, 0.70 remains for Loop 4 — different purposes, not a conflict); (2) Stage 3 drops `TONE_INSTRUCTIONS` + `RHYTHM_INSTRUCTIONS` + `STRUCTURE_MAP` explicitly (not just `style_patterns`/`voice_devices`); (3) Chapter Context System skip logic added as override (master has no commit skip based on module saturation); (4) Opening Type Memory (`opening_move` column, `recent_opening_sequence`, `<variety_constraint>` block) documented as pure addition; (5) Chapter Context System (`getRecentTopFindings`, `buildChapterContext`, `<chapter_context>` block) documented as pure addition; (6) `generation_system` column documented as pure addition. `getRecentTopFindings()` added to `IVoiceStorage` extension block. Master spec (`devcast-spec.md`) updated with `> Replaced by voice-system-spec.md` notices at §Runtime voice_history Selection, §3-Tier Voice System, §Voice Extractor, §Loop 1, §Integration In process-job.ts. |
+| 1.7.0 | 2026-04-09 | **Scanner corruption guard.** `refreshExposurePool` deduplication comment expanded with full root-cause explanation: the sent-scanner can assign the same Buffer published post to multiple `voice_posts` rows (different `commit_sha`, identical `published` text) when two drafts are similar. The application-level dedup by `LEFT(published, 80)` is the last defense before examples reach Claude — documented as intentional, not incidental. Null-safety fixes: `published.data ?? []` and explicit `as string` casts. |
+| 1.6.0 | 2026-04-09 | **Chapter Context System.** Added skip-vs-chapter decision in `process-job.ts` before Claude call: if top module `fireCount >= 2` AND `draftIndexToday > 0` → skip commit (log `module_saturation`); otherwise → chapter mode. Added `getRecentTopFindings(authorLogin, moduleId, limit)` to `IVoiceStorage` and `SupabaseStorage`. Added `buildChapterContext()` in `src/ai/prompt-builder.ts` — injects `<chapter_context>` into the USER prompt (after `<findings>`, before `<task>`) when the module has prior published history. Chapter number = `fireCount + 1`. Replaces the vague `<module_variety_hint>` framing when chapter context is available — both can coexist. No new DB columns needed. |
+| 1.5.0 | 2026-04-09 | **Opening Type Memory.** Added `voice_posts.opening_move` column (detected at draft-save time). Added `voice.recent_opening_sequence` (last 5 published opening types, computed in Loop 1). Added `detectOpeningMove()` helper in `src/voice/exposure.ts`. Added `buildVarietyConstraint()` in `src/ai/prompt-builder.ts`: injects `<variety_constraint>` block when same-day posts repeat an opening type or when the last 3 posts all used the same opening. Constraint active from Stage 1 onward — does not require dice or Stage 3. Updated `process-job.ts` integration: fetches today's first draft opening type when `draftIndexToday > 0`. Updated block order to place `<variety_constraint>` between `<preferences>` and `<voice_signals>`. Updated "What this spec does not do" to clarify anti-repetition at phrase level vs structural level. |
+| 1.4.0 | 2026-04-09 | `refreshVoiceMoves` restructured into 3 explicit paths: (Path 1) insufficient data — persists stage + pool + proto-summary without voice_moves, (Path 2) Stage 2 warming — persists proto-summary + pool + hashtags without dice, (Path 3) Stage 3 established — full move measurement + smoothing + dice summary. `computeProtoSummary` defined: derives voice_summary from coarse signals (length, opening register, hashtags) for Stage 2 UI. Upsert of author-specific row moved before stage computation. Override table header now includes explicit acceptance declaration. |
+| 1.3.0 | 2026-04-09 | **Five consistency fixes.** (A) `StoredVoiceProfile` / `DEFAULT_VOICE_PROFILE` unwrapping made explicit in process-job: `stored = getVoiceProfile()`, `voice = stored?.voice ?? DEFAULT_VOICE_PROFILE`, `voiceVersion = stored?.version ?? 0`. No more ambiguous `?? DEFAULT` comment. (B) `refreshVoiceMoves` now checks for author-specific `voice_profiles` row and creates one (seeded from tenant default) if it doesn't exist, before persisting moves. Prevents silent no-op when author only has tenant-default fallback. (C) Emoji rule removed from `<never>` hard rules — stays in Layer 2 as master spec defines (line 2408). Added explicit note that emojis in exposure examples are correct Layer 3 behavior. (D) `voice_summary` defined: computed on-write during Loop 1 from top-3 measured move descriptions, stored in same `voice.voice_summary` field the master spec uses. No UI change needed. Added to override table. (E) `computeVoiceStage` in `refreshVoiceMoves` now uses `countUniquePublished()` (all published, no edit_ratio filter) instead of the quality-filtered `posts.length`. Smoothing loop dead code removed. |
+| 1.2.0 | 2026-04-09 | **Master spec alignment fixes (9 issues).** (1) New fields live inside `voice JSONB` as VoiceProfile interface extensions, not as top-level columns — no ALTER TABLE on voice_profiles. (2) All voice_profiles queries use `github_author_login` (matching master), voice_posts queries use `author_login`. (3) Pseudocode reads `voice.voice_moves`, `voice.bootstrap_posts` consistently from JSONB. (4) IVoiceStorage extension follows master's parameter pattern with tenant-scoping note. (5) `generation_system` marking matches activation: v2_progressive for all progressive stages (1–3), not just when voice_moves exists. (6) `draftIndexToday` uses `existingDraft.created_at` on retry in both the utility section and process-job pseudocode. (7) Override table expanded with master spec section references and conflict resolution rationale for edit_ratio 0.30 and `<never>` block changes. (8) Hashtag priority defined: `voice.hashtags` + `hashtags_mode` (user-configured) wins over `always_hashtags` (auto-detected); always_hashtags is additive only. (9) Bootstrap relationship clarified: `tenants.voice_bootstrap` stays raw input per master §voice_profiles table, `voice.bootstrap_posts` is parsed array. |
+| 1.1.0 | 2026-04-09 | Registry validation procedure (20 writers, 4 criteria, 6-step process). Utility function contracts (FNV-1a hash, Mulberry32 RNG, exponential-sort weighted shuffle). `draftIndexToday` computation and retry semantics. `analyze-voice.ts` and `validate-registry.ts` script contracts. `buildProgressiveVoiceBlocks` full implementation with per-stage assembly logic. `buildVoiceSignals` for Stage 2 proto-moves. `process-job.ts` integration pseudocode. Loop 2/3/4 interaction clarified. Helper functions (`syntheticVoicePost`, `moduleIdToLabel`, `countUniquePublished`). Prompt length budget (4000 chars). Bootstrap post deletion behavior. Reference writer list expanded from 8 to 20. Files affected updated. Weighted shuffle call signature corrected in `selectExposureExamples`. |
+| 1.0.0 | 2026-04-09 | Initial spec. Progressive Voice System with 4 stages, Voice Exposure, Voice Dice, MOVES_REGISTRY with 42 entries validated against 12 published posts and 8 reference writers. |
+
+---
+
+## Why this exists
+
+Phase 3 of the master spec captures the developer's voice by extracting `style_patterns` (400 chars) and `voice_devices` (300 chars) via a Haiku call, then injecting those compressed descriptions as instructions into the generation prompt. This produces accurate voice replication for the first 5–10 posts. After that, a self-reinforcing loop degrades quality:
+
+1. The compressed extraction destills the author's tics into rigid rules ("Frases cortas. Cierra con lección. Usa metáforas de cocina.")
+2. The model obeys those rules literally in every generation
+3. New posts trained on the same rules reinforce the same patterns
+4. The author's voice stops varying — every post opens the same way, closes the same way, uses the same rhetorical moves
+
+**Measured evidence from production data (94 voice_posts, 12 unique LinkedIn published, 39 scheduled drafts):**
+
+| Signal | Published freq | Draft freq | Ratio | Interpretation |
+|--------|---------------|------------|-------|----------------|
+| `em_dash` (—) | 8% | 82% | 10.2× | AI massively overuses |
+| `"I'm building [X]"` context | 8% | 64% | 8.0× | AI massively overuses |
+| `opens_with_number` | 17% | 54% | 3.2× | AI overuses (also violates `<never>` block) |
+| `"zero removed/deleted"` | 0% | 26% | ∞ | AI invented this — user never uses it |
+| `inline_code` in post | 0% | 18% | ∞ | AI invented this — user never uses it |
+| `"very X. very Y."` | 67% | 69% | 1.0× | Correct — matches user's real frequency |
+| `"frankly"` | 42% | 38% | 0.9× | Correct |
+| `self_deprecating` | 50% | 49% | 1.0× | Correct |
+
+The problem is not that the AI uses the author's tics — it's that it uses some tics 10× more often than the author does, invents tics the author never uses, and applies all tics to every post instead of varying them naturally.
+
+**Additional structural finding:** the author's median `edit_ratio` is 0.47. Phase 3 uses `edit_ratio >= 0.70` as the quality gate for voice training. This discards 13 of 17 published posts, leaving only 4 posts as training signal. The system is starving itself of its own best data.
+
+This spec replaces the compressed voice extraction with a **Progressive Voice System** that:
+
+1. Shows the model examples of the author's writing directly (voice exposure) instead of compressed rules
+2. Uses a measured, probabilistic catalog of the author's voice moves (voice dice) instead of prescriptive instructions
+3. Progresses through 4 stages as data accumulates, never pretending to know more than it does
+4. Eliminates the Haiku extraction call entirely — the voice is measured statistically, not extracted by AI
+
+---
+
+## What this spec replaces
+
+### In `devcast-spec.md` (Phase 3)
+
+This spec **overrides** the following sections of the master spec. The master spec remains authoritative for everything not listed here. Each override references the specific master spec location it contradicts.
+
+**All overrides in this table have been reviewed and accepted as intentional divergences from the master spec.** They are not bugs or omissions — each one has a measured rationale documented in the "Conflict resolution" column. An implementor should treat them as authoritative for the scope of this spec.
+
+| Master spec section | Line/ref | Override | Conflict resolution |
+|---|---|---|---|
+| `voice-extractor.ts` — Haiku call to extract `style_patterns` + `voice_devices` | §Voice Extractor | Replaced by `voice-moves-calculator.ts` (statistical measurement, zero AI calls) | voice-extractor.ts continues to exist for legacy path; new system bypasses it |
+| `prompt-builder.ts` — Tier 1 voice block injection (`<voice_patterns>`, `<voice_devices>`) | §3-Tier Voice System | Replaced by `<voice_exposure>` + `<voice_moves>` blocks | Legacy blocks injected when `voice.voice_moves` is absent; new blocks when present |
+| `voice_history` selection — `edit_ratio >= 0.70` exclusion gate | §Runtime voice_history Selection | For voice exposure (example selection): `edit_ratio >= 0.30` with weighting. For Loop 4 (feedback scoring): `edit_ratio >= 0.70` unchanged. | Two different uses of edit_ratio have different thresholds. The master's 0.70 was designed for extraction training data quality; exposure uses 0.30 because the published text IS the author's voice regardless of how much they edited |
+| `voice_history` selection — `platform = $3` filter | §Runtime voice_history Selection | Split by layer: **exposure pool** (`refreshExposurePool`) is per-platform — Claude sees examples in the same format it will generate. **Move measurement** (`refreshVoiceMoves`) is cross-platform — the author's stylistic moves are not platform-specific and filtering by platform would halve the signal. **Stage computation** (`computeVoiceStage`) is cross-platform — the author's total publication history determines maturity. `MoveDefinition.social_platforms` field removed entirely — the registry treats all moves as platform-universal. | Format matters for example selection (LinkedIn ≠ Instagram in length and structure). Voice patterns do not vary by platform for the same author. |
+| `voice_history` selection — deterministic top-5 by recency | §Runtime voice_history Selection | Randomized selection within quality filter, commit-seeded for reproducibility | Master's deterministic recency selection caused the same examples to appear for weeks |
+| Loop 1 — Haiku refresh every 5 publications | §Loop 1 — Style refresh | Replaced by statistical recalculation of move probabilities (zero AI calls) | Only when `voice.voice_moves` is present; authors without it still use Haiku refresh |
+| `VoiceProfile` interface — `style_patterns`, `voice_devices` fields | §VoiceProfile JSONB contract | Extended with `voice_moves`, `voice_stage`, `voice_examples_pool`, `always_hashtags`, `bootstrap_posts` inside same `voice` JSONB. Existing fields NOT removed. | Prompt-builder reads old fields when `voice_moves` absent, new fields when present |
+| `<never>` block — `"No lead with counts or quantities"` hard rule | §Rule Layers > Layer 1 | Moved to voice dice as `opens_with_number` with probability ~0.10 — no longer a hard rule | Production data shows the author uses number openings 17% of the time. A hard ban contradicts their real voice. The dice makes it rare (~10%) instead of forbidden. Platform-safety rules remain in `<never>` |
+| Onboarding bootstrap — Haiku extraction from pasted posts | §/settings/voice — Org member setup | Replaced by direct storage as `voice.bootstrap_posts` array (no extraction) | `tenants.voice_bootstrap` remains the raw textarea input per master spec §voice_profiles table. The parsed array lives in `voice_profiles.voice.bootstrap_posts` |
+| `voice_summary` — Haiku-generated UI summary | §VoiceProfile JSONB contract, §Voice Extractor | Replaced by computed summary from measured move descriptions during Loop 1 | Same field, different producer. Legacy authors keep Haiku-generated summary; progressive authors get computed summary. No UI change needed |
+| Loop 1 — `edit_ratio >= 0.70` input filter | §Loop 1 — Style refresh | Loop 1 is wholly replaced by statistical move measurement. The new Loop 1 uses `edit_ratio >= 0.30` for the exposure pool (showing examples) and no threshold filter for move frequency counting (all published posts count toward pattern frequency). The 0.70 threshold was the Haiku extractor's quality gate — it needed high-signal input to extract style rules. Statistical counting does not need that gate: a post with `edit_ratio = 0.45` still published with its moves intact. Loop 4 retains `edit_ratio >= 0.70` unchanged. | The two thresholds serve different purposes and coexist without conflict. |
+| Prompt builder — Tier 2 `TONE_INSTRUCTIONS` + `RHYTHM_INSTRUCTIONS` + `STRUCTURE_MAP` blocks | §3-Tier Voice System, §Tone And Structure | Tier 2 blocks are used only for Stages 0–1 (cold/bootstrap) via the legacy path. From Stage 2 onward, `<voice_signals>` replaces them. At Stage 3, all three are dropped entirely — voice exposure examples and voice moves already encode the author's actual tone, rhythm, and narrative shape. TONE_INSTRUCTIONS apply when the user configured a preference but has no published history yet. Once history exists, the examples are authoritative and static instructions add noise. | Already partially covered by the `<voice_patterns>/<voice_devices>` row above; this row makes the TONE/RHYTHM/STRUCTURE drop explicit. |
+| `process-job.ts` — commit pipeline has no module-saturation skip logic | §Integration In process-job.ts | Chapter Context System (§Chapter Context System) adds a skip-vs-chapter decision before the Claude call: if `top_module_id` has `fireCount >= 2` AND `draftIndexToday > 0`, skip the commit and log `module_saturation`. If `fireCount >= 1` AND `draftIndexToday = 0`, chapter mode activates instead. Master spec pipeline has no such skip. | The skip prevents variety collapse when a module fires repeatedly on the same day. It does not skip across days — only within a single generation session (same tenant, same author, same calendar day). |
+| Opening Type Memory — not in master spec | New | `voice_posts.opening_move TEXT DEFAULT NULL` column added to track the structural opening type of each generated draft. `voice.recent_opening_sequence: string[]` field added to VoiceProfile JSONB — last 5 published opening types, computed in Loop 1. `<variety_constraint>` block injected in the system prompt from Stage 1 onward when the same-day or last-3-posts opening pattern repeats. `detectOpeningMove()` classifies the draft opening at save time. | Pure addition — no master spec behavior is changed. The constraint block is injected between `<preferences>` and `<voice_signals>` in the prompt block order. |
+| Chapter Context System — not in master spec | New | `getRecentTopFindings(authorLogin, moduleId, limit)` added to `IVoiceStorage`. `buildChapterContext()` added to prompt-builder — injects `<chapter_context>` in the user prompt (after `<findings>`, before `<task>`) when the module has prior published history. Chapter number = `fireCount + 1`. Replaces the vague `<module_variety_hint>` framing when chapter context is available. | Pure addition. `<module_variety_hint>` remains for cases where chapter context is absent. |
+| `voice_posts.generation_system` column — not in master spec | New | New column tracking which generation system produced each draft: `'v1'` (current production, pre-voice-spec) or `'v2_progressive'` (this spec). Written at draft-save time in `process-job.ts`. Used to segment analytics and rollback detection. | Pure addition. Already applied to `database/schema.sql` via `ALTER TABLE IF NOT EXISTS`. |
+
+### `anti-parrot-spec.md`
+
+Entirely replaced. Of the 4 mechanisms:
+
+| Mechanism | Status |
+|---|---|
+| 1 — Anti-repetition memory | Eliminated. Voice dice + voice exposure cover this by design. |
+| 2 — Voice observations | Eliminated. Voice moves replaces compressed extraction entirely. |
+| 3 — Voice history rotation | **Absorbed** into this spec (Section: Voice Exposure). |
+| 4 — Structure breaks | Eliminated. Shape variation emerges from diverse examples + dice roll. |
+
+### What is NOT overridden
+
+Everything else in Phase 3 stays as-is:
+
+- `ContentStrategy` (content_preferences, audience, platform rules)
+- `<never>` block for platform-safety rules (no LinkedIn headers, no engagement-bait questions, no code blocks)
+- Loops 2, 3, 4 (edit analysis, discouraged hooks, industry context preference)
+- `STRUCTURE_MAP[tone]` and `TONE_INSTRUCTIONS[tone]` (used in Stages 0–1 only)
+- `voice_posts` table and state machine
+- `process-job.ts` integration flow (modified to call new voice system, but same overall structure)
+- `IVoiceStorage` contract (extended, not replaced)
+- Optimistic locking on `voice_profiles.version`
+
+---
+
+## Authoritative references (do not redefine)
+
+| Item | Source |
+|------|--------|
+| `voice_posts` schema and state machine | master spec |
+| `computeEditRatio()` tokenization contract | master spec §`computeEditRatio()` contract |
+| `ContentStrategy` and `content_preferences` | master spec §`VoiceProfile` JSONB contract |
+| `<never>` block (platform-safety subset only) | master spec §Rule Layers > Layer 1 |
+| `STRUCTURE_MAP[tone]` | master spec §Tone And Structure |
+| `IVoiceStorage` base interface | master spec §Individual Voice, Always > Storage contract |
+| `process-job.ts` integration points | master spec |
+| Loop 2, 3, 4 logic | master spec |
+| `IEmbedder`, `IAIClient` interfaces | master spec |
+
+If anything in this document conflicts with the master spec on an item NOT listed in the "What this spec replaces" section, the master spec wins.
+
+---

--- package.json
diff --git a/package.json b/package.json
index eb0cd31..6457090 100644
--- a/package.json
+++ b/package.json
@@ -8,17 +8,20 @@
     "setup-linkedin": "tsx --env-file=.env.local scripts/setup-linkedin.ts",
     "update-engagement": "tsx --env-file=.env.local scripts/update-engagement.ts",
     "bootstrap": "tsx --env-file=.env.local scripts/bootstrap-voice.ts",
+    "voice:analyze": "tsx --env-file=.env.local scripts/analyze-voice.ts",
+    "voice:validate-registry": "tsx --env-file=.env.local scripts/validate-registry.ts",
     "test-analyze": "tsx --env-file=.env.local scripts/test-analyze.ts",
     "webhook": "tsx --env-file=.env.local src/webhook/server.ts",
     "worker": "tsx --env-file=.env.local src/worker/main-worker.ts",
     "poll": "tsx --env-file=.env.local src/main-poll.ts",
-    "scan": "tsx --env-file=.env.local src/main-scan.ts",
+    "scan": "tsx --env-file=.env.local src/worker/main-scan-tenants.ts",
+    "scan:legacy": "tsx --env-file=.env.local src/main-scan.ts",
     "gen-image-prompt": "tsx --env-file=.env.local scripts/gen-image-prompt.ts",
     "seed-corpus:extract": "tsx --env-file=.env.local scripts/seed-corpus/extract-text.ts",
     "seed-corpus:validate": "tsx --env-file=.env.local scripts/seed-corpus/validate.ts",
     "seed-corpus:seed": "tsx --env-file=.env.local scripts/seed-corpus/seed.ts",
     "rotate-tenant-tokens": "tsx --env-file=.env.local scripts/rotate-tenant-tokens.ts",
-    "test": "vitest run",
+    "test": "vitest run --passWithNoTests",
     "typecheck": "tsc --noEmit"
   },
   "dependencies": {


--- scripts/analyze-voice.ts
diff --git a/scripts/analyze-voice.ts b/scripts/analyze-voice.ts
new file mode 100644
index 0000000..c4b5a05
--- /dev/null
+++ b/scripts/analyze-voice.ts
@@ -0,0 +1,74 @@
+import { readFileSync } from 'fs';
+import { createClient } from '@supabase/supabase-js';
+import { calibrateMoveProbability } from '../src/voice/dice.js';
+import { MOVES_REGISTRY } from '../src/voice/moves-registry.js';
+import { computeVoiceStage } from '../src/voice/stage.js';
+import { SupabaseStorage } from '../src/voice/supabase-storage.js';
+
+interface InputPost {
+  text?: string;
+  published?: string;
+}
+
+function getArg(name: string): string | undefined {
+  const idx = process.argv.indexOf(name);
+  return idx >= 0 ? process.argv[idx + 1] : undefined;
+}
+
+async function loadTexts(): Promise<string[]> {
+  const file = getArg('--file');
+  if (file) {
+    const raw = JSON.parse(readFileSync(file, 'utf8')) as InputPost[];
+    return raw.map((entry) => entry.text ?? entry.published ?? '').filter(Boolean);
+  }
+
+  const tenantId = getArg('--tenant');
+  const authorLogin = getArg('--author');
+  if (!tenantId || !authorLogin) {
+    throw new Error('Use --file <json> or --tenant <id> --author <login>.');
+  }
+
+  const url = process.env['SUPABASE_URL'] ?? '';
+  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
+  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for tenant mode.');
+
+  const storage = new SupabaseStorage(url, key, tenantId);
+  const posts = await storage.getPublishedForMoves(authorLogin);
+  return posts.map((post) => post.published ?? '').filter(Boolean);
+}
+
+async function main(): Promise<void> {
+  const texts = await loadTexts();
+  if (texts.length === 0) {
+    console.log(JSON.stringify({ total_posts: 0, active_moves: [], top_moves: [] }, null, 2));
+    return;
+  }
+
+  const frequencies = MOVES_REGISTRY
+    .filter((move) => move.regex)
+    .map((move) => {
+      const matches = texts.filter((text) => move.regex!.test(text)).length;
+      return {
+        id: move.id,
+        matches,
+        frequency: matches / texts.length,
+        calibrated_probability: calibrateMoveProbability(matches, texts.length),
+        description: move.description,
+      };
+    })
+    .sort((left, right) => right.frequency - left.frequency);
+
+  const result = {
+    total_posts: texts.length,
+    stage: computeVoiceStage(texts.length, false),
+    active_moves: frequencies.filter((move) => move.calibrated_probability > 0),
+    top_moves: frequencies.slice(0, 10),
+  };
+
+  console.log(JSON.stringify(result, null, 2));
+}
+
+main().catch((err) => {
+  console.error(err);
+  process.exit(1);
+});


--- scripts/bootstrap-voice.ts
diff --git a/scripts/bootstrap-voice.ts b/scripts/bootstrap-voice.ts
index d78a04a..c4e39fd 100644
--- a/scripts/bootstrap-voice.ts
+++ b/scripts/bootstrap-voice.ts
@@ -1,103 +1,115 @@
 /**
- * bootstrap-voice.ts — seeds voice history from voice-bootstrap.md
+ * bootstrap-voice.ts — stores bootstrap posts as voice exposure, not published history
  *
  * Usage: npm run bootstrap
- * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or uses SQLite locally)
+ * Requires: TENANT_ID for Supabase mode. SQLite defaults to local tenant.
  */
 
 import { readFileSync } from 'fs';
-import { randomUUID } from 'crypto';
-import { SupabaseStorage } from '../src/voice/supabase-storage.js';
+import { createClient } from '@supabase/supabase-js';
+import { DEFAULT_VOICE_PROFILE } from '../src/config/schema.js';
+import type { BootstrapPost, VoiceProfile } from '../src/config/schema.js';
 import { SqliteStorage } from '../src/voice/sqlite-storage.js';
-import type { IVoiceStorage, Platform } from '../src/voice/storage.js';
+import { SupabaseStorage } from '../src/voice/supabase-storage.js';
+import { mergeVoiceProfile } from '../src/voice/profile-utils.js';
 
-interface BootstrapPost {
-  module?: string;
-  platform: Platform;
-  training_weight: number;
-  voice_notes?: string;
+interface ParsedBootstrapPost {
   text: string;
 }
 
-function parseBootstrapFile(content: string): BootstrapPost[] {
-  const posts: BootstrapPost[] = [];
-  const blocks = content.split(/^---\s*$/m).filter(b => b.trim());
+function parseBootstrapFile(content: string): ParsedBootstrapPost[] {
+  const posts: ParsedBootstrapPost[] = [];
+  const blocks = content.split(/^---\s*$/m).filter((block) => block.trim());
 
   for (const block of blocks) {
     const lines = block.trim().split('\n');
-    const meta: Record<string, string> = {};
     const textLines: string[] = [];
     let inText = false;
 
     for (const line of lines) {
-      if (!inText && line.startsWith('#')) continue; // skip section headers
+      if (!inText && line.startsWith('#')) continue;
       const metaMatch = line.match(/^\*\*(\w+(?:_\w+)*)\*\*:\s*(.+)$/);
-      if (!inText && metaMatch) {
-        meta[metaMatch[1]!.toLowerCase()] = metaMatch[2]!.trim();
-      } else if (line.trim() || inText) {
+      if (!inText && metaMatch) continue;
+      if (line.trim() || inText) {
         inText = true;
         textLines.push(line);
       }
     }
 
     const text = textLines.join('\n').trim();
-    const platform = (meta['platform'] ?? 'linkedin') as Platform;
-    const trainingWeight = parseFloat(meta['training_weight'] ?? '1.0');
-
-    if (text && text.length > 50) {
-      posts.push({
-        module: meta['module'],
-        platform,
-        training_weight: trainingWeight,
-        voice_notes: meta['voice_notes'],
-        text,
-      });
-    }
+    if (text && text.length > 50) posts.push({ text });
   }
 
-  return posts;
+  return posts.slice(0, 5);
 }
 
 async function main(): Promise<void> {
   const tenantId = process.env['TENANT_ID'] ?? 'local';
-  const storage: IVoiceStorage = process.env['SUPABASE_URL']
-    ? new SupabaseStorage(process.env['SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '', tenantId)
-    : new SqliteStorage(process.env['SQLITE_PATH'] ?? 'data/devcast.db', tenantId);
 
   let content: string;
   try {
     content = readFileSync('voice-bootstrap.md', 'utf-8');
   } catch {
-    console.error('voice-bootstrap.md not found. Edit it with 3–5 posts in your voice, then run again.');
+    console.error('voice-bootstrap.md not found. Add 1-5 posts, then run again.');
+    process.exit(1);
+  }
+
+  const parsedPosts = parseBootstrapFile(content);
+  if (parsedPosts.length === 0) {
+    console.error('No valid bootstrap posts found. Add 1-5 posts separated by --- blocks.');
     process.exit(1);
   }
 
-  const posts = parseBootstrapFile(content);
-  console.log(`\nFound ${posts.length} posts to seed.\n`);
+  const bootstrapPosts: BootstrapPost[] = parsedPosts.map((post) => ({
+    text: post.text,
+    pasted_at: new Date().toISOString(),
+  }));
+
+  if (process.env['SUPABASE_URL']) {
+    const url = process.env['SUPABASE_URL'];
+    const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
+    if (!url || !key || !tenantId || tenantId === 'local') {
+      console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and real TENANT_ID are required in Supabase mode.');
+      process.exit(1);
+    }
 
-  for (const post of posts) {
-    const draftId = await storage.saveDraft({
-      commit_sha: `bootstrap-${randomUUID()}`,
-      repo: 'bootstrap/manual',
-      platform: post.platform,
-      ai_draft: post.text,
+    const db = createClient(url, key);
+    const storage = new SupabaseStorage(url, key, tenantId);
+    const stored = await storage.getVoiceProfile(null);
+    const nextVoice: VoiceProfile = mergeVoiceProfile({
+      ...(stored?.voice ?? DEFAULT_VOICE_PROFILE),
+      bootstrap_posts: bootstrapPosts,
     });
+    const saved = await storage.saveVoiceProfile(null, nextVoice, stored?.version);
+    if (!saved) {
+      console.error('Failed to save bootstrap voice profile due to version conflict.');
+      process.exit(1);
+    }
 
-    // Immediately mark as published with edit_ratio = training_weight (1.0 = unchanged)
-    await storage.updatePublished({
-      id: draftId,
-      published: post.text,
-      edit_ratio: Math.min(1.0, post.training_weight),
-      published_at: new Date().toISOString(),
+    await db
+      .from('tenants')
+      .update({
+        voice_bootstrap: JSON.stringify(parsedPosts.map((post) => post.text)),
+      })
+      .eq('id', tenantId);
+  } else {
+    const storage = new SqliteStorage(process.env['SQLITE_PATH'] ?? 'data/devcast.db', tenantId);

--- scripts/validate-registry.ts
diff --git a/scripts/validate-registry.ts b/scripts/validate-registry.ts
new file mode 100644
index 0000000..80e53e8
--- /dev/null
+++ b/scripts/validate-registry.ts
@@ -0,0 +1,129 @@
+import { readFileSync, writeFileSync } from 'fs';
+import { MOVES_REGISTRY } from '../src/voice/moves-registry.js';
+
+interface ReferencePost {
+  writer_name: string;
+  url: string;
+  title: string;
+  text: string;
+  word_count: number;
+  fetched_at: string;
+}
+
+interface WriterProfile {
+  writer: string;
+  total_posts: number;
+  move_frequencies: Record<string, number>;
+  activated_moves: string[];
+  top_5_moves: string[];
+}
+
+function getArg(name: string): string | undefined {
+  const idx = process.argv.indexOf(name);
+  return idx >= 0 ? process.argv[idx + 1] : undefined;
+}
+
+function loadReferencePosts(path: string): ReferencePost[] {
+  return JSON.parse(readFileSync(path, 'utf8')) as ReferencePost[];
+}
+
+function buildWriterProfiles(referencePosts: ReferencePost[]): WriterProfile[] {
+  const writers = [...new Set(referencePosts.map((post) => post.writer_name))];
+
+  return writers.map((writer) => {
+    const posts = referencePosts.filter((post) => post.writer_name === writer);
+    const moveFrequencies: Record<string, number> = {};
+
+    for (const move of MOVES_REGISTRY) {
+      if (!move.regex) continue;
+      const matches = posts.filter((post) => move.regex!.test(post.text)).length;
+      moveFrequencies[move.id] = matches / Math.max(posts.length, 1);
+    }
+
+    const activatedMoves = Object.entries(moveFrequencies)
+      .filter(([, frequency]) => frequency > 0.05)
+      .map(([id]) => id);
+
+    const top5Moves = Object.entries(moveFrequencies)
+      .sort((left, right) => right[1] - left[1])
+      .slice(0, 5)
+      .map(([id]) => id);
+
+    return {
+      writer,
+      total_posts: posts.length,
+      move_frequencies: moveFrequencies,
+      activated_moves: activatedMoves,
+      top_5_moves: top5Moves,
+    };
+  });
+}
+
+function buildValidationReport(writerProfiles: WriterProfile[]): string {
+  const signatureCounts = new Map<string, number>();
+  const registryMoveIds = MOVES_REGISTRY.filter((move) => move.regex).map((move) => move.id);
+  const activationCountByMove = new Map<string, number>();
+
+  for (const moveId of registryMoveIds) activationCountByMove.set(moveId, 0);
+
+  for (const profile of writerProfiles) {
+    const signature = profile.top_5_moves.join('|');
+    signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
+    for (const moveId of profile.activated_moves) {
+      activationCountByMove.set(moveId, (activationCountByMove.get(moveId) ?? 0) + 1);
+    }
+  }
+
+  const duplicateTop5 = [...signatureCounts.values()].some((count) => count > 1);
+  const deadMoves = [...activationCountByMove.entries()].filter(([, count]) => count === 0).map(([id]) => id);
+  const universalMoves = [...activationCountByMove.entries()]
+    .filter(([, count]) => count === writerProfiles.length)
+    .map(([id]) => id);
+  const avgActivatedMoves = writerProfiles.length === 0
+    ? 0
+    : writerProfiles.reduce((sum, profile) => sum + profile.activated_moves.length, 0) / writerProfiles.length;
+
+  const lines = [
+    '# Registry Validation Report',
+    '',
+    `Writers analyzed: ${writerProfiles.length}`,
+    '',
+    '## Criteria',
+    `- Discrimination: ${duplicateTop5 ? 'FAIL' : 'PASS'}`,
+    `- Coverage: ${deadMoves.length === 0 ? 'PASS' : `FAIL (${deadMoves.join(', ')})`}`,
+    `- No universals: ${universalMoves.length === 0 ? 'PASS' : `FAIL (${universalMoves.join(', ')})`}`,
+    `- Spread: ${avgActivatedMoves >= 10 && avgActivatedMoves <= 25 ? 'PASS' : `FAIL (${avgActivatedMoves.toFixed(2)})`}`,
+    '',
+    '## Writer Profiles',
+    ...writerProfiles.flatMap((profile) => [
+      `### ${profile.writer}`,
+      `- Posts: ${profile.total_posts}`,
+      `- Activated moves: ${profile.activated_moves.join(', ') || 'none'}`,
+      `- Top 5: ${profile.top_5_moves.join(', ') || 'none'}`,
+      '',
+    ]),
+  ];
+
+  return lines.join('\n');
+}
+
+async function main(): Promise<void> {
+  const inputPath = getArg('--input') ?? 'scripts/registry-validation/reference-posts.json';
+  const outputPath = getArg('--output');
+  const referencePosts = loadReferencePosts(inputPath);
+  const writerProfiles = buildWriterProfiles(referencePosts);
+  const report = buildValidationReport(writerProfiles);
+
+  if (outputPath) {
+    writeFileSync(outputPath, report, 'utf8');
+    console.log(`Wrote validation report to ${outputPath}`);
+    return;
+  }
+
+  console.log(report);
+}
+
+main().catch((err) => {
+  console.error(err);
+  process.exit(1);
+});


--- src/ai/post-generator.ts
diff --git a/src/ai/post-generator.ts b/src/ai/post-generator.ts
index 49c2127..cbbafc3 100644
--- a/src/ai/post-generator.ts
+++ b/src/ai/post-generator.ts
@@ -1,11 +1,11 @@
 import { logger } from '../utils/logger.js';
-import { buildSystemPrompt, buildUserPrompt } from './prompt-builder.js';
-import { computeEditRatio } from '../voice/similarity.js';
+import { buildSystemPrompt, buildUserPrompt, type VoicePromptContext } from './prompt-builder.js';
 import type { IAIClient } from './types.js';
 import type { Finding } from '../analysis/types.js';
-import type { IVoiceStorage, SaveDraftInput, VoicePost } from '../voice/storage.js';
+import type { IVoiceStorage, SaveDraftInput, VoiceStage } from '../voice/storage.js';
 import type { EnrichedCommit } from '../github/commit-enricher.js';
-import type { Config } from '../config/schema.js';
+import type { BootstrapPost, Config, VoiceProfile } from '../config/schema.js';
+import { detectOpeningMove } from '../voice/exposure.js';
 
 export interface GeneratedPosts {
   linkedinPost: string;   // clean LinkedIn text for direct posting
@@ -14,6 +14,19 @@ export interface GeneratedPosts {
   draftId: string;
 }
 
+export interface GeneratePostsOptions {
+  voiceProfile: VoiceProfile;
+  voiceStage: VoiceStage;
+  exposurePool?: import('../voice/storage.js').VoicePost[];
+  bootstrapPosts?: BootstrapPost[];
+  recentModuleIds?: string[];
+  chapterContext?: string;
+  industryContext?: string;
+  draftMetadata?: Partial<SaveDraftInput>;
+  draftIndexToday?: number;
+  varietyConstraint?: string;
+}
+
 /**
  * ONE Claude call per commit.
  * Stores ai_draft in DB immediately before returning.
@@ -25,27 +38,36 @@ export async function generatePosts(
   findings: Finding[],
   storage: IVoiceStorage,
   config: Config,
-  recentModuleIds: string[] = [],
-  industryContext?: string,
-  draftMetadata: Partial<SaveDraftInput> = {},
+  options: GeneratePostsOptions,
 ): Promise<GeneratedPosts> {
   if (findings.length === 0) {
     throw new Error('generatePosts called with 0 findings — caller should skip this call');
   }
 
-  // Fetch voice examples (linkedin as primary training platform)
-  const poolSize = config.posting.voice_examples_count * 3;
-  const voicePool = await storage.getTopVoiceExamples('linkedin', poolSize);
-  const voiceExamples = selectVoiceExamples(voicePool, findings, config.posting.voice_examples_count);
+  const draftMetadata = options.draftMetadata ?? {};
+  const voiceContext: VoicePromptContext = {
+    stage: options.voiceStage,
+    exposurePool: options.exposurePool ?? [],
+    bootstrapPosts: options.bootstrapPosts ?? [],
+    commitSha: commit.sha,
+    draftIndexToday: options.draftIndexToday ?? 0,
+    varietyConstraint: options.varietyConstraint,
+  };
 
-  const systemPrompt = buildSystemPrompt(config);
-  const userPrompt = buildUserPrompt(commit, findings, voiceExamples, config, recentModuleIds, industryContext);
+  const systemPrompt = buildSystemPrompt(config, options.voiceProfile, voiceContext);
+  const userPrompt = buildUserPrompt(
+    commit,
+    findings,
+    options.recentModuleIds ?? [],
+    options.chapterContext,
+    options.industryContext,
+  );
 
   logger.info('ai.generate.start', {
     sha: commit.sha,
     repo: commit.repo,
     findings: findings.length,
-    has_industry_context: industryContext !== undefined,
+    has_industry_context: options.industryContext !== undefined,
   });
 
   const rawResponse = await client.complete(systemPrompt, userPrompt);
@@ -55,6 +77,7 @@ export async function generatePosts(
   const topFinding = findings[0]?.finding;
   const topModuleId = findings[0]?.moduleId;
   const findingsCount = findings.length;
+  const openingMove = detectOpeningMove(post);
 
   // One record per commit — ai_draft stores the full post for voice training
   const draftId = await storage.saveDraft({
@@ -65,6 +88,8 @@ export async function generatePosts(
     top_finding: topFinding,
     top_module_id: topModuleId,
     findings_count: findingsCount,
+    generation_system: draftMetadata.generation_system ?? (options.voiceStage === 'cold' ? 'v1' : 'v2_progressive'),
+    opening_move: draftMetadata.opening_move ?? openingMove,
     ...draftMetadata,
   });
 
@@ -90,58 +115,4 @@ function parseResponse(raw: string): { post: string; shortPost: string } {
     shortPost: (shortMatch[1] ?? '').trim(),
   };
 }
-
-/**
- * Selects voice examples using a two-pass strategy:
- *
- * Pass 1 — Anchors (style fidelity): pick the top 2 posts by edit_ratio.
- *   These ground Claude in the user's best-preserved voice patterns.
- *
- * Pass 2 — Topic match (relevance): from the remaining pool, rank by
- *   text similarity between post.top_finding and the current findings
- *   headlines. Fill remaining slots with the most topically similar posts.
- *
- * Final deduplication by published text prevents repeated examples.
- */
-function selectVoiceExamples(
-  posts: VoicePost[],
-  findings: Finding[],
-  limit: number,
-): VoicePost[] {
-  // Deduplicate pool by published text first
-  const seen = new Set<string>();
-  const pool: VoicePost[] = [];
-  for (const post of posts.sort((a, b) => (b.edit_ratio ?? 0) - (a.edit_ratio ?? 0))) {
-    const key = (post.published ?? post.ai_draft).slice(0, 100);
-    if (seen.has(key)) continue;
-    seen.add(key);
-    pool.push(post);
-  }
-
-  if (pool.length === 0) return [];
-
-  // Pass 1: anchors — top 2 by edit_ratio
-  const anchorCount = Math.min(2, Math.floor(limit / 2), pool.length);
-  const anchors = pool.slice(0, anchorCount);
-  const anchorIds = new Set(anchors.map((p) => p.id));
-
-  // Pass 2: topic match from the remaining candidates
-  const topicSlots = limit - anchors.length;
-  if (topicSlots <= 0) return anchors;
-
-  const topicQuery = findings.map((f) => f.finding).join(' ');
-  const candidates = pool.filter((p) => !anchorIds.has(p.id));
-

--- src/ai/prompt-builder.ts
diff --git a/src/ai/prompt-builder.ts b/src/ai/prompt-builder.ts
index d48ad93..fffa3c3 100644
--- a/src/ai/prompt-builder.ts
+++ b/src/ai/prompt-builder.ts
@@ -1,229 +1,498 @@
 import type { Finding } from '../analysis/types.js';
-import type { VoicePost } from '../voice/storage.js';
+import type { BootstrapPost, Config, VoiceProfile } from '../config/schema.js';
 import type { EnrichedCommit } from '../github/commit-enricher.js';
-import type { Config } from '../config/schema.js';
-
-/**
- * Assembles the prompt following Anthropic's long-context best practices:
- *
- * [SYSTEM — ~300 tokens]
- * [VOICE EXAMPLES — TOP of context, ordered edit_ratio DESC]
- * [COMMIT CONTEXT — middle]
- * [MODULE FINDINGS — below commit, above task]
- * [TASK INSTRUCTION — BOTTOM]
- */
-export function buildSystemPrompt(config: Config): string {
-  const { name, website } = config.author;
-  const websiteLine = website ? `Site: ${website} — "The Art of Improving Without Starting Over"\n` : '';
-
-  return `You are a ghostwriter. You write social media posts in ${name}'s voice.
-You receive findings from code analysis modules. Your job is to WRITE, not analyze.
-
-<author>
-${name} — Software Architect. 10+ years.
-${websiteLine}Financial systems, Kubernetes, AI/ML, cloud architecture.
-</author>
-
-<voice_devices>
-These are the specific writing devices that define ${name}'s voice.
-Use them. Vary which ones you use per post, but every post must use at least 3.
-
-STACCATO QUALIFIERS: Chain 2-3 single-word sentences after a statement.
-  "Clean. Disciplined. Strong."
-  "Beautiful. Humiliating. Exactly what you want, frankly."
-  "Cascading. Silent. Very bad. The worst kind."
-
-VERY CRESCENDO: "Very X. Very Y." as self-aware commentary. 2-3 per post max.
-  "Very fast. Very convenient. Also: a complete disaster in about three weeks."
-  "Very exciting. Very useful."
-  "Very glamorous? No. Very effective? Absolutely."
-
-SELF-AWARE Q&A: Ask and answer in two beats.
-  "Very glamorous? No. Very effective? Absolutely."
-  "The best part? The wrong path is no longer unlikely. It's impossible to compile."
-
-CONTRADICTORY PAIRS: Two adjectives that clash on purpose.
-  "Very disciplined. Very slow."
-  "Beautiful. Humiliating."
-
-ONE-WORD PUNCTURE: A single word as its own sentence to break rhythm.
-  "Wrong."
-  "Gone."
-  "Incredible."
-
-PARENTHETICAL REPETITION: Repeat a word for emphasis inside an aside.
-  "which changes constantly, by the way, constantly"
-
-FRANKLY DROP: "frankly" as a confidence marker mid-sentence.
-  "Exactly what you want, frankly."
-
-DIRECT CLOSING: End with a short declarative. Never a question.
-  "Use it."
-  "Rocks, you."
-  "Probably first."
-  "That's where the good stuff is."
-  "Architecture first. Then AI."
-</voice_devices>
-
-<structure>
-HOOK: One concrete fact — a decision, a surprise, a tradeoff. No preamble. No "Today I..." or "I'm excited to..."
-  "A type guard stopped a cascading client deactivation bug."
-  "I shipped a module that finds performance bugs in code. Very exciting. Very useful."
-  "The retries were working. The idempotency key wasn't. Classic."
-
-CONTEXT: 2-3 short sentences. Project name, what was happening. No long explanations.
-
-THE WORK: What changed and why. Use specific details from the findings.
-  Name files, name patterns, name numbers. Never vague.
-
-LESSON: One transferable principle. Named concept when applicable.
-  "Make the bad path impossible."
-  "The refactor window is real."
-
-CLOSING: Direct statement. See DIRECT CLOSING device above.
-</structure>
-
-<never>
-- Format headers like "**LINKEDIN**" or "## LinkedIn" in the output
-- Self-check reasoning or meta-commentary about the task
-- "Here's the context:" or "Let me explain:" setup paragraphs
-- "I'm building Devcast" in every post — only when the commit is about Devcast
-- Generic LinkedIn motivation ("excited to share", "humbled", "on a journey")
-- Engagement-bait questions ("thoughts?", "what do you think?")
-- Corporate buzzwords ("leverage", "synergy")
-- Emojis
-- Code blocks (they don't render on LinkedIn)
-- Lead with counts or quantities: not line counts, file counts, module counts, or commit sizes.
-  A reader should never think "okay, they changed 5 files." They should think "that's the decision I would have gotten wrong."
-  Lead with: the tradeoff that forced a decision, the consequence that surprised you, or the moment the architecture clicked.
-  Write like someone who learned something the hard way — not like someone filing a report.
-</never>
-
-<format>
-Post: 1200-1800 characters. Each sentence is its own paragraph.
-  Short paragraphs with aggressive line breaks ARE the format — do NOT compress.
-  3-5 hashtags at the end. Always include #lilicurl.
-
-Short version (Twitter): 3-5 staccato lines max. No hashtags. No preamble.
-  The single hook that makes someone stop. Nothing else.
-  Example: "A type guard stopped a cascading bug.\nNot a try/catch. A type guard.\nMake the bad path impossible."
-</format>`;
+import { rollVoiceDice } from '../voice/dice.js';
+import {
+  moduleIdToLabel,
+  selectExposureExamples,
+  syntheticVoicePost,
+  trimExposureExamples,
+} from '../voice/exposure.js';
+import type { VoicePost, VoiceStage } from '../voice/storage.js';
+import { resolvePromptTier } from '../voice/profile-utils.js';
+
+const TONE_INSTRUCTIONS: Record<VoiceProfile['tone'], string> = {
+  formal: 'Use precise, composed language with confident transitions.',
+  professional: 'Sound experienced, direct, and useful without corporate filler.',
+  casual: 'Write naturally and conversationally while keeping technical credibility.',
+  humorous: 'Allow light wit, but keep the technical point sharper than the joke.',
+  storytelling: 'Shape the post like a short narrative with a clear turn or lesson.',
+  teaching: 'Explain the why behind the change so another engineer can reuse the insight.',
+};
+
+const RHYTHM_INSTRUCTIONS: Record<VoiceProfile['rhythm'], string> = {
+  paragraphs: 'Prefer fuller paragraphs with deliberate transitions.',
+  mixed: 'Mix short punchy lines with a few fuller paragraphs.',
+  'short-sentences': 'Keep sentences compact and break aggressively for scanability.',
+};
+
+const STRUCTURE_MAP: Record<VoiceProfile['tone'] | 'professional_default', string> = {
+  formal: 'Open with the decisive technical fact, add context, explain the tradeoff, end on the principle.',
+  professional: 'Lead with the concrete decision or consequence, explain the work, land on the reusable lesson.',
+  casual: 'Start with the real moment of friction, explain what changed, close with the takeaway.',
+  humorous: 'Open with the sharpest contradiction or surprise, explain the fix, close with a dry lesson.',
+  storytelling: 'Start in the middle of the moment, explain the turn, end with what changed your mind.',
+  teaching: 'Open with the insight, walk through the implementation, close with the principle to reuse.',
+  professional_default: 'Lead with the decision or surprise, explain the implementation, end with the reusable principle.',
+};

--- src/buffer/sent-scanner.ts
diff --git a/src/buffer/sent-scanner.ts b/src/buffer/sent-scanner.ts
index c8ad9a5..24a7d5b 100644
--- a/src/buffer/sent-scanner.ts
+++ b/src/buffer/sent-scanner.ts
@@ -3,8 +3,12 @@ import { computeEditRatio } from '../voice/similarity.js';
 import type { BufferClient } from './client.js';
 import type { IVoiceStorage, Platform } from '../voice/storage.js';
 import type { Config } from '../config/schema.js';
+import { computeEditAnalysis, deriveContentPreferences } from '../voice/feedback.js';
+import { refreshVoiceMoves } from '../voice/moves-calculator.js';
+import { mergeVoiceProfile } from '../voice/profile-utils.js';
 
 const MATCH_THRESHOLD = 0.4;  // min similarity to count as a match
+const EXPIRED_DAYS = 7;
 
 function extractLinkedInUrn(externalLink: string | null): string | undefined {
   if (!externalLink) return undefined;
@@ -39,6 +43,12 @@ export async function scanSentPosts(
     logger.info('sent_scanner.start', { platform });
     await scanPlatform(bufferClient, storage, platform, orgId, profileId);
   }
+
+  const authors = await storage.listActiveAuthors(30);
+  for (const authorLogin of authors) {
+    await refreshContentPreferences(storage, authorLogin);
+    await refreshVoiceMoves(storage, authorLogin);
+  }
 }
 
 async function scanPlatform(
@@ -81,11 +91,13 @@ async function scanPlatform(
       const bestDraft = remaining[bestIdx]!;
       const publishedAt = sentPost.createdAt;
       const linkedinUrn = extractLinkedInUrn(sentPost.externalLink);
+      const editAnalysis = computeEditAnalysis(bestDraft, sentPost.text);
       await storage.updatePublished({
         id: bestDraft.id,
         published: sentPost.text,
         edit_ratio: bestScore,
         published_at: publishedAt,
+        edit_analysis: editAnalysis,
         linkedin_urn: linkedinUrn,
         publish_source: 'buffer',
       });
@@ -101,5 +113,45 @@ async function scanPlatform(
     }
   }
 
+  const staleDrafts = remaining.filter((draft) => (
+    !!draft.buffer_post_id
+    && !!draft.scheduled_at
+    && new Date(draft.scheduled_at).getTime() < Date.now() - EXPIRED_DAYS * 24 * 60 * 60 * 1000
+  ));
+  if (staleDrafts.length > 0) {
+    await storage.markExpired(staleDrafts.map((draft) => draft.id));
+    logger.info('sent_scanner.expired', { platform, count: staleDrafts.length });
+  }
+
   logger.info('sent_scanner.done', { platform, scanned: sentPosts.length, matched });
 }
+
+async function refreshContentPreferences(storage: IVoiceStorage, authorLogin: string): Promise<void> {
+  const outcomes = await storage.getRecentOutcomes(authorLogin, 20);
+  if (outcomes.length < 10) return;
+
+  const storedProfile = await storage.getVoiceProfile(authorLogin);
+  const voiceProfile = mergeVoiceProfile(storedProfile?.voice);
+  const updatedAt = voiceProfile.content_preferences?.updated_at;
+
+  if (updatedAt) {
+    const newOutcomes = outcomes.filter((post) => new Date(post.published_at ?? post.created_at) > new Date(updatedAt));
+    if (newOutcomes.length < 10) return;
+  }
+
+  const contentPreferences = deriveContentPreferences(outcomes);
+  const nextProfile = {
+    ...voiceProfile,
+    content_preferences: contentPreferences,
+  };
+
+  await storage.saveVoiceProfile(authorLogin, nextProfile, storedProfile?.version);
+
+  if ((contentPreferences.expired_rate_30d ?? 0) > 0.3) {
+    logger.warn('voice.content_preferences.expired_rate_high', {
+      tenantId: storage.tenantId,
+      authorLogin,
+      expiredRate30d: contentPreferences.expired_rate_30d,
+    });
+  }
+}


--- src/config/schema.ts
diff --git a/src/config/schema.ts b/src/config/schema.ts
index 1a777af..c8b40fe 100644
--- a/src/config/schema.ts
+++ b/src/config/schema.ts
@@ -1,10 +1,94 @@
 import { z } from 'zod';
+import { MODULE_REGISTRY } from '../analysis/modules/index.js';
+
+const MODULE_IDS = new Set(MODULE_REGISTRY.map((module) => module.id));
 
 const PlatformConfigSchema = z.object({
   enabled: z.boolean(),
   buffer_profile_id: z.string().default(''),
 });
 
+export const AudienceSchema = z.enum(['peers', 'hiring-managers', 'general-tech', 'mixed']);
+export const ToneSchema = z.enum(['formal', 'professional', 'casual', 'humorous', 'storytelling', 'teaching']);
+export const RhythmSchema = z.enum(['paragraphs', 'mixed', 'short-sentences']);
+export const HashtagModeSchema = z.enum(['always', 'prefer']);
+export const HookStyleSchema = z.enum([
+  'question',
+  'statistic',
+  'anecdote',
+  'declarative',
+  'contradiction',
+  'problem-first',
+]);
+
+export const ContentStrategySchema = z.object({
+  focus_modules: z.array(z.string()).optional().refine(
+    (modules) => !modules || modules.every((moduleId) => MODULE_IDS.has(moduleId)),
+    'focus_modules must reference valid analysis module ids',
+  ),
+  audience: AudienceSchema.default('mixed'),
+  skip_patterns: z.array(z.string()).default([]),
+});
+
+export const ContentPreferencesSchema = z.object({
+  preferred_modules: z.array(z.string()).optional(),
+  discouraged_hook_styles: z.array(HookStyleSchema).optional(),
+  typical_length_delta: z.number().optional(),
+  industry_context_preference: z.enum(['prefer', 'neutral', 'avoid']).optional(),
+  expired_rate_30d: z.number().min(0).max(1).optional(),
+  updated_at: z.string().optional(),
+});
+
+export const BootstrapPostSchema = z.object({
+  text: z.string().min(1),
+  pasted_at: z.string(),
+});
+
+const VoiceExamplesPoolSchema = z.object({
+  linkedin: z.array(z.string()).optional(),
+  instagram: z.array(z.string()).optional(),
+});
+
+export const VoiceProfileSchema = z.object({
+  tone: ToneSchema.default('professional'),
+  rhythm: RhythmSchema.default('mixed'),
+  hashtags: z.array(z.string()).max(10).default([]),
+  hashtags_mode: HashtagModeSchema.default('prefer'),
+  post_length: z.object({
+    min: z.number().int().min(300),
+    max: z.number().int().max(3000),
+  }).refine(({ min, max }) => min < max, 'post_length.min must be lower than post_length.max')
+    .default({ min: 1200, max: 1800 }),
+  content_strategy: ContentStrategySchema.default({
+    audience: 'mixed',
+    skip_patterns: [],
+  }),
+  style_patterns: z.string().max(400).optional(),
+  voice_devices: z.string().max(300).optional(),
+  voice_summary: z.string().max(200).optional(),
+  extraction_source: z.enum(['bootstrap', 'published_posts']).optional(),
+  extracted_at: z.string().optional(),
+  content_preferences: ContentPreferencesSchema.optional(),
+  voice_moves: z.record(z.string(), z.number().min(0).max(1)).optional(),
+  voice_stage: z.enum(['cold', 'bootstrap', 'warming', 'established']).optional(),
+  voice_examples_pool: VoiceExamplesPoolSchema.optional(),
+  always_hashtags: z.array(z.string()).max(10).optional(),
+  recent_opening_sequence: z.array(z.string()).max(5).optional(),
+  bootstrap_posts: z.array(BootstrapPostSchema).max(5).optional(),
+}).passthrough();
+
+export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
+  tone: 'professional',
+  rhythm: 'mixed',
+  hashtags: [],
+  hashtags_mode: 'prefer',
+  post_length: { min: 1200, max: 1800 },
+  content_strategy: {
+    audience: 'mixed',
+    skip_patterns: [],
+  },
+};
+
 export const ConfigSchema = z.object({
   author: z.object({
     github_username: z.string().min(1),
@@ -50,3 +134,12 @@ export const ConfigSchema = z.object({
 });
 
 export type Config = z.infer<typeof ConfigSchema>;
+export type Audience = z.infer<typeof AudienceSchema>;
+export type Tone = z.infer<typeof ToneSchema>;
+export type Rhythm = z.infer<typeof RhythmSchema>;
+export type HashtagMode = z.infer<typeof HashtagModeSchema>;
+export type HookStyle = z.infer<typeof HookStyleSchema>;
+export type ContentStrategy = z.infer<typeof ContentStrategySchema>;
+export type ContentPreferences = z.infer<typeof ContentPreferencesSchema>;
+export type BootstrapPost = z.infer<typeof BootstrapPostSchema>;
+export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;


--- src/content/matcher.ts
diff --git a/src/content/matcher.ts b/src/content/matcher.ts
index 37aaaff..d702cb4 100644
--- a/src/content/matcher.ts
+++ b/src/content/matcher.ts
@@ -47,6 +47,7 @@ async function stage1BiEncoder(
   finding: FindingInput,
   embedder: IEmbedder,
   db: SupabaseClient,
+  similarityThreshold: number,
 ): Promise<CandidateArticle[]> {
   const embedding = await embedder.embed(finding.plainLanguage);
   const cutoff = new Date(Date.now() - MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
@@ -54,7 +55,7 @@ async function stage1BiEncoder(
   // pgvector cosine similarity search via Supabase RPC
   const { data, error } = await db.rpc('match_article_chunks', {
     query_embedding: embedding,
-    similarity_threshold: SIMILARITY_THRESHOLD,
+    similarity_threshold: similarityThreshold,
     match_count: TOP_CANDIDATES * 3,  // fetch more, deduplicate by article below
     min_quality_score: QUALITY_GATE,
     week_of_cutoff: cutoff,
@@ -225,10 +226,12 @@ export async function matchFindingsToArticles(
   embedder: IEmbedder,
   aiClient: IAIClient,
   db: SupabaseClient,
+  options?: { similarityThreshold?: number },
 ): Promise<MatchedContext | null> {
+  const similarityThreshold = options?.similarityThreshold ?? SIMILARITY_THRESHOLD;
   for (const finding of findings) {
     try {
-      const candidates = await stage1BiEncoder(finding, embedder, db);
+      const candidates = await stage1BiEncoder(finding, embedder, db, similarityThreshold);
       if (candidates.length === 0) continue;
 
       const match = await stage2CrossEncoder(finding, candidates, aiClient);


--- src/main-poll.ts
diff --git a/src/main-poll.ts b/src/main-poll.ts
index 941d3e0..3782104 100644
--- a/src/main-poll.ts
+++ b/src/main-poll.ts
@@ -21,6 +21,9 @@ import { notifyNewDraft } from './review/notifier.js';
 import { SqliteStorage } from './voice/sqlite-storage.js';
 import { SupabaseStorage } from './voice/supabase-storage.js';
 import type { IVoiceStorage } from './voice/storage.js';
+import { mergeVoiceProfile } from './voice/profile-utils.js';
+import { buildChapterContext, buildVarietyConstraint } from './ai/prompt-builder.js';
+import { computeVoiceStage } from './voice/stage.js';
 
 async function main(): Promise<void> {
   const config = loadConfig();
@@ -117,15 +120,48 @@ async function main(): Promise<void> {
       }
 
       // Generate post (ONE Claude call — returns full post + Twitter short variant)
+      const storedVoiceProfile = await storage.getVoiceProfile(commit.authorLogin ?? null);
+      const voiceProfile = mergeVoiceProfile(storedVoiceProfile?.voice);
+      const authorLogin = commit.authorLogin ?? null;
+      const uniquePublished = authorLogin ? await storage.countUniquePublished(authorLogin) : 0;
+      const voiceStage = computeVoiceStage(uniquePublished, (voiceProfile.bootstrap_posts?.length ?? 0) > 0);
+      const startOfDay = new Date();
+      startOfDay.setUTCHours(0, 0, 0, 0);
+      const draftsToday = authorLogin ? await storage.countDraftsSince(authorLogin, startOfDay.toISOString()) : 0;
+      const exposurePool = authorLogin && voiceStage !== 'cold'
+        ? await storage.getPublishedForExposure(authorLogin, 'linkedin')
+        : [];
+      const topModuleId = findings[0]?.moduleId;
+      const topModuleFireCount = topModuleId
+        ? recentModuleIds.filter((moduleId) => moduleId === topModuleId).length
+        : 0;
+      const chapterContext = topModuleId && topModuleFireCount >= 1
+        ? buildChapterContext(topModuleId, await storage.getRecentTopFindings(authorLogin, topModuleId, 2), topModuleFireCount + 1)
+        : undefined;
+      const todayFirstOpening = undefined;
+      const varietyConstraint = voiceStage !== 'cold'
+        ? buildVarietyConstraint(voiceProfile.recent_opening_sequence ?? [], draftsToday, todayFirstOpening ?? undefined) ?? undefined
+        : undefined;
       const { bufferText, draftId } = await generatePosts(
         anthropic,
         commit,
         findings,
         storage,
         config,
-        recentModuleIds,
-        undefined,
-        { author_login: commit.authorLogin },
+        {
+          voiceProfile,
+          voiceStage,
+          exposurePool,
+          bootstrapPosts: voiceProfile.bootstrap_posts ?? [],
+          recentModuleIds,
+          chapterContext,
+          draftMetadata: {
+            author_login: authorLogin,
+            generation_system: voiceStage === 'cold' ? 'v1' : 'v2_progressive',
+          },
+          draftIndexToday: draftsToday,
+          varietyConstraint,
+        },
       );
 
       // Publish ONE Buffer Idea with both variants in the text


--- src/voice/dice.ts
diff --git a/src/voice/dice.ts b/src/voice/dice.ts
new file mode 100644
index 0000000..87e33dc
--- /dev/null
+++ b/src/voice/dice.ts
@@ -0,0 +1,38 @@
+import { MOVES_REGISTRY, type MoveDefinition } from './moves-registry.js';
+import { hash, seededRandom } from './utils.js';
+
+export interface RolledMoves {
+  available: MoveDefinition[];
+  unavailable: MoveDefinition[];
+}
+
+export function calibrateMoveProbability(matchCount: number, totalPosts: number): number {
+  if (totalPosts < 5) return 0;
+  const raw = matchCount / totalPosts;
+  if (raw < 0.05) return 0;
+  if (raw > 0.9) return 0.9;
+  return Math.round(raw * 20) / 20;
+}
+
+export function rollVoiceDice(
+  moves: Record<string, number>,
+  commitSha: string,
+  draftIndexToday: number,
+): RolledMoves {
+  const available: MoveDefinition[] = [];
+  const unavailable: MoveDefinition[] = [];
+
+  for (const [moveId, probability] of Object.entries(moves)) {
+    if (probability <= 0 || probability >= 1) continue;
+
+    const move = MOVES_REGISTRY.find((candidate) => candidate.id === moveId);
+    if (!move) continue;
+
+    const seed = hash(`${commitSha}:${draftIndexToday}:${moveId}`);
+    const roll = seededRandom(seed);
+    if (roll < probability) available.push(move);
+    else unavailable.push(move);
+  }
+
+  return { available, unavailable };
+}


--- src/voice/exposure.ts
diff --git a/src/voice/exposure.ts b/src/voice/exposure.ts
new file mode 100644
index 0000000..692af2b
--- /dev/null
+++ b/src/voice/exposure.ts
@@ -0,0 +1,104 @@
+import type { BootstrapPost } from '../config/schema.js';
+import type { VoicePost } from './storage.js';
+import { MOVES_REGISTRY, OPENING_MOVE_IDS, type OpeningMoveType } from './moves-registry.js';
+import { createRng, hash, weightedShuffle } from './utils.js';
+
+export interface ExposureCandidate {
+  id?: string;
+  published?: string | null;
+  text?: string;
+  edit_ratio?: number | null;
+  top_module_id?: string | null;
+}
+
+export const MAX_EXPOSURE_CHARS = 4000;
+
+export function exposureWeight(editRatio: number | null | undefined): number {
+  const value = editRatio ?? 0;
+  if (value < 0.3) return 0;
+  if (value <= 0.65) return 1.2;
+  if (value <= 0.9) return 1.0;
+  return 0.8;
+}
+
+export function selectExposureExamples(
+  pool: ExposureCandidate[],
+  commitSha: string,
+  draftIndexToday: number,
+  maxExamples = 3,
+): ExposureCandidate[] {
+  if (pool.length === 0) return [];
+  if (pool.length <= maxExamples) return pool;
+
+  const rng = createRng(hash(`${commitSha}:${draftIndexToday}`));
+  const shuffled = weightedShuffle(
+    pool.map((post) => ({
+      item: post,
+      weight: exposureWeight(post.edit_ratio),
+    })),
+    rng,
+  );
+
+  const selected: ExposureCandidate[] = [];
+  const modulesSeen = new Set<string>();
+  for (const post of shuffled) {
+    if (selected.length >= maxExamples) break;
+    if (post.top_module_id && modulesSeen.has(post.top_module_id)) {
+      if (modulesSeen.size < maxExamples) continue;
+    }
+    selected.push(post);
+    if (post.top_module_id) modulesSeen.add(post.top_module_id);
+  }
+
+  return selected;
+}
+
+export function syntheticVoicePost(bp: BootstrapPost): ExposureCandidate {
+  return {
+    published: bp.text,
+    text: bp.text,
+    edit_ratio: 1.0,
+    top_module_id: null,
+  };
+}
+
+export function moduleIdToLabel(moduleId: string): string {
+  return moduleId.replace(/_/g, ' ');
+}
+
+export function detectOpeningMove(text: string): OpeningMoveType {
+  const firstLine = (text ?? '').split('\n').find((line) => line.trim().length > 0) ?? '';
+
+  for (const moveId of OPENING_MOVE_IDS) {
+    const regex = MOVES_REGISTRY.find((move) => move.id === moveId)?.regex;
+    if (regex?.test(firstLine)) return moveId;
+  }
+
+  return 'unknown';
+}
+
+export function trimExposureExamples(
+  examples: Array<{ text: string; topic: string }>,
+  maxChars = MAX_EXPOSURE_CHARS,
+): Array<{ text: string; topic: string }> {
+  const next = [...examples];
+  let totalChars = next.reduce((sum, example) => sum + example.text.length, 0);
+
+  while (totalChars > maxChars && next.length > 1) {
+    const longestIdx = next.reduce(
+      (maxIdx, example, idx) => (example.text.length > next[maxIdx]!.text.length ? idx : maxIdx),
+      0,
+    );
+    next.splice(longestIdx, 1);
+    totalChars = next.reduce((sum, example) => sum + example.text.length, 0);
+  }
+
+  if (totalChars > maxChars && next.length === 1) {
+    next[0] = {
+      ...next[0]!,
+      text: `${next[0]!.text.slice(0, maxChars)}\n[truncated]`,
+    };
+  }
+
+  return next;
+}


--- src/voice/feedback.ts
diff --git a/src/voice/feedback.ts b/src/voice/feedback.ts
new file mode 100644
index 0000000..c876927
--- /dev/null
+++ b/src/voice/feedback.ts
@@ -0,0 +1,196 @@
+import type { ContentPreferences, HookStyle } from '../config/schema.js';
+import type { EditAnalysis, VoicePost } from './storage.js';
+import { computeEditRatio, sharedTokenCount, tokenize } from './similarity.js';
+
+const HASHTAG_REGEX = /(?<=^|\s)#[A-Za-z0-9_]+/g;
+const COUNT_WORDS = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']);
+
+export function computeEditAnalysis(post: VoicePost, publishedText: string): EditAnalysis {
+  const aiDraft = post.ai_draft;
+  const hookDraft = extractHook(aiDraft);
+  const hookPublished = extractHook(publishedText);
+  const closingDraft = extractClosing(aiDraft);
+  const closingPublished = extractClosing(publishedText);
+
+  const hookChanged = hasEnoughTokens(hookDraft, hookPublished)
+    ? computeEditRatio(hookDraft, hookPublished) < 0.5
+    : false;
+  const closingChanged = hasEnoughTokens(closingDraft, closingPublished)
+    ? computeEditRatio(closingDraft, closingPublished) < 0.5
+    : false;
+
+  const suggestedHashtags = extractHashtags(aiDraft);
+  const publishedHashtags = new Set(extractHashtags(publishedText).map((tag) => tag.toLowerCase()));
+  const keptSuggestedHashtags = suggestedHashtags.filter((tag) => publishedHashtags.has(tag.toLowerCase())).length;
+
+  const contextTokens = tokenize(post.match_connection ?? '');
+  const industryContextRemoved = (
+    !post.has_industry_context
+    || !post.match_connection
+    || contextTokens.length < 6
+  )
+    ? false
+    : (sharedTokenCount(post.match_connection, publishedText) / Math.max(contextTokens.length, 1)) < 0.5;
+
+  const editRatio = computeEditRatio(aiDraft, publishedText);
+  return {
+    hook_changed: hookChanged,
+    closing_changed: closingChanged,
+    length_delta: publishedText.length - aiDraft.length,
+    hashtags_kept_ratio: keptSuggestedHashtags / Math.max(suggestedHashtags.length, 1),
+    industry_context_removed: industryContextRemoved,
+    edit_type: classifyEditType(editRatio),
+  };
+}
+
+export function classifyHookStyle(text: string): HookStyle {
+  const hook = extractHook(text).trim();
+  const lower = hook.toLowerCase();
+
+  if (hook.endsWith('?')) return 'question';
+  if (/^(\d+|[\d.,]+%)/.test(hook) || [...COUNT_WORDS].some((word) => lower.startsWith(`${word} `))) {
+    return 'statistic';
+  }
+  if (/^(i|we|when i|today i)\b/.test(lower)) return 'anecdote';
+  if (/\b(but|except|turns out|the irony)\b/.test(lower)) return 'contradiction';
+  if (/\b(bug|incident|timeout|error|outage|failed)\b/.test(lower)) return 'problem-first';
+  return 'declarative';
+}
+
+export function deriveContentPreferences(outcomes: VoicePost[], now = new Date()): ContentPreferences {
+  const published = outcomes.filter((post) => post.status === 'published');
+  const latestPublished = published.slice(0, 10);
+  const recentWindowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
+
+  const moduleStats = new Map<string, { published: number; expired: number }>();
+  for (const outcome of outcomes) {
+    if (!outcome.top_module_id) continue;
+    const current = moduleStats.get(outcome.top_module_id) ?? { published: 0, expired: 0 };
+    if (outcome.status === 'published') current.published += 1;
+    if (outcome.status === 'expired') current.expired += 1;
+    moduleStats.set(outcome.top_module_id, current);
+  }
+
+  const preferredModules = [...moduleStats.entries()]
+    .map(([moduleId, stats]) => ({
+      moduleId,
+      publishRate: stats.published / Math.max(stats.published + stats.expired, 1),
+      published: stats.published,
+    }))
+    .filter((entry) => entry.published > 0)
+    .sort((left, right) => right.publishRate - left.publishRate || right.published - left.published)
+    .slice(0, 3)
+    .map((entry) => entry.moduleId);
+
+  const hookStats = new Map<HookStyle, { total: number; changed: number }>();
+  for (const post of latestPublished) {
+    if (!post.edit_analysis) continue;
+    const hookStyle = classifyHookStyle(post.ai_draft);
+    const current = hookStats.get(hookStyle) ?? { total: 0, changed: 0 };
+    current.total += 1;
+    if ((post.edit_analysis['hook_changed'] as boolean | undefined) === true) current.changed += 1;
+    hookStats.set(hookStyle, current);
+  }
+
+  const discouragedHookStyles = [...hookStats.entries()]
+    .filter(([, stats]) => stats.total >= 3 && stats.changed / stats.total >= 0.7)
+    .map(([style]) => style);
+
+  const lengthDeltas = latestPublished
+    .map((post) => post.edit_analysis?.['length_delta'])
+    .filter((value): value is number => typeof value === 'number');
+  const typicalLengthDelta = lengthDeltas.length > 0
+    ? Math.round(lengthDeltas.reduce((sum, value) => sum + value, 0) / lengthDeltas.length)
+    : undefined;
+
+  const recentOutcomes = outcomes.filter((post) => {
+    const timestamp = post.published_at ?? post.created_at;
+    return new Date(timestamp) >= recentWindowStart;
+  });
+  const expiredRate30d = recentOutcomes.length > 0
+    ? recentOutcomes.filter((post) => post.status === 'expired').length / recentOutcomes.length
+    : 0;
+
+  const attemptedContextPosts = published
+    .filter((post) => post.context_status === 'matched' || post.context_status === 'no_match')
+    .slice(0, 5);
+  const matchedContextPosts = attemptedContextPosts.filter((post) => post.context_status === 'matched');
+  const removedCount = matchedContextPosts.filter(
+    (post) => post.edit_analysis?.['industry_context_removed'] === true,
+  ).length;
+  const matchedAverageEditRatio = matchedContextPosts.length > 0
+    ? matchedContextPosts.reduce((sum, post) => sum + (post.edit_ratio ?? 0), 0) / matchedContextPosts.length
+    : 0;
+  const attemptedAverageEditRatio = attemptedContextPosts.length > 0
+    ? attemptedContextPosts.reduce((sum, post) => sum + (post.edit_ratio ?? 0), 0) / attemptedContextPosts.length
+    : 0;
+
+  let industryContextPreference: ContentPreferences['industry_context_preference'] = 'neutral';
+  if (matchedContextPosts.length === 5 && removedCount >= 3) {
+    industryContextPreference = 'avoid';
+  } else if (
+    matchedContextPosts.length === 5
+    && removedCount === 0
+    && matchedAverageEditRatio >= 0.8
+  ) {
+    industryContextPreference = 'prefer';
+  } else if (
+    attemptedContextPosts.length === 5
+    && removedCount === 0
+    && attemptedAverageEditRatio >= 0.8
+  ) {
+    industryContextPreference = 'neutral';
+  }
+

--- src/voice/moves-calculator.ts
diff --git a/src/voice/moves-calculator.ts b/src/voice/moves-calculator.ts
new file mode 100644
index 0000000..513be2c
--- /dev/null
+++ b/src/voice/moves-calculator.ts
@@ -0,0 +1,201 @@
+import { logger } from '../utils/logger.js';
+import type { VoiceProfile } from '../config/schema.js';
+import { DEFAULT_VOICE_PROFILE } from '../config/schema.js';
+import { calibrateMoveProbability } from './dice.js';
+import { MOVES_REGISTRY } from './moves-registry.js';
+import { computeVoiceStage } from './stage.js';
+import type { IVoiceStorage, VoicePost } from './storage.js';
+
+const HASHTAG_REGEX = /(?<=^|\s)#[A-Za-z0-9_]+/g;
+const FIRST_PERSON_OPENING = /^I\s+(shipped|deleted|added|wrote|built|pushed|created|fixed)/im;
+
+export async function refreshVoiceMoves(
+  storage: IVoiceStorage,
+  authorLogin: string,
+): Promise<void> {
+  let stored = await storage.getVoiceProfile(authorLogin);
+  const seedVoice = stored?.voice ?? DEFAULT_VOICE_PROFILE;
+
+  await storage.saveVoiceProfile(authorLogin, seedVoice, 0);
+  stored = await storage.getVoiceProfile(authorLogin);
+
+  const currentVoice = stored?.voice ?? DEFAULT_VOICE_PROFILE;
+  const currentVersion = stored?.version ?? 0;
+  const posts = await storage.getPublishedForMoves(authorLogin);
+  const totalUniquePublished = await storage.countUniquePublished(authorLogin);
+  const stage = computeVoiceStage(totalUniquePublished, !!currentVoice.bootstrap_posts?.length);
+
+  const [linkedinPool, instagramPool, recentOutcomes] = await Promise.all([
+    storage.getPublishedForExposure(authorLogin, 'linkedin'),
+    storage.getPublishedForExposure(authorLogin, 'instagram'),
+    storage.getRecentOutcomes(authorLogin, 20),
+  ]);
+
+  const voiceExamplesPool = {
+    ...(linkedinPool.length > 0 && { linkedin: linkedinPool.map((post) => post.id) }),
+    ...(instagramPool.length > 0 && { instagram: instagramPool.map((post) => post.id) }),
+  };
+
+  const alwaysHashtags = detectAlwaysHashtags(posts);
+  const recentOpeningSequence = recentOutcomes
+    .filter((post) => post.status === 'published' && post.opening_move && post.opening_move !== 'unknown')
+    .slice(0, 5)
+    .map((post) => post.opening_move as string)
+    .reverse();
+
+  if (posts.length < 5) {
+    const updatedVoice: VoiceProfile = {
+      ...currentVoice,
+      voice_stage: stage,
+      voice_examples_pool: voiceExamplesPool,
+      always_hashtags: alwaysHashtags,
+      recent_opening_sequence: recentOpeningSequence,
+      voice_summary: posts.length >= 3
+        ? computeProtoSummary(posts, alwaysHashtags)
+        : currentVoice.voice_summary ?? '',
+    };
+
+    const saved = await storage.saveVoiceProfile(authorLogin, updatedVoice, currentVersion);
+    if (!saved) {
+      logger.warn('voice.moves.refresh_conflict', { tenantId: storage.tenantId, authorLogin, stage });
+      return;
+    }
+
+    logger.info('voice.moves.refresh_skipped', {
+      tenantId: storage.tenantId,
+      authorLogin,
+      reason: 'insufficient_quality_posts_for_moves',
+      quality_filtered_count: posts.length,
+      total_unique_published: totalUniquePublished,
+      stage,
+    });
+    return;
+  }
+
+  if (stage === 'warming') {
+    const updatedVoice: VoiceProfile = {
+      ...currentVoice,
+      voice_stage: stage,
+      voice_examples_pool: voiceExamplesPool,
+      always_hashtags: alwaysHashtags,
+      recent_opening_sequence: recentOpeningSequence,
+      voice_summary: computeProtoSummary(posts, alwaysHashtags),
+    };
+
+    const saved = await storage.saveVoiceProfile(authorLogin, updatedVoice, currentVersion);
+    if (!saved) {
+      logger.warn('voice.moves.refresh_conflict', { tenantId: storage.tenantId, authorLogin, stage });
+      return;
+    }
+
+    logger.info('voice.moves.refreshed', {
+      tenantId: storage.tenantId,
+      authorLogin,
+      stage,
+      moves_count: 0,
+      always_hashtags: alwaysHashtags,
+      pool_size: linkedinPool.length + instagramPool.length,
+      posts_analyzed: posts.length,
+    });
+    return;
+  }
+
+  const newMoves: Record<string, number> = {};
+  for (const move of MOVES_REGISTRY) {
+    if (!move.regex) continue;
+    let matchCount = 0;
+    for (const post of posts) {
+      if (move.regex.test(post.published ?? '')) matchCount++;
+    }
+    const probability = calibrateMoveProbability(matchCount, posts.length);
+    if (probability > 0) newMoves[move.id] = probability;
+  }
+
+  const smoothed: Record<string, number> = {};
+  if (currentVoice.voice_moves) {
+    for (const [moveId, newProb] of Object.entries(newMoves)) {
+      const oldProb = currentVoice.voice_moves[moveId] ?? newProb;
+      smoothed[moveId] = Math.round((0.6 * oldProb + 0.4 * newProb) * 20) / 20;
+    }
+  } else {
+    Object.assign(smoothed, newMoves);
+  }
+
+  const updatedVoice: VoiceProfile = {
+    ...currentVoice,
+    voice_moves: smoothed,
+    voice_stage: stage,
+    voice_examples_pool: voiceExamplesPool,
+    always_hashtags: alwaysHashtags,
+    recent_opening_sequence: recentOpeningSequence,
+    voice_summary: computeVoiceSummary(smoothed),
+  };
+
+  const saved = await storage.saveVoiceProfile(authorLogin, updatedVoice, currentVersion);
+  if (!saved) {
+    logger.warn('voice.moves.refresh_conflict', { tenantId: storage.tenantId, authorLogin, stage });
+    return;
+  }
+
+  logger.info('voice.moves.refreshed', {
+    tenantId: storage.tenantId,
+    authorLogin,
+    stage,
+    moves_count: Object.keys(smoothed).length,

--- src/voice/moves-registry.ts
diff --git a/src/voice/moves-registry.ts b/src/voice/moves-registry.ts
new file mode 100644
index 0000000..b161b38
--- /dev/null
+++ b/src/voice/moves-registry.ts
@@ -0,0 +1,336 @@
+export type MoveCategory =
+  | 'rhythm'
+  | 'lexical'
+  | 'opening'
+  | 'structural'
+  | 'emphasis'
+  | 'closing'
+  | 'rhetorical'
+  | 'meta';
+
+export interface MoveDefinition {
+  id: string;
+  regex?: RegExp;
+  category: MoveCategory;
+  description: string;
+  example?: string;
+  negative_example?: string;
+}
+
+export const MOVES_REGISTRY: MoveDefinition[] = [
+  {
+    id: 'very_single',
+    regex: /\bvery\s+\w+[.!]/i,
+    category: 'rhythm',
+    description: "'Very X.' as standalone ironic intensifier",
+    example: 'Very slow. Very necessary.',
+    negative_example: "It was very interesting to see",
+  },
+  {
+    id: 'very_paired',
+    regex: /\bvery\s+\w+[.\s,]+very\s+\w+/i,
+    category: 'rhythm',
+    description: "'Very X. Very Y.' paired adjective rhythm for contrast",
+    example: 'Very clean. Very new.',
+  },
+  {
+    id: 'triple_cadence',
+    regex: /(?:^|\.\s+)([A-Z][^.]{3,30}\.)\s+([A-Z][^.]{3,30}\.)\s+([A-Z][^.]{3,30}\.)/m,
+    category: 'rhythm',
+    description: 'Three short declarative sentences in a row (X. Y. Z.)',
+    example: 'It compiled. It deployed. It broke.',
+  },
+  {
+    id: 'em_dash_rhythm',
+    regex: /—/,
+    category: 'rhythm',
+    description: 'Em-dash for parenthetical or dramatic pause',
+    example: 'The fix was obvious — in retrospect.',
+  },
+  {
+    id: 'semicolon_join',
+    regex: /;\s+[a-z]/,
+    category: 'rhythm',
+    description: 'Semicolon joining two independent clauses',
+    example: "The test passed; the deploy didn't.",
+  },
+  {
+    id: 'parenthetical_aside',
+    regex: /\([^)]{10,80}\)/,
+    category: 'rhythm',
+    description: 'Parenthetical aside or self-correction',
+    example: 'I shipped the fix (or what I thought was the fix).',
+  },
+  {
+    id: 'ellipsis_pause',
+    regex: /\.\.\./,
+    category: 'rhythm',
+    description: 'Ellipsis for trailing thought or dramatic pause',
+    example: 'I checked the logs and...',
+  },
+  {
+    id: 'frankly_adverb',
+    regex: /\bfrankly\b/i,
+    category: 'lexical',
+    description: "'Frankly' as self-aware conversational adverb",
+    example: 'Frankly, I expected it to break.',
+  },
+  {
+    id: 'exactly_emphasis',
+    regex: /\bexactly\b/i,
+    category: 'lexical',
+    description: "'Exactly' to pin down a precise point",
+    example: 'That is exactly the problem.',
+  },
+  {
+    id: 'beautiful_intensifier',
+    regex: /\bbeautiful\b/i,
+    category: 'lexical',
+    description: "'Beautiful' as intensifier for technical elegance",
+    example: 'A beautiful abstraction.',
+  },
+  {
+    id: 'incredible_reaction',
+    regex: /\bincredible\b/i,
+    category: 'lexical',
+    description: "'Incredible' as genuine reaction word",
+    example: 'The performance improvement was incredible.',
+  },
+  {
+    id: 'literally_emphasis',
+    regex: /\bliterally\b/i,
+    category: 'lexical',
+    description: "'Literally' for emphasis (often hyperbolic)",
+    example: 'It literally took 3 days.',
+  },
+  {
+    id: 'spoiler_tag',
+    regex: /\bspoiler\b/i,
+    category: 'lexical',
+    description: "'Spoiler:' as casual foreshadowing device",
+    example: "Spoiler: it didn't work.",
+  },
+  {
+    id: 'self_deprecating_word',
+    regex: /\b(wrong|mistake|broke|failed|embarrassing|humiliating|stupid)\b/i,
+    category: 'lexical',
+    description: 'Self-deprecating vocabulary (owning failure)',
+    example: 'I was completely wrong about the architecture.',
+  },
+  {
+    id: 'trump_cadence',
+    regex: /\b(tremendous|believe me|many people|nobody|everybody knows)\b/i,
+    category: 'lexical',
+    description: 'Hyperbolic intensifiers in the Trump style (ironic or playful)',
+    example: 'Tremendous improvement. Believe me.',
+  },
+  {
+    id: 'sound_like_me',
+    regex: /\bsound(s)?\s+like\s+me\b/i,
+    category: 'lexical',
+    description: "'Sound(s) like me' as meta-voice reference",
+    example: "That doesn't sound like me at all.",
+  },
+  {
+    id: 'opens_with_number',
+    regex: /^[\d,]+\s+(lines?|files?|commits?|decisions?|hours?|days?|minutes?)/im,
+    category: 'opening',
+    description: 'Opens with a numeric count (lines added, hours spent)',
+    example: '313 lines added. Zero removed.',
+    negative_example: 'I spent 3 hours debugging',
+  },
+  {
+    id: 'opens_first_person_action',
+    regex: /^I\s+(shipped|deleted|added|wrote|built|pushed|created|fixed|removed|broke|deployed|refactored)/im,

--- src/voice/profile-utils.ts
diff --git a/src/voice/profile-utils.ts b/src/voice/profile-utils.ts
new file mode 100644
index 0000000..da9aae2
--- /dev/null
+++ b/src/voice/profile-utils.ts
@@ -0,0 +1,72 @@
+import type { Finding } from '../analysis/types.js';
+import { DEFAULT_VOICE_PROFILE, type VoiceProfile } from '../config/schema.js';
+import type { EnrichedCommit } from '../github/commit-enricher.js';
+
+export function mergeVoiceProfile(profile: VoiceProfile | null | undefined): VoiceProfile {
+  if (!profile) return DEFAULT_VOICE_PROFILE;
+  return {
+    ...DEFAULT_VOICE_PROFILE,
+    ...profile,
+    content_strategy: {
+      ...DEFAULT_VOICE_PROFILE.content_strategy,
+      ...profile.content_strategy,
+    },
+    post_length: {
+      ...DEFAULT_VOICE_PROFILE.post_length,
+      ...profile.post_length,
+    },
+  };
+}
+
+export function resolvePromptTier(voiceProfile: VoiceProfile): 1 | 2 | 3 {
+  if (voiceProfile.style_patterns || voiceProfile.voice_devices) return 1;
+  return hasManualVoiceSignal(voiceProfile) ? 2 : 3;
+}
+
+function hasManualVoiceSignal(voiceProfile: VoiceProfile): boolean {
+  return (
+    voiceProfile.tone !== DEFAULT_VOICE_PROFILE.tone
+    || voiceProfile.rhythm !== DEFAULT_VOICE_PROFILE.rhythm
+    || voiceProfile.hashtags.length > 0
+    || voiceProfile.hashtags_mode !== DEFAULT_VOICE_PROFILE.hashtags_mode
+    || voiceProfile.post_length.min !== DEFAULT_VOICE_PROFILE.post_length.min
+    || voiceProfile.post_length.max !== DEFAULT_VOICE_PROFILE.post_length.max
+    || (voiceProfile.content_strategy.focus_modules?.length ?? 0) > 0
+    || voiceProfile.content_strategy.audience !== DEFAULT_VOICE_PROFILE.content_strategy.audience
+    || voiceProfile.content_strategy.skip_patterns.length > 0
+  );
+}
+
+export function filterFindingsByContentStrategy(
+  findings: Finding[],
+  voiceProfile: VoiceProfile,
+): Finding[] {
+  const focus = voiceProfile.content_strategy.focus_modules;
+  if (!focus || focus.length === 0) return findings;
+  const focusSet = new Set(focus);
+  return findings.filter((finding) => focusSet.has(finding.moduleId));
+}
+
+export function matchesSkipPatterns(
+  commit: EnrichedCommit,
+  findings: Finding[],
+  voiceProfile: VoiceProfile,
+): string | null {
+  const skipPatterns = voiceProfile.content_strategy.skip_patterns
+    .map((pattern) => pattern.trim().toLowerCase())
+    .filter(Boolean);
+  if (skipPatterns.length === 0) return null;
+
+  const haystack = [
+    commit.repo,
+    commit.message,
+    ...findings.flatMap((finding) => [
+      finding.finding,
+      finding.plainLanguage,
+      finding.contextHint ?? '',
+      finding.technicalDetail,
+    ]),
+  ].join('\n').toLowerCase();
+
+  return skipPatterns.find((pattern) => haystack.includes(pattern)) ?? null;
+}


--- src/voice/similarity.ts
diff --git a/src/voice/similarity.ts b/src/voice/similarity.ts
index 0f8eab9..2334119 100644
--- a/src/voice/similarity.ts
+++ b/src/voice/similarity.ts
@@ -6,8 +6,8 @@
  * Simple, fast, and language-agnostic.
  */
 export function computeEditRatio(draft: string, published: string): number {
-  const draftWords = tokenize(draft);
-  const publishedWords = tokenize(published);
+  const draftWords = tokenize(textOrEmpty(draft));
+  const publishedWords = tokenize(textOrEmpty(published));
 
   if (draftWords.length === 0 && publishedWords.length === 0) return 1.0;
   if (draftWords.length === 0 || publishedWords.length === 0) return 0.0;
@@ -32,10 +32,36 @@ export function computeEditRatio(draft: string, published: string): number {
   return shared / maxWords;
 }
 
-function tokenize(text: string): string[] {
+export function tokenize(text: string): string[] {
   return text
     .toLowerCase()
     .replace(/[^a-z0-9áéíóúñü\s]/g, ' ')
     .split(/\s+/)
     .filter(w => w.length > 0);
 }
+
+export function sharedTokenCount(left: string, right: string): number {
+  const leftWords = tokenize(textOrEmpty(left));
+  const rightWords = tokenize(textOrEmpty(right));
+  const leftMap = new Map<string, number>();
+
+  for (const word of leftWords) {
+    leftMap.set(word, (leftMap.get(word) ?? 0) + 1);
+  }
+
+  let shared = 0;
+  const rightMap = new Map<string, number>();
+  for (const word of rightWords) {
+    rightMap.set(word, (rightMap.get(word) ?? 0) + 1);
+  }
+
+  for (const [word, count] of rightMap) {
+    shared += Math.min(count, leftMap.get(word) ?? 0);
+  }
+
+  return shared;
+}
+
+function textOrEmpty(value: string): string {
+  return value ?? '';
+}


--- src/voice/sqlite-storage.ts
diff --git a/src/voice/sqlite-storage.ts b/src/voice/sqlite-storage.ts
index 4670180..43fec1f 100644
--- a/src/voice/sqlite-storage.ts
+++ b/src/voice/sqlite-storage.ts
@@ -2,6 +2,7 @@ import Database from 'better-sqlite3';
 import { randomUUID } from 'crypto';
 import { mkdirSync } from 'fs';
 import { dirname } from 'path';
+import { DEFAULT_VOICE_PROFILE, VoiceProfileSchema, type VoiceProfile } from '../config/schema.js';
 import type {
   IVoiceStorage,
   VoicePost,
@@ -11,9 +12,57 @@ import type {
   UpdateEngagementInput,
   Platform,
   PostStatus,
+  RecentTopFinding,
   SlottedPost,
+  StoredVoiceProfile,
 } from './storage.js';
 
+interface SqliteVoiceProfileRow {
+  id: string;
+  github_author_login: string | null;
+  voice: string;
+  version: number;
+}
+
+type SqliteVoicePostRow = Omit<VoicePost, 'edit_analysis' | 'has_industry_context'> & {
+  edit_analysis: string | null;
+  has_industry_context: number;
+};
+
+function normalizeVoiceProfile(candidate: unknown): VoiceProfile | null {
+  const parsed = VoiceProfileSchema.safeParse(candidate);
+  if (!parsed.success) return null;
+  return {
+    ...DEFAULT_VOICE_PROFILE,
+    ...parsed.data,
+    content_strategy: {
+      ...DEFAULT_VOICE_PROFILE.content_strategy,
+      ...parsed.data.content_strategy,
+    },
+    post_length: {
+      ...DEFAULT_VOICE_PROFILE.post_length,
+      ...parsed.data.post_length,
+    },
+  };
+}
+
+function mapVoicePost(row: SqliteVoicePostRow): VoicePost {
+  let editAnalysis: Record<string, unknown> | null = null;
+  if (row.edit_analysis) {
+    try {
+      editAnalysis = JSON.parse(row.edit_analysis) as Record<string, unknown>;
+    } catch {
+      editAnalysis = null;
+    }
+  }
+
+  return {
+    ...row,
+    edit_analysis: editAnalysis,
+    has_industry_context: !!row.has_industry_context,
+  };
+}
+
 export class SqliteStorage implements IVoiceStorage {
   private readonly db: Database.Database;
   readonly tenantId: string;
@@ -57,6 +106,8 @@ export class SqliteStorage implements IVoiceStorage {
         reactions_count INTEGER NOT NULL DEFAULT 0,
         engagement_score REAL,
         publish_source  TEXT,
+        generation_system TEXT,
+        opening_move    TEXT,
         tenant_id       TEXT
       );
 
@@ -74,11 +125,31 @@ export class SqliteStorage implements IVoiceStorage {
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection     TEXT;
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at TEXT;
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source   TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS generation_system TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS opening_move     TEXT;
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS tenant_id        TEXT;
 
       CREATE UNIQUE INDEX IF NOT EXISTS idx_sha_platform
         ON voice_posts(commit_sha, platform);
 
+      CREATE TABLE IF NOT EXISTS voice_profiles (
+        id                 TEXT PRIMARY KEY,
+        tenant_id          TEXT NOT NULL,
+        github_author_login TEXT,
+        voice              TEXT NOT NULL DEFAULT '{}',
+        version            INTEGER NOT NULL DEFAULT 1,
+        created_at         TEXT NOT NULL DEFAULT (datetime('now')),
+        updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
+      );
+
+      CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_default
+        ON voice_profiles(tenant_id)
+        WHERE github_author_login IS NULL;
+
+      CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_author
+        ON voice_profiles(tenant_id, github_author_login)
+        WHERE github_author_login IS NOT NULL;
+
       CREATE TABLE IF NOT EXISTS scheduled_slots (
         id            TEXT PRIMARY KEY,
         platform      TEXT NOT NULL,
@@ -110,9 +181,9 @@ export class SqliteStorage implements IVoiceStorage {
       INSERT INTO voice_posts (
         id, commit_sha, repo, platform, ai_draft, top_finding, top_module_id, findings_count,
         author_login, context_status, has_industry_context, matched_article_id, matched_source_id,
-        match_strength, match_connection, status, tenant_id
+        match_strength, match_connection, generation_system, opening_move, status, tenant_id
       )
-      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
+      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
     `).run(
       id,
       input.commit_sha,
@@ -129,11 +200,71 @@ export class SqliteStorage implements IVoiceStorage {
       input.matched_source_id ?? null,
       input.match_strength ?? null,
       input.match_connection ?? null,
+      input.generation_system ?? null,
+      input.opening_move ?? null,
       this.tenantId,
     );
     return Promise.resolve(id);
   }
 
+  getVoiceProfile(authorLogin: string | null): Promise<StoredVoiceProfile | null> {
+    const exact = this.fetchVoiceProfileRow(authorLogin);
+    if (exact) {
+      return Promise.resolve({
+        voice: normalizeVoiceProfile(JSON.parse(exact.voice)) ?? DEFAULT_VOICE_PROFILE,
+        version: exact.version,
+      });
+    }
+
+    if (authorLogin) {
+      const fallback = this.fetchVoiceProfileRow(null);
+      if (fallback) {
+        return Promise.resolve({
+          voice: normalizeVoiceProfile(JSON.parse(fallback.voice)) ?? DEFAULT_VOICE_PROFILE,
+          version: fallback.version,
+        });

--- src/voice/stage.ts
diff --git a/src/voice/stage.ts b/src/voice/stage.ts
new file mode 100644
index 0000000..7882bbd
--- /dev/null
+++ b/src/voice/stage.ts
@@ -0,0 +1,8 @@
+import type { VoiceStage } from './storage.js';
+
+export function computeVoiceStage(uniquePublishedCount: number, hasBootstrap: boolean): VoiceStage {
+  if (uniquePublishedCount >= 15) return 'established';
+  if (uniquePublishedCount >= 5) return 'warming';
+  if (hasBootstrap) return 'bootstrap';
+  return 'cold';
+}


--- src/voice/storage.ts
diff --git a/src/voice/storage.ts b/src/voice/storage.ts
index a5cf513..2c23076 100644
--- a/src/voice/storage.ts
+++ b/src/voice/storage.ts
@@ -1,7 +1,24 @@
+import type { BootstrapPost, ContentStrategy, HookStyle, VoiceProfile } from '../config/schema.js';
+
 export type Platform = 'linkedin' | 'instagram';
-export type PostStatus = 'pending' | 'scheduled' | 'published' | 'queued';
+export type PostStatus = 'pending' | 'scheduled' | 'published' | 'queued' | 'expired' | 'failed';
 export type ContextStatus = 'skipped' | 'no_match' | 'matched';
 export type PublishSource = 'buffer' | 'linkedin_direct';
+export type VoiceStage = 'cold' | 'bootstrap' | 'warming' | 'established';
+
+export interface StoredVoiceProfile {
+  voice: VoiceProfile;
+  version: number;
+}
+
+export interface EditAnalysis {
+  hook_changed: boolean;
+  closing_changed: boolean;
+  length_delta: number;
+  hashtags_kept_ratio: number;
+  industry_context_removed: boolean;
+  edit_type: 'polish' | 'restructure' | 'rewrite';
+}
 
 export interface VoicePost {
   id: string;
@@ -32,6 +49,8 @@ export interface VoicePost {
   last_reactions_fetch_at: string | null;
   engagement_score: number | null;
   publish_source: PublishSource | null;
+  generation_system?: 'v1' | 'v2_progressive' | null;
+  opening_move?: string | null;
 }
 
 export interface SaveDraftInput {
@@ -49,6 +68,8 @@ export interface SaveDraftInput {
   matched_source_id?: string | null;
   match_strength?: number | null;
   match_connection?: string | null;
+  generation_system?: 'v1' | 'v2_progressive' | null;
+  opening_move?: string | null;
 }
 
 export interface UpdatePublishedInput {
@@ -56,6 +77,7 @@ export interface UpdatePublishedInput {
   published: string;
   edit_ratio: number;
   published_at: string;
+  edit_analysis?: EditAnalysis | null;
   linkedin_urn?: string;  // extracted from Buffer externalLink when available
   publish_source?: PublishSource;
 }
@@ -80,6 +102,11 @@ export interface SlottedPost {
   voice_post_id: string;
 }
 
+export interface RecentTopFinding {
+  top_finding: string;
+  published_at: string;
+}
+
 export interface IVoiceStorage {
   /** The tenant this storage instance is scoped to. All queries filter by this. */
   readonly tenantId: string;
@@ -87,6 +114,12 @@ export interface IVoiceStorage {
   /** Save an AI draft immediately after generation. Returns the new row ID. */
   saveDraft(input: SaveDraftInput): Promise<string>;
 
+  /** Lookup voice profile for a specific author, falling back to tenant default row only. */
+  getVoiceProfile(authorLogin: string | null): Promise<StoredVoiceProfile | null>;
+
+  /** Insert or update a voice profile row scoped to a specific author or tenant default. */
+  saveVoiceProfile(authorLogin: string | null, voice: VoiceProfile, expectedVersion?: number): Promise<boolean>;
+
   /** Update a post after Buffer publishes it (voice loop feedback). */
   updatePublished(input: UpdatePublishedInput): Promise<void>;
 
@@ -108,6 +141,35 @@ export interface IVoiceStorage {
   /** Get most recent published posts across all platforms, sorted by published_at DESC. */
   getRecentPublished(limit: number): Promise<VoicePost[]>;
 
+  /** Get recent published posts for one author/platform and quality threshold. */
+  getPublishedForAuthor(
+    authorLogin: string,
+    platform: Platform,
+    limit: number,
+    minEditRatio?: number,
+  ): Promise<VoicePost[]>;
+
+  /** Exposure pool query: per-platform, published-only, edit_ratio >= 0.30, deduped by published prefix. */
+  getPublishedForExposure(authorLogin: string, platform: Platform): Promise<VoicePost[]>;
+
+  /** Move-measurement query: cross-platform, published-only, edit_ratio >= 0.30, deduped by published prefix. */
+  getPublishedForMoves(authorLogin: string): Promise<VoicePost[]>;
+
+  /** Get recent top_finding texts for chapter context. */
+  getRecentTopFindings(authorLogin: string | null, moduleId: string, limit: number): Promise<RecentTopFinding[]>;
+
+  /** Get recent outcomes for one author across published/expired rows. */
+  getRecentOutcomes(authorLogin: string, limit: number): Promise<VoicePost[]>;
+
+  /** Count drafts for one author created after the provided ISO timestamp. */
+  countDraftsSince(authorLogin: string, sinceIso: string): Promise<number>;
+
+  /** Count unique published texts for an author, optionally scoped to one platform. */
+  countUniquePublished(authorLogin: string, platform?: Platform): Promise<number>;
+
+  /** Enumerate authors that should be processed by the scanner. */
+  listActiveAuthors(days: number): Promise<string[]>;
+
   /** Check if a commit SHA + platform already has a processed post. */
   hasDraft(commit_sha: string, platform: Platform): Promise<boolean>;
 
@@ -123,9 +185,19 @@ export interface IVoiceStorage {
   /** Get scheduled posts that haven't been matched to a published post yet (for voice loop). */
   getScheduledUnpublished(platform: Platform): Promise<VoicePost[]>;
 
+  /** Mark one or more scheduled rows as expired. */
+  markExpired(ids: string[]): Promise<void>;
+
   /** Claim a scheduling slot atomically. Returns false if slot already taken. */
   claimSlot(slot: SlottedPost): Promise<boolean>;
 
   /** Get all taken slots for a platform on a given day (UTC date string YYYY-MM-DD). */
   getTakenSlots(platform: Platform, dayUtc: string): Promise<Date[]>;
 }
+
+export type {
+  BootstrapPost,
+  ContentStrategy,
+  HookStyle,
+  VoiceProfile,
+};


--- src/voice/supabase-storage.ts
diff --git a/src/voice/supabase-storage.ts b/src/voice/supabase-storage.ts
index ba3de9a..a4b7c87 100644
--- a/src/voice/supabase-storage.ts
+++ b/src/voice/supabase-storage.ts
@@ -1,4 +1,5 @@
 import { createClient, type SupabaseClient } from '@supabase/supabase-js';
+import { DEFAULT_VOICE_PROFILE, VoiceProfileSchema, type VoiceProfile } from '../config/schema.js';
 import type {
   IVoiceStorage,
   VoicePost,
@@ -8,9 +9,35 @@ import type {
   UpdateEngagementInput,
   Platform,
   PostStatus,
+  RecentTopFinding,
   SlottedPost,
+  StoredVoiceProfile,
 } from './storage.js';
 
+interface VoiceProfileRow {
+  id: string;
+  github_author_login: string | null;
+  voice: unknown;
+  version: number;
+}
+
+function normalizeVoiceProfile(candidate: unknown): VoiceProfile | null {
+  const parsed = VoiceProfileSchema.safeParse(candidate);
+  if (!parsed.success) return null;
+  return {
+    ...DEFAULT_VOICE_PROFILE,
+    ...parsed.data,
+    content_strategy: {
+      ...DEFAULT_VOICE_PROFILE.content_strategy,
+      ...parsed.data.content_strategy,
+    },
+    post_length: {
+      ...DEFAULT_VOICE_PROFILE.post_length,
+      ...parsed.data.post_length,
+    },
+  };
+}
+
 export class SupabaseStorage implements IVoiceStorage {
   private readonly db: SupabaseClient;
   readonly tenantId: string;
@@ -38,6 +65,8 @@ export class SupabaseStorage implements IVoiceStorage {
         matched_source_id: input.matched_source_id ?? null,
         match_strength: input.match_strength ?? null,
         match_connection: input.match_connection ?? null,
+        generation_system: input.generation_system ?? null,
+        opening_move: input.opening_move ?? null,
         status: 'pending' satisfies PostStatus,
         tenant_id: this.tenantId,
       })
@@ -55,6 +84,7 @@ export class SupabaseStorage implements IVoiceStorage {
         published: input.published,
         edit_ratio: input.edit_ratio,
         published_at: input.published_at,
+        ...(input.edit_analysis !== undefined && { edit_analysis: input.edit_analysis }),
         status: 'published' satisfies PostStatus,
         ...(input.linkedin_urn !== undefined && { linkedin_urn: input.linkedin_urn }),
         ...(input.publish_source !== undefined && { publish_source: input.publish_source }),
@@ -86,6 +116,69 @@ export class SupabaseStorage implements IVoiceStorage {
     if (error) throw new Error(`markQueued failed: ${error.message}`);
   }
 
+  async getVoiceProfile(authorLogin: string | null): Promise<StoredVoiceProfile | null> {
+    const exact = await this.fetchVoiceProfileRow(authorLogin);
+    if (exact) {
+      return {
+        voice: normalizeVoiceProfile(exact.voice) ?? DEFAULT_VOICE_PROFILE,
+        version: exact.version,
+      };
+    }
+
+    if (authorLogin) {
+      const fallback = await this.fetchVoiceProfileRow(null);
+      if (fallback) {
+        return {
+          voice: normalizeVoiceProfile(fallback.voice) ?? DEFAULT_VOICE_PROFILE,
+          version: fallback.version,
+        };
+      }
+    }
+
+    const legacy = await this.loadLegacyVoiceProfile();
+    if (!legacy) return null;
+
+    await this.saveVoiceProfile(null, legacy.voice, legacy.version);
+    return legacy;
+  }
+
+  async saveVoiceProfile(authorLogin: string | null, voice: VoiceProfile, expectedVersion?: number): Promise<boolean> {
+    const normalized = normalizeVoiceProfile(voice) ?? DEFAULT_VOICE_PROFILE;
+    const existing = await this.fetchVoiceProfileRow(authorLogin);
+
+    if (!existing) {
+      if (expectedVersion !== undefined && expectedVersion !== 0) return false;
+
+      const { error } = await this.db
+        .from('voice_profiles')
+        .insert({
+          tenant_id: this.tenantId,
+          github_author_login: authorLogin,
+          voice: normalized,
+          version: 1,
+        });
+
+      if (error) throw new Error(`saveVoiceProfile insert failed: ${error.message}`);
+      return true;
+    }
+
+    if (expectedVersion !== undefined && existing.version !== expectedVersion) return false;
+
+    const nextVersion = existing.version + 1;
+    const { error } = await this.db
+      .from('voice_profiles')
+      .update({
+        voice: normalized,
+        version: nextVersion,
+        updated_at: new Date().toISOString(),
+      })
+      .eq('id', existing.id)
+      .eq('version', expectedVersion ?? existing.version);
+
+    if (error) throw new Error(`saveVoiceProfile update failed: ${error.message}`);
+    return true;
+  }
+
   async getTopVoiceExamples(platform: Platform, limit: number): Promise<VoicePost[]> {
     const { data, error } = await this.db
       .from('voice_posts')
@@ -142,6 +235,155 @@ export class SupabaseStorage implements IVoiceStorage {
     return (data ?? []) as VoicePost[];
   }
 
+  async getPublishedForAuthor(
+    authorLogin: string,
+    platform: Platform,
+    limit: number,
+    minEditRatio = 0.7,
+  ): Promise<VoicePost[]> {
+    const { data, error } = await this.db
+      .from('voice_posts')
+      .select('*')
+      .eq('tenant_id', this.tenantId)
+      .eq('author_login', authorLogin)
+      .eq('platform', platform)
+      .eq('status', 'published')

--- src/voice/utils.ts
diff --git a/src/voice/utils.ts b/src/voice/utils.ts
new file mode 100644
index 0000000..aedd208
--- /dev/null
+++ b/src/voice/utils.ts
@@ -0,0 +1,38 @@
+export function hash(input: string): number {
+  let h = 0x811c9dc5;
+  for (let i = 0; i < input.length; i++) {
+    h ^= input.charCodeAt(i);
+    h = Math.imul(h, 0x01000193);
+  }
+  return h >>> 0;
+}
+
+export function seededRandom(seed: number): number {
+  let t = (seed + 0x6d2b79f5) | 0;
+  t = Math.imul(t ^ (t >>> 15), t | 1);
+  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
+  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
+}
+
+export function createRng(seed: number): () => number {
+  let state = seed;
+  return () => {
+    state = (state + 0x6d2b79f5) | 0;
+    let t = Math.imul(state ^ (state >>> 15), state | 1);
+    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
+    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
+  };
+}
+
+export function weightedShuffle<T>(
+  items: Array<{ item: T; weight: number }>,
+  rng: () => number,
+): T[] {
+  return items
+    .map(({ item, weight }) => ({
+      item,
+      sortKey: -Math.log(Math.max(rng(), 0.000001)) / Math.max(weight, 0.001),
+    }))
+    .sort((left, right) => left.sortKey - right.sortKey)
+    .map(({ item }) => item);
+}


--- src/webhook/handlers/onboard.ts
diff --git a/src/webhook/handlers/onboard.ts b/src/webhook/handlers/onboard.ts
index 565f8b5..1032837 100644
--- a/src/webhook/handlers/onboard.ts
+++ b/src/webhook/handlers/onboard.ts
@@ -1,6 +1,9 @@
-import { logger } from '../../utils/logger.js';
 import type { SupabaseClient } from '@supabase/supabase-js';
+import { MODULE_REGISTRY } from '../../analysis/modules/index.js';
+import { DEFAULT_VOICE_PROFILE, VoiceProfileSchema, type VoiceProfile } from '../../config/schema.js';
 import { sealTenantSecrets } from '../../security/tenant-secrets.js';
+import { logger } from '../../utils/logger.js';
+import { mergeVoiceProfile } from '../../voice/profile-utils.js';
 
 interface TenantRow {
   readonly id: string;
@@ -12,12 +15,44 @@ interface TenantRow {
   readonly voice_bootstrap: string | null;
 }
 
+interface VoiceProfileRow {
+  readonly id: string;
+  readonly voice: unknown;
+  readonly version: number;
+}
+
+const MODULE_OPTIONS = MODULE_REGISTRY
+  .map((module) => ({ id: module.id, name: module.name }))
+  .sort((left, right) => left.name.localeCompare(right.name));
+
 function maskToken(token: string | null): string {
   if (!token) return '';
   return 'configured••••••••';
 }
 
-function html(tenant: TenantRow, installationId: number, linkedinClientId: string, appBaseUrl: string, saved: boolean): string {
+function escapeHtml(value: string): string {
+  return value
+    .replaceAll('&', '&amp;')
+    .replaceAll('<', '&lt;')
+    .replaceAll('>', '&gt;')
+    .replaceAll('"', '&quot;')
+    .replaceAll("'", '&#39;');
+}
+
+function checked(value: boolean): string {
+  return value ? 'checked' : '';
+}
+
+function selected(left: string, right: string): string {
+  return left === right ? 'selected' : '';
+}
+
+function html(
+  tenant: TenantRow,
+  installationId: number,
+  voiceProfile: VoiceProfile,
+  saved: boolean,
+): string {
   const cfg = tenant.config;
   const author = (cfg['author'] as Record<string, unknown> | undefined) ?? {};
   const buffer = (cfg['buffer'] as Record<string, unknown> | undefined) ?? {};
@@ -26,10 +61,20 @@ function html(tenant: TenantRow, installationId: number, linkedinClientId: strin
   const website = (author['website'] as string | undefined) ?? '';
   const bufferOrgId = (buffer['organization_id'] as string | undefined) ?? '';
   let voiceParts: string[] = [];
-  try { voiceParts = JSON.parse(tenant.voice_bootstrap ?? '[]') as string[]; } catch { voiceParts = []; }
+  try {
+    voiceParts = JSON.parse(tenant.voice_bootstrap ?? '[]') as string[];
+  } catch {
+    voiceParts = [];
+  }
+
+  const focusModules = new Set(voiceProfile.content_strategy.focus_modules ?? MODULE_OPTIONS.map((module) => module.id));
+  const skipPatterns = voiceProfile.content_strategy.skip_patterns.join('\n');
+  const hashtags = voiceProfile.hashtags.join(' ');
   const voice1 = voiceParts[0] ?? '';
   const voice2 = voiceParts[1] ?? '';
   const voice3 = voiceParts[2] ?? '';
+  const voice4 = voiceParts[3] ?? '';
+  const voice5 = voiceParts[4] ?? '';
 
   const linkedinConnected = !!tenant.linkedin_member_id;
   const linkedinSection = linkedinConnected
@@ -42,6 +87,13 @@ function html(tenant: TenantRow, installationId: number, linkedinClientId: strin
     ? `<div class="banner"><span class="dot"></span>Saved successfully.</div>`
     : '';
 
+  const moduleCheckboxes = MODULE_OPTIONS.map((module) => `
+    <label class="check-card">
+      <input type="checkbox" name="focus_modules" value="${module.id}" ${checked(focusModules.has(module.id))}>
+      <span>${escapeHtml(module.name)}</span>
+    </label>
+  `).join('');
+
   return `<!DOCTYPE html>
 <html lang="en">
 <head>
@@ -58,22 +110,20 @@ function html(tenant: TenantRow, installationId: number, linkedinClientId: strin
     .logo{font-weight:600;font-size:.95rem;letter-spacing:-.02em;color:#fff}
     .account-badge{display:inline-flex;align-items:center;gap:8px;border:1px solid #27272a;background:#18181b;padding:4px 12px;border-radius:9999px;font-size:.75rem;color:#a1a1aa}
     .dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#34d399;flex-shrink:0}
-    main{max-width:480px;margin:48px auto;padding:0 24px 48px}
+    main{max-width:860px;margin:48px auto;padding:0 24px 48px}
     h1{font-size:1.5rem;font-weight:600;color:#fff;letter-spacing:-.02em;margin-bottom:4px}
     .sub{font-size:.875rem;color:#71717a;margin-bottom:32px}
     .banner{display:flex;align-items:center;gap:8px;background:#052e16;border:1px solid #166534;color:#4ade80;padding:10px 14px;border-radius:8px;margin-bottom:24px;font-size:.875rem}
     .card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;margin-bottom:16px}
-    .section-title{font-size:.875rem;font-weight:600;color:#fff;margin-bottom:16px}
+    .section-title{font-size:.95rem;font-weight:600;color:#fff;margin-bottom:16px}
     .optional{color:#52525b;font-weight:400}
     label{display:block;font-size:.8rem;font-weight:500;color:#a1a1aa;margin-bottom:6px}
-    input[type=text],input[type=url]{width:100%;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:8px;font-size:.875rem;color:#f4f4f5;font-family:inherit;margin-bottom:16px;outline:none;transition:border-color .15s}
-    input[type=text]:focus,input[type=url]:focus{border-color:#52525b}
-    input::placeholder{color:#3f3f46}
+    input[type=text],input[type=url],input[type=number],select{width:100%;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:8px;font-size:.875rem;color:#f4f4f5;font-family:inherit;margin-bottom:16px;outline:none;transition:border-color .15s}
+    input[type=text]:focus,input[type=url]:focus,input[type=number]:focus,select:focus,textarea:focus{border-color:#52525b}
+    input::placeholder,textarea::placeholder{color:#3f3f46}
+    textarea{width:100%;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:8px;font-size:.875rem;color:#f4f4f5;font-family:inherit;margin-bottom:16px;outline:none;transition:border-color .15s;resize:vertical}
     .hint{font-size:.75rem;color:#52525b;margin-top:-12px;margin-bottom:16px}
     .hint-card{font-size:.75rem;color:#52525b;margin-top:10px}
-    textarea{width:100%;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:8px;font-size:.875rem;color:#f4f4f5;font-family:inherit;margin-bottom:16px;outline:none;transition:border-color .15s;resize:vertical}
-    textarea:focus{border-color:#52525b}
-    textarea::placeholder{color:#3f3f46}
     .btn-primary{background:#fff;color:#09090b;border:none;padding:9px 20px;border-radius:8px;font-size:.875rem;font-weight:500;cursor:pointer;font-family:inherit;transition:background .15s}
     .btn-primary:hover{background:#e4e4e7}
     .btn-linkedin{display:inline-flex;align-items:center;gap:8px;background:#0077B5;color:#fff;padding:9px 20px;border-radius:8px;font-size:.875rem;font-weight:500;text-decoration:none;transition:background .15s}
@@ -81,47 +131,125 @@ function html(tenant: TenantRow, installationId: number, linkedinClientId: strin
     .connected{display:inline-flex;align-items:center;gap:6px;color:#34d399;font-size:.875rem;font-weight:500}
     .link-small{font-size:.8rem;color:#52525b;text-decoration:none;margin-left:12px;transition:color .15s}
     .link-small:hover{color:#a1a1aa}
+    .module-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:12px 0 16px}
+    .check-card{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #27272a;border-radius:10px;background:#09090b;color:#d4d4d8}
+    .check-card input{margin:0}
+    .radio-row{display:flex;flex-wrap:wrap;gap:12px;margin:8px 0 16px}
+    .radio-pill{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #27272a;border-radius:9999px;background:#09090b;color:#d4d4d8}
+    .split{display:grid;grid-template-columns:1fr 1fr;gap:16px}
+    @media (max-width: 720px){main{padding:0 16px 40px}.split{grid-template-columns:1fr}}
   </style>
 </head>
 <body>
   <nav>
     <span style="display:inline-flex;align-items:center;gap:8px"><img src="/favicon.png" alt="" style="height:20px;border-radius:4px"><span class="logo">devcast</span></span>
-    <span class="account-badge"><span class="dot"></span>${tenant.github_username}</span>
+    <span class="account-badge"><span class="dot"></span>${escapeHtml(tenant.github_username)}</span>
   </nav>
   <main>
     <h1>Setup</h1>
-    <p class="sub">Configure how devcast generates posts for you.</p>
+    <p class="sub">Configure what devcast publishes, how it sounds, and the examples it should learn from.</p>
     ${banner}

--- src/webhook/server.ts
diff --git a/src/webhook/server.ts b/src/webhook/server.ts
index 0f8099d..8ed1bea 100644
--- a/src/webhook/server.ts
+++ b/src/webhook/server.ts
@@ -57,7 +57,7 @@ const server = createServer((req, res) => {
   }
 
   // Onboarding page
-  if (req.method === 'GET' && path === '/onboard') {
+  if (req.method === 'GET' && (path === '/onboard' || path === '/settings/voice')) {
     const installationId = parseInt(query.get('installation_id') ?? '', 10);
     const saved = query.get('saved') === '1';
     if (isNaN(installationId)) {
@@ -79,7 +79,7 @@ const server = createServer((req, res) => {
   }
 
   // Onboarding form submission
-  if (req.method === 'POST' && path === '/onboard') {
+  if (req.method === 'POST' && (path === '/onboard' || path === '/settings/voice')) {
     const chunks: Buffer[] = [];
     req.on('data', (chunk: Buffer) => chunks.push(chunk));
     req.on('end', () => {


--- src/worker/process-job.ts
diff --git a/src/worker/process-job.ts b/src/worker/process-job.ts
index 22ae3f8..f9a2b82 100644
--- a/src/worker/process-job.ts
+++ b/src/worker/process-job.ts
@@ -7,6 +7,7 @@ import { runPipeline } from '../analysis/pipeline.js';
 import { MODULE_REGISTRY } from '../analysis/modules/index.js';
 import { createAIClient, createEmbedder } from '../ai/factory.js';
 import { generatePosts } from '../ai/post-generator.js';
+import { buildChapterContext, buildVarietyConstraint } from '../ai/prompt-builder.js';
 import { matchFindingsToArticles } from '../content/matcher.js';
 import { BufferClient } from '../buffer/client.js';
 import { publishToBuffer } from '../buffer/publisher.js';
@@ -18,6 +19,8 @@ import { ConfigSchema } from '../config/schema.js';
 import type { Config } from '../config/schema.js';
 import type { SaveDraftInput } from '../voice/storage.js';
 import { resolveTenantSecrets } from '../security/tenant-secrets.js';
+import { filterFindingsByContentStrategy, matchesSkipPatterns, mergeVoiceProfile } from '../voice/profile-utils.js';
+import { computeVoiceStage } from '../voice/stage.js';
 
 interface TenantRow {
   readonly id: string;
@@ -178,7 +181,7 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
       }
 
       const recentModuleIds = await storage.getRecentModuleIds(30);
-      const findings = await runPipeline(
+      const pipelineFindings = await runPipeline(
         {
           diffs: commit.diffs,
           commitMessage: commit.message,
@@ -191,45 +194,150 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
         recentModuleIds,
       );
 
-      if (findings.length === 0) {
+      if (pipelineFindings.length === 0) {
         logger.info('worker.commit.skip.no_findings', { sha: commit.sha });
         continue;
       }
 
+      const storedVoiceProfile = await storage.getVoiceProfile(commit.authorLogin ?? null);
+      const voiceProfile = mergeVoiceProfile(storedVoiceProfile?.voice);
+      const authorLogin = commit.authorLogin ?? null;
+      const uniquePublished = authorLogin ? await storage.countUniquePublished(authorLogin) : 0;
+      const hasBootstrap = (voiceProfile.bootstrap_posts?.length ?? 0) > 0;
+      const voiceStage = computeVoiceStage(uniquePublished, hasBootstrap);
+      const startOfDay = new Date();
+      startOfDay.setUTCHours(0, 0, 0, 0);
+      const todayStartIso = startOfDay.toISOString();
+      const draftsToday = authorLogin ? await storage.countDraftsSince(authorLogin, todayStartIso) : 0;
+      const findings = filterFindingsByContentStrategy(pipelineFindings, voiceProfile);
+
+      if (findings.length === 0) {
+        logger.info('worker.commit.skip.no_findings_after_strategy', {
+          sha: commit.sha,
+          focus_modules: voiceProfile.content_strategy.focus_modules ?? [],
+        });
+        continue;
+      }
+
+      const skipPattern = matchesSkipPatterns(commit, findings, voiceProfile);
+      if (skipPattern) {
+        logger.info('worker.commit.skip.content_strategy', { sha: commit.sha, skipPattern });
+        continue;
+      }
+
+      const fireCounts = new Map<string, number>();
+      for (const moduleId of recentModuleIds) {
+        fireCounts.set(moduleId, (fireCounts.get(moduleId) ?? 0) + 1);
+      }
+      const topModuleId = findings[0]?.moduleId;
+      const topModuleFireCount = topModuleId ? (fireCounts.get(topModuleId) ?? 0) : 0;
+
+      if (topModuleFireCount >= 2 && draftsToday > 0) {
+        logger.info('worker.commit.skip.module_saturation', {
+          sha: commit.sha,
+          module: topModuleId,
+          fireCount: topModuleFireCount,
+          draftIndexToday: draftsToday,
+        });
+        continue;
+      }
+
+      let chapterContext: string | undefined;
+      if (topModuleId && topModuleFireCount >= 1) {
+        const previousFindings = await storage.getRecentTopFindings(authorLogin, topModuleId, 2);
+        if (previousFindings.length > 0) {
+          chapterContext = buildChapterContext(topModuleId, previousFindings, topModuleFireCount + 1);
+        }
+      }
+
+      let exposurePool: Awaited<ReturnType<SupabaseStorage['getPublishedForExposure']>> = [];
+      if (authorLogin && voiceStage !== 'cold') {
+        const poolIds = voiceProfile.voice_examples_pool?.['linkedin'];
+        if (poolIds?.length) {
+          const { data, error } = await deps.db
+            .from('voice_posts')
+            .select('*')
+            .in('id', poolIds);
+          if (!error) exposurePool = (data ?? []) as typeof exposurePool;
+        }
+        if (exposurePool.length === 0) {
+          exposurePool = await storage.getPublishedForExposure(authorLogin, 'linkedin');
+        }
+      }
+
+      let todayFirstOpeningMove: string | undefined;
+      if (authorLogin && draftsToday > 0) {
+        const { data } = await deps.db
+          .from('voice_posts')
+          .select('opening_move')
+          .eq('tenant_id', tenant.id)
+          .eq('author_login', authorLogin)
+          .gte('created_at', todayStartIso)
+          .not('opening_move', 'is', null)
+          .order('created_at', { ascending: true })
+          .limit(1);
+        todayFirstOpeningMove = (data?.[0] as { opening_move?: string } | undefined)?.opening_move;
+      }
+
+      const varietyConstraint = voiceStage !== 'cold'
+        ? buildVarietyConstraint(voiceProfile.recent_opening_sequence ?? [], draftsToday, todayFirstOpeningMove) ?? undefined
+        : undefined;
+
       // Content matching — inject industry context when a strong match is found.
       // Graceful degradation: any failure skips context, post generated normally.
       let industryContext: string | undefined;
       let draftMetadata: Partial<SaveDraftInput> = {
-        author_login: commit.authorLogin,
+        author_login: authorLogin,
+        generation_system: voiceStage === 'cold' ? 'v1' : 'v2_progressive',
       };
       if (embedder) {
-        try {
-          const match = await matchFindingsToArticles(findings, embedder, anthropic, deps.db);
-          if (match) {
-            industryContext = `Connection: ${match.connection}`;
-            draftMetadata = {
-              ...draftMetadata,
-              context_status: 'matched',
-              has_industry_context: true,
-              matched_article_id: match.articleId,
-              matched_source_id: match.sourceId,
-              match_strength: match.matchStrength,
-              match_connection: match.connection,
-            };
-            logger.info('content.match.injected', { sha: commit.sha, article: match.articleTitle });
-          } else {
-            draftMetadata = {
-              ...draftMetadata,
```

## Claims a labelar

Opciones: `grounded` | `plausible_unsupported` | `contradicted` | `irrelevant` | `frame`

| # | Claim | Pre-label (LLM) | Tu label | Notas |
|---|-------|-----------------|----------|-------|
| 0 | Four commits, five days, one recurring theme: the pipeline kept lying, and lilicurl kept making it tell the truth. | needs_human | | |
| 1 | It started with the classifier. | needs_human | | |
| 2 | LLM outputs are slippery — markdown leaks in, encoding drifts, JSON comes back malformed or in the wrong shape entirely. | needs_human | | |
| 3 | The fix wasn't to trust the model more, it was to trust it less by design: dual-attempt retry, multi-candidate JSON parsing, cleanup passes before anything downstream touches the result. | needs_human | | |
| 4 | Defensive engineering, not optimism. | needs_human | | |
| 5 | Then seed extraction got the same treatment. | needs_human | | |
| 6 | LinkedIn's CDN apparently responds differently depending on which hostname you knock on, so `www.linkedin.com` joined the fallback host list and retry logic with multiple request profiles got wired in | needs_human | | |
| 7 | The crawler now negotiates, not assumes. | needs_human | | |
| 8 | Phase 3 is where the architecture got genuinely interesting. | needs_human | | |
| 9 | The Haiku-based voice extraction got replaced with statistical move measurement and a 4-stage maturity model. | needs_human | | |
| 10 | Voice isn't something you declare anymore — it's something the system measures, then advances through stages, then samples probabilistically at generation time. | needs_human | | |
| 11 | Behavioral fidelity treated as a distribution problem rather than a template problem. | needs_human | | |
| 12 | Then the last commit closed the loop on output integrity: hard cap at 1500 characters, length-aware truncation with boundary detection so sentences don't get guillotined mid-thought, and explicit anti | needs_human | | |
| 13 | That last one is worth sitting with. | needs_human | | |
| 14 | The system now actively resists a bias it could easily reproduce — the tendency to say "AI did this" when a commit just wired up a constraint, a retry, or a measurement. | needs_human | | |
| 15 | The prompt injection isn't a filter. | needs_human | | |
| 16 | It's an editorial stance, encoded. | needs_human | | |
| 17 | Five days of closing gaps between what the pipeline produced and what it was supposed to produce. | needs_human | | |
| 18 | Every fix earned by something that broke first. | needs_human | | |

## Post-level

- **Publish readiness:** [ ] publish_asis [ ] light_edit [ ] rewrite [ ] discard
- **¿Qué te haría desconfiar del post?** _______
