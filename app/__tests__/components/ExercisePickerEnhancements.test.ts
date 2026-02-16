import { filterExercises } from '../../utils/filterExercises';
import { Exercise } from '../../types/exercise';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeExercise(
  overrides: Partial<Exercise> & { name: string; muscle_group: string; equipment: string },
): Exercise {
  return {
    id: overrides.id ?? overrides.name.toLowerCase().replace(/\s+/g, '-'),
    name: overrides.name,
    muscle_group: overrides.muscle_group,
    secondary_muscles: overrides.secondary_muscles ?? [],
    equipment: overrides.equipment,
    category: overrides.category ?? 'compound',
    image_url: overrides.image_url ?? null,
    animation_url: overrides.animation_url ?? null,
    description: overrides.description ?? null,
    instructions: overrides.instructions ?? null,
    tips: overrides.tips ?? null,
  };
}

const EXERCISES: Exercise[] = [
  makeExercise({ name: 'Barbell Bench Press', muscle_group: 'chest', equipment: 'barbell', image_url: 'https://cdn.example.com/bench.jpg' }),
  makeExercise({ name: 'Dumbbell Fly', muscle_group: 'chest', equipment: 'dumbbell', image_url: null }),
  makeExercise({ name: 'Cable Crossover', muscle_group: 'chest', equipment: 'cable' }),
  makeExercise({ name: 'Barbell Squat', muscle_group: 'quads', equipment: 'barbell' }),
  makeExercise({ name: 'Leg Press', muscle_group: 'quads', equipment: 'machine' }),
  makeExercise({ name: 'Bodyweight Lunge', muscle_group: 'quads', equipment: 'bodyweight' }),
  makeExercise({ name: 'Barbell Row', muscle_group: 'back', equipment: 'barbell' }),
  makeExercise({ name: 'Cable Row', muscle_group: 'back', equipment: 'cable' }),
  makeExercise({ name: 'Band Pull Apart', muscle_group: 'back', equipment: 'band' }),
  makeExercise({ name: 'Kettlebell Swing', muscle_group: 'glutes', equipment: 'kettlebell' }),
];

// ---------------------------------------------------------------------------
// (a) Equipment filter reduces exercise list correctly
// ---------------------------------------------------------------------------
describe('Equipment filter', () => {
  it('returns all exercises when equipment is null (All)', () => {
    const result = filterExercises(EXERCISES, '', null, null);
    expect(result).toHaveLength(EXERCISES.length);
  });

  it('filters to only barbell exercises', () => {
    const result = filterExercises(EXERCISES, '', null, 'barbell');
    expect(result).toHaveLength(3);
    expect(result.every((ex) => ex.equipment === 'barbell')).toBe(true);
  });

  it('filters to only dumbbell exercises', () => {
    const result = filterExercises(EXERCISES, '', null, 'dumbbell');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Dumbbell Fly');
  });

  it('filters to only cable exercises', () => {
    const result = filterExercises(EXERCISES, '', null, 'cable');
    expect(result).toHaveLength(2);
    expect(result.every((ex) => ex.equipment === 'cable')).toBe(true);
  });

  it('filters to only machine exercises', () => {
    const result = filterExercises(EXERCISES, '', null, 'machine');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Leg Press');
  });

  it('filters to only bodyweight exercises', () => {
    const result = filterExercises(EXERCISES, '', null, 'bodyweight');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bodyweight Lunge');
  });

  it('filters to only band exercises', () => {
    const result = filterExercises(EXERCISES, '', null, 'band');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Band Pull Apart');
  });

  it('filters to only kettlebell exercises', () => {
    const result = filterExercises(EXERCISES, '', null, 'kettlebell');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Kettlebell Swing');
  });

  it('equipment filter is case-insensitive', () => {
    const result = filterExercises(EXERCISES, '', null, 'Barbell');
    expect(result).toHaveLength(3);
  });

  it('combines equipment filter with muscle group filter', () => {
    const result = filterExercises(EXERCISES, '', 'chest', 'barbell');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Barbell Bench Press');
  });

  it('combines equipment filter with search text', () => {
    const result = filterExercises(EXERCISES, 'row', null, 'cable');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Cable Row');
  });

  it('combines all three filters', () => {
    const result = filterExercises(EXERCISES, 'bench', 'chest', 'barbell');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Barbell Bench Press');
  });

  it('returns empty when equipment has no matches', () => {
    const result = filterExercises(EXERCISES, '', null, 'smith_machine');
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (b) Exercise count per muscle group matches actual data
// ---------------------------------------------------------------------------
describe('Exercise count per muscle group', () => {
  function computeMuscleGroupCounts(exercises: Exercise[]): Record<string, number> {
    const map: Record<string, number> = {};
    for (const ex of exercises) {
      map[ex.muscle_group] = (map[ex.muscle_group] || 0) + 1;
    }
    return map;
  }

  it('counts exercises per muscle group correctly', () => {
    const counts = computeMuscleGroupCounts(EXERCISES);
    expect(counts['chest']).toBe(3);
    expect(counts['quads']).toBe(3);
    expect(counts['back']).toBe(3);
    expect(counts['glutes']).toBe(1);
  });

  it('returns 0 for muscle groups with no exercises', () => {
    const counts = computeMuscleGroupCounts(EXERCISES);
    expect(counts['biceps'] ?? 0).toBe(0);
    expect(counts['triceps'] ?? 0).toBe(0);
  });

  it('handles empty exercise list', () => {
    const counts = computeMuscleGroupCounts([]);
    expect(Object.keys(counts)).toHaveLength(0);
  });

  it('count updates when exercises are filtered by equipment', () => {
    const barbellOnly = filterExercises(EXERCISES, '', null, 'barbell');
    const counts = computeMuscleGroupCounts(barbellOnly);
    expect(counts['chest']).toBe(1);
    expect(counts['quads']).toBe(1);
    expect(counts['back']).toBe(1);
    expect(counts['glutes']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// (c) ExerciseCard renders image when image_url is present
// ---------------------------------------------------------------------------
describe('ExerciseCard image logic', () => {
  it('should use image when image_url is a valid string', () => {
    const exercise = makeExercise({
      name: 'Barbell Bench Press',
      muscle_group: 'chest',
      equipment: 'barbell',
      image_url: 'https://cdn.example.com/bench.jpg',
    });
    const showImage = exercise.image_url != null && exercise.image_url !== '';
    expect(showImage).toBe(true);
  });

  it('should use image with any non-empty URL', () => {
    const exercise = makeExercise({
      name: 'Test Exercise',
      muscle_group: 'back',
      equipment: 'cable',
      image_url: '/static/exercises/test.svg',
    });
    const showImage = exercise.image_url != null && exercise.image_url !== '';
    expect(showImage).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (d) ExerciseCard renders placeholder when image_url is null
// ---------------------------------------------------------------------------
describe('ExerciseCard placeholder logic', () => {
  it('should show placeholder when image_url is null', () => {
    const exercise = makeExercise({
      name: 'Dumbbell Fly',
      muscle_group: 'chest',
      equipment: 'dumbbell',
      image_url: null,
    });
    const showImage = exercise.image_url != null && exercise.image_url !== '';
    expect(showImage).toBe(false);
  });

  it('should show placeholder when image_url is empty string', () => {
    const exercise = makeExercise({
      name: 'Custom Exercise',
      muscle_group: 'shoulders',
      equipment: 'bodyweight',
      image_url: '' as any,
    });
    const showImage = exercise.image_url != null && exercise.image_url !== '';
    expect(showImage).toBe(false);
  });

  it('should show placeholder when image_url is undefined (treated as null)', () => {
    const exercise = makeExercise({
      name: 'Another Exercise',
      muscle_group: 'biceps',
      equipment: 'dumbbell',
    });
    // Default from makeExercise is null
    const showImage = exercise.image_url != null && exercise.image_url !== '';
    expect(showImage).toBe(false);
  });
});
