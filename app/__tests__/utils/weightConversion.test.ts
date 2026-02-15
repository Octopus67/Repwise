import * as fc from 'fast-check';
import { kgToLbs, lbsToKg, parseWeightToKg } from '../../utils/unitConversion';

const NUM_RUNS = 100;
const KG_TO_LBS = 2.20462;

describe('Weight Conversion Property Tests', () => {
  /**
   * Property 4: parseWeightToKg correctness
   * - For unit 'kg', parseWeightToKg returns the input unchanged.
   * - For unit 'lbs', parseWeightToKg returns input / 2.20462 within 0.1 tolerance.
   * **Validates: Requirements 4.2, 4.3, 4.5**
   */
  it('Property 4: parseWeightToKg — kg passthrough returns input unchanged', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(500), noNaN: true }),
        (weight) => {
          return parseWeightToKg(weight, 'kg') === weight;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 4: parseWeightToKg — lbs conversion within 0.1 of expected', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(1000), noNaN: true }),
        (weight) => {
          const result = parseWeightToKg(weight, 'lbs');
          const expected = weight / KG_TO_LBS;
          return Math.abs(result - expected) <= 0.1;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 5: kgToLbs → lbsToKg round-trip within 0.1 tolerance
   * For any positive weight, converting kg→lbs→kg produces a value within 0.1 of the original.
   * **Validates: Requirements 4.2, 4.3, 4.5**
   */
  it('Property 5: kgToLbs → lbsToKg round-trip within 0.01', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(500), noNaN: true }),
        (kg) => {
          const lbs = kgToLbs(kg);
          const backToKg = lbsToKg(lbs);
          return Math.abs(backToKg - kg) <= 0.01;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 5: lbsToKg → kgToLbs round-trip within 0.02', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        (lbs) => {
          const kg = lbsToKg(lbs);
          const backToLbs = kgToLbs(kg);
          // With 2-decimal rounding, round-trip error is much smaller
          return Math.abs(backToLbs - lbs) <= 0.02;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Weight Conversion — specific value tests', () => {
  it('kgToLbs: 80kg → ~176.37 lbs', () => {
    const result = kgToLbs(80);
    expect(result).toBeCloseTo(176.37, 1);
  });

  it('kgToLbs → lbsToKg round-trip for 80kg', () => {
    const lbs = kgToLbs(80);
    const backToKg = lbsToKg(lbs);
    expect(backToKg).toBeCloseTo(80, 1);
  });

  it('lbsToKg: 180lbs → ~81.65 kg', () => {
    const result = lbsToKg(180);
    expect(result).toBeCloseTo(81.65, 1);
  });

  it('parseWeightToKg: kg input returns same value', () => {
    expect(parseWeightToKg(75, 'kg')).toBe(75);
    expect(parseWeightToKg(100.5, 'kg')).toBe(100.5);
  });

  it('parseWeightToKg: lbs input converts to kg', () => {
    const result = parseWeightToKg(180, 'lbs');
    expect(result).toBeCloseTo(81.65, 1);
  });
});

describe('Weight Conversion — NaN and Infinity handling', () => {
  it('kgToLbs(NaN) returns 0', () => {
    expect(kgToLbs(NaN)).toBe(0);
  });

  it('lbsToKg(NaN) returns 0', () => {
    expect(lbsToKg(NaN)).toBe(0);
  });

  it('parseWeightToKg(NaN, "kg") returns NaN (no guard on kg passthrough)', () => {
    expect(parseWeightToKg(NaN, 'kg')).toBeNaN();
  });

  it('parseWeightToKg(NaN, "lbs") returns 0', () => {
    expect(parseWeightToKg(NaN, 'lbs')).toBe(0);
  });

  it('kgToLbs(Infinity) returns 0 (guarded)', () => {
    const result = kgToLbs(Infinity);
    expect(result).toBe(0);
  });

  it('lbsToKg(Infinity) returns 0 (guarded)', () => {
    const result = lbsToKg(Infinity);
    expect(result).toBe(0);
  });

  it('parseWeightToKg(Infinity, "lbs") returns 0 (guarded via lbsToKg)', () => {
    const result = parseWeightToKg(Infinity, 'lbs');
    expect(result).toBe(0);
  });
});
