/**
 * Determine rest duration for an exercise based on compound/isolation classification
 * and user preferences.
 *
 * Mirrors the backend COMPOUND_EXERCISES set from exercise_mapping.py.
 */

export const COMPOUND_EXERCISES: Set<string> = new Set([
  'bench press',
  'barbell bench press',
  'dumbbell bench press',
  'incline barbell bench press',
  'incline dumbbell bench press',
  'decline barbell bench press',
  'squat',
  'barbell back squat',
  'barbell front squat',
  'goblet squat',
  'deadlift',
  'conventional deadlift',
  'sumo deadlift',
  'overhead press',
  'dumbbell shoulder press',
  'arnold press',
  'push press',
  'barbell row',
  'dumbbell row',
  'pendlay row',
  't-bar row',
  'leg press',
  'hack squat',
  'pull-ups',
  'pull up',
  'chin-ups',
  'chest dips',
  'tricep dips',
  'romanian deadlift',
  'barbell hip thrust',
  'bulgarian split squat',
  'good morning',
  'floor press',
  'close-grip bench press',
  'lat pulldown',
  'seated cable row',
  'rack pull',
  'landmine press',
  'walking lunge',
  'barbell lunge',
  'dip',
]);

const DEFAULT_COMPOUND_SECONDS = 180;
const DEFAULT_ISOLATION_SECONDS = 90;

export interface RestTimerPreferences {
  compound_seconds?: number;
  isolation_seconds?: number;
}

/**
 * Returns the rest duration in seconds for a given exercise.
 *
 * - Compound exercises: preferences.compound_seconds ?? 180
 * - Isolation exercises: preferences.isolation_seconds ?? 90
 */
export function getRestDuration(
  exerciseName: string,
  preferences: RestTimerPreferences | undefined,
): number {
  const isCompound = COMPOUND_EXERCISES.has(exerciseName.toLowerCase().trim());

  if (isCompound) {
    return preferences?.compound_seconds ?? DEFAULT_COMPOUND_SECONDS;
  }
  return preferences?.isolation_seconds ?? DEFAULT_ISOLATION_SECONDS;
}
