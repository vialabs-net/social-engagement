import type { VoiceStage } from './storage.js';

export function computeVoiceStage(uniquePublishedCount: number, hasBootstrap: boolean): VoiceStage {
  if (uniquePublishedCount >= 15) return 'established';
  if (uniquePublishedCount >= 5) return 'warming';
  if (hasBootstrap) return 'bootstrap';
  return 'cold';
}
