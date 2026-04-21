// Haiku Capa 2 — extract one weak signal per commit.

export const HAIKU_SIGNAL_EXTRACT_SYSTEM = `You extract structured weak signals from a code diff for downstream analysis.
Return JSON matching this schema. If the diff is trivial (whitespace, rename, auto-format),
return exactly {"trivial": true}.

{
  "topic": "<one of the 24 categories>",
  "strength": 1-10,
  "pattern_kind": "new_abstraction"|"contract_change"|"semantic_refactor"|"config_change"|"dependency_update"|"behavioral_change"|null,
  "affected_symbols": ["verbatim_from_diff", ...],
  "specific_change": "one-sentence, max 120 chars, cite concrete elements"
}

Rules:
- If pattern_kind does not cleanly fit, return null (do NOT force a category).
- affected_symbols must be verbatim from the diff. Do not invent.
- specific_change must cite concrete elements present in the diff.
- Return ONLY the JSON object, no prose.`;

export function buildHaikuSignalExtractUser(commitMessage: string, diff: string): string {
  return `<commit_message>${commitMessage}</commit_message>
<diff>
${diff}
</diff>`;
}
