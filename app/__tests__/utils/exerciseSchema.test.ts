import { Exercise } from '../../types/exercise';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a fully-populated Exercise with all extended fields. */
function makeFullExercise(): Exercise {
  return {
    id: 'barbell-bench-press',
    name: 'Barbell Bench Press',
    muscle_group: 'chest',
    secondary_muscles: ['triceps', 'shoulders'],
    equipment: 'barbell',
    category: 'compound',
    image_url: 'https://cdn.example.com/bench.jpg',
    animation_url: 'https://cdn.example.com/bench.gif',
    description: 'A compound pressing movement targeting the chest.',
    instructions: ['Lie flat on bench', 'Grip bar wider than shoulders', 'Press up'],
    tips: ['Keep shoulder blades retracted', 'Drive feet into floor'],
  };
}

/** Creates an Exercise with only the original 6 fields plus safe defaults for new fields. */
function makeMinimalExercise(): Exercise {
  return {
    id: 'dumbbell-curl',
    name: 'Dumbbell Curl',
    muscle_group: 'biceps',
    secondary_muscles: [],
    equipment: 'dumbbell',
    category: 'isolation',
    image_url: null,
    animation_url: null,
    description: null,
    instructions: null,
    tips: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Exercise interface schema', () => {
  it('accepts all extended fields', () => {
    const ex = makeFullExercise();

    expect(ex.id).toBe('barbell-bench-press');
    expect(ex.name).toBe('Barbell Bench Press');
    expect(ex.muscle_group).toBe('chest');
    expect(ex.secondary_muscles).toEqual(['triceps', 'shoulders']);
    expect(ex.equipment).toBe('barbell');
    expect(ex.category).toBe('compound');
    expect(ex.image_url).toBe('https://cdn.example.com/bench.jpg');
    expect(ex.animation_url).toBe('https://cdn.example.com/bench.gif');
    expect(ex.description).toBe('A compound pressing movement targeting the chest.');
    expect(ex.instructions).toEqual(['Lie flat on bench', 'Grip bar wider than shoulders', 'Press up']);
    expect(ex.tips).toEqual(['Keep shoulder blades retracted', 'Drive feet into floor']);
  });

  it('accepts exercise with only original 6 fields plus defaults', () => {
    const ex = makeMinimalExercise();

    // Original 6 fields
    expect(ex.id).toBe('dumbbell-curl');
    expect(ex.name).toBe('Dumbbell Curl');
    expect(ex.muscle_group).toBe('biceps');
    expect(ex.equipment).toBe('dumbbell');
    expect(ex.category).toBe('isolation');
    expect(ex.image_url).toBeNull();

    // New fields with safe defaults
    expect(ex.secondary_muscles).toEqual([]);
    expect(ex.animation_url).toBeNull();
    expect(ex.description).toBeNull();
    expect(ex.instructions).toBeNull();
    expect(ex.tips).toBeNull();
  });

  it('accepts optional is_custom field', () => {
    const custom: Exercise = {
      ...makeMinimalExercise(),
      is_custom: true,
    };
    expect(custom.is_custom).toBe(true);

    const system = makeMinimalExercise();
    expect(system.is_custom).toBeUndefined();
  });
});
