import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import { processJob } from './process-job.js';
import type { ProcessJobDeps } from './process-job.js';

const POLL_INTERVAL_MS = 30_000;
const MAX_ATTEMPTS = 3;

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const ANTHROPIC_API_KEY = process.env['ANTHROPIC_API_KEY'] ?? '';
const GITHUB_APP_ID = process.env['GITHUB_APP_ID'] ?? '';
const GITHUB_APP_PRIVATE_KEY = process.env['GITHUB_APP_PRIVATE_KEY'] ?? '';

for (const [name, value] of [
  ['SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY],
  ['ANTHROPIC_API_KEY', ANTHROPIC_API_KEY],
  ['GITHUB_APP_ID', GITHUB_APP_ID],
  ['GITHUB_APP_PRIVATE_KEY', GITHUB_APP_PRIVATE_KEY],
] as [string, string][]) {
  if (!value) {
    logger.error('worker.missing_env', { var: name });
    process.exit(1);
  }
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const deps: ProcessJobDeps = {
  db,
  appId: GITHUB_APP_ID,
  privateKey: GITHUB_APP_PRIVATE_KEY,
  supabaseUrl: SUPABASE_URL,
  supabaseServiceKey: SUPABASE_SERVICE_ROLE_KEY,
  anthropicApiKey: ANTHROPIC_API_KEY,
};

/**
 * Claims the oldest pending job by:
 * 1. SELECT the candidate
 * 2. UPDATE WHERE status='pending' (optimistic guard against race)
 *
 * With a single Cloud Run instance this race never occurs, but the guard
 * is cheap and keeps the code correct if a second worker is ever added.
 * Attempts are NOT incremented here — markFailed handles the increment.
 */
async function claimJob(): Promise<string | null> {
  const { data: candidate, error: selectError } = await db
    .from('job_queue')
    .select('id')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    logger.error('worker.claim.error', { error: selectError.message });
    return null;
  }
  if (!candidate) return null;

  const jobId = (candidate as { id: string }).id;

  const { data: claimed, error: claimError } = await db
    .from('job_queue')
    .update({ status: 'processing' })
    .eq('id', jobId)
    .eq('status', 'pending')  // guard: only claim if still pending
    .select('id')
    .maybeSingle();

  if (claimError) {
    logger.error('worker.claim.update_error', { jobId, error: claimError.message });
    return null;
  }

  return claimed ? (claimed as { id: string }).id : null;
}

async function markDone(jobId: string): Promise<void> {
  const { error } = await db
    .from('job_queue')
    .update({ status: 'done', processed_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) logger.error('worker.mark_done.error', { jobId, error: error.message });
}

async function markFailed(jobId: string, errorMessage: string): Promise<void> {
  // Fetch current attempts to increment and decide final status
  const { data, error: fetchError } = await db
    .from('job_queue')
    .select('attempts')
    .eq('id', jobId)
    .single();

  if (fetchError) {
    logger.error('worker.mark_failed.fetch_error', { jobId, error: fetchError.message });
    return;
  }

  const newAttempts = ((data as { attempts: number }).attempts) + 1;
  const newStatus = newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';

  const { error } = await db
    .from('job_queue')
    .update({
      status: newStatus,
      attempts: newAttempts,
      error: errorMessage,
      ...(newStatus === 'failed' && { processed_at: new Date().toISOString() }),
    })
    .eq('id', jobId);

  if (error) logger.error('worker.mark_failed.error', { jobId, error: error.message });
  else logger.info('worker.job.marked_failed', { jobId, newAttempts, newStatus });
}

async function runOnce(): Promise<void> {
  const jobId = await claimJob();
  if (!jobId) return;

  try {
    await processJob(jobId, deps);
    await markDone(jobId);
  } catch (err) {
    logger.error('worker.job.error', { jobId, error: String(err) });
    await markFailed(jobId, String(err));
  }
}

let running = true;

async function main(): Promise<void> {
  logger.info('worker.start', { pollIntervalMs: POLL_INTERVAL_MS, maxAttempts: MAX_ATTEMPTS });

  while (running) {
    await runOnce();
    if (running) {
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  logger.info('worker.stopped');
}

process.on('SIGTERM', () => {
  logger.info('worker.shutdown');
  running = false;
});

process.on('SIGINT', () => {
  logger.info('worker.shutdown');
  running = false;
});

main().catch((err) => {
  logger.error('worker.fatal', { error: String(err) });
  process.exit(1);
});
