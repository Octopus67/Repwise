import * as fc from 'fast-check';
import {
  templateToActiveExercises,
  activeExercisesToTemplate,
  orderTemplates,
} from '../../utils/templateConversion';
import type { WorkoutTemplateResponse } from '../../types/training';

const NUM_RUNS = 100;

/**
 * Feature: training-log-redesign, Task 8.8
 * **Validates: Requirements 11.2, 11.3, 11.4**
 */

const templateExerciseArb = fc.record({
  exercise_name: fc.string({ minLength: 1, maxLength: 40 }),
  sets: fc.array(
    fc.record({
      reps: fc.integer({ min: 1, max: 50 }),
      weight_kg: fc.float({ min: 0, max: 300, noNaN: true }).map((v) => Math.round(v * 10) / 10),
      rpe: fc.option(fc.float({ min: 1, max: 10, noNaN: true }), { nil: null }),
      set_type: fc.constantFrom('normal', 'warm-up', 'drop-set', 'amrap'),
    }),
    { minLength: 1, maxLength: 5 },
  ),
});

const templateResponseArb: fc.Arbitrary<WorkoutTemplateResponse> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  exercises: fc.array(templateExerciseArb, { minLength: 1, maxLength: 4 }),
  is_system: fc.boolean(),
  created_at: fc.constant('2024-01-15T10:00:00Z'),
  updated_at: fc.constant('2024-01-15T10:00:00Z'),
});

describe('Template Conversion Property Tests', () => {
  /**
   * Property: orderTemplates puts user templates before system templates
   * **Validates: Requirements 11.4**
   */
  it('orderTemplates puts user templates before system templates', () => {
    fc.assert(
      fc.property(
        fc.array(templateResponseArb.map((t) => ({ ...t, is_system: false })), { minLength: 0, maxLength: 5 }),
        fc.array(templateResponseArb.map((t) => ({ ...t, is_system: true })), { minLength: 0, maxLength: 5 }),
        (userTemplates, systemTemplates) => {
          const ordered = orderTemplates(userTemplates, systemTemplates);

          // All user templates come first
          const userCount = userTemplates.length;
          for (let i = 0; i < userCount; i++) {
            if (ordered[i]?.is_system !== false) return false;
          }
          // Then system templates
          for (let i = userCount; i < ordered.length; i++) {
            if (ordered[i]?.is_system !== true) return false;
          }
          return ordered.length === userTemplates.length + systemTemplates.length;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property: Round-trip — templateToActiveExercises then activeExercisesToTemplate
   * preserves exercise names and set counts.
   * **Validates: Requirements 11.2, 11.3**
   */
  it('round-trip preserves exercise names and set counts', () => {
    fc.assert(
      fc.property(
        templateResponseArb,
        fc.constantFrom('metric' as const, 'imperial' as const),
        (template, unit) => {
          const active = templateToActiveExercises(template, unit);
          const roundTrip = activeExercisesToTemplate(active, template.name, template.description ?? undefined);

          // Exercise count preserved
          if (roundTrip.exercises.length !== template.exercises.length) return false;

          // Exercise names preserved
          for (let i = 0; i < template.exercises.length; i++) {
            if (roundTrip.exercises[i].exercise_name !== template.exercises[i].exercise_name) return false;
            // Set count preserved
            if (roundTrip.exercises[i].sets.length !== template.exercises[i].sets.length) return false;
          }

          // Template name preserved
          if (roundTrip.name !== template.name) return false;

          return true;
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
