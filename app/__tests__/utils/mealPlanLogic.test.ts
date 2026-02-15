/**
 * Property-based tests for meal plan aggregation logic.
 *
 * Feature: app-fixes-and-nutrition-v2, Property 10: Meal plan aggregate nutrition
 * Validates: Requirements 8.3
 */

import * as fc from 'fast-check';
import { aggregateMealPlan, MealPlanItem } from '../../utils/mealPlanLogic';

const mealPlanItemArb: fc.Arbitrary<MealPlanItem> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  calories: fc.float({ min: Math.fround(0), max: Math.fround(5000), noNaN: true }),
  protein_g: fc.float({ min: Math.fround(0), max: Math.fround(500), noNaN: true }),
  carbs_g: fc.float({ min: Math.fround(0), max: Math.fround(500), noNaN: true }),
  fat_g: fc.float({ min: Math.fround(0), max: Math.fround(500), noNaN: true }),
  serving_multiplier: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
});

describe('aggregateMealPlan — Property 10: Meal plan aggregate nutrition', () => {
  /**
   * Property 10: For any list of items with macros and multipliers,
   * aggregate calories === sum of item.calories * item.serving_multiplier
   * (and same for protein, carbs, fat).
   *
   * **Validates: Requirements 8.3**
   */
  it('aggregate equals sum of each macro * serving_multiplier', () => {
    fc.assert(
      fc.property(
        fc.array(mealPlanItemArb, { minLength: 0, maxLength: 20 }),
        (items: MealPlanItem[]) => {
          const result = aggregateMealPlan(items);

          const expectedCalories = items.reduce((s, i) => s + i.calories * i.serving_multiplier, 0);
          const expectedProtein = items.reduce((s, i) => s + i.protein_g * i.serving_multiplier, 0);
          const expectedCarbs = items.reduce((s, i) => s + i.carbs_g * i.serving_multiplier, 0);
          const expectedFat = items.reduce((s, i) => s + i.fat_g * i.serving_multiplier, 0);

          // Use tolerance for floating point arithmetic
          const tol = 1e-6;
          expect(Math.abs(result.calories - expectedCalories)).toBeLessThan(tol + Math.abs(expectedCalories) * 1e-9);
          expect(Math.abs(result.protein_g - expectedProtein)).toBeLessThan(tol + Math.abs(expectedProtein) * 1e-9);
          expect(Math.abs(result.carbs_g - expectedCarbs)).toBeLessThan(tol + Math.abs(expectedCarbs) * 1e-9);
          expect(Math.abs(result.fat_g - expectedFat)).toBeLessThan(tol + Math.abs(expectedFat) * 1e-9);
        },
      ),
      { numRuns: 150 },
    );
  });

  it('empty item list returns all zeros', () => {
    const result = aggregateMealPlan([]);
    expect(result).toEqual({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  });

  it('single item with multiplier 1 returns item macros', () => {
    fc.assert(
      fc.property(mealPlanItemArb, (item: MealPlanItem) => {
        const withMult1 = { ...item, serving_multiplier: 1 };
        const result = aggregateMealPlan([withMult1]);
        const tol = 1e-9;
        expect(Math.abs(result.calories - withMult1.calories)).toBeLessThan(tol);
        expect(Math.abs(result.protein_g - withMult1.protein_g)).toBeLessThan(tol);
        expect(Math.abs(result.carbs_g - withMult1.carbs_g)).toBeLessThan(tol);
        expect(Math.abs(result.fat_g - withMult1.fat_g)).toBeLessThan(tol);
      }),
      { numRuns: 100 },
    );
  });
});
