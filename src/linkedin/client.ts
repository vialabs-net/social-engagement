import { withRetry, GITHUB_RETRY_POLICY } from '../utils/retry.js';
import { logger } from '../utils/logger.js';

const LINKEDIN_API = 'https://api.linkedin.com';
const LINKEDIN_VERSION = '202501';

export class LinkedInAuthExpiredError extends Error {
  constructor() {
    super('LinkedIn access token expired — user must re-authorize');
    this.name = 'LinkedInAuthExpiredError';
  }
}

export interface LinkedInPostResult {
  readonly id: string;  // LinkedIn post URN
}

/**
 * Posts text content directly to LinkedIn on behalf of an authenticated member.
 * Uses the LinkedIn Posts API (v202501).
 */
export class LinkedInClient {
  constructor(private readonly accessToken: string) {}

  async post(memberUrn: string, text: string): Promise<LinkedInPostResult> {
    return withRetry(async () => {
      const response = await fetch(`${LINKEDIN_API}/rest/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'LinkedIn-Version': LINKEDIN_VERSION,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          author: memberUrn,
          lifecycleState: 'PUBLISHED',
          visibility: 'PUBLIC',
          commentary: text,
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
        }),
      });

      if (response.status === 401) throw new LinkedInAuthExpiredError();
      if (response.status === 429) throw new Error('LinkedIn rate limited');
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`LinkedIn post failed (${response.status}): ${body}`);
      }

      // LinkedIn returns the post URN in the X-RestLi-Id header
      const postUrn = response.headers.get('x-restli-id') ?? response.headers.get('X-RestLi-Id') ?? '';
      logger.info('linkedin.post.created', { memberUrn, postUrn });
      return { id: postUrn };
    }, GITHUB_RETRY_POLICY, 'linkedin.post');
  }

  /**
   * Fetches the authenticated member's profile to get their member ID.
   * Required once after OAuth to store the URN for future posts.
   */
  async getMemberUrn(): Promise<string> {
    const response = await fetch(`${LINKEDIN_API}/v2/userinfo`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'LinkedIn-Version': LINKEDIN_VERSION,
      },
    });

    if (response.status === 401) throw new LinkedInAuthExpiredError();
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`LinkedIn userinfo failed (${response.status}): ${body}`);
    }

    const data = await response.json() as { sub: string };
    return `urn:li:person:${data.sub}`;
  }
}
