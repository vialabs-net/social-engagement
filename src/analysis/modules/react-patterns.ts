import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';
import { extractRemovedLines, extractFirstHunkSnippet } from '../diff-parser.js';

interface ReactPattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  detect(addedLines: readonly string[]): boolean;
}

const REACT_FILE_REGEX = /\.(tsx|jsx)$/;

const PATTERNS: readonly ReactPattern[] = [
  {
    name: 'custom hook',
    score: 8,
    technicalDetail: 'Custom React hook — encapsulates reusable stateful logic in a function prefixed with "use", separating behavior from UI.',
    explanation: 'A custom hook extracts stateful logic that multiple components share. Instead of duplicating useState + useEffect in every component, one hook encapsulates the pattern and each component calls it.',
    detect: (lines) => lines.some((l) =>
      /\bexport\s+(default\s+)?function\s+use[A-Z]\w*\s*\(/.test(l) ||
      /\bconst\s+use[A-Z]\w*\s*=\s*\(/.test(l),
    ),
  },
  {
    name: 'React context provider',
    score: 8,
    technicalDetail: 'React Context — provides dependency injection for component trees without prop drilling through intermediate components.',
    explanation: 'Context replaces the "pass props through 5 levels" problem. A provider at the top, a useContext call at the bottom, and every layer in between stays clean.',
    detect: (lines) => lines.some((l) =>
      /\bcreateContext\s*[<(]/.test(l) ||
      /\bContext\.Provider\b/.test(l) ||
      /\buseContext\s*\(/.test(l),
    ),
  },
  {
    name: 'React.memo optimization',
    score: 7,
    technicalDetail: 'React.memo — prevents unnecessary re-renders by memoizing the component output when props have not changed.',
    explanation: 'React.memo skips re-rendering a component if its props are the same. For expensive renders or frequently updating parents, this prevents wasted work.',
    detect: (lines) => lines.some((l) =>
      /\bReact\.memo\s*\(/.test(l) ||
      /\bmemo\s*\(\s*function/.test(l) ||
      /\bmemo\s*\(\s*\(/.test(l),
    ),
  },
  {
    name: 'Suspense boundary',
    score: 8,
    technicalDetail: 'React Suspense — declarative loading states that replace imperative isLoading flags with component-level boundaries.',
    explanation: 'Suspense replaces the "if loading return spinner" pattern. The boundary catches the loading state declaratively — the component inside just renders as if data is ready.',
    detect: (lines) => lines.some((l) =>
      /\b<Suspense\b/.test(l) ||
      /\bSuspense\s/.test(l),
    ),
  },
  {
    name: 'useReducer state machine',
    score: 8,
    technicalDetail: 'useReducer — manages complex component state with explicit actions and transitions, making state changes predictable and debuggable.',
    explanation: 'useReducer makes state transitions explicit. Instead of scattered setState calls, every state change goes through a reducer with named actions — easier to debug, test, and reason about.',
    detect: (lines) => lines.some((l) =>
      /\buseReducer\s*\(/.test(l),
    ),
  },
  {
    name: 'error boundary',
    score: 9,
    technicalDetail: 'React Error Boundary — catches JavaScript errors in the component tree and renders a fallback UI instead of crashing the entire application.',
    explanation: 'An error boundary prevents one broken component from taking down the whole page. The error is caught, a fallback UI renders, and the rest of the app keeps working.',
    detect: (lines) => lines.some((l) =>
      /\bcomponentDidCatch\s*\(/.test(l) ||
      /\bstatic\s+getDerivedStateFromError\b/.test(l) ||
      /\bErrorBoundary\b/.test(l),
    ),
  },
  {
    name: 'server component',
    score: 9,
    technicalDetail: 'React Server Component — renders on the server with zero client-side JavaScript, reducing bundle size and enabling direct data access.',
    explanation: 'Server components run only on the server. No JavaScript ships to the browser, data fetching happens without API calls, and the client bundle stays small. The "use client" directive marks the boundary.',
    detect: (lines) => lines.some((l) =>
      /^['"]use client['"]/.test(l.trim()) ||
      /^['"]use server['"]/.test(l.trim()),
    ),
  },
];

export class ReactPatternsModule implements CodeAnalyzer {
  readonly id = 'react_patterns';
  readonly name = 'React Patterns';
  readonly category = 'react_patterns' as const;

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    const reactDiffs = ctx.diffs.filter((d) => REACT_FILE_REGEX.test(d.filename));
    if (reactDiffs.length === 0) return null;

    for (const diff of reactDiffs) {
      if (!diff.patch || diff.status === 'removed') continue;

      const addedLines = diff.patch
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1));

      if (addedLines.length === 0) continue;

      const removedText = extractRemovedLines(diff.patch);
      const removedLines = removedText.split('\n').filter(Boolean);

      for (const pattern of PATTERNS) {
        if (pattern.detect(addedLines) && !pattern.detect(removedLines)) {
          return {
            moduleId: this.id,
            aspect: pattern.name,
            finding: `${pattern.name} in ${diff.filename}`,
            technicalDetail: pattern.technicalDetail,
            plainLanguage: pattern.explanation,
            interestScore: pattern.score,
            contextHint: `${diff.filename} in ${ctx.repo}`,
            evidence: {
              before: removedText.slice(0, 300) || undefined,
              after: extractFirstHunkSnippet(diff.patch) || undefined,
            },
          };
        }
      }
    }

    return null;
  }
}
