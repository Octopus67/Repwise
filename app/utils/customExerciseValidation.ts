/**
 * Pure validation logic for custom exercise creation.
 * Extracted for testability — no React dependencies.
 */

export const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs',
  'traps', 'forearms', 'full_body',
] as const;

export const EQUIPMENT_TYPES = [
  'barbell', 'dumbbell', 'cable', 'machine',
  'bodyweight', 'band', 'kettlebell', 'smith_machine',
] as const;

export const CATEGORIES = ['compound', 'isolation'] as const;

export type MuscleGroup = typeof MUSCLE_GROUPS[number];
export type EquipmentType = typeof EQUIPMENT_TYPES[number];
export type Category = typeof CATEGORIES[number];

export interface CustomExerciseFormData {
  name: string;
  muscleGroup: string;
  equipment: string;
  category: string;
  secondaryMuscles: string[];
  notes: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateCustomExerciseForm(data: CustomExerciseFormData): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.name.trim()) {
    errors.name = 'Exercise name is required.';
  } else if (data.name.trim().length > 200) {
    errors.name = 'Name must be 200 characters or fewer.';
  }

  if (!data.muscleGroup) {
    errors.muscleGroup = 'Muscle group is required.';
  } else if (!MUSCLE_GROUPS.includes(data.muscleGroup as MuscleGroup)) {
    errors.muscleGroup = 'Invalid muscle group.';
  }

  if (!data.equipment) {
    errors.equipment = 'Equipment is required.';
  } else if (!EQUIPMENT_TYPES.includes(data.equipment as EquipmentType)) {
    errors.equipment = 'Invalid equipment type.';
  }

  if (data.category && !CATEGORIES.includes(data.category as Category)) {
    errors.category = 'Invalid category.';
  }

  for (const mg of data.secondaryMuscles) {
    if (!MUSCLE_GROUPS.includes(mg as MuscleGroup)) {
      errors.secondaryMuscles = `Invalid secondary muscle group: ${mg}`;
      break;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function buildCustomExercisePayload(data: CustomExerciseFormData) {
  return {
    name: data.name.trim(),
    muscle_group: data.muscleGroup,
    equipment: data.equipment,
    category: data.category || 'compound',
    secondary_muscles: data.secondaryMuscles,
    notes: data.notes.trim() || null,
  };
}
