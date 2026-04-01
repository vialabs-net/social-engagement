import { logger } from '../../utils/logger.js';
import type { SupabaseClient } from '@supabase/supabase-js';

interface PushPayload {
  ref: string;
  before: string;
  after: string;
  repository: { full_name: string };
  installation: { id: number };
}

function isPushPayload(value: unknown): value is PushPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v['ref'] !== 'string') return false;
  if (typeof v['before'] !== 'string') return false;
  if (typeof v['after'] !== 'string') return false;
  const repo = v['repository'];
  if (!repo || typeof repo !== 'object') return false;
  if (typeof (repo as Record<string, unknown>)['full_name'] !== 'string') return false;
  const inst = v['installation'];
  if (!inst || typeof inst !== 'object') return false;
  return typeof (inst as Record<string, unknown>)['id'] === 'number';
}

const ZERO_SHA = '0000000000000000000000000000000000000000';

/**
 * Handles push events from the GitHub App.
 *
 * Looks up the tenant by installation ID and enqueues a job.
 * Skips branch deletions (after SHA is all zeros).
 * Skips if tenant is not found or inactive.
 */
export async function handlePush(
  payload: unknown,
  db: SupabaseClient,
): Promise<void> {
  if (!isPushPayload(payload)) {
    logger.warn('push.invalid_payload');
    return;
  }

  const { ref, before, after, repository, installation } = payload;

  // Branch deletion — no commits to process
  if (after === ZERO_SHA) {
    logger.info('push.branch_deleted', { ref, repo: repository.full_name });
    return;
  }

  // Resolve tenant
  const { data: tenant, error: tenantError } = await db
    .from('tenants')
    .select('id, active')
    .eq('github_installation_id', installation.id)
    .single();

  if (tenantError || !tenant) {
    logger.warn('push.tenant_not_found', { installationId: installation.id });
    return;
  }

  if (!(tenant as { active: boolean }).active) {
    logger.info('push.tenant_inactive', { installationId: installation.id });
    return;
  }

  // Enqueue job
  const { error: insertError } = await db.from('job_queue').insert({
    tenant_id: (tenant as { id: string }).id,
    repo: repository.full_name,
    before_sha: before,
    after_sha: after,
    ref,
  });

  if (insertError) {
    throw new Error(`Failed to enqueue job: ${insertError.message}`);
  }

  logger.info('push.job_enqueued', {
    repo: repository.full_name,
    ref,
    after: after.slice(0, 7),
  });
}
