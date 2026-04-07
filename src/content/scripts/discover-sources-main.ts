/**
 * Entry point for the discover-sources CRON.
 * Run: tsx src/content/scripts/discover-sources-main.ts
 */

import { createClient } from '@supabase/supabase-js';
import { discoverSources } from '../opml-importer.js';
import { logger } from '../../utils/logger.js';

async function main(): Promise<void> {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  const db = createClient(supabaseUrl, supabaseKey);
  await discoverSources(db);
}

main().catch((err) => {
  logger.error('discover.fatal', { error: String(err) });
  process.exit(1);
});
