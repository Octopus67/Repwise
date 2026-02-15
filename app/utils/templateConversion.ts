/**
 * Template Conversion Utilities
 *
 * Pure functions for converting between WorkoutTemplateResponse
 * and ActiveExercise state, and for ordering templates.
 */

import type {
  WorkoutTemplateResponse,
  WorkoutTemplateCreate,
  ActiveExercise,
  SetType,
} from '../types/training';
import { convertWeight, parseWeightInput, type UnitSystem } from './unitConversion';

/**
 * Convert a template response into ActiveExercise[] for the workout editor.
 * Weights are converted from kg to the user's unit system.
 */
export function templateToActiveExercises(
  template: WorkoutTemplateResponse,
  unitSystem: UnitSystem,
): ActiveExercise[] {
  return template.exercises.map((ex, exIdx) => ({
    localId: `tmpl-ex-${exIdx}-${Date.now()}`,
    exerciseName: ex.exercise_name,
    sets: ex.sets.map((s, sIdx) => ({
      localId: `tmpl-set-${exIdx}-${sIdx}-${Date.now()}`,
      setNumber: sIdx + 1,
      weight: s.weight_kg > 0 ? String(convertWeight(s.weight_kg, unitSystem)) : '',
      reps: s.reps > 0 ? String(s.reps) : '',
      rpe: s.rpe != null ? String(s.rpe) : '',
      setType: (s.set_type as SetType) || 'normal',
      completed: false,
      completedAt: null,
    })),
  }));
}

/**
 * Convert current workout exercises into a template create payload.
 * Weights are converted from the user's display unit back to kg.
 * Note: we store template weights as-is in kg (0 if empty).
 */
export function activeExercisesToTemplate(
  exercises: ActiveExercise[],
  name: string,
  description?: string,
): WorkoutTemplateCreate {
  return {
    name,
    description: description ?? null,
    exercises: exercises.map((ex) => ({
      exercise_name: ex.exerciseName,
      sets: ex.sets.map((s) => ({
        reps: parseInt(s.reps, 10) || 0,
        weight_kg: parseFloat(s.weight) || 0,
        rpe: s.rpe ? parseFloat(s.rpe) : null,
        set_type: s.setType,
      })),
    })),
  };
}

/**
 * Order templates: user-created first, then system templates.
 */
export function orderTemplates(
  userTemplates: WorkoutTemplateResponse[],
  systemTemplates: WorkoutTemplateResponse[],
): WorkoutTemplateResponse[] {
  return [...userTemplates, ...systemTemplates];
}
