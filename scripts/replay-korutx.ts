/**
 * replay-korutx.ts — end-to-end replay of korutx commit f9e98b1
 * using the real diff data (from PDF/test fixture) since the repo is private.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/replay-korutx.ts
 */

import { runPipeline } from '../src/analysis/pipeline.js';
import { buildSystemPrompt, buildUserPrompt } from '../src/ai/prompt-builder.js';
import { AnthropicAdapter } from '../src/ai/anthropic-adapter.js';
import { SupabaseStorage } from '../src/voice/supabase-storage.js';
import { DEFAULT_VOICE_PROFILE } from '../src/config/schema.js';
import type { AnalysisContext } from '../src/analysis/types.js';
import type { EnrichedCommit } from '../src/github/commit-enricher.js';

const SEP = '─'.repeat(72);

// Real diff data from korutx commit f9e98b1 (microboxlabs/ecm-coordinator).
// Sourced from the GitHub commit page PDF — same data as hallucination-regression.test.ts.
const KORUTX_CTX: AnalysisContext = {
  repo: 'microboxlabs/ecm-coordinator',
  sha: 'f9e98b12fe4863adb1f764617558f38bfc1efc0d',
  commitMessage: 'feat: wire service_client_rut into serviceAspect content model',
  commitBody:
    'Adds PROP_CLIENT_RUT + VAR_CLIENT_RUT on MintralModel, registers the\n' +
    'service_client_rut -> mintral:clientRut mapping in jsonKeyMapperV2, declares\n' +
    'the mintral:clientRut property on mintral:serviceAspect, and ships a\n' +
    'js-console backfill script for existing serviceFolder nodes.',
  languages: ['Java', 'XML', 'JavaScript'],
  diffs: [
    {
      filename: 'src/main/java/cl/mintral/model/ExtTripServiceParamsV2.java',
      status: 'modified',
      additions: 1,
      deletions: 0,
      language: 'Java',
      patch:
        '@@ -24,6 +24,7 @@ public class ExtTripServiceParamsV2 {\n' +
        '     // Client Parameters\n' +
        '     public static final String PARAM_SERVICE_CLIENT_CODE = "service_client_code";\n' +
        '     public static final String PARAM_SERVICE_CLIENT_ABBREVIATION = "service_client_abbreviation";\n' +
        '+    public static final String PARAM_SERVICE_CLIENT_RUT = "service_client_rut";\n' +
        '\n' +
        '     // DateTime Parameters\n',
    },
    {
      filename: 'src/main/java/cl/mintral/model/MintralModel.java',
      status: 'modified',
      additions: 8,
      deletions: 0,
      language: 'Java',
      patch:
        '@@ -38,6 +38,8 @@ public class MintralModel {\n' +
        '     public static final String VAR_CUSTOMER_CODE = Utils.toExecutionVarName(PREFIX, PROP_CUSTOMER_CODE);\n' +
        '     public static final QName PROP_CLIENT_ABBREVIATION = QName.createQName(NAMESPACE, "clientAbbreviation");\n' +
        '     public static final String VAR_CLIENT_ABBREVIATION = Utils.toExecutionVarName(PREFIX, PROP_CLIENT_ABBREVIATION);\n' +
        '+    public static final QName PROP_CLIENT_RUT = QName.createQName(NAMESPACE, "clientRut");\n' +
        '+    public static final String VAR_CLIENT_RUT = Utils.toExecutionVarName(PREFIX, PROP_CLIENT_RUT);\n' +
        '     public static final QName PROP_CREATION_DATE = QName.createQName(NAMESPACE, "creationDate");\n' +
        '@@ -252,6 +254,7 @@ public class MintralModel {\n' +
        '     Map.entry(ExtTripServiceParamsV2.PARAM_SERVICE_PRINCIPAL_KEY, PROP_KEY),\n' +
        '     Map.entry(ExtTripServiceParamsV2.PARAM_SERVICE_CLIENT_CODE, PROP_CUSTOMER_CODE),\n' +
        '     Map.entry(ExtTripServiceParamsV2.PARAM_SERVICE_CLIENT_ABBREVIATION, PROP_CLIENT_ABBREVIATION),\n' +
        '+    Map.entry(ExtTripServiceParamsV2.PARAM_SERVICE_CLIENT_RUT, PROP_CLIENT_RUT),\n' +
        '     Map.entry(ExtTripServiceParamsV2.PARAM_SERVICE_DATETIME_CREATED, PROP_CREATION_DATE),\n',
    },
    {
      filename: 'src/main/resources/alfresco/module/coordinador/model/mintral-content-model.xml',
      status: 'modified',
      additions: 10,
      deletions: 0,
      language: 'XML',
      patch:
        '@@ -152,6 +152,16 @@\n' +
        '             <tokenised>false</tokenised>\n' +
        '           </index>\n' +
        '         </property>\n' +
        '+        <!-- rut_cliente -->\n' +
        '+        <property name="mintral:clientRut">\n' +
        '+          <title>RUT del Cliente</title>\n' +
        '+          <type>d:text</type>\n' +
        '+          <index enabled="true">\n' +
        '+            <atomic>true</atomic>\n' +
        '+            <stored>false</stored>\n' +
        '+            <tokenised>false</tokenised>\n' +
        '+          </index>\n' +
        '+        </property>\n' +
        '         <!-- fecha_creacion -->\n',
    },
    {
      filename: 'tools/js-console/migration/backfill-client-rut.js',
      status: 'added',
      additions: 138,
      deletions: 0,
      language: 'JavaScript',
      patch:
        '@@ -0,0 +1,138 @@\n' +
        '+ // Backfill mintral:clientRut on existing serviceFolder nodes.\n' +
        '+ //\n' +
        '+ // For each node with mintral:serviceAspect that is missing (or has an empty)\n' +
        '+ // mintral:clientRut, this script queries the pg-rest "services" table via\n' +
        '+ // extTripService.findAllExtServices, reads the service_client_rut column from\n' +
        '+ // the matching record, and sets mintral:clientRut on the node.\n' +
        '+ //\n' +
        '+ // Knobs:\n' +
        '+ //   DRY_RUN   — when true, only logs what would be updated.\n' +
        '+ //   MAX_SCAN  — cap total folders scanned (0 = no cap).\n' +
        '+ //   BATCH_LIMIT — stop after this many successful updates (0 = no cap).\n' +
        '+\n' +
        '+ var DRY_RUN = true;\n' +
        '+ var MAX_SCAN = 0;\n' +
        '+ var BATCH_LIMIT = 0;\n' +
        '+\n' +
        '+ function main() {\n' +
        '+   var ctx = Packages.org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext();\n' +
        '+   var MintralModel = Packages.cl.mintral.model.MintralModel;\n' +
        '+   var extTripService = ctx.getBean("extTripService", TripService);\n' +
        '+   var nodeService = ctx.getBean("NodeService", NodeService);\n' +
        '+   var searchService = ctx.getBean("SearchService", SearchService);\n' +
        '+   var query = \'+PATH:"\' + MintralConstants.DOCLIB_PATH + \'/cm:servicios//*" +ASPECT:"\'\n' +
        '+     + MintralModel.ASPECT_SERVICE_ASPECT + \'"\';\n' +
        '+   var rs = searchService.query(sp);\n' +
        '+   var results = extTripService.findAllExtServices(params);\n' +
        '+   if (results == null || results.size() == 0) {\n' +
        '+     lookupFailed++;\n' +
        '+     continue;\n' +
        '+   }\n' +
        '+ }\n' +
        '+\n' +
        '+ main();\n',
    },
  ],
};

const KORUTX_COMMIT: EnrichedCommit = {
  sha: 'f9e98b12fe4863adb1f764617558f38bfc1efc0d',
  message: 'feat: wire service_client_rut into serviceAspect content model',
  body:
    'Adds PROP_CLIENT_RUT + VAR_CLIENT_RUT on MintralModel, registers the\n' +
    'service_client_rut -> mintral:clientRut mapping in jsonKeyMapperV2, declares\n' +
    'the mintral:clientRut property on mintral:serviceAspect, and ships a\n' +
    'js-console backfill script for existing serviceFolder nodes.',
  fullMessage:
    'feat: wire service_client_rut into serviceAspect content model\n\n' +
    'Adds PROP_CLIENT_RUT + VAR_CLIENT_RUT on MintralModel...',
  repo: 'microboxlabs/ecm-coordinator',
  authorLogin: 'korutx',
  totalAdditions: 157,
  totalDeletions: 0,
  diffs: KORUTX_CTX.diffs,
  languages: ['Java', 'XML', 'JavaScript'],
  committedAt: '2026-04-21T09:54:00Z',
  isPrivateRepo: true,
};

async function main(): Promise<void> {
  const anthropicKey = process.env['ANTHROPIC_API_KEY'] ?? '';
  const supabaseUrl = process.env['SUPABASE_URL'] ?? '';
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  const tenantId = process.env['TENANT_ID'] ?? 'default';

  if (!anthropicKey) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }

  // ── Stage 1: Commit data (fixture) ───────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('STAGE 1 — commit data (fixture from real diff PDF)');
  console.log(SEP);
  console.log(`repo:          ${KORUTX_COMMIT.repo}`);
  console.log(`sha:           ${KORUTX_COMMIT.sha}`);
  console.log(`message:       ${KORUTX_COMMIT.message}`);
  console.log(`isPrivateRepo: ${KORUTX_COMMIT.isPrivateRepo}`);
  console.log(`total:         +${KORUTX_COMMIT.totalAdditions} -${KORUTX_COMMIT.totalDeletions}`);
  console.log(`files (${KORUTX_COMMIT.diffs.length}):`);
  for (const d of KORUTX_COMMIT.diffs) {
    console.log(`  ${d.filename} [${d.status}] +${d.additions}/-${d.deletions} lang=${d.language ?? 'unknown'}`);
  }

  // ── Stage 3: Run all 24 modules ──────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('STAGE 3 — runPipeline (24 modules)');
  console.log(SEP);

  const { findings } = await runPipeline(KORUTX_CTX);

  if (findings.length === 0) {
    console.log('\n✗ No findings passed the interest threshold.');
    console.log('  → Pipeline SKIPS this commit. No Claude call. No post generated.');
    console.log('\nVerdict: NO POST — commit does not meet interest threshold.\n');
    process.exit(0);
  }

  console.log(`\n${findings.length} finding(s) ranked:\n`);
  for (const f of findings) {
    console.log(`  [${'★'.repeat(f.interestScore)}${' '.repeat(10 - f.interestScore)}] score=${f.interestScore} module=${f.moduleId}`);
    console.log(`    aspect:  ${f.aspect}`);
    console.log(`    finding: ${f.finding}`);
    if (f.evidence?.after) console.log(`    evidence: ${f.evidence.after.slice(0, 120)}`);
    console.log('');
  }

  // ── Stage 4: Voice profile ───────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('STAGE 4 — voice profile for korutx');
  console.log(SEP);

  let voiceProfile = DEFAULT_VOICE_PROFILE;
  if (supabaseUrl && supabaseKey) {
    try {
      const storage = new SupabaseStorage(supabaseUrl, supabaseKey, tenantId);
      const stored = await storage.getVoiceProfile('korutx');
      if (stored) {
        voiceProfile = stored.voice;
        console.log(`Found voice profile: tone=${voiceProfile.tone}, source=${stored.source}`);
      } else {
        console.log('No voice profile for korutx — using DEFAULT_VOICE_PROFILE');
      }
    } catch (e) {
      console.warn(`Voice fetch failed (${String(e)}) — using DEFAULT_VOICE_PROFILE`);
    }
  }
  console.log(`tone=${voiceProfile.tone}  rhythm=${voiceProfile.rhythm ?? 'default'}  max=${voiceProfile.post_length.max}chars`);

  // ── Stage 5: Build prompt ────────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('STAGE 5 — buildUserPrompt');
  console.log(SEP);

  const minConfig = {
    author: { name: 'korutx', github_login: 'korutx' },
    platforms: { linkedin: { enabled: true }, instagram: { enabled: false } },
    pipeline: { max_daily_posts_per_author: 2 },
    voice: voiceProfile,
  } as never;

  const systemPrompt = buildSystemPrompt(
    minConfig,
    voiceProfile,
    { stage: 'cold', exposurePool: [], bootstrapPosts: [], commitSha: KORUTX_COMMIT.sha, draftIndexToday: 0 },
  );

  const userPrompt = buildUserPrompt(KORUTX_COMMIT, findings);

  console.log('\n[userPrompt — full]\n');
  console.log(userPrompt);

  // ── Stage 6: Claude ──────────────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('STAGE 6 — Claude generation');
  console.log(SEP);

  const ai = new AnthropicAdapter(anthropicKey);
  const rawResponse = await ai.complete(systemPrompt, userPrompt);

  // ── Stage 7: Final post ──────────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('STAGE 7 — final post');
  console.log(SEP);

  const postMatch = rawResponse.match(/<post_draft>([\s\S]*?)<\/post_draft>/);
  const shortMatch = rawResponse.match(/<short_draft>([\s\S]*?)<\/short_draft>/);

  if (!postMatch || !shortMatch) {
    console.error('Claude response missing XML tags. Raw:');
    console.error(rawResponse);
    process.exit(1);
  }

  const mainPost = (postMatch[1] ?? '').trim();
  const shortPost = (shortMatch[1] ?? '').trim();

  console.log('\n── MAIN POST ──────────────────────────────────────────────────────────\n');
  console.log(mainPost);
  console.log('\n── SHORT VARIANT ──────────────────────────────────────────────────────\n');
  console.log(shortPost);
  console.log('\n── STATS ──────────────────────────────────────────────────────────────');
  console.log(`main: ${mainPost.length} chars (max ${voiceProfile.post_length.max})`);
  console.log(`top module: ${findings[0]?.moduleId} (score ${findings[0]?.interestScore})`);
  console.log(`private repo instruction active: ${KORUTX_COMMIT.isPrivateRepo}`);
  console.log('');
}

main().catch((err) => {
  console.error('Fatal:', String(err));
  process.exit(1);
});
