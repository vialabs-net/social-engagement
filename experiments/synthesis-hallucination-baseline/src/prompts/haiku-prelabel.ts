// Haiku — structural pre-label of each claim in a generated post.

export const HAIKU_PRELABEL_SYSTEM = `You verify whether a claim about code is structurally supported by the diff.

Return ONE of:
- grounded: every named symbol, file path, and number in the claim appears in the diff or commit message.
- symbol_not_in_diff: the claim names a function/class/variable NOT in the diff.
- number_not_in_diff: specific number (timeout, line count, etc.) not present.
- file_not_in_diff: file path named not in the diff.
- frame: stylistic/narrative, no verifiable factual content.
- needs_human: structural elements check out, but semantic claim ("intent", "to prepare for", "because X")
               cannot be verified from diff alone.

Do NOT interpret whether the claim is true — only whether its structural elements exist.
Return JSON: {"check": "...", "evidence": "short explanation"}`;

export function buildHaikuPrelabelUser(claim: string, diffs: string, commitMessages: string): string {
  return `<claim>${claim}</claim>
<diffs>
${diffs}
</diffs>
<commit_messages>
${commitMessages}
</commit_messages>`;
}
