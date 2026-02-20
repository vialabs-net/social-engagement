# Voice Bootstrap Posts

These are the seed examples for the AI voice training system.
They were written manually (or heavily edited from AI drafts) to establish
the target voice before enough published posts exist for few-shot learning.

Each post is marked with:
- `pillar`: which content pillar it belongs to
- `platform`: which platform it's optimized for
- `training_weight`: how heavily to weight this example (1.0 = normal, 2.0 = double)
- `voice_notes`: what this example is supposed to teach the AI about the voice

The AI should use these posts exactly as written — they are the ground truth.

---

## POST 001
**pillar**: dispatches
**platform**: linkedin
**training_weight**: 2.0
**voice_notes**: Establishes the core narrative: unemployed + building seriously. Sets the meta-inception tone (a tool posting about itself). Shows how to hold two truths at once (funny situation + serious work) without either canceling the other.

---

I built a tool that turns my GitHub commits into social media posts.

This is that tool's first post about itself.

I've been unemployed since October. In that time, I've written more code than I did in the six months before layoff. Turns out "free time" and "existential motivation" are a powerful combination.

devcast is a personal branding project with a weird property: it gets smarter the more I use it. Every post I publish becomes a voice example for the next generation of drafts. The AI learns from my edits, not its own output.

So by the time this system is mature, it'll sound like me. Right now it sounds like a developer who read a lot of LinkedIn posts and made some educated guesses. Which, frankly, is relatable.

Here's what I built this week:
→ GitHub Actions polling every 4 hours across all my repos
→ A GitHub Issues-based review workflow (zero infrastructure, GitHub is the UI)
→ SQLite voice history with edit distance tracking
→ Claude prompt assembly that puts my published posts at the TOP of context

The architecture decision I'm most proud of: using GitHub Issues as the draft inbox. No web server, no database for the review UI, no additional accounts. The review interface was already built. I just needed to use it.

The architecture decision I'm least proud of: I genuinely considered storing state in git notes before coming to my senses.

Building in public means the good decisions AND the embarrassing ones are on the record.

What's the most creative "I'm using GitHub as a backend" decision you've made?

#buildinpublic #typescript #softwareengineering #devcast

---

## POST 002
**pillar**: bug_autopsy
**platform**: twitter
**training_weight**: 2.0
**voice_notes**: Establishes the Bug Autopsy format. Shows the four-beat structure (broken → investigated → revelation → lesson) compressed into thread format. The self-deprecating opener is the hook; the specific technical lesson is the value. Note: Tweet 1 must work standalone as a complete thought.

---

**Tweet 1/5:**
I spent 45 minutes debugging why my GitHub Actions workflow wasn't picking up new commits.

The issue: I was comparing timestamps instead of SHAs.

This is a story about making the wrong assumption before reading the docs. 🧵

**Tweet 2/5:**
The code looked correct. I was fetching commits since `last_run_timestamp`. Storing the timestamp. Comparing on next run.

Works in theory. Fails in practice because GitHub's API returns commits in `author_date` order, not `push_date` order.

A commit authored 3 days ago, pushed today, gets skipped. Forever.

**Tweet 3/5:**
My debugging process, documented for your amusement:

→ Added logging (the commit was there, just filtered out)
→ Checked my date parsing (fine)
→ Checked timezone handling (fine, UTC throughout)
→ Re-read the API docs for the first time instead of the second time

The docs say: "Lists commits in reverse chronological order, by `committer_date`."

I had been using `author_date`. Not the same thing.

**Tweet 4/5:**
The fix: compare SHAs, not timestamps.

Store the last processed SHA per repo. On each poll, fetch commits until you hit a known SHA. Stop there.

SHA comparison is O(commits_since_last_run) and never has timezone bugs, author-vs-committer confusion, or clock skew issues.

45 minutes. 3 lines changed.

**Tweet 5/5:**
The lesson: when an API has two date fields that sound like the same thing, they are not the same thing.

`author_date` = when the commit was created locally
`committer_date` = when the commit entered the tree (rebase, cherry-pick, push)

Read the API docs like they were written by someone who had a reason to distinguish these.

They did.

#buildinpublic #typescript

---

## POST 003
**pillar**: ai_copilot
**platform**: linkedin
**training_weight**: 2.0
**voice_notes**: Shows the AI Co-Pilot voice. Transparent about what Claude did, what survived, what didn't. Critical but not dismissive of AI. The tone is collaborative partner, not magic oracle or useless tool. Shows the "I directed it, it surprised me, I kept the good part" pattern.

---

I asked Claude to write the commit classification logic.

It wrote something I wouldn't have written. I shipped it anyway.

Here's the interesting part.

My plan was a simple if/else chain: check the commit message for keywords, assign a pillar, done. Readable, predictable, easy to test. I described this plan to Claude and asked it to implement it.

Claude implemented a priority-based classifier with a `pillarPriority` array that gets walked in order. Same result, different structure.

My first instinct was to rewrite it. "I know what I asked for. This isn't what I asked for."

My second instinct was to figure out why it made that choice.

It turns out the priority array matters more than I thought. The same commit can match multiple pillars. "fix: add missing null check in AI prompt builder" hits both `bug_autopsy` (fix keyword) and `ai_copilot` (AI mentioned). Without priority ordering, the result is arbitrary. With it, the result is a design decision I can change in one line.

The AI didn't explain this. It just built the more robust version by default.

What I changed: I added comments explaining the priority order, because the AI left that implicit. Four lines of comments, which I wrote. The rest shipped as-is.

Lesson: when an AI writes code you don't immediately understand, spend five minutes figuring out why before you rewrite it. Sometimes it's wrong. Sometimes it's solving a problem you hadn't seen yet.

The ratio of "AI was wrong" to "I hadn't seen the problem yet" is about 60/40 in my experience. Worth the five minutes either way.

What's your threshold for trusting AI-generated code you didn't ask for?

#buildinpublic #ai #typescript #softwareengineering

---

## POST 004
**pillar**: refactor_diaries
**platform**: twitter
**training_weight**: 1.5
**voice_notes**: Before/after format, Twitter thread. Shows the Refactor Diaries voice: specific, educational, never shameful. "Past me was doing their best" framing. The technical lesson is concrete — someone should be able to apply it immediately.

---

**Tweet 1/4:**
Before:
```
async function getVoiceExamples(db, platform, limit) {
  const rows = db.all(`SELECT * FROM voice_posts WHERE...`)
  return rows.map(r => r.published)
}
```

After:
```
async function getWeightedVoiceExamples(
  storage: IVoiceStorage,
  options: VoiceQueryOptions
): Promise<VoiceExample[]>
```

Same job. Very different contract. Here's why it matters. 🧵

**Tweet 2/4:**
The original function was fine for day 1.

By day 3 I needed:
→ Different ordering (by edit_ratio, not created_at)
→ Platform filtering
→ A minimum edit_ratio threshold
→ Both SQLite and Supabase backends

The function signature couldn't express any of this. Every new requirement became a new parameter or a new function.

**Tweet 3/4:**
The refactored version:
→ Takes an interface (`IVoiceStorage`) instead of a raw db handle — can swap backends
→ Takes an options object — new requirements are additive, not breaking
→ Returns `VoiceExample[]` with typed fields — callers don't have to know the schema

The TypeScript types aren't decoration. They're the contract. The function tells you what it needs and what it promises.

**Tweet 4/4:**
The lesson: when you find yourself adding a 4th parameter to a function, that's usually the function telling you it wants an options object.

And when you find yourself passing a raw database handle, that's the function telling you it wants an interface.

Past me was doing their best. Present me has slightly better taste.

#typescript #buildinpublic #refactoring

---

## POST 005
**pillar**: build_log
**platform**: linkedin
**training_weight**: 1.5
**voice_notes**: Build Log voice: here's what I built, here's why the naive approach fails, here's what actually shipped. Shows the "counterintuitive design decision" format. Technical enough to be credible, accessible enough to be shareable. The unemployed-building angle is present but not belabored.

---

The review workflow for this project is GitHub Issues.

Not a web dashboard. Not a CLI tool. GitHub Issues.

I know how that sounds. Let me explain.

When I designed devcast, I needed a way to review AI-generated draft posts before they go live. The obvious approaches were: build a web UI, or build a CLI. Both require infrastructure or local setup. Both add friction.

The GitHub Issues approach:
→ System generates draft posts, opens a GitHub Issue with formatted content
→ I read the drafts directly in the issue (GitHub renders Markdown beautifully)
→ I edit the issue body if I want to change anything
→ I comment `/approve linkedin twitter` to publish
→ A workflow triggers, publishes to Buffer, stores to voice history, closes the issue

The infrastructure cost: zero. The UI cost: zero. GitHub already built this. I'm using it.

Here's what surprised me about this decision: it's actually better than a custom UI for the current stage. Issues have search, labels, assignment, notifications, and a mobile app. They're persistent, browseable, and free. A custom dashboard would give me maybe 20% more control and 100% more maintenance.

The tradeoff I'm accepting: it has friction. Navigating to GitHub, finding the issue, editing the body — it's not as smooth as a custom UI. I'll replace it in v2 when the usage patterns are clearer.

But here's the software lesson I keep re-learning: don't build infrastructure for a problem you haven't had yet. I don't know what the review workflow should feel like in six months. The issues approach will show me.

What's the most creative "use an existing platform as your backend" decision you've made?

#buildinpublic #softwareengineering #typescript #systemdesign

---

## POST 006
**pillar**: bug_autopsy
**platform**: instagram
**training_weight**: 1.5
**voice_notes**: Instagram voice — more personal, more emotional, shorter sentences, visual language. Front-loads the hook (< 140 chars). The universal lesson bridges from my specific experience to any developer's. CTA invites saves.

---

I shipped a bug where the AI voice got worse the more I used the system.

The opposite of the goal.

Here's what happened and why it's actually a lesson about feedback loops.

The self-training voice system works by taking my published posts and feeding them back as examples. More posts = better examples = better drafts = less editing = higher edit_ratio.

That's the theory.

The bug: I was sorting voice examples by `created_at` descending. Most recent first. Sounds right.

But "most recent" and "highest quality" aren't the same thing. Early posts — where I did the most editing — were the least representative of my actual voice. And they were being weighted equally.

The fix: sort by `edit_ratio` descending, not `created_at`. Give the posts I barely edited the most influence. Give the posts I rewrote heavily the least.

Two words changed in the SQL query. The system went from actively training itself away from my voice to converging toward it.

The lesson that transfers to anything you build with feedback loops: the signal you use to rank examples matters as much as having examples at all. Garbage in, garbage out — even when the garbage is "real data."

Save this if you've ever accidentally trained a system to get worse.

---

## POST 007
**pillar**: dispatches
**platform**: linkedin
**training_weight**: 2.0
**voice_notes**: The "meta" Dispatches post — honest about the job search, funny about it, not sad. Shows the "two truths" voice: I'm unemployed AND I'm more productive than ever. The technical content is present (what I shipped), but the emotional honesty is the hook. This is the post that will make other unemployed developers share it.

---

Four months unemployed. Here's my honest accounting.

Jobs applied: too many to count comfortably.
Response rate: not great.
Commits: 847.
Features shipped: 6 major, a dozen minor.
Things I've learned: more than the previous year.

I've been building devcast, an open-source tool that turns my GitHub commits into social media posts using Claude AI. It's a personal branding tool for a developer job search that is itself part of the portfolio.

The recursive nature of this is not lost on me.

Here's what nobody told me about unemployment as a developer: if you're still building, you're not unemployed in any sense that matters to your skills. The job market can be slow. The code doesn't care.

What I've shipped this month that I'm proud of:
→ A self-training AI system that gets better at sounding like me with each post
→ A zero-infrastructure review workflow using GitHub Issues as the UI
→ Edit distance tracking that measures how well the AI has converged on my voice

What I've learned about building in public:
→ Documenting your work as you build is not extra. It IS the work, for a solo developer.
→ The commits you're most tempted to hide are usually the most educational
→ People engage with honest failure + specific lesson more than polished success

The job market is whatever it is. The code is still here.

If you're also building through a gap: what's the most important thing you've shipped that you didn't expect to?

#buildinpublic #layedoff #softwareengineering #opentowork

---

## POST 008
**pillar**: ai_copilot
**platform**: twitter
**training_weight**: 1.5
**voice_notes**: Compressed AI Co-Pilot for Twitter. Shows the single-tweet format working for an AI observation (doesn't need a thread). Demonstrates the "AI surprised me and I learned from it" pattern in minimal form. The voice is confident, specific, slightly irreverent.

---

**Tweet 1/1 (single tweet):**
I asked Claude to generate a LinkedIn post from a commit.

It generated a LinkedIn post AND added a section I didn't ask for: "What this means if you're using a different stack."

I almost deleted it. Then I realized that section gets 3x the engagement of the rest.

The AI has been reading LinkedIn longer than I have. This is fine.

#buildinpublic #ai

---

## POST 009
**pillar**: refactor_diaries
**platform**: linkedin
**training_weight**: 1.5
**voice_notes**: A more philosophical Refactor Diaries post. Shows the "here's the principle, not just the code" format. The technical content is grounded but the lesson is transferable. Demonstrates the voice can be thoughtful without being corporate or lecture-y.

---

I deleted 200 lines of code this week.

The features still work. The system is faster. I feel no remorse.

The code was doing something real, but it was doing it in a way that required understanding four different abstractions simultaneously. Not because the problem was complex. Because I had accumulated four different approaches to the same problem over three weeks and never consolidated them.

Here's what I had:
→ A utility function for retrying API calls
→ A wrapper function that also retried, slightly differently
→ A class method that did retry-like behavior with different semantics
→ Three separate implementations of exponential backoff, each with one minor variation

Here's what I have now:
→ One `withRetry()` function with a configuration object
→ Everything else calls that function

The 200 lines became 40. The behavior is identical. The next developer (me, in three weeks) will understand the retry strategy in 30 seconds instead of 10 minutes.

The uncomfortable lesson: this code was written by me, three weeks ago, when I thought I knew what the retry requirements were. I was wrong about the requirements. Each new case seemed slightly different, so I wrote a slightly different solution.

The right move would have been to write the flexible version first. The realistic move was to consolidate after seeing all the cases.

Don't let perfect be the enemy of shipped. But don't let "it works" be the reason you never consolidate the four versions of the same function.

The refactor window is real. Use it.

When do you know a refactor is overdue vs. premature?

#buildinpublic #typescript #softwareengineering #refactoring

---

## POST 010
**pillar**: build_log
**platform**: linkedin
**training_weight**: 2.0
**voice_notes**: The milestone post — first successful end-to-end run. Shows how to write about success without humble-bragging or being cringe. The voice is specific (what exactly worked), honest (what still needs work), and celebratory without being precious. This is the post that closes the first chapter and sets up what comes next. High training weight because it represents the mature voice at the end of the bootstrap phase.

---

It worked.

New commit detected. Enriched with diff data. Prompt assembled with voice examples. Claude generated three platform posts. GitHub Issue opened for review. I edited one sentence. Commented `/approve linkedin`. Buffer published. Voice history updated.

End-to-end. For real. Not a test.

The commit that triggered it was ironic: "fix: improve commit enrichment to handle empty diffs." The first post about devcast was generated by fixing a bug in the part of devcast that reads commits to generate posts about devcast.

The post the AI generated was... okay. Serviceable. It had the right structure. The voice wasn't quite there. It sounded like someone who had read my documentation about my voice rather than someone who had read my actual posts.

Which is exactly right, because that's all it had.

This is what a cold start looks like: the system works, but the outputs are generic. The first 10 posts are the hardest to write and the most important to get right, because they're the training data for everything that follows. The AI will sound like me when I've shown it what I actually sound like — not described it.

Here's what's working:
→ Commit polling and enrichment: solid
→ GitHub Issues workflow: surprisingly good
→ Buffer integration: clean
→ Voice history storage: working but untested at scale

Here's what needs work:
→ The prompt needs more specific voice guidance in the cold-start phase
→ The edit ratio tracking needs a UI so I can see convergence over time
→ Instagram support is missing (I punted it to v1.1)

Building in public means the first iteration is visible. The first iteration is always embarrassing. This is fine. The embarrassing first iteration is what the good version gets built on.

Week 1 done. On to Week 2.

#buildinpublic #typescript #softwareengineering #devcast

---

## USAGE NOTES FOR THE AI SYSTEM

When using these posts as voice examples:

1. These posts are the **ground truth** for voice. If your output doesn't sound like these,
   the voice is wrong — not the examples.

2. The most important characteristics to replicate:
   - Specific technical details (not general principles)
   - Self-aware humor about the situation (not bitter, not precious)
   - The "unemployed but building" context is present but never the focus
   - CTAs are specific questions, not "thoughts?" or "drop a like"
   - The lesson is always transferable, not just autobiographical

3. What these posts do NOT do:
   - Use inspirational language ("on a journey", "humbled to share")
   - Hide the difficulty or uncertainty
   - Sound corporate or polished-to-the-point-of-dishonesty
   - Make the AI use feel like an apology or disclaimer

4. `training_weight: 2.0` posts should be weighted twice as heavily as 1.0 posts.
   These are the canonical voice examples.
