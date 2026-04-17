import type { SupabaseClient } from '@supabase/supabase-js';
import { MODULE_REGISTRY } from '../../analysis/modules/index.js';
import { DEFAULT_VOICE_PROFILE, VoiceProfileSchema, type VoiceProfile } from '../../config/schema.js';
import { sealTenantSecrets, resolveTenantSecrets } from '../../security/tenant-secrets.js';
import { logger } from '../../utils/logger.js';
import { mergeVoiceProfile } from '../../voice/profile-utils.js';
import { BufferClient } from '../../buffer/client.js';

interface TenantRow {
  readonly id: string;
  readonly github_username: string;
  readonly active: boolean;
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
  const github = (cfg['github'] as Record<string, unknown> | undefined) ?? {};
  const name = (author['name'] as string | undefined) ?? tenant.github_username;
  const website = (author['website'] as string | undefined) ?? '';
  const bufferOrgId = (buffer['organization_id'] as string | undefined) ?? '';
  const notificationRepo = (github['notification_repo'] as string | undefined) ?? '';
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
    .connected{display:inline-flex;align-items:center;gap:6px;color:#34d399;font-size:.875rem;font-weight:500}
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
    <svg height="28" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="devcast">
      <path d="M17.936 122.624C15.544 122.624 13.464 122.035 11.696 120.856C9.96267 119.677 8.628 118.013 7.692 115.864C6.756 113.715 6.288 111.167 6.288 108.22C6.288 105.273 6.756 102.725 7.692 100.576C8.628 98.4267 9.96267 96.7627 11.696 95.584C13.464 94.4053 15.544 93.816 17.936 93.816C19.7733 93.816 21.4547 94.2147 22.98 95.012C24.5053 95.7747 25.6493 96.8667 26.412 98.288V85.08H30.78V122H26.828L26.672 117.84C25.9093 119.331 24.748 120.509 23.188 121.376C21.628 122.208 19.8773 122.624 17.936 122.624ZM18.82 118.464C20.4493 118.464 21.8187 118.048 22.928 117.216C24.072 116.384 24.9387 115.205 25.528 113.68C26.1173 112.12 26.412 110.3 26.412 108.22C26.412 106.071 26.1173 104.233 25.528 102.708C24.9387 101.183 24.072 100.021 22.928 99.224C21.8187 98.392 20.4493 97.976 18.82 97.976C16.3933 97.976 14.452 98.8947 12.996 100.732C11.5747 102.535 10.864 105.031 10.864 108.22C10.864 111.375 11.5747 113.871 12.996 115.708C14.452 117.545 16.3933 118.464 18.82 118.464ZM49.342 122.624C46.742 122.624 44.4886 122.035 42.582 120.856C40.71 119.677 39.254 118.013 38.214 115.864C37.2086 113.68 36.706 111.132 36.706 108.22C36.706 105.308 37.2086 102.777 38.214 100.628C39.254 98.4787 40.6926 96.8147 42.53 95.636C44.402 94.4227 46.6033 93.816 49.134 93.816C51.526 93.816 53.6406 94.388 55.478 95.532C57.3153 96.6413 58.7366 98.2707 59.742 100.42C60.782 102.569 61.302 105.187 61.302 108.272V109.572H41.282C41.4553 112.519 42.2353 114.737 43.622 116.228C45.0433 117.719 46.95 118.464 49.342 118.464C51.1446 118.464 52.618 118.048 53.762 117.216C54.9406 116.349 55.7553 115.223 56.206 113.836L60.886 114.2C60.158 116.661 58.7713 118.689 56.726 120.284C54.7153 121.844 52.254 122.624 49.342 122.624ZM41.282 105.724H56.518C56.31 103.055 55.53 101.096 54.178 99.848C52.8606 98.6 51.1793 97.976 49.134 97.976C47.0193 97.976 45.2686 98.6347 43.882 99.952C42.53 101.235 41.6633 103.159 41.282 105.724ZM73.4261 122L63.3901 94.44H68.1741L76.1821 117.528L84.1901 94.44H88.9741L78.9381 122H73.4261Z" fill="white"/>
      <path d="M104.924 122.624C102.359 122.624 100.123 122.035 98.216 120.856C96.344 119.677 94.888 118.013 93.848 115.864C92.808 113.68 92.288 111.132 92.288 108.22C92.288 105.308 92.808 102.777 93.848 100.628C94.888 98.4787 96.344 96.8147 98.216 95.636C100.123 94.4227 102.359 93.816 104.924 93.816C107.039 93.816 108.911 94.1973 110.54 94.96C112.204 95.688 113.556 96.7627 114.596 98.184C115.636 99.6053 116.312 101.339 116.624 103.384L112.048 103.696C111.736 101.859 110.939 100.455 109.656 99.484C108.373 98.4787 106.796 97.976 104.924 97.976C102.393 97.976 100.417 98.8947 98.996 100.732C97.5747 102.535 96.864 105.031 96.864 108.22C96.864 111.409 97.5747 113.923 98.996 115.76C100.417 117.563 102.393 118.464 104.924 118.464C106.796 118.464 108.373 117.944 109.656 116.904C110.939 115.864 111.736 114.304 112.048 112.224L116.624 112.536C116.312 114.581 115.636 116.367 114.596 117.892C113.556 119.383 112.204 120.544 110.54 121.376C108.911 122.208 107.039 122.624 104.924 122.624ZM130.186 122.624C127.343 122.624 125.073 121.965 123.374 120.648C121.71 119.331 120.878 117.493 120.878 115.136C120.878 112.779 121.571 110.924 122.958 109.572C124.345 108.22 126.546 107.267 129.562 106.712L139.338 104.892C139.338 102.569 138.783 100.836 137.674 99.692C136.599 98.548 134.97 97.976 132.786 97.976C130.879 97.976 129.371 98.4093 128.262 99.276C127.153 100.108 126.39 101.321 125.974 102.916L121.346 102.552C121.866 99.952 123.114 97.8547 125.09 96.26C127.101 94.6307 129.666 93.816 132.786 93.816C136.322 93.816 139.026 94.8213 140.898 96.832C142.77 98.808 143.706 101.547 143.706 105.048V116.436C143.706 117.06 143.81 117.511 144.018 117.788C144.261 118.031 144.642 118.152 145.162 118.152H146.254V122C146.115 122.035 145.89 122.052 145.578 122.052C145.266 122.087 144.937 122.104 144.59 122.104C143.342 122.104 142.319 121.913 141.522 121.532C140.759 121.116 140.205 120.492 139.858 119.66C139.511 118.793 139.338 117.667 139.338 116.28L139.858 116.384C139.615 117.563 139.026 118.637 138.09 119.608C137.154 120.544 135.993 121.289 134.606 121.844C133.219 122.364 131.746 122.624 130.186 122.624ZM130.602 118.776C132.439 118.776 133.999 118.429 135.282 117.736C136.599 117.008 137.605 116.037 138.298 114.824C138.991 113.576 139.338 112.189 139.338 110.664V108.688L130.394 110.352C128.522 110.699 127.222 111.236 126.494 111.964C125.801 112.657 125.454 113.576 125.454 114.72C125.454 116.003 125.905 117.008 126.806 117.736C127.742 118.429 129.007 118.776 130.602 118.776ZM161.122 122.624C158.66 122.624 156.563 122.225 154.83 121.428C153.131 120.631 151.796 119.539 150.826 118.152C149.89 116.731 149.352 115.119 149.214 113.316L153.79 113.004C154.067 114.668 154.778 116.003 155.922 117.008C157.066 117.979 158.799 118.464 161.122 118.464C162.994 118.464 164.484 118.169 165.594 117.58C166.738 116.956 167.31 115.968 167.31 114.616C167.31 113.888 167.136 113.281 166.79 112.796C166.443 112.311 165.767 111.895 164.762 111.548C163.756 111.167 162.266 110.803 160.29 110.456C157.655 109.971 155.575 109.381 154.05 108.688C152.559 107.96 151.484 107.076 150.826 106.036C150.202 104.961 149.89 103.696 149.89 102.24C149.89 99.7787 150.791 97.768 152.594 96.208C154.396 94.6133 156.962 93.816 160.29 93.816C162.543 93.816 164.432 94.232 165.958 95.064C167.518 95.8613 168.731 96.936 169.598 98.288C170.499 99.6053 171.088 101.061 171.366 102.656L166.79 102.968C166.582 101.997 166.2 101.148 165.646 100.42C165.091 99.6573 164.363 99.068 163.462 98.652C162.56 98.2013 161.486 97.976 160.238 97.976C158.262 97.976 156.806 98.3573 155.87 99.12C154.934 99.8827 154.466 100.853 154.466 102.032C154.466 102.933 154.674 103.679 155.09 104.268C155.54 104.823 156.251 105.291 157.222 105.672C158.192 106.019 159.492 106.331 161.122 106.608C163.93 107.093 166.114 107.683 167.674 108.376C169.234 109.069 170.326 109.919 170.95 110.924C171.574 111.929 171.886 113.16 171.886 114.616C171.886 116.315 171.4 117.771 170.43 118.984C169.494 120.163 168.211 121.064 166.582 121.688C164.987 122.312 163.167 122.624 161.122 122.624ZM186.869 122C184.373 122 182.518 121.428 181.305 120.284C180.126 119.14 179.537 117.355 179.537 114.928V87.992H183.905V114.824C183.905 116.072 184.182 116.939 184.737 117.424C185.292 117.909 186.141 118.152 187.285 118.152H191.237V122H186.869ZM175.481 98.288V94.44H191.237V98.288H175.481Z" fill="url(#paint0_linear_nav)"/>
      <defs>
        <linearGradient id="paint0_linear_nav" x1="143" y1="70" x2="228" y2="70" gradientUnits="userSpaceOnUse">
          <stop stop-color="#2563EB"/>
          <stop offset="0.485577" stop-color="#9333EA"/>
          <stop offset="1" stop-color="#EC4899"/>
        </linearGradient>
      </defs>
    </svg>
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
        <label>Notification repo <span class="optional">optional</span></label>
        <input type="text" name="notification_repo" value="${escapeHtml(notificationRepo)}" placeholder="my-repo">
        <p class="hint">GitHub repo where draft notifications are posted as issues. Defaults to the commit's repo if blank.</p>
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
            <input type="number" name="post_length_min" min="300" max="1500" value="${voiceProfile.post_length.min}">
          </div>
          <div>
            <label>Post length max</label>
            <input type="number" name="post_length_max" min="300" max="1500" value="${voiceProfile.post_length.max}">
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
    .select('id, github_username, active, buffer_access_token, encrypted_dek, linkedin_member_id, config, voice_bootstrap')
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
  if (!tenant.active) {
    const { error: activateError } = await db
      .from('tenants')
      .update({ active: true })
      .eq('github_installation_id', installationId);

    if (activateError) {
      logger.error('onboard.tenant_reactivate_failed', { installationId, error: activateError.message });
      return {
        status: 500,
        body: '<h1>Internal error</h1><p>Failed to reactivate installation.</p>',
        contentType: 'text/html',
      };
    }
  }

  const voiceProfile = await loadDefaultVoiceProfile(db, tenant.id);

  return {
    status: 200,
    body: html({ ...tenant, active: true }, installationId, voiceProfile, saved),
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
  const notificationRepo = params.get('notification_repo')?.trim() ?? '';
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
    .select('id, github_username, config, encrypted_dek, buffer_access_token')
    .eq('github_installation_id', installationId)
    .single();

  if (fetchError || !tenantData) {
    return { status: 302, location: `/onboard?installation_id=${installationId}&error=not_found` };
  }

  const tenant = tenantData as { id: string; github_username: string; config: Record<string, unknown>; encrypted_dek: string | null; buffer_access_token: string | null };
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
    github: {
      ...((existingConfig['github'] as Record<string, unknown> | undefined) ?? {}),
      ...(notificationRepo && { notification_repo: notificationRepo }),
    },
  };

  const updates: Record<string, unknown> = {
    config: updatedConfig,
    voice_bootstrap: voiceBootstrap,
    active: true,
  };

  const isNewToken = !!(bufferToken && !bufferToken.includes('••'));
  const effectiveOrgId = bufferOrgId
    || ((existingConfig['buffer'] as Record<string, unknown> | undefined)?.['organization_id'] as string | undefined)
    || '';

  // Auto-discover LinkedIn channel ID when we have any usable token + an org ID.
  // Runs on new token OR on org ID change using the existing stored token.
  let discoveredLinkedInChannelId: string | null = null;
  if (effectiveOrgId) {
    let rawTokenForDiscovery: string | null = null;
    if (isNewToken) {
      rawTokenForDiscovery = bufferToken;
    } else if (tenant.buffer_access_token) {
      rawTokenForDiscovery = (await resolveTenantSecrets(tenant).catch(() => null))?.bufferAccessToken ?? null;
    }
    if (rawTokenForDiscovery) {
      try {
        const bufferClient = new BufferClient(rawTokenForDiscovery);
        discoveredLinkedInChannelId = await bufferClient.getLinkedInChannelId(effectiveOrgId);
        if (discoveredLinkedInChannelId) {
          const existingPlatforms = (existingConfig['platforms'] as Record<string, unknown> | undefined) ?? {};
          const existingLinkedin = (existingPlatforms['linkedin'] as Record<string, unknown> | undefined) ?? {};
          updatedConfig['platforms'] = {
            ...existingPlatforms,
            linkedin: { ...existingLinkedin, buffer_profile_id: discoveredLinkedInChannelId },
          };
          logger.info('onboard.linkedin_channel_discovered', { installationId, linkedInChannelId: discoveredLinkedInChannelId });
        }
      } catch (err) {
        logger.warn('onboard.linkedin_channel_discovery_failed', { installationId, error: String(err) });
      }
    }
  }

  if (isNewToken) {
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

  // Upsert developer_profiles so this developer's Buffer config is available
  // cross-tenant. Non-fatal: a failure here does not roll back the tenant save.
  try {
    const { data: existingProfile } = await db
      .from('developer_profiles')
      .select('encrypted_dek')
      .eq('github_login', tenant.github_username)
      .maybeSingle();

    const existingProfileDek = (existingProfile as { encrypted_dek: string | null } | null)?.encrypted_dek ?? null;
    const profileUpdates: Record<string, unknown> = {
      github_login: tenant.github_username,
      voice_bootstrap: voiceBootstrap,
      updated_at: new Date().toISOString(),
    };

    if (effectiveOrgId) profileUpdates['buffer_org_id'] = effectiveOrgId;
    if (discoveredLinkedInChannelId) profileUpdates['buffer_linkedin_channel_id'] = discoveredLinkedInChannelId;

    if (isNewToken) {
      const sealed = await sealTenantSecrets({ bufferAccessToken: bufferToken }, existingProfileDek);
      profileUpdates['buffer_access_token'] = sealed.bufferAccessToken ?? null;
      profileUpdates['encrypted_dek'] = sealed.encryptedDek;
    } else if (!existingProfileDek && tenant.buffer_access_token) {
      // Profile has no token yet but tenant already has one — copy it across.
      // Happens when the user submits onboard without re-entering the masked token.
      const resolved = await resolveTenantSecrets(tenant).catch(() => null);
      if (resolved?.bufferAccessToken) {
        const sealed = await sealTenantSecrets({ bufferAccessToken: resolved.bufferAccessToken }, null);
        profileUpdates['buffer_access_token'] = sealed.bufferAccessToken ?? null;
        profileUpdates['encrypted_dek'] = sealed.encryptedDek;
      }
    }

    const { error: profileError } = await db
      .from('developer_profiles')
      .upsert(profileUpdates, { onConflict: 'github_login' });

    if (profileError) {
      logger.warn('onboard.developer_profile_upsert_failed', { installationId, login: tenant.github_username, error: profileError.message });
    } else {
      logger.info('onboard.developer_profile_saved', { installationId, login: tenant.github_username });
    }
  } catch (err) {
    logger.warn('onboard.developer_profile_upsert_error', { installationId, error: String(err) });
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
