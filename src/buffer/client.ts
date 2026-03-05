import { withRetry, BUFFER_RETRY_POLICY } from '../utils/retry.js';

const BUFFER_GRAPHQL = 'https://api.buffer.com';
const BUFFER_REST = 'https://api.bufferapp.com/1';

export class BufferTokenExpiredError extends Error {
  constructor() {
    super('Buffer API token expired. Regenerate at buffer.com → Settings → Apps.');
    this.name = 'BufferTokenExpiredError';
  }
}

export interface BufferPost {
  id: string;
  text: string;
  scheduled_at: number;  // Unix timestamp
  status: string;
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

  // ─── REST (read-only, for voice loop) ──────────────────────────────────────

  async getSentPosts(profileId: string, page = 1): Promise<BufferPost[]> {
    return withRetry(async () => {
      const params = new URLSearchParams({
        access_token: this.token,
        page: String(page),
      });
      const response = await fetch(
        `${BUFFER_REST}/profiles/${profileId}/updates/sent.json?${params}`,
        { method: 'GET' },
      );
      if (response.status === 401) throw new BufferTokenExpiredError();
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const err = new Error(`Buffer REST error ${response.status}: ${body}`);
        (err as unknown as { status: number }).status = response.status;
        throw err;
      }
      const data = await response.json() as { updates?: BufferPost[] };
      return data.updates ?? [];
    }, BUFFER_RETRY_POLICY, 'buffer.getSentPosts');
  }
}
