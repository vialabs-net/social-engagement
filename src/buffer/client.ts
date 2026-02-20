import { withRetry, BUFFER_RETRY_POLICY } from '../utils/retry.js';

const BUFFER_API = 'https://api.bufferapp.com/1';

export class BufferTokenExpiredError extends Error {
  constructor() {
    super('Buffer API token expired. Regenerate at buffer.com → Settings → Apps.');
    this.name = 'BufferTokenExpiredError';
  }
}

export interface BufferProfile {
  id: string;
  service: string;
  formatted_username: string;
  default_profile: boolean;
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

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, string | number | string[]>,
  ): Promise<T> {
    return withRetry(async () => {
      const url = `${BUFFER_API}${path}`;
      const params = new URLSearchParams({ access_token: this.token });

      let fetchOptions: RequestInit;
      if (method === 'GET') {
        const response = await fetch(`${url}?${params}`, { method: 'GET' });
        return this.handleResponse<T>(response);
      } else {
        if (body) {
          for (const [k, v] of Object.entries(body)) {
            if (Array.isArray(v)) {
              v.forEach((item, i) => params.append(`${k}[]`, item));
            } else {
              params.append(k, String(v));
            }
          }
        }
        fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        };
        const response = await fetch(url, fetchOptions);
        return this.handleResponse<T>(response);
      }
    }, BUFFER_RETRY_POLICY, `buffer.${method} ${path}`);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401) throw new BufferTokenExpiredError();
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err = new Error(`Buffer API error ${response.status}: ${text}`);
      (err as unknown as { status: number }).status = response.status;
      throw err;
    }
    return response.json() as Promise<T>;
  }

  async getProfiles(): Promise<BufferProfile[]> {
    return this.request<BufferProfile[]>('GET', '/profiles.json');
  }

  async getPendingCount(profileId: string): Promise<number> {
    const data = await this.request<{ total: number }>('GET', `/profiles/${profileId}/updates/pending.json`);
    return data.total;
  }

  async createUpdate(
    profileId: string,
    text: string,
    scheduledAt: number,  // Unix timestamp (UTC)
  ): Promise<{ id: string }> {
    const data = await this.request<{ updates: Array<{ id: string }> }>('POST', '/updates/create.json', {
      'profile_ids[]': profileId,
      text,
      scheduled_at: scheduledAt,
      now: '0',
    });
    const update = data.updates[0];
    if (!update) throw new Error('Buffer returned no update ID');
    return { id: update.id };
  }

  async getSentPosts(profileId: string, page = 1): Promise<BufferPost[]> {
    const data = await this.request<{ updates: BufferPost[] }>(
      'GET',
      `/profiles/${profileId}/updates/sent.json?page=${page}`,
    );
    return data.updates ?? [];
  }
}
