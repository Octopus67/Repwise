/**
 * Session Detail View — Pure helper functions
 *
 * Extracted for testability. These operate on backend TrainingSessionResponse
 * shapes (not ActiveExercise), so they differ from the active workout utils.
 */

import type { TrainingSessionResponse } from '../../types/training';
import { convertWeight, type UnitSystem } from '../../utils/unitConversion';

/**
 * Calculate total working volume from a session response.
 * Excludes warm-up sets. Volume = sum of (weight_in_user_unit × reps).
 */
export function calculateSessionWorkingVolume(
  session: TrainingSessionResponse,
  unitSystem: UnitSystem,
): number {
  let volume = 0;
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      const setType = set.set_type || 'normal';
      if (setType !== 'warm-up') {
        const displayWeight = convertWeight(set.weight_kg, unitSystem);
        volume += displayWeight * set.reps;
      }
    }
  }
  return volume;
}

/**
 * Calculate duration in seconds from start_time and end_time.
 * Returns null if either timestamp is missing.
 */
export function calculateDurationSeconds(
  startTime: string | null,
  endTime: string | null,
): number | null {
  if (!startTime || !endTime) return null;
  const diff = Math.floor(
    (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000,
  );
  return diff > 0 ? diff : null;
}

/**
 * Check if a specific set achieved a PR.
 * Matches by exercise name, reps, and weight (within 0.01kg tolerance).
 */
export function isSetPR(
  personalRecords: TrainingSessionResponse['personal_records'],
  exerciseName: string,
  weightKg: number,
  reps: number,
): boolean {
  if (!personalRecords?.length) return false;
  return personalRecords.some(
    (pr) =>
      pr.exercise_name === exerciseName &&
      pr.reps === reps &&
      Math.abs(pr.new_weight_kg - weightKg) < 0.01,
  );
}
