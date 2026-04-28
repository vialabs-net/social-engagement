import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';
import { extractRemovedLines, extractFirstHunkSnippet } from '../diff-parser.js';

interface ArchPattern {
  readonly name: string;
  readonly score: number;
  readonly technicalDetail: string;
  readonly explanation: string;
  detect(addedLines: readonly string[], filename: string, allFilenames: readonly string[]): boolean;
}

const PATTERNS: readonly ArchPattern[] = [
  {
    name: 'hexagonal architecture (ports & adapters)',
    score: 9,
    technicalDetail: 'Hexagonal architecture — the domain defines Port interfaces; Adapters implement them. Business logic has zero dependencies on frameworks, databases, or transport.',
    explanation: 'Hexagonal architecture puts the domain at the center. Ports are interfaces the domain defines; adapters implement them. Swap a database adapter without touching a single line of business logic.',
    detect: (lines, filename) => {
      const isHexagonalFile =
        /(?:port|adapter|gateway)\.(ts|js|py|go|java|kt|ex|exs)$/i.test(filename);
      const hasStructuralEvidence = lines.some(
        (l) =>
          /\binterface\s+\w*(Port|Adapter|Gateway)\b/.test(l) ||
          /\bclass\s+\w*(Adapter|Gateway)\b/.test(l) ||
          /\bimplements\s+\w*(Port|Adapter)\b/.test(l),
      );
      return isHexagonalFile || hasStructuralEvidence;
    },
  },
  {
    name: 'CQRS (command/query separation)',
    score: 9,
    technicalDetail: 'CQRS — Commands mutate state, Queries read state. Each has its own model, allowing independent scaling, optimization, and evolution of reads and writes.',
    explanation: 'CQRS separates read and write models. The write side optimizes for consistency and validation; the read side optimizes for query performance. Scale them independently.',
    detect: (lines, filename) => {
      const hasCommandQuery =
        /(?:command|query)(?:handler|bus|dispatcher)/i.test(filename) ||
        lines.some(
          (l) =>
            /\b(CommandBus|QueryBus|CommandHandler|QueryHandler|ICommand|IQuery)\b/.test(l) ||
            /\bclass\s+\w+(Command|Query|Handler)\b/.test(l),
        );
      return hasCommandQuery;
    },
  },
  {
    name: 'event sourcing',
    score: 9,
    technicalDetail: 'Event sourcing — state derived from an append-only log of domain events. The current state is a projection of all past events.',
    explanation: 'Event sourcing stores every state change as an immutable event. Replay the event log to rebuild state at any point in time — full audit trail, time travel, multiple projections.',
    detect: (lines, filename) =>
      /(?:event.?store|domain.?event|aggregate.?root|event.?stream)/i.test(filename) ||
      lines.some(
        (l) =>
          /\b(EventStore|DomainEvent|AggregateRoot|EventStream|EventSourcing)\b/.test(l) ||
          /\bclass\s+\w+Event\b/.test(l),
      ),
  },
  {
    name: 'clean architecture use cases',
    score: 8,
    technicalDetail: 'Clean Architecture use cases — application-layer interactors encapsulating a single business operation, with no framework dependencies.',
    explanation: 'Use cases contain one business operation. They depend on abstract repositories, not concrete databases. Test them without spinning up a server or database.',
    detect: (lines, filename) =>
      /(?:use.?case|interactor|application.?service)/i.test(filename) ||
      lines.some(
        (l) =>
          /\bclass\s+\w+(UseCase|Interactor|ApplicationService)\b/.test(l) ||
          /\binterface\s+I\w+(Repository|Gateway|Service)\b/.test(l),
      ),
  },
  {
    name: 'event-driven messaging',
    score: 8,
    technicalDetail: 'Event-driven architecture — components communicate via published events (Kafka, RabbitMQ, NATS, EventBus) instead of direct calls, decoupling producers from consumers.',
    explanation: 'Event-driven systems decouple producers from consumers. Publishing an event does not wait for a response — consumers process at their own pace, and new consumers can be added without touching the producer.',
    detect: (lines) =>
      lines.some(
        (l) =>
          /\b(EventBus|MessageBus|DomainEventPublisher)\b/.test(l) ||
          /\b(KafkaProducer|KafkaConsumer|RabbitMQ|nats\.connect)\b/.test(l) ||
          /\b(publish|subscribe|emit|dispatch)\s*\([^)]*[Ee]vent/.test(l),
      ),
  },
  {
    name: 'saga / process manager',
    score: 8,
    technicalDetail: 'Saga pattern — long-running distributed transactions coordinated through a sequence of local transactions, each publishing events or commands to trigger the next step.',
    explanation: 'A saga coordinates a distributed transaction without a two-phase commit. Each step publishes an event; if one fails, compensating transactions undo the previous steps.',
    detect: (lines, filename) =>
      /(?:saga|process.?manager|orchestrat|choreograph)/i.test(filename) ||
      lines.some(
        (l) =>
          /\bclass\s+\w+(Saga|ProcessManager|Orchestrator)\b/.test(l) ||
          /\b(compensat|rollback|compensating)\w*Transaction/i.test(l),
      ),
  },
];

export class ArchitecturePatternsModule implements CodeAnalyzer {
  readonly id = 'architecture_patterns';
  readonly name = 'Architecture Patterns';
  readonly category = 'architecture_patterns' as const;
  // No applicableLanguages — runs on all commits

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    const allFilenames = ctx.diffs.map((d) => d.filename);

    for (const diff of ctx.diffs) {
      if (!diff.patch || diff.status === 'removed') continue;

      const addedLines = diff.patch
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1));

      if (addedLines.length === 0) continue;

      const removedText = extractRemovedLines(diff.patch);
      const removedLines = removedText.split('\n').filter(Boolean);

      for (const pattern of PATTERNS) {
        if (!pattern.detect(addedLines, diff.filename, allFilenames)) continue;
        // Filename-only patterns (detect ignores lines) always fire — skip delta guard.
        // Line-content patterns: skip if the same pattern fires on removed lines too.
        const firesWithoutLines = pattern.detect([], diff.filename, allFilenames);
        if (!firesWithoutLines && pattern.detect(removedLines, diff.filename, allFilenames)) continue;

        const triggerLine = firesWithoutLines
          ? undefined
          : addedLines.find((l) => pattern.detect([l], diff.filename, allFilenames));
        const archFacts: string[] = [
          `${pattern.name} detected in ${diff.filename} (${diff.status}: +${diff.additions}/-${diff.deletions} lines).`,
        ];
        if (triggerLine) archFacts.push(`Trigger: "${triggerLine.trim().slice(0, 100)}".`);

        return {
          moduleId: this.id,
          aspect: pattern.name,
          finding: `Detected ${pattern.name} in ${diff.filename}`,
          technicalDetail: pattern.technicalDetail,
          plainLanguage: pattern.explanation,
          verifiableFacts: archFacts,
          interestScore: pattern.score,
          contextHint: `${diff.filename} in ${ctx.repo}`,
          evidence: {
            before: firesWithoutLines ? undefined : removedText.slice(0, 300) || undefined,
            after: extractFirstHunkSnippet(diff.patch) || undefined,
          },
        };
      }
    }

    return null;
  }
}
