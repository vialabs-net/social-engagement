/**
 * setup-buffer.ts — run once during setup to get Buffer profile IDs
 *
 * Usage: npm run setup-buffer
 * Requires: BUFFER_ACCESS_TOKEN in environment
 */

import { BufferClient } from '../src/buffer/client.js';

async function main(): Promise<void> {
  const token = process.env['BUFFER_ACCESS_TOKEN'];
  if (!token) {
    console.error('Error: BUFFER_ACCESS_TOKEN not set');
    console.error('Get it from: buffer.com → Settings → Apps → Create Access Token');
    process.exit(1);
  }

  const client = new BufferClient(token);

  console.log('\nFetching Buffer profiles...\n');

  const profiles = await client.getProfiles();

  if (profiles.length === 0) {
    console.log('No profiles found. Make sure you have connected accounts in Buffer.');
    return;
  }

  console.log('Profiles found:\n');
  for (const profile of profiles) {
    console.log(`  Service:  ${profile.service}`);
    console.log(`  Username: ${profile.formatted_username}`);
    console.log(`  ID:       ${profile.id}`);
    console.log('');
  }

  console.log('Copy the relevant IDs into config.yaml:');
  console.log('  platforms:');
  console.log('    linkedin:');
  console.log('      buffer_profile_id: "<linkedin-profile-id>"');
  console.log('    instagram:');
  console.log('      buffer_profile_id: "<instagram-profile-id>"');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
