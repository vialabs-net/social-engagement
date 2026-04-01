import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '../utils/logger.js';
import { handleInstallation } from './handlers/installation.js';
import { handlePush } from './handlers/push.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface WebhookDependencies {
  readonly db: SupabaseClient;
}

/**
 * Validates the GitHub webhook signature and routes the event to the
 * appropriate handler. Returns an HTTP status code.
 *
 * GitHub sends: X-Hub-Signature-256: sha256=<hmac-sha256>
 * We verify using timing-safe comparison to prevent timing attacks.
 */
export async function handleGithubWebhook(
  event: string,
  signature: string,
  rawBody: string,
  secret: string,
  deps: WebhookDependencies,
): Promise<{ status: number; body: string }> {
  if (!validateSignature(secret, rawBody, signature)) {
    logger.warn('webhook.invalid_signature', { event });
    return { status: 401, body: 'Invalid signature' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    logger.warn('webhook.invalid_json', { event });
    return { status: 400, body: 'Invalid JSON' };
  }

  logger.info('webhook.received', { event });

  try {
    switch (event) {
      case 'installation':
        await handleInstallation(payload, deps.db);
        break;
      case 'push':
        await handlePush(payload, deps.db);
        break;
      default:
        // Acknowledged but not processed — GitHub expects a 200
        logger.info('webhook.ignored', { event });
    }
    return { status: 200, body: 'ok' };
  } catch (err) {
    logger.error('webhook.handler_error', { event, error: String(err) });
    return { status: 500, body: 'Internal error' };
  }
}

function validateSignature(secret: string, body: string, signature: string): boolean {
  if (!signature.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    // Buffers of different length throw — means signature is invalid
    return false;
  }
}
