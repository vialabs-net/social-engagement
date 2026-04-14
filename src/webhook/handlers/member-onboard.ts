import { createHmac, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sealTenantSecrets } from '../../security/tenant-secrets.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Member token — encodes installation_id + github_login, HMAC-signed.
// Passed as a query param after GitHub OAuth and as a hidden field in the form.
// No TTL: the token grants access only to that member's own settings.
// ---------------------------------------------------------------------------

export function createMemberToken(
  installationId: number,
  login: string,
  secret: string,
): string {
  const payload = Buffer.from(`${installationId}:${login}`).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function parseMemberToken(
  token: string,
  secret: string,
): { installationId: number; login: string } | null {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;

  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');

  try {
    const sigBuf = Buffer.from(sig, 'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }

  const decoded = Buffer.from(payload, 'base64url').toString('utf8');
  const colon = decoded.indexOf(':');
  if (colon === -1) return null;

  const installationId = parseInt(decoded.slice(0, colon), 10);
  const login = decoded.slice(colon + 1);
  if (isNaN(installationId) || !login) return null;

  return { installationId, login };
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function maskToken(token: string | null): string {
  if (!token) return '';
  return 'configured••••••••';
}

function htmlConnect(installationId: number, orgName: string, githubClientId: string, appBaseUrl: string): string {
  const callbackUrl = `${appBaseUrl}/auth/github/member-callback`;
  const githubUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${installationId}&scope=read:user`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>devcast — Member Setup</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Geist',-apple-system,sans-serif;background:#09090b;color:#f4f4f5;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:#18181b;border:1px solid #27272a;border-radius:16px;padding:40px;max-width:420px;width:100%;text-align:center}
    h1{font-size:1.3rem;font-weight:600;color:#fff;margin-bottom:8px}
    .sub{font-size:.875rem;color:#71717a;margin-bottom:32px}
    .org{display:inline-block;background:#09090b;border:1px solid #27272a;padding:4px 12px;border-radius:9999px;font-size:.75rem;color:#a1a1aa;margin-bottom:24px}
    .btn-github{display:inline-flex;align-items:center;gap:10px;background:#fff;color:#09090b;padding:10px 20px;border-radius:8px;font-size:.875rem;font-weight:500;text-decoration:none;transition:background .15s}
    .btn-github:hover{background:#e4e4e7}
    svg.gh{width:18px;height:18px}
  </style>
</head>
<body>
  <div class="card">
    <h1>Set up your devcast profile</h1>
    <p class="sub">Connect your GitHub account so devcast can identify your commits and publish posts with your voice.</p>
    <div class="org">${escapeHtml(orgName)}</div>
    <br><br>
    <a href="${escapeHtml(githubUrl)}" class="btn-github">
      <svg class="gh" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/></svg>
      Connect with GitHub
    </a>
  </div>
</body>
</html>`;
}

function htmlForm(
  installationId: number,
  login: string,
  memberToken: string,
  orgName: string,
  existing: { bufferConfigured: boolean; linkedinConnected: boolean; bootstrapPosts: string[] },
  saved: boolean,
  linkedinClientId: string,
  appBaseUrl: string,
): string {
  const banner = saved
    ? `<div class="banner"><span class="dot"></span>Saved successfully.</div>`
    : '';

  const linkedinSection = existing.linkedinConnected
    ? `<div class="connected"><span class="dot"></span>LinkedIn connected</div>
       <a href="/auth/linkedin/member?installation_id=${installationId}&member_token=${encodeURIComponent(memberToken)}" class="link-small">Reconnect</a>`
    : `<a href="/auth/linkedin/member?installation_id=${installationId}&member_token=${encodeURIComponent(memberToken)}" class="btn-linkedin">Connect LinkedIn</a>
       <p class="hint-card">Allows devcast to post directly to your LinkedIn feed.</p>`;

  const [v1 = '', v2 = '', v3 = '', v4 = '', v5 = ''] = existing.bootstrapPosts;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>devcast — Member Setup</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Geist',-apple-system,sans-serif;background:#09090b;color:#f4f4f5;min-height:100vh;line-height:1.5}
    nav{border-bottom:1px solid #27272a;padding:16px 24px;display:flex;align-items:center;justify-content:space-between}
    .logo{font-weight:600;font-size:.95rem;color:#fff}
    .account-badge{display:inline-flex;align-items:center;gap:8px;border:1px solid #27272a;background:#18181b;padding:4px 12px;border-radius:9999px;font-size:.75rem;color:#a1a1aa}
    .dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#34d399;flex-shrink:0}
    main{max-width:720px;margin:48px auto;padding:0 24px 48px}
    h1{font-size:1.5rem;font-weight:600;color:#fff;letter-spacing:-.02em;margin-bottom:4px}
    .sub{font-size:.875rem;color:#71717a;margin-bottom:32px}
    .banner{display:flex;align-items:center;gap:8px;background:#052e16;border:1px solid #166534;color:#4ade80;padding:10px 14px;border-radius:8px;margin-bottom:24px;font-size:.875rem}
    .card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;margin-bottom:16px}
    .section-title{font-size:.95rem;font-weight:600;color:#fff;margin-bottom:16px}
    .optional{color:#52525b;font-weight:400}
    label{display:block;font-size:.8rem;font-weight:500;color:#a1a1aa;margin-bottom:6px}
    input[type=text]{width:100%;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:8px;font-size:.875rem;color:#f4f4f5;font-family:inherit;margin-bottom:16px;outline:none}
    textarea{width:100%;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:8px;font-size:.875rem;color:#f4f4f5;font-family:inherit;margin-bottom:16px;outline:none;resize:vertical}
    input::placeholder,textarea::placeholder{color:#3f3f46}
    .hint{font-size:.75rem;color:#52525b;margin-top:-12px;margin-bottom:16px}
    .hint-card{font-size:.75rem;color:#52525b;margin-top:10px}
    .btn-primary{background:#fff;color:#09090b;border:none;padding:9px 20px;border-radius:8px;font-size:.875rem;font-weight:500;cursor:pointer;font-family:inherit}
    .btn-linkedin{display:inline-flex;align-items:center;gap:8px;background:#0077B5;color:#fff;padding:9px 20px;border-radius:8px;font-size:.875rem;font-weight:500;text-decoration:none}
    .connected{display:inline-flex;align-items:center;gap:6px;color:#34d399;font-size:.875rem;font-weight:500}
    .link-small{font-size:.8rem;color:#52525b;text-decoration:none;margin-left:12px}
  </style>
</head>
<body>
  <nav>
    <span class="logo">devcast</span>
    <span class="account-badge"><span class="dot"></span>${escapeHtml(login)} · ${escapeHtml(orgName)}</span>
  </nav>
  <main>
    <h1>Your devcast profile</h1>
    <p class="sub">Configure where your posts go and how your voice sounds. These settings override the organization defaults for your commits.</p>
    ${banner}
    <form method="POST" action="/member/onboard">
      <input type="hidden" name="installation_id" value="${installationId}">
      <input type="hidden" name="member_token" value="${escapeHtml(memberToken)}">

      <div class="card">
        <div class="section-title">Buffer <span class="optional">optional — overrides org token</span></div>
        <label>API key</label>
        <input type="text" name="buffer_access_token" value="${maskToken(existing.bufferConfigured ? 'set' : null)}" placeholder="Paste your personal Buffer API key">
        <p class="hint">Get it at publish.buffer.com → Settings → API. Leave blank to use the organization token.</p>
      </div>

      <div class="card">
        <div class="section-title">Your voice <span class="optional">recommended</span></div>
        <p class="hint-card" style="margin-bottom:16px">Paste 1–5 LinkedIn posts you've written and are proud of. devcast uses them as voice reference until enough real published posts accumulate.</p>
        <label>A post where you explained something technical</label>
        <textarea name="voice_1" rows="4" placeholder="A decision, bug, or implementation you solved.">${escapeHtml(v1)}</textarea>
        <label>A post where you told a story about your work</label>
        <textarea name="voice_2" rows="4" placeholder="A lesson learned, milestone, or surprise.">${escapeHtml(v2)}</textarea>
        <label>A post you liked how it turned out <span class="optional">optional</span></label>
        <textarea name="voice_3" rows="4" placeholder="Any post that feels representative of your voice.">${escapeHtml(v3)}</textarea>
        <label>A shorter or punchier post <span class="optional">optional</span></label>
        <textarea name="voice_4" rows="4" placeholder="A concise post that still sounds like you.">${escapeHtml(v4)}</textarea>
        <label>A different register or mood <span class="optional">optional</span></label>
        <textarea name="voice_5" rows="4" placeholder="Something more reflective, humorous, or technical.">${escapeHtml(v5)}</textarea>
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

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

interface TenantRow {
  readonly id: string;
  readonly github_username: string;
}

interface MemberRow {
  readonly buffer_access_token: string | null;
  readonly linkedin_member_id: string | null;
  readonly encrypted_dek: string | null;
  readonly voice_bootstrap: string | null;
}

export async function handleMemberOnboardGet(
  installationId: number,
  memberToken: string | null,
  saved: boolean,
  db: SupabaseClient,
  webhookSecret: string,
  githubClientId: string,
  linkedinClientId: string,
  appBaseUrl: string,
): Promise<{ status: number; body: string; contentType: string }> {
  const { data: tenantData, error: tenantError } = await db
    .from('tenants')
    .select('id, github_username')
    .eq('github_installation_id', installationId)
    .single();

  if (tenantError || !tenantData) {
    logger.warn('member_onboard.tenant_not_found', { installationId });
    return {
      status: 404,
      body: '<h1>Installation not found</h1><p>Make sure the GitHub App is installed for this organization.</p>',
      contentType: 'text/html',
    };
  }

  const tenant = tenantData as TenantRow;

  // No token yet — show GitHub connect page
  if (!memberToken) {
    return {
      status: 200,
      body: htmlConnect(installationId, tenant.github_username, githubClientId, appBaseUrl),
      contentType: 'text/html',
    };
  }

  // Validate token
  const parsed = parseMemberToken(memberToken, webhookSecret);
  if (!parsed || parsed.installationId !== installationId) {
    logger.warn('member_onboard.invalid_token', { installationId });
    return {
      status: 302,
      body: '',
      contentType: 'text/plain',
    };
  }

  // Load existing member row
  const { data: memberData } = await db
    .from('tenant_members')
    .select('buffer_access_token, linkedin_member_id, encrypted_dek, voice_bootstrap')
    .eq('tenant_id', tenant.id)
    .eq('github_author_login', parsed.login)
    .maybeSingle();

  const member = (memberData ?? null) as MemberRow | null;
  let bootstrapPosts: string[] = [];
  try {
    bootstrapPosts = JSON.parse(member?.voice_bootstrap ?? '[]') as string[];
  } catch {
    bootstrapPosts = [];
  }

  return {
    status: 200,
    body: htmlForm(
      installationId,
      parsed.login,
      memberToken,
      tenant.github_username,
      {
        bufferConfigured: !!member?.buffer_access_token,
        linkedinConnected: !!member?.linkedin_member_id,
        bootstrapPosts,
      },
      saved,
      linkedinClientId,
      appBaseUrl,
    ),
    contentType: 'text/html',
  };
}

export async function handleMemberOnboardPost(
  rawBody: string,
  db: SupabaseClient,
  webhookSecret: string,
): Promise<{ status: number; location: string }> {
  const params = new URLSearchParams(rawBody);
  const installationId = parseInt(params.get('installation_id') ?? '', 10);
  const memberToken = params.get('member_token') ?? '';

  if (isNaN(installationId) || !memberToken) {
    return { status: 302, location: '/member/onboard?error=missing_fields' };
  }

  const parsed = parseMemberToken(memberToken, webhookSecret);
  if (!parsed || parsed.installationId !== installationId) {
    logger.warn('member_onboard.invalid_token_post', { installationId });
    return { status: 302, location: '/member/onboard?error=invalid_token' };
  }

  const { login } = parsed;

  const { data: tenantData, error: tenantError } = await db
    .from('tenants')
    .select('id')
    .eq('github_installation_id', installationId)
    .single();

  if (tenantError || !tenantData) {
    return { status: 302, location: `/member/onboard?installation_id=${installationId}&error=not_found` };
  }

  const tenantId = (tenantData as { id: string }).id;

  // Load existing member row to reuse DEK
  const { data: existingMember } = await db
    .from('tenant_members')
    .select('encrypted_dek')
    .eq('tenant_id', tenantId)
    .eq('github_author_login', login)
    .maybeSingle();

  const existingDek = (existingMember as { encrypted_dek: string | null } | null)?.encrypted_dek ?? null;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // Buffer token — skip if placeholder or empty
  const bufferToken = params.get('buffer_access_token')?.trim() ?? '';
  if (bufferToken && !bufferToken.includes('••')) {
    try {
      const sealed = await sealTenantSecrets({ bufferAccessToken: bufferToken }, existingDek);
      updates['buffer_access_token'] = sealed.bufferAccessToken ?? null;
      updates['encrypted_dek'] = sealed.encryptedDek;
    } catch (err) {
      logger.error('member_onboard.buffer_encrypt_failed', { login, error: String(err) });
      return { status: 302, location: `/member/onboard?installation_id=${installationId}&member_token=${encodeURIComponent(memberToken)}&error=save_failed` };
    }
  }

  // Bootstrap posts
  const voices = [
    params.get('voice_1')?.trim() ?? '',
    params.get('voice_2')?.trim() ?? '',
    params.get('voice_3')?.trim() ?? '',
    params.get('voice_4')?.trim() ?? '',
    params.get('voice_5')?.trim() ?? '',
  ].filter(Boolean);
  updates['voice_bootstrap'] = JSON.stringify(voices);

  // Upsert member row
  const { error: upsertError } = await db
    .from('tenant_members')
    .upsert(
      {
        tenant_id: tenantId,
        github_author_login: login,
        ...updates,
      },
      { onConflict: 'tenant_id,github_author_login' },
    );

  if (upsertError) {
    logger.error('member_onboard.save_failed', { login, error: upsertError.message });
    return { status: 302, location: `/member/onboard?installation_id=${installationId}&member_token=${encodeURIComponent(memberToken)}&error=save_failed` };
  }

  logger.info('member_onboard.saved', { login, tenantId });
  return {
    status: 302,
    location: `/member/onboard?installation_id=${installationId}&member_token=${encodeURIComponent(memberToken)}&saved=1`,
  };
}
