/**
 * exerciseDetailLogic — Pure helper functions for ExerciseDetailSheet
 *
 * Extracted for testability. These determine what sections to show
 * and how to format exercise data for the detail sheet.
 */

import type { Exercise } from '../types/exercise';

/** Whether the exercise has instructions to display */
export function shouldShowInstructions(exercise: Exercise): boolean {
  return Array.isArray(exercise.instructions) && exercise.instructions.length > 0;
}

/** Whether the exercise has tips to display */
export function shouldShowTips(exercise: Exercise): boolean {
  return Array.isArray(exercise.tips) && exercise.tips.length > 0;
}

/** Whether the exercise has an image (static or animated) to display */
export function shouldShowImage(exercise: Exercise): boolean {
  return (
    (typeof exercise.image_url === 'string' && exercise.image_url.length > 0) ||
    (typeof exercise.animation_url === 'string' && exercise.animation_url.length > 0)
  );
}

/** Get the best image URL — prefer animation_url over image_url */
export function getDisplayImageUrl(exercise: Exercise): string | null {
  if (typeof exercise.animation_url === 'string' && exercise.animation_url.length > 0) {
    return exercise.animation_url;
  }
  if (typeof exercise.image_url === 'string' && exercise.image_url.length > 0) {
    return exercise.image_url;
  }
  return null;
}

/** Build the list of muscles targeted: primary + secondary */
export function getMusclesTargeted(exercise: Exercise): { primary: string; secondary: string[] } {
  return {
    primary: exercise.muscle_group,
    secondary: Array.isArray(exercise.secondary_muscles) ? exercise.secondary_muscles : [],
  };
}

/** Format tags for display: muscle group, equipment, category */
export function getExerciseTags(exercise: Exercise): string[] {
  const tags: string[] = [];
  if (exercise.muscle_group) {
    tags.push(exercise.muscle_group.replace(/_/g, ' '));
  }
  if (exercise.equipment) {
    tags.push(exercise.equipment.replace(/_/g, ' '));
  }
  if (exercise.category) {
    tags.push(exercise.category);
  }
  return tags;
}
