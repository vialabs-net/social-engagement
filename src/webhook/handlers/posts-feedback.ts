import type { SupabaseClient } from '@supabase/supabase-js';
import { VALID_REJECTION_REASONS } from '../../review/notifier.js';
import { parseMemberToken } from './member-onboard.js';

interface PostRow {
  id: string;
  published: string | null;
  ai_draft: string;
  published_at: string | null;
  platform: string;
  edit_ratio: number | null;
  voice_rating: number | null;
}

function editRatioBadge(ratio: number | null): string {
  if (ratio === null) return '';
  const pct = Math.round(ratio * 100);
  const color = ratio >= 0.85 ? '#22c55e' : ratio >= 0.65 ? '#f59e0b' : '#ef4444';
  return `<span style="background:${color};color:#fff;border-radius:4px;padding:1px 6px;font-size:0.75rem;margin-left:6px">${pct}%</span>`;
}

function renderPostsHtml(
  posts: PostRow[] | null,
  login: string,
  installationId: number,
  memberToken: string,
): string {
  const rows = (posts ?? []).map((p) => {
    const ratingHtml = p.voice_rating !== null
      ? `<span style="font-size:1.25rem">${p.voice_rating === 2 ? '👍' : '👎'}</span>`
      : `<form method="POST" action="/posts/${p.id}/feedback" style="display:inline-flex;gap:8px;align-items:center">
           <input type="hidden" name="member_token" value="${memberToken}">
           <input type="hidden" name="installation_id" value="${installationId}">
           <button name="rating" value="2" style="background:none;border:1px solid #3f3f46;border-radius:6px;padding:4px 10px;cursor:pointer;color:#f4f4f5;font-size:0.875rem">👍 sonó como yo</button>
           <button name="rating" value="1" style="background:none;border:1px solid #3f3f46;border-radius:6px;padding:4px 10px;cursor:pointer;color:#f4f4f5;font-size:0.875rem">👎 no sonó como yo</button>
         </form>`;

    const date = p.published_at ? new Date(p.published_at).toLocaleDateString('es-CL') : '—';
    const published = p.published ? escapeHtml(p.published.slice(0, 300)) : '(sin texto publicado)';
    return `<div style="background:#18181b;border:1px solid #27272a;border-radius:10px;padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="color:#a1a1aa;font-size:0.8rem">${date} · ${p.platform}${editRatioBadge(p.edit_ratio)}</span>
        ${ratingHtml}
      </div>
      <p style="white-space:pre-wrap;font-size:0.875rem;line-height:1.6;color:#f4f4f5">${published}</p>
    </div>`;
  }).join('');

  const error = '';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>devcast — mis posts</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#09090b;color:#f4f4f5;min-height:100vh;padding:32px 16px}.container{max-width:680px;margin:0 auto}h1{font-size:1.25rem;font-weight:600;margin-bottom:4px}p.sub{color:#a1a1aa;font-size:0.875rem;margin-bottom:24px}</style>
</head><body><div class="container">
<h1>Mis posts</h1>
<p class="sub">Sesión: ${escapeHtml(login)}</p>
${error}
${rows || '<p style="color:#71717a;text-align:center;padding:48px 0">Sin posts publicados aún.</p>'}
</div></body></html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function handlePostsGet(
  installationId: number,
  memberToken: string,
  db: SupabaseClient,
  webhookSecret: string,
): Promise<{ status: number; body?: string; location?: string; contentType?: string }> {
  const parsed = parseMemberToken(memberToken, webhookSecret);
  if (!parsed || parsed.installationId !== installationId) {
    return { status: 302, location: `/posts?installation_id=${installationId}&error=invalid_token` };
  }

  const { data } = await db
    .from('voice_posts')
    .select('id, published, ai_draft, published_at, platform, edit_ratio, voice_rating')
    .eq('author_login', parsed.login)
    .eq('status', 'published')
    .not('published', 'is', null)
    .order('published_at', { ascending: false })
    .limit(20);

  return {
    status: 200,
    body: renderPostsHtml(data as PostRow[] | null, parsed.login, installationId, memberToken),
    contentType: 'text/html',
  };
}

export async function handlePostFeedback(
  postId: string,
  memberToken: string,
  rating: number,
  comment: string,
  installationId: number,
  db: SupabaseClient,
  webhookSecret: string,
): Promise<{ status: number; location: string }> {
  const parsed = parseMemberToken(memberToken, webhookSecret);
  if (!parsed) {
    return { status: 302, location: `/posts?installation_id=${installationId}&error=invalid_token` };
  }

  const update: Record<string, unknown> = { voice_rating: rating };
  if (rating === 1 && comment) {
    update['rejection_reason'] = comment.slice(0, 500);
  }

  await db
    .from('voice_posts')
    .update(update)
    .eq('id', postId)
    .eq('author_login', parsed.login);

  return {
    status: 302,
    location: `/posts?installation_id=${installationId}&member_token=${encodeURIComponent(memberToken)}&saved=1`,
  };
}

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
