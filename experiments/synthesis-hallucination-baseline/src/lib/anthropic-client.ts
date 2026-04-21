import Anthropic from '@anthropic-ai/sdk';
import { openDb } from './db.js';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-6';

// Approximate per-million-token pricing (USD). Conservative — used for the $5 cap only.
const PRICING = {
  [HAIKU_MODEL]: { input: 1.0, output: 5.0 },
  [SONNET_MODEL]: { input: 3.0, output: 15.0 },
} as const;

const COST_CAP_USD = 5.0;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  client = new Anthropic({ apiKey });
  return client;
}

function readTotalCost(): number {
  const row = openDb()
    .prepare(`SELECT value FROM experiment_meta WHERE key = 'total_cost_usd'`)
    .get() as { value: string } | undefined;
  return row ? parseFloat(row.value) : 0;
}

function addCost(delta: number): number {
  const next = readTotalCost() + delta;
  openDb()
    .prepare(
      `INSERT INTO experiment_meta(key, value) VALUES ('total_cost_usd', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(String(next));
  return next;
}

function estimateCostUsd(
  model: typeof HAIKU_MODEL | typeof SONNET_MODEL,
  usage: { input_tokens: number; output_tokens: number },
): number {
  const price = PRICING[model];
  return (usage.input_tokens / 1_000_000) * price.input +
         (usage.output_tokens / 1_000_000) * price.output;
}

async function callModel(
  model: typeof HAIKU_MODEL | typeof SONNET_MODEL,
  system: string,
  user: string,
  maxTokens: number,
): Promise<{ text: string; cost_usd: number }> {
  const current = readTotalCost();
  if (current >= COST_CAP_USD) {
    throw new Error(`[anthropic] cost cap reached: $${current.toFixed(4)} >= $${COST_CAP_USD}. Aborting.`);
  }

  const response = await getClient().messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const usage = response.usage ?? { input_tokens: 0, output_tokens: 0 };
  const cost = estimateCostUsd(model, usage);
  const total = addCost(cost);

  if (total >= COST_CAP_USD) {
    console.warn(`[anthropic] cost cap reached after call: $${total.toFixed(4)}. Subsequent calls will abort.`);
  }

  const text = response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((b) => b.text)
    .join('');

  return { text, cost_usd: cost };
}

export async function callHaiku(
  system: string,
  user: string,
  maxTokens = 1024,
): Promise<{ text: string; cost_usd: number }> {
  return callModel(HAIKU_MODEL, system, user, maxTokens);
}

export async function callSonnet(
  system: string,
  user: string,
  maxTokens = 2048,
): Promise<{ text: string; cost_usd: number }> {
  return callModel(SONNET_MODEL, system, user, maxTokens);
}

export function currentCostUsd(): number {
  return readTotalCost();
}

export { HAIKU_MODEL, SONNET_MODEL, COST_CAP_USD };
