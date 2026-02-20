import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { addDays, startOfDay, setHours } from 'date-fns';
import type { IVoiceStorage } from '../voice/storage.js';
import type { Platform } from '../voice/storage.js';

export interface SlotManagerConfig {
  timezone: string;
  windowStartHour: number;
  windowEndHour: number;
  dailySlots: number[];
}

/**
 * Finds and claims the next available posting slot.
 *
 * The scheduling window is enforced structurally: slots are only generated
 * within the configured hours. Posting outside the window is impossible
 * by construction, not just by configuration.
 *
 * @returns UTC Date of the claimed slot, or null if all slots for the
 *          next 7 days are taken.
 */
export async function claimNextSlot(
  platform: Platform,
  storage: IVoiceStorage,
  voicePostId: string,
  config: SlotManagerConfig,
  now: Date = new Date(),
): Promise<Date | null> {
  // Check up to 7 days ahead
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidates = getCandidateSlotsForDay(now, dayOffset, config);

    for (const slotUtc of candidates) {
      // Only consider future slots
      if (slotUtc <= now) continue;

      const claimed = await storage.claimSlot({
        platform,
        scheduled_at: slotUtc,
        voice_post_id: voicePostId,
      });

      if (claimed) return slotUtc;
    }
  }

  return null;
}

/**
 * Generates all candidate slot times (as UTC Dates) for a given day offset from now.
 * Slots are defined in local (Chile) time and converted to UTC.
 */
function getCandidateSlotsForDay(
  now: Date,
  dayOffset: number,
  config: SlotManagerConfig,
): Date[] {
  const { timezone, dailySlots, windowStartHour, windowEndHour } = config;

  // Get the target date in local timezone
  const localNow = toZonedTime(now, timezone);
  const targetLocalDay = addDays(startOfDay(localNow), dayOffset);

  return dailySlots
    .filter(hour => hour >= windowStartHour && hour < windowEndHour)
    .map(hour => {
      const localSlot = setHours(targetLocalDay, hour);
      // Convert local time back to UTC
      return fromZonedTime(localSlot, timezone);
    });
}

/**
 * Returns all candidate slot times for today and tomorrow (for display/debugging).
 */
export function previewUpcomingSlots(
  config: SlotManagerConfig,
  now: Date = new Date(),
): { localTime: string; utcTime: string }[] {
  const result: { localTime: string; utcTime: string }[] = [];

  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const candidates = getCandidateSlotsForDay(now, dayOffset, config);
    for (const utc of candidates) {
      const local = toZonedTime(utc, config.timezone);
      result.push({
        localTime: local.toISOString().replace('T', ' ').slice(0, 16) + ` ${config.timezone}`,
        utcTime: utc.toISOString(),
      });
    }
  }

  return result;
}
