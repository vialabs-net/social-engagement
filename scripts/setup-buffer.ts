/**
 * setup-buffer.ts — verifica la conexión a Buffer y obtiene el organization ID
 *
 * Usage: npm run setup-buffer
 * Requires: BUFFER_ACCESS_TOKEN in environment
 */

import { BufferClient } from '../src/buffer/client.js';

async function main(): Promise<void> {
  const token = process.env['BUFFER_ACCESS_TOKEN'];
  if (!token) {
    console.error('Error: BUFFER_ACCESS_TOKEN not set');
    process.exit(1);
  }

  const client = new BufferClient(token);

  // Verify the token works by creating a test idea (then we'd need to delete it)
  // Instead, just print setup instructions
  console.log('\n=== Buffer Setup ===\n');
  console.log('1. Organization ID (for createIdea):');
  console.log('   Go to: buffer.com → Settings → Organizations');
  console.log('   Copy your organization ID and add to config.yaml:\n');
  console.log('   buffer:');
  console.log('     organization_id: "<your-org-id>"\n');

  console.log('2. Profile IDs (for voice loop — optional):');
  console.log('   Go to: buffer.com → Settings → Channels');
  console.log('   Profile IDs appear in the URL: /channels/<profile-id>');
  console.log('   Add to config.yaml if you want automatic voice training:\n');
  console.log('   platforms:');
  console.log('     linkedin:');
  console.log('       buffer_profile_id: "<linkedin-channel-id>"');
  console.log('     instagram:');
  console.log('       buffer_profile_id: "<instagram-channel-id>"\n');

  // Test that the token works by creating a test GraphQL call
  // We'll use the account org query
  console.log('Testing Buffer API connection...');
  const resp = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ account { id } }' }),
  });
  const json = await resp.json() as { data?: { account?: { id: string } }; errors?: unknown[] };

  if (json.errors || !json.data?.account) {
    console.error('Connection failed:', JSON.stringify(json.errors));
    process.exit(1);
  }

  console.log(`✓ Connected. Account ID: ${json.data.account.id}`);
  console.log('\nToken is valid. Configure config.yaml and run: npm run bootstrap\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
