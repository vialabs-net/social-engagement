import type { SignalBankEntry } from '../voice/storage.js';

export interface AccumulationDecision {
  readonly shouldFire: boolean;
  readonly reason: 'per_topic' | 'cross_volume' | 'time_pressure' | null;
  readonly decayedWeight: number;
  readonly thresholdEffective: number;
}

const LN2 = Math.LN2;
const DAYS_MS = 24 * 60 * 60 * 1000;
const EPSILON = 0.01;           // truncation floor for decayed weight
const MIN_SIGNAL_COUNT = 3;     // per-topic firing gate
const CROSS_VOLUME_THRESHOLD = 25; // summed decayed weight across topics
const TIME_PRESSURE_DAYS = 14;  // forced synthesis if signal sits this long without post

// Cold-start blend constants (§7)
const K_SIGNAL = 9;
const K_REFRACTORY = 6;
const FALLBACK_HL_SIGNAL = 10;     // days — conservative for unknown authors
const FALLBACK_HL_REFRACTORY = 7;  // days — conservative for unknown authors

/**
 * Compute the current (decayed) effective weight of a signal_bank entry.
 * Applies exponential decay from last_signal_at to nowIso.
 * Returns 0 if the decayed value falls below EPSILON.
 */
export function computeDecayedWeight(entry: SignalBankEntry, nowIso: string): number {
  if (!entry.last_signal_at || entry.weight_sum <= 0) return 0;

  const tDays = (new Date(nowIso).getTime() - new Date(entry.last_signal_at).getTime()) / DAYS_MS;
  const lambda = LN2 / entry.half_life_signal;
  const decayed = entry.weight_sum * Math.exp(-lambda * tDays);

  return decayed < EPSILON ? 0 : decayed;
}

/**
 * Compute the effective threshold for a signal_bank entry, accounting for the
 * refractory period since last_fired_at.
 * If never fired, returns threshold_baseline directly.
 */
export function computeThresholdEffective(entry: SignalBankEntry, nowIso: string): number {
  if (!entry.last_fired_at) return entry.threshold_baseline;

  const tDays = (new Date(nowIso).getTime() - new Date(entry.last_fired_at).getTime()) / DAYS_MS;
  const mu = LN2 / entry.half_life_refractory;
  const excess = entry.threshold_baseline * entry.multiplier;

  return entry.threshold_baseline + excess * Math.exp(-mu * tDays);
}

/**
 * Evaluate whether a signal_bank entry should trigger synthesis (Capa 3).
 * Checks per-topic and time-pressure rules only.
 * Cross-volume check requires multiple entries — use checkCrossVolume() at the call site.
 */
export function check(entry: SignalBankEntry, nowIso: string): AccumulationDecision {
  const decayedWeight = computeDecayedWeight(entry, nowIso);
  const thresholdEffective = computeThresholdEffective(entry, nowIso);

  if (entry.signal_count >= MIN_SIGNAL_COUNT && decayedWeight >= thresholdEffective) {
    return { shouldFire: true, reason: 'per_topic', decayedWeight, thresholdEffective };
  }

  // Time pressure: signal accumulating for 14+ days without a post
  if (entry.last_signal_at && decayedWeight > 0) {
    const daysSinceLastSignal = (new Date(nowIso).getTime() - new Date(entry.last_signal_at).getTime()) / DAYS_MS;
    if (daysSinceLastSignal >= TIME_PRESSURE_DAYS) {
      return { shouldFire: true, reason: 'time_pressure', decayedWeight, thresholdEffective };
    }
  }

  return { shouldFire: false, reason: null, decayedWeight, thresholdEffective };
}

/**
 * Check the cross-volume rule: sum of decayed weights across all topic entries
 * exceeds 25. Returns true when multi-topic synthesis should trigger.
 */
export function checkCrossVolume(entries: SignalBankEntry[], nowIso: string): boolean {
  const total = entries.reduce((sum, e) => sum + computeDecayedWeight(e, nowIso), 0);
  return total >= CROSS_VOLUME_THRESHOLD;
}

/**
 * Haiku lazy gate (Capa 2): returns true when the entry is close enough to threshold
 * to justify calling Haiku for a commit that scored 0 in the regex pipeline.
 * Condition: decayedWeight >= thresholdEffective × 0.7
 */
export function shouldRunHaikuLazy(entry: SignalBankEntry, nowIso: string): boolean {
  const decayedWeight = computeDecayedWeight(entry, nowIso);
  const thresholdEffective = computeThresholdEffective(entry, nowIso);
  return decayedWeight >= thresholdEffective * 0.7;
}

/**
 * Compute the accumulation window in days from half_life_signal.
 * Capped between 7 and 28 days as per §7.
 */
export function computeAccumulationWindowDays(halfLifeSignal: number): number {
  return Math.max(7, Math.min(28, Math.round(2.5 * halfLifeSignal)));
}

/**
 * Compute half-life values from commit frequency with cold-start blend (§7).
 * commitsCount: number of commits in the last 60 days.
 * medianIntervalDays: median days between consecutive commits (null if insufficient data).
 */
export function computeHalfLives(
  commitsCount: number,
  medianIntervalDays: number | null,
): { readonly halfLifeSignal: number; readonly halfLifeRefractory: number } {
  const weight = Math.min(1, commitsCount / 10);
  const calculatedSignal = medianIntervalDays != null ? K_SIGNAL * medianIntervalDays : 0;
  const calculatedRefractory = medianIntervalDays != null ? K_REFRACTORY * medianIntervalDays : 0;

  return {
    halfLifeSignal: weight * calculatedSignal + (1 - weight) * FALLBACK_HL_SIGNAL,
    halfLifeRefractory: weight * calculatedRefractory + (1 - weight) * FALLBACK_HL_REFRACTORY,
  };
}
