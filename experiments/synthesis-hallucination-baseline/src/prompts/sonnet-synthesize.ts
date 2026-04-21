// Sonnet Capa 4 — synthesize a post from weak signals.

export interface SignalForPrompt {
  date: string;
  sha: string;
  message: string;
  repo: string;
  topic: string | null;
  strength: number | null;
  pattern_kind: string | null;
  description: string;
  evidence: string;
}

function renderSignals(signals: SignalForPrompt[]): string {
  return signals
    .map(
      (s) => `  <commit date="${s.date}" sha="${s.sha.slice(0, 7)}" message="${escapeAttr(s.message)}" repo="${s.repo}">
    <signal topic="${s.topic ?? 'null'}" strength="${s.strength ?? 'null'}" pattern_kind="${s.pattern_kind ?? 'null'}">
      <description>${escapeText(s.description)}</description>
      <evidence>
${s.evidence}
      </evidence>
    </signal>
  </commit>`,
    )
    .join('\n');
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeText(s: string): string {
  return s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildSonnetFocalUser(
  topic: string,
  signals: SignalForPrompt[],
  spanDays: number,
): string {
  return `<commit_series>
${renderSignals(signals)}
</commit_series>
<synthesis_task>
  Write a post about what this developer did in ${topic} across ${signals.length} commits
  spanning ${spanDays} days. Focus on depth and quality in this single area.
  Every factual claim in your post must be traceable to a commit above.
  If you cannot write a post anchored to the commits, return <no_post/>.
</synthesis_task>`;
}

export function buildSonnetArcUser(
  topics: string[],
  signals: SignalForPrompt[],
  spanDays: number,
  sharedFiles: string[],
): string {
  return `<commit_series>
${renderSignals(signals)}
</commit_series>
<coherence_evidence>
  <shared_files>${sharedFiles.join(', ')}</shared_files>
  <span_days>${spanDays}</span_days>
</coherence_evidence>
<synthesis_task>
  Write a post about the arc spanning [${topics.join(', ')}] across ${signals.length} commits
  in ${spanDays} days. Focus on how these threads connect.
  Every factual claim in your post must be traceable to a commit above.
  If you cannot write a post anchored to the commits, return <no_post/>.
</synthesis_task>`;
}

export function buildSonnetSingleUser(
  topic: string,
  signal: SignalForPrompt,
): string {
  return `<commit date="${signal.date}" sha="${signal.sha.slice(0, 7)}" repo="${signal.repo}">
  <message>${escapeText(signal.message)}</message>
  <topic>${topic}</topic>
  <description>${escapeText(signal.description)}</description>
  <evidence>
${signal.evidence}
  </evidence>
</commit>
<synthesis_task>
  Write a short post about this single commit focused on ${topic}.
  Every factual claim must be traceable to the diff above.
  If you cannot write a post anchored to the commit, return <no_post/>.
</synthesis_task>`;
}
