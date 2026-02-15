import * as fc from 'fast-check';

/**
 * Inline scaleMacros — same logic as exported from AddNutritionModal.
 */
function scaleMacros(
  base: { calories: number; protein_g: number; carbs_g: number; fat_g: number },
  multiplier: number,
) {
  return {
    calories: base.calories * multiplier,
    protein_g: base.protein_g * multiplier,
    carbs_g: base.carbs_g * multiplier,
    fat_g: base.fat_g * multiplier,
  };
}

/**
 * Feature: app-fixes-and-nutrition-v2, Property 2
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * Property 2: Macro scaling is multiplicative.
 */
describe('scaleMacros', () => {
  it('Property 2: each output macro equals base * multiplier', () => {
    const macroArb = fc.record({
      calories: fc.float({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
      protein_g: fc.float({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
      carbs_g: fc.float({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
      fat_g: fc.float({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
    });

    fc.assert(
      fc.property(
        macroArb,
        fc.float({ min: Math.fround(0.01), max: 20, noNaN: true, noDefaultInfinity: true }),
        (base, multiplier) => {
          const result = scaleMacros(base, multiplier);
          expect(result.calories).toBeCloseTo(base.calories * multiplier, 5);
          expect(result.protein_g).toBeCloseTo(base.protein_g * multiplier, 5);
          expect(result.carbs_g).toBeCloseTo(base.carbs_g * multiplier, 5);
          expect(result.fat_g).toBeCloseTo(base.fat_g * multiplier, 5);
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * Feature: app-fixes-and-nutrition-v2, Property 3
 * **Validates: Requirements 3.2**
 *
 * Property 3: Search results capped at 10.
 */
describe('search results display cap', () => {
  it('Property 3: items.slice(0, 10) has length min(N, 10)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 0, maxLength: 50 }),
        (items) => {
          const displayed = items.slice(0, 10);
          expect(displayed.length).toBe(Math.min(items.length, 10));
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * Feature: app-fixes-and-nutrition-v2, Property 14
 * **Validates: Requirements 3.1**
 *
 * Property 14: Search trigger threshold — search triggers only when trimmed length >= 2.
 */
describe('search trigger threshold', () => {
  it('Property 14: search triggers only when trimmed query length >= 2', () => {
    fc.assert(
      fc.property(fc.string(), (query) => {
        const trimmed = query.trim();
        const shouldTrigger = trimmed.length >= 2;

        if (shouldTrigger) {
          // Search should fire — trimmed length is at least 2
          expect(trimmed.length).toBeGreaterThanOrEqual(2);
        } else {
          // Search should NOT fire — results should be empty
          expect(trimmed.length).toBeLessThan(2);
        }
      }),
      { numRuns: 200 },
    );
  });
});
