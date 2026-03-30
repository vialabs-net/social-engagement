import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';

interface ElixirPattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  detect(addedLines: readonly string[]): boolean;
}

const PATTERNS: readonly ElixirPattern[] = [
  {
    name: 'pipe operator',
    score: 7,
    technicalDetail: 'Elixir pipe operator (|>) — chains function calls left-to-right, passing the result of each expression as the first argument to the next.',
    explanation: 'The pipe operator eliminates nested function calls. Data flows left to right through a pipeline of transformations — each step is clear and composable.',
    detect: (lines) => lines.filter((l) => /\|>/.test(l)).length >= 2,
  },
  {
    name: 'GenServer',
    score: 9,
    technicalDetail: 'GenServer (OTP behaviour) — a generic server process with client/server separation, built-in message queuing, and supervision integration.',
    explanation: 'GenServer handles messages one at a time with a queue built in. It integrates with the supervisor tree automatically — crash it, the supervisor restarts it in a clean state.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\buse\s+GenServer\b/.test(l) ||
          /\bdef\s+handle_call\b/.test(l) ||
          /\bdef\s+handle_cast\b/.test(l) ||
          /\bGenServer\.start_link\b/.test(l),
      ),
  },
  {
    name: 'Supervisor tree',
    score: 9,
    technicalDetail: 'OTP Supervisor — manages child processes with restart strategies (one_for_one, one_for_all, rest_for_one) and supervision trees for fault isolation.',
    explanation: 'A supervisor watches its children and restarts crashed ones. With nested supervisors, a failure in one subsystem restarts only that part — the rest keeps running.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\buse\s+Supervisor\b/.test(l) ||
          /\bchildren\s*=\s*\[/.test(l) ||
          /\bSupervisor\.start_link\b/.test(l) ||
          /strategy:\s*:one_for_one|:one_for_all|:rest_for_one/.test(l),
      ),
  },
  {
    name: 'pattern matching',
    score: 8,
    technicalDetail: 'Elixir pattern matching — using `case`, `with`, or function clauses to match on data shape and bind variables simultaneously.',
    explanation: 'Pattern matching in Elixir goes far beyond switch statements. A `with` chain handles a sequence of operations that each return `{:ok, value}` or `{:error, reason}` — short-circuit on the first failure.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\bcase\s+\w/.test(l) ||
          /\bwith\s+{:ok,\s*/.test(l) ||
          /\b->\s*{:ok,/.test(l) ||
          /\b->\s*{:error,/.test(l),
      ),
  },
  {
    name: 'Phoenix LiveView',
    score: 9,
    technicalDetail: 'Phoenix LiveView — server-rendered real-time UI over WebSockets, with handle_event and handle_info callbacks updating state and re-rendering diffs.',
    explanation: 'LiveView keeps the UI state on the server and pushes minimal HTML diffs over a WebSocket. Real-time features without a JavaScript framework — one language, one process.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\buse\s+\w+Web,\s*:live_view\b/.test(l) ||
          /\bPhoenix\.LiveView\b/.test(l) ||
          /\bdef\s+handle_event\b/.test(l) ||
          /\bdef\s+mount\b/.test(l),
      ),
  },
  {
    name: 'Task async / concurrency',
    score: 8,
    technicalDetail: 'Task.async / Task.await / Task.async_stream — spawning supervised async tasks and collecting results, with automatic cleanup on timeout.',
    explanation: 'Task.async_stream runs a function concurrently over a collection with a configurable concurrency limit. Results arrive in order; tasks that crash are isolated.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\bTask\.async\b/.test(l) ||
          /\bTask\.await\b/.test(l) ||
          /\bTask\.async_stream\b/.test(l),
      ),
  },
  {
    name: 'Telemetry instrumentation',
    score: 7,
    technicalDetail: ':telemetry.execute / :telemetry.attach — Erlang/Elixir telemetry events for metrics, tracing, and observability without coupling to a specific backend.',
    explanation: 'Telemetry decouples instrumentation from reporting. Emit an event anywhere; attach handlers in the config. Swap Prometheus for Datadog without touching business logic.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\b:telemetry\.execute\b/.test(l) ||
          /\b:telemetry\.attach\b/.test(l) ||
          /\bTelemetry\.Metrics\b/.test(l),
      ),
  },
];

export class ElixirPatternsModule implements CodeAnalyzer {
  readonly id = 'elixir_patterns';
  readonly name = 'Elixir / OTP Patterns';
  readonly category = 'elixir_patterns' as const;
  readonly applicableLanguages = ['Elixir'];

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    for (const diff of ctx.diffs) {
      if (!diff.patch || diff.status === 'removed') continue;
      if (diff.language !== 'Elixir') continue;

      const addedLines = diff.patch
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1));

      if (addedLines.length === 0) continue;

      for (const pattern of PATTERNS) {
        if (pattern.detect(addedLines)) {
          return {
            moduleId: this.id,
            aspect: pattern.name,
            finding: `Detected ${pattern.name} in ${diff.filename}`,
            technicalDetail: pattern.technicalDetail,
            plainLanguage: pattern.explanation,
            interestScore: pattern.score,
            contextHint: `${diff.filename} in ${ctx.repo}`,
          };
        }
      }
    }

    return null;
  }
}
