# Industry Context Convergence Spec

## Goal

Keep article matches visible enough to add value, without implying the author read the
article, borrowed the idea from it, or is citing it as authority.

The post must continue to speak from the developer's own code and judgment.
Industry context exists to position the post, not to source it.

## Problem

The current `industry_context` contract is too thin:

- the worker injects a raw `Connection: ...` string
- the prompt only says "Use this only if it strengthens the post naturally"
- the model has no explicit rule separating `parallel validation` from `citation`

That leaves too much room for two failure modes:

1. The match becomes invisible, so the article adds little value.
2. The match becomes too direct, so the copy sounds like the author read the piece or
   learned the idea from it.

## Desired Behavior

When an article match is used in a post, it should behave like one of these:

- external validation: the author's point is reinforced by the fact that similar
  tradeoffs are appearing in industry writing
- conceptual parallel: the author's change belongs to a broader technical conversation

It must **not** behave like:

- source attribution
- proof of the author's claim
- a claim that the author read the matched article
- a citation of a specific article title

## Core Rules

1. The post speaks from the code and the author's decision-making.
2. Industry context may only reinforce an idea that already exists in the commit and the
   selected findings.
3. The industry reference must remain subordinate to the author's own argument.
   If it is removed, the post should still work.
4. Use language of convergence, not derivation.
5. If explicit naming appears, it should name a broader source family or brand as an
   example of the conversation, never a specific article title.
6. Never imply direct reading, borrowing, or dependence.

## Allowed Language

Good patterns:

- "This kind of tradeoff is showing up more and more in platform tooling."
- "It is the same direction other engineering teams are taking as they make these
  controls more explicit."
- "This is the kind of pattern that keeps resurfacing in engineering blogs across the
  industry."
- "Even though this change is local, it lines up with a broader shift toward ..."

Good explicit-parallel patterns:

- "It is the same kind of operational concern you see in engineering blogs like Uber's."
- "This sits in the same conversation that architecture newsletters like ByteByteGo keep
  returning to."

## Forbidden Language

Never generate phrases like:

- "According to this article ..."
- "As the article explains ..."
- "After reading ..."
- "Inspired by ..."
- "This proves ..."
- article-title citations

## Prompt Contract

`industry_context` should become a structured instruction block, not a raw sentence.

The block must tell the generator:

- this is parallel industry signal, not citation
- the author did not necessarily read the matched piece
- the connection must stay secondary to the post's own argument
- naming, if used, must be broad and optional
- the article title must never appear in the post

## Matching Contract

The cross-encoder should return a connection sentence that describes the shared technical
pattern or tradeoff in neutral language.

Example shape:

- "Both the code change and the article deal with turning hidden operational constraints
  into explicit controls."

Not:

- "This article explains why ..."

## Source Naming Heuristic

When possible, infer a broad source-family label from the matched article URL.

Examples:

- `uber.com` -> `engineering blogs like Uber's`
- `bytebytego.com` -> `architecture newsletters like ByteByteGo`
- `blog.cloudflare.com` -> `engineering blogs like Cloudflare's`

If no clean label is available, default to implicit industry language only.

## Non-Goals

- We are not turning posts into reading lists.
- We are not asking the model to cite or summarize the matched article.
- We are not letting industry context replace the primary finding.

## Implementation

1. Change matcher guidance so the returned `connection` sentence is phrased as a shared
   pattern/tradeoff, not as a citation.
2. Replace raw `Connection: ...` injection with a structured `industry_context` prompt
   block.
3. Add prompt rules that explicitly ban derivation language and article-title mentions.
4. Optionally expose a broad source-family label when one can be inferred from the article
   URL.
