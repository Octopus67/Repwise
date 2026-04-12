import { parseWeightInput } from './unitConversion';
import type { SetType } from '../types/training';

export type ProgressionStatus = 'progressed' | 'matched' | 'regressed' | 'no_data';

/**
 * Compare a completed set against the previous session's corresponding set.
 * Only compares 'normal' sets — warm-up, drop-set, amrap return 'no_data'.
 */
export function getProgressionStatus(
  currentWeight: string,
  currentReps: string,
  previousSet: { weightKg: number; reps: number } | null,
  setType: SetType,
  unitSystem: 'metric' | 'imperial',
): ProgressionStatus {
  if (setType !== 'normal') return 'no_data';
  if (!previousSet) return 'no_data';

  const w = parseFloat(currentWeight);
  const r = parseInt(currentReps, 10);
  if (isNaN(w) || isNaN(r) || w <= 0 || r <= 0) return 'no_data';

  const currentKg = parseWeightInput(w, unitSystem);
  const prevKg = previousSet.weightKg;
  const prevReps = previousSet.reps;

  // Weight takes priority: heavier at any reps = progressed
  const weightDiff = Math.round((currentKg - prevKg) * 10) / 10;
  if (weightDiff > 0) return 'progressed';
  if (weightDiff < 0) return 'regressed';

  // Same weight: compare reps
  if (r > prevReps) return 'progressed';
  if (r < prevReps) return 'regressed';
  return 'matched';
}
