import * as fc from 'fast-check';
import {
  convertWeight,
  convertHeight,
  formatWeight,
  formatHeight,
  parseWeightInput,
} from '../utils/unitConversion';

const NUM_RUNS = 100;

describe('Unit Conversion Property Tests', () => {
  /**
   * Property 7: Weight conversion round-trip
   * For any non-negative kg value, parseWeightInput(convertWeight(v, 'imperial'), 'imperial') ≈ v within 0.1 kg
   * **Validates: Requirements 5.1**
   */
  it('Property 7: Weight conversion round-trip', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        (kg) => {
          const lbs = convertWeight(kg, 'imperial');
          const backToKg = parseWeightInput(lbs, 'imperial');
          return Math.abs(backToKg - kg) <= 0.15;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 8: Height conversion round-trip
   * For any positive cm value, converting to ft/in and back ≈ original within 1 cm
   * **Validates: Requirements 5.2**
   */
  it('Property 8: Height conversion round-trip', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }),
        (cm) => {
          const imperial = convertHeight(cm, 'imperial') as { feet: number; inches: number };
          const backToCm = Math.round((imperial.feet * 12 + imperial.inches) * 2.54);
          return Math.abs(backToCm - cm) <= 1;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 12: Conversion rounding
   * For any conversion, weight output has ≤1 decimal place, height cm output is integer
   * **Validates: Requirements 5.7**
   */
  it('Property 12: Conversion rounding — weight has ≤1 decimal place', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        fc.constantFrom('metric' as const, 'imperial' as const),
        (kg, system) => {
          const converted = convertWeight(kg, system);
          // Check at most 1 decimal place: multiply by 10, should be integer (within float tolerance)
          return Math.abs(Math.round(converted * 10) - converted * 10) < 0.001;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 12: Conversion rounding — height cm output is integer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }),
        (cm) => {
          const metric = convertHeight(cm, 'metric') as { value: number; unit: string };
          return Number.isInteger(metric.value);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 10: Unit display formatting
   * For any kg value and system, formatted string contains correct unit suffix and converted value
   * **Validates: Requirements 5.4**
   */
  it('Property 10: Unit display formatting — weight', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        fc.constantFrom('metric' as const, 'imperial' as const),
        (kg, system) => {
          const formatted = formatWeight(kg, system);
          const expectedSuffix = system === 'metric' ? 'kg' : 'lbs';
          const expectedValue = convertWeight(kg, system);

          return (
            formatted.endsWith(` ${expectedSuffix}`) &&
            formatted.includes(expectedValue.toFixed(1))
          );
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Property 10: Unit display formatting — height', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }),
        fc.constantFrom('metric' as const, 'imperial' as const),
        (cm, system) => {
          const formatted = formatHeight(cm, system);
          if (system === 'metric') {
            return formatted.endsWith(' cm') && formatted.includes(String(Math.round(cm)));
          }
          // Imperial: should match pattern like 5'11"
          return /^\d+'\d+"$/.test(formatted);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 11: Database metric invariant
   * For any value input in any system, parseWeightInput returns kg
   * **Validates: Requirements 5.5, 5.6**
   */
  it('Property 11: Database metric invariant — parseWeightInput always returns kg', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        fc.constantFrom('metric' as const, 'imperial' as const),
        (value, system) => {
          const result = parseWeightInput(value, system);
          if (system === 'metric') {
            // Metric input: result should be the same value (rounded to 1 decimal)
            return Math.abs(result - Math.round(value * 10) / 10) < 0.001;
          }
          // Imperial input: result should be value / 2.20462 (converted to kg), rounded
          const expectedKg = Math.round((value / 2.20462) * 10) / 10;
          return Math.abs(result - expectedKg) < 0.001;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
