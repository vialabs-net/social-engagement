import { logger } from '../../utils/logger.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMemberToken } from './member-onboard.js';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

/**
 * Handles the GitHub App OAuth callback after installation.
 * GitHub redirects here with ?code=...&installation_id=...
 *
 * The code exchange is the security gate — only a user who completed
 * GitHub's OAuth flow has a valid single-use code (expires in 10 min).
 * After exchange succeeds, redirect to onboarding.
 */
export async function handleGitHubCallback(
  code: string,
  installationId: number,
  clientId: string,
  clientSecret: string,
): Promise<{ status: number; location: string }> {
  if (!code || isNaN(installationId)) {
    logger.warn('github.callback.invalid_params', { installationId });
    return { status: 302, location: '/onboard?error=invalid_params' };
  }

  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!tokenRes.ok) {
    logger.error('github.callback.token_exchange_failed', { status: tokenRes.status });
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=auth_failed` };
  }

  const data = await tokenRes.json() as { access_token?: string; error?: string };

  if (!data.access_token || data.error) {
    logger.error('github.callback.token_invalid', { error: data.error });
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=auth_failed` };
  }

  logger.info('github.callback.success', { installationId });
  return { status: 302, location: `/onboard?installation_id=${installationId}` };
}

/**
 * Handles the GitHub OAuth callback for member onboarding.
 * State param carries installationId (no HMAC — not sensitive).
 * Exchanges code → fetches /user login → creates signed member_token → redirects to /member/onboard.
 */
export async function handleGitHubMemberCallback(
  code: string,
  state: string,
  clientId: string,
  clientSecret: string,
  webhookSecret: string,
): Promise<{ status: number; location: string }> {
  const isPostsRedirect = state.startsWith('posts:');
  const rawId = isPostsRedirect ? state.slice('posts:'.length) : state;
  const installationId = parseInt(rawId, 10);
  if (!code || isNaN(installationId)) {
    logger.warn('github.member_callback.invalid_params', { state });
    return { status: 302, location: '/member/onboard?error=invalid_params' };
  }

  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  if (!tokenRes.ok) {
    logger.error('github.member_callback.token_exchange_failed', { status: tokenRes.status });
    return { status: 302, location: `/member/onboard?installation_id=${installationId}&error=auth_failed` };
  }

  const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
  if (!tokenData.access_token || tokenData.error) {
    logger.error('github.member_callback.token_invalid', { error: tokenData.error });
    return { status: 302, location: `/member/onboard?installation_id=${installationId}&error=auth_failed` };
  }

  const userRes = await fetch(GITHUB_USER_URL, {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Accept': 'application/vnd.github+json',
    },
  });

  if (!userRes.ok) {
    logger.error('github.member_callback.user_fetch_failed', { status: userRes.status });
    return { status: 302, location: `/member/onboard?installation_id=${installationId}&error=profile_failed` };
  }

  const user = await userRes.json() as { login?: string };
  if (!user.login) {
    logger.error('github.member_callback.no_login');
    return { status: 302, location: `/member/onboard?installation_id=${installationId}&error=profile_failed` };
  }

  const memberToken = createMemberToken(installationId, user.login, webhookSecret);

  const destination = isPostsRedirect ? 'posts' : 'member/onboard';
  logger.info('github.member_callback.success', { installationId, login: user.login, destination });
  return {
    status: 302,
    location: `/${destination}?installation_id=${installationId}&member_token=${encodeURIComponent(memberToken)}`,
  };
}
