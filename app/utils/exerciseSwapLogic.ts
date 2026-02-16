import { ActiveExercise } from '../types/training';

export function swapExerciseName(
  exercise: ActiveExercise,
  newName: string
): ActiveExercise {
  if (!newName.trim()) return exercise;
  return { ...exercise, exerciseName: newName };
}
