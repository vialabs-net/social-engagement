import { logger } from '../utils/logger.js';
import type { BufferClient } from './client.js';
import type { IVoiceStorage, Platform } from '../voice/storage.js';
import type { Config } from '../config/schema.js';

export interface PublishResult {
  platform: Platform;
  draftId: string;
  bufferIdeaId: string;
}

/**
 * Creates a Buffer Idea for the draft post.
 * Liliana reviews in Buffer's Ideas UI, converts to a scheduled post when ready.
 * No queue management or slot claiming needed — Ideas have no publish queue limit.
 */
export async function publishToBuffer(
  bufferClient: BufferClient,
  storage: IVoiceStorage,
  config: Config,
  draftId: string,
  text: string,
  platform: Platform,
  commitMessage?: string,
): Promise<PublishResult | null> {
  const orgId = config.buffer.organization_id;
  const platformLabel = platform === 'linkedin' ? 'LinkedIn' : 'Instagram';
  const titleSuffix = commitMessage
    ? commitMessage.slice(0, 60)
    : draftId.slice(0, 8);
  const title = `[${platformLabel}] ${titleSuffix}`;

  const { id: bufferIdeaId } = await bufferClient.createIdea(orgId, title, text);

  await storage.updateScheduled({
    id: draftId,
    buffer_post_id: bufferIdeaId,
    scheduled_at: null,
    status: 'scheduled',
  });

  logger.info('buffer.idea.created', { platform, bufferIdeaId, title });

  return { platform, draftId, bufferIdeaId };
}
