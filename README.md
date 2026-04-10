# devcast

> Turn GitHub commits into publishable LinkedIn and Buffer drafts, in the author's own voice.

`devcast` is a multi-tenant GitHub App. Each installation becomes a tenant. Pushes enqueue jobs, the worker analyzes commits with the 24-module pipeline, generates one post per interesting commit, and publishes either directly to LinkedIn or into Buffer Ideas. A scanner loop closes the feedback loop from published posts back into the voice system.

## Architecture

Three Cloud Run runtimes share the same Docker image:

- `getdevcast-webhook`
  Receives GitHub webhooks, serves onboarding at `/onboard`, and handles GitHub + LinkedIn OAuth callbacks.
- `devcast-worker`
  Claims jobs from `job_queue`, analyzes commits, matches content intelligence context, generates drafts, and publishes.
- `devcast-scanner`
  Scans Buffer sent posts, computes edit feedback, refreshes content preferences, and recalculates progressive voice state.

The canonical deploy path is:

`push to trunk` -> GitHub Actions -> Docker build -> Cloud Run deploy

## Current Voice System

Phase 3 uses the progressive voice subsystem from [`docs/voice-system-spec.md`](docs/voice-system-spec.md):

- `cold`
  baseline voice only
- `bootstrap`
  bootstrap posts are used as exposure examples
- `warming`
  published examples plus soft voice signals
- `established`
  full exposure + voice dice + opening variety guard

Bootstrap posts live in `voice_profiles.voice.bootstrap_posts`. Published posts feed `voice_examples_pool`, `voice_moves`, `recent_opening_sequence`, and `voice_summary`.

## Local Commands

```bash
npm install
npm run typecheck
npm test

npm run webhook
npm run worker
npm run scan

npm run bootstrap
npm run test-analyze
npm run seed-corpus:extract
npm run seed-corpus:validate
npm run seed-corpus:seed
npm run rotate-tenant-tokens
npm run voice:analyze -- --tenant <tenant-id> --author <github-login>
```

All scripts use `tsx --env-file=.env.local`.

## Required Runtime Secrets

Webhook service:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `APP_BASE_URL`
- `OPENAI_API_KEY`
- `GCP_KMS_KEY_NAME`

Worker job:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GCP_KMS_KEY_NAME`

Scanner job:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GCP_KMS_KEY_NAME`

## Database

Run [`database/schema.sql`](database/schema.sql) in Supabase SQL Editor before deploying a new environment.

Important Phase 2 / Phase 3 additions already included there:

- content intelligence schema and matcher RPC
- `voice_profiles`
- `voice_posts.generation_system`
- `voice_posts.opening_move`
- KMS-compatible tenant secret storage via `tenants.encrypted_dek`

## Deploy

The deploy workflow lives in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

What it does on every push to `trunk`:

1. `npm ci`
2. `npm run typecheck`
3. Docker build + push
4. deploy webhook service
5. deploy worker job
6. deploy scanner job
7. re-apply required env vars and secrets, including `GCP_KMS_KEY_NAME`

## Install And Configure

Once the app is deployed, the end-to-end flow is:

1. Install the GitHub App on your personal account or org.
2. Complete GitHub OAuth if prompted.
3. Open onboarding at:
   `https://app.devcast.lilicurl.com/onboard?installation_id=<installation_id>`
4. Fill in:
   - author name
   - website
   - focus modules / audience / skip patterns
   - tone / rhythm / hashtags / post length
   - 1-3 bootstrap posts
   - Buffer API key + organization ID if using Buffer Ideas
5. Connect LinkedIn from the onboarding page if you want direct posting.
6. Push a real commit to a repo covered by that installation.

Expected result:

- webhook creates a `job_queue` row
- worker generates a draft
- LinkedIn posts directly when connected
- Buffer creates an Idea when configured
- GitHub gets a notification issue with links back to the draft context

## Smoke Test Checklist

After deploy, verify:

1. `/health` returns `ok`
2. GitHub installation webhook creates or reactivates a tenant
3. `/onboard` saves config and bootstrap posts
4. LinkedIn OAuth callback stores member ID and encrypted token
5. a push to a real repo creates one job in `job_queue`
6. worker run produces a `voice_posts` row with:
   - `generation_system`
   - `author_login`
   - `top_module_id`
   - `opening_move`
7. scanner run updates published rows with `edit_ratio` and `edit_analysis`
8. Loop 1 refresh writes `voice_stage`, `voice_examples_pool`, and eventually `voice_moves`

## Notes

- The seed corpus from Phase 2 must be present before expecting stable industry-context matches.
- `OPENAI_API_KEY` must be present in runtime and CI/CD, not only locally.
