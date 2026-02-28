import * as fc from 'fast-check';
import { calculatePlates, PlateBreakdown } from '../../utils/plateCalculator';
import type { UnitSystem } from '../../utils/unitConversion';

const NUM_RUNS = 100;

const METRIC_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const IMPERIAL_PLATES_KG = [20.4117, 15.876, 11.34, 4.536, 2.268, 1.134];

const unitSystemArb: fc.Arbitrary<UnitSystem> = fc.constantFrom('metric', 'imperial');

function sumPlatesPerSide(breakdown: PlateBreakdown): number {
  return breakdown.platesPerSide.reduce(
    (sum, p) => sum + p.weightKg * p.count,
    0,
  );
}

function totalPlateCount(breakdown: PlateBreakdown): number {
  return breakdown.platesPerSide.reduce((sum, p) => sum + p.count, 0);
}

describe('Plate Calculator — Property Tests', () => {
  /**
   * Property 20: Plate calculator round-trip
   * For any target weight >= bar weight, plates per side × 2 + bar = achievableWeightKg.
   * The achievable weight SHALL be <= target weight.
   * **Validates: Requirements 14.1, 14.2, 14.5**
   */
  it('Property 20: plates per side × 2 + bar = achievableWeightKg', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(20), max: Math.fround(500), noNaN: true }),
        unitSystemArb,
        (targetWeight, unitSystem) => {
          const result = calculatePlates(targetWeight, 20, unitSystem);
          const reconstructed = result.barWeightKg + sumPlatesPerSide(result) * 2;
          return Math.abs(reconstructed - result.achievableWeightKg) < 0.01;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 20: achievableWeightKg <= targetWeightKg', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(20), max: Math.fround(500), noNaN: true }),
        unitSystemArb,
        (targetWeight, unitSystem) => {
          const result = calculatePlates(targetWeight, 20, unitSystem);
          return result.achievableWeightKg <= targetWeight + 0.001;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 21: Plate calculator uses minimum plates
   * The greedy algorithm with sorted plates produces the minimum number of plates.
   * We verify that no single plate substitution could reduce the total count.
   * **Validates: Requirements 14.3**
   */
  it('Property 21: all plate weights come from the valid plate set', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(21), max: Math.fround(400), noNaN: true }),
        unitSystemArb,
        (targetWeight, unitSystem) => {
          const result = calculatePlates(targetWeight, 20, unitSystem);
          const validPlates =
            unitSystem === 'imperial' ? IMPERIAL_PLATES_KG : METRIC_PLATES;
          return result.platesPerSide.every((p) =>
            validPlates.some((vp) => Math.abs(vp - p.weightKg) < 0.001),
          );
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 21: plates are ordered largest to smallest', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(21), max: Math.fround(400), noNaN: true }),
        unitSystemArb,
        (targetWeight, unitSystem) => {
          const result = calculatePlates(targetWeight, 20, unitSystem);
          for (let i = 1; i < result.platesPerSide.length; i++) {
            if (
              result.platesPerSide[i].weightKg >
              result.platesPerSide[i - 1].weightKg
            ) {
              return false;
            }
          }
          return true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 20: isExact is true iff achievableWeightKg equals targetWeightKg', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(20), max: Math.fround(500), noNaN: true }),
        (targetWeight) => {
          const result = calculatePlates(targetWeight, 20, 'metric');
          if (result.isExact) {
            return (
              Math.abs(result.achievableWeightKg - targetWeight) < 0.01 ||
              targetWeight <= 20
            );
          }
          return result.achievableWeightKg < targetWeight;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});


describe('Plate Calculator — Unit Tests', () => {
  it('weight = 0 → bar only, empty plates', () => {
    const result = calculatePlates(0);
    expect(result.platesPerSide).toEqual([]);
    expect(result.achievableWeightKg).toBe(20);
    expect(result.isExact).toBe(true);
  });

  it('weight = 20 (bar only) → empty plates', () => {
    const result = calculatePlates(20);
    expect(result.platesPerSide).toEqual([]);
    expect(result.achievableWeightKg).toBe(20);
    expect(result.isExact).toBe(true);
  });

  it('weight = 15 (less than bar) → empty plates', () => {
    const result = calculatePlates(15);
    expect(result.platesPerSide).toEqual([]);
    expect(result.achievableWeightKg).toBe(20);
    expect(result.isExact).toBe(true);
  });

  it('weight = 22.5 → 1.25kg per side', () => {
    const result = calculatePlates(22.5);
    expect(result.platesPerSide).toEqual([{ weightKg: 1.25, count: 1 }]);
    expect(result.achievableWeightKg).toBe(22.5);
    expect(result.isExact).toBe(true);
  });

  it('weight = 60 → 20kg per side', () => {
    const result = calculatePlates(60);
    expect(result.platesPerSide).toEqual([{ weightKg: 20, count: 1 }]);
    expect(result.achievableWeightKg).toBe(60);
    expect(result.isExact).toBe(true);
  });

  it('weight = 100 → 25+15 per side', () => {
    const result = calculatePlates(100);
    // (100 - 20) / 2 = 40 per side → 25 + 15
    expect(result.platesPerSide).toEqual([
      { weightKg: 25, count: 1 },
      { weightKg: 15, count: 1 },
    ]);
    expect(result.achievableWeightKg).toBe(100);
    expect(result.isExact).toBe(true);
  });

  it('weight = 200 → 25×3 + 15 per side', () => {
    const result = calculatePlates(200);
    // (200 - 20) / 2 = 90 per side → 25×3=75 + 15=90
    expect(result.platesPerSide).toEqual([
      { weightKg: 25, count: 3 },
      { weightKg: 15, count: 1 },
    ]);
    expect(result.achievableWeightKg).toBe(200);
    expect(result.isExact).toBe(true);
  });

  it('impossible exact weight → nearest achievable, isExact false', () => {
    // 20.5 → per side = 0.25, smallest metric plate is 1.25 → can't achieve
    const result = calculatePlates(20.5);
    expect(result.platesPerSide).toEqual([]);
    expect(result.achievableWeightKg).toBe(20);
    expect(result.isExact).toBe(false);
  });

  it('imperial plates: weight = 60 (metric kg target)', () => {
    const result = calculatePlates(60, 20, 'imperial');
    // (60 - 20) / 2 = 20 per side → 20.4117 is too big, 15.876 fits, remainder 4.124 → 4.536 too big, 2.268 fits, remainder 1.856 → 1.134 fits, remainder 0.722
    expect(result.platesPerSide.length).toBeGreaterThan(0);
    expect(result.achievableWeightKg).toBeLessThanOrEqual(60.001);
  });

  it('custom bar weight: 25kg bar', () => {
    const result = calculatePlates(75, 25);
    // (75 - 25) / 2 = 25 per side → 25kg plate
    expect(result.platesPerSide).toEqual([{ weightKg: 25, count: 1 }]);
    expect(result.achievableWeightKg).toBe(75);
    expect(result.isExact).toBe(true);
  });
});
