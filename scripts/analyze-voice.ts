import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { calibrateMoveProbability } from '../src/voice/dice.js';
import { MOVES_REGISTRY } from '../src/voice/moves-registry.js';
import { computeVoiceStage } from '../src/voice/stage.js';
import { SupabaseStorage } from '../src/voice/supabase-storage.js';

interface InputPost {
  text?: string;
  published?: string;
}

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function loadTexts(): Promise<string[]> {
  const file = getArg('--file');
  if (file) {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as InputPost[];
    return raw.map((entry) => entry.text ?? entry.published ?? '').filter(Boolean);
  }

  const tenantId = getArg('--tenant');
  const authorLogin = getArg('--author');
  if (!tenantId || !authorLogin) {
    throw new Error('Use --file <json> or --tenant <id> --author <login>.');
  }

  const url = process.env['SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for tenant mode.');

  const storage = new SupabaseStorage(url, key, tenantId);
  const posts = await storage.getPublishedForMoves(authorLogin);
  return posts.map((post) => post.published ?? '').filter(Boolean);
}

async function main(): Promise<void> {
  const texts = await loadTexts();
  if (texts.length === 0) {
    console.log(JSON.stringify({ total_posts: 0, active_moves: [], top_moves: [] }, null, 2));
    return;
  }

  const frequencies = MOVES_REGISTRY
    .filter((move) => move.regex)
    .map((move) => {
      const matches = texts.filter((text) => move.regex!.test(text)).length;
      return {
        id: move.id,
        matches,
        frequency: matches / texts.length,
        calibrated_probability: calibrateMoveProbability(matches, texts.length),
        description: move.description,
      };
    })
    .sort((left, right) => right.frequency - left.frequency);

  const result = {
    total_posts: texts.length,
    stage: computeVoiceStage(texts.length, false),
    active_moves: frequencies.filter((move) => move.calibrated_probability > 0),
    top_moves: frequencies.slice(0, 10),
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
