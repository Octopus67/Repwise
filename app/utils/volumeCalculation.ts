/**
 * Volume Calculation Utilities
 *
 * Pure functions for computing working volume from active workout state.
 */

import type { ActiveExercise } from '../types/training';

/**
 * Calculate total working volume: sum of (weight × reps) for completed,
 * non-warm-up sets across all exercises.
 *
 * Guards against null/undefined inputs and NaN propagation.
 */
export function calculateWorkingVolume(exercises: ActiveExercise[] | null | undefined): number {
  if (!exercises || !Array.isArray(exercises)) {
    return 0;
  }

  let volume = 0;
  for (const exercise of exercises) {
    const sets = exercise?.sets;
    if (!sets || !Array.isArray(sets)) {
      continue;
    }
    for (const set of sets) {
      if (set.completed && set.setType !== 'warm-up') {
        const weight = parseFloat(set.weight);
        const reps = parseFloat(set.reps);
        if (Number.isFinite(weight) && Number.isFinite(reps) && weight >= 0 && reps >= 0) {
          volume += weight * reps;
        }
      }
    }
  }

  // Final NaN guard — should never trigger but prevents downstream issues
  return Number.isFinite(volume) ? volume : 0;
}
