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
}

export class BufferClient {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  // ─── GraphQL (mutations) ────────────────────────────────────────────────────

  async createIdea(orgId: string, title: string, text: string): Promise<{ id: string }> {
    return withRetry(async () => {
      const response = await fetch(BUFFER_GRAPHQL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation CreateIdea($input: CreateIdeaInput!) {
              createIdea(input: $input) {
                ... on Idea { id }
                ... on MutationError { message }
              }
            }
          `,
          variables: {
            input: {
              organizationId: orgId,
              content: { title, text },
            },
          },
        }),
      });

      if (response.status === 401) throw new BufferTokenExpiredError();
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Buffer GraphQL error ${response.status}: ${body}`);
      }

      const json = await response.json() as {
        data?: { createIdea?: { id?: string; message?: string } };
        errors?: Array<{ message: string }>;
      };

      if (json.errors?.length) {
        throw new Error(`Buffer GraphQL error: ${json.errors[0]?.message ?? 'unknown'}`);
      }

      const result = json.data?.createIdea;
      if (!result?.id) {
        const msg = (result as { message?: string } | undefined)?.message ?? 'unknown error';
        throw new Error(`Buffer createIdea failed: ${msg}`);
      }

      return { id: result.id };
    }, BUFFER_RETRY_POLICY, 'buffer.createIdea');
  }

  // ─── GraphQL (read-only, for voice loop) ───────────────────────────────────

  async getSentPosts(orgId: string, channelId: string): Promise<BufferPost[]> {
    return withRetry(async () => {
      const response = await fetch(BUFFER_GRAPHQL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query GetSentPosts($input: PostsInput!, $first: Int) {
              posts(input: $input, first: $first) {
                edges {
                  node { id text createdAt }
                }
              }
            }
          `,
          variables: {
            input: {
              organizationId: orgId,
              filter: { status: ['sent'], channelIds: [channelId] },
            },
            first: 20,
          },
        }),
      });

      if (response.status === 401) throw new BufferTokenExpiredError();
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Buffer GraphQL error ${response.status}: ${body}`);
      }

      const json = await response.json() as {
        data?: { posts?: { edges?: Array<{ node: BufferPost }> } };
        errors?: Array<{ message: string }>;
      };

      if (json.errors?.length) {
        throw new Error(`Buffer GraphQL error: ${json.errors[0]?.message ?? 'unknown'}`);
      }

      return json.data?.posts?.edges?.map((e) => e.node) ?? [];
    }, BUFFER_RETRY_POLICY, 'buffer.getSentPosts');
  }
}
