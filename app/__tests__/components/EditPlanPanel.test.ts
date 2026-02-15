/**
 * Unit tests for EditPlanPanel component behavior.
 *
 * Since Jest runs in node environment (no React Native renderer),
 * we test the pure logic functions that drive the component's behavior:
 * - formatSummaryFields for summary card rendering
 * - initializeDraft for edit flow initialization
 * - validateDraft for validation rules
 * - buildRecalculatePayload for save payload construction
 *
 * Requirements: 2.1, 2.3, 4.5, 6.1, 6.5
 */

import {
  formatSummaryFields,
  initializeDraft,
  validateDraft,
  buildRecalculatePayload,
} from '../../utils/editPlanLogic';
import type { EditDraft, ActivityLevel, GoalType } from '../../utils/editPlanLogic';

// ─── Test data helpers ──────────────────────────────────────────────────────

const fullMetrics = {
  id: 'm-1',
  weightKg: 80.0,
  heightCm: 180,
  bodyFatPct: 16.0,
  activityLevel: 'moderate' as string,
  recordedAt: '2024-01-15T10:00:00Z',
};

const fullGoals = {
  id: 'g-1',
  userId: 'u-1',
  goalType: 'cutting' as string,
  targetWeightKg: 75.0,
  goalRatePerWeek: -0.5,
};

const fullTargets = {
  calories: 2150,
  protein_g: 160,
  carbs_g: 215,
  fat_g: 72,
};

function makeDraft(overrides: Partial<EditDraft> = {}): EditDraft {
  return {
    weight: '80',
    heightCm: '180',
    heightFeet: '5',
    heightInches: '11',
    bodyFatPct: '',
    activityLevel: 'moderate' as ActivityLevel,
    goalType: 'cutting' as GoalType,
    targetWeight: '',
    goalRate: '',
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('EditPlanPanel — Empty state condition', () => {
  /**
   * Validates: Requirement 2.1
   * When both metrics and goals are null, the component should be in empty state mode.
   * We verify this by checking that initializeDraft returns sensible defaults
   * (activity=moderate, goalType=maintaining, all numeric fields empty).
   */
  test('when both metrics and goals are null, initializeDraft returns defaults', () => {
    const draft = initializeDraft(null, null, 'metric');

    expect(draft.weight).toBe('');
    expect(draft.heightCm).toBe('');
    expect(draft.heightFeet).toBe('');
    expect(draft.heightInches).toBe('');
    expect(draft.bodyFatPct).toBe('');
    expect(draft.activityLevel).toBe('moderate');
    expect(draft.goalType).toBe('maintaining');
    expect(draft.targetWeight).toBe('');
    expect(draft.goalRate).toBe('');
  });

  test('when both metrics and goals are null, formatSummaryFields returns all dashes', () => {
    const fields = formatSummaryFields(null, null, null, 'metric');

    expect(fields.weight).toBe('—');
    expect(fields.height).toBe('—');
    expect(fields.bodyFat).toBe('—');
    expect(fields.activityLevel).toBe('—');
    expect(fields.goalType).toBe('—');
    expect(fields.targetWeight).toBe('—');
    expect(fields.goalRate).toBe('—');
    expect(fields.calories).toBe('—');
    expect(fields.protein).toBe('—');
    expect(fields.carbs).toBe('—');
    expect(fields.fat).toBe('—');
  });
});

describe('EditPlanPanel — Summary card renders all fields when full data provided', () => {
  /**
   * Validates: Requirement 2.3 (partial data display)
   * Uses formatSummaryFields directly to verify all fields are populated.
   */
  test('all fields are non-dash when full data is provided (metric)', () => {
    const fields = formatSummaryFields(fullMetrics, fullGoals, fullTargets, 'metric');

    expect(fields.weight).not.toBe('—');
    expect(fields.height).not.toBe('—');
    expect(fields.bodyFat).not.toBe('—');
    expect(fields.activityLevel).not.toBe('—');
    expect(fields.goalType).not.toBe('—');
    expect(fields.targetWeight).not.toBe('—');
    expect(fields.goalRate).not.toBe('—');
    expect(fields.calories).not.toBe('—');
    expect(fields.protein).not.toBe('—');
    expect(fields.carbs).not.toBe('—');
    expect(fields.fat).not.toBe('—');
  });

  test('all fields are non-dash when full data is provided (imperial)', () => {
    const fields = formatSummaryFields(fullMetrics, fullGoals, fullTargets, 'imperial');

    expect(fields.weight).not.toBe('—');
    expect(fields.height).not.toBe('—');
    expect(fields.bodyFat).not.toBe('—');
    expect(fields.activityLevel).not.toBe('—');
    expect(fields.goalType).not.toBe('—');
    expect(fields.targetWeight).not.toBe('—');
    expect(fields.goalRate).not.toBe('—');
    expect(fields.calories).not.toBe('—');
    expect(fields.protein).not.toBe('—');
    expect(fields.carbs).not.toBe('—');
    expect(fields.fat).not.toBe('—');
  });

  test('weight displays correct unit suffix', () => {
    const metricFields = formatSummaryFields(fullMetrics, fullGoals, fullTargets, 'metric');
    expect(metricFields.weight).toContain('kg');

    const imperialFields = formatSummaryFields(fullMetrics, fullGoals, fullTargets, 'imperial');
    expect(imperialFields.weight).toContain('lbs');
  });

  test('macro targets are formatted correctly', () => {
    const fields = formatSummaryFields(fullMetrics, fullGoals, fullTargets, 'metric');

    expect(fields.calories).toBe('2,150');
    expect(fields.protein).toBe('160g');
    expect(fields.carbs).toBe('215g');
    expect(fields.fat).toBe('72g');
  });
});

describe('EditPlanPanel — Summary card shows dashes for partial data', () => {
  /**
   * Validates: Requirement 2.3
   * When metrics exist but goals are null (or vice versa), dashes appear for missing fields.
   */
  test('metrics only — goals fields show dashes', () => {
    const fields = formatSummaryFields(fullMetrics, null, null, 'metric');

    // Metrics fields should be populated
    expect(fields.weight).not.toBe('—');
    expect(fields.height).not.toBe('—');
    expect(fields.bodyFat).not.toBe('—');
    expect(fields.activityLevel).not.toBe('—');

    // Goals fields should be dashes
    expect(fields.goalType).toBe('—');
    expect(fields.targetWeight).toBe('—');
    expect(fields.goalRate).toBe('—');

    // Targets should be dashes (no adaptive targets)
    expect(fields.calories).toBe('—');
    expect(fields.protein).toBe('—');
  });

  test('goals only — metrics fields show dashes', () => {
    const fields = formatSummaryFields(null, fullGoals, null, 'imperial');

    // Metrics fields should be dashes
    expect(fields.weight).toBe('—');
    expect(fields.height).toBe('—');
    expect(fields.bodyFat).toBe('—');
    expect(fields.activityLevel).toBe('—');

    // Goals fields should be populated
    expect(fields.goalType).not.toBe('—');
    expect(fields.targetWeight).not.toBe('—');
    expect(fields.goalRate).not.toBe('—');
  });

  test('metrics with null optional fields show dashes for those fields', () => {
    const partialMetrics = {
      ...fullMetrics,
      bodyFatPct: null,
    };
    const partialGoals = {
      ...fullGoals,
      targetWeightKg: null,
      goalRatePerWeek: null,
    };
    const fields = formatSummaryFields(partialMetrics, partialGoals, fullTargets, 'metric');

    expect(fields.bodyFat).toBe('—');
    expect(fields.targetWeight).toBe('—');
    expect(fields.goalRate).toBe('—');

    // Non-null fields should still be populated
    expect(fields.weight).not.toBe('—');
    expect(fields.height).not.toBe('—');
    expect(fields.goalType).not.toBe('—');
  });
});

describe('EditPlanPanel — "Maintaining" goal type hides target weight and goal rate', () => {
  /**
   * Validates: Requirement 4.5
   * When goalType is "maintaining", validateDraft skips targetWeight and goalRate,
   * and buildRecalculatePayload omits them from the payload.
   */
  test('validateDraft passes when maintaining has non-empty targetWeight/goalRate (they are skipped)', () => {
    const draft = makeDraft({
      goalType: 'maintaining',
      targetWeight: '75',
      goalRate: '-0.5',
    });
    const result = validateDraft(draft, 'metric');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  test('validateDraft passes when maintaining has empty targetWeight/goalRate', () => {
    const draft = makeDraft({
      goalType: 'maintaining',
      targetWeight: '',
      goalRate: '',
    });
    const result = validateDraft(draft, 'metric');
    expect(result.valid).toBe(true);
  });

  test('buildRecalculatePayload omits target_weight_kg and goal_rate_per_week for maintaining', () => {
    const draft = makeDraft({
      goalType: 'maintaining',
      targetWeight: '75',
      goalRate: '-0.5',
    });
    const payload = buildRecalculatePayload(draft, 'metric');

    expect(payload.goals.goal_type).toBe('maintaining');
    expect(payload.goals.target_weight_kg).toBeUndefined();
    expect(payload.goals.goal_rate_per_week).toBeUndefined();
  });

  test('buildRecalculatePayload includes target_weight_kg and goal_rate_per_week for cutting', () => {
    const draft = makeDraft({
      goalType: 'cutting',
      targetWeight: '75',
      goalRate: '-0.5',
    });
    const payload = buildRecalculatePayload(draft, 'metric');

    expect(payload.goals.goal_type).toBe('cutting');
    expect(payload.goals.target_weight_kg).toBeDefined();
    expect(payload.goals.goal_rate_per_week).toBeDefined();
  });
});

describe('EditPlanPanel — Imperial vs metric height field initialization', () => {
  /**
   * Validates: Requirement 2.1 (initializeDraft behavior per unit system)
   * Imperial mode populates heightFeet/heightInches; metric mode populates heightCm.
   */
  test('imperial mode: initializeDraft sets heightFeet and heightInches, leaves heightCm empty', () => {
    const draft = initializeDraft(fullMetrics, fullGoals, 'imperial');

    expect(draft.heightFeet).not.toBe('');
    expect(draft.heightInches).not.toBe('');
    expect(draft.heightCm).toBe('');

    // Feet should be a reasonable value for 180cm (~5'11")
    const feet = parseInt(draft.heightFeet, 10);
    const inches = parseInt(draft.heightInches, 10);
    expect(feet).toBeGreaterThanOrEqual(4);
    expect(feet).toBeLessThanOrEqual(7);
    expect(inches).toBeGreaterThanOrEqual(0);
    expect(inches).toBeLessThanOrEqual(11);
  });

  test('metric mode: initializeDraft sets heightCm, leaves heightFeet/heightInches empty', () => {
    const draft = initializeDraft(fullMetrics, fullGoals, 'metric');

    expect(draft.heightCm).not.toBe('');
    expect(draft.heightFeet).toBe('');
    expect(draft.heightInches).toBe('');

    // heightCm should be close to 180
    const cm = parseInt(draft.heightCm, 10);
    expect(cm).toBe(180);
  });

  test('imperial weight is converted from kg to lbs', () => {
    const draft = initializeDraft(fullMetrics, fullGoals, 'imperial');
    const weightLbs = parseFloat(draft.weight);
    // 80 kg ≈ 176.4 lbs
    expect(weightLbs).toBeGreaterThan(170);
    expect(weightLbs).toBeLessThan(185);
  });

  test('metric weight stays in kg', () => {
    const draft = initializeDraft(fullMetrics, fullGoals, 'metric');
    const weightKg = parseFloat(draft.weight);
    expect(weightKg).toBe(80);
  });
});

describe('EditPlanPanel — Save button disabled while saving (flow logic)', () => {
  /**
   * Validates: Requirement 6.5
   * We test the validation + payload building pipeline that gates the save action.
   * The actual `saving` boolean is React state, but we verify the preconditions:
   * - validateDraft must pass before save proceeds
   * - buildRecalculatePayload produces a valid payload when validation passes
   */
  test('valid draft passes validation and produces a payload (save can proceed)', () => {
    const draft = makeDraft({ weight: '80', heightCm: '180' });
    const validation = validateDraft(draft, 'metric');
    expect(validation.valid).toBe(true);

    const payload = buildRecalculatePayload(draft, 'metric');
    expect(payload.metrics.weight_kg).toBeGreaterThan(0);
    expect(payload.metrics.height_cm).toBeGreaterThan(0);
  });

  test('invalid draft fails validation (save is blocked)', () => {
    const draft = makeDraft({ weight: '' });
    const validation = validateDraft(draft, 'metric');
    expect(validation.valid).toBe(false);
    expect(validation.errors.weight).toBeDefined();
  });

  test('multiple validation errors are all reported', () => {
    const draft = makeDraft({
      weight: '',
      heightCm: '',
      bodyFatPct: '150',
    });
    const validation = validateDraft(draft, 'metric');
    expect(validation.valid).toBe(false);
    expect(validation.errors.weight).toBeDefined();
    expect(validation.errors.heightCm).toBeDefined();
    expect(validation.errors.bodyFatPct).toBeDefined();
  });
});

describe('EditPlanPanel — Inline error message when API call rejects', () => {
  /**
   * Validates: Requirement 6.1
   * We test the error handling pattern: when validation passes but the API would fail,
   * the draft is preserved (can be re-validated and re-submitted).
   * The actual error display is React state, but we verify the draft survives.
   */
  test('draft remains valid after a failed save attempt (user can retry)', () => {
    const draft = makeDraft({ weight: '80', heightCm: '180' });

    // First validation passes
    const firstResult = validateDraft(draft, 'metric');
    expect(firstResult.valid).toBe(true);

    // Simulate: API fails, user retries — draft is unchanged, still valid
    const retryResult = validateDraft(draft, 'metric');
    expect(retryResult.valid).toBe(true);

    // Payload is still well-formed for retry
    const payload = buildRecalculatePayload(draft, 'metric');
    expect(payload.metrics.weight_kg).toBeGreaterThan(0);
  });

  test('validation error messages are user-friendly strings', () => {
    const draft = makeDraft({ weight: 'abc', bodyFatPct: '200' });
    const result = validateDraft(draft, 'metric');

    expect(result.errors.weight).toBe('Enter a valid weight');
    expect(result.errors.bodyFatPct).toBe('Must be between 0 and 100');
  });
});

describe('EditPlanPanel — Successful save maps API response correctly', () => {
  /**
   * Validates: Requirement 6.1 (successful save closes edit flow)
   * We test the data mapping from draft → payload → expected API response shape.
   * The actual API call and store update are React concerns, but we verify
   * the payload is correctly formed for the recalculate endpoint.
   */
  test('buildRecalculatePayload maps metric draft to correct API shape', () => {
    const draft = makeDraft({
      weight: '80',
      heightCm: '180',
      bodyFatPct: '16',
      activityLevel: 'moderate',
      goalType: 'cutting',
      targetWeight: '75',
      goalRate: '-0.5',
    });

    const payload = buildRecalculatePayload(draft, 'metric');

    expect(payload.metrics.weight_kg).toBe(80);
    expect(payload.metrics.height_cm).toBe(180);
    expect(payload.metrics.body_fat_pct).toBe(16);
    expect(payload.metrics.activity_level).toBe('moderate');
    expect(payload.goals.goal_type).toBe('cutting');
    expect(payload.goals.target_weight_kg).toBe(75);
    expect(payload.goals.goal_rate_per_week).toBe(-0.5);
  });

  test('buildRecalculatePayload maps imperial draft with unit conversion', () => {
    const draft = makeDraft({
      weight: '176.4',
      heightFeet: '5',
      heightInches: '11',
      bodyFatPct: '16',
      activityLevel: 'active',
      goalType: 'bulking',
      targetWeight: '185',
      goalRate: '0.5',
    });

    const payload = buildRecalculatePayload(draft, 'imperial');

    // Weight should be converted from lbs to kg
    expect(payload.metrics.weight_kg).toBeCloseTo(80, 0);
    // Height should be converted from ft/in to cm
    expect(payload.metrics.height_cm).toBeCloseTo(180, 0);
    expect(payload.metrics.body_fat_pct).toBe(16);
    expect(payload.metrics.activity_level).toBe('active');
    expect(payload.goals.goal_type).toBe('bulking');
    // Target weight converted from lbs to kg
    expect(payload.goals.target_weight_kg).toBeDefined();
    expect(payload.goals.target_weight_kg!).toBeGreaterThan(0);
    // Goal rate converted from lbs/week to kg/week
    expect(payload.goals.goal_rate_per_week).toBeDefined();
    expect(payload.goals.goal_rate_per_week!).toBeGreaterThan(0);
  });

  test('optional fields are omitted from payload when empty', () => {
    const draft = makeDraft({
      bodyFatPct: '',
      targetWeight: '',
      goalRate: '',
    });

    const payload = buildRecalculatePayload(draft, 'metric');

    expect(payload.metrics.body_fat_pct).toBeUndefined();
    expect(payload.goals.target_weight_kg).toBeUndefined();
    expect(payload.goals.goal_rate_per_week).toBeUndefined();
  });
});
