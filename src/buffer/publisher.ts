import { logger } from '../utils/logger.js';
import { claimNextSlot } from '../scheduling/slot-manager.js';
import type { BufferClient } from './client.js';
import type { IVoiceStorage, Platform } from '../voice/storage.js';
import type { Config } from '../config/schema.js';

export interface PublishResult {
  platform: Platform;
  draftId: string;
  bufferPostId: string;
  scheduledAt: Date;
}

/**
 * Drains queued posts first, then publishes a new post.
 * If the Buffer queue is at or above capacity (≥9), marks the post as 'queued'
 * instead of sending — it will be drained on the next pipeline run.
 */
export async function publishToBuffer(
  bufferClient: BufferClient,
  storage: IVoiceStorage,
  config: Config,
  draftId: string,
  text: string,
  platform: Platform,
): Promise<PublishResult | null> {
  const profileId = platform === 'linkedin'
    ? config.platforms.linkedin.buffer_profile_id
    : config.platforms.instagram.buffer_profile_id;

  if (!profileId) {
    logger.warn('buffer.publish.no_profile_id', { platform });
    return null;
  }

  // Drain queued posts first
  await drainQueuedPosts(bufferClient, storage, config, platform, profileId);

  // Check current queue depth
  const pendingCount = await bufferClient.getPendingCount(profileId);
  if (pendingCount >= config.posting.max_pending_drafts - 1) {
    logger.info('buffer.publish.queue_full', { platform, pendingCount });
    await storage.markQueued(draftId);
    return null;
  }

  // Claim a scheduling slot
  const scheduledAt = await claimNextSlot(platform, storage, draftId, {
    timezone: config.scheduling.timezone,
    windowStartHour: config.scheduling.window_start_hour,
    windowEndHour: config.scheduling.window_end_hour,
    dailySlots: config.scheduling.daily_slots,
  });

  if (!scheduledAt) {
    logger.warn('buffer.publish.no_slot', { platform });
    await storage.markQueued(draftId);
    return null;
  }

  const scheduledUnix = Math.floor(scheduledAt.getTime() / 1000);
  const { id: bufferPostId } = await bufferClient.createUpdate(profileId, text, scheduledUnix);

  await storage.updateScheduled({
    id: draftId,
    buffer_post_id: bufferPostId,
    scheduled_at: scheduledAt.toISOString(),
    status: 'scheduled',
  });

  logger.info('buffer.publish.scheduled', {
    platform,
    bufferPostId,
    scheduledAt: scheduledAt.toISOString(),
  });

  return { platform, draftId, bufferPostId, scheduledAt };
}

async function drainQueuedPosts(
  bufferClient: BufferClient,
  storage: IVoiceStorage,
  config: Config,
  platform: Platform,
  profileId: string,
): Promise<void> {
  const queued = await storage.getQueuedPosts(platform);
  if (queued.length === 0) return;

  logger.info('buffer.drain.start', { platform, count: queued.length });

  for (const post of queued) {
    const pendingCount = await bufferClient.getPendingCount(profileId);
    if (pendingCount >= config.posting.max_pending_drafts - 1) break;

    const text = post.published ?? post.ai_draft;
    const scheduledAt = await claimNextSlot(platform, storage, post.id, {
      timezone: config.scheduling.timezone,
      windowStartHour: config.scheduling.window_start_hour,
      windowEndHour: config.scheduling.window_end_hour,
      dailySlots: config.scheduling.daily_slots,
    });

    if (!scheduledAt) break;

    const scheduledUnix = Math.floor(scheduledAt.getTime() / 1000);
    const { id: bufferPostId } = await bufferClient.createUpdate(profileId, text, scheduledUnix);

    await storage.updateScheduled({
      id: post.id,
      buffer_post_id: bufferPostId,
      scheduled_at: scheduledAt.toISOString(),
      status: 'scheduled',
    });

    logger.info('buffer.drain.scheduled', { id: post.id, bufferPostId });
  }
}
