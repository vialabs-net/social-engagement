import { describe, it, expect, vi } from 'vitest';
import { fetchExposurePool } from '../worker/process-job.js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Builds a chainable Supabase query mock that records every .eq() call.
 * The chain resolves with the provided data when awaited.
 */
function makeDbMock(result: { data: unknown; error: unknown }) {
  const eqCalls: Array<[string, unknown]> = [];

  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((key: string, val: unknown) => { eqCalls.push([key, val]); return chain; }),
    in: vi.fn().mockReturnThis(),
    // Makes the chain awaitable: `await db.from(...).select(...).eq(...).in(...)` resolves here
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };

  const db = { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient;
  return { db, eqCalls };
}

describe('fetchExposurePool', () => {
  it('queries voice_posts table', async () => {
    const { db } = makeDbMock({ data: [], error: null });
    await fetchExposurePool(db, 'tenant-abc', ['post-1']);
    expect(db.from).toHaveBeenCalledWith('voice_posts');
  });

  it('includes tenant_id filter — regression for bug #1', async () => {
    // If someone removes .eq('tenant_id', tenantId) from the query,
    // this test fails, catching the cross-tenant data leak.
    const { db, eqCalls } = makeDbMock({ data: [], error: null });
    await fetchExposurePool(db, 'tenant-abc', ['post-1', 'post-2']);

    const tenantFilter = eqCalls.find(([key]) => key === 'tenant_id');
    expect(tenantFilter).toBeDefined();
    expect(tenantFilter![1]).toBe('tenant-abc');
  });

  it('returns only the data for the given tenantId, not another tenant', async () => {
    // Simulate DB returning posts that belong to tenant-abc
    const tenantAPost = { id: 'post-1', tenant_id: 'tenant-abc', ai_draft: 'post by lilicurl' };
    const { db } = makeDbMock({ data: [tenantAPost], error: null });

    const result = await fetchExposurePool(db, 'tenant-abc', ['post-1']);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('post-1');
  });

  it('returns empty array on db error instead of throwing', async () => {
    const { db } = makeDbMock({ data: null, error: { message: 'connection refused' } });
    const result = await fetchExposurePool(db, 'tenant-abc', ['post-1']);
    expect(result).toEqual([]);
  });

  it('passes the poolIds to the .in() filter', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    const db = { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient;

    await fetchExposurePool(db, 'tenant-abc', ['post-1', 'post-2', 'post-3']);
    expect(chain.in).toHaveBeenCalledWith('id', ['post-1', 'post-2', 'post-3']);
  });
});
