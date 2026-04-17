/**
 * main-scan-tenants.ts — multi-tenant sent-post scanner
 *
 * Replaces single-tenant main-scan.ts. Iterates over all active tenants
 * with a Buffer access token and scans their published posts for voice training.
 *
 * Runs as Cloud Run Job triggered by Cloud Scheduler every 2 hours.
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import { BufferClient } from '../buffer/client.js';
import { scanSentPosts, scanPlatform } from '../buffer/sent-scanner.js';
import { SupabaseStorage } from '../voice/supabase-storage.js';
import { ConfigSchema } from '../config/schema.js';
import type { Config } from '../config/schema.js';
import { resolveTenantSecrets } from '../security/tenant-secrets.js';

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  logger.error('scanner.missing_env', { vars: 'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY' });
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface TenantRow {
  readonly id: string;
  readonly github_username: string;
  readonly buffer_access_token: string | null;
  readonly encrypted_dek: string | null;
  readonly config: Record<string, unknown>;
}

interface MemberScanRow {
  readonly github_author_login: string;
  readonly buffer_access_token: string | null;
  readonly buffer_org_id: string | null;
  readonly buffer_linkedin_channel_id: string | null;
  readonly encrypted_dek: string | null;
}

function buildConfig(tenant: TenantRow): Config {
  const tc = tenant.config;
  const result = ConfigSchema.safeParse({
    github: { exclude_repos: [], exclude_patterns: [] },
    scheduling: {},
    posting: {},
    ai: {},
    buffer: { organization_id: 'UNCONFIGURED' },
    platforms: {
      linkedin: { enabled: true, buffer_profile_id: '' },
      instagram: { enabled: false, buffer_profile_id: '' },
    },
    ...tc,
    author: {
      name: tenant.github_username,
      ...((tc['author'] as Record<string, unknown> | undefined) ?? {}),
      github_username: tenant.github_username,
    },
  });

  if (!result.success) {
    throw new Error(`Invalid config for tenant ${tenant.id}: ${result.error.message}`);
  }

  return result.data;
}

async function main(): Promise<void> {
  logger.info('scanner.start');

  const { data: tenants, error } = await db
    .from('tenants')
    .select('id, github_username, buffer_access_token, encrypted_dek, config')
    .eq('active', true)
    .not('buffer_access_token', 'is', null);

  if (error) {
    logger.error('scanner.fetch_tenants_error', { error: error.message });
    process.exit(1);
  }

  const rows = (tenants ?? []) as TenantRow[];
  logger.info('scanner.tenants_found', { count: rows.length });

  let scanned = 0;
  let failed = 0;

  for (const tenant of rows) {
    try {
      const config = buildConfig(tenant);
      const secrets = await resolveTenantSecrets(tenant);
      const storage = new SupabaseStorage(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, tenant.id);
      if (!secrets.bufferAccessToken) {
        logger.warn('scanner.tenant.skip_missing_buffer_token', { tenantId: tenant.id, username: tenant.github_username });
        continue;
      }
      const bufferClient = new BufferClient(secrets.bufferAccessToken);

      await scanSentPosts(bufferClient, storage, config);

      // Scan each member's personal Buffer when they have their own org ID configured.
      const { data: memberRows } = await db
        .from('tenant_members')
        .select('github_author_login, buffer_access_token, buffer_org_id, buffer_linkedin_channel_id, encrypted_dek')
        .eq('tenant_id', tenant.id)
        .not('buffer_org_id', 'is', null)
        .not('buffer_linkedin_channel_id', 'is', null);

      for (const raw of (memberRows ?? []) as MemberScanRow[]) {
        if (!raw.buffer_access_token) continue;
        try {
          const memberSecrets = await resolveTenantSecrets({
            encrypted_dek: raw.encrypted_dek,
            buffer_access_token: raw.buffer_access_token,
          });
          if (!memberSecrets.bufferAccessToken) continue;

          const memberClient = new BufferClient(memberSecrets.bufferAccessToken);
          await scanPlatform(
            memberClient,
            storage,
            'linkedin',
            raw.buffer_org_id!,
            raw.buffer_linkedin_channel_id!,
            raw.github_author_login,
          );
          logger.info('scanner.member.done', { tenantId: tenant.id, authorLogin: raw.github_author_login });
        } catch (err) {
          logger.error('scanner.member.error', {
            tenantId: tenant.id,
            authorLogin: raw.github_author_login,
            error: String(err),
          });
        }
      }

      scanned++;
      logger.info('scanner.tenant.done', { tenantId: tenant.id, username: tenant.github_username });
    } catch (err) {
      failed++;
      logger.error('scanner.tenant.error', {
        tenantId: tenant.id,
        username: tenant.github_username,
        error: String(err),
      });
    }
  }

  logger.info('scanner.summary', { scanned, failed, total: rows.length });
}

main().catch((err) => {
  logger.error('scanner.fatal', { error: String(err) });
  process.exit(1);
});
