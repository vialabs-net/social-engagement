import { logger } from '../utils/logger.js';
import { claimNextSlot } from '../scheduling/slot-manager.js';
import type { BufferClient } from './client.js';
import type { IVoiceStorage, Platform } from '../voice/storage.js';
import type { Config } from '../config/schema.js';

export interface PublishResult {
  draftId: string;
  bufferIdeaId: string;
}

/**
 * Creates a single Buffer Idea per commit.
 * Text includes the full post + short (Twitter) variant separated by a divider.
 * Liliana reviews in Buffer's Ideas UI, sets per-platform text there, then publishes.
 */
export async function publishToBuffer(
  bufferClient: BufferClient,
  storage: IVoiceStorage,
  config: Config,
  draftId: string,
  text: string,
  platform: Platform,
  orgId: string,
  commitMessage?: string,
): Promise<PublishResult | null> {
  const title = commitMessage ? commitMessage.slice(0, 80) : draftId.slice(0, 8);

  const { id: bufferIdeaId } = await bufferClient.createIdea(orgId, title, text);

  const slotConfig = {
    timezone: config.scheduling.timezone,
    windowStartHour: config.scheduling.window_start_hour,
    windowEndHour: config.scheduling.window_end_hour,
    dailySlots: config.scheduling.daily_slots,
  };

  const scheduledAt = await claimNextSlot(platform, storage, draftId, slotConfig);

  if (!scheduledAt) {
    logger.warn('buffer.slot.unavailable', { draftId, platform });
  }

  await storage.updateScheduled({
    id: draftId,
    buffer_post_id: bufferIdeaId,
    scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
    status: 'scheduled',
  });

  logger.info('buffer.idea.created', { bufferIdeaId, title, scheduledAt: scheduledAt?.toISOString() ?? null });

  return { draftId, bufferIdeaId };
}
