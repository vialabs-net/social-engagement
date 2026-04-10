import { readFileSync, writeFileSync } from 'fs';
import { MOVES_REGISTRY } from '../src/voice/moves-registry.js';

interface ReferencePost {
  writer_name: string;
  url: string;
  title: string;
  text: string;
  word_count: number;
  fetched_at: string;
}

interface WriterProfile {
  writer: string;
  total_posts: number;
  move_frequencies: Record<string, number>;
  activated_moves: string[];
  top_5_moves: string[];
}

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function loadReferencePosts(path: string): ReferencePost[] {
  return JSON.parse(readFileSync(path, 'utf8')) as ReferencePost[];
}

function buildWriterProfiles(referencePosts: ReferencePost[]): WriterProfile[] {
  const writers = [...new Set(referencePosts.map((post) => post.writer_name))];

  return writers.map((writer) => {
    const posts = referencePosts.filter((post) => post.writer_name === writer);
    const moveFrequencies: Record<string, number> = {};

    for (const move of MOVES_REGISTRY) {
      if (!move.regex) continue;
      const matches = posts.filter((post) => move.regex!.test(post.text)).length;
      moveFrequencies[move.id] = matches / Math.max(posts.length, 1);
    }

    const activatedMoves = Object.entries(moveFrequencies)
      .filter(([, frequency]) => frequency > 0.05)
      .map(([id]) => id);

    const top5Moves = Object.entries(moveFrequencies)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([id]) => id);

    return {
      writer,
      total_posts: posts.length,
      move_frequencies: moveFrequencies,
      activated_moves: activatedMoves,
      top_5_moves: top5Moves,
    };
  });
}

function buildValidationReport(writerProfiles: WriterProfile[]): string {
  const signatureCounts = new Map<string, number>();
  const registryMoveIds = MOVES_REGISTRY.filter((move) => move.regex).map((move) => move.id);
  const activationCountByMove = new Map<string, number>();

  for (const moveId of registryMoveIds) activationCountByMove.set(moveId, 0);

  for (const profile of writerProfiles) {
    const signature = profile.top_5_moves.join('|');
    signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
    for (const moveId of profile.activated_moves) {
      activationCountByMove.set(moveId, (activationCountByMove.get(moveId) ?? 0) + 1);
    }
  }

  const duplicateTop5 = [...signatureCounts.values()].some((count) => count > 1);
  const deadMoves = [...activationCountByMove.entries()].filter(([, count]) => count === 0).map(([id]) => id);
  const universalMoves = [...activationCountByMove.entries()]
    .filter(([, count]) => count === writerProfiles.length)
    .map(([id]) => id);
  const avgActivatedMoves = writerProfiles.length === 0
    ? 0
    : writerProfiles.reduce((sum, profile) => sum + profile.activated_moves.length, 0) / writerProfiles.length;

  const lines = [
    '# Registry Validation Report',
    '',
    `Writers analyzed: ${writerProfiles.length}`,
    '',
    '## Criteria',
    `- Discrimination: ${duplicateTop5 ? 'FAIL' : 'PASS'}`,
    `- Coverage: ${deadMoves.length === 0 ? 'PASS' : `FAIL (${deadMoves.join(', ')})`}`,
    `- No universals: ${universalMoves.length === 0 ? 'PASS' : `FAIL (${universalMoves.join(', ')})`}`,
    `- Spread: ${avgActivatedMoves >= 10 && avgActivatedMoves <= 25 ? 'PASS' : `FAIL (${avgActivatedMoves.toFixed(2)})`}`,
    '',
    '## Writer Profiles',
    ...writerProfiles.flatMap((profile) => [
      `### ${profile.writer}`,
      `- Posts: ${profile.total_posts}`,
      `- Activated moves: ${profile.activated_moves.join(', ') || 'none'}`,
      `- Top 5: ${profile.top_5_moves.join(', ') || 'none'}`,
      '',
    ]),
  ];

  return lines.join('\n');
}

async function main(): Promise<void> {
  const inputPath = getArg('--input') ?? 'scripts/registry-validation/reference-posts.json';
  const outputPath = getArg('--output');
  const referencePosts = loadReferencePosts(inputPath);
  const writerProfiles = buildWriterProfiles(referencePosts);
  const report = buildValidationReport(writerProfiles);

  if (outputPath) {
    writeFileSync(outputPath, report, 'utf8');
    console.log(`Wrote validation report to ${outputPath}`);
    return;
  }

  console.log(report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
