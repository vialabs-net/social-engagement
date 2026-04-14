import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAVICON = readFileSync(resolve(__dirname, '../../public/favicon.png'));
import { createClient } from '@supabase/supabase-js';
import { handleGithubWebhook } from './github-handler.js';
import { handleOnboardGet, handleOnboardPost } from './handlers/onboard.js';
import { handleLinkedInRedirect, handleLinkedInCallback, handleLinkedInMemberRedirect, handleLinkedInMemberCallback } from './handlers/linkedin-oauth.js';
import { handleGitHubCallback, handleGitHubMemberCallback } from './handlers/github-oauth.js';
import { handleMemberOnboardGet, handleMemberOnboardPost } from './handlers/member-onboard.js';
import { logger } from '../utils/logger.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const WEBHOOK_SECRET = process.env['GITHUB_WEBHOOK_SECRET'] ?? '';
const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const LINKEDIN_CLIENT_ID = process.env['LINKEDIN_CLIENT_ID'] ?? '';
const LINKEDIN_CLIENT_SECRET = process.env['LINKEDIN_CLIENT_SECRET'] ?? '';
const APP_BASE_URL = process.env['APP_BASE_URL'] ?? '';
const GITHUB_APP_CLIENT_ID = process.env['GITHUB_APP_CLIENT_ID'] ?? '';
const GITHUB_APP_CLIENT_SECRET = process.env['GITHUB_APP_CLIENT_SECRET'] ?? '';

if (!WEBHOOK_SECRET) {
  logger.error('server.missing_env', { var: 'GITHUB_WEBHOOK_SECRET' });
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  logger.error('server.missing_env', { var: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const deps = { db };

function parseUrl(raw: string): { path: string; query: URLSearchParams } {
  const [path, qs = ''] = raw.split('?');
  return { path: path ?? '/', query: new URLSearchParams(qs) };
}

const server = createServer((req, res) => {
  const { path, query } = parseUrl(req.url ?? '/');

  // Favicon
  if (req.method === 'GET' && path === '/favicon.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(FAVICON);
    return;
  }

  // Health check — Cloud Run requires this to mark the instance healthy
  if (req.method === 'GET' && path === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  // Onboarding page
  if (req.method === 'GET' && (path === '/onboard' || path === '/settings/voice')) {
    const installationId = parseInt(query.get('installation_id') ?? '', 10);
    const saved = query.get('saved') === '1';
    if (isNaN(installationId)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing installation_id');
      return;
    }
    handleOnboardGet(installationId, db, LINKEDIN_CLIENT_ID, APP_BASE_URL, saved)
      .then(({ status, body, contentType }) => {
        res.writeHead(status, { 'Content-Type': contentType });
        res.end(body);
      })
      .catch((err: unknown) => {
        logger.error('server.onboard_error', { error: String(err) });
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal error');
      });
    return;
  }

  // Onboarding form submission
  if (req.method === 'POST' && (path === '/onboard' || path === '/settings/voice')) {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      handleOnboardPost(rawBody, db)
        .then(({ status, location }) => {
          res.writeHead(status, { Location: location });
          res.end();
        })
        .catch((err: unknown) => {
          logger.error('server.onboard_post_error', { error: String(err) });
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal error');
        });
    });
    return;
  }

  // GitHub App OAuth — callback after installation
  if (req.method === 'GET' && path === '/auth/github/callback') {
    const code = query.get('code') ?? '';
    const installationId = parseInt(query.get('installation_id') ?? '', 10);
    if (!code || isNaN(installationId) || !GITHUB_APP_CLIENT_ID || !GITHUB_APP_CLIENT_SECRET) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid callback parameters');
      return;
    }
    handleGitHubCallback(code, installationId, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET)
      .then(({ status, location }) => {
        res.writeHead(status, { Location: location });
        res.end();
      })
      .catch((err: unknown) => {
        logger.error('server.github_callback_error', { error: String(err) });
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal error');
      });
    return;
  }

  // LinkedIn OAuth — redirect to authorization
  if (req.method === 'GET' && path === '/auth/linkedin') {
    const installationId = parseInt(query.get('installation_id') ?? '', 10);
    if (isNaN(installationId) || !LINKEDIN_CLIENT_ID || !APP_BASE_URL) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('LinkedIn OAuth not configured or missing installation_id');
      return;
    }
    const redirectUrl = handleLinkedInRedirect(installationId, WEBHOOK_SECRET, LINKEDIN_CLIENT_ID, APP_BASE_URL);
    res.writeHead(302, { Location: redirectUrl });
    res.end();
    return;
  }

  // LinkedIn OAuth — callback (org and member — routed by state prefix)
  if (req.method === 'GET' && path === '/auth/linkedin/callback') {
    const code = query.get('code') ?? '';
    const state = query.get('state') ?? '';
    if (!code || !state || !LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET || !APP_BASE_URL) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid callback parameters');
      return;
    }
    const handler = state.startsWith('m.')
      ? handleLinkedInMemberCallback(code, state, WEBHOOK_SECRET, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, APP_BASE_URL, db)
      : handleLinkedInCallback(code, state, WEBHOOK_SECRET, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, APP_BASE_URL, db);
    handler
      .then(({ status, location }) => {
        res.writeHead(status, { Location: location });
        res.end();
      })
      .catch((err: unknown) => {
        logger.error('server.linkedin_callback_error', { error: String(err) });
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal error');
      });
    return;
  }

  // Member onboarding — GitHub OAuth callback (exchanges code → creates member_token)
  if (req.method === 'GET' && path === '/auth/github/member-callback') {
    const code = query.get('code') ?? '';
    const state = query.get('state') ?? '';
    if (!code || !state || !GITHUB_APP_CLIENT_ID || !GITHUB_APP_CLIENT_SECRET) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid callback parameters');
      return;
    }
    handleGitHubMemberCallback(code, state, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, WEBHOOK_SECRET)
      .then(({ status, location }) => {
        res.writeHead(status, { Location: location });
        res.end();
      })
      .catch((err: unknown) => {
        logger.error('server.github_member_callback_error', { error: String(err) });
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal error');
      });
    return;
  }

  // Member onboarding — LinkedIn OAuth redirect (member-level)
  if (req.method === 'GET' && path === '/auth/linkedin/member') {
    const installationId = parseInt(query.get('installation_id') ?? '', 10);
    const memberToken = query.get('member_token') ?? '';
    if (isNaN(installationId) || !memberToken || !LINKEDIN_CLIENT_ID || !APP_BASE_URL) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid parameters');
      return;
    }
    const redirectUrl = handleLinkedInMemberRedirect(installationId, memberToken, WEBHOOK_SECRET, LINKEDIN_CLIENT_ID, APP_BASE_URL);
    res.writeHead(302, { Location: redirectUrl });
    res.end();
    return;
  }

  // Member onboarding page
  if (req.method === 'GET' && path === '/member/onboard') {
    const installationId = parseInt(query.get('installation_id') ?? '', 10);
    const memberToken = query.get('member_token') ?? null;
    const saved = query.get('saved') === '1';
    if (isNaN(installationId)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing installation_id');
      return;
    }
    handleMemberOnboardGet(installationId, memberToken, saved, db, WEBHOOK_SECRET, GITHUB_APP_CLIENT_ID, LINKEDIN_CLIENT_ID, APP_BASE_URL)
      .then(({ status, body, contentType }) => {
        if (status === 302) {
          res.writeHead(302, { Location: `/member/onboard?installation_id=${installationId}&error=invalid_token` });
        } else {
          res.writeHead(status, { 'Content-Type': contentType });
          res.end(body);
        }
      })
      .catch((err: unknown) => {
        logger.error('server.member_onboard_error', { error: String(err) });
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal error');
      });
    return;
  }

  // Member onboarding form submission
  if (req.method === 'POST' && path === '/member/onboard') {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      handleMemberOnboardPost(rawBody, db, WEBHOOK_SECRET)
        .then(({ status, location }) => {
          res.writeHead(status, { Location: location });
          res.end();
        })
        .catch((err: unknown) => {
          logger.error('server.member_onboard_post_error', { error: String(err) });
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal error');
        });
    });
    return;
  }

  // GitHub App webhook
  if (req.method === 'POST' && path === '/webhooks/github') {
    const event = req.headers['x-github-event'];
    const signature = req.headers['x-hub-signature-256'];

    if (typeof event !== 'string' || typeof signature !== 'string') {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing required headers');
      return;
    }

    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      handleGithubWebhook(event, signature, rawBody, WEBHOOK_SECRET, deps)
        .then(({ status, body }) => {
          res.writeHead(status, { 'Content-Type': 'text/plain' });
          res.end(body);
        })
        .catch((err: unknown) => {
          logger.error('server.unhandled_error', { error: String(err) });
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal error');
        });
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  logger.info('server.started', { port: PORT });
});

process.on('SIGTERM', () => {
  logger.info('server.shutdown');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('server.shutdown');
  server.close(() => process.exit(0));
});
