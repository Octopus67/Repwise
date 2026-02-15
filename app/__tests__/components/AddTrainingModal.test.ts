/**
 * Unit tests for AddTrainingModal validation logic.
 *
 * The validate() function is inlined here as a pure function extracted
 * from the modal component for testability.
 */

// ─── Types (mirroring modal types) ──────────────────────────────────────────

interface SetState {
  id: string;
  reps: string;
  weight: string;
  rpe: string;
}

interface ExerciseState {
  id: string;
  name: string;
  sets: SetState[];
}

// ─── Inlined validate() from AddTrainingModal ──────────────────────────────

function validate(exercises: ExerciseState[]): string | null {
  if (exercises.length === 0) return 'Add at least one exercise.';
  for (const ex of exercises) {
    if (!ex.name.trim()) return 'Every exercise needs a name.';
    if (ex.sets.length === 0) return `"${ex.name}" needs at least one set.`;
    for (const s of ex.sets) {
      if (s.reps === '' || s.weight === '') return `Fill in reps and weight for "${ex.name}".`;
    }
  }
  return null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSet(reps: string, weight: string, rpe = ''): SetState {
  return { id: '1', reps, weight, rpe };
}

function makeExercise(name: string, sets: SetState[]): ExerciseState {
  return { id: '1', name, sets };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AddTrainingModal validate()', () => {
  test('valid exercise with sets returns null', () => {
    const exercises = [
      makeExercise('Bench Press', [makeSet('8', '80'), makeSet('8', '80')]),
    ];
    expect(validate(exercises)).toBeNull();
  });

  test('empty exercise array returns error message', () => {
    expect(validate([])).toBe('Add at least one exercise.');
  });

  test('exercise with empty name returns error message', () => {
    const exercises = [makeExercise('', [makeSet('8', '80')])];
    expect(validate(exercises)).toBe('Every exercise needs a name.');
  });

  test('exercise with whitespace-only name returns error message', () => {
    const exercises = [makeExercise('   ', [makeSet('8', '80')])];
    expect(validate(exercises)).toBe('Every exercise needs a name.');
  });

  test('exercise with empty sets array returns error message', () => {
    const exercises = [makeExercise('Squat', [])];
    expect(validate(exercises)).toBe('"Squat" needs at least one set.');
  });

  test('set with missing reps returns error message', () => {
    const exercises = [makeExercise('Deadlift', [makeSet('', '100')])];
    expect(validate(exercises)).toBe('Fill in reps and weight for "Deadlift".');
  });

  test('set with missing weight returns error message', () => {
    const exercises = [makeExercise('Deadlift', [makeSet('5', '')])];
    expect(validate(exercises)).toBe('Fill in reps and weight for "Deadlift".');
  });

  test('multiple valid exercises all pass validation', () => {
    const exercises = [
      makeExercise('Bench Press', [makeSet('8', '80')]),
      makeExercise('Squat', [makeSet('5', '120'), makeSet('5', '120')]),
    ];
    expect(validate(exercises)).toBeNull();
  });
});
