import { describe, it, expect } from 'vitest';
import { DesignPatternsModule } from '../analysis/modules/design-patterns.js';
import { buildUserPrompt } from '../ai/prompt-builder.js';
import type { AnalysisContext, Finding } from '../analysis/types.js';
import type { EnrichedCommit } from '../github/commit-enricher.js';

// Regression fixture: korutx commit f9e98b1 on microboxlabs/ecm-coordinator.
// This commit adds a single field (service_client_rut) to an Alfresco content model.
// It previously triggered a false "Repository pattern" finding because:
//   - backfill-client-rut.js (a tools/ migration script) contained the word
//     "repository" in a comment and called extTripService.findAllExtServices,
//     producing 2 regex matches on prose — enough to pass minMatches=2.
// After fix: tools/ files are excluded; comment stripping removes prose matches;
// all-new-file guard requires a structural signal (class/interface) to fire.

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
      // Key prose that used to trigger false Repository match:
      // - "repository" in "content repository" comment
      // - "findAllExtServices" matching /findAll/
      patch:
        '@@ -0,0 +1,138 @@\n' +
        '+ // Backfill mintral:clientRut on existing serviceFolder nodes.\n' +
        '+ //\n' +
        '+ // For each node with mintral:serviceAspect that is missing (or has an empty)\n' +
        '+ // mintral:clientRut, this script queries the pg-rest "services" table via\n' +
        '+ // extTripService.findAllExtServices, reads the service_client_rut column from\n' +
        '+ // the matching record, and sets mintral:clientRut on the node.\n' +
        '+ //\n' +
        '+ // Usage:\n' +
        '+ //   Dry run (default, read-only transaction is fine):\n' +
        '+ //   alfresco-js-console run tools/js-console/migration/backfill-client-rut.js\n' +
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
        '+     print("NO_RECORD serviceCode=" + serviceCode + " node=" + nodeRef);\n' +
        '+     continue;\n' +
        '+   }\n' +
        '+ }\n' +
        '+\n' +
        '+ main();\n',
    },
  ],
};

describe('hallucination regression — korutx f9e98b1', () => {
  it('design_patterns does not fire Repository on a field-addition commit', async () => {
    const module = new DesignPatternsModule();
    const finding = await module.analyze(KORUTX_CTX);
    expect(finding).toBeNull();
  });

  it('buildUserPrompt includes visibility, magnitude, and file summary', () => {
    const commit: EnrichedCommit = {
      sha: 'f9e98b12fe4863adb1f764617558f38bfc1efc0d',
      message: 'feat: wire service_client_rut into serviceAspect content model',
      body: 'Adds PROP_CLIENT_RUT + VAR_CLIENT_RUT on MintralModel...',
      fullMessage: 'feat: wire service_client_rut into serviceAspect content model\n\nAdds PROP_CLIENT_RUT...',
      repo: 'microboxlabs/ecm-coordinator',
      authorLogin: 'korutx',
      totalAdditions: 157,
      totalDeletions: 0,
      diffs: KORUTX_CTX.diffs,
      languages: ['Java', 'XML', 'JavaScript'],
      committedAt: '2026-04-21T09:54:00Z',
      isPrivateRepo: true,
    };

    const findings: Finding[] = [];
    const prompt = buildUserPrompt(commit, findings);

    expect(prompt).toContain('Visibility: private');
    expect(prompt).toContain('+157 -0 across 4 files');
    expect(prompt).toContain('Files:');
    expect(prompt).toContain('ExtTripServiceParamsV2.java');
    expect(prompt).toContain('backfill-client-rut.js');
    // Privacy instruction must appear in task block — targeted abstraction, not blanket
    expect(prompt).toContain('Visibility is private');
    expect(prompt).toContain('namespace prefixes that look like company codes');
    expect(prompt).toContain('field or column names that encode customer-specific business semantics');
    // Generic engineering vocabulary explicitly allowed
    expect(prompt).toContain('public engineering vocabulary, not sensitive');
  });
});
