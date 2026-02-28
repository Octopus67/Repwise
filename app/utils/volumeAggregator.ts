import type { ActiveExercise } from '../types/training';

export interface MuscleVolumeEntry {
  muscleGroup: string;
  currentSets: number;
  mavLow: number;
  mavHigh: number;
}

/**
 * Aggregates weekly muscle group volume by combining API weekly data
 * with completed normal sets from the active workout.
 *
 * Requirements: 5.1, 5.2, 5.3
 */
export function aggregateVolume(
  weeklyApiData: MuscleVolumeEntry[],
  activeExercises: ActiveExercise[],
  exerciseMuscleGroupMap: Record<string, string>,
): MuscleVolumeEntry[] {
  // Clone API data as the base
  const volumeMap = new Map<string, MuscleVolumeEntry>();
  for (const entry of weeklyApiData) {
    volumeMap.set(entry.muscleGroup, { ...entry });
  }

  // Count completed normal sets per muscle group from active exercises
  for (const exercise of activeExercises) {
    const muscleGroup = exerciseMuscleGroupMap[exercise.exerciseName];
    if (!muscleGroup) continue;

    const completedNormalSets = exercise.sets.filter(
      (s) => s.completed && s.setType === 'normal',
    ).length;

    if (completedNormalSets === 0) continue;

    const existing = volumeMap.get(muscleGroup);
    if (existing) {
      existing.currentSets += completedNormalSets;
    } else {
      // Muscle group not in API data — create entry with 0 MAV (unknown)
      volumeMap.set(muscleGroup, {
        muscleGroup,
        currentSets: completedNormalSets,
        mavLow: 0,
        mavHigh: 0,
      });
    }
  }

  return Array.from(volumeMap.values());
}
