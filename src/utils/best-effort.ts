import { logger } from './logger.js';

/**
 * Fire-and-forget wrapper for best-effort async operations.
 * Logs a structured warning on failure instead of crashing.
 * Use this instead of raw `.catch(logger.warn)` to keep the pattern consistent
 * and make it easy to add metrics/DB writes here in the future.
 *
 * @param label Dot-separated log key prefix (e.g. 'poll.deposit_signal')
 * @param promise The async operation to run best-effort
 * @param context Extra fields to include in the warning log
 */
export function bestEffort(
  label: string,
  promise: Promise<unknown>,
  context?: Record<string, unknown>,
): void {
  promise.catch((err: unknown) => {
    logger.warn(`${label}.failed`, { ...context, error: String(err) });
  });
}
