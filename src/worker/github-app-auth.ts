import { createSign } from 'crypto';
import { logger } from '../utils/logger.js';

interface InstallationTokenResponse {
  token: string;
  expires_at: string;
}

/**
 * Creates a signed JWT for GitHub App authentication.
 * JWT is valid for 10 minutes (GitHub maximum).
 */
function createAppJWT(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: appId,
    iat: now - 60,   // 60s backdate to account for clock drift
    exp: now + 600,  // 10 minute expiry
  })).toString('base64url');

  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(privateKey, 'base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Exchanges a GitHub App JWT for an installation access token.
 * The installation token is valid for 1 hour and can be used
 * as a bearer token with the GitHub API.
 */
export async function getInstallationToken(
  appId: string,
  privateKey: string,
  installationId: number,
): Promise<string> {
  const jwt = createAppJWT(appId, privateKey);

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub App auth failed (${response.status}): ${body}`);
  }

  const data = await response.json() as InstallationTokenResponse;
  logger.info('worker.installation_token_obtained', {
    installationId,
    expiresAt: data.expires_at,
  });

  return data.token;
}
