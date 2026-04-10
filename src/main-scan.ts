/**
 * main-scan.ts — legacy single-tenant scanner kept for manual/local debugging
 *
 * Flow: Buffer "sent" API → match buffer_post_id → computeEditRatio → voice history
 */

import { loadConfig } from './config/loader.js';
import { logger } from './utils/logger.js';
import { BufferClient } from './buffer/client.js';
import { scanSentPosts } from './buffer/sent-scanner.js';
import { SqliteStorage } from './voice/sqlite-storage.js';
import { SupabaseStorage } from './voice/supabase-storage.js';
import type { IVoiceStorage } from './voice/storage.js';

async function main(): Promise<void> {
  const config = loadConfig();
  logger.info('scan.start');

  const tenantId = process.env['TENANT_ID'] ?? 'local';
  const storage: IVoiceStorage = process.env['SUPABASE_URL']
    ? new SupabaseStorage(process.env['SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '', tenantId)
    : new SqliteStorage(process.env['SQLITE_PATH'] ?? 'data/devcast.db', tenantId);

  const bufferClient = new BufferClient(process.env['BUFFER_ACCESS_TOKEN'] ?? '');

  await scanSentPosts(bufferClient, storage, config);

  logger.info('scan.done');
}

main().catch(err => {
  logger.error('scan.fatal', { error: String(err) });
  process.exit(1);
});
