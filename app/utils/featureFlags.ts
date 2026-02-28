/**
 * Feature Flag Utilities
 *
 * Simple client-side feature flag management.
 * In production, flags would be fetched from the backend and cached in the store.
 * For now, this provides a synchronous check that can be toggled at runtime.
 */

let _trainingLogV2Enabled = true;

/**
 * Set the training_log_v2 feature flag value.
 */
export function setTrainingLogV2Flag(enabled: boolean): void {
  _trainingLogV2Enabled = enabled;
}

/**
 * Check if the training_log_v2 feature flag is enabled.
 */
export function isTrainingLogV2Enabled(): boolean {
  return _trainingLogV2Enabled;
}


// ─── Premium Workout Logger Flag ─────────────────────────────────────────────

let _premiumWorkoutLoggerEnabled = true;

/**
 * Set the premium_workout_logger feature flag value.
 */
export function setPremiumWorkoutLoggerFlag(enabled: boolean): void {
  _premiumWorkoutLoggerEnabled = enabled;
}

/**
 * Check if the premium_workout_logger feature flag is enabled.
 * Gates the new ActiveWorkoutScreen (workout-logging-premium spec).
 */
export function isPremiumWorkoutLoggerEnabled(): boolean {
  return _premiumWorkoutLoggerEnabled;
}
