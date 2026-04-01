import { logger } from '../../utils/logger.js';
import type { SupabaseClient } from '@supabase/supabase-js';

interface InstallationAccount {
  login: string;
  type: string;
}

interface InstallationPayload {
  action: string;
  installation: {
    id: number;
    account: InstallationAccount;
  };
}

function isInstallationPayload(value: unknown): value is InstallationPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v['action'] !== 'string') return false;
  const inst = v['installation'];
  if (!inst || typeof inst !== 'object') return false;
  const i = inst as Record<string, unknown>;
  if (typeof i['id'] !== 'number') return false;
  const acc = i['account'];
  if (!acc || typeof acc !== 'object') return false;
  const a = acc as Record<string, unknown>;
  return typeof a['login'] === 'string';
}

/**
 * Handles GitHub App installation events.
 *
 * created  → upsert tenant (safe to call multiple times)
 * deleted  → mark tenant inactive (data preserved for potential re-install)
 * suspend  → mark tenant inactive
 * unsuspend → mark tenant active
 */
export async function handleInstallation(
  payload: unknown,
  db: SupabaseClient,
): Promise<void> {
  if (!isInstallationPayload(payload)) {
    logger.warn('installation.invalid_payload');
    return;
  }

  const { action, installation } = payload;
  const installationId = installation.id;
  const username = installation.account.login;

  logger.info('installation.event', { action, installationId, username });

  switch (action) {
    case 'created': {
      const { error } = await db.from('tenants').upsert(
        {
          github_installation_id: installationId,
          github_username: username,
          active: true,
        },
        { onConflict: 'github_installation_id' },
      );
      if (error) throw new Error(`Failed to upsert tenant: ${error.message}`);
      logger.info('installation.tenant_created', { installationId, username });
      break;
    }

    case 'deleted':
    case 'suspend': {
      const { error } = await db
        .from('tenants')
        .update({ active: false })
        .eq('github_installation_id', installationId);
      if (error) throw new Error(`Failed to deactivate tenant: ${error.message}`);
      logger.info('installation.tenant_deactivated', { action, installationId });
      break;
    }

    case 'unsuspend': {
      const { error } = await db
        .from('tenants')
        .update({ active: true })
        .eq('github_installation_id', installationId);
      if (error) throw new Error(`Failed to reactivate tenant: ${error.message}`);
      logger.info('installation.tenant_reactivated', { installationId });
      break;
    }

    default:
      logger.info('installation.action_ignored', { action });
  }
}
