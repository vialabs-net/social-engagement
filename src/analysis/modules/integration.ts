import type { CodeAnalyzer, AnalysisContext, Finding } from '../types.js';

interface ServiceSignature {
  name: string;
  patterns: RegExp[];
  category: string;
  explanation: string;
  score: number;
}

// AI integrations are covered by AiAssistedModule — skip here to avoid duplicate findings
const AI_CATEGORY = 'AI / large language model';

const KNOWN_SERVICES: ServiceSignature[] = [
  {
    name: 'Redis',
    patterns: [/from ['"]ioredis['"]|from ['"]redis['"]|new Redis\(|createClient\(\)/i],
    category: 'caching / pub-sub',
    explanation: 'Redis integration adds a fast in-memory layer between the application and the database. Key decisions: TTL strategy, fallback behavior on cache miss, and cache invalidation approach.',
    score: 9,
  },
  {
    name: 'Stripe',
    patterns: [/from ['"]stripe['"]|new Stripe\(|stripe\./i],
    category: 'payment processing',
    explanation: 'Stripe integration handles payment processing with idempotency keys, webhook verification, and error handling specific to financial transactions.',
    score: 9,
  },
  {
    name: 'Anthropic / Claude',
    patterns: [/from ['"]@anthropic-ai\/sdk['"]|new Anthropic\(/],
    category: 'AI / large language model',
    explanation: 'Claude API integration brings AI capabilities into the codebase. Notable design decisions: model selection, token budget, retry strategy for overloaded responses, and prompt structure.',
    score: 8,
  },
  {
    name: 'Supabase',
    patterns: [/from ['"]@supabase\/supabase-js['"]|createClient\(/],
    category: 'database / auth / storage',
    explanation: 'Supabase integration provides a Postgres-backed backend with built-in auth and row-level security. Connection setup and query patterns matter for both security and performance.',
    score: 7,
  },
  {
    name: 'Prisma',
    patterns: [/from ['"]@prisma\/client['"]|new PrismaClient\(/],
    category: 'ORM / database access',
    explanation: 'Prisma integration provides type-safe database access with auto-generated queries. Schema changes require migrations and client regeneration.',
    score: 7,
  },
  {
    name: 'OpenAI',
    patterns: [/from ['"]openai['"]|new OpenAI\(/],
    category: 'AI / large language model',
    explanation: 'OpenAI API integration adds AI generation capabilities. Relevant design decisions: model choice, token limits, retry strategy, and whether to stream responses.',
    score: 8,
  },
  {
    name: 'PostgreSQL',
    patterns: [/from ['"]pg['"]|from ['"]postgres['"]|new Pool\(|\.query\(/],
    category: 'relational database',
    explanation: 'Direct PostgreSQL integration — connection pooling, parameterized queries, and transaction management are the key reliability considerations.',
    score: 6,
  },
  {
    name: 'RabbitMQ / AMQP',
    patterns: [/from ['"]amqplib['"]|amqp\.connect\(/i],
    category: 'message queue',
    explanation: 'Message queue integration enables async, decoupled processing. Dead letter queues, acknowledgment strategies, and retry logic are the core reliability concerns.',
    score: 8,
  },
  {
    name: 'Kubernetes client',
    patterns: [/from ['"]@kubernetes\/client-node['"]|KubeConfig\(/],
    category: 'container orchestration',
    explanation: 'Kubernetes API client enables programmatic cluster management — deploying workloads, watching resource states, and managing configurations from code.',
    score: 9,
  },
  {
    name: 'AWS SDK',
    patterns: [/from ['"]@aws-sdk\//],
    category: 'cloud services (AWS)',
    explanation: 'AWS SDK integration connects to cloud services (S3, SQS, Lambda, etc.). IAM permissions, region configuration, and retry behavior are key operational concerns.',
    score: 7,
  },
];

export class IntegrationModule implements CodeAnalyzer {
  readonly id = 'integration';
  readonly name = 'Integration Detector';
  readonly category = 'integration' as const;

  async analyze(ctx: AnalysisContext): Promise<Finding | null> {
    const addedLines = ctx.diffs.flatMap(d =>
      d.patch.split('\n')
        .filter(l => l.startsWith('+') && !l.startsWith('+++'))
        .map(l => l.slice(1))
    );

    if (addedLines.length === 0) return null;

    const addedText = addedLines.join('\n');

    for (const service of KNOWN_SERVICES) {
      if (service.category === AI_CATEGORY) continue;
      if (service.patterns.some(p => p.test(addedText))) {
        return {
          moduleId: this.id,
          aspect: `${service.name} integration`,
          finding: `Connected ${service.name} (${service.category})`,
          technicalDetail: `${service.name}, ${service.category}. New import/client initialization detected in the diff.`,
          plainLanguage: service.explanation,
          interestScore: service.score,
        };
      }
    }

    return null;
  }
}
