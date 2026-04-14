import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '../../utils/logger.js';
import { LinkedInClient } from '../../linkedin/client.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sealTenantSecrets } from '../../security/tenant-secrets.js';
import { parseMemberToken } from './member-onboard.js';

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const SCOPES = 'openid profile w_member_social';

function createState(installationId: number, secret: string): string {
  const id = String(installationId);
  const sig = createHmac('sha256', secret).update(id).digest('base64url');
  return `${id}.${sig}`;
}

function parseState(state: string, secret: string): number | null {
  const dot = state.lastIndexOf('.');
  if (dot === -1) return null;
  const id = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac('sha256', secret).update(id).digest('base64url');
  try {
    const sigBuf = Buffer.from(sig, 'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

/**
 * Builds the LinkedIn OAuth authorization URL and redirects the user.
 */
export function handleLinkedInRedirect(
  installationId: number,
  webhookSecret: string,
  clientId: string,
  appBaseUrl: string,
): string {
  const state = createState(installationId, webhookSecret);
  const redirectUri = `${appBaseUrl}/auth/linkedin/callback`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: SCOPES,
  });

  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * Handles the LinkedIn OAuth callback:
 * 1. Validates state (CSRF guard)
 * 2. Exchanges code for token
 * 3. Fetches member URN
 * 4. Stores token + member_id in tenant row
 */
export async function handleLinkedInCallback(
  code: string,
  state: string,
  webhookSecret: string,
  clientId: string,
  clientSecret: string,
  appBaseUrl: string,
  db: SupabaseClient,
): Promise<{ status: number; location: string }> {
  const installationId = parseState(state, webhookSecret);
  if (!installationId) {
    logger.warn('linkedin.callback.invalid_state');
    return { status: 302, location: '/onboard?error=invalid_state' };
  }

  // Exchange code for token
  const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${appBaseUrl}/auth/linkedin/callback`,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    logger.error('linkedin.callback.token_exchange_failed', { status: tokenRes.status, body });
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=linkedin_token_failed` };
  }

  const tokenData = await tokenRes.json() as TokenResponse;
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  // Fetch member URN
  let memberUrn: string;
  try {
    const client = new LinkedInClient(tokenData.access_token);
    memberUrn = await client.getMemberUrn();
  } catch (err) {
    logger.error('linkedin.callback.member_fetch_failed', { error: String(err) });
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=linkedin_profile_failed` };
  }

  const { data: tenant, error: tenantError } = await db
    .from('tenants')
    .select('encrypted_dek')
    .eq('github_installation_id', installationId)
    .single();

  if (tenantError || !tenant) {
    logger.error('linkedin.callback.tenant_fetch_failed', { installationId, error: tenantError?.message ?? 'no data' });
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
  }

  let sealed;
  try {
    sealed = await sealTenantSecrets(
      { linkedinAccessToken: tokenData.access_token },
      (tenant as { encrypted_dek: string | null }).encrypted_dek,
    );
  } catch (err) {
    logger.error('linkedin.callback.token_encrypt_failed', { installationId, error: String(err) });
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
  }

  // Store in tenant
  const { error } = await db
    .from('tenants')
    .update({
      linkedin_access_token: sealed.linkedinAccessToken ?? null,
      linkedin_member_id: memberUrn,
      linkedin_token_expires_at: expiresAt,
      encrypted_dek: sealed.encryptedDek,
    })
    .eq('github_installation_id', installationId);

  if (error) {
    logger.error('linkedin.callback.save_failed', { installationId, error: error.message });
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
  }

  logger.info('linkedin.callback.connected', { installationId, memberUrn });
  return { status: 302, location: `/onboard?installation_id=${installationId}&saved=1&linkedin=connected` };
}

// ---------------------------------------------------------------------------
// Member-level LinkedIn OAuth
// State encodes: m.{base64url(installationId:memberToken)}.{hmac}
// The m. prefix lets the callback route distinguish member vs org OAuth.
// ---------------------------------------------------------------------------

function createMemberState(installationId: number, memberToken: string, secret: string): string {
  const inner = Buffer.from(`${installationId}:${memberToken}`).toString('base64url');
  const payload = `m.${inner}`;
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function parseMemberState(
  state: string,
  secret: string,
): { installationId: number; memberToken: string } | null {
  const firstDot = state.indexOf('.');
  if (firstDot === -1 || state.slice(0, firstDot) !== 'm') return null;

  const lastDot = state.lastIndexOf('.');
  if (lastDot === firstDot) return null;

  const payload = state.slice(0, lastDot);
  const sig = state.slice(lastDot + 1);
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');

  try {
    const sigBuf = Buffer.from(sig, 'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }

  const inner = payload.slice(2); // strip 'm.'
  const decoded = Buffer.from(inner, 'base64url').toString('utf8');
  const colon = decoded.indexOf(':');
  if (colon === -1) return null;

  const installationId = parseInt(decoded.slice(0, colon), 10);
  const memberToken = decoded.slice(colon + 1);
  if (isNaN(installationId) || !memberToken) return null;

  return { installationId, memberToken };
}

/**
 * Builds the LinkedIn OAuth URL for a member.
 * Same redirect_uri as the org flow — the m. prefix in state routes it on return.
 */
export function handleLinkedInMemberRedirect(
  installationId: number,
  memberToken: string,
  webhookSecret: string,
  clientId: string,
  appBaseUrl: string,
): string {
  const state = createMemberState(installationId, memberToken, webhookSecret);
  const redirectUri = `${appBaseUrl}/auth/linkedin/callback`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: SCOPES,
  });

  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

/**
 * Handles the LinkedIn OAuth callback for a member.
 * Validates state, exchanges code, fetches member URN, upserts tenant_members.
 */
export async function handleLinkedInMemberCallback(
  code: string,
  state: string,
  webhookSecret: string,
  clientId: string,
  clientSecret: string,
  appBaseUrl: string,
  db: SupabaseClient,
): Promise<{ status: number; location: string }> {
  const parsed = parseMemberState(state, webhookSecret);
  if (!parsed) {
    logger.warn('linkedin.member_callback.invalid_state');
    return { status: 302, location: '/member/onboard?error=invalid_state' };
  }

  const { installationId, memberToken } = parsed;

  const parsedToken = parseMemberToken(memberToken, webhookSecret);
  if (!parsedToken || parsedToken.installationId !== installationId) {
    logger.warn('linkedin.member_callback.invalid_member_token', { installationId });
    return { status: 302, location: '/member/onboard?error=invalid_token' };
  }

  const { login } = parsedToken;

  const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${appBaseUrl}/auth/linkedin/callback`,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    logger.error('linkedin.member_callback.token_exchange_failed', { status: tokenRes.status, body });
    return {
      status: 302,
      location: `/member/onboard?installation_id=${installationId}&member_token=${encodeURIComponent(memberToken)}&error=linkedin_token_failed`,
    };
  }

  const tokenData = await tokenRes.json() as TokenResponse;
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  let memberUrn: string;
  try {
    const client = new LinkedInClient(tokenData.access_token);
    memberUrn = await client.getMemberUrn();
  } catch (err) {
    logger.error('linkedin.member_callback.member_fetch_failed', { error: String(err) });
    return {
      status: 302,
      location: `/member/onboard?installation_id=${installationId}&member_token=${encodeURIComponent(memberToken)}&error=linkedin_profile_failed`,
    };
  }

  const { data: tenantData, error: tenantError } = await db
    .from('tenants')
    .select('id')
    .eq('github_installation_id', installationId)
    .single();

  if (tenantError || !tenantData) {
    logger.error('linkedin.member_callback.tenant_not_found', { installationId });
    return {
      status: 302,
      location: `/member/onboard?installation_id=${installationId}&member_token=${encodeURIComponent(memberToken)}&error=not_found`,
    };
  }

  const tenantId = (tenantData as { id: string }).id;

  const { data: existingMember } = await db
    .from('tenant_members')
    .select('encrypted_dek')
    .eq('tenant_id', tenantId)
    .eq('github_author_login', login)
    .maybeSingle();

  const existingDek = (existingMember as { encrypted_dek: string | null } | null)?.encrypted_dek ?? null;

  let sealed;
  try {
    sealed = await sealTenantSecrets({ linkedinAccessToken: tokenData.access_token }, existingDek);
  } catch (err) {
    logger.error('linkedin.member_callback.token_encrypt_failed', { login, error: String(err) });
    return {
      status: 302,
      location: `/member/onboard?installation_id=${installationId}&member_token=${encodeURIComponent(memberToken)}&error=save_failed`,
    };
  }

  const { error: upsertError } = await db
    .from('tenant_members')
    .upsert(
      {
        tenant_id: tenantId,
        github_author_login: login,
        linkedin_access_token: sealed.linkedinAccessToken ?? null,
        linkedin_member_id: memberUrn,
        linkedin_token_expires_at: expiresAt,
        encrypted_dek: sealed.encryptedDek,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,github_author_login' },
    );

  if (upsertError) {
    logger.error('linkedin.member_callback.save_failed', { login, error: upsertError.message });
    return {
      status: 302,
      location: `/member/onboard?installation_id=${installationId}&member_token=${encodeURIComponent(memberToken)}&error=save_failed`,
    };
  }

  logger.info('linkedin.member_callback.connected', { installationId, login, memberUrn });
  return {
    status: 302,
    location: `/member/onboard?installation_id=${installationId}&member_token=${encodeURIComponent(memberToken)}&saved=1&linkedin=connected`,
  };
}
