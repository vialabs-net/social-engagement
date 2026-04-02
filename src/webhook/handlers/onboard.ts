import { logger } from '../../utils/logger.js';
import type { SupabaseClient } from '@supabase/supabase-js';

interface TenantRow {
  readonly id: string;
  readonly github_username: string;
  readonly buffer_access_token: string | null;
  readonly linkedin_member_id: string | null;
  readonly config: Record<string, unknown>;
}

function maskToken(token: string | null): string {
  if (!token) return '';
  return token.slice(0, 6) + '••••••••';
}

function html(tenant: TenantRow, installationId: number, linkedinClientId: string, appBaseUrl: string, saved: boolean): string {
  const cfg = tenant.config;
  const author = (cfg['author'] as Record<string, unknown> | undefined) ?? {};
  const buffer = (cfg['buffer'] as Record<string, unknown> | undefined) ?? {};

  const name = (author['name'] as string | undefined) ?? tenant.github_username;
  const website = (author['website'] as string | undefined) ?? '';
  const bufferOrgId = (buffer['organization_id'] as string | undefined) ?? '';

  const linkedinConnected = !!tenant.linkedin_member_id;
  const linkedinSection = linkedinConnected
    ? `<p class="connected">✓ LinkedIn connected</p>
       <a href="/auth/linkedin?installation_id=${installationId}" class="link-small">Reconnect</a>`
    : `<a href="/auth/linkedin?installation_id=${installationId}" class="btn-linkedin">Connect LinkedIn</a>
       <p class="hint">Allows devcast to post directly to your LinkedIn feed.</p>`;

  const banner = saved
    ? `<div class="banner">Saved successfully.</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>devcast — Setup</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:540px;margin:60px auto;padding:0 20px;color:#111;line-height:1.5}
    h1{font-size:1.4rem;margin-bottom:2px}
    .sub{color:#666;margin-top:0;margin-bottom:28px}
    .section{margin-bottom:28px}
    .section-title{font-weight:600;font-size:.95rem;border-bottom:1px solid #eee;padding-bottom:6px;margin-bottom:14px}
    label{display:block;font-size:.85rem;font-weight:500;margin-bottom:3px}
    input{width:100%;padding:8px 10px;border:1px solid #ccc;border-radius:6px;font-size:.9rem;margin-bottom:14px}
    .hint{font-size:.78rem;color:#888;margin-top:-10px;margin-bottom:14px}
    .optional{color:#aaa;font-weight:400;font-size:.78rem;margin-left:3px}
    button{background:#000;color:#fff;border:none;padding:9px 20px;border-radius:6px;font-size:.9rem;cursor:pointer}
    button:hover{background:#333}
    .btn-linkedin{display:inline-block;background:#0077B5;color:#fff;padding:9px 20px;border-radius:6px;font-size:.9rem;text-decoration:none}
    .btn-linkedin:hover{background:#005f8e}
    .connected{color:#16a34a;font-weight:500;margin:0}
    .link-small{font-size:.8rem;color:#666}
    .banner{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;padding:10px 14px;border-radius:6px;margin-bottom:20px;font-size:.875rem}
  </style>
</head>
<body>
  <h1>devcast setup</h1>
  <p class="sub">GitHub account: <strong>${tenant.github_username}</strong></p>
  ${banner}
  <form method="POST" action="/onboard">
    <input type="hidden" name="installation_id" value="${installationId}">

    <div class="section">
      <div class="section-title">About you</div>
      <label>Name <span class="optional">(used in posts)</span></label>
      <input type="text" name="name" value="${name}" placeholder="Your Name" required>
      <label>Website <span class="optional">optional</span></label>
      <input type="url" name="website" value="${website}" placeholder="https://yoursite.com">
    </div>

    <div class="section">
      <div class="section-title">Buffer <span class="optional">optional</span></div>
      <label>API key</label>
      <input type="text" name="buffer_access_token" value="${maskToken(tenant.buffer_access_token)}" placeholder="Paste your Buffer API key">
      <p class="hint">Get it at publish.buffer.com → Settings → API</p>
      <label>Organization ID</label>
      <input type="text" name="buffer_org_id" value="${bufferOrgId}" placeholder="org_...">
      <p class="hint">Required to create Buffer Ideas. Leave blank if using LinkedIn direct only.</p>
    </div>

    <button type="submit">Save</button>
  </form>

  <div class="section" style="margin-top:32px">
    <div class="section-title">LinkedIn</div>
    ${linkedinSection}
  </div>
</body>
</html>`;
}

export async function handleOnboardGet(
  installationId: number,
  db: SupabaseClient,
  linkedinClientId: string,
  appBaseUrl: string,
  saved: boolean,
): Promise<{ status: number; body: string; contentType: string }> {
  const { data, error } = await db
    .from('tenants')
    .select('id, github_username, buffer_access_token, linkedin_member_id, config')
    .eq('github_installation_id', installationId)
    .single();

  if (error || !data) {
    logger.warn('onboard.tenant_not_found', { installationId });
    return {
      status: 404,
      body: '<h1>Installation not found</h1><p>Make sure you installed the GitHub App first.</p>',
      contentType: 'text/html',
    };
  }

  return {
    status: 200,
    body: html(data as TenantRow, installationId, linkedinClientId, appBaseUrl, saved),
    contentType: 'text/html',
  };
}

export async function handleOnboardPost(
  rawBody: string,
  db: SupabaseClient,
): Promise<{ status: number; location: string }> {
  const params = new URLSearchParams(rawBody);
  const installationId = parseInt(params.get('installation_id') ?? '', 10);
  const name = params.get('name')?.trim() ?? '';
  const website = params.get('website')?.trim() ?? '';
  const bufferToken = params.get('buffer_access_token')?.trim() ?? '';
  const bufferOrgId = params.get('buffer_org_id')?.trim() ?? '';

  if (isNaN(installationId) || !name) {
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=missing_fields` };
  }

  // Fetch current tenant to merge config
  const { data: tenant, error: fetchError } = await db
    .from('tenants')
    .select('id, config')
    .eq('github_installation_id', installationId)
    .single();

  if (fetchError || !tenant) {
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=not_found` };
  }

  const existingConfig = (tenant as { config: Record<string, unknown> }).config;

  const updatedConfig: Record<string, unknown> = {
    ...existingConfig,
    author: {
      ...((existingConfig['author'] as Record<string, unknown> | undefined) ?? {}),
      name,
      ...(website && { website }),
    },
    buffer: {
      ...((existingConfig['buffer'] as Record<string, unknown> | undefined) ?? {}),
      ...(bufferOrgId && { organization_id: bufferOrgId }),
    },
  };

  const updates: Record<string, unknown> = { config: updatedConfig };

  // Only update buffer_access_token if a new one was provided (not the masked placeholder)
  if (bufferToken && !bufferToken.includes('••')) {
    updates['buffer_access_token'] = bufferToken;
  }

  const { error: updateError } = await db
    .from('tenants')
    .update(updates)
    .eq('github_installation_id', installationId);

  if (updateError) {
    logger.error('onboard.save_failed', { installationId, error: updateError.message });
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
  }

  logger.info('onboard.saved', { installationId, name });
  return { status: 302, location: `/onboard?installation_id=${installationId}&saved=1` };
}
