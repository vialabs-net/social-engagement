import type { SupabaseClient } from '@supabase/supabase-js';
import { VALID_REJECTION_REASONS } from '../../review/notifier.js';
import { parseMemberToken } from './member-onboard.js';

export async function handlePostRejection(
  postId: string,
  memberToken: string,
  reason: string,
  installationId: number,
  db: SupabaseClient,
  webhookSecret: string,
): Promise<{ status: number; location: string }> {
  if (!VALID_REJECTION_REASONS.has(reason)) {
    return { status: 302, location: `/posts?installation_id=${installationId}&error=invalid_reason` };
  }

  const parsed = parseMemberToken(memberToken, webhookSecret);
  if (!parsed) {
    return { status: 302, location: `/posts?installation_id=${installationId}&error=invalid_token` };
  }

  await db
    .from('voice_posts')
    .update({ rejection_reason: reason, status: 'expired' })
    .eq('id', postId)
    .eq('author_login', parsed.login)
    .in('status', ['pending', 'scheduled', 'queued']);

  return {
    status: 302,
    location: `/posts?installation_id=${installationId}&member_token=${encodeURIComponent(memberToken)}&saved=1`,
  };
}
