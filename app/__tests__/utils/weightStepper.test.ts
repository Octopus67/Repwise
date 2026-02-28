import * as fc from 'fast-check';
import { stepWeight } from '../../utils/weightStepper';
import { lbsToKg } from '../../utils/unitConversion';

const NUM_RUNS = 100;
const METRIC_STEP = 2.5;
const IMPERIAL_STEP_KG = lbsToKg(5);

/**
 * Property 6: Weight stepper produces valid values
 * **Validates: Requirements 3.1, 3.2**
 */
describe('Weight Stepper Property Tests', () => {
  it('result is always >= 0 for any input and direction', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        fc.constantFrom('up' as const, 'down' as const),
        fc.constantFrom('metric' as const, 'imperial' as const),
        (weight, direction, unit) => {
          const result = stepWeight(weight, direction, unit);
          return result >= 0;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('increment increases by correct step (metric: 2.5 kg)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        (weight) => {
          const result = stepWeight(weight, 'up', 'metric');
          const expected = Math.round((weight + METRIC_STEP) * 100) / 100;
          return Math.abs(result - expected) < 0.01;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('increment increases by correct step (imperial: 5 lbs in kg)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        (weight) => {
          const result = stepWeight(weight, 'up', 'imperial');
          const expected = Math.round((weight + IMPERIAL_STEP_KG) * 100) / 100;
          return Math.abs(result - expected) < 0.01;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('decrement decreases by correct step with floor 0 (metric)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        (weight) => {
          const result = stepWeight(weight, 'down', 'metric');
          const raw = weight - METRIC_STEP;
          const expected = raw < 0 ? 0 : Math.round(raw * 100) / 100;
          return Math.abs(result - expected) < 0.01;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('decrement decreases by correct step with floor 0 (imperial)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        (weight) => {
          const result = stepWeight(weight, 'down', 'imperial');
          const raw = weight - IMPERIAL_STEP_KG;
          const expected = raw < 0 ? 0 : Math.round(raw * 100) / 100;
          return Math.abs(result - expected) < 0.01;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
