/**
 * setup-linkedin.ts
 *
 * One-time OAuth flow to obtain a LinkedIn access token.
 * Starts a local HTTP server on port 8000 to receive the callback.
 *
 * Usage:
 *   LINKEDIN_CLIENT_ID=... LINKEDIN_CLIENT_SECRET=... tsx --env-file=.env.local scripts/setup-linkedin.ts
 */

import { createServer } from 'http';
import { createInterface } from 'readline';

const CLIENT_ID = process.env['LINKEDIN_CLIENT_ID'] ?? '';
const CLIENT_SECRET = process.env['LINKEDIN_CLIENT_SECRET'] ?? '';
const REDIRECT_URI = 'http://localhost:8000/callback';
const SCOPES = ['w_member_social', 'openid', 'profile'].join(' ');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET');
  process.exit(1);
}

const state = Math.random().toString(36).slice(2);

const authUrl =
  `https://www.linkedin.com/oauth/v2/authorization` +
  `?response_type=code` +
  `&client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&state=${state}`;

console.log('\n── LinkedIn OAuth Setup ──────────────────────────');
console.log('Open this URL in your browser:\n');
console.log(authUrl);
console.log('\nWaiting for callback on http://localhost:8000/callback ...\n');

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:8000`);

  if (url.pathname !== '/callback') {
    res.writeHead(404);
    res.end();
    return;
  }

  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Error: ${error} — ${url.searchParams.get('error_description') ?? ''}`);
    console.error(`\nLinkedIn OAuth error: ${error}`);
    server.close();
    process.exit(1);
  }

  if (!code || returnedState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Invalid state or missing code.');
    server.close();
    process.exit(1);
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  const json = await tokenRes.json() as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !json.access_token) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Token exchange failed: ${json.error_description ?? JSON.stringify(json)}`);
    console.error('\nToken exchange failed:', json);
    server.close();
    process.exit(1);
  }

  const expiresInDays = json.expires_in ? Math.floor(json.expires_in / 86400) : 60;

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Done. You can close this tab.');

  console.log('\n── Success ───────────────────────────────────────');
  console.log(`Access token (expires in ~${expiresInDays} days):\n`);
  console.log(json.access_token);
  console.log('\nAdd this to GitHub Actions secrets:');
  console.log('  Name:  LINKEDIN_ACCESS_TOKEN');
  console.log(`  Value: ${json.access_token}`);
  console.log('\nAlso add to .env.local for local dev:');
  console.log(`  LINKEDIN_ACCESS_TOKEN=${json.access_token}`);
  console.log('──────────────────────────────────────────────────\n');

  server.close();
});

server.listen(8000);
