import * as fc from 'fast-check';
import {
  formatSummaryFields,
  initializeDraft,
  buildRecalculatePayload,
  validateDraft,
} from '../../utils/editPlanLogic';
import type { ActivityLevel, GoalType } from '../../utils/editPlanLogic';
import {
  convertWeight,
  parseWeightInput,
  cmToFtIn,
  ftInToCm,
} from '../../utils/unitConversion';

const NUM_RUNS = 100;

const ACTIVITY_LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GOAL_TYPES: GoalType[] = ['cutting', 'maintaining', 'bulking'];

// ─── Generators ──────────────────────────────────────────────────────────────

const arbActivityLevel = fc.constantFrom(...ACTIVITY_LEVELS);
const arbGoalType = fc.constantFrom(...GOAL_TYPES);
const arbUnitSystem = fc.constantFrom('metric' as const, 'imperial' as const);

const arbMetrics = (opts?: { nullableOptionals?: boolean }) =>
  fc.record({
    id: fc.constant('m-1'),
    weightKg: fc.double({ min: 20, max: 300, noNaN: true, noDefaultInfinity: true }),
    heightCm: fc.integer({ min: 100, max: 250 }),
    bodyFatPct: opts?.nullableOptionals
      ? fc.option(fc.double({ min: 1, max: 50, noNaN: true, noDefaultInfinity: true }), { nil: null })
      : fc.double({ min: 1, max: 50, noNaN: true, noDefaultInfinity: true }),
    activityLevel: arbActivityLevel as fc.Arbitrary<string>,
    recordedAt: fc.constant('2024-01-15T10:00:00Z'),
  });

const arbGoals = (opts?: { nullableOptionals?: boolean }) =>
  fc.record({
    id: fc.constant('g-1'),
    userId: fc.constant('u-1'),
    goalType: arbGoalType as fc.Arbitrary<string>,
    targetWeightKg: opts?.nullableOptionals
      ? fc.option(fc.double({ min: 30, max: 200, noNaN: true, noDefaultInfinity: true }), { nil: null })
      : fc.double({ min: 30, max: 200, noNaN: true, noDefaultInfinity: true }),
    goalRatePerWeek: opts?.nullableOptionals
      ? fc.option(fc.double({ min: -2, max: 2, noNaN: true, noDefaultInfinity: true }), { nil: null })
      : fc.double({ min: -2, max: 2, noNaN: true, noDefaultInfinity: true }),
  });

const arbTargets = fc.record({
  calories: fc.double({ min: 1000, max: 5000, noNaN: true, noDefaultInfinity: true }),
  protein_g: fc.double({ min: 10, max: 500, noNaN: true, noDefaultInfinity: true }),
  carbs_g: fc.double({ min: 10, max: 500, noNaN: true, noDefaultInfinity: true }),
  fat_g: fc.double({ min: 10, max: 500, noNaN: true, noDefaultInfinity: true }),
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Edit Plan Logic — Property Tests', () => {

  /**
   * Property 1: Summary card renders all present fields
   *
   * For any valid non-null metrics, goals, targets, and unit system,
   * formatSummaryFields returns non-dash strings for every field,
   * and the weight string contains the converted numeric value.
   *
   * **Validates: Requirements 1.1, 1.3, 1.4**
   */
  it('Property 1: Summary card renders all present fields', () => {
    fc.assert(
      fc.property(
        arbMetrics(),
        arbGoals(),
        arbTargets,
        arbUnitSystem,
        (metrics, goals, targets, unitSystem) => {
          const fields = formatSummaryFields(metrics, goals, targets, unitSystem);

          // Every field should be non-dash
          const allFields = [
            fields.weight,
            fields.height,
            fields.bodyFat,
            fields.activityLevel,
            fields.goalType,
            fields.targetWeight,
            fields.goalRate,
            fields.calories,
            fields.protein,
            fields.carbs,
            fields.fat,
          ];
          for (const f of allFields) {
            if (f === '—') return false;
          }

          // Weight string should contain the converted numeric value
          const convertedWeight = convertWeight(metrics.weightKg, unitSystem);
          if (!fields.weight.includes(convertedWeight.toFixed(1))) return false;

          return true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 2: Null optional fields display as dash
   *
   * For any metrics/goals where optional fields (bodyFatPct, targetWeightKg,
   * goalRatePerWeek) are randomly null, null fields produce "—" and
   * non-null fields produce non-dash strings.
   *
   * **Validates: Requirements 1.2**
   */
  it('Property 2: Null optional fields display as dash', () => {
    fc.assert(
      fc.property(
        arbMetrics({ nullableOptionals: true }),
        arbGoals({ nullableOptionals: true }),
        arbTargets,
        arbUnitSystem,
        (metrics, goals, targets, unitSystem) => {
          const fields = formatSummaryFields(metrics, goals, targets, unitSystem);

          // bodyFatPct
          if (metrics.bodyFatPct === null) {
            if (fields.bodyFat !== '—') return false;
          } else {
            if (fields.bodyFat === '—') return false;
          }

          // targetWeightKg
          if (goals.targetWeightKg === null) {
            if (fields.targetWeight !== '—') return false;
          } else {
            if (fields.targetWeight === '—') return false;
          }

          // goalRatePerWeek
          if (goals.goalRatePerWeek === null) {
            if (fields.goalRate !== '—') return false;
          } else {
            if (fields.goalRate === '—') return false;
          }

          // Non-optional fields should always be non-dash
          if (fields.weight === '—') return false;
          if (fields.height === '—') return false;
          if (fields.activityLevel === '—') return false;
          if (fields.goalType === '—') return false;
          if (fields.calories === '—') return false;
          if (fields.protein === '—') return false;
          if (fields.carbs === '—') return false;
          if (fields.fat === '—') return false;

          return true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 3: Draft initialization round-trip
   *
   * For any valid metrics and goals, calling initializeDraft then
   * buildRecalculatePayload produces weight_kg within 0.1 kg and
   * height_cm within 1 cm of the originals.
   *
   * **Validates: Requirements 3.1, 4.1, 5.4, 5.5**
   */
  it('Property 3: Draft initialization round-trip', () => {
    fc.assert(
      fc.property(
        arbMetrics(),
        arbGoals(),
        arbUnitSystem,
        (metrics, goals, unitSystem) => {
          const draft = initializeDraft(metrics, goals, unitSystem);
          const payload = buildRecalculatePayload(draft, unitSystem);

          const weightDiff = Math.abs(payload.metrics.weight_kg - metrics.weightKg);
          if (weightDiff > 0.1) return false;

          const heightDiff = Math.abs(payload.metrics.height_cm - metrics.heightCm);
          if (heightDiff > 1) return false;

          return true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 4: Payload builder produces well-formed output
   *
   * For any valid EditDraft with positive weight/height, valid activity level,
   * and valid goal type, buildRecalculatePayload produces well-formed output.
   * When goalType is 'maintaining', target_weight_kg and goal_rate_per_week are absent.
   *
   * **Validates: Requirements 5.1, 5.4, 5.5, 5.6**
   */
  it('Property 4: Payload builder produces well-formed output', () => {
    const arbValidDraft = fc.record({
      weight: fc.double({ min: 1, max: 500, noNaN: true, noDefaultInfinity: true }).map(v => v.toFixed(1)),
      heightCm: fc.integer({ min: 100, max: 250 }).map(String),
      heightFeet: fc.integer({ min: 3, max: 7 }).map(String),
      heightInches: fc.integer({ min: 0, max: 11 }).map(String),
      bodyFatPct: fc.constantFrom('', '15', '20.5'),
      activityLevel: arbActivityLevel,
      goalType: arbGoalType,
      targetWeight: fc.double({ min: 30, max: 200, noNaN: true, noDefaultInfinity: true }).map(v => v.toFixed(1)),
      goalRate: fc.double({ min: -2, max: 2, noNaN: true, noDefaultInfinity: true }).map(v => v.toFixed(1)),
    });

    fc.assert(
      fc.property(
        arbValidDraft,
        arbUnitSystem,
        (draft, unitSystem) => {
          const payload = buildRecalculatePayload(draft, unitSystem);

          if (payload.metrics.weight_kg <= 0) return false;
          if (payload.metrics.height_cm <= 0) return false;
          if (!ACTIVITY_LEVELS.includes(payload.metrics.activity_level as ActivityLevel)) return false;
          if (!GOAL_TYPES.includes(payload.goals.goal_type as GoalType)) return false;

          // When maintaining, target_weight_kg and goal_rate_per_week should be absent
          if (draft.goalType === 'maintaining') {
            if (payload.goals.target_weight_kg !== undefined) return false;
            if (payload.goals.goal_rate_per_week !== undefined) return false;
          }

          return true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 5: Validation rejects invalid numeric inputs
   *
   * Drafts with invalid weight, height, or body fat outside [0,100]
   * are rejected by validateDraft with appropriate error keys.
   *
   * **Validates: Requirements 6.2, 6.3, 6.4**
   */
  it('Property 5: Validation rejects invalid numeric inputs', () => {
    const invalidWeights = fc.constantFrom('', 'abc', '0', '-5', '-0.1');
    const invalidHeights = fc.constantFrom('', 'xyz', '0', '-10');
    const invalidBodyFats = fc.constantFrom('101', '-1', '150', 'abc', '-0.5');

    // Sub-property 5a: invalid weight → error on weight key
    fc.assert(
      fc.property(
        invalidWeights,
        arbUnitSystem,
        (badWeight, unitSystem) => {
          const draft = {
            weight: badWeight,
            heightCm: '170',
            heightFeet: '5',
            heightInches: '10',
            bodyFatPct: '',
            activityLevel: 'moderate' as ActivityLevel,
            goalType: 'maintaining' as GoalType,
            targetWeight: '',
            goalRate: '',
          };
          const result = validateDraft(draft, unitSystem);
          return result.valid === false && result.errors.weight !== undefined;
        },
      ),
      { numRuns: NUM_RUNS },
    );

    // Sub-property 5b: invalid height (metric) → error on heightCm key
    fc.assert(
      fc.property(
        invalidHeights,
        (badHeight) => {
          const draft = {
            weight: '80',
            heightCm: badHeight,
            heightFeet: '',
            heightInches: '',
            bodyFatPct: '',
            activityLevel: 'moderate' as ActivityLevel,
            goalType: 'maintaining' as GoalType,
            targetWeight: '',
            goalRate: '',
          };
          const result = validateDraft(draft, 'metric');
          return result.valid === false && result.errors.heightCm !== undefined;
        },
      ),
      { numRuns: NUM_RUNS },
    );

    // Sub-property 5c: invalid body fat → error on bodyFatPct key
    fc.assert(
      fc.property(
        invalidBodyFats,
        arbUnitSystem,
        (badBf, unitSystem) => {
          const draft = {
            weight: '80',
            heightCm: '170',
            heightFeet: '5',
            heightInches: '10',
            bodyFatPct: badBf,
            activityLevel: 'moderate' as ActivityLevel,
            goalType: 'cutting' as GoalType,
            targetWeight: '',
            goalRate: '',
          };
          const result = validateDraft(draft, unitSystem);
          return result.valid === false && result.errors.bodyFatPct !== undefined;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 6: Weight conversion round-trip
   *
   * For any weight in kg [20, 300], converting to imperial via convertWeight
   * and back via parseWeightInput produces a value within 0.1 kg of the original.
   *
   * **Validates: Requirements 8.2**
   */
  it('Property 6: Weight conversion round-trip', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 20, max: 300, noNaN: true, noDefaultInfinity: true }),
        (weightKg) => {
          const lbs = convertWeight(weightKg, 'imperial');
          const backToKg = parseWeightInput(lbs, 'imperial');
          return Math.abs(backToKg - weightKg) <= 0.1;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 7: Height conversion round-trip
   *
   * For any height in cm [100, 250], converting via cmToFtIn and back
   * via ftInToCm produces a value within 1 cm of the original.
   *
   * **Validates: Requirements 8.3**
   */
  it('Property 7: Height conversion round-trip', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 250 }),
        (heightCm) => {
          const { feet, inches } = cmToFtIn(heightCm);
          const backToCm = ftInToCm(feet, inches);
          return Math.abs(backToCm - heightCm) <= 1;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
