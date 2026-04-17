/**
 * Send pending voice_posts (buffer_post_id IS NULL) to Buffer as Ideas.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/backfill-buffer-ideas.ts --login korutx
 *   tsx --env-file=.env.local scripts/backfill-buffer-ideas.ts --login korutx --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { BufferClient } from '../src/buffer/client.js';
import { resolveTenantSecrets } from '../src/security/tenant-secrets.js';

interface PendingPost {
  readonly id: string;
  readonly ai_draft: string;
  readonly tenant_id: string;
}

interface DevProfile {
  readonly buffer_access_token: string | null;
  readonly buffer_org_id: string | null;
  readonly encrypted_dek: string | null;
}

async function main(): Promise<void> {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');

  const loginIdx = process.argv.indexOf('--login');
  const login = loginIdx >= 0 ? (process.argv[loginIdx + 1] ?? null) : null;
  if (!login) throw new Error('--login <github_login> is required');

  const dryRun = process.argv.includes('--dry-run');
  const db = createClient(supabaseUrl, supabaseKey);

  const { data: profile, error: profileError } = await db
    .from('developer_profiles')
    .select('buffer_access_token, buffer_org_id, encrypted_dek')
    .eq('github_login', login)
    .maybeSingle();

  if (profileError || !profile) throw new Error(`developer_profiles not found for ${login}: ${profileError?.message ?? 'no row'}`);

  const devProfile = profile as DevProfile;
  if (!devProfile.buffer_org_id) throw new Error(`No buffer_org_id for ${login} — complete onboard first`);

  const secrets = await resolveTenantSecrets({
    buffer_access_token: devProfile.buffer_access_token,
    encrypted_dek: devProfile.encrypted_dek,
  });
  if (!secrets.bufferAccessToken) throw new Error(`Could not decrypt Buffer token for ${login}`);

  const { data: posts, error: postsError } = await db
    .from('voice_posts')
    .select('id, ai_draft, tenant_id')
    .eq('author_login', login)
    .is('buffer_post_id', null)
    .in('status', ['pending', 'scheduled'])
    .order('created_at', { ascending: true });

  if (postsError) throw new Error(`Failed to fetch posts: ${postsError.message}`);

  const pending = (posts ?? []) as PendingPost[];
  console.log(`Found ${pending.length} pending post(s) for ${login}`);
  if (pending.length === 0) return;

  const bufferClient = new BufferClient(secrets.bufferAccessToken);

  for (const post of pending) {
    const title = post.ai_draft.slice(0, 80);
    console.log(`\nPost ${post.id}`);
    console.log(`  Preview: ${post.ai_draft.slice(0, 120).replace(/\n/g, ' ')}...`);

    if (dryRun) {
      console.log('  DRY RUN — would create Buffer Idea');
      continue;
    }

    const { id: bufferIdeaId } = await bufferClient.createIdea(devProfile.buffer_org_id!, title, post.ai_draft);
    console.log(`  Buffer Idea created: ${bufferIdeaId}`);

    const { error: updateError } = await db
      .from('voice_posts')
      .update({ buffer_post_id: bufferIdeaId, status: 'scheduled' })
      .eq('id', post.id);

    if (updateError) throw new Error(`Failed to update post ${post.id}: ${updateError.message}`);
    console.log('  voice_post updated → scheduled');
  }

  console.log(`\nDone${dryRun ? ' (dry run)' : ''}.`);
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
