// Split a synthesis post into claims for structural/human labeling.
// Multi-step: paragraph boundary first, then sentence boundary inside each
// paragraph. Drops ≤3-word fragments (too short to carry a verifiable claim).

export function splitClaims(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const claims: string[] = [];
  for (const para of paragraphs) {
    const parts = para.split(/(?<=[.!?])\s+(?=[A-Z])/);
    claims.push(...parts.map((s) => s.trim()).filter(Boolean));
  }
  return claims.filter((c) => c.split(/\s+/).length > 3);
}
