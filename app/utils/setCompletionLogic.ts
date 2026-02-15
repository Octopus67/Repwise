/**
 * Set Completion Logic
 *
 * Pure functions for validating set completion, detecting unsaved data,
 * and copying previous performance into set fields.
 */

import type { ActiveSet, ActiveExercise, PreviousPerformanceData } from '../types/training';
import { convertWeight, type UnitSystem } from './unitConversion';

/**
 * Validate whether a set can be marked as completed.
 * Weight and reps must be non-empty and parse to positive numbers.
 */
export function canCompleteSet(set: ActiveSet): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const weight = parseFloat(set.weight);
  const reps = parseFloat(set.reps);

  if (!set.weight.trim() || !Number.isFinite(weight) || weight <= 0) {
    errors.push('weight');
  }
  if (!set.reps.trim() || !Number.isFinite(reps) || reps <= 0) {
    errors.push('reps');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Check if any exercise has data worth saving (name filled or any set has weight/reps).
 */
export function hasUnsavedData(exercises: ActiveExercise[]): boolean {
  for (const exercise of exercises) {
    if (exercise.exerciseName.trim()) return true;
    for (const set of exercise.sets) {
      if (set.weight.trim() || set.reps.trim()) return true;
    }
  }
  return false;
}

/**
 * Copy previous performance data into string fields for a TextInput,
 * converting weight from kg to the user's unit system.
 */
export function copyPreviousToSet(
  previous: PreviousPerformanceData,
  setIndex: number,
  unitSystem: UnitSystem,
): { weight: string; reps: string } {
  if (setIndex < 0 || setIndex >= previous.sets.length) {
    return { weight: '', reps: '' };
  }
  const set = previous.sets[setIndex];
  const weight = convertWeight(set.weightKg, unitSystem);
  return { weight: String(weight), reps: String(set.reps) };
}
