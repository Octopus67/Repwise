/**
 * Session Edit Conversion Utilities
 *
 * Pure functions for converting between backend TrainingSessionResponse
 * and frontend ActiveExercise state, and for PR display formatting.
 */

import type {
  TrainingSessionResponse,
  ActiveExercise,
  PersonalRecordResponse,
  SetType,
} from '../types/training';
import { convertWeight, parseWeightInput, type UnitSystem } from './unitConversion';

/** Payload shape for exercises sent to the backend. */
export interface ExercisePayload {
  exercise_name: string;
  sets: Array<{
    reps: number;
    weight_kg: number;
    rpe: number | null;
    rir: number | null;
    set_type: SetType;
  }>;
}

/**
 * Convert a backend session response into ActiveExercise[] for the workout editor.
 * Weights are converted from kg to the user's unit system.
 */
export function sessionResponseToActiveExercises(
  session: TrainingSessionResponse,
  unitSystem: UnitSystem,
): ActiveExercise[] {
  return session.exercises.map((ex, exIdx) => ({
    localId: `edit-ex-${exIdx}-${Date.now()}`,
    exerciseName: ex.exercise_name,
    sets: ex.sets.map((s, sIdx) => ({
      localId: `edit-set-${exIdx}-${sIdx}-${Date.now()}`,
      setNumber: sIdx + 1,
      weight: String(convertWeight(s.weight_kg, unitSystem)),
      reps: String(s.reps),
      rpe: s.rpe != null ? String(s.rpe) : '',
      rir: '',
      setType: (s.set_type as SetType) || 'normal',
      completed: true,
      completedAt: null,
    })),
  }));
}

/**
 * Convert frontend ActiveExercise[] into the backend exercise payload.
 * Weights are converted from the user's unit system back to kg.
 */
export function activeExercisesToPayload(
  exercises: ActiveExercise[],
  unitSystem: UnitSystem,
): ExercisePayload[] {
  return exercises
    .map((ex) => ({
      exercise_name: ex.exerciseName,
      sets: ex.sets
        .filter((s) => s.completed)
        .map((s) => {
          const reps = Math.min(999, Math.max(0, parseInt(s.reps, 10) || 0));
          const weight_kg = Math.min(9999, Math.max(0, parseWeightInput(parseFloat(s.weight) || 0, unitSystem)));
          const parsedRpe = s.rpe ? parseFloat(s.rpe) : NaN;
          const parsedRir = s.rir ? parseInt(s.rir, 10) : NaN;
          return {
            reps,
            weight_kg,
            rpe: isNaN(parsedRpe) ? null : Math.min(10, Math.max(1, parsedRpe)),
            rir: isNaN(parsedRir) ? null : Math.min(5, Math.max(0, parsedRir)),
            set_type: s.setType,
          };
        })
        .filter((s) => !(s.reps === 0 && s.weight_kg === 0)),
    }))
    .filter((ex) => ex.sets.length > 0);
}

/**
 * Check if a session response contains any personal records.
 */
export function sessionHasPR(session: TrainingSessionResponse): boolean {
  return session.personal_records.length > 0;
}

/**
 * Format a single PR for banner display.
 */
export function formatPRBanner(
  pr: PersonalRecordResponse,
  unitSystem: UnitSystem,
): { type: string; exerciseName: string; value: string } {
  const weight = convertWeight(pr.new_weight_kg, unitSystem);
  const unit = unitSystem === 'metric' ? 'kg' : 'lbs';
  return {
    type: 'weight',
    exerciseName: pr.exercise_name,
    value: `${weight}${unit} × ${pr.reps}`,
  };
}
