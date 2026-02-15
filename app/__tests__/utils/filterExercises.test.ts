import { filterExercises } from '../../utils/filterExercises';
import { Exercise } from '../../types/exercise';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeExercise(overrides: Partial<Exercise> & { name: string; muscle_group: string }): Exercise {
  return {
    id: overrides.id ?? overrides.name.toLowerCase().replace(/\s+/g, '-'),
    name: overrides.name,
    muscle_group: overrides.muscle_group,
    equipment: overrides.equipment ?? 'barbell',
    category: overrides.category ?? 'compound',
    image_url: overrides.image_url ?? null,
  };
}

const EXERCISES: Exercise[] = [
  makeExercise({ name: 'Bench Press', muscle_group: 'Chest' }),
  makeExercise({ name: 'Incline Dumbbell Press', muscle_group: 'Chest' }),
  makeExercise({ name: 'Squat', muscle_group: 'Legs' }),
  makeExercise({ name: 'Leg Press', muscle_group: 'Legs' }),
  makeExercise({ name: 'Deadlift', muscle_group: 'Back' }),
  makeExercise({ name: 'Barbell Row', muscle_group: 'Back' }),
  makeExercise({ name: 'Overhead Press', muscle_group: 'Shoulders' }),
  makeExercise({ name: 'Lateral Raise', muscle_group: 'Shoulders', category: 'isolation' }),
  makeExercise({ name: 'Bicep Curl', muscle_group: 'Arms', category: 'isolation' }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('filterExercises', () => {
  it('returns empty array when exercises list is empty', () => {
    expect(filterExercises([], '', null)).toEqual([]);
  });

  it('returns all exercises when no filters are applied', () => {
    const result = filterExercises(EXERCISES, '', null);
    expect(result).toHaveLength(EXERCISES.length);
  });

  it('filters by muscleGroup only', () => {
    const result = filterExercises(EXERCISES, '', 'Chest');
    expect(result).toHaveLength(2);
    expect(result.every((ex) => ex.muscle_group === 'Chest')).toBe(true);
  });

  it('filters by searchText only (case-insensitive)', () => {
    const result = filterExercises(EXERCISES, 'press', null);
    // Bench Press, Incline Dumbbell Press, Leg Press, Overhead Press
    expect(result).toHaveLength(4);
    result.forEach((ex) => {
      expect(ex.name.toLowerCase()).toContain('press');
    });
  });

  it('search is case-insensitive for mixed case input', () => {
    const result = filterExercises(EXERCISES, 'SQUAT', null);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Squat');
  });

  it('combines muscleGroup and searchText filters', () => {
    const result = filterExercises(EXERCISES, 'press', 'Chest');
    // Only Chest exercises containing "press": Bench Press, Incline Dumbbell Press
    expect(result).toHaveLength(2);
    result.forEach((ex) => {
      expect(ex.muscle_group).toBe('Chest');
      expect(ex.name.toLowerCase()).toContain('press');
    });
  });

  it('matches partial exercise names', () => {
    const result = filterExercises(EXERCISES, 'dead', null);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Deadlift');
  });

  it('returns empty when no exercises match', () => {
    const result = filterExercises(EXERCISES, 'zzzzz', null);
    expect(result).toEqual([]);
  });

  it('returns empty when muscleGroup matches but searchText does not', () => {
    const result = filterExercises(EXERCISES, 'zzzzz', 'Chest');
    expect(result).toEqual([]);
  });

  it('applies no muscleGroup filter when muscleGroup is null', () => {
    const result = filterExercises(EXERCISES, '', null);
    expect(result).toHaveLength(EXERCISES.length);
  });

  it('trims whitespace from searchText before matching', () => {
    const result = filterExercises(EXERCISES, '  squat  ', null);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Squat');
  });

  it('returns all when searchText is only whitespace', () => {
    const result = filterExercises(EXERCISES, '   ', null);
    expect(result).toHaveLength(EXERCISES.length);
  });
});
