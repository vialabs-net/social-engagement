import Anthropic from '@anthropic-ai/sdk';
import { withRetry, ANTHROPIC_RETRY_POLICY } from '../utils/retry.js';
import type { IAIClient } from './types.js';

export class PromptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromptError';
  }
}

export class AnthropicAdapter implements IAIClient {
  private readonly client: Anthropic;
  readonly model: string;
  readonly maxTokens: number;

  constructor(
    apiKey: string,
    model = 'claude-sonnet-4-6',
    maxTokens = 1600,
  ) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.maxTokens = maxTokens;
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    return withRetry(async () => {
      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });

        const block = response.content[0];
        if (block?.type !== 'text') {
          throw new PromptError('Unexpected response type from Claude API');
        }
        return block.text;
      } catch (err) {
        const e = err as { status?: number; message?: string };
        if (e.status === 400) throw new PromptError(`Bad request: ${e.message}`);
        if (e.status === 401) throw new Error('Anthropic API: Unauthorized. Check ANTHROPIC_API_KEY.');
        if (e.status && e.status >= 402 && e.status < 500) {
          throw new PromptError(`Anthropic API ${e.status}: ${e.message}`);
        }
        throw err;
      }
    }, ANTHROPIC_RETRY_POLICY, 'anthropic.complete');
  }
}
