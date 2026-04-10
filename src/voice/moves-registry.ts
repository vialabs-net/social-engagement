export type MoveCategory =
  | 'rhythm'
  | 'lexical'
  | 'opening'
  | 'structural'
  | 'emphasis'
  | 'closing'
  | 'rhetorical'
  | 'meta';

export interface MoveDefinition {
  id: string;
  regex?: RegExp;
  category: MoveCategory;
  description: string;
  example?: string;
  negative_example?: string;
}

export const MOVES_REGISTRY: MoveDefinition[] = [
  {
    id: 'very_single',
    regex: /\bvery\s+\w+[.!]/i,
    category: 'rhythm',
    description: "'Very X.' as standalone ironic intensifier",
    example: 'Very slow. Very necessary.',
    negative_example: "It was very interesting to see",
  },
  {
    id: 'very_paired',
    regex: /\bvery\s+\w+[.\s,]+very\s+\w+/i,
    category: 'rhythm',
    description: "'Very X. Very Y.' paired adjective rhythm for contrast",
    example: 'Very clean. Very new.',
  },
  {
    id: 'triple_cadence',
    regex: /(?:^|\.\s+)([A-Z][^.]{3,30}\.)\s+([A-Z][^.]{3,30}\.)\s+([A-Z][^.]{3,30}\.)/m,
    category: 'rhythm',
    description: 'Three short declarative sentences in a row (X. Y. Z.)',
    example: 'It compiled. It deployed. It broke.',
  },
  {
    id: 'em_dash_rhythm',
    regex: /—/,
    category: 'rhythm',
    description: 'Em-dash for parenthetical or dramatic pause',
    example: 'The fix was obvious — in retrospect.',
  },
  {
    id: 'semicolon_join',
    regex: /;\s+[a-z]/,
    category: 'rhythm',
    description: 'Semicolon joining two independent clauses',
    example: "The test passed; the deploy didn't.",
  },
  {
    id: 'parenthetical_aside',
    regex: /\([^)]{10,80}\)/,
    category: 'rhythm',
    description: 'Parenthetical aside or self-correction',
    example: 'I shipped the fix (or what I thought was the fix).',
  },
  {
    id: 'ellipsis_pause',
    regex: /\.\.\./,
    category: 'rhythm',
    description: 'Ellipsis for trailing thought or dramatic pause',
    example: 'I checked the logs and...',
  },
  {
    id: 'frankly_adverb',
    regex: /\bfrankly\b/i,
    category: 'lexical',
    description: "'Frankly' as self-aware conversational adverb",
    example: 'Frankly, I expected it to break.',
  },
  {
    id: 'exactly_emphasis',
    regex: /\bexactly\b/i,
    category: 'lexical',
    description: "'Exactly' to pin down a precise point",
    example: 'That is exactly the problem.',
  },
  {
    id: 'beautiful_intensifier',
    regex: /\bbeautiful\b/i,
    category: 'lexical',
    description: "'Beautiful' as intensifier for technical elegance",
    example: 'A beautiful abstraction.',
  },
  {
    id: 'incredible_reaction',
    regex: /\bincredible\b/i,
    category: 'lexical',
    description: "'Incredible' as genuine reaction word",
    example: 'The performance improvement was incredible.',
  },
  {
    id: 'literally_emphasis',
    regex: /\bliterally\b/i,
    category: 'lexical',
    description: "'Literally' for emphasis (often hyperbolic)",
    example: 'It literally took 3 days.',
  },
  {
    id: 'spoiler_tag',
    regex: /\bspoiler\b/i,
    category: 'lexical',
    description: "'Spoiler:' as casual foreshadowing device",
    example: "Spoiler: it didn't work.",
  },
  {
    id: 'self_deprecating_word',
    regex: /\b(wrong|mistake|broke|failed|embarrassing|humiliating|stupid)\b/i,
    category: 'lexical',
    description: 'Self-deprecating vocabulary (owning failure)',
    example: 'I was completely wrong about the architecture.',
  },
  {
    id: 'trump_cadence',
    regex: /\b(tremendous|believe me|many people|nobody|everybody knows)\b/i,
    category: 'lexical',
    description: 'Hyperbolic intensifiers in the Trump style (ironic or playful)',
    example: 'Tremendous improvement. Believe me.',
  },
  {
    id: 'sound_like_me',
    regex: /\bsound(s)?\s+like\s+me\b/i,
    category: 'lexical',
    description: "'Sound(s) like me' as meta-voice reference",
    example: "That doesn't sound like me at all.",
  },
  {
    id: 'opens_with_number',
    regex: /^[\d,]+\s+(lines?|files?|commits?|decisions?|hours?|days?|minutes?)/im,
    category: 'opening',
    description: 'Opens with a numeric count (lines added, hours spent)',
    example: '313 lines added. Zero removed.',
    negative_example: 'I spent 3 hours debugging',
  },
  {
    id: 'opens_first_person_action',
    regex: /^I\s+(shipped|deleted|added|wrote|built|pushed|created|fixed|removed|broke|deployed|refactored)/im,
    category: 'opening',
    description: "Opens with 'I [action verb]' — first-person, concrete",
    example: 'I shipped a landing page for Devcast today.',
  },
  {
    id: 'opens_third_person_subject',
    regex: /^(The|A|An|Claude|My|This|That|Every|One|Two|Three)\s+\w+/im,
    category: 'opening',
    description: 'Opens naming a third-person subject or abstract noun',
    example: 'The bug was in the routing logic.',
  },
  {
    id: 'opens_with_question',
    regex: /^(What|Why|How|When|Where|Who|Did|Is|Are|Do|Can|Should|Have)\s+/im,
    category: 'opening',
    description: 'Opens with a question',
    example: 'What happens when your type guard fails silently?',
  },
  {
    id: 'opens_mid_action',
    regex: /^(So|Then|And|But|Yesterday|Today|Last\s+\w+|This\s+(morning|afternoon|week))/im,
    category: 'opening',
    description: 'Opens mid-action or with temporal anchor',
    example: 'Yesterday I deleted 400 lines of code.',
  },
  {
    id: 'opens_bold_thesis',
    regex: /^[A-Z][^.?!]{10,60}[.!]$/m,
    category: 'opening',
    description: 'Opens with a bold declarative thesis statement',
    example: 'Most developers build things the world never sees.',
    negative_example: 'Hi everyone, today I want to talk about...',
  },
  {
    id: 'opens_confession',
    regex: /^(I\s+(admit|confess|was wrong|didn't know|had no idea)|Confession|Honest(ly)?)/im,
    category: 'opening',
    description: 'Opens with a confession or admission',
    example: 'I had no idea what I was doing when I started.',
  },
  {
    id: 'im_building_context',
    regex: /I'm building\b/i,
    category: 'structural',
    description: "'I'm building [project]' context sentence near the top",
    example: "I'm building Devcast, an open-source tool that turns GitHub commits into social media posts.",
  },
  {
    id: 'arrow_bullets',
    regex: /→/,
    category: 'structural',
    description: 'Arrow bullet lists (→) for enumerations',
    example: '→ fetch → dedup → classify → embed',
  },
  {
    id: 'colon_reveal',
    regex: /:\s+[a-z]/,
    category: 'structural',
    description: 'Colon followed by a reveal or explanation',
    example: 'The real problem: nobody tested it.',
  },
  {
    id: 'numbered_inline_list',
    regex: /\b[1-3]\)\s+\w+/,
    category: 'structural',
    description: 'Numbered inline list (1) thing 2) thing 3) thing)',
    example: 'Three things: 1) the deploy 2) the rollback 3) the postmortem.',
  },
  {
    id: 'contrast_before_after',
    regex: /\b(before|without)\b.{5,60}\b(after|with|now)\b/i,
    category: 'structural',
    description: 'Before/after or without/with contrast pair',
    example: 'Before the refactor: 800ms. After: 120ms.',
  },
  {
    id: 'zero_quantity',
    regex: /\bzero\s+(removed|deleted|errors?|bugs?|downtime|issues?|complaints?)/i,
    category: 'structural',
    description: "'Zero [noun]' for emphasis on absence",
    example: 'Zero removed. Zero errors. Zero complaints.',
  },
  {
    id: 'the_fix_was',
    regex: /\bthe\s+(fix|solution|answer|trick|key)\s+(was|is|turned out)\b/i,
    category: 'structural',
    description: "'The fix/solution/key was…' resolution framing",
    example: 'The fix was a single line change.',
  },
  {
    id: 'all_caps_word',
    regex: /\b[A-Z]{4,}\b/,
    category: 'emphasis',
    description: 'ALL CAPS for emphasis on a single word',
    example: 'That is NOT the same thing.',
    negative_example: 'API, HTTP, DNS',
  },
  {
    id: 'italic_emphasis',
    regex: /\*[^*]+\*/,
    category: 'emphasis',
    description: 'Italic (*word*) for emphasis or foreign terms',
    example: 'It *almost* worked.',
  },
  {
    id: 'repetition_for_emphasis',
    regex: /(\b\w{3,}\b).{0,10}\1/i,
    category: 'emphasis',
    description: 'Deliberate word repetition for rhetorical effect',
    example: "Simple is simple. That's the whole point.",
  },
  {
    id: 'short_sentence_impact',
    regex: /(?:^|\.\s+)([A-Z]\w{0,8}\.)\s/m,
    category: 'emphasis',
    description: 'One-word or very short sentence for impact',
    example: 'Done.',
  },
  {
    id: 'closes_with_lesson',
    regex: /(lesson|learned|takeaway|moral|principle).{0,60}$/im,
    category: 'closing',
    description: 'Closes with an explicit lesson or takeaway',
    example: 'The lesson: always read the logs first.',
  },
  {
    id: 'closes_with_future',
    regex: /(tomorrow|next\s+(week|time|step)|soon|eventually|we'll see).{0,40}$/im,
    category: 'closing',
    description: 'Closes pointing to the future or next steps',
    example: 'Landing page tomorrow. Certainty today.',
  },
  {
    id: 'closes_with_reversal',
    regex: /(but|except|plot twist|turns out|ironically).{0,60}$/im,
    category: 'closing',
    description: 'Closes with an ironic reversal or twist',
    example: 'Turns out, the real bug was in my test.',
  },
  {
    id: 'rhetorical_question',
    regex: /\?\s*\n/,
    category: 'rhetorical',
    description: 'Rhetorical question as transition or emphasis',
    example: 'Why does this matter?\n\nBecause…',
  },
  {
    id: 'analogy_comparison',
    regex: /\b(like|as if|imagine|think of it as|picture|same way)\b/i,
    category: 'rhetorical',
    description: 'Analogy or comparison to explain a concept',
    example: 'Think of it as a circuit breaker for your API.',
  },
  {
    id: 'direct_address',
    regex: /\b(you (know|should|can|will|might|probably)|your)\b/i,
    category: 'rhetorical',
    description: 'Direct second-person address to the reader',
    example: 'You know that feeling when the deploy goes green?',
  },
  {
    id: 'epistemic_hedge',
    regex: /\b(I think|I believe|probably|maybe|not sure|might be)\b/i,
    category: 'meta',
    description: 'Epistemic hedging — expressing uncertainty',
    example: "I think this is the right approach, but I'm not sure.",
  },
  {
    id: 'meta_writing_reference',
    regex: /\b(this post|I('m| am) writing|I wanted to (share|talk|write))\b/i,
    category: 'meta',
    description: 'Meta-reference to the act of writing or sharing',
    example: 'I wanted to share what I learned this week.',
  },
  {
    id: 'hashtag_always',
    category: 'meta',
    description: 'Hashtags that appear in nearly every post (auto-detected per author)',
  },
];

export const OPENING_MOVE_IDS = [
  'opens_with_number',
  'opens_first_person_action',
  'opens_third_person_subject',
  'opens_with_question',
  'opens_mid_action',
  'opens_bold_thesis',
  'opens_confession',
] as const;

export type OpeningMoveType = typeof OPENING_MOVE_IDS[number] | 'unknown';
