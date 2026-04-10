import type { SupabaseClient } from '@supabase/supabase-js';
import { MODULE_REGISTRY } from '../../analysis/modules/index.js';
import { DEFAULT_VOICE_PROFILE, VoiceProfileSchema, type VoiceProfile } from '../../config/schema.js';
import { sealTenantSecrets } from '../../security/tenant-secrets.js';
import { logger } from '../../utils/logger.js';
import { mergeVoiceProfile } from '../../voice/profile-utils.js';

interface TenantRow {
  readonly id: string;
  readonly github_username: string;
  readonly buffer_access_token: string | null;
  readonly encrypted_dek: string | null;
  readonly linkedin_member_id: string | null;
  readonly config: Record<string, unknown>;
  readonly voice_bootstrap: string | null;
}

interface VoiceProfileRow {
  readonly id: string;
  readonly voice: unknown;
  readonly version: number;
}

const MODULE_OPTIONS = MODULE_REGISTRY
  .map((module) => ({ id: module.id, name: module.name }))
  .sort((left, right) => left.name.localeCompare(right.name));

function maskToken(token: string | null): string {
  if (!token) return '';
  return 'configured••••••••';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function checked(value: boolean): string {
  return value ? 'checked' : '';
}

function selected(left: string, right: string): string {
  return left === right ? 'selected' : '';
}

function html(
  tenant: TenantRow,
  installationId: number,
  voiceProfile: VoiceProfile,
  saved: boolean,
): string {
  const cfg = tenant.config;
  const author = (cfg['author'] as Record<string, unknown> | undefined) ?? {};
  const buffer = (cfg['buffer'] as Record<string, unknown> | undefined) ?? {};

  const name = (author['name'] as string | undefined) ?? tenant.github_username;
  const website = (author['website'] as string | undefined) ?? '';
  const bufferOrgId = (buffer['organization_id'] as string | undefined) ?? '';
  let voiceParts: string[] = [];
  try {
    voiceParts = JSON.parse(tenant.voice_bootstrap ?? '[]') as string[];
  } catch {
    voiceParts = [];
  }

  const focusModules = new Set(voiceProfile.content_strategy.focus_modules ?? MODULE_OPTIONS.map((module) => module.id));
  const skipPatterns = voiceProfile.content_strategy.skip_patterns.join('\n');
  const hashtags = voiceProfile.hashtags.join(' ');
  const voice1 = voiceParts[0] ?? '';
  const voice2 = voiceParts[1] ?? '';
  const voice3 = voiceParts[2] ?? '';
  const voice4 = voiceParts[3] ?? '';
  const voice5 = voiceParts[4] ?? '';

  const linkedinConnected = !!tenant.linkedin_member_id;
  const linkedinSection = linkedinConnected
    ? `<div class="connected"><span class="dot"></span>LinkedIn connected</div>
       <a href="/auth/linkedin?installation_id=${installationId}" class="link-small">Reconnect</a>`
    : `<a href="/auth/linkedin?installation_id=${installationId}" class="btn-linkedin">Connect LinkedIn</a>
       <p class="hint-card">Allows devcast to post directly to your LinkedIn feed.</p>`;

  const banner = saved
    ? `<div class="banner"><span class="dot"></span>Saved successfully.</div>`
    : '';

  const moduleCheckboxes = MODULE_OPTIONS.map((module) => `
    <label class="check-card">
      <input type="checkbox" name="focus_modules" value="${module.id}" ${checked(focusModules.has(module.id))}>
      <span>${escapeHtml(module.name)}</span>
    </label>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>devcast — Setup</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Geist',-apple-system,BlinkMacSystemFont,sans-serif;background:#09090b;color:#f4f4f5;min-height:100vh;line-height:1.5}
    nav{border-bottom:1px solid #27272a;padding:16px 24px;display:flex;align-items:center;justify-content:space-between}
    .logo{font-weight:600;font-size:.95rem;letter-spacing:-.02em;color:#fff}
    .account-badge{display:inline-flex;align-items:center;gap:8px;border:1px solid #27272a;background:#18181b;padding:4px 12px;border-radius:9999px;font-size:.75rem;color:#a1a1aa}
    .dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#34d399;flex-shrink:0}
    main{max-width:860px;margin:48px auto;padding:0 24px 48px}
    h1{font-size:1.5rem;font-weight:600;color:#fff;letter-spacing:-.02em;margin-bottom:4px}
    .sub{font-size:.875rem;color:#71717a;margin-bottom:32px}
    .banner{display:flex;align-items:center;gap:8px;background:#052e16;border:1px solid #166534;color:#4ade80;padding:10px 14px;border-radius:8px;margin-bottom:24px;font-size:.875rem}
    .card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;margin-bottom:16px}
    .section-title{font-size:.95rem;font-weight:600;color:#fff;margin-bottom:16px}
    .optional{color:#52525b;font-weight:400}
    label{display:block;font-size:.8rem;font-weight:500;color:#a1a1aa;margin-bottom:6px}
    input[type=text],input[type=url],input[type=number],select{width:100%;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:8px;font-size:.875rem;color:#f4f4f5;font-family:inherit;margin-bottom:16px;outline:none;transition:border-color .15s}
    input[type=text]:focus,input[type=url]:focus,input[type=number]:focus,select:focus,textarea:focus{border-color:#52525b}
    input::placeholder,textarea::placeholder{color:#3f3f46}
    textarea{width:100%;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:8px;font-size:.875rem;color:#f4f4f5;font-family:inherit;margin-bottom:16px;outline:none;transition:border-color .15s;resize:vertical}
    .hint{font-size:.75rem;color:#52525b;margin-top:-12px;margin-bottom:16px}
    .hint-card{font-size:.75rem;color:#52525b;margin-top:10px}
    .btn-primary{background:#fff;color:#09090b;border:none;padding:9px 20px;border-radius:8px;font-size:.875rem;font-weight:500;cursor:pointer;font-family:inherit;transition:background .15s}
    .btn-primary:hover{background:#e4e4e7}
    .btn-linkedin{display:inline-flex;align-items:center;gap:8px;background:#0077B5;color:#fff;padding:9px 20px;border-radius:8px;font-size:.875rem;font-weight:500;text-decoration:none;transition:background .15s}
    .btn-linkedin:hover{background:#005f8e}
    .connected{display:inline-flex;align-items:center;gap:6px;color:#34d399;font-size:.875rem;font-weight:500}
    .link-small{font-size:.8rem;color:#52525b;text-decoration:none;margin-left:12px;transition:color .15s}
    .link-small:hover{color:#a1a1aa}
    .module-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:12px 0 16px}
    .check-card{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #27272a;border-radius:10px;background:#09090b;color:#d4d4d8}
    .check-card input{margin:0}
    .radio-row{display:flex;flex-wrap:wrap;gap:12px;margin:8px 0 16px}
    .radio-pill{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #27272a;border-radius:9999px;background:#09090b;color:#d4d4d8}
    .split{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    @media (max-width: 720px){main{padding:0 16px 40px}.split{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <nav>
    <span style="display:inline-flex;align-items:center;gap:8px"><img src="/favicon.png" alt="" style="height:20px;border-radius:4px"><span class="logo">devcast</span></span>
    <span class="account-badge"><span class="dot"></span>${escapeHtml(tenant.github_username)}</span>
  </nav>
  <main>
    <h1>Setup</h1>
    <p class="sub">Configure what devcast publishes, how it sounds, and the examples it should learn from.</p>
    ${banner}
    <form method="POST" action="/onboard">
      <input type="hidden" name="installation_id" value="${installationId}">

      <div class="card">
        <div class="section-title">About you</div>
        <label>Name <span class="optional">(used in posts)</span></label>
        <input type="text" name="name" value="${escapeHtml(name)}" placeholder="Your Name" required>
        <label>Website <span class="optional">optional</span></label>
        <input type="url" name="website" value="${escapeHtml(website)}" placeholder="https://yoursite.com">
      </div>

      <div class="card">
        <div class="section-title">What should devcast publish about?</div>
        <p class="hint-card">Choose the technical themes that are fair game. Leave everything checked to allow all modules.</p>
        <div class="module-grid">${moduleCheckboxes}</div>

        <label>Audience</label>
        <div class="radio-row">
          <label class="radio-pill"><input type="radio" name="audience" value="peers" ${checked(voiceProfile.content_strategy.audience === 'peers')}>Peers</label>
          <label class="radio-pill"><input type="radio" name="audience" value="hiring-managers" ${checked(voiceProfile.content_strategy.audience === 'hiring-managers')}>Hiring managers</label>
          <label class="radio-pill"><input type="radio" name="audience" value="general-tech" ${checked(voiceProfile.content_strategy.audience === 'general-tech')}>General tech</label>
          <label class="radio-pill"><input type="radio" name="audience" value="mixed" ${checked(voiceProfile.content_strategy.audience === 'mixed')}>Mixed</label>
        </div>

        <label>Never publish</label>
        <textarea name="skip_patterns" rows="4" placeholder="One phrase or rule per line. Example: Do not mention clients">${escapeHtml(skipPatterns)}</textarea>
      </div>

      <div class="card">
        <div class="section-title">How do you sound?</div>
        <div class="split">
          <div>
            <label>Tone</label>
            <select name="tone">
              <option value="formal" ${selected(voiceProfile.tone, 'formal')}>Formal</option>
              <option value="professional" ${selected(voiceProfile.tone, 'professional')}>Professional</option>
              <option value="casual" ${selected(voiceProfile.tone, 'casual')}>Casual</option>
              <option value="humorous" ${selected(voiceProfile.tone, 'humorous')}>Humorous</option>
              <option value="storytelling" ${selected(voiceProfile.tone, 'storytelling')}>Storytelling</option>
              <option value="teaching" ${selected(voiceProfile.tone, 'teaching')}>Teaching</option>
            </select>
          </div>
          <div>
            <label>Rhythm</label>
            <select name="rhythm">
              <option value="paragraphs" ${selected(voiceProfile.rhythm, 'paragraphs')}>Paragraphs</option>
              <option value="mixed" ${selected(voiceProfile.rhythm, 'mixed')}>Mixed</option>
              <option value="short-sentences" ${selected(voiceProfile.rhythm, 'short-sentences')}>Short sentences</option>
            </select>
          </div>
        </div>

        <label>Preferred hashtags</label>
        <input type="text" name="hashtags" value="${escapeHtml(hashtags)}" placeholder="#devops #testing #architecture">

        <label>Hashtag mode</label>
        <div class="radio-row">
          <label class="radio-pill"><input type="radio" name="hashtags_mode" value="prefer" ${checked(voiceProfile.hashtags_mode === 'prefer')}>Prefer</label>
          <label class="radio-pill"><input type="radio" name="hashtags_mode" value="always" ${checked(voiceProfile.hashtags_mode === 'always')}>Always</label>
        </div>

        <div class="split">
          <div>
            <label>Post length min</label>
            <input type="number" name="post_length_min" min="300" max="3000" value="${voiceProfile.post_length.min}">
          </div>
          <div>
            <label>Post length max</label>
            <input type="number" name="post_length_max" min="300" max="3000" value="${voiceProfile.post_length.max}">
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-title">Your voice <span class="optional">recommended</span></div>
        <p class="hint-card">Paste 1-5 posts you've already written and are proud of. We use them directly as voice exposure until enough real published posts accumulate.</p>
        <label>A post where you explained something technical</label>
        <textarea name="voice_1" rows="4" placeholder="A post about a technical decision, bug, or implementation you solved.">${escapeHtml(voice1)}</textarea>
        <label>A post where you told a story about your work</label>
        <textarea name="voice_2" rows="4" placeholder="A lesson learned, milestone, or surprise from your work.">${escapeHtml(voice2)}</textarea>
        <label>A post you liked how it turned out <span class="optional">optional</span></label>
        <textarea name="voice_3" rows="4" placeholder="Any post that feels representative of your voice.">${escapeHtml(voice3)}</textarea>
        <label>A shorter or punchier post <span class="optional">optional</span></label>
        <textarea name="voice_4" rows="4" placeholder="A concise post that still sounds like you.">${escapeHtml(voice4)}</textarea>
        <label>A different register or mood <span class="optional">optional</span></label>
        <textarea name="voice_5" rows="4" placeholder="Something more reflective, humorous, or unusually technical.">${escapeHtml(voice5)}</textarea>
      </div>

      <div class="card">
        <div class="section-title">Buffer <span class="optional">optional</span></div>
        <label>API key</label>
        <input type="text" name="buffer_access_token" value="${maskToken(tenant.buffer_access_token)}" placeholder="Paste your Buffer API key">
        <p class="hint">Get it at publish.buffer.com → Settings → API</p>
        <label>Organization ID</label>
        <input type="text" name="buffer_org_id" value="${escapeHtml(bufferOrgId)}" placeholder="org_...">
        <p class="hint">Required to create Buffer Ideas. Leave blank if using LinkedIn direct only.</p>
      </div>

      <button type="submit" class="btn-primary">Save</button>
    </form>

    <div class="card" style="margin-top:16px">
      <div class="section-title">LinkedIn</div>
      ${linkedinSection}
    </div>
  </main>
</body>
</html>`;
}

export async function handleOnboardGet(
  installationId: number,
  db: SupabaseClient,
  _linkedinClientId: string,
  _appBaseUrl: string,
  saved: boolean,
): Promise<{ status: number; body: string; contentType: string }> {
  const { data, error } = await db
    .from('tenants')
    .select('id, github_username, buffer_access_token, encrypted_dek, linkedin_member_id, config, voice_bootstrap')
    .eq('github_installation_id', installationId)
    .single();

  if (error || !data) {
    logger.warn('onboard.tenant_not_found', { installationId });
    return {
      status: 404,
      body: '<h1>Installation not found</h1><p>Make sure you installed the GitHub App first.</p>',
      contentType: 'text/html',
    };
  }

  const tenant = data as TenantRow;
  const voiceProfile = await loadDefaultVoiceProfile(db, tenant.id);

  return {
    status: 200,
    body: html(tenant, installationId, voiceProfile, saved),
    contentType: 'text/html',
  };
}

export async function handleOnboardPost(
  rawBody: string,
  db: SupabaseClient,
): Promise<{ status: number; location: string }> {
  const params = new URLSearchParams(rawBody);
  const installationId = parseInt(params.get('installation_id') ?? '', 10);
  const name = params.get('name')?.trim() ?? '';
  const website = params.get('website')?.trim() ?? '';
  const bufferToken = params.get('buffer_access_token')?.trim() ?? '';
  const bufferOrgId = params.get('buffer_org_id')?.trim() ?? '';
  const voice1 = params.get('voice_1')?.trim() ?? '';
  const voice2 = params.get('voice_2')?.trim() ?? '';
  const voice3 = params.get('voice_3')?.trim() ?? '';
  const voice4 = params.get('voice_4')?.trim() ?? '';
  const voice5 = params.get('voice_5')?.trim() ?? '';
  const voiceBootstrap = JSON.stringify([voice1, voice2, voice3, voice4, voice5].filter(Boolean));

  if (isNaN(installationId) || !name) {
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=missing_fields` };
  }

  const { data: tenantData, error: fetchError } = await db
    .from('tenants')
    .select('id, config, encrypted_dek')
    .eq('github_installation_id', installationId)
    .single();

  if (fetchError || !tenantData) {
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=not_found` };
  }

  const tenant = tenantData as { id: string; config: Record<string, unknown>; encrypted_dek: string | null };
  const existingConfig = tenant.config;

  const updatedConfig: Record<string, unknown> = {
    ...existingConfig,
    author: {
      ...((existingConfig['author'] as Record<string, unknown> | undefined) ?? {}),
      name,
      ...(website && { website }),
    },
    buffer: {
      ...((existingConfig['buffer'] as Record<string, unknown> | undefined) ?? {}),
      ...(bufferOrgId && { organization_id: bufferOrgId }),
    },
  };

  const updates: Record<string, unknown> = {
    config: updatedConfig,
    voice_bootstrap: voiceBootstrap,
  };

  if (bufferToken && !bufferToken.includes('••')) {
    try {
      const sealed = await sealTenantSecrets(
        { bufferAccessToken: bufferToken },
        tenant.encrypted_dek,
      );
      updates['buffer_access_token'] = sealed.bufferAccessToken ?? null;
      updates['encrypted_dek'] = sealed.encryptedDek;
    } catch (err) {
      logger.error('onboard.buffer_token_encrypt_failed', { installationId, error: String(err) });
      return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
    }
  }

  const { error: updateError } = await db
    .from('tenants')
    .update(updates)
    .eq('github_installation_id', installationId);

  if (updateError) {
    logger.error('onboard.save_failed', { installationId, error: updateError.message });
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
  }

  const { data: voiceRow, error: voiceFetchError } = await db
    .from('voice_profiles')
    .select('id, voice, version')
    .eq('tenant_id', tenant.id)
    .is('github_author_login', null)
    .maybeSingle();

  if (voiceFetchError) {
    logger.error('onboard.voice_profile_lookup_failed', { installationId, error: voiceFetchError.message });
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
  }

  const existingParsed = voiceRow
    ? VoiceProfileSchema.safeParse((voiceRow as VoiceProfileRow).voice)
    : null;
  const existingVoiceProfile = mergeVoiceProfile(existingParsed?.success ? existingParsed.data : null);
  const normalizedVoiceProfile = buildVoiceProfileFromFormWithExisting(params, existingVoiceProfile);

  if (voiceRow) {
    const row = voiceRow as VoiceProfileRow;
    const { error: voiceUpdateError } = await db
      .from('voice_profiles')
      .update({
        voice: normalizedVoiceProfile,
        version: row.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    if (voiceUpdateError) {
      logger.error('onboard.voice_profile_update_failed', { installationId, error: voiceUpdateError.message });
      return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
    }
  } else {
    const { error: voiceInsertError } = await db
      .from('voice_profiles')
      .insert({
        tenant_id: tenant.id,
        github_author_login: null,
        voice: normalizedVoiceProfile,
        version: 1,
      });

    if (voiceInsertError) {
      logger.error('onboard.voice_profile_insert_failed', { installationId, error: voiceInsertError.message });
      return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
    }
  }

  logger.info('onboard.saved', { installationId, name });
  return { status: 302, location: `/onboard?installation_id=${installationId}&saved=1` };
}

async function loadDefaultVoiceProfile(db: SupabaseClient, tenantId: string): Promise<VoiceProfile> {
  const { data, error } = await db
    .from('voice_profiles')
    .select('id, voice, version')
    .eq('tenant_id', tenantId)
    .is('github_author_login', null)
    .maybeSingle();

  if (error) {
    logger.warn('onboard.voice_profile_load_failed', { tenantId, error: error.message });
    return DEFAULT_VOICE_PROFILE;
  }

  if (!data) return DEFAULT_VOICE_PROFILE;
  const row = data as VoiceProfileRow;
  const parsed = VoiceProfileSchema.safeParse(row.voice);
  return mergeVoiceProfile(parsed.success ? parsed.data : null);
}

function buildVoiceProfileFromForm(params: URLSearchParams): VoiceProfile {
  return buildVoiceProfileFromFormWithExisting(params, DEFAULT_VOICE_PROFILE);
}

function buildVoiceProfileFromFormWithExisting(params: URLSearchParams, existingProfile: VoiceProfile): VoiceProfile {
  const hashtags = params.get('hashtags')?.trim() ?? '';
  const focusModules = params.getAll('focus_modules').map((value) => value.trim()).filter(Boolean);
  const bootstrapPosts = [
    params.get('voice_1')?.trim() ?? '',
    params.get('voice_2')?.trim() ?? '',
    params.get('voice_3')?.trim() ?? '',
    params.get('voice_4')?.trim() ?? '',
    params.get('voice_5')?.trim() ?? '',
  ].filter(Boolean).map((text) => ({
    text,
    pasted_at: new Date().toISOString(),
  }));
  const parsed = VoiceProfileSchema.parse({
    ...existingProfile,
    tone: params.get('tone') ?? DEFAULT_VOICE_PROFILE.tone,
    rhythm: params.get('rhythm') ?? DEFAULT_VOICE_PROFILE.rhythm,
    hashtags: hashtags
      .split(/[\s,]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => tag.startsWith('#') ? tag : `#${tag}`),
    hashtags_mode: params.get('hashtags_mode') ?? DEFAULT_VOICE_PROFILE.hashtags_mode,
    post_length: {
      min: Number.parseInt(params.get('post_length_min') ?? `${DEFAULT_VOICE_PROFILE.post_length.min}`, 10),
      max: Number.parseInt(params.get('post_length_max') ?? `${DEFAULT_VOICE_PROFILE.post_length.max}`, 10),
    },
    content_strategy: {
      focus_modules: focusModules.length === MODULE_OPTIONS.length || focusModules.length === 0 ? undefined : focusModules,
      audience: params.get('audience') ?? DEFAULT_VOICE_PROFILE.content_strategy.audience,
      skip_patterns: (params.get('skip_patterns') ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    },
    bootstrap_posts: bootstrapPosts.length > 0 ? bootstrapPosts : undefined,
  });

  return mergeVoiceProfile(parsed);
}
