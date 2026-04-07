export interface IAIClient {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
  readonly model: string;
}

export interface IEmbedder {
  embed(text: string): Promise<number[]>;
  readonly dimensions: number;
}
