import * as fc from 'fast-check';
import { computeWeeklySummary, NutritionEntry } from '../../utils/weeklySummary';

/**
 * Feature: macrofactor-parity, Properties 13, 14
 * Validates: Requirements 8.1, 8.2, 8.3, 8.5
 */

const DATES = [
  '2024-01-15',
  '2024-01-16',
  '2024-01-17',
  '2024-01-18',
  '2024-01-19',
  '2024-01-20',
  '2024-01-21',
];

const entryArb: fc.Arbitrary<NutritionEntry> = fc.record({
  calories: fc.float({ min: 0, max: 5000, noNaN: true }),
  protein_g: fc.float({ min: 0, max: 500, noNaN: true }),
  carbs_g: fc.float({ min: 0, max: 500, noNaN: true }),
  fat_g: fc.float({ min: 0, max: 500, noNaN: true }),
  entry_date: fc.constantFrom(...DATES),
  micro_nutrients: fc.oneof(
    fc.constant(null),
    fc.record({ water_ml: fc.float({ min: 0, max: 5000, noNaN: true }) }),
  ),
});

describe('Property 13: Weekly summary averages are computed from logged days only', () => {
  /**
   * **Validates: Requirements 8.1, 8.3, 8.5**
   */
  test('avgCalories = totalCalories / daysLogged (not / 7)', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { minLength: 1, maxLength: 30 }),
        fc.float({ min: 1000, max: 3000, noNaN: true }),
        (entries, target) => {
          const summary = computeWeeklySummary(entries, target);

          // Compute expected values manually
          const byDate = new Map<string, number>();
          for (const e of entries) {
            byDate.set(e.entry_date, (byDate.get(e.entry_date) || 0) + e.calories);
          }

          const daysLogged = byDate.size;
          const totalCalories = Array.from(byDate.values()).reduce((a, b) => a + b, 0);
          const expectedAvg = totalCalories / daysLogged;

          expect(summary.daysLogged).toBe(daysLogged);
          expect(summary.avgCalories).toBeCloseTo(expectedAvg, 3);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('totalWaterMl equals sum of all water_ml from micro_nutrients', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { minLength: 0, maxLength: 20 }),
        (entries) => {
          const summary = computeWeeklySummary(entries, 2000);

          let expectedWater = 0;
          for (const e of entries) {
            if (e.micro_nutrients && typeof e.micro_nutrients.water_ml === 'number') {
              expectedWater += e.micro_nutrients.water_ml;
            }
          }

          expect(summary.totalWaterMl).toBeCloseTo(expectedWater, 3);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('empty entries → all zeros', () => {
    const summary = computeWeeklySummary([], 2000);
    expect(summary.avgCalories).toBe(0);
    expect(summary.daysLogged).toBe(0);
    expect(summary.bestDay).toBeNull();
    expect(summary.worstDay).toBeNull();
  });
});

describe('Property 14: daysLogged is always <= 7', () => {
  /**
   * **Validates: Requirements 8.3**
   */
  test('daysLogged never exceeds 7 for entries spanning at most 7 dates', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { minLength: 0, maxLength: 40 }),
        fc.float({ min: 1000, max: 3000, noNaN: true }),
        (entries, target) => {
          const summary = computeWeeklySummary(entries, target);
          expect(summary.daysLogged).toBeLessThanOrEqual(7);
          expect(summary.daysLogged).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 14b: Best and worst adherence days are correctly identified', () => {
  /**
   * **Validates: Requirements 8.2**
   */
  test('bestDay has minimum deviation, worstDay has maximum deviation', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { minLength: 1, maxLength: 30 }),
        fc.float({ min: 1000, max: 3000, noNaN: true }),
        (entries, target) => {
          const summary = computeWeeklySummary(entries, target);

          // Compute daily totals
          const byDate = new Map<string, number>();
          for (const e of entries) {
            byDate.set(e.entry_date, (byDate.get(e.entry_date) || 0) + e.calories);
          }

          const deviations = Array.from(byDate.entries()).map(([date, cal]) => ({
            date,
            deviation: Math.abs(cal - target),
          }));

          const minDev = Math.min(...deviations.map((d) => d.deviation));
          const maxDev = Math.max(...deviations.map((d) => d.deviation));

          expect(summary.bestDay).not.toBeNull();
          expect(summary.worstDay).not.toBeNull();
          expect(summary.bestDay!.deviation).toBeCloseTo(minDev, 3);
          expect(summary.worstDay!.deviation).toBeCloseTo(maxDev, 3);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Deterministic unit tests for computeWeeklySummary
// ===================================================================

describe('computeWeeklySummary — deterministic unit tests', () => {
  test('single day with one entry → averages equal that entry', () => {
    const entries: NutritionEntry[] = [
      { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 70, entry_date: '2024-01-15' },
    ];
    const summary = computeWeeklySummary(entries, 2000);
    expect(summary.avgCalories).toBe(2000);
    expect(summary.avgProtein).toBe(150);
    expect(summary.avgCarbs).toBe(200);
    expect(summary.avgFat).toBe(70);
    expect(summary.daysLogged).toBe(1);
  });

  test('multiple days → averages divided by days with data, not 7', () => {
    const entries: NutritionEntry[] = [
      { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 70, entry_date: '2024-01-15' },
      { calories: 2400, protein_g: 170, carbs_g: 240, fat_g: 80, entry_date: '2024-01-16' },
      { calories: 1800, protein_g: 130, carbs_g: 180, fat_g: 60, entry_date: '2024-01-17' },
    ];
    const summary = computeWeeklySummary(entries, 2000);
    expect(summary.daysLogged).toBe(3);
    expect(summary.avgCalories).toBeCloseTo((2000 + 2400 + 1800) / 3, 5);
    expect(summary.avgProtein).toBeCloseTo((150 + 170 + 130) / 3, 5);
    expect(summary.avgCarbs).toBeCloseTo((200 + 240 + 180) / 3, 5);
    expect(summary.avgFat).toBeCloseTo((70 + 80 + 60) / 3, 5);
  });

  test('targetCalories=0 → bestDay and worstDay are null', () => {
    const entries: NutritionEntry[] = [
      { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 70, entry_date: '2024-01-15' },
    ];
    const summary = computeWeeklySummary(entries, 0);
    expect(summary.bestDay).toBeNull();
    expect(summary.worstDay).toBeNull();
    expect(summary.daysLogged).toBe(1);
  });

  test('negative targetCalories → treated as 0, bestDay/worstDay null', () => {
    const entries: NutritionEntry[] = [
      { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 70, entry_date: '2024-01-15' },
    ];
    const summary = computeWeeklySummary(entries, -500);
    expect(summary.bestDay).toBeNull();
    expect(summary.worstDay).toBeNull();
  });

  test('NaN in entry calories → treated as 0, not NaN propagation', () => {
    const entries: NutritionEntry[] = [
      { calories: NaN, protein_g: 150, carbs_g: 200, fat_g: 70, entry_date: '2024-01-15' },
      { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 70, entry_date: '2024-01-16' },
    ];
    const summary = computeWeeklySummary(entries, 2000);
    expect(Number.isFinite(summary.avgCalories)).toBe(true);
    // Day 1 = 0 (NaN treated as 0), Day 2 = 2000 → avg = 1000
    expect(summary.avgCalories).toBeCloseTo(1000, 5);
  });

  test('entries with water_ml in micro_nutrients → totalWaterMl accumulated', () => {
    const entries: NutritionEntry[] = [
      {
        calories: 500,
        protein_g: 30,
        carbs_g: 50,
        fat_g: 20,
        entry_date: '2024-01-15',
        micro_nutrients: { water_ml: 500 },
      },
      {
        calories: 600,
        protein_g: 40,
        carbs_g: 60,
        fat_g: 25,
        entry_date: '2024-01-15',
        micro_nutrients: { water_ml: 750 },
      },
      {
        calories: 700,
        protein_g: 50,
        carbs_g: 70,
        fat_g: 30,
        entry_date: '2024-01-16',
        micro_nutrients: { water_ml: 300 },
      },
    ];
    const summary = computeWeeklySummary(entries, 2000);
    expect(summary.totalWaterMl).toBe(1550);
  });

  test('entries without micro_nutrients → totalWaterMl = 0', () => {
    const entries: NutritionEntry[] = [
      { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 70, entry_date: '2024-01-15' },
    ];
    const summary = computeWeeklySummary(entries, 2000);
    expect(summary.totalWaterMl).toBe(0);
  });

  test('entries with null micro_nutrients → totalWaterMl = 0', () => {
    const entries: NutritionEntry[] = [
      {
        calories: 2000,
        protein_g: 150,
        carbs_g: 200,
        fat_g: 70,
        entry_date: '2024-01-15',
        micro_nutrients: null,
      },
    ];
    const summary = computeWeeklySummary(entries, 2000);
    expect(summary.totalWaterMl).toBe(0);
  });

  test('multiple entries on same date → grouped correctly', () => {
    const entries: NutritionEntry[] = [
      { calories: 500, protein_g: 30, carbs_g: 50, fat_g: 20, entry_date: '2024-01-15' },
      { calories: 700, protein_g: 50, carbs_g: 70, fat_g: 30, entry_date: '2024-01-15' },
      { calories: 800, protein_g: 60, carbs_g: 80, fat_g: 35, entry_date: '2024-01-15' },
    ];
    const summary = computeWeeklySummary(entries, 2000);
    expect(summary.daysLogged).toBe(1);
    // All entries on same day → avg = total of that day / 1
    expect(summary.avgCalories).toBe(2000);
    expect(summary.avgProtein).toBe(140);
  });

  test('best day = closest to target, worst day = furthest from target', () => {
    const entries: NutritionEntry[] = [
      { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 70, entry_date: '2024-01-15' },
      { calories: 1500, protein_g: 120, carbs_g: 150, fat_g: 50, entry_date: '2024-01-16' },
      { calories: 2100, protein_g: 160, carbs_g: 210, fat_g: 75, entry_date: '2024-01-17' },
    ];
    const target = 2000;
    const summary = computeWeeklySummary(entries, target);
    // Day 15: |2000-2000| = 0, Day 16: |1500-2000| = 500, Day 17: |2100-2000| = 100
    expect(summary.bestDay!.date).toBe('2024-01-15');
    expect(summary.bestDay!.deviation).toBe(0);
    expect(summary.worstDay!.date).toBe('2024-01-16');
    expect(summary.worstDay!.deviation).toBe(500);
  });

  test('NaN in protein/carbs/fat → treated as 0', () => {
    const entries: NutritionEntry[] = [
      { calories: 2000, protein_g: NaN, carbs_g: NaN, fat_g: NaN, entry_date: '2024-01-15' },
    ];
    const summary = computeWeeklySummary(entries, 2000);
    expect(summary.avgProtein).toBe(0);
    expect(summary.avgCarbs).toBe(0);
    expect(summary.avgFat).toBe(0);
  });

  test('micro_nutrients with non-water keys → totalWaterMl = 0', () => {
    const entries: NutritionEntry[] = [
      {
        calories: 2000,
        protein_g: 150,
        carbs_g: 200,
        fat_g: 70,
        entry_date: '2024-01-15',
        micro_nutrients: { vitamin_c_mg: 90, iron_mg: 18 },
      },
    ];
    const summary = computeWeeklySummary(entries, 2000);
    expect(summary.totalWaterMl).toBe(0);
  });
});
