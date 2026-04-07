import OpenAI from 'openai';
import type { IEmbedder } from './types.js';

export class OpenAIEmbedder implements IEmbedder {
  private readonly client: OpenAI;
  readonly model: string;
  readonly dimensions: number;

  constructor(apiKey: string, model = 'text-embedding-3-small') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    // text-embedding-3-small fixed at 1536 dimensions
    this.dimensions = 1536;
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error('OpenAI embeddings API returned no embedding data');
    }
    return embedding;
  }
}
