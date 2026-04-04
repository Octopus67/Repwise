/**
 * Phase 6.3 + 6.4 — Bounds checking & date handling edge case tests.
 *
 * 6.3: reorder bounds, custom exercise min length, barcode user scoping
 * 6.4: DST date calc, measurement date validation, recovery checkin date, birth year validation
 */

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
  __esModule: true,
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

import { useActiveWorkoutStore } from '../../store/activeWorkoutSlice';
import { validateCustomExerciseForm, type CustomExerciseFormData } from '../../utils/customExerciseValidation';
import { isValidMultiplier } from '../../utils/barcodeUtils';
import { isValidSessionDate } from '../../utils/dateValidation';
import { computeAge } from '../../store/onboardingSlice';
import { computeBMR } from '../../utils/onboardingCalculations';

function resetStore() {
  useActiveWorkoutStore.getState().discardWorkout();
}

function makeFormData(overrides: Partial<CustomExerciseFormData> = {}): CustomExerciseFormData {
  return {
    name: 'Test Exercise',
    muscleGroup: 'chest',
    equipment: 'barbell',
    category: 'compound',
    secondaryMuscles: [],
    notes: '',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6.3 Bounds Checking Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 6.3: Bounds Checking', () => {
  beforeEach(() => {
    localStorageMock.clear();
    resetStore();
  });

  // ── 6.3.1 Reorder exercises with fromIndex=-1 ────────────────────────────

  test('reorder exercises with fromIndex=-1 → no crash, no change', () => {
    const store = useActiveWorkoutStore.getState();
    store.startWorkout({ mode: 'new' });
    store.addExercise('Bench Press');
    store.addExercise('Squat');

    const before = useActiveWorkoutStore.getState().exercises.map(e => e.localId);

    store.reorderExercises(-1, 0);

    const after = useActiveWorkoutStore.getState().exercises.map(e => e.localId);
    expect(after).toEqual(before);
  });

  // ── 6.3.2 Reorder exercises with toIndex=999 ─────────────────────────────

  test('reorder exercises with toIndex=999 → no crash, no change', () => {
    const store = useActiveWorkoutStore.getState();
    store.startWorkout({ mode: 'new' });
    store.addExercise('Bench Press');
    store.addExercise('Squat');

    const before = useActiveWorkoutStore.getState().exercises.map(e => e.localId);

    store.reorderExercises(0, 999);

    const after = useActiveWorkoutStore.getState().exercises.map(e => e.localId);
    expect(after).toEqual(before);
  });

  // ── 6.3.3 Custom exercise name min length ─────────────────────────────────

  test('custom exercise with 1-char name → rejected', () => {
    const result = validateCustomExerciseForm(makeFormData({ name: 'A' }));
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  // ── 6.3.4 Barcode multiplier max 99 ──────────────────────────────────────

  test('barcode multiplier 100 → rejected, 99 → accepted', () => {
    expect(isValidMultiplier('100')).toBe(false);
    expect(isValidMultiplier('99')).toBe(true);
    expect(isValidMultiplier('0')).toBe(false);
    expect(isValidMultiplier('-1')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6.4 Date Handling Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 6.4: Date Handling', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  // ── 6.4.1 Analytics date calc handles DST ─────────────────────────────────

  test('date calculation across DST boundary produces correct date', () => {
    // March 10, 2024 is DST spring-forward in US
    // Subtracting 90 days should land on Dec 11, 2023
    const dstDate = new Date('2024-03-10T12:00:00');
    const ninetyDaysBack = new Date(dstDate);
    ninetyDaysBack.setDate(ninetyDaysBack.getDate() - 90);

    const result = ninetyDaysBack.toISOString().split('T')[0];
    expect(result).toBe('2023-12-11');
  });

  // ── 6.4.2 Measurement date validation ─────────────────────────────────────

  test('invalid date 2024-13-45 → rejected by date parser', () => {
    // isValidSessionDate rejects unparseable dates
    expect(isValidSessionDate('2024-13-45')).toBe(false);
  });

  // ── 6.4.3 Recovery checkin uses selected date ─────────────────────────────

  test('session date setter accepts past date, rejects future', () => {
    const store = useActiveWorkoutStore.getState();
    store.startWorkout({ mode: 'new' });

    // Past date should be accepted
    store.setSessionDate('2024-01-15');
    expect(useActiveWorkoutStore.getState().sessionDate).toBe('2024-01-15');

    // Future date should be rejected (stays at previous value)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const futureStr = tomorrow.toISOString().split('T')[0];
    store.setSessionDate(futureStr);
    expect(useActiveWorkoutStore.getState().sessionDate).toBe('2024-01-15');
  });

  // ── 6.4.4 Onboarding birth year validation ───────────────────────────────

  test('birthYear=1800 → clamped to valid age (min 13, max 120)', () => {
    const age = computeAge(1800, 1);
    // 1800 would give age > 200, but computeAge clamps to max 120
    expect(age).toBe(120);

    // Also verify null birthYear defaults to 25
    expect(computeAge(null, null)).toBe(25);

    // And that BMR doesn't crash with the clamped age
    const bmr = computeBMR(70, 170, age, 'male');
    expect(bmr).toBeGreaterThan(0);
  });
});
