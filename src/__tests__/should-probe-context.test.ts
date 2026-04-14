import { describe, it, expect } from 'vitest';
import { shouldProbeContext } from '../worker/process-job.js';

function makeStorage(count: number) {
  return {
    countDraftsSince: async (_authorLogin: string, _since: string) => count,
  };
}

const DAY_START = '2026-04-14T00:00:00.000Z';

describe('shouldProbeContext', () => {
  it('returns false when authorLogin is null', async () => {
    const result = await shouldProbeContext(makeStorage(5), null, DAY_START);
    expect(result).toBe(false);
  });

  it('returns false when no drafts today', async () => {
    const result = await shouldProbeContext(makeStorage(0), 'lilicurl', DAY_START);
    expect(result).toBe(false);
  });

  it('returns true on the first draft of the day (count === 1)', async () => {
    const result = await shouldProbeContext(makeStorage(1), 'lilicurl', DAY_START);
    expect(result).toBe(true);
  });

  it('returns false on subsequent drafts (count > 1)', async () => {
    for (const count of [2, 3, 4, 5, 10]) {
      const result = await shouldProbeContext(makeStorage(count), 'lilicurl', DAY_START);
      expect(result).toBe(false);
    }
  });

  it('fires within the default max_daily_posts_per_author=2 limit', async () => {
    // With daily limit of 2, draftsToday will be 0, 1, or 2.
    // Probe must fire at count=1 — the only useful trigger in normal operation.
    const atOne = await shouldProbeContext(makeStorage(1), 'lilicurl', DAY_START);
    const atTwo = await shouldProbeContext(makeStorage(2), 'lilicurl', DAY_START);
    expect(atOne).toBe(true);
    expect(atTwo).toBe(false);
  });
});
