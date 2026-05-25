import type { SupabaseClient } from '@supabase/supabase-js';
import { GitHubClient } from '../github/client.js';
import { resolveTenantSecrets } from '../security/tenant-secrets.js';
import { logger } from '../utils/logger.js';

interface DevProfileRow {
  readonly github_login: string;
  readonly tenant_id: string;
  readonly encrypted_dek: string | null;
  readonly github_pat: string | null;
  readonly pat_last_event_id: string | null;
  readonly pat_last_etag: string | null;
}

interface RawPushEvent {
  id: string;
  type: string;
  repo: { name: string };
  payload: {
    before?: string;
    head?: string;
    ref?: string;
  };
}

/**
 * Polls GitHub Events API for all tenants that have a github_pat configured.
 * For each new push event found, inserts a job into job_queue.
 * Idempotency key prevents duplicates with App webhook-sourced jobs.
 */
export async function runPatPoller(db: SupabaseClient): Promise<void> {
  // Join developer_profiles with tenants to get tenant_id per github_login.
  const { data, error } = await db
    .from('developer_profiles')
    .select('github_login, encrypted_dek, github_pat, pat_last_event_id, pat_last_etag, tenants!inner(id)')
    .not('github_pat', 'is', null);

  if (error) {
    throw new Error(`pat-poller: failed to fetch developer profiles: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as Array<Omit<DevProfileRow, 'tenant_id'> & { tenants: { id: string } }>;

  logger.info('pat-poller.start', { tenantCount: rows.length });

  for (const row of rows) {
    const tenantId = row.tenants.id;
    try {
      await pollTenant(db, {
        github_login: row.github_login,
        tenant_id: tenantId,
        encrypted_dek: row.encrypted_dek,
        github_pat: row.github_pat,
        pat_last_event_id: row.pat_last_event_id,
        pat_last_etag: row.pat_last_etag,
      });
    } catch (err) {
      logger.warn('pat-poller.tenant_failed', {
        login: row.github_login,
        error: String(err),
      });
    }
  }

  logger.info('pat-poller.done', { tenantCount: rows.length });
}

async function pollTenant(db: SupabaseClient, row: DevProfileRow): Promise<void> {
  const resolved = await resolveTenantSecrets({
    encrypted_dek: row.encrypted_dek,
    buffer_access_token: null,
    github_pat: row.github_pat,
  });

  if (!resolved.githubPat) return;

  const client = new GitHubClient(resolved.githubPat);

  const { events, newEtag, notModified } = await client.listUserEvents(
    row.github_login,
    row.pat_last_etag ?? undefined,
  );

  if (notModified) {
    logger.info('pat-poller.not_modified', { login: row.github_login });
    return;
  }

  const pushEvents = (events as RawPushEvent[]).filter((e) => e.type === 'PushEvent');

  const lastSeenIdx = row.pat_last_event_id
    ? pushEvents.findIndex((e) => e.id === row.pat_last_event_id)
    : -1;

  const newEvents = lastSeenIdx === -1
    ? pushEvents
    : pushEvents.slice(0, lastSeenIdx);

  logger.info('pat-poller.events', {
    login: row.github_login,
    total: pushEvents.length,
    new: newEvents.length,
  });

  let enqueued = 0;
  for (const event of newEvents) {
    const { before, head, ref } = event.payload;
    if (!before || !head) continue;

    const idempotencyKey = `${row.tenant_id}:${head}`;

    const { error: insertError } = await db.from('job_queue').insert({
      tenant_id: row.tenant_id,
      repo: event.repo.name,
      before_sha: before,
      after_sha: head,
      ref: ref ?? null,
      idempotency_key: idempotencyKey,
    });

    if (insertError) {
      if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
        // Already queued by the App webhook or a previous run — skip silently.
        continue;
      }
      logger.warn('pat-poller.enqueue_failed', {
        login: row.github_login,
        repo: event.repo.name,
        error: insertError.message,
      });
      continue;
    }

    enqueued++;
  }

  // Persist new poller state regardless of whether we enqueued anything.
  const newLastEventId = (events as RawPushEvent[])[0]?.id ?? row.pat_last_event_id;
  await db
    .from('developer_profiles')
    .update({
      pat_last_event_id: newLastEventId,
      pat_last_etag: newEtag ?? row.pat_last_etag,
    })
    .eq('github_login', row.github_login);

  logger.info('pat-poller.tenant_done', {
    login: row.github_login,
    enqueued,
  });
}
