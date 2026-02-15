import * as fc from 'fast-check';
import {
  RDA_TABLE,
  getAgeBracket,
  getRDA,
  computeRDAPercentage,
  rdaColor,
} from '../../utils/rdaValues';

// Feature: competitive-parity-v1, Property 23: RDA percentage computation and color coding
// Validates: Requirements 11.2.2, 11.2.3

const nutrientKeys = Object.keys(RDA_TABLE);
const sexes = ['male', 'female'] as const;

describe('Property 23: RDA percentage computation and color coding', () => {
  const nutrientKeyArb = fc.constantFrom(...nutrientKeys);
  const sexArb = fc.constantFrom(...sexes);
  const ageArb = fc.integer({ min: 19, max: 99 });

  it('getRDA returns >= 0 for any nutrient/sex/age combo', () => {
    fc.assert(
      fc.property(nutrientKeyArb, sexArb, ageArb, (key, sex, age) => {
        const rda = getRDA(key, sex, age);
        expect(rda).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });

  it('computeRDAPercentage(rda, rda) returns 100% when rda > 0', () => {
    fc.assert(
      fc.property(nutrientKeyArb, sexArb, ageArb, (key, sex, age) => {
        const rda = getRDA(key, sex, age);
        if (rda > 0) {
          const pct = computeRDAPercentage(rda, rda);
          expect(pct).toBeCloseTo(100, 5);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('computeRDAPercentage returns 0 when rda <= 0', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.double({ min: -100, max: 0, noNaN: true }),
        (intake, rda) => {
          expect(computeRDAPercentage(intake, rda)).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rdaColor thresholds: green >= 80, yellow 50-79, red < 50', () => {
    // Exact boundary tests
    expect(rdaColor(100)).toBe('green');
    expect(rdaColor(80)).toBe('green');
    expect(rdaColor(79.99)).toBe('yellow');
    expect(rdaColor(50)).toBe('yellow');
    expect(rdaColor(49.99)).toBe('red');
    expect(rdaColor(49)).toBe('red');
    expect(rdaColor(0)).toBe('red');
  });

  it('rdaColor is consistent for any percentage >= 0', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 500, noNaN: true }), (pct) => {
        const color = rdaColor(pct);
        if (pct >= 80) expect(color).toBe('green');
        else if (pct >= 50) expect(color).toBe('yellow');
        else expect(color).toBe('red');
      }),
      { numRuns: 200 },
    );
  });

  it('getAgeBracket maps ages correctly', () => {
    fc.assert(
      fc.property(ageArb, (age) => {
        const bracket = getAgeBracket(age);
        if (age <= 30) expect(bracket).toBe('19-30');
        else if (age <= 50) expect(bracket).toBe('31-50');
        else expect(bracket).toBe('51+');
      }),
      { numRuns: 200 },
    );
  });

  it('RDA_TABLE has entries for all 27 nutrients', () => {
    expect(nutrientKeys.length).toBe(27);
  });

  it('every RDA_TABLE entry has valid male and female brackets', () => {
    for (const key of nutrientKeys) {
      const entry = RDA_TABLE[key];
      expect(entry.male).toBeDefined();
      expect(entry.female).toBeDefined();
      for (const bracket of ['19-30', '31-50', '51+'] as const) {
        expect(typeof entry.male[bracket]).toBe('number');
        expect(entry.male[bracket]).toBeGreaterThanOrEqual(0);
        expect(typeof entry.female[bracket]).toBe('number');
        expect(entry.female[bracket]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
