import * as fc from 'fast-check';
import {
  adjustTime,
  getTimerColor,
  resolveRestDuration,
} from '../../utils/restTimerLogic';

const NUM_RUNS = 100;

describe('Rest Timer Logic — Property Tests', () => {
  /**
   * Property 11: adjustTime(remaining, delta) always >= 0 for any remaining >= 0
   * **Validates: Requirements 8.3**
   */
  it('Property 11: adjustTime result is always >= 0', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 600, noNaN: true }),
        fc.float({ min: -600, max: 600, noNaN: true }),
        (remaining, delta) => {
          return adjustTime(remaining, delta) >= 0;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 11: adding positive delta increases remaining (when result > 0)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 600, noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: 600, noNaN: true }),
        (remaining, positiveDelta) => {
          return adjustTime(remaining, positiveDelta) >= remaining;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 12: getTimerColor returns correct color for all remaining/total combinations
   * green when remaining > total/2, yellow when remaining > 10 && remaining <= total/2, red when remaining <= 10
   * **Validates: Requirements 8.6**
   */
  it('Property 12: getTimerColor follows gradient rules', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 600, noNaN: true }),
        fc.float({ min: Math.fround(1), max: 600, noNaN: true }),
        (remaining, total) => {
          const clamped = Math.min(remaining, total);
          const color = getTimerColor(clamped, total);

          if (clamped <= 10) return color === 'red';
          if (clamped <= total / 2) return color === 'yellow';
          return color === 'green';
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 13: resolveRestDuration uses correct precedence (override > compound/isolation)
   * **Validates: Requirements 8.7, 17.5**
   */
  it('Property 13: per-exercise override takes precedence', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 30, max: 300 }),
        fc.integer({ min: 30, max: 300 }),
        fc.integer({ min: 30, max: 300 }),
        (name, overrideVal, compoundDef, isolationDef) => {
          const result = resolveRestDuration(
            name,
            { [name]: overrideVal },
            compoundDef,
            isolationDef,
            [{ name, category: 'compound' }],
          );
          return result === overrideVal;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 13: compound exercises use compound default when no override', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 30, max: 300 }),
        fc.integer({ min: 30, max: 300 }),
        (name, compoundDef, isolationDef) => {
          const result = resolveRestDuration(
            name,
            {},
            compoundDef,
            isolationDef,
            [{ name, category: 'compound' }],
          );
          return result === compoundDef;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 13: isolation exercises use isolation default when no override', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 30, max: 300 }),
        fc.integer({ min: 30, max: 300 }),
        (name, compoundDef, isolationDef) => {
          const result = resolveRestDuration(
            name,
            {},
            compoundDef,
            isolationDef,
            [{ name, category: 'isolation' }],
          );
          return result === isolationDef;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 13: unknown exercise falls back to isolation default', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 300 }),
        fc.integer({ min: 30, max: 300 }),
        (compoundDef, isolationDef) => {
          const result = resolveRestDuration(
            'UnknownExercise',
            {},
            compoundDef,
            isolationDef,
            [],
          );
          return result === isolationDef;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Rest Timer Logic — Unit Tests', () => {
  describe('adjustTime', () => {
    it('adds positive delta', () => {
      expect(adjustTime(60, 15)).toBe(75);
    });

    it('subtracts negative delta', () => {
      expect(adjustTime(60, -15)).toBe(45);
    });

    it('clamps to 0 when delta exceeds remaining', () => {
      expect(adjustTime(10, -20)).toBe(0);
    });

    it('returns 0 when remaining is 0 and delta is negative', () => {
      expect(adjustTime(0, -15)).toBe(0);
    });

    it('allows adding to 0 remaining', () => {
      expect(adjustTime(0, 15)).toBe(15);
    });
  });

  describe('getTimerColor', () => {
    it('returns green when remaining > total/2', () => {
      expect(getTimerColor(61, 120)).toBe('green');
    });

    it('returns yellow when remaining > 10 and <= total/2', () => {
      expect(getTimerColor(30, 120)).toBe('yellow');
    });

    it('returns red when remaining <= 10', () => {
      expect(getTimerColor(10, 120)).toBe('red');
      expect(getTimerColor(5, 120)).toBe('red');
      expect(getTimerColor(0, 120)).toBe('red');
    });

    it('returns green at exactly total/2 + 1', () => {
      // total=120, half=60, remaining=61 → green
      expect(getTimerColor(61, 120)).toBe('green');
    });

    it('returns yellow at exactly total/2', () => {
      // total=120, half=60, remaining=60 → 60 <= 60 and 60 > 10 → yellow
      expect(getTimerColor(60, 120)).toBe('yellow');
    });

    it('returns red at exactly 10', () => {
      expect(getTimerColor(10, 120)).toBe('red');
    });
  });

  describe('resolveRestDuration', () => {
    const db = [
      { name: 'Bench Press', category: 'compound' },
      { name: 'Bicep Curl', category: 'isolation' },
    ];

    it('uses per-exercise override when present', () => {
      expect(
        resolveRestDuration('Bench Press', { 'Bench Press': 180 }, 120, 60, db),
      ).toBe(180);
    });

    it('uses compound default for compound exercise without override', () => {
      expect(resolveRestDuration('Bench Press', {}, 120, 60, db)).toBe(120);
    });

    it('uses isolation default for isolation exercise without override', () => {
      expect(resolveRestDuration('Bicep Curl', {}, 120, 60, db)).toBe(60);
    });

    it('falls back to isolation default for unknown exercise', () => {
      expect(resolveRestDuration('Unknown Move', {}, 120, 60, db)).toBe(60);
    });
  });
});
