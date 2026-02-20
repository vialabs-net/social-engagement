# devcast

> Turn every GitHub commit into a social media post — automatically, in your voice.

devcast monitors every commit you push across **all your GitHub repositories** and uses Claude AI
to generate platform-native social media posts. You review drafts, edit them, and approve with
a single comment. The system publishes to your Buffer queue — scheduled within your posting
window — and stores your published text as training data for the next round of generation.

**The AI gets better at sounding like you with every post you publish.**

Built during a developer job search. The code is the portfolio.

---

## How It Works

```
Your commits across all repos
        ↓  (polls every 4h via GitHub Events API — account-level, no per-repo setup)
Commit enrichment
(diff analysis, file type detection, change classification)
        ↓
Trivial commits → weekly batch
Interesting commits → Claude API
        ↓
Voice history retrieval
(your 5 most recently published posts, weighted by how little you edited them)
        ↓
claude-sonnet-4-6 generates 3 platform-native drafts
        ↓
GitHub Issue opens for review
(edit the issue body if needed, then comment /approve)
        ↓
Buffer schedules within 8am–7pm local window
        ↓
Published text stored in voice history
(closes the self-training loop)
```

---

## Features

| Feature | Details |
|---|---|
| **Install once** | GitHub Events API polling covers your entire account. New repos appear automatically. |
| **Self-training voice** | AI improves with every post you publish — learns from your edits, not its own drafts |
| **Human review required** | GitHub Issues inbox — no auto-publish path exists by design |
| **Timezone-aware scheduling** | Posts only within 8am–7pm local time. Architecturally enforced. |
| **Cost-minimal AI** | Batches trivial commits, caches all drafts, uses `claude-sonnet-4-6` |
| **Buffer queue management** | Respects 10-post free tier limit, holds posts when full and retries |
| **Free infrastructure** | GitHub Actions (public repo = unlimited minutes) + Supabase free tier |
| **Forkable** | 8-step setup, documented credential flow, config template included |

---

## Prerequisites

- GitHub account with repos you want to monitor
- [Buffer account](https://buffer.com) with LinkedIn/Twitter/Instagram channels connected
- [Anthropic API key](https://console.anthropic.com) (only paid component — ~$0.006/post)
- [Supabase account](https://supabase.com) (free tier, for voice history storage)

---

## Setup — 8 Steps

### Step 1 — Fork and enable Actions

Fork this repo to your GitHub account.
Settings → Actions → "Allow all actions and reusable workflows"

### Step 2 — Create the database

1. [supabase.com](https://supabase.com) → New project (free tier, pick any region)
2. SQL Editor → paste contents of [`database/schema.sql`](database/schema.sql) → Run
3. Settings → API → copy **Project URL** and **anon public key**

### Step 3 — Add secrets

Settings → Secrets and variables → Actions → New repository secret:

| Secret | How to obtain |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys → Create key |
| `BUFFER_ACCESS_TOKEN` | buffer.com → Settings → Apps → create app → complete OAuth → copy access token |
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key |

**Getting a Buffer access token (detailed):**
1. [buffer.com/developers/apps](https://buffer.com/developers/apps) → Create a new app
2. App name: anything (e.g., "devcast"). Callback URL: `http://localhost`
3. Note your Client ID and Client Secret
4. Complete the OAuth authorization flow once to exchange for an access token
5. Copy the token — it is long-lived (months before expiry)

### Step 4 — Configure

```bash
npm install
cp config.example.yaml config.yaml
```

Edit `config.yaml`:

```yaml
author:
  github_username: "your-github-username"  # required
  name: "Your Name"
  website: "https://yoursite.com"          # appears in LinkedIn CTAs
```

### Step 5 — Link Buffer channels

```bash
npm run setup-buffer
```

Prints your connected Buffer channels with IDs. Paste into `config.yaml`:

```yaml
platforms:
  linkedin:
    enabled: true
    buffer_profile_id: "abc123"     # from setup-buffer output
  twitter:
    enabled: true
    buffer_profile_id: "def456"
```

### Step 6 — Write your voice bootstrap

Open `voice-bootstrap.md`. Replace the example posts with **3–5 posts written in your actual
voice**. This is the most important step — the AI learns to sound like you from these examples.

Specific and honest > polished and generic. See [`CONTENT_GUIDE.md`](CONTENT_GUIDE.md).

### Step 7 — Seed voice history

```bash
npm run bootstrap
```

Or: Actions → "Bootstrap Voice" → "Run workflow"

### Step 8 — Test end-to-end

Actions → "Poll and Generate" → "Run workflow"

A GitHub Issue should appear with draft posts for your recent commits.
Review the issue, edit any section, then comment:

```
/approve linkedin twitter
```

Your post will be scheduled in Buffer within the 8am–7pm window (your local time).

**Done.** The system polls every 4 hours automatically from here.

---

## The Review Workflow

The system opens a GitHub Issue for each processed commit:

```markdown
## Commit
**[abc1234](link)** in `owner/repo` — "feat: add OAuth integration"
`feature` | 5 files changed, +234 -12

---

## LinkedIn
[AI-generated post...]

---

## X / Twitter
**1/3** First tweet
**2/3** Second tweet
**3/3** Third tweet

---

## Instagram
[AI-generated caption...]

---

To publish: `/approve all`  `/approve linkedin`  `/approve twitter instagram`
To reject:  `/reject [optional reason]`
```

Edit any section of the issue body before approving. The system reads your final version —
not the original draft — when you comment `/approve`.

---

## The Self-Training Voice Loop

Every published post is stored with two fields:
- `ai_draft` — what Claude originally wrote
- `published` — what you actually published (after any edits)

The **edit ratio** (`edit_ratio`) measures word-level similarity: `1.0` = published unchanged,
`0.0` = complete rewrite. Future prompts retrieve your most recent published posts ordered
by edit ratio (best examples first) and place them at the **top** of the AI context window.

The AI converges on your actual voice — not a description of your voice, but real examples
of the posts you chose to publish. Heavy early editing is expected and feeds better data.

**Convergence milestones:**

| Phase | Posts | edit_ratio | What is happening |
|---|---|---|---|
| Foundation | 1–10 | ~0.25 | AI provides structure, you provide voice |
| Convergence | 11–50 | ~0.70 | AI gets it mostly right, you refine |
| Mature | 50+ | ~0.87+ | Edits are word-level refinements |

---

## Posting Schedule

Posts are only scheduled within a configurable window — by default, 8:00 AM to 7:00 PM
local time (configurable in `config.yaml`).

Scheduling uses IANA timezone identifiers (e.g., `America/Santiago`) so Daylight Saving
Time is handled correctly. Slots within the window: 8am, 12pm, 5pm. Posts approved outside
the window are scheduled for the next available slot (e.g., approve at 11pm → scheduled for
8am tomorrow). The `scheduled_at` timestamp sent to Buffer is always UTC, computed from the
local slot time.

---

## Content Strategy

Five content pillars:

| Pillar | Triggered by | Format |
|---|---|---|
| **Build Log** | New features, architecture decisions | "What I built and why the obvious approach was wrong" |
| **Bug Autopsy** | Bug fixes, debugging sessions | "Setup → Investigation → Revelation → Lesson" |
| **AI Co-Pilot** | AI-assisted commits | "What I asked, what AI produced, what I changed and why" |
| **Refactor Diaries** | Refactors, simplifications | "Before/after — here is what changed in my thinking" |
| **Dispatches** | Milestones, meta-commits, weekly batches | "Building seriously while the market does its thing" |

See [`CONTENT_GUIDE.md`](CONTENT_GUIDE.md) for full platform rules, voice guidelines,
and the commit-to-content decision tree.

---

## Architecture

```
devcast/
├── .github/workflows/
│   ├── poll-and-generate.yml      # Cron every 4h: poll → filter → generate → issue
│   ├── publish-approved.yml        # On /approve: validate → schedule → publish → store
│   └── bootstrap-voice.yml         # Manual: seed voice history from bootstrap file
├── src/
│   ├── github/                     # Events API polling + commit enrichment
│   ├── ai/                         # Claude prompt assembly + generation (Sonnet, max 1600 tokens)
│   ├── buffer/                     # Publishing + queue management (free tier aware)
│   ├── scheduling/                 # Timezone-correct slot claiming (date-fns-tz)
│   ├── voice/                      # IVoiceStorage interface + Supabase/Gist implementations
│   ├── review/                     # GitHub Issue creation + /approve parsing
│   ├── config/                     # Zod-validated config loading
│   └── utils/                      # Retry policies, commit filtering, structured logging
├── scripts/
│   ├── setup-buffer.ts             # List Buffer channels with IDs
│   ├── bootstrap-voice.ts          # Seed voice DB from bootstrap file
│   ├── manage-voice.ts             # CLI: inspect/delete voice history
│   └── test-generate.ts            # Generate a test post for any commit SHA
└── database/
    └── schema.sql                  # Supabase schema (run once)
```

**Stack**: TypeScript · Node.js 20 · `@octokit/rest` · `@anthropic-ai/sdk` · `@supabase/supabase-js` · `date-fns-tz` · `zod` · `diff` · `vitest`

---

## Scripts

```bash
npm run setup-buffer    # List Buffer channels with profile IDs (run once during setup)
npm run bootstrap       # Seed voice history from voice-bootstrap.md
npm run manage-voice    # Interactive CLI for inspecting/deleting voice history
npm run test-generate   # Generate posts for any commit SHA without publishing
npm test                # Run test suite
```

---

## Configuration Reference

```yaml
# config.yaml (copy from config.example.yaml, then gitignore)

author:
  github_username: ""           # your GitHub login — required
  name: ""                      # your display name
  website: ""                   # appears in LinkedIn CTAs

github:
  exclude_repos: []             # ['owner/repo'] to skip
  exclude_patterns:             # regex patterns to skip on commit message
    - "^(wip|temp|fixup!)"
  max_commits_per_push: 1       # process only the most recent commit per push

platforms:
  linkedin:
    enabled: true
    buffer_profile_id: ""
  twitter:
    enabled: true
    buffer_profile_id: ""
  instagram:
    enabled: false
    buffer_profile_id: ""

scheduling:
  timezone: "America/Santiago"  # IANA timezone identifier
  window_start_hour: 8          # 8:00 AM
  window_end_hour: 19           # 7:00 PM (hard cutoff)
  daily_slots: [8, 12, 17]      # posting times (hours in local time)

posting:
  poll_interval_hours: 4
  interesting_min_lines: 10     # skip commits below this line count
  voice_examples_count: 5
  max_pending_drafts: 10

ai:
  model: "claude-sonnet-4-6"
  max_tokens: 1600
```

---

## Troubleshooting

**No Issues are being created**
Enable GitHub Actions in your fork (Settings → Actions). Trigger "Poll and Generate" manually
and check the workflow logs. Verify `author.github_username` matches your GitHub login exactly.

**Buffer publishing fails with 401**
Your Buffer access token has expired. Regenerate: buffer.com → Settings → Apps → your app.
Update the `BUFFER_ACCESS_TOKEN` secret in your fork's Settings.

**Posts are not being scheduled in the right time window**
Check that `scheduling.timezone` is set to the correct IANA identifier for your location.
The slot times in `daily_slots` are in local time per that timezone.

**Supabase project paused**
Free tier projects pause after 7 days of no connections. Visit supabase.com → your project →
"Resume project". The 4-hour cron prevents this during normal use.

**Posts do not sound like me (early phase)**
Expected for posts 1–10. Edit `voice-bootstrap.md` to be more specific to your real voice,
then re-run `npm run bootstrap` to reseed. Specific > polished. Real > ideal.

**Buffer queue full — posts not publishing**
The system holds full-queue posts as `queued` and drains them at the start of the next cron run.
No posts are dropped. Check your Buffer dashboard to see the current queue state.

---

## Customizing for Your Fork

| File | What to edit |
|---|---|
| `voice-bootstrap.md` | Replace with your own example posts — this is the most important file |
| `config.yaml` | Your credentials, timezone, posting schedule |
| `content-strategy.json` | Pillar triggers, platform rules, hook templates |
| `CONTENT_GUIDE.md` | Voice guide, platform rules, anti-patterns |

---

## Cost Estimate

The only paid component is the Anthropic Claude API.

| Scenario | API calls/month | Estimated cost |
|---|---|---|
| Light (20 posts) | ~20 calls | ~$0.12 |
| Moderate (50 posts) | ~50 calls | ~$0.30 |
| Active (100 posts) | ~100 calls | ~$0.60 |

Trivial commits are batched into one weekly roundup call. Cached drafts are never regenerated.

---

## Roadmap

**v1.0 — MVP**
- [x] GitHub Events API polling (account-level, all repos)
- [x] Claude post generation with self-training voice loop
- [x] GitHub Issues review workflow
- [x] Timezone-correct Buffer scheduling (8am–7pm window)
- [x] Queue management (free tier aware)
- [x] Supabase voice history with edit ratio tracking
- [x] Forkable setup in 8 steps

**v1.1**
- [ ] Instagram support
- [ ] Weekly roundup batch generation
- [ ] Voice convergence stats (`npm run convergence-report`)

**v2.0**
- [ ] GitHub App trigger (real-time, replaces polling)
- [ ] Web review dashboard (replaces GitHub Issues)
- [ ] Hashtag and tag suggestions

---

## Contributing

Issues and PRs welcome. See [CLAUDE.md](CLAUDE.md) for architecture decisions and conventions.
PRs should match existing TypeScript patterns and pass `npm test`.

---

## License

MIT — use it, fork it, build on it.

---

*The architecture is documented. The code is in progress. The voice is converging.*
