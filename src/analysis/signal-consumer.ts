import { logger } from '../utils/logger.js';
import type { IVoiceStorage, DisparoAuditItem } from '../voice/storage.js';

export type Gatillador = 'individual_mono' | 'individual_multi' | 'focal' | 'arco';

export interface ConsumptionResult {
  readonly postId: string;
  readonly consumedSignalIds: number[];
  readonly snapshotTopics: string[];
}

/**
 * Consume all unconsumed signals for the given topics after a post fires (§9 Opción B).
 * Reads current signal_bank entries for snapshot, marks signals consumed, resets aggregates.
 * Idempotent: if no signals exist for a topic, that topic is skipped silently.
 */
export async function consumeSignalsForPost(
  storage: IVoiceStorage,
  postId: string,
  gatillador: Gatillador,
  topics: string[],
  authorLogin: string,
  repo: string,
): Promise<ConsumptionResult> {
  const allSignalIds: number[] = [];
  const snapshot: DisparoAuditItem[] = [];

  for (const topic of topics) {
    const [entry, signals] = await Promise.all([
      storage.getSignalBankEntry(authorLogin, repo, topic),
      storage.getUnconsumedSignals(authorLogin, repo, topic),
    ]);

    if (signals.length > 0) {
      allSignalIds.push(...signals.map((s) => s.id));
    }

    snapshot.push({
      topic,
      weight_sum: entry?.weight_sum ?? 0,
      last_fired_at: entry?.last_fired_at ?? null,
    });
  }

  await storage.consumeSignals(postId, authorLogin, repo, gatillador, topics, allSignalIds, snapshot);

  logger.info('signal-consumer.consumed', {
    postId,
    gatillador,
    topics,
    signalCount: allSignalIds.length,
    authorLogin,
    repo,
  });

  return { postId, consumedSignalIds: allSignalIds, snapshotTopics: topics };
}

/**
 * Roll back signal consumption for a rejected/invalidated post (§9 rollback).
 * Restores consumed=false on signal events and weight_sum from snapshot.
 * Does NOT reset last_fired_at — the refractory period was earned.
 */
export async function rollbackPostConsumption(
  storage: IVoiceStorage,
  postId: string,
  reason: string,
): Promise<void> {
  await storage.rollbackPostConsumption(postId);

  logger.info('signal-consumer.rollback', { postId, reason });
}
