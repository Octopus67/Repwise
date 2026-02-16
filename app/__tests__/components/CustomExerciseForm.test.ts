/**
 * Unit tests for custom exercise form validation logic.
 *
 * Tests the pure validation and payload builder functions extracted
 * from the CustomExerciseForm component for testability.
 *
 * **Validates: Requirements 13.1, 13.2, 13.3**
 */

import {
  validateCustomExerciseForm,
  buildCustomExercisePayload,
  MUSCLE_GROUPS,
  EQUIPMENT_TYPES,
  CATEGORIES,
  type CustomExerciseFormData,
} from '../../utils/customExerciseValidation';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeFormData(overrides: Partial<CustomExerciseFormData> = {}): CustomExerciseFormData {
  return {
    name: 'Landmine Press',
    muscleGroup: 'shoulders',
    equipment: 'barbell',
    category: 'compound',
    secondaryMuscles: [],
    notes: '',
    ...overrides,
  };
}

// ─── Validation Tests ───────────────────────────────────────────────────────

describe('validateCustomExerciseForm', () => {
  test('valid form data returns valid=true with no errors', () => {
    const result = validateCustomExerciseForm(makeFormData());
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  test('empty name returns error', () => {
    const result = validateCustomExerciseForm(makeFormData({ name: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  test('whitespace-only name returns error', () => {
    const result = validateCustomExerciseForm(makeFormData({ name: '   ' }));
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  test('name over 200 chars returns error', () => {
    const result = validateCustomExerciseForm(makeFormData({ name: 'A'.repeat(201) }));
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  test('missing muscle group returns error', () => {
    const result = validateCustomExerciseForm(makeFormData({ muscleGroup: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.muscleGroup).toBeDefined();
  });

  test('invalid muscle group returns error', () => {
    const result = validateCustomExerciseForm(makeFormData({ muscleGroup: 'wings' }));
    expect(result.valid).toBe(false);
    expect(result.errors.muscleGroup).toBeDefined();
  });

  test('missing equipment returns error', () => {
    const result = validateCustomExerciseForm(makeFormData({ equipment: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.equipment).toBeDefined();
  });

  test('invalid equipment returns error', () => {
    const result = validateCustomExerciseForm(makeFormData({ equipment: 'sword' }));
    expect(result.valid).toBe(false);
    expect(result.errors.equipment).toBeDefined();
  });

  test('invalid category returns error', () => {
    const result = validateCustomExerciseForm(makeFormData({ category: 'explosive' }));
    expect(result.valid).toBe(false);
    expect(result.errors.category).toBeDefined();
  });

  test('empty category is valid (defaults to compound)', () => {
    const result = validateCustomExerciseForm(makeFormData({ category: '' }));
    // Empty category should be valid — it defaults to compound
    expect(result.errors.category).toBeUndefined();
  });

  test('invalid secondary muscle returns error', () => {
    const result = validateCustomExerciseForm(makeFormData({ secondaryMuscles: ['wings'] }));
    expect(result.valid).toBe(false);
    expect(result.errors.secondaryMuscles).toBeDefined();
  });

  test('valid secondary muscles pass validation', () => {
    const result = validateCustomExerciseForm(
      makeFormData({ secondaryMuscles: ['chest', 'triceps'] })
    );
    expect(result.valid).toBe(true);
  });

  test('all valid muscle groups are accepted', () => {
    for (const mg of MUSCLE_GROUPS) {
      const result = validateCustomExerciseForm(makeFormData({ muscleGroup: mg }));
      expect(result.errors.muscleGroup).toBeUndefined();
    }
  });

  test('all valid equipment types are accepted', () => {
    for (const eq of EQUIPMENT_TYPES) {
      const result = validateCustomExerciseForm(makeFormData({ equipment: eq }));
      expect(result.errors.equipment).toBeUndefined();
    }
  });

  test('all valid categories are accepted', () => {
    for (const cat of CATEGORIES) {
      const result = validateCustomExerciseForm(makeFormData({ category: cat }));
      expect(result.errors.category).toBeUndefined();
    }
  });
});

// ─── Payload Builder Tests ──────────────────────────────────────────────────

describe('buildCustomExercisePayload', () => {
  test('builds correct payload from form data', () => {
    const payload = buildCustomExercisePayload(makeFormData({
      name: '  Landmine Press  ',
      muscleGroup: 'shoulders',
      equipment: 'barbell',
      category: 'compound',
      secondaryMuscles: ['chest'],
      notes: '  Great exercise  ',
    }));

    expect(payload).toEqual({
      name: 'Landmine Press',
      muscle_group: 'shoulders',
      equipment: 'barbell',
      category: 'compound',
      secondary_muscles: ['chest'],
      notes: 'Great exercise',
    });
  });

  test('empty notes become null', () => {
    const payload = buildCustomExercisePayload(makeFormData({ notes: '' }));
    expect(payload.notes).toBeNull();
  });

  test('whitespace-only notes become null', () => {
    const payload = buildCustomExercisePayload(makeFormData({ notes: '   ' }));
    expect(payload.notes).toBeNull();
  });

  test('empty category defaults to compound', () => {
    const payload = buildCustomExercisePayload(makeFormData({ category: '' }));
    expect(payload.category).toBe('compound');
  });

  test('empty secondary muscles produces empty array', () => {
    const payload = buildCustomExercisePayload(makeFormData({ secondaryMuscles: [] }));
    expect(payload.secondary_muscles).toEqual([]);
  });
});

// ─── Constants Tests ────────────────────────────────────────────────────────

describe('Constants', () => {
  test('MUSCLE_GROUPS contains 13 groups', () => {
    expect(MUSCLE_GROUPS).toHaveLength(13);
  });

  test('EQUIPMENT_TYPES contains 8 types', () => {
    expect(EQUIPMENT_TYPES).toHaveLength(8);
  });

  test('CATEGORIES contains compound and isolation', () => {
    expect(CATEGORIES).toContain('compound');
    expect(CATEGORIES).toContain('isolation');
    expect(CATEGORIES).toHaveLength(2);
  });
});
