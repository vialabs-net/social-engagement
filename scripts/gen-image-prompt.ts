/**
 * gen-image-prompt.ts — generates an image prompt from a draft post
 *
 * Usage:
 *   npm run gen-image-prompt -- --draft-id <id>
 *   npm run gen-image-prompt -- --text "your post text here"
 *
 * Prints a Nano Banana Pro-optimized prompt to stdout.
 * Copy-paste into Nano Banana to generate the image.
 */

import { createClient } from '@supabase/supabase-js';
import type { VoicePost } from '../src/voice/storage.js';

// ─── Theme mapping from module categories to visual concepts ─────────────────

const THEME_MAP: Record<string, string> = {
  complexity: 'untangling a complex web of interconnected nodes on a holographic display',
  design_patterns: 'arranging elegant geometric building blocks into a clean architecture',
  clean_code: 'polishing and refining glowing lines of code floating in the air',
  type_system: 'connecting typed puzzle pieces that snap together perfectly',
  integration: 'bridging two separate systems with flowing data streams',
  testing: 'inspecting code through a magnifying glass with green checkmarks appearing',
  ai_assisted: 'collaborating side by side with an AI hologram on a shared screen',
  performance: 'optimizing a dashboard showing speedometer and metrics going up',
  security: 'reinforcing a digital shield protecting flowing data',
  api_design: 'designing clean API endpoints on a futuristic whiteboard',
  error_resilience: 'building safety nets under a high-wire of running processes',
  observability: 'monitoring cascading dashboards with real-time metrics and traces',
  concurrency: 'orchestrating multiple parallel threads weaving together',
  dx: 'crafting developer tools with intuitive interfaces',
  dependency_health: 'pruning and updating a tree of connected packages',
  evolutionary: 'transforming legacy code into modern architecture, before and after',
  js_advanced: 'wielding advanced JavaScript constructs as glowing tools',
  react_patterns: 'composing React component trees with flowing state connections',
  devops: 'deploying containers into a cloud infrastructure pipeline',
};

const DEFAULT_THEME = 'writing code on a sleek laptop in a modern workspace';

// ─── Prompt builder ──────────────────────────────────────────────────────────

function detectTheme(topFinding: string | null, postText: string): string {
  if (!topFinding) return DEFAULT_THEME;

  const findingLower = topFinding.toLowerCase();

  for (const [category, theme] of Object.entries(THEME_MAP)) {
    const keywords = category.replace(/_/g, ' ').split(' ');
    if (keywords.some((kw) => findingLower.includes(kw))) {
      return theme;
    }
  }

  // Fallback: try matching common words from the post
  if (findingLower.includes('refactor') || findingLower.includes('extract')) return THEME_MAP['evolutionary']!;
  if (findingLower.includes('test')) return THEME_MAP['testing']!;
  if (findingLower.includes('docker') || findingLower.includes('deploy')) return THEME_MAP['devops']!;
  if (findingLower.includes('error') || findingLower.includes('retry')) return THEME_MAP['error_resilience']!;
  if (findingLower.includes('hook') || findingLower.includes('component')) return THEME_MAP['react_patterns']!;

  return DEFAULT_THEME;
}

function buildImagePrompt(theme: string): string {
  return [
    'Professional photograph of a young Latina woman software developer.',
    `She is ${theme}.`,
    'Feminine aesthetic: soft pink and purple accent lighting, modern minimalist tech workspace.',
    'Confident expression, natural pose, looking engaged with her work.',
    'Shot on a 35mm lens, shallow depth of field, warm color grading.',
    'High quality, photorealistic, editorial style.',
  ].join(' ');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const draftIdIdx = args.indexOf('--draft-id');
  const textIdx = args.indexOf('--text');

  let postText = '';
  let topFinding: string | null = null;

  if (draftIdIdx !== -1 && args[draftIdIdx + 1]) {
    const draftId = args[draftIdIdx + 1]!;
    const supabaseUrl = process.env['SUPABASE_URL'];
    const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

    if (!supabaseUrl || !supabaseKey) {
      console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for --draft-id mode');
      process.exit(1);
    }

    const db = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await db
      .from('voice_posts')
      .select('ai_draft, published, top_finding')
      .eq('id', draftId)
      .single();

    if (error || !data) {
      console.error(`Draft not found: ${draftId}`);
      process.exit(1);
    }

    const row = data as Pick<VoicePost, 'ai_draft' | 'published' | 'top_finding'>;
    postText = row.published ?? row.ai_draft;
    topFinding = row.top_finding;
  } else if (textIdx !== -1 && args[textIdx + 1]) {
    postText = args[textIdx + 1]!;
  } else {
    console.error('Usage:');
    console.error('  npm run gen-image-prompt -- --draft-id <id>');
    console.error('  npm run gen-image-prompt -- --text "your post text"');
    process.exit(1);
  }

  const theme = detectTheme(topFinding, postText);
  const prompt = buildImagePrompt(theme);

  console.log('\n--- IMAGE PROMPT (copy to Nano Banana) ---\n');
  console.log(prompt);
  console.log('\n--- POST TEXT (for reference) ---\n');
  console.log(postText.slice(0, 300) + (postText.length > 300 ? '...' : ''));
  console.log('\n--- DETECTED THEME ---\n');
  console.log(theme);
  console.log();
}

main().catch((err) => {
  console.error('Fatal:', String(err));
  process.exit(1);
});
