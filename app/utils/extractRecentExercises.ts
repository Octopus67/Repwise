import { Exercise } from '../types/exercise';

export interface TrainingSession {
  exercises: { exercise_name: string }[];
}

export function extractRecentExercises(
  sessions: TrainingSession[],
  allExercises: Exercise[],
): Exercise[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const session of sessions) {
    for (const entry of session.exercises) {
      if (!seen.has(entry.exercise_name)) {
        seen.add(entry.exercise_name);
        names.push(entry.exercise_name);
        if (names.length >= 10) break;
      }
    }
    if (names.length >= 10) break;
  }

  const exerciseMap = new Map(allExercises.map((ex) => [ex.name, ex]));
  return names
    .map((name) => exerciseMap.get(name))
    .filter((ex): ex is Exercise => ex !== undefined);
}
