/**
 * Superset Logic
 *
 * Pure functions for managing superset groups.
 */

import type { SupersetGroup } from '../types/training';

/**
 * Determine if the rest timer should start after completing a set for this exercise.
 * Returns true if the exercise is the LAST in its superset group, or not in any superset.
 */
export function shouldStartRestTimer(
  supersetGroups: SupersetGroup[],
  exerciseLocalId: string,
): boolean {
  for (const group of supersetGroups) {
    const idx = group.exerciseLocalIds.indexOf(exerciseLocalId);
    if (idx !== -1) {
      return idx === group.exerciseLocalIds.length - 1;
    }
  }
  return true;
}

/**
 * Create a superset group from exercise local IDs.
 * Returns null if fewer than 2 IDs are provided.
 */
export function createSupersetGroup(exerciseLocalIds: string[]): SupersetGroup | null {
  if (exerciseLocalIds.length < 2) return null;
  return {
    id: `superset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    exerciseLocalIds: [...exerciseLocalIds],
  };
}

/**
 * Remove a superset group by ID.
 */
export function removeSupersetGroup(groups: SupersetGroup[], groupId: string): SupersetGroup[] {
  return groups.filter((g) => g.id !== groupId);
}

/**
 * Get the next exercise ID in a superset, or null if last / not in a superset.
 */
export function getNextSupersetExercise(
  supersetGroups: SupersetGroup[],
  currentExerciseLocalId: string,
): string | null {
  for (const group of supersetGroups) {
    const idx = group.exerciseLocalIds.indexOf(currentExerciseLocalId);
    if (idx !== -1 && idx < group.exerciseLocalIds.length - 1) {
      return group.exerciseLocalIds[idx + 1];
    }
  }
  return null;
}
