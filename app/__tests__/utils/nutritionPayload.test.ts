import * as fc from 'fast-check';
import { buildNutritionPayload } from '../../utils/nutritionPayload';

/**
 * Feature: app-fixes-and-nutrition-v2, Property 1
 * **Validates: Requirements 2.1, 2.2**
 *
 * Property 1: Nutrition payload always contains required fields.
 * For any macro values and any notes string, the returned object always has
 * a non-empty `meal_name` and a valid `entry_date` matching YYYY-MM-DD.
 */
describe('buildNutritionPayload', () => {
  const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

  it('Property 1: payload always contains non-empty meal_name and valid entry_date', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 10000, noNaN: true }),
        fc.float({ min: 0, max: 10000, noNaN: true }),
        fc.float({ min: 0, max: 10000, noNaN: true }),
        fc.float({ min: 0, max: 10000, noNaN: true }),
        fc.string(),
        (calories, protein, carbs, fat, notes) => {
          const payload = buildNutritionPayload(calories, protein, carbs, fat, notes);

          // meal_name must be a non-empty string
          expect(typeof payload.meal_name).toBe('string');
          expect(payload.meal_name.length).toBeGreaterThan(0);

          // entry_date must match YYYY-MM-DD
          expect(payload.entry_date).toMatch(DATE_REGEX);

          // macro fields must be present
          expect(payload.calories).toBe(calories);
          expect(payload.protein_g).toBe(protein);
          expect(payload.carbs_g).toBe(carbs);
          expect(payload.fat_g).toBe(fat);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('uses "Quick entry" when notes is empty or whitespace', () => {
    expect(buildNutritionPayload(100, 10, 20, 5, '').meal_name).toBe('Quick entry');
    expect(buildNutritionPayload(100, 10, 20, 5, '   ').meal_name).toBe('Quick entry');
  });

  it('uses trimmed notes as meal_name when notes is non-empty', () => {
    expect(buildNutritionPayload(100, 10, 20, 5, '  Lunch  ').meal_name).toBe('Lunch');
  });
});
