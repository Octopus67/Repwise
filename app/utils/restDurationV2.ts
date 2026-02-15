/**
 * Rest Duration & Timer Color Utilities
 *
 * Pure functions for determining rest duration per exercise and timer color.
 */

import type { Exercise } from '../types/exercise';

const DEFAULT_COMPOUND_SECONDS = 180;
const DEFAULT_ISOLATION_SECONDS = 90;

/**
 * Get rest duration in seconds for a given exercise.
 * Looks up exercise category in the DB, applies user preferences or defaults.
 */
export function getRestDurationV2(
  exerciseName: string,
  exerciseDb: Exercise[],
  preferences?: { compound_seconds?: number; isolation_seconds?: number },
): number {
  const match = exerciseDb.find(
    (e) => e.name.toLowerCase() === exerciseName.toLowerCase(),
  );
  const isCompound = match ? match.category === 'compound' : true;

  if (isCompound) {
    return preferences?.compound_seconds ?? DEFAULT_COMPOUND_SECONDS;
  }
  return preferences?.isolation_seconds ?? DEFAULT_ISOLATION_SECONDS;
}

/**
 * Get timer ring color based on remaining seconds.
 * green (>10s), yellow (5-10s), red (≤5s)
 */
export function getTimerColor(remainingSeconds: number): string {
  if (remainingSeconds > 10) return 'green';
  if (remainingSeconds > 5) return 'yellow';
  return 'red';
}
