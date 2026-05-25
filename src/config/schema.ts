import { z } from 'zod';
import { MODULE_REGISTRY } from '../analysis/modules/index.js';

const MODULE_IDS = new Set(MODULE_REGISTRY.map((module) => module.id));

const PlatformConfigSchema = z.object({
  enabled: z.boolean(),
  buffer_profile_id: z.string().default(''),
});

export const AudienceSchema = z.enum(['peers', 'hiring-managers', 'general-tech', 'mixed']);
export const ToneSchema = z.enum(['formal', 'professional', 'casual', 'humorous', 'storytelling', 'teaching']);
export const RhythmSchema = z.enum(['paragraphs', 'mixed', 'short-sentences']);
export const HashtagModeSchema = z.enum(['always', 'prefer']);
export const HookStyleSchema = z.enum([
  'question',
  'statistic',
  'anecdote',
  'declarative',
  'contradiction',
  'problem-first',
]);

export const ContentStrategySchema = z.object({
  focus_modules: z.array(z.string()).optional().refine(
    (modules) => !modules || modules.every((moduleId) => MODULE_IDS.has(moduleId)),
    'focus_modules must reference valid analysis module ids',
  ),
  audience: AudienceSchema.default('mixed'),
  skip_patterns: z.array(z.string()).default([]),
});

export const ContentPreferencesSchema = z.object({
  preferred_modules: z.array(z.string()).optional(),
  discouraged_hook_styles: z.array(HookStyleSchema).optional(),
  typical_length_delta: z.number().optional(),
  industry_context_preference: z.enum(['prefer', 'neutral', 'avoid']).optional(),
  expired_rate_30d: z.number().min(0).max(1).optional(),
  penalized_modules: z.array(z.string()).optional(),
  penalized_arc_types: z.array(z.string()).optional(),
  updated_at: z.string().optional(),
});

export const BootstrapPostSchema = z.object({
  text: z.string().min(1),
  pasted_at: z.string(),
});

const VoiceExamplesPoolSchema = z.object({
  linkedin: z.array(z.string()).optional(),
  instagram: z.array(z.string()).optional(),
});

export const VoiceProfileSchema = z.object({
  tone: ToneSchema.default('professional'),
  rhythm: RhythmSchema.default('mixed'),
  hashtags: z.array(z.string()).max(10).default([]),
  hashtags_mode: HashtagModeSchema.default('prefer'),
  post_length: z.object({
    min: z.number().int().min(300),
    max: z.number().int().max(1500),
  }).refine(({ min, max }) => min < max, 'post_length.min must be lower than post_length.max')
    .default({ min: 1000, max: 1500 }),
  content_strategy: ContentStrategySchema.default({
    audience: 'mixed',
    skip_patterns: [],
  }),
  style_patterns: z.string().max(400).optional(),
  voice_devices: z.string().max(300).optional(),
  voice_summary: z.string().max(200).optional(),
  extraction_source: z.enum(['bootstrap', 'published_posts']).optional(),
  extracted_at: z.string().optional(),
  content_preferences: ContentPreferencesSchema.optional(),
  voice_moves: z.record(z.string(), z.number().min(0).max(1)).optional(),
  voice_stage: z.enum(['cold', 'bootstrap', 'warming', 'established']).optional(),
  voice_examples_pool: VoiceExamplesPoolSchema.optional(),
  always_hashtags: z.array(z.string()).max(10).optional(),
  recent_opening_sequence: z.array(z.string()).max(5).optional(),
  bootstrap_posts: z.array(BootstrapPostSchema).max(5).optional(),
  post_language: z.enum(['en', 'en-b2', 'es']).default('en'),
}).passthrough();

export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  tone: 'professional',
  rhythm: 'mixed',
  hashtags: [],
  hashtags_mode: 'prefer',
  post_length: { min: 1000, max: 1500 },
  content_strategy: {
    audience: 'mixed',
    skip_patterns: [],
  },
  post_language: 'en',
};

export const ConfigSchema = z.object({
  author: z.object({
    github_username: z.string().min(1),
    name: z.string().min(1),
    website: z.string().url().optional(),
  }),
  github: z.object({
    exclude_repos: z.array(z.string()).default([]),
    exclude_patterns: z.array(z.string()).default([]),
    max_commits_per_push: z.number().int().min(1).default(1),
    notification_repo: z.string().optional(),
  }),
  buffer: z.object({
    organization_id: z.string().min(1),
  }),
  platforms: z.object({
    linkedin: PlatformConfigSchema,
    instagram: PlatformConfigSchema,
  }),
  scheduling: z.object({
    timezone: z.string().default('America/Santiago'),
    window_start_hour: z.number().int().min(0).max(23).default(8),
    window_end_hour: z.number().int().min(0).max(23).default(19),
    daily_slots: z.array(z.number().int()).default([8, 12, 17]),
  }),
  posting: z.object({
    poll_interval_hours: z.number().int().min(1).default(4),
    interesting_min_lines: z.number().int().min(1).default(10),
    voice_examples_count: z.number().int().min(1).max(10).default(5),
    max_pending_drafts: z.number().int().min(1).default(10),
    max_daily_posts_per_author: z.number().int().min(1).default(2),
    analysis_top_n: z.number().int().min(1).max(7).default(3),
  }),
  ai: z.object({
    provider: z.string().default('anthropic'),
    model: z.string().default('claude-sonnet-4-6'),
    max_tokens: z.number().int().default(1600),
    classify_model: z.string().default('claude-haiku-4-5'),
  }),
  embeddings: z.object({
    provider: z.string().default('openai'),
    model: z.string().default('text-embedding-3-small'),
  }).default({}),
  plugins: z.array(z.string()).default([]),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Audience = z.infer<typeof AudienceSchema>;
export type Tone = z.infer<typeof ToneSchema>;
export type Rhythm = z.infer<typeof RhythmSchema>;
export type HashtagMode = z.infer<typeof HashtagModeSchema>;
export type HookStyle = z.infer<typeof HookStyleSchema>;
export type ContentStrategy = z.infer<typeof ContentStrategySchema>;
export type ContentPreferences = z.infer<typeof ContentPreferencesSchema>;
export type BootstrapPost = z.infer<typeof BootstrapPostSchema>;
export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;
