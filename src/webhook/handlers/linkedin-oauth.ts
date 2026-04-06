import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '../../utils/logger.js';
import { LinkedInClient } from '../../linkedin/client.js';
import type { SupabaseClient } from '@supabase/supabase-js';

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

  // Store in tenant
  const { error } = await db
    .from('tenants')
    .update({
      linkedin_access_token: tokenData.access_token,
      linkedin_member_id: memberUrn,
      linkedin_token_expires_at: expiresAt,
    })
    .eq('github_installation_id', installationId);

  if (error) {
    logger.error('linkedin.callback.save_failed', { installationId, error: error.message });
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
  }

  logger.info('linkedin.callback.connected', { installationId, memberUrn });
  return { status: 302, location: `/onboard?installation_id=${installationId}&saved=1&linkedin=connected` };
}
