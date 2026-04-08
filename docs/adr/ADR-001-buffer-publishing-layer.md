# ADR-001 — Buffer as the publishing layer

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-04-07 |
| Deciders | Liliana Castellanos |

## Context

devcast generates social media posts from commit analysis. Those posts need to reach LinkedIn,
Instagram, Twitter/X, Facebook, and potentially others. The alternatives were:

1. **Direct integration per platform** — OAuth + posting API for each network separately.
2. **Buffer as a publishing intermediary** — devcast sends draft Ideas to Buffer; the developer
   reviews and publishes from Buffer's native UI.

Additional constraint: LinkedIn's API requires app review before `w_member_social` scope is
granted. Direct LinkedIn posting cannot be done without that approval.

## Decision

Use Buffer as the single publishing layer. devcast creates Ideas (drafts) in Buffer via
the GraphQL API. The developer reviews from Buffer's UI and publishes to any connected
network.

Buffer free tier supports 3 channels (LinkedIn, Instagram, and one more). This covers the
primary use case without cost.

**Direct platform integrations are out of scope for the current phase.**
`src/linkedin/client.ts` exists in the codebase from an earlier prototype but is not called
in the production pipeline.

## Consequences

**Better:**
- One integration (Buffer) covers all social networks devcast will ever need.
- The developer retains full editorial control — devcast never auto-publishes.
- No separate OAuth flows to maintain per platform in the short term.
- Reduces maintenance surface: Buffer handles scheduling, formatting, and platform-specific
  rendering rules.

**Worse:**
- Buffer free tier limits: 3 channels, 10 queued posts per channel. At scale this becomes
  a paid plan dependency.
- Buffer doesn't support third-party OAuth for API keys — users paste the key at onboarding.
  This is a worse UX than OAuth and requires the key to be stored securely.
- Buffer's API (GraphQL at `api.buffer.com`) is the published API; the older REST
  (`api.bufferapp.com/1`) is deprecated and returns 500s. This means all Buffer operations
  must use GraphQL.
- devcast cannot fetch platform-level analytics (reactions, impressions) through Buffer —
  requires a separate direct platform integration per network. See ADR-009.
