import * as fc from 'fast-check';
import {
  aggregateVolume,
  MuscleVolumeEntry,
} from '../../utils/volumeAggregator';
import type { ActiveExercise, ActiveSet, SetType } from '../../types/training';

const NUM_RUNS = 100;

// ─── Arbitraries ────────────────────────────────────────────────────────────

const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Abs',
];

const EXERCISES: Record<string, string> = {
  'Bench Press': 'Chest',
  'Incline Dumbbell Press': 'Chest',
  'Barbell Row': 'Back',
  'Pull-Up': 'Back',
  'Overhead Press': 'Shoulders',
  'Lateral Raise': 'Shoulders',
  'Barbell Curl': 'Biceps',
  'Tricep Pushdown': 'Triceps',
  Squat: 'Quads',
  'Leg Curl': 'Hamstrings',
  'Hip Thrust': 'Glutes',
  'Calf Raise': 'Calves',
  Crunch: 'Abs',
};

const EXERCISE_NAMES = Object.keys(EXERCISES);

const muscleVolumeEntryArb: fc.Arbitrary<MuscleVolumeEntry> = fc
  .record({
    muscleGroup: fc.constantFrom(...MUSCLE_GROUPS),
    currentSets: fc.integer({ min: 0, max: 30 }),
    mavLow: fc.integer({ min: 6, max: 12 }),
    mavHigh: fc.integer({ min: 14, max: 24 }),
  })
  .filter((e) => e.mavLow <= e.mavHigh);

/** Generate unique weekly data — one entry per muscle group */
const weeklyDataArb: fc.Arbitrary<MuscleVolumeEntry[]> = fc
  .subarray(MUSCLE_GROUPS, { minLength: 0, maxLength: MUSCLE_GROUPS.length })
  .chain((groups) =>
    fc.tuple(
      ...groups.map((mg) =>
        fc.record({
          muscleGroup: fc.constant(mg),
          currentSets: fc.integer({ min: 0, max: 30 }),
          mavLow: fc.integer({ min: 6, max: 12 }),
          mavHigh: fc.integer({ min: 14, max: 24 }),
        }),
      ),
    ),
  )
  .map((entries) => entries.filter((e) => e.mavLow <= e.mavHigh));

const setTypeArb: fc.Arbitrary<SetType> = fc.constantFrom(
  'normal',
  'warm-up',
  'drop-set',
  'amrap',
);

const activeSetArb: fc.Arbitrary<ActiveSet> = fc.record({
  localId: fc.uuid(),
  setNumber: fc.integer({ min: 1, max: 10 }),
  weight: fc.constantFrom('50', '60', '80', '100', ''),
  reps: fc.constantFrom('5', '8', '10', '12', ''),
  rpe: fc.constantFrom('7', '8', '9', ''),
  setType: setTypeArb,
  completed: fc.boolean(),
  completedAt: fc.constant(null),
});

const activeExerciseArb: fc.Arbitrary<ActiveExercise> = fc
  .record({
    localId: fc.uuid(),
    exerciseName: fc.constantFrom(...EXERCISE_NAMES),
    sets: fc.array(activeSetArb, { minLength: 1, maxLength: 6 }),
    notes: fc.constant(undefined),
    skipped: fc.constant(false),
  });

const activeExercisesArb: fc.Arbitrary<ActiveExercise[]> = fc.array(
  activeExerciseArb,
  { minLength: 0, maxLength: 8 },
);

// ─── Helper ─────────────────────────────────────────────────────────────────

/** Manually count completed normal sets per muscle group from active exercises */
function manualCountActiveSets(
  exercises: ActiveExercise[],
  muscleMap: Record<string, string>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ex of exercises) {
    const mg = muscleMap[ex.exerciseName];
    if (!mg) continue;
    const completedNormal = ex.sets.filter(
      (s) => s.completed && s.setType === 'normal',
    ).length;
    if (completedNormal > 0) {
      counts[mg] = (counts[mg] ?? 0) + completedNormal;
    }
  }
  return counts;
}

// ─── Property Tests ─────────────────────────────────────────────────────────

describe('Volume Aggregator — Property Tests', () => {
  /**
   * Property 9: Volume aggregation combines weekly and active sets correctly
   *
   * For any weekly volume data and any active workout state with completed sets,
   * the aggregated volume for each muscle group SHALL equal the API count plus
   * the number of completed normal sets in the active workout for exercises
   * mapping to that muscle group.
   *
   * **Validates: Requirements 5.1, 5.2, 5.3**
   */
  it('Property 9: aggregated count = API count + active completed normal sets per muscle group', () => {
    fc.assert(
      fc.property(
        weeklyDataArb,
        activeExercisesArb,
        (weeklyData, activeExercises) => {
          const result = aggregateVolume(weeklyData, activeExercises, EXERCISES);

          const activeCounts = manualCountActiveSets(activeExercises, EXERCISES);
          const resultMap = new Map(result.map((e) => [e.muscleGroup, e]));

          // Check every muscle group from API data
          for (const apiEntry of weeklyData) {
            const entry = resultMap.get(apiEntry.muscleGroup);
            if (!entry) return false;
            const expected =
              apiEntry.currentSets + (activeCounts[apiEntry.muscleGroup] ?? 0);
            if (entry.currentSets !== expected) return false;
          }

          // Check muscle groups that only appear from active exercises
          for (const [mg, count] of Object.entries(activeCounts)) {
            const inApi = weeklyData.some((e) => e.muscleGroup === mg);
            if (!inApi) {
              const entry = resultMap.get(mg);
              if (!entry) return false;
              if (entry.currentSets !== count) return false;
            }
          }

          return true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 9: result preserves MAV values from API data', () => {
    fc.assert(
      fc.property(
        weeklyDataArb,
        activeExercisesArb,
        (weeklyData, activeExercises) => {
          const result = aggregateVolume(weeklyData, activeExercises, EXERCISES);
          const resultMap = new Map(result.map((e) => [e.muscleGroup, e]));

          for (const apiEntry of weeklyData) {
            const entry = resultMap.get(apiEntry.muscleGroup);
            if (!entry) return false;
            if (entry.mavLow !== apiEntry.mavLow) return false;
            if (entry.mavHigh !== apiEntry.mavHigh) return false;
          }
          return true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 9: empty active exercises returns API data unchanged', () => {
    fc.assert(
      fc.property(weeklyDataArb, (weeklyData) => {
        const result = aggregateVolume(weeklyData, [], EXERCISES);
        if (result.length !== weeklyData.length) return false;
        for (const apiEntry of weeklyData) {
          const entry = result.find(
            (e) => e.muscleGroup === apiEntry.muscleGroup,
          );
          if (!entry) return false;
          if (entry.currentSets !== apiEntry.currentSets) return false;
        }
        return true;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 9: warm-up and drop-set sets are not counted', () => {
    fc.assert(
      fc.property(weeklyDataArb, (weeklyData) => {
        // Create exercises with only warm-up and drop-set completed sets
        const exercises: ActiveExercise[] = [
          {
            localId: 'ex-1',
            exerciseName: 'Bench Press',
            sets: [
              {
                localId: 's1',
                setNumber: 1,
                weight: '60',
                reps: '10',
                rpe: '',
                setType: 'warm-up',
                completed: true,
                completedAt: null,
              },
              {
                localId: 's2',
                setNumber: 2,
                weight: '80',
                reps: '5',
                rpe: '',
                setType: 'drop-set',
                completed: true,
                completedAt: null,
              },
            ],
          },
        ];

        const result = aggregateVolume(exercises, exercises, EXERCISES);
        // Wait — first arg is weeklyData, not exercises. Let me fix:
        const resultCorrect = aggregateVolume(weeklyData, exercises, EXERCISES);

        // Chest count should equal API count (no normal sets completed)
        const chestApi = weeklyData.find((e) => e.muscleGroup === 'Chest');
        const chestResult = resultCorrect.find(
          (e) => e.muscleGroup === 'Chest',
        );

        if (chestApi && chestResult) {
          return chestResult.currentSets === chestApi.currentSets;
        }
        // If Chest not in API data, it shouldn't appear in result either
        // (no normal completed sets to add)
        return !chestResult;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 9: exercises not in muscle group map are ignored', () => {
    fc.assert(
      fc.property(weeklyDataArb, (weeklyData) => {
        const unknownExercises: ActiveExercise[] = [
          {
            localId: 'ex-unknown',
            exerciseName: 'Unknown Exercise XYZ',
            sets: [
              {
                localId: 's1',
                setNumber: 1,
                weight: '100',
                reps: '10',
                rpe: '',
                setType: 'normal',
                completed: true,
                completedAt: null,
              },
            ],
          },
        ];

        const result = aggregateVolume(
          weeklyData,
          unknownExercises,
          EXERCISES,
        );
        // Result should match API data exactly — unknown exercise ignored
        if (result.length !== weeklyData.length) return false;
        for (const apiEntry of weeklyData) {
          const entry = result.find(
            (e) => e.muscleGroup === apiEntry.muscleGroup,
          );
          if (!entry) return false;
          if (entry.currentSets !== apiEntry.currentSets) return false;
        }
        return true;
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 9: new muscle groups from active exercises get mavLow=0, mavHigh=0', () => {
    fc.assert(
      fc.property(activeExercisesArb, (activeExercises) => {
        // Empty API data — all muscle groups come from active exercises
        const result = aggregateVolume([], activeExercises, EXERCISES);

        for (const entry of result) {
          if (entry.mavLow !== 0 || entry.mavHigh !== 0) return false;
        }
        return true;
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ─── Unit Tests ─────────────────────────────────────────────────────────────

describe('Volume Aggregator — Unit Tests', () => {
  it('empty inputs → empty result', () => {
    const result = aggregateVolume([], [], EXERCISES);
    expect(result).toEqual([]);
  });

  it('API data only, no active exercises → returns API data as-is', () => {
    const apiData: MuscleVolumeEntry[] = [
      { muscleGroup: 'Chest', currentSets: 8, mavLow: 10, mavHigh: 18 },
      { muscleGroup: 'Back', currentSets: 12, mavLow: 12, mavHigh: 20 },
    ];
    const result = aggregateVolume(apiData, [], EXERCISES);
    expect(result).toEqual(apiData);
  });

  it('active exercises add completed normal sets to API counts', () => {
    const apiData: MuscleVolumeEntry[] = [
      { muscleGroup: 'Chest', currentSets: 6, mavLow: 10, mavHigh: 18 },
    ];
    const exercises: ActiveExercise[] = [
      {
        localId: 'ex-1',
        exerciseName: 'Bench Press',
        sets: [
          {
            localId: 's1',
            setNumber: 1,
            weight: '80',
            reps: '8',
            rpe: '8',
            setType: 'normal',
            completed: true,
            completedAt: '2024-01-01T10:00:00Z',
          },
          {
            localId: 's2',
            setNumber: 2,
            weight: '80',
            reps: '8',
            rpe: '8',
            setType: 'normal',
            completed: true,
            completedAt: '2024-01-01T10:05:00Z',
          },
          {
            localId: 's3',
            setNumber: 3,
            weight: '80',
            reps: '8',
            rpe: '',
            setType: 'normal',
            completed: false,
            completedAt: null,
          },
        ],
      },
    ];
    const result = aggregateVolume(apiData, exercises, EXERCISES);
    const chest = result.find((e) => e.muscleGroup === 'Chest');
    expect(chest).toBeDefined();
    expect(chest!.currentSets).toBe(8); // 6 API + 2 completed normal
    expect(chest!.mavLow).toBe(10);
    expect(chest!.mavHigh).toBe(18);
  });

  it('multiple exercises for same muscle group are summed', () => {
    const apiData: MuscleVolumeEntry[] = [
      { muscleGroup: 'Chest', currentSets: 4, mavLow: 10, mavHigh: 18 },
    ];
    const exercises: ActiveExercise[] = [
      {
        localId: 'ex-1',
        exerciseName: 'Bench Press',
        sets: [
          {
            localId: 's1',
            setNumber: 1,
            weight: '80',
            reps: '8',
            rpe: '',
            setType: 'normal',
            completed: true,
            completedAt: null,
          },
        ],
      },
      {
        localId: 'ex-2',
        exerciseName: 'Incline Dumbbell Press',
        sets: [
          {
            localId: 's2',
            setNumber: 1,
            weight: '30',
            reps: '10',
            rpe: '',
            setType: 'normal',
            completed: true,
            completedAt: null,
          },
          {
            localId: 's3',
            setNumber: 2,
            weight: '30',
            reps: '10',
            rpe: '',
            setType: 'normal',
            completed: true,
            completedAt: null,
          },
        ],
      },
    ];
    const result = aggregateVolume(apiData, exercises, EXERCISES);
    const chest = result.find((e) => e.muscleGroup === 'Chest');
    expect(chest!.currentSets).toBe(7); // 4 API + 1 bench + 2 incline
  });

  it('uncompleted sets are not counted', () => {
    const apiData: MuscleVolumeEntry[] = [
      { muscleGroup: 'Back', currentSets: 10, mavLow: 12, mavHigh: 20 },
    ];
    const exercises: ActiveExercise[] = [
      {
        localId: 'ex-1',
        exerciseName: 'Barbell Row',
        sets: [
          {
            localId: 's1',
            setNumber: 1,
            weight: '70',
            reps: '8',
            rpe: '',
            setType: 'normal',
            completed: false,
            completedAt: null,
          },
          {
            localId: 's2',
            setNumber: 2,
            weight: '70',
            reps: '8',
            rpe: '',
            setType: 'normal',
            completed: false,
            completedAt: null,
          },
        ],
      },
    ];
    const result = aggregateVolume(apiData, exercises, EXERCISES);
    const back = result.find((e) => e.muscleGroup === 'Back');
    expect(back!.currentSets).toBe(10); // unchanged
  });
});
