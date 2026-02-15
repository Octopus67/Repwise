import * as fc from 'fast-check';
import { getRestDurationV2, getTimerColor } from '../../utils/restDurationV2';
import type { Exercise } from '../../types/exercise';

const NUM_RUNS = 100;

/**
 * Feature: training-log-redesign, Task 8.4
 * **Validates: Requirements 4.1, 4.4, 4.10**
 */

const exerciseDbArb: fc.Arbitrary<Exercise[]> = fc.array(
  fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    muscle_group: fc.string({ minLength: 1, maxLength: 30 }),
    equipment: fc.string({ minLength: 1, maxLength: 30 }),
    category: fc.constantFrom('compound' as const, 'isolation' as const),
    image_url: fc.constant(null),
  }),
  { minLength: 0, maxLength: 10 },
);

describe('Rest Duration V2 Property Tests', () => {
  /**
   * Property: Rest duration is always > 0
   * **Validates: Requirements 4.1, 4.10**
   */
  it('rest duration is always > 0', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        exerciseDbArb,
        fc.option(
          fc.record({
            compound_seconds: fc.integer({ min: 1, max: 600 }),
            isolation_seconds: fc.integer({ min: 1, max: 600 }),
          }),
          { nil: undefined },
        ),
        (name, db, prefs) => {
          const duration = getRestDurationV2(name, db, prefs);
          return duration > 0;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: Timer color is "green" for >10s, "yellow" for 5<s<=10, "red" for ≤5s
   * **Validates: Requirements 4.4**
   */
  it('timer color follows green/yellow/red thresholds', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -10, max: 600, noNaN: true }),
        (remaining) => {
          const color = getTimerColor(remaining);
          if (remaining > 10) return color === 'green';
          if (remaining > 5) return color === 'yellow';
          return color === 'red';
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Rest Duration V2 — specific value tests', () => {
  it('getTimerColor boundary: 11 → green', () => {
    expect(getTimerColor(11)).toBe('green');
  });

  it('getTimerColor boundary: 10 → yellow', () => {
    expect(getTimerColor(10)).toBe('yellow');
  });

  it('getTimerColor boundary: 5 → red', () => {
    expect(getTimerColor(5)).toBe('red');
  });

  it('getTimerColor boundary: 0 → red', () => {
    expect(getTimerColor(0)).toBe('red');
  });

  it('compound exercise defaults to 180s', () => {
    const db: Exercise[] = [
      { id: '1', name: 'Bench Press', muscle_group: 'chest', equipment: 'barbell', category: 'compound', image_url: null },
    ];
    expect(getRestDurationV2('Bench Press', db)).toBe(180);
  });

  it('isolation exercise defaults to 90s', () => {
    const db: Exercise[] = [
      { id: '1', name: 'Bicep Curl', muscle_group: 'biceps', equipment: 'dumbbell', category: 'isolation', image_url: null },
    ];
    expect(getRestDurationV2('Bicep Curl', db)).toBe(90);
  });

  it('unknown exercise defaults to compound (180s)', () => {
    expect(getRestDurationV2('Unknown Exercise', [])).toBe(180);
  });
});
