import { createClient } from '@supabase/supabase-js';
import { resolveTenantSecrets, sealTenantSecrets } from '../src/security/tenant-secrets.js';

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const GITHUB_LOGIN = process.env['GITHUB_LOGIN'] ?? '';
const NEW_BUFFER_TOKEN = process.env['NEW_BUFFER_TOKEN'] ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GITHUB_LOGIN || !NEW_BUFFER_TOKEN) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GITHUB_LOGIN, NEW_BUFFER_TOKEN');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await db
  .from('developer_profiles')
  .select('github_login, encrypted_dek, buffer_access_token')
  .eq('github_login', GITHUB_LOGIN)
  .maybeSingle();

if (error || !data) {
  console.error('Failed to load profile:', error?.message ?? 'not found');
  process.exit(1);
}

const row = data as { github_login: string; encrypted_dek: string | null; buffer_access_token: string | null };

const sealed = await sealTenantSecrets(
  { bufferAccessToken: NEW_BUFFER_TOKEN },
  row.encrypted_dek,
);

const { error: updateError } = await db
  .from('developer_profiles')
  .update({
    buffer_access_token: sealed.bufferAccessToken ?? null,
    encrypted_dek: sealed.encryptedDek,
  })
  .eq('github_login', GITHUB_LOGIN);

if (updateError) {
  console.error('Update failed:', updateError.message);
  process.exit(1);
}

console.log(`Buffer token updated for ${GITHUB_LOGIN}`);
