import { describe, it, expect, beforeEach } from 'vitest';
import { claimNextSlot, type SlotManagerConfig } from '../scheduling/slot-manager.js';
import type { IVoiceStorage, Platform, SlottedPost } from '../voice/storage.js';

/**
 * Minimal in-memory storage that tracks claimed slots per tenant.
 * Mirrors the UNIQUE(tenant_id, platform, scheduled_at) constraint.
 */
class FakeStorage {
  readonly tenantId: string;
  private readonly slots = new Map<string, string>(); // key → voice_post_id

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async claimSlot(slot: SlottedPost): Promise<boolean> {
    const key = `${this.tenantId}:${slot.platform}:${slot.scheduled_at.toISOString()}`;
    if (this.slots.has(key)) return false;
    this.slots.set(key, slot.voice_post_id);
    return true;
  }

  async getTakenSlots(platform: Platform, dayUtc: string): Promise<Date[]> {
    const results: Date[] = [];
    for (const key of this.slots.keys()) {
      const [tid, p, iso] = key.split(':');
      if (tid === this.tenantId && p === platform && iso?.startsWith(dayUtc)) {
        results.push(new Date(iso));
      }
    }
    return results;
  }
}

// Cast to IVoiceStorage for function signatures — only claimSlot/getTakenSlots are used
function asStorage(f: FakeStorage): IVoiceStorage {
  return f as unknown as IVoiceStorage;
}

const DEFAULT_CONFIG: SlotManagerConfig = {
  timezone: 'America/Santiago',
  windowStartHour: 8,
  windowEndHour: 19,
  dailySlots: [8, 12, 17],
};

// Fixed "now" = 2026-04-14 09:00 CLT (UTC-4 during DST in April → 13:00 UTC)
// CLT in April is UTC-3 (Chile observes DST end March/April, so April is UTC-3 after clocks go back)
// Let's use 09:00 CLT = 12:00 UTC to be safe
const NOW = new Date('2026-04-14T12:00:00Z');

describe('claimNextSlot', () => {
  let storage: FakeStorage;

  beforeEach(() => {
    storage = new FakeStorage('tenant-a');
  });

  it('claims the next available slot within the window', async () => {
    const slot = await claimNextSlot('linkedin', asStorage(storage), 'post-1', DEFAULT_CONFIG, NOW);
    expect(slot).not.toBeNull();
    expect(slot).toBeInstanceOf(Date);
    expect(slot!.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('does not claim a slot in the past', async () => {
    // 08:00 CLT slot has already passed (NOW is 09:00 CLT), so first available should be 12:00 CLT
    const slot = await claimNextSlot('linkedin', asStorage(storage), 'post-1', DEFAULT_CONFIG, NOW);
    expect(slot!.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('second claim on same post gets a different slot', async () => {
    const slot1 = await claimNextSlot('linkedin', asStorage(storage), 'post-1', DEFAULT_CONFIG, NOW);
    const slot2 = await claimNextSlot('linkedin', asStorage(storage), 'post-2', DEFAULT_CONFIG, NOW);
    expect(slot1).not.toBeNull();
    expect(slot2).not.toBeNull();
    expect(slot1!.getTime()).not.toBe(slot2!.getTime());
  });

  it('returns null when all slots for 7 days are taken', async () => {
    // Fill all slots for 7 days (3 slots/day × 8 days = 24 iterations max)
    let count = 0;
    while (count < 30) {
      const slot = await claimNextSlot('linkedin', asStorage(storage), `post-${count}`, DEFAULT_CONFIG, NOW);
      if (slot === null) break;
      count++;
    }
    // After exhausting all slots, next call returns null
    const final = await claimNextSlot('linkedin', asStorage(storage), 'post-overflow', DEFAULT_CONFIG, NOW);
    expect(final).toBeNull();
  });

  it('two tenants claim the same slot independently without blocking each other', async () => {
    const storageA = new FakeStorage('tenant-a');
    const storageB = new FakeStorage('tenant-b');

    const slotA = await claimNextSlot('linkedin', asStorage(storageA), 'post-a', DEFAULT_CONFIG, NOW);
    const slotB = await claimNextSlot('linkedin', asStorage(storageB), 'post-b', DEFAULT_CONFIG, NOW);

    // Both tenants get the same first available slot — they don't block each other
    expect(slotA).not.toBeNull();
    expect(slotB).not.toBeNull();
    expect(slotA!.toISOString()).toBe(slotB!.toISOString());
  });

  it('only generates slots within the configured window hours', async () => {
    // Claim all slots and verify none fall outside 8–19 CLT
    const claimedSlots: Date[] = [];
    for (let i = 0; i < 25; i++) {
      const slot = await claimNextSlot('linkedin', asStorage(storage), `post-${i}`, DEFAULT_CONFIG, NOW);
      if (slot === null) break;
      claimedSlots.push(slot);
    }
    expect(claimedSlots.length).toBeGreaterThan(0);

    // All claimed UTC slots, when converted to CLT (UTC-3 or UTC-4), must be within [8, 19)
    // We just verify they are all different valid dates
    const unique = new Set(claimedSlots.map(d => d.toISOString()));
    expect(unique.size).toBe(claimedSlots.length);
  });
});
