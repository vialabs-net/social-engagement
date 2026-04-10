/**
 * bootstrap-voice.ts — stores bootstrap posts as voice exposure, not published history
 *
 * Usage: npm run bootstrap
 * Requires: TENANT_ID for Supabase mode. SQLite defaults to local tenant.
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_VOICE_PROFILE } from '../src/config/schema.js';
import type { BootstrapPost, VoiceProfile } from '../src/config/schema.js';
import { SqliteStorage } from '../src/voice/sqlite-storage.js';
import { SupabaseStorage } from '../src/voice/supabase-storage.js';
import { mergeVoiceProfile } from '../src/voice/profile-utils.js';

interface ParsedBootstrapPost {
  text: string;
}

function parseBootstrapFile(content: string): ParsedBootstrapPost[] {
  const posts: ParsedBootstrapPost[] = [];
  const blocks = content.split(/^---\s*$/m).filter((block) => block.trim());

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const textLines: string[] = [];
    let inText = false;

    for (const line of lines) {
      if (!inText && line.startsWith('#')) continue;
      const metaMatch = line.match(/^\*\*(\w+(?:_\w+)*)\*\*:\s*(.+)$/);
      if (!inText && metaMatch) continue;
      if (line.trim() || inText) {
        inText = true;
        textLines.push(line);
      }
    }

    const text = textLines.join('\n').trim();
    if (text && text.length > 50) posts.push({ text });
  }

  return posts.slice(0, 5);
}

async function main(): Promise<void> {
  const tenantId = process.env['TENANT_ID'] ?? 'local';

  let content: string;
  try {
    content = readFileSync('voice-bootstrap.md', 'utf-8');
  } catch {
    console.error('voice-bootstrap.md not found. Add 1-5 posts, then run again.');
    process.exit(1);
  }

  const parsedPosts = parseBootstrapFile(content);
  if (parsedPosts.length === 0) {
    console.error('No valid bootstrap posts found. Add 1-5 posts separated by --- blocks.');
    process.exit(1);
  }

  const bootstrapPosts: BootstrapPost[] = parsedPosts.map((post) => ({
    text: post.text,
    pasted_at: new Date().toISOString(),
  }));

  if (process.env['SUPABASE_URL']) {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
    if (!url || !key || !tenantId || tenantId === 'local') {
      console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and real TENANT_ID are required in Supabase mode.');
      process.exit(1);
    }

    const db = createClient(url, key);
    const storage = new SupabaseStorage(url, key, tenantId);
    const stored = await storage.getVoiceProfile(null);
    const nextVoice: VoiceProfile = mergeVoiceProfile({
      ...(stored?.voice ?? DEFAULT_VOICE_PROFILE),
      bootstrap_posts: bootstrapPosts,
    });
    const saved = await storage.saveVoiceProfile(null, nextVoice, stored?.version);
    if (!saved) {
      console.error('Failed to save bootstrap voice profile due to version conflict.');
      process.exit(1);
    }

    await db
      .from('tenants')
      .update({
        voice_bootstrap: JSON.stringify(parsedPosts.map((post) => post.text)),
      })
      .eq('id', tenantId);
  } else {
    const storage = new SqliteStorage(process.env['SQLITE_PATH'] ?? 'data/devcast.db', tenantId);
    const stored = await storage.getVoiceProfile(null);
    const nextVoice: VoiceProfile = mergeVoiceProfile({
      ...(stored?.voice ?? DEFAULT_VOICE_PROFILE),
      bootstrap_posts: bootstrapPosts,
    });
    const saved = await storage.saveVoiceProfile(null, nextVoice, stored?.version);
    if (!saved) {
      console.error('Failed to save bootstrap voice profile due to version conflict.');
      process.exit(1);
    }
  }

  console.log(`Stored ${bootstrapPosts.length} bootstrap posts in the default voice profile.`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
