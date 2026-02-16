/**
 * Session Detail — Pure Logic Functions
 *
 * Extracted for testability. These operate on backend TrainingSessionResponse
 * shapes and produce display-ready values.
 */

import type { TrainingSessionResponse, PersonalRecordResponse } from '../types/training';
import { convertWeight, type UnitSystem } from './unitConversion';

/**
 * Determine whether the duration section should be shown.
 * Only show when both start_time and end_time are present and produce a positive duration.
 */
export function shouldShowDuration(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): boolean {
  if (!startTime || !endTime) return false;
  const diff = new Date(endTime).getTime() - new Date(startTime).getTime();
  return diff > 0;
}

/**
 * Calculate total working volume from a session response.
 * Excludes warm-up sets. Volume = sum of (weight_in_user_unit × reps).
 */
export function calculateWorkingVolume(
  exercises: TrainingSessionResponse['exercises'],
  unitSystem: UnitSystem,
): number {
  let volume = 0;
  for (const exercise of exercises) {
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
 * Format a session date string (YYYY-MM-DD) for display.
 * Returns a human-readable date like "Monday, January 15, 2024".
 */
export function formatSessionDate(sessionDate: string): string {
  const date = new Date(sessionDate + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Check if a specific set achieved a personal record.
 * Matches by exercise name, reps, and weight (within 0.01kg tolerance).
 */
export function isPRSet(
  personalRecords: PersonalRecordResponse[] | undefined | null,
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

/**
 * Calculate duration in seconds from start_time and end_time.
 * Returns null if either timestamp is missing or duration is non-positive.
 */
export function calculateDurationSeconds(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): number | null {
  if (!startTime || !endTime) return null;
  const diff = Math.floor(
    (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000,
  );
  return diff > 0 ? diff : null;
}
