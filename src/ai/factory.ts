import { AnthropicAdapter } from './anthropic-adapter.js';
import { OpenAIEmbedder } from './openai-embedder.js';
import type { IAIClient, IEmbedder } from './types.js';

export function createAIClient(
  provider: string,
  apiKey: string,
  model: string,
  maxTokens: number,
): IAIClient {
  if (provider === 'anthropic') {
    return new AnthropicAdapter(apiKey, model, maxTokens);
  }
  throw new Error(`Unsupported AI provider: ${provider}`);
}

export function createEmbedder(provider: string, apiKey: string, model: string): IEmbedder {
  if (provider === 'openai') {
    return new OpenAIEmbedder(apiKey, model);
  }
  throw new Error(`Unsupported embedder provider: ${provider}`);
}
