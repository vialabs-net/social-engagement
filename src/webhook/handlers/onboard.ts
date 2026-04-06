import { logger } from '../../utils/logger.js';
import type { SupabaseClient } from '@supabase/supabase-js';

interface TenantRow {
  readonly id: string;
  readonly github_username: string;
  readonly buffer_access_token: string | null;
  readonly linkedin_member_id: string | null;
  readonly config: Record<string, unknown>;
  readonly voice_bootstrap: string | null;
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
  const voiceBootstrap = tenant.voice_bootstrap ?? '';

  const linkedinConnected = !!tenant.linkedin_member_id;
  const linkedinSection = linkedinConnected
    ? `<div class="connected"><span class="dot"></span>LinkedIn connected</div>
       <a href="/auth/linkedin?installation_id=${installationId}" class="link-small">Reconnect</a>`
    : `<a href="/auth/linkedin?installation_id=${installationId}" class="btn-linkedin">Connect LinkedIn</a>
       <p class="hint-card">Allows devcast to post directly to your LinkedIn feed.</p>`;

  const banner = saved
    ? `<div class="banner"><span class="dot"></span>Saved successfully.</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>devcast — Setup</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Geist',-apple-system,BlinkMacSystemFont,sans-serif;background:#09090b;color:#f4f4f5;min-height:100vh;line-height:1.5}
    nav{border-bottom:1px solid #27272a;padding:16px 24px;display:flex;align-items:center;justify-content:space-between}
    .logo{font-weight:600;font-size:.95rem;letter-spacing:-.02em;color:#fff}
    .account-badge{display:inline-flex;align-items:center;gap:8px;border:1px solid #27272a;background:#18181b;padding:4px 12px;border-radius:9999px;font-size:.75rem;color:#a1a1aa}
    .dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#34d399;flex-shrink:0}
    main{max-width:480px;margin:48px auto;padding:0 24px 48px}
    h1{font-size:1.5rem;font-weight:600;color:#fff;letter-spacing:-.02em;margin-bottom:4px}
    .sub{font-size:.875rem;color:#71717a;margin-bottom:32px}
    .banner{display:flex;align-items:center;gap:8px;background:#052e16;border:1px solid #166534;color:#4ade80;padding:10px 14px;border-radius:8px;margin-bottom:24px;font-size:.875rem}
    .card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;margin-bottom:16px}
    .section-title{font-size:.875rem;font-weight:600;color:#fff;margin-bottom:16px}
    .optional{color:#52525b;font-weight:400}
    label{display:block;font-size:.8rem;font-weight:500;color:#a1a1aa;margin-bottom:6px}
    input[type=text],input[type=url]{width:100%;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:8px;font-size:.875rem;color:#f4f4f5;font-family:inherit;margin-bottom:16px;outline:none;transition:border-color .15s}
    input[type=text]:focus,input[type=url]:focus{border-color:#52525b}
    input::placeholder{color:#3f3f46}
    .hint{font-size:.75rem;color:#52525b;margin-top:-12px;margin-bottom:16px}
    .hint-card{font-size:.75rem;color:#52525b;margin-top:10px}
    textarea{width:100%;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:8px;font-size:.875rem;color:#f4f4f5;font-family:inherit;margin-bottom:16px;outline:none;transition:border-color .15s;resize:vertical}
    textarea:focus{border-color:#52525b}
    textarea::placeholder{color:#3f3f46}
    .btn-primary{background:#fff;color:#09090b;border:none;padding:9px 20px;border-radius:8px;font-size:.875rem;font-weight:500;cursor:pointer;font-family:inherit;transition:background .15s}
    .btn-primary:hover{background:#e4e4e7}
    .btn-linkedin{display:inline-flex;align-items:center;gap:8px;background:#0077B5;color:#fff;padding:9px 20px;border-radius:8px;font-size:.875rem;font-weight:500;text-decoration:none;transition:background .15s}
    .btn-linkedin:hover{background:#005f8e}
    .connected{display:inline-flex;align-items:center;gap:6px;color:#34d399;font-size:.875rem;font-weight:500}
    .link-small{font-size:.8rem;color:#52525b;text-decoration:none;margin-left:12px;transition:color .15s}
    .link-small:hover{color:#a1a1aa}
  </style>
</head>
<body>
  <nav>
    <img src="/favicon.png" alt="devcast" style="height:24px">
    <span class="account-badge"><span class="dot"></span>${tenant.github_username}</span>
  </nav>
  <main>
    <h1>Setup</h1>
    <p class="sub">Configure how devcast generates posts for you.</p>
    ${banner}
    <form method="POST" action="/onboard">
      <input type="hidden" name="installation_id" value="${installationId}">
      <div class="card">
        <div class="section-title">About you</div>
        <label>Name <span class="optional">(used in posts)</span></label>
        <input type="text" name="name" value="${name}" placeholder="Your Name" required>
        <label>Website <span class="optional">optional</span></label>
        <input type="url" name="website" value="${website}" placeholder="https://yoursite.com">
      </div>
      <div class="card">
        <div class="section-title">Your voice <span class="optional">recommended</span></div>
        <label>Paste 2-3 posts you've written before</label>
        <textarea name="voice_bootstrap" rows="6" placeholder="Paste any LinkedIn post, blog excerpt, or text that sounds like you. This teaches devcast your writing voice.">${voiceBootstrap}</textarea>
        <p class="hint">devcast learns your tone, style, and personality from these examples. Better examples = posts that sound more like you.</p>
      </div>
      <div class="card">
        <div class="section-title">Buffer <span class="optional">optional</span></div>
        <label>API key</label>
        <input type="text" name="buffer_access_token" value="${maskToken(tenant.buffer_access_token)}" placeholder="Paste your Buffer API key">
        <p class="hint">Get it at publish.buffer.com → Settings → API</p>
        <label>Organization ID</label>
        <input type="text" name="buffer_org_id" value="${bufferOrgId}" placeholder="org_...">
        <p class="hint">Required to create Buffer Ideas. Leave blank if using LinkedIn direct only.</p>
      </div>
      <button type="submit" class="btn-primary">Save</button>
    </form>
    <div class="card" style="margin-top:16px">
      <div class="section-title">LinkedIn</div>
      ${linkedinSection}
    </div>
  </main>
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
    .select('id, github_username, buffer_access_token, linkedin_member_id, config, voice_bootstrap')
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
  const voiceBootstrap = params.get('voice_bootstrap')?.trim() ?? '';

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

  // Save voice bootstrap if provided
  if (voiceBootstrap) {
    updates['voice_bootstrap'] = voiceBootstrap;
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
