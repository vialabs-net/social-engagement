/**
 * bootstrap-voice.ts — seeds voice history from voice-bootstrap.md
 *
 * Usage: npm run bootstrap
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or uses SQLite locally)
 */

import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { SupabaseStorage } from '../src/voice/supabase-storage.js';
import { SqliteStorage } from '../src/voice/sqlite-storage.js';
import type { IVoiceStorage, Platform } from '../src/voice/storage.js';

interface BootstrapPost {
  module?: string;
  platform: Platform;
  training_weight: number;
  voice_notes?: string;
  text: string;
}

function parseBootstrapFile(content: string): BootstrapPost[] {
  const posts: BootstrapPost[] = [];
  const blocks = content.split(/^---\s*$/m).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const meta: Record<string, string> = {};
    const textLines: string[] = [];
    let inText = false;

    for (const line of lines) {
      if (!inText && line.startsWith('#')) continue; // skip section headers
      const metaMatch = line.match(/^\*\*(\w+(?:_\w+)*)\*\*:\s*(.+)$/);
      if (!inText && metaMatch) {
        meta[metaMatch[1]!.toLowerCase()] = metaMatch[2]!.trim();
      } else if (line.trim() || inText) {
        inText = true;
        textLines.push(line);
      }
    }

    const text = textLines.join('\n').trim();
    const platform = (meta['platform'] ?? 'linkedin') as Platform;
    const trainingWeight = parseFloat(meta['training_weight'] ?? '1.0');

    if (text && text.length > 50) {
      posts.push({
        module: meta['module'],
        platform,
        training_weight: trainingWeight,
        voice_notes: meta['voice_notes'],
        text,
      });
    }
  }

  return posts;
}

async function main(): Promise<void> {
  const tenantId = process.env['TENANT_ID'] ?? 'local';
  const storage: IVoiceStorage = process.env['SUPABASE_URL']
    ? new SupabaseStorage(process.env['SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '', tenantId)
    : new SqliteStorage(process.env['SQLITE_PATH'] ?? 'data/devcast.db', tenantId);

  let content: string;
  try {
    content = readFileSync('voice-bootstrap.md', 'utf-8');
  } catch {
    console.error('voice-bootstrap.md not found. Edit it with 3–5 posts in your voice, then run again.');
    process.exit(1);
  }

  const posts = parseBootstrapFile(content);
  console.log(`\nFound ${posts.length} posts to seed.\n`);

  for (const post of posts) {
    const draftId = await storage.saveDraft({
      commit_sha: `bootstrap-${randomUUID()}`,
      repo: 'bootstrap/manual',
      platform: post.platform,
      ai_draft: post.text,
    });

    // Immediately mark as published with edit_ratio = training_weight (1.0 = unchanged)
    await storage.updatePublished({
      id: draftId,
      published: post.text,
      edit_ratio: Math.min(1.0, post.training_weight),
      published_at: new Date().toISOString(),
    });

    console.log(`  ✓ [${post.platform}] ${post.text.slice(0, 60)}...`);
  }

  console.log('\nVoice history seeded. The system will use these as style examples.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
