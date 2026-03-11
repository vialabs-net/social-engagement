---
name: devcast-code
description: >
  Coding workflow skill for the devcast project. Trigger this skill whenever the user
  asks to implement, fix, refactor, review, or debug any code in the social-engagement
  repository. Also trigger when the user asks to add a module, change the pipeline,
  modify Buffer integration, update scheduling logic, or any other code change request.
  This skill enforces a strict, incremental, adversarial-quality engineering workflow.
---

# devcast — Engineering Workflow

> Global CLAUDE.md rules apply automatically: commit workflow, code review, response format,
> incremental implementation, adversarial quality stance. This skill adds devcast-specific
> constraints only.

---

## Code Standards (Project-Specific)

In addition to global standards:

- **`date-fns-tz`** for all timezone logic — never hardcode UTC offsets
- **No magic strings** — use `const STATUS = { PENDING: 'pending' } as const`
- Structured logs (JSON) — use `logger` object, never `console.log`

---

## Code Review Focus (devcast-Specific)

In addition to global review checklist:

### Reliability
- Retry logic aligned with per-service policy (see devcast context skill)
- Idempotency: duplicate SHA detection, slot uniqueness
- Partial failure in `Promise.allSettled` — does caller handle null correctly?

### Observability
- Structured JSON logs with: commit SHA, repo, platform in every relevant log
- No sensitive data in log fields (tokens, API keys)

---

## devcast-Specific Constraints

- **Never call Claude more than once per commit** — if you see code that calls the AI per module, flag it
- **MODULE_REGISTRY is the only file to edit** when adding a module — no other plumbing changes
- **Buffer queue depth check** must precede every `publisher.ts` call — never skip it
- **Slot claiming** must use the DB UNIQUE constraint, not in-memory locks
- **Posting window enforcement** lives in `slot-manager.ts` — do not duplicate it in callers
- **max_tokens=1600** in `ai/client.ts` is hardcoded and must never be increased
- **19 modules** in MODULE_REGISTRY — update count in docs when adding/removing

---

## Adding a New Module (Template)

1. Create `src/analysis/modules/your-module.ts`:

```typescript
import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';

const FILE_REGEX = /\.(ts|js)$/; // adjust per module scope

export class YourModule implements CodeAnalyzer {
  readonly id = 'your_module';
  readonly name = 'Your Module';
  readonly category = 'your_category' as const;

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    const relevantDiffs = ctx.diffs.filter((d) => FILE_REGEX.test(d.filename));
    if (relevantDiffs.length === 0) return null;

    for (const diff of relevantDiffs) {
      if (!diff.patch || diff.status === 'removed') continue;
      const addedLines = diff.patch
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1));
      if (addedLines.length === 0) continue;

      // Detection logic here
      // if (detected) return { moduleId, aspect, finding, technicalDetail, plainLanguage, interestScore, contextHint };
    }
    return null;
  }
}
```

2. Add to `src/analysis/modules/index.ts`: import + one line in MODULE_REGISTRY array
3. Add category to `AnalysisCategory` union in `src/analysis/types.ts` if new
4. Test with `npm run test-analyze -- <commit-sha>`

---

## Debugging Guide

| Symptom | Check |
|---------|-------|
| No posts generated | `npm run test-analyze -- <sha>` — are modules finding anything? |
| Duplicate events processed | Check `events-poller.ts` logs for `newEvents` count. Verify `last_event_id` in DB. |
| Claude returns empty/malformed | Check prompt size. Look for XML tag parsing in `post-generator.ts`. |
| Buffer 401 | Token expired. Run `npm run setup-buffer` to verify. Regenerate at buffer.com. |
| Module returns null unexpectedly | Run `npm run test-analyze` — check if file regex matches, if patch has added lines. |
| Typecheck fails after module add | Verify `AnalysisCategory` union includes new category in `types.ts`. |
