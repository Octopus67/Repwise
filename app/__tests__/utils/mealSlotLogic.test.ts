import * as fc from 'fast-check';
import {
  assignMealSlot,
  groupEntriesBySlot,
  computeSlotTotals,
  NutritionEntry,
  MealSlotName,
} from '../../utils/mealSlotLogic';

/**
 * Feature: macrofactor-parity, Properties 1 & 2
 * Validates: Requirements 1.1, 1.2, 1.5, 1.6
 */

const VALID_SLOTS: MealSlotName[] = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

const entryArb = fc.record({
  id: fc.uuid(),
  meal_name: fc.string({ minLength: 0, maxLength: 50 }),
  calories: fc.float({ min: 0, max: 5000, noNaN: true }),
  protein_g: fc.float({ min: 0, max: 500, noNaN: true }),
  carbs_g: fc.float({ min: 0, max: 500, noNaN: true }),
  fat_g: fc.float({ min: 0, max: 500, noNaN: true }),
  entry_date: fc.constant('2024-01-15'),
  created_at: fc.constant('2024-01-15T08:00:00Z'),
});

describe('Property 1: Meal slot assignment is total and deterministic', () => {
  /**
   * **Validates: Requirements 1.1, 1.5**
   */
  test('assignMealSlot always returns one of the 4 valid slot names', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (mealName) => {
        const slot = assignMealSlot(mealName);
        expect(VALID_SLOTS).toContain(slot);
      }),
      { numRuns: 200 },
    );
  });

  test('assignMealSlot is deterministic — same input always gives same output', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (mealName) => {
        const slot1 = assignMealSlot(mealName);
        const slot2 = assignMealSlot(mealName);
        expect(slot1).toBe(slot2);
      }),
      { numRuns: 100 },
    );
  });

  test('keyword matching: breakfast→Breakfast, lunch→Lunch, dinner→Dinner, else→Snack', () => {
    expect(assignMealSlot('My Breakfast Bowl')).toBe('Breakfast');
    expect(assignMealSlot('LUNCH special')).toBe('Lunch');
    expect(assignMealSlot('dinner plate')).toBe('Dinner');
    expect(assignMealSlot('Quick add')).toBe('Snack');
    expect(assignMealSlot('')).toBe('Snack');
    expect(assignMealSlot('protein shake')).toBe('Snack');
  });
});

describe('Property 2: Slot grouping preserves calorie and macro totals', () => {
  /**
   * **Validates: Requirements 1.2, 1.6**
   */
  test('sum of slot subtotals equals sum of all entries', () => {
    fc.assert(
      fc.property(fc.array(entryArb, { minLength: 0, maxLength: 30 }), (entries) => {
        const slots = groupEntriesBySlot(entries);
        const allTotals = computeSlotTotals(entries);

        let slotCalories = 0;
        let slotProtein = 0;
        let slotCarbs = 0;
        let slotFat = 0;

        for (const slot of slots) {
          slotCalories += slot.totals.calories;
          slotProtein += slot.totals.protein_g;
          slotCarbs += slot.totals.carbs_g;
          slotFat += slot.totals.fat_g;
        }

        expect(slotCalories).toBeCloseTo(allTotals.calories, 5);
        expect(slotProtein).toBeCloseTo(allTotals.protein_g, 5);
        expect(slotCarbs).toBeCloseTo(allTotals.carbs_g, 5);
        expect(slotFat).toBeCloseTo(allTotals.fat_g, 5);
      }),
      { numRuns: 100 },
    );
  });

  test('grouping always produces exactly 4 slots in order', () => {
    const slots = groupEntriesBySlot([]);
    expect(slots.map((s) => s.name)).toEqual(['Breakfast', 'Lunch', 'Snack', 'Dinner']);
  });

  test('every entry appears in exactly one slot', () => {
    fc.assert(
      fc.property(fc.array(entryArb, { minLength: 1, maxLength: 20 }), (entries) => {
        const slots = groupEntriesBySlot(entries);
        const totalEntries = slots.reduce((sum, s) => sum + s.entries.length, 0);
        expect(totalEntries).toBe(entries.length);
      }),
      { numRuns: 100 },
    );
  });
});
