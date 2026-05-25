import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import { runPatPoller } from './pat-poller.js';

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  logger.error('pat-poller.missing_env', { vars: 'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY' });
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main(): Promise<void> {
  logger.info('pat-poller.main.start');
  await runPatPoller(db);
}

main().catch((err) => {
  logger.error('pat-poller.fatal', { error: String(err) });
  process.exit(1);
});
