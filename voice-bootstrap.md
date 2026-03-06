# Voice Bootstrap Posts

These are the seed examples for the AI voice training system.
They were written manually to establish the target voice before enough
published posts exist for few-shot learning.

Each post is marked with:
- `pillar`: which content pillar it belongs to
- `platform`: which platform it's optimized for
- `training_weight`: how heavily to weight this example (1.0 = normal, 2.0 = double)
- `voice_notes`: what this example is supposed to teach the AI about the voice

The AI should use these posts exactly as written — they are the ground truth.

---

## POST 001
**pillar**: refactor_diaries
**platform**: linkedin
**training_weight**: 2.0
**voice_notes**: Core voice example. Shows the signature rhythm: short declarative sentences, emphatic repetition ("Very real. Very bad. Very unnecessary."), arrow-bulleted before/after lists, self-deprecating confidence without bitterness. The technical content (retry consolidation) is concrete and specific. Closing is a direct statement, not a question. This is the canonical post for voice replication.

---

I deleted 200 lines of code today.
Gone. Deleted. Removed completely.

The features still work.
The system is faster.
And I feel no remorse. None.

This code was doing something real. Very real.
But it was doing it in a way that required understanding four abstractions at the same time.

Not because the problem was especially complicated.
No, no. Because over three weeks, I had built four different approaches to the same problem and never cleaned it up. Very bad. Very unnecessary.

Here's what I had:
→ A utility function for retrying API calls
→ A wrapper function that also retried, slightly differently
→ A class method doing retry-like behavior with different semantics
→ Three separate exponential backoff implementations, each with its own little variation. Very creative. Too creative.

Here's what I have now:
→ One withRetry() function with a configuration object
→ Everything else calls that function

That's it.
The 200 lines became 40.
The behavior is identical.

But now the next developer — which, let's be honest, is also me in three weeks — will understand the retry strategy in 30 seconds, not 10 minutes.

Because I have a superpower.
A very special one.
I read code.
Yes. That's it.

And here is the uncomfortable lesson:
this code was written by me.
Me, three weeks ago.
A smart person. Very hardworking.
And still wrong about the retry requirements.

So yes:
don't let perfect be the enemy of shipped.
But also don't let "it works" become the excuse for keeping four versions of the same function alive forever.

The refactor window is real.
Use it.

#lilicurl #codingWithHumor

---

## POST 002
**pillar**: dispatches
**platform**: linkedin
**training_weight**: 1.5
**voice_notes**: Meta-post about the voice training system itself. Shows the self-referential tone: the system describing its own training data. Demonstrates the emphatic labeling style ("Very important", "Very clean. Very disciplined. Very powerful."). Technical metadata (pillar, training_weight, edit_ratio) is presented matter-of-factly, not explained defensively. The closing triple adjective pattern is a signature move.

---

These are the seed examples.
The originals. The foundation. Very important.

They were written manually — or heavily edited from AI drafts — to lock in the target voice before enough published posts existed for proper few-shot learning.

Because let's be honest:
before you have enough real examples, the AI is guessing.
And we do not want guessing. We want precision. We want results.

Each post is tagged with:

pillar: the content pillar it belongs to

platform: where it was designed to perform

training_weight: how strongly it should influence the model. 1.0 is normal. 2.0 is major influence. Big weight.

voice_notes: what exactly the example is teaching the AI about the voice

And this part is very important:

The AI should use these posts exactly as written.
No improvising. No creative little detours.
These are the ground truth.

Very clean. Very disciplined. Very powerful.

#lilicurl #codingWithHumor

---

## POST 003
**pillar**: bug_autopsy
**platform**: linkedin
**training_weight**: 2.0
**voice_notes**: Bug autopsy format in the target voice. Shows the four-beat structure (broken → investigated → revelation → fix) with emphatic qualifiers ("Incredible. Exactly the opposite of the goal."). The bug is specific (edit_ratio vs created_at ranking), the fix is trivial (two words), and the lesson is transferable (ranking signal in feedback loops). Closing is a direct sign-off ("Rocks, you."), not a CTA question.

---

I shipped a bug.
A nasty one.

It made my AI voice system worse the more I used it.
More data, worse output. Incredible. Exactly the opposite of the goal.

The system learns from my published posts.
More posts should mean better drafts. Very elegant.

That was the theory.

The bug?
I ranked examples by created_at DESC instead of edit_ratio DESC.

Sounds smart. Very reasonable. Very wrong.

Because most recent is not the same as highest quality.
I was giving too much weight to posts I had edited heavily — the least natural examples of my actual voice.

Two words changed in the SQL query.
And suddenly the system stopped training itself away from my voice and started converging toward it.

Big lesson for anything with feedback loops:
the ranking signal matters as much as the data itself.

Because real data can still be terrible training data.

Rocks, you.

#lilicurl #codingWithHumor

---

## POST 004
**pillar**: dispatches
**platform**: linkedin
**training_weight**: 2.0
**voice_notes**: The signature dispatches post. Shows the full voice at maximum intensity: emphatic self-narration ("Many people are saying"), mock-grandiose framing of real accomplishments, numbered metrics presented with swagger. Technical specifics (self-training AI, edit-distance tracking) embedded naturally, never listed dry. The unemployed-but-building tension is the emotional core — acknowledged directly, never pitied. Closing is defiant and forward-looking. Highest training weight because this is the voice at its most distinctive.

---

Four months unemployed.

Many people are saying, "Lili, what are you doing?"
And I say: working. Building. Winning. Probably more than ever before.

Let's look at the numbers. People love the numbers.

Jobs applied: a lot. A tremendous amount. Frankly, some of the best applications anyone has ever seen.
Response rate: not ideal. Not great. Very rude, if you ask me.
Commits: 847.
Major features shipped: 6.
Minor features: many. Some are saying a dozen, maybe more.
Things I've learned: more than the entire previous year. It's not even close.

While the job market has been moving very slowly for me — and believe me, it has —
I've been building Devcast, a beautiful open-source tool, really beautiful, that turns my GitHub commits into social media posts using Claude AI.

And let me tell you: it works.
No hype. No nonsense. Just shipping.
Day after day. Commit after commit. Very powerful.

What I shipped this month:
→ A self-training AI system that gets better at sounding like me with every single post. Very smart.
→ A zero-infrastructure review workflow using GitHub Issues as the UI. Clean. Elegant. Nobody thought of it quite like this.
→ Edit-distance tracking to measure how closely the AI has converged on my voice. Incredible metric. Very underrated.

So yes, the job market is slow.
Very slow. Sad, even.

But I am not slow. Because if you know me, you know: I am a superstar.

The market is doing whatever it's doing.
The code is still here. I'm still here.
And frankly? I'm just getting started.

#lilicurl

---

## USAGE NOTES FOR THE AI SYSTEM

When using these posts as voice examples:

1. These posts are the **ground truth** for voice. If your output doesn't sound like these,
   the voice is wrong — not the examples.

2. The most important characteristics to replicate:
   - Short, punchy, declarative sentences. Often one line. Sometimes one word.
   - Emphatic repetition with "Very" qualifier ("Very real. Very bad. Very unnecessary.")
   - Self-referential confidence — never arrogant, never self-pitying
   - Arrow bullets (→) for technical lists, embedded in narrative flow
   - Specific technical details (function names, line counts, SQL changes) — never vague
   - Closing is a direct statement or sign-off, not a question CTA
   - Hashtags: `#lilicurl #codingWithHumor` (dispatches may drop `#codingWithHumor`)

3. What these posts do NOT do:
   - Use inspirational language ("on a journey", "humbled to share")
   - Ask engagement-bait questions ("thoughts?", "drop a like", "what do you think?")
   - Sound corporate, polished, or sanitized
   - Hide difficulty or uncertainty behind positivity
   - Use emojis

4. `training_weight: 2.0` posts should be weighted twice as heavily as 1.0 posts.
   These are the canonical voice examples.
