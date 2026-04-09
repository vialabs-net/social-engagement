/**
 * Re-encrypt legacy tenant tokens in Supabase using envelope encryption with GCP KMS.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/rotate-tenant-tokens.ts
 *   tsx --env-file=.env.local scripts/rotate-tenant-tokens.ts --dry-run
 *   tsx --env-file=.env.local scripts/rotate-tenant-tokens.ts --tenant-id <uuid>
 */

import { createClient } from '@supabase/supabase-js';
import {
  isEncryptedToken,
  sealTenantSecrets,
} from '../src/security/tenant-secrets.js';

interface TenantRow {
  readonly id: string;
  readonly github_username: string;
  readonly buffer_access_token: string | null;
  readonly linkedin_access_token: string | null;
  readonly encrypted_dek: string | null;
}

function getArgValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function shouldRotateToken(token: string | null, encryptedDek: string | null): boolean {
  if (!token) return false;
  if (!encryptedDek) return true;
  return !isEncryptedToken(token);
}

async function main(): Promise<void> {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  const dryRun = process.argv.includes('--dry-run');
  const tenantId = getArgValue('--tenant-id');
  const db = createClient(supabaseUrl, supabaseKey);

  let query = db
    .from('tenants')
    .select('id, github_username, buffer_access_token, linkedin_access_token, encrypted_dek')
    .or('buffer_access_token.not.is.null,linkedin_access_token.not.is.null')
    .order('created_at', { ascending: true });

  if (tenantId) {
    query = query.eq('id', tenantId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch tenants: ${error.message}`);
  }

  const rows = (data ?? []) as TenantRow[];
  let rotated = 0;
  let skipped = 0;

  for (const row of rows) {
    const rotateBuffer = shouldRotateToken(row.buffer_access_token, row.encrypted_dek);
    const rotateLinkedIn = shouldRotateToken(row.linkedin_access_token, row.encrypted_dek);

    if (!rotateBuffer && !rotateLinkedIn) {
      skipped++;
      console.log(`SKIP ${row.github_username} (${row.id})`);
      continue;
    }

    const sealed = await sealTenantSecrets({
      ...(rotateBuffer ? { bufferAccessToken: row.buffer_access_token } : {}),
      ...(rotateLinkedIn ? { linkedinAccessToken: row.linkedin_access_token } : {}),
    }, row.encrypted_dek);

    const updates: Record<string, string> = {
      encrypted_dek: sealed.encryptedDek,
    };

    if (rotateBuffer && sealed.bufferAccessToken) {
      updates['buffer_access_token'] = sealed.bufferAccessToken;
    }
    if (rotateLinkedIn && sealed.linkedinAccessToken) {
      updates['linkedin_access_token'] = sealed.linkedinAccessToken;
    }

    if (dryRun) {
      console.log(`DRY RUN ${row.github_username} (${row.id})`);
      continue;
    }

    const { error: updateError } = await db
      .from('tenants')
      .update(updates)
      .eq('id', row.id);

    if (updateError) {
      throw new Error(`Failed to rotate tenant ${row.id}: ${updateError.message}`);
    }

    rotated++;
    console.log(`ROTATED ${row.github_username} (${row.id})`);
  }

  console.log('');
  console.log(`Rotated: ${rotated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Dry run: ${dryRun ? 'yes' : 'no'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
