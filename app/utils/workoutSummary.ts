/**
 * Workout Summary Utility
 *
 * Pure function for computing workout summary stats from active exercises.
 */

import type { ActiveExercise } from '../types/training';

export interface WorkoutSummaryResult {
  exerciseCount: number;
  setCount: number;
  totalVolumeKg: number;
}

/**
 * Compute summary statistics for a workout.
 *
 * - exerciseCount: exercises where skipped !== true
 * - setCount: sets where completed === true
 * - totalVolumeKg: Σ(weight × reps) for completed sets
 */
export function computeWorkoutSummary(
  exercises: ActiveExercise[],
): WorkoutSummaryResult {
  const active = exercises.filter((e) => e.skipped !== true);
  let setCount = 0;
  let totalVolumeKg = 0;

  for (const ex of active) {
    for (const s of ex.sets) {
      if (s.completed) {
        setCount++;
        const w = parseFloat(s.weight) || 0;
        const r = parseInt(s.reps, 10) || 0;
        totalVolumeKg += w * r;
      }
    }
  }

  return { exerciseCount: active.length, setCount, totalVolumeKg };
}
