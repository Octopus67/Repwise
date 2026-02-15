import * as fc from 'fast-check';
import {
  mealBuilderReducer,
  createInitialState,
  computeRunningTotals,
  scaleMacros,
  type MealBuilderState,
  type MealBuilderItem,
  type Macros,
  type MealBuilderAction,
} from '../../utils/mealBuilderLogic';

/**
 * Feature: competitive-parity-v1, Properties 14, 15
 * Validates: Requirements 6.1.2, 6.1.3, 6.1.4
 */

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const macrosArb: fc.Arbitrary<Macros> = fc.record({
  calories: fc.float({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
  protein_g: fc.float({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
  carbs_g: fc.float({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
  fat_g: fc.float({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
});

const foodNameArb = fc.string({ minLength: 1, maxLength: 50 });

interface AddItemPayload {
  tempId: string;
  foodName: string;
  macros: Macros;
}

const addItemPayloadArb: fc.Arbitrary<AddItemPayload> = fc.record({
  tempId: fc.uuid(),
  foodName: foodNameArb,
  macros: macrosArb,
});

// ============================================================
// Property 14: Meal builder state consistency
// ============================================================

describe('Property 14: Meal builder state consistency', () => {
  /**
   * **Validates: Requirements 6.1.2, 6.1.3**
   *
   * After adding N items to the meal builder, the list length should be N
   * and the running totals should equal the sum of all scaled macros.
   */
  test('after adding N items, list length=N and running totals = Σ scaled macros', () => {
    fc.assert(
      fc.property(
        fc.array(addItemPayloadArb, { minLength: 1, maxLength: 20 }),
        (items) => {
          let state = createInitialState();

          for (const item of items) {
            state = mealBuilderReducer(state, {
              type: 'ADD_ITEM',
              payload: item,
            });
          }

          // List length should equal number of items added
          expect(state.items.length).toBe(items.length);

          // Running totals should equal sum of all scaled macros
          const expectedTotals = computeRunningTotals(state.items);
          expect(state.runningTotals.calories).toBeCloseTo(expectedTotals.calories, 5);
          expect(state.runningTotals.protein_g).toBeCloseTo(expectedTotals.protein_g, 5);
          expect(state.runningTotals.carbs_g).toBeCloseTo(expectedTotals.carbs_g, 5);
          expect(state.runningTotals.fat_g).toBeCloseTo(expectedTotals.fat_g, 5);

          // Running totals should also equal sum of input macros (all multipliers are 1)
          const inputSum = items.reduce(
            (acc, item) => ({
              calories: acc.calories + item.macros.calories,
              protein_g: acc.protein_g + item.macros.protein_g,
              carbs_g: acc.carbs_g + item.macros.carbs_g,
              fat_g: acc.fat_g + item.macros.fat_g,
            }),
            { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
          );
          expect(state.runningTotals.calories).toBeCloseTo(inputSum.calories, 5);
          expect(state.runningTotals.protein_g).toBeCloseTo(inputSum.protein_g, 5);
          expect(state.runningTotals.carbs_g).toBeCloseTo(inputSum.carbs_g, 5);
          expect(state.runningTotals.fat_g).toBeCloseTo(inputSum.fat_g, 5);
        },
      ),
      { numRuns: 200 },
    );
  });

  test('adding items with serving multiplier updates totals correctly', () => {
    fc.assert(
      fc.property(
        addItemPayloadArb,
        fc.float({ min: Math.fround(0.1), max: 10, noNaN: true, noDefaultInfinity: true }),
        (item, multiplier) => {
          let state = createInitialState();

          // Add item
          state = mealBuilderReducer(state, {
            type: 'ADD_ITEM',
            payload: item,
          });

          // Update serving
          state = mealBuilderReducer(state, {
            type: 'UPDATE_SERVING',
            payload: { tempId: item.tempId, multiplier },
          });

          // Scaled macros should equal base * multiplier
          const expected = scaleMacros(item.macros, multiplier);
          const actual = state.items[0].scaledMacros;
          expect(actual.calories).toBeCloseTo(expected.calories, 5);
          expect(actual.protein_g).toBeCloseTo(expected.protein_g, 5);
          expect(actual.carbs_g).toBeCloseTo(expected.carbs_g, 5);
          expect(actual.fat_g).toBeCloseTo(expected.fat_g, 5);

          // Running totals should match the single item's scaled macros
          expect(state.runningTotals.calories).toBeCloseTo(expected.calories, 5);
          expect(state.runningTotals.protein_g).toBeCloseTo(expected.protein_g, 5);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ============================================================
// Property 15: Meal builder item removal
// ============================================================

describe('Property 15: Meal builder item removal', () => {
  /**
   * **Validates: Requirements 6.1.4**
   *
   * Removing an item at any index results in length N-1 and totals
   * decreased by exactly the removed item's scaled macros.
   */
  test('removing item at index i → length N-1, totals decreased by removed item macros', () => {
    fc.assert(
      fc.property(
        fc.array(addItemPayloadArb, { minLength: 2, maxLength: 15 }),
        fc.nat(),
        (items, rawIndex) => {
          let state = createInitialState();

          // Add all items
          for (const item of items) {
            state = mealBuilderReducer(state, {
              type: 'ADD_ITEM',
              payload: item,
            });
          }

          const N = state.items.length;
          const indexToRemove = rawIndex % N;
          const removedItem = state.items[indexToRemove];
          const totalsBefore = { ...state.runningTotals };

          // Remove the item
          state = mealBuilderReducer(state, {
            type: 'REMOVE_ITEM',
            payload: { tempId: removedItem.tempId },
          });

          // Length should be N-1
          expect(state.items.length).toBe(N - 1);

          // Totals should decrease by the removed item's scaled macros
          expect(state.runningTotals.calories).toBeCloseTo(
            totalsBefore.calories - removedItem.scaledMacros.calories,
            5,
          );
          expect(state.runningTotals.protein_g).toBeCloseTo(
            totalsBefore.protein_g - removedItem.scaledMacros.protein_g,
            5,
          );
          expect(state.runningTotals.carbs_g).toBeCloseTo(
            totalsBefore.carbs_g - removedItem.scaledMacros.carbs_g,
            5,
          );
          expect(state.runningTotals.fat_g).toBeCloseTo(
            totalsBefore.fat_g - removedItem.scaledMacros.fat_g,
            5,
          );

          // Removed item should not be in the list
          expect(state.items.find((i) => i.tempId === removedItem.tempId)).toBeUndefined();
        },
      ),
      { numRuns: 200 },
    );
  });

  test('removing all items results in zero totals', () => {
    fc.assert(
      fc.property(
        fc.array(addItemPayloadArb, { minLength: 1, maxLength: 10 }),
        (items) => {
          let state = createInitialState();

          // Add all items
          for (const item of items) {
            state = mealBuilderReducer(state, {
              type: 'ADD_ITEM',
              payload: item,
            });
          }

          // Remove all items
          for (const item of [...state.items]) {
            state = mealBuilderReducer(state, {
              type: 'REMOVE_ITEM',
              payload: { tempId: item.tempId },
            });
          }

          expect(state.items.length).toBe(0);
          expect(state.runningTotals.calories).toBe(0);
          expect(state.runningTotals.protein_g).toBe(0);
          expect(state.runningTotals.carbs_g).toBe(0);
          expect(state.runningTotals.fat_g).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
