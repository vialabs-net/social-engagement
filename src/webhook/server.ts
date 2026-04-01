import { createServer } from 'http';
import { createClient } from '@supabase/supabase-js';
import { handleGithubWebhook } from './github-handler.js';
import { logger } from '../utils/logger.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const WEBHOOK_SECRET = process.env['GITHUB_WEBHOOK_SECRET'] ?? '';
const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

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

const server = createServer((req, res) => {
  // Health check — Cloud Run requires this to mark the instance healthy
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (req.method === 'POST' && req.url === '/webhooks/github') {
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
