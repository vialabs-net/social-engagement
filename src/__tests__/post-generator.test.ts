import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePosts } from '../ai/post-generator.js';
import type { IAIClient } from '../ai/types.js';
import type { IVoiceStorage, SaveDraftInput } from '../voice/storage.js';
import type { EnrichedCommit } from '../github/commit-enricher.js';
import type { Finding } from '../analysis/types.js';
import type { Config } from '../config/schema.js';
import { DEFAULT_VOICE_PROFILE } from '../config/schema.js';

// Minimal Claude response with required XML tags
const VALID_AI_RESPONSE = `
<post_draft>
Very small change. Very focused diff.
Added retry backoff to the publisher so Buffer 429s stop crashing the worker.
Before: silent failures. Now: logged + queued for retry.

#lilicurl #codingWithHumor
</post_draft>
<short_draft>
Added retry backoff to Buffer publisher — no more silent 429 crashes.
</short_draft>
`.trim();

const REAL_COMMIT: EnrichedCommit = {
  sha: 'b4e22c5',
  message: 'fix: scope scheduled_slots to tenant',
  body: 'Add tenant_id to scheduled_slots so each tenant has an independent slot namespace.',
  fullMessage: 'fix: scope scheduled_slots to tenant\n\nAdd tenant_id to scheduled_slots...',
  repo: 'vialabs-net/social-engagement',
  authorLogin: 'lilicurl',
  totalAdditions: 23,
  totalDeletions: 0,
  diffs: [],
  languages: ['TypeScript', 'SQL'],
  committedAt: '2026-04-13T18:00:00Z',
};

const REAL_FINDING: Finding = {
  moduleId: 'security',
  aspect: 'Security',
  finding: 'Tenant data isolation enforced via tenant_id in scheduled_slots table',
  technicalDetail: 'UNIQUE(tenant_id, platform, scheduled_at) constraint prevents cross-tenant slot collision',
  plainLanguage: 'Each tenant now has isolated scheduling slots — no interference across organizations',
  interestScore: 8,
  contextHint: 'supabase-storage.ts in vialabs-net/social-engagement',
};

const MIN_CONFIG: Config = {
  author: { github_username: 'lilicurl', name: 'Liliana Castellanos' },
  github: { username: 'lilicurl', exclude_repos: [], exclude_patterns: [], max_commits_per_push: 1 },
  buffer: { organization_id: 'org-123' },
  platforms: {
    linkedin: { enabled: true, max_weekly_posts: 5 },
    instagram: { enabled: false, max_weekly_posts: 0 },
  },
  scheduling: {
    timezone: 'America/Santiago',
    window_start_hour: 8,
    window_end_hour: 19,
    daily_slots: [8, 12, 17],
  },
  posting: {
    poll_interval_hours: 4,
    interesting_min_lines: 10,
    voice_examples_count: 5,
    max_pending_drafts: 10,
    max_daily_posts_per_author: 2,
    analysis_top_n: 3,
  },
  ai: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    max_tokens: 1600,
    classify_model: 'claude-haiku-4-5',
  },
} as unknown as Config;

function makeAIClient(): IAIClient {
  return {
    model: 'claude-sonnet-4-6',
    complete: vi.fn().mockResolvedValue(VALID_AI_RESPONSE),
  };
}

function makeStorage() {
  const calls: SaveDraftInput[] = [];
  const storage = {
    tenantId: 'tenant-a',
    saveDraft: vi.fn(async (input: SaveDraftInput) => {
      calls.push(input);
      return 'draft-id-1';
    }),
    getTopVoiceExamples: vi.fn().mockResolvedValue([]),
    getRecentTopFindings: vi.fn().mockResolvedValue([]),
  } as unknown as IVoiceStorage;
  return { storage, calls };
}

describe('generatePosts', () => {
  it('stores the draft with the correct generation_system from voiceStage', async () => {
    const { storage, calls } = makeStorage();
    const ai = makeAIClient();

    await generatePosts(ai, REAL_COMMIT, [REAL_FINDING], storage, MIN_CONFIG, {
      voiceProfile: DEFAULT_VOICE_PROFILE,
      voiceStage: 'cold',
    });

    expect(calls[0]?.generation_system).toBe('v1');
  });

  it('generation_system from draftMetadata takes precedence over voiceStage', async () => {
    const { storage, calls } = makeStorage();
    const ai = makeAIClient();

    await generatePosts(ai, REAL_COMMIT, [REAL_FINDING], storage, MIN_CONFIG, {
      voiceProfile: DEFAULT_VOICE_PROFILE,
      voiceStage: 'cold',
      draftMetadata: { generation_system: 'v2_progressive' },
    });

    expect(calls[0]?.generation_system).toBe('v2_progressive');
  });

  it('undefined generation_system in draftMetadata falls back to voiceStage computation — bug #3', async () => {
    // BUG: before fix, spreading { generation_system: undefined } after the explicit key
    // overwrote the fallback with undefined, causing NULL in the DB.
    const { storage, calls } = makeStorage();
    const ai = makeAIClient();

    await generatePosts(ai, REAL_COMMIT, [REAL_FINDING], storage, MIN_CONFIG, {
      voiceProfile: DEFAULT_VOICE_PROFILE,
      voiceStage: 'warming',
      draftMetadata: { generation_system: undefined, author_login: 'lilicurl' },
    });

    // Should use the voiceStage fallback, not undefined
    expect(calls[0]?.generation_system).toBe('v2_progressive');
    expect(calls[0]?.generation_system).not.toBeUndefined();
  });

  it('detected opening_move is stored when draftMetadata does not provide one', async () => {
    const { storage, calls } = makeStorage();
    const ai = makeAIClient();

    await generatePosts(ai, REAL_COMMIT, [REAL_FINDING], storage, MIN_CONFIG, {
      voiceProfile: DEFAULT_VOICE_PROFILE,
      voiceStage: 'cold',
      draftMetadata: { author_login: 'lilicurl' },
    });

    // opening_move is detected from the post text; may be null if no match, but must not be undefined
    expect(calls[0]?.opening_move === undefined).toBe(false);
  });

  it('throws when given zero findings', async () => {
    const { storage } = makeStorage();
    const ai = makeAIClient();

    await expect(
      generatePosts(ai, REAL_COMMIT, [], storage, MIN_CONFIG, {
        voiceProfile: DEFAULT_VOICE_PROFILE,
        voiceStage: 'cold',
      }),
    ).rejects.toThrow('0 findings');
  });

  it('throws when Claude response is missing XML tags', async () => {
    const { storage } = makeStorage();
    const ai: IAIClient = {
      model: 'claude-sonnet-4-6',
      complete: vi.fn().mockResolvedValue('This is a plain response with no XML tags.'),
    };

    await expect(
      generatePosts(ai, REAL_COMMIT, [REAL_FINDING], storage, MIN_CONFIG, {
        voiceProfile: DEFAULT_VOICE_PROFILE,
        voiceStage: 'cold',
      }),
    ).rejects.toThrow('XML tags');
  });

  it('top_finding and top_module_id come from the first finding', async () => {
    const { storage, calls } = makeStorage();
    const ai = makeAIClient();

    await generatePosts(ai, REAL_COMMIT, [REAL_FINDING], storage, MIN_CONFIG, {
      voiceProfile: DEFAULT_VOICE_PROFILE,
      voiceStage: 'cold',
    });

    expect(calls[0]?.top_finding).toBe(REAL_FINDING.finding);
    expect(calls[0]?.top_module_id).toBe(REAL_FINDING.moduleId);
    expect(calls[0]?.findings_count).toBe(1);
  });
});
