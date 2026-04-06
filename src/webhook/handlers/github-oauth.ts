import { logger } from '../../utils/logger.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

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
