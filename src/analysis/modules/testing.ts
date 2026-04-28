import type { CodeAnalyzer, AnalysisContext, Finding, ModuleResult } from '../types.js';
import { extractRemovedLines, extractFirstHunkSnippet } from '../diff-parser.js';

const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx|py)$|__tests__\//;
const PARAMETRIZED_PATTERN = /\bit\.each\b|\btest\.each\b|\bpytest\.mark\.parametrize\b|@parametrize/;
const EDGE_CASE_KEYWORDS = /\b(edge case|boundary|overflow|underflow|null|undefined|empty|zero|negative|timeout|concurrent|race condition|idempotent|rounding|precision|float|NaN)\b/i;
const MOCK_PATTERN = /\b(jest\.mock|vi\.mock|sinon|MagicMock|unittest\.mock|td\.replace)\b/;

export class TestingModule implements CodeAnalyzer {
  readonly id = 'testing';
  readonly name = 'Testing Analyzer';
  readonly category = 'testing' as const;

  async analyze(ctx: AnalysisContext): Promise<ModuleResult> {
    const testDiffs = ctx.diffs.filter(d => TEST_FILE_PATTERN.test(d.filename));
    if (testDiffs.length === 0) return null;

    const totalNewTestLines = testDiffs.reduce((sum, d) => sum + d.additions, 0);
    if (totalNewTestLines < 5) return null;

    const addedText = testDiffs.flatMap(d =>
      d.patch.split('\n')
        .filter(l => l.startsWith('+') && !l.startsWith('+++'))
        .map(l => l.slice(1))
    ).join('\n');

    const removedText = testDiffs.map(d => extractRemovedLines(d.patch)).join('\n');

    const hasParametrized = PARAMETRIZED_PATTERN.test(addedText) && !PARAMETRIZED_PATTERN.test(removedText);
    const hasEdgeCases = EDGE_CASE_KEYWORDS.test(addedText) && !EDGE_CASE_KEYWORDS.test(removedText);
    const hasMocks = MOCK_PATTERN.test(addedText);
    const hasBilateral =
      (PARAMETRIZED_PATTERN.test(addedText) && PARAMETRIZED_PATTERN.test(removedText)) ||
      (EDGE_CASE_KEYWORDS.test(addedText) && EDGE_CASE_KEYWORDS.test(removedText));

    // Count test cases (rough heuristic)
    const testCount = (addedText.match(/\bit\(|\btest\(|\bdef test_/g) ?? []).length;

    if (hasParametrized) {
      const edgePart = hasEdgeCases ? ', covering boundary and edge case scenarios' : '';
      return {
        moduleId: this.id,
        aspect: 'parametrized test coverage',
        finding: `Added parametrized tests across ${testDiffs.length} test file(s) — multiple input scenarios validated systematically${edgePart}`,
        technicalDetail: `Parametrized testing (test.each/pytest.parametrize), data-driven test cases, boundary value analysis. ~${testCount} test cases added.`,
        plainLanguage: 'Parametrized tests express "for all these inputs, I expect these outputs" in one readable block. They make it explicit which specific values were chosen for testing and why — especially useful for numeric boundaries, currency rounding, and state transitions.',
        interestScore: 8,
        contextHint: `${testDiffs[0]?.filename ?? 'unknown'} in ${ctx.repo}`,
        evidence: {
          before: removedText.slice(0, 300) || undefined,
          after: extractFirstHunkSnippet(testDiffs[0]?.patch ?? '') || undefined,
        },
      };
    }

    if (hasEdgeCases) {
      const edgeKeywords = addedText.match(EDGE_CASE_KEYWORDS) ?? [];
      const uniqueKeywords = [...new Set(edgeKeywords.map(k => k.toLowerCase()))].slice(0, 3);
      return {
        moduleId: this.id,
        aspect: 'edge case coverage',
        finding: `Added tests covering edge cases: ${uniqueKeywords.join(', ')} scenarios in ${testDiffs.length} file(s)`,
        technicalDetail: `Edge case testing, boundary value analysis. Keywords detected: ${uniqueKeywords.join(', ')}. ~${testCount} test cases.`,
        plainLanguage: `The tests specifically target the scenarios that most implementations get wrong: ${uniqueKeywords.join(', ')}. Edge cases don't throw exceptions — they produce plausible-looking wrong answers until someone checks the math.`,
        interestScore: 7,
        contextHint: `${testDiffs[0]?.filename ?? 'unknown'} in ${ctx.repo}`,
        evidence: {
          before: removedText.slice(0, 300) || undefined,
          after: extractFirstHunkSnippet(testDiffs[0]?.patch ?? '') || undefined,
        },
      };
    }

    if (testCount >= 5 || testDiffs.length >= 2) {
      return {
        moduleId: this.id,
        aspect: 'test coverage expansion',
        finding: `Added ~${testCount} new test case(s) across ${testDiffs.length} file(s)${hasMocks ? ' with mock isolation' : ''}`,
        technicalDetail: `Unit testing${hasMocks ? ', mock/stub isolation' : ''}. ${testCount} test cases, ${testDiffs.reduce((s, d) => s + d.additions, 0)} lines added.`,
        plainLanguage: `The commit expanded the test suite with ${testCount} new cases${hasMocks ? ', using mocks to isolate the unit under test from its dependencies' : ''}. More tests mean faster feedback when something breaks.`,
        interestScore: 4,
        contextHint: `${testDiffs[0]?.filename ?? 'unknown'} in ${ctx.repo}`,
        evidence: {
          before: removedText.slice(0, 300) || undefined,
          after: extractFirstHunkSnippet(testDiffs[0]?.patch ?? '') || undefined,
        },
      };
    }

    return hasBilateral ? { kind: 'delta_hit' as const, topic: this.id, strength: 2 as const } : null;
  }
}
