import {
  extractRecentExercises,
  TrainingSession,
} from '../../utils/extractRecentExercises';
import { Exercise } from '../../types/exercise';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeExercise(name: string, muscleGroup = 'General'): Exercise {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    muscle_group: muscleGroup,
    secondary_muscles: [],
    equipment: 'barbell',
    category: 'compound',
    image_url: null,
    animation_url: null,
    description: null,
    instructions: null,
    tips: null,
  };
}

function makeSession(exerciseNames: string[]): TrainingSession {
  return {
    exercises: exerciseNames.map((name) => ({ exercise_name: name })),
  };
}

const ALL_EXERCISES: Exercise[] = [
  makeExercise('Bench Press', 'Chest'),
  makeExercise('Squat', 'Legs'),
  makeExercise('Deadlift', 'Back'),
  makeExercise('Overhead Press', 'Shoulders'),
  makeExercise('Barbell Row', 'Back'),
  makeExercise('Leg Press', 'Legs'),
  makeExercise('Bicep Curl', 'Arms'),
  makeExercise('Tricep Extension', 'Arms'),
  makeExercise('Lateral Raise', 'Shoulders'),
  makeExercise('Pull Up', 'Back'),
  makeExercise('Dip', 'Chest'),
  makeExercise('Lunge', 'Legs'),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('extractRecentExercises', () => {
  it('returns empty array when sessions list is empty', () => {
    expect(extractRecentExercises([], ALL_EXERCISES)).toEqual([]);
  });

  it('returns exercises from a single session', () => {
    const sessions = [makeSession(['Bench Press', 'Squat'])];
    const result = extractRecentExercises(sessions, ALL_EXERCISES);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Bench Press');
    expect(result[1].name).toBe('Squat');
  });

  it('deduplicates exercise names across multiple sessions', () => {
    const sessions = [
      makeSession(['Bench Press', 'Squat']),
      makeSession(['Squat', 'Deadlift']),
    ];
    const result = extractRecentExercises(sessions, ALL_EXERCISES);
    // Bench Press, Squat, Deadlift — Squat not duplicated
    expect(result).toHaveLength(3);
    const names = result.map((ex) => ex.name);
    expect(names).toEqual(['Bench Press', 'Squat', 'Deadlift']);
  });

  it('caps at 10 unique exercises', () => {
    const sessions = [
      makeSession([
        'Bench Press', 'Squat', 'Deadlift', 'Overhead Press',
        'Barbell Row', 'Leg Press', 'Bicep Curl', 'Tricep Extension',
        'Lateral Raise', 'Pull Up', 'Dip', 'Lunge',
      ]),
    ];
    const result = extractRecentExercises(sessions, ALL_EXERCISES);
    expect(result).toHaveLength(10);
  });

  it('caps at 10 across multiple sessions', () => {
    const sessions = [
      makeSession(['Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Barbell Row']),
      makeSession(['Leg Press', 'Bicep Curl', 'Tricep Extension', 'Lateral Raise', 'Pull Up']),
      makeSession(['Dip', 'Lunge']), // these should be excluded
    ];
    const result = extractRecentExercises(sessions, ALL_EXERCISES);
    expect(result).toHaveLength(10);
    // Dip and Lunge should NOT be in the result
    const names = result.map((ex) => ex.name);
    expect(names).not.toContain('Dip');
    expect(names).not.toContain('Lunge');
  });

  it('handles sessions with empty exercises array', () => {
    const sessions = [
      makeSession([]),
      makeSession(['Bench Press']),
      makeSession([]),
    ];
    const result = extractRecentExercises(sessions, ALL_EXERCISES);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bench Press');
  });

  it('excludes exercise names not found in allExercises', () => {
    const sessions = [
      makeSession(['Bench Press', 'Unknown Exercise', 'Squat']),
    ];
    const result = extractRecentExercises(sessions, ALL_EXERCISES);
    // "Unknown Exercise" is not in ALL_EXERCISES, so it's filtered out
    expect(result).toHaveLength(2);
    expect(result.map((ex) => ex.name)).toEqual(['Bench Press', 'Squat']);
  });

  it('preserves order: most recent session exercises come first', () => {
    const sessions = [
      makeSession(['Overhead Press', 'Deadlift']),  // most recent
      makeSession(['Bench Press', 'Squat']),          // older
    ];
    const result = extractRecentExercises(sessions, ALL_EXERCISES);
    const names = result.map((ex) => ex.name);
    expect(names).toEqual(['Overhead Press', 'Deadlift', 'Bench Press', 'Squat']);
  });

  it('returns full Exercise objects, not just names', () => {
    const sessions = [makeSession(['Bench Press'])];
    const result = extractRecentExercises(sessions, ALL_EXERCISES);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'bench-press',
        name: 'Bench Press',
        muscle_group: 'Chest',
        equipment: 'barbell',
        category: 'compound',
      }),
    );
  });

  it('returns empty when all session exercises are unknown', () => {
    const sessions = [makeSession(['Foo', 'Bar', 'Baz'])];
    const result = extractRecentExercises(sessions, ALL_EXERCISES);
    expect(result).toEqual([]);
  });

  it('counts unknown exercises toward the 10-cap in name collection', () => {
    // 9 unknown + 2 known = names array has 11 entries but caps at 10
    // so only the first known within the first 10 names survives
    const unknowns = Array.from({ length: 9 }, (_, i) => `Unknown${i}`);
    const sessions = [makeSession([...unknowns, 'Bench Press', 'Squat'])];
    const result = extractRecentExercises(sessions, ALL_EXERCISES);
    // names collected: 9 unknowns + Bench Press = 10 (cap hit), Squat excluded
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bench Press');
  });
});
