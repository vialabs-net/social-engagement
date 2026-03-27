import { logger } from '../utils/logger.js';
import type { BufferClient } from './client.js';
import type { IVoiceStorage } from '../voice/storage.js';
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
  commitMessage?: string,
): Promise<PublishResult | null> {
  const orgId = config.buffer.organization_id;
  const title = commitMessage ? commitMessage.slice(0, 80) : draftId.slice(0, 8);

  const { id: bufferIdeaId } = await bufferClient.createIdea(orgId, title, text);

  await storage.updateScheduled({
    id: draftId,
    buffer_post_id: bufferIdeaId,
    scheduled_at: null,
    status: 'scheduled',
  });

  logger.info('buffer.idea.created', { bufferIdeaId, title });

  return { draftId, bufferIdeaId };
}
