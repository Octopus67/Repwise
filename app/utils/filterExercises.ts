import { Exercise } from '../types/exercise';

export function filterExercises(
  exercises: Exercise[],
  searchText: string,
  muscleGroup: string | null,
  equipment: string | null = null,
): Exercise[] {
  let result = exercises;

  if (muscleGroup) {
    result = result.filter((ex) => ex.muscle_group === muscleGroup);
  }

  if (equipment) {
    result = result.filter((ex) => ex.equipment.toLowerCase() === equipment.toLowerCase());
  }

  const trimmed = searchText.trim();
  if (trimmed) {
    const query = trimmed.toLowerCase();
    result = result.filter((ex) => ex.name.toLowerCase().includes(query));
  }

  return result;
}
