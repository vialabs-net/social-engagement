import { withRetry, BUFFER_RETRY_POLICY } from '../utils/retry.js';

const BUFFER_GRAPHQL = 'https://api.buffer.com';

export class BufferTokenExpiredError extends Error {
  constructor() {
    super('Buffer API token expired. Regenerate at buffer.com → Settings → Apps.');
    this.name = 'BufferTokenExpiredError';
  }
}

export interface BufferPost {
  id: string;
  text: string;
  createdAt: string;  // ISO 8601 timestamp from GraphQL
  externalLink: string | null;  // published post URL at destination (e.g. LinkedIn) — null if unsupported
}

export class BufferClient {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  // ─── Shared GraphQL transport ─────────────────────────────────────────────

  private async graphqlRequest<T>(
    query: string,
    variables: Record<string, unknown>,
    operationName: string,
  ): Promise<T> {
    return withRetry(async () => {
      const response = await fetch(BUFFER_GRAPHQL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });

      if (response.status === 401) throw new BufferTokenExpiredError();
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Buffer GraphQL error ${response.status}: ${body}`);
      }

      const json = await response.json() as {
        data?: T;
        errors?: Array<{ message: string }>;
      };

      if (json.errors?.length) {
        throw new Error(`Buffer GraphQL error: ${json.errors[0]?.message ?? 'unknown'}`);
      }

      return json.data as T;
    }, BUFFER_RETRY_POLICY, operationName);
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  async createIdea(orgId: string, title: string, text: string): Promise<{ id: string }> {
    const data = await this.graphqlRequest<{
      createIdea?: { id?: string; message?: string };
    }>(
      `mutation CreateIdea($input: CreateIdeaInput!) {
        createIdea(input: $input) {
          ... on Idea { id }
          ... on MutationError { message }
        }
      }`,
      {
        input: {
          organizationId: orgId,
          content: { title, text },
        },
      },
      'buffer.createIdea',
    );

    const result = data.createIdea;
    if (!result?.id) {
      const msg = (result as { message?: string } | undefined)?.message ?? 'unknown error';
      throw new Error(`Buffer createIdea failed: ${msg}`);
    }

    return { id: result.id };
  }

  // ─── Queries (read-only, for voice loop) ──────────────────────────────────

  async getSentPosts(orgId: string, channelId: string): Promise<BufferPost[]> {
    const data = await this.graphqlRequest<{
      posts?: { edges?: Array<{ node: BufferPost }> };
    }>(
      `query GetSentPosts($input: PostsInput!, $first: Int) {
        posts(input: $input, first: $first) {
          edges {
            node { id text createdAt externalLink }
          }
        }
      }`,
      {
        input: {
          organizationId: orgId,
          filter: { status: ['sent'], channelIds: [channelId] },
        },
        first: 20,
      },
      'buffer.getSentPosts',
    );

    return data.posts?.edges?.map((e) => e.node) ?? [];
  }
}
