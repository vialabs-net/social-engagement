import { logger } from './logger.js';

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  backoffFactor: number;
  /** If provided, only retry when this returns true for the thrown error. */
  shouldRetry?: (err: unknown) => boolean;
}

export const GITHUB_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffFactor: 2,
  shouldRetry: (err) => {
    const e = err as { status?: number };
    return e.status === 429 || e.status === 500 || e.status === 503;
  },
};

export const ANTHROPIC_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffFactor: 2,
  shouldRetry: (err) => {
    const e = err as { status?: number };
    // 529 = Overloaded. 400/401 = don't retry.
    return e.status === 529 || e.status === 500;
  },
};

export const BUFFER_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 2000,
  backoffFactor: 2,
  shouldRetry: (err) => {
    const e = err as { status?: number };
    return typeof e.status === 'number' && e.status >= 500;
  },
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  context = 'operation',
): Promise<T> {
  let lastError: unknown;
  let delayMs = policy.initialDelayMs;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const retriable = policy.shouldRetry ? policy.shouldRetry(err) : true;
      if (!retriable || attempt === policy.maxAttempts) {
        throw err;
      }

      logger.warn(`${context}: attempt ${attempt} failed, retrying in ${delayMs}ms`, {
        error: String(err),
      });

      await sleep(delayMs);
      delayMs *= policy.backoffFactor;
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
