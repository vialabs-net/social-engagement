import { z } from 'zod';

const PlatformConfigSchema = z.object({
  enabled: z.boolean(),
  buffer_profile_id: z.string().default(''),
});

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
    analysis_top_n: z.number().int().min(1).max(7).default(3),
  }),
  ai: z.object({
    model: z.string().default('claude-sonnet-4-6'),
    max_tokens: z.number().int().default(1600),
  }),
  plugins: z.array(z.string()).default([]),
});

export type Config = z.infer<typeof ConfigSchema>;
