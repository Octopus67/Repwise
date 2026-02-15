/**
 * Quick add input validation.
 *
 * Pure function — no React Native imports.
 */

export interface QuickAddResult {
  valid: boolean;
  error?: string;
  needsConfirmation?: boolean;
}

/**
 * Validate a quick-add calorie value.
 *
 * - calories <= 0 → invalid with error message
 * - calories > 10000 → valid but needs confirmation
 * - otherwise → valid
 */
export function validateQuickAdd(calories: number): QuickAddResult {
  if (isNaN(calories)) return { valid: false, error: 'Invalid calorie value' };
  if (calories <= 0) {
    return { valid: false, error: 'Calories must be greater than zero' };
  }
  if (calories > 10000) {
    return { valid: true, needsConfirmation: true };
  }
  return { valid: true };
}
