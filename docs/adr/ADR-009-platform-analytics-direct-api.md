# ADR-009 — Platform analytics via direct API after Buffer publish

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-04-08 |
| Deciders | Liliana Castellanos |

## Context

devcast publishes via Buffer (see ADR-001). Buffer Ideas have no reaction or impression
analytics in the Buffer API — Buffer's value proposition is scheduling and distribution,
not analytics.

To compute `engagement_score` (`edit_ratio × 0.6 + norm(reactions_count) × 0.4`),
`reactions_count` must be populated from somewhere. The options were:

**Option A: No platform analytics.** Keep `reactions_count = 0` permanently. Use only
`edit_ratio` as the quality signal. Simple, no additional integrations.

**Option B: Direct platform API after Buffer publish.** After the user publishes from
Buffer, the scanner extracts the platform post identifier (e.g., LinkedIn URN) from the
Buffer sent feed. A separate analytics CRON then fetches reactions from the platform
API directly and updates `reactions_count`.

## Decision

**Direct platform API (Option B),** starting with LinkedIn.

The `edit_ratio` signal measures whether the developer edits the draft before publishing.
The `reactions_count` signal measures whether the published post resonates with the audience.
These are different and complementary signals. Using both produces a more accurate quality
score for voice training.

`edit_ratio` alone can mislead: a developer who publishes without editing but whose posts
get no traction is not generating high-quality content — the voice loop should not
reinforce that pattern.

**Dependency: LinkedIn app approval.** The LinkedIn socialActions API requires `r_liteprofile`
plus either `r_organization_social` or `w_member_social` scope, which requires LinkedIn
app review. This is blocked until approval is granted.

**Implementation flow (once approved):**

```
devcast-scanner (existing, every 2h):
  → For each matched voice_post where linkedin_urn IS NULL:
      → Extract linkedin_urn from Buffer sent feed response (service_update_id per channel)
      → Update voice_posts.linkedin_urn

devcast-analytics (new Cloud Run Job, every 24h):
  → SELECT posts WHERE linkedin_urn IS NOT NULL
      AND published_at > NOW() - INTERVAL '7 days'
      AND (last_reactions_fetch_at IS NULL
           OR last_reactions_fetch_at < NOW() - INTERVAL '24 hours')
  → GET LinkedIn socialActions API for each URN
  → Update reactions_count, recompute engagement_score, set last_reactions_fetch_at
```

**Why 7-day window:** LinkedIn engagement concentrates in the first 72h. Fetching beyond
7 days wastes API quota with diminishing returns.

**Option A remains viable as a fallback** if LinkedIn app approval is denied or delayed
significantly. `engagement_score` would be redefined as `edit_ratio` alone (remove the
reactions term) and `reactions_count` and `linkedin_urn` would be dropped from the schema.

## Consequences

**Better:**
- `engagement_score` uses actual audience signal, not just author editing behavior.
- Voice training loop reinforces posts that both the developer liked (high edit_ratio)
  and the audience engaged with (high reactions_count).

**Worse:**
- Blocked on LinkedIn app approval. Timeline unknown.
- Adds a third Cloud Run Job (`devcast-analytics`) and a new LinkedIn API dependency.
- `linkedin_urn` extraction depends on the Buffer sent feed exposing `service_update_id`
  per channel. If Buffer changes their API response shape, the extraction breaks silently
  (URN stays null, reactions never fetched, engagement_score stays null).
- Not all platforms Buffer publishes to have equivalent analytics APIs. Instagram and
  Twitter/X have progressively restricted their APIs. If the developer publishes to Instagram
  only, `reactions_count` will remain 0 for that post indefinitely.
