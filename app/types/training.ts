/**
 * Training Log Redesign — Shared TypeScript Interfaces
 *
 * These types mirror the backend Pydantic schemas defined in:
 *   src/modules/training/schemas.py
 *
 * When modifying types here, check the backend schema file for drift.
 */

import type { UnitSystem } from '../utils/unitConversion';

// ─── Set Types ──────────────────────────────────────────────────────────────

export type SetType = 'normal' | 'warm-up' | 'drop-set' | 'amrap';

// ─── Active Workout State (Zustand slice) ───────────────────────────────────

export interface ActiveSet {
  localId: string;
  setNumber: number;
  weight: string;
  reps: string;
  rpe: string;
  setType: SetType;
  completed: boolean;
  completedAt: string | null;
}

export interface ActiveExercise {
  localId: string;
  exerciseName: string;
  sets: ActiveSet[];
}

export interface SupersetGroup {
  id: string;
  exerciseLocalIds: string[];
}

export interface PreviousPerformanceData {
  exerciseName: string;
  sessionDate: string;
  sets: Array<{ weightKg: number; reps: number; rpe: number | null }>;
}

export interface ActiveWorkoutState {
  workoutId: string;
  mode: 'new' | 'edit';
  editSessionId: string | null;
  sessionDate: string;
  startedAt: string;
  exercises: ActiveExercise[];
  supersetGroups: SupersetGroup[];
  notes: string;
  sourceTemplateId: string | null;
  previousPerformance: Record<string, PreviousPerformanceData | null>;
  previousPerformanceLoading: boolean;
  isActive: boolean;
}

// ─── Active Workout Actions ─────────────────────────────────────────────────

export interface ActiveWorkoutActions {
  // Lifecycle
  startWorkout: (params: {
    mode: 'new' | 'edit';
    editSessionId?: string;
    templateExercises?: ActiveExercise[];
    sessionDate?: string;
  }) => void;
  finishWorkout: () => ActiveWorkoutPayload;
  discardWorkout: () => void;

  // Exercise CRUD
  addExercise: (name: string) => void;
  removeExercise: (localId: string) => void;
  reorderExercises: (fromIndex: number, toIndex: number) => void;

  // Set CRUD
  addSet: (exerciseLocalId: string) => void;
  removeSet: (exerciseLocalId: string, setLocalId: string) => void;
  updateSetField: (
    exerciseLocalId: string,
    setLocalId: string,
    field: 'weight' | 'reps' | 'rpe',
    value: string,
  ) => void;
  updateSetType: (
    exerciseLocalId: string,
    setLocalId: string,
    setType: SetType,
  ) => void;
  toggleSetCompleted: (
    exerciseLocalId: string,
    setLocalId: string,
  ) => { completed: boolean; validationError: string | null };

  // Superset CRUD
  createSuperset: (exerciseLocalIds: string[]) => string | null;
  removeSuperset: (supersetId: string) => void;

  // Previous performance
  setPreviousPerformance: (
    data: Record<string, PreviousPerformanceData | null>,
  ) => void;
  copyPreviousToSet: (exerciseLocalId: string, setLocalId: string) => void;

  // Metadata
  setSessionDate: (date: string) => void;
  setNotes: (notes: string) => void;
}

// ─── API Payloads ───────────────────────────────────────────────────────────

/** Payload sent to POST/PUT /api/v1/training/sessions */
export interface ActiveWorkoutPayload {
  session_date: string;
  exercises: Array<{
    exercise_name: string;
    sets: Array<{
      reps: number;
      weight_kg: number;
      rpe: number | null;
      set_type: SetType;
    }>;
  }>;
  start_time: string | null;
  end_time: string | null;
  metadata: {
    notes?: string;
    superset_groups?: Array<{
      id: string;
      exercise_names: string[];
    }>;
  } | null;
}

// ─── Backend Response Types ─────────────────────────────────────────────────

/** Mirrors backend PersonalRecordResponse */
export interface PersonalRecordResponse {
  exercise_name: string;
  reps: number;
  new_weight_kg: number;
  previous_weight_kg: number | null;
}

/** Mirrors backend TrainingSessionResponse */
export interface TrainingSessionResponse {
  id: string;
  user_id: string;
  session_date: string;
  exercises: Array<{
    exercise_name: string;
    sets: Array<{
      reps: number;
      weight_kg: number;
      rpe: number | null;
      set_type?: string;
    }>;
  }>;
  metadata: Record<string, unknown> | null;
  personal_records: PersonalRecordResponse[];
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  updated_at: string;
}

/** Mirrors backend BatchPreviousPerformanceResponse */
export interface BatchPreviousPerformanceResponse {
  results: Record<string, {
    exercise_name: string;
    session_date: string;
    sets: Array<{ weight_kg: number; reps: number; rpe: number | null }>;
  } | null>;
}

// ─── Template Types ─────────────────────────────────────────────────────────

/** Mirrors backend WorkoutTemplateResponse / UserWorkoutTemplateResponse */
export interface WorkoutTemplateResponse {
  id: string;
  name: string;
  description: string | null;
  exercises: Array<{
    exercise_name: string;
    sets: Array<{
      reps: number;
      weight_kg: number;
      rpe: number | null;
      set_type?: string;
    }>;
  }>;
  metadata?: Record<string, unknown> | null;
  is_system: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Mirrors backend WorkoutTemplateCreate */
export interface WorkoutTemplateCreate {
  name: string;
  description?: string | null;
  exercises: Array<{
    exercise_name: string;
    sets: Array<{
      reps: number;
      weight_kg: number;
      rpe: number | null;
      set_type?: string;
    }>;
  }>;
  metadata?: Record<string, unknown> | null;
}

// ─── Navigation Params ──────────────────────────────────────────────────────

export interface ActiveWorkoutScreenParams {
  mode: 'new' | 'edit' | 'template' | 'copy-last';
  sessionId?: string;
  templateId?: string;
  sessionDate?: string;
}

// ─── Re-export UnitSystem for convenience ───────────────────────────────────

export type { UnitSystem } from '../utils/unitConversion';
