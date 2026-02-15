import * as fc from 'fast-check';
import {
  computeTDEEEstimate,
  WeightPoint,
} from '../../utils/tdeeEstimation';

/**
 * Feature: macrofactor-parity, Property 15
 * Validates: Requirements 9.1, 9.2, 9.4
 */

function makeDateStr(daysAgo: number): string {
  const d = new Date('2024-06-15');
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function generateTestData(numDays: number, baseWeight: number, baseCal: number) {
  const weightHistory: WeightPoint[] = [];
  const caloriesByDate: Record<string, number> = {};

  for (let i = numDays - 1; i >= 0; i--) {
    const dateStr = makeDateStr(i);
    weightHistory.push({
      date: dateStr,
      weight_kg: baseWeight + (Math.random() - 0.5) * 2,
    });
    caloriesByDate[dateStr] = baseCal + (Math.random() - 0.5) * 400;
  }

  return { weightHistory, caloriesByDate };
}

describe('Property 15: TDEE estimation follows the specified formula', () => {
  /**
   * **Validates: Requirements 9.1, 9.2, 9.4**
   */
  test('returns null when fewer than 14 days of weight data', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 13 }),
        (numDays) => {
          const { weightHistory, caloriesByDate } = generateTestData(
            numDays,
            80,
            2200,
          );
          // Ensure calorie data has enough days even if weight doesn't
          for (let i = 0; i < 20; i++) {
            caloriesByDate[makeDateStr(i)] = 2200;
          }
          const result = computeTDEEEstimate(weightHistory, caloriesByDate);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 20 },
    );
  });

  test('returns null when fewer than 14 days of calorie data', () => {
    const weightHistory: WeightPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      weightHistory.push({ date: makeDateStr(i), weight_kg: 80 });
    }
    const caloriesByDate: Record<string, number> = {};
    for (let i = 0; i < 10; i++) {
      caloriesByDate[makeDateStr(i)] = 2200;
    }
    const result = computeTDEEEstimate(weightHistory, caloriesByDate);
    expect(result).toBeNull();
  });

  test('TDEE = avgDailyCalories + (weightChangeKg * 7700 / windowDays) when sufficient data', () => {
    // Generate stable data with enough points
    const { weightHistory, caloriesByDate } = generateTestData(30, 80, 2200);

    const result = computeTDEEEstimate(weightHistory, caloriesByDate, 28);

    if (result !== null) {
      // Verify the formula: TDEE = avgDailyCalories + (weightChangeKg * 7700 / windowDays)
      const expectedTdee =
        result.avgDailyCalories +
        (result.weightChangeKg * 7700) / result.windowDays;
      expect(result.tdee).toBeCloseTo(expectedTdee, 5);
      expect(result.windowDays).toBe(28);
    }
  });

  test('with constant weight and calories, TDEE ≈ avgDailyCalories', () => {
    const weightHistory: WeightPoint[] = [];
    const caloriesByDate: Record<string, number> = {};

    for (let i = 29; i >= 0; i--) {
      const dateStr = makeDateStr(i);
      weightHistory.push({ date: dateStr, weight_kg: 80.0 });
      caloriesByDate[dateStr] = 2200;
    }

    const result = computeTDEEEstimate(weightHistory, caloriesByDate, 28);
    expect(result).not.toBeNull();
    // With constant weight, weightChange ≈ 0, so TDEE ≈ avgCalories
    expect(result!.tdee).toBeCloseTo(2200, 0);
    expect(result!.avgDailyCalories).toBeCloseTo(2200, 5);
  });

  test('windowDays=0 returns null (regression — division by zero guard)', () => {
    const { weightHistory, caloriesByDate } = generateTestData(30, 80, 2200);
    const result = computeTDEEEstimate(weightHistory, caloriesByDate, 0);
    expect(result).toBeNull();
  });

  test('windowDays=-1 returns null', () => {
    const { weightHistory, caloriesByDate } = generateTestData(30, 80, 2200);
    const result = computeTDEEEstimate(weightHistory, caloriesByDate, -1);
    expect(result).toBeNull();
  });

  test('empty weight entries returns null', () => {
    const caloriesByDate: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      caloriesByDate[makeDateStr(i)] = 2200;
    }
    const result = computeTDEEEstimate([], caloriesByDate, 28);
    expect(result).toBeNull();
  });

  test('empty calorie entries returns null', () => {
    const weightHistory: WeightPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      weightHistory.push({ date: makeDateStr(i), weight_kg: 80 });
    }
    const result = computeTDEEEstimate(weightHistory, {}, 28);
    expect(result).toBeNull();
  });
});
