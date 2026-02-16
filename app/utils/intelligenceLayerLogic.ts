/**
 * Intelligence Layer — Pure logic functions
 *
 * Extracted from OverloadSuggestionBadge and VolumeIndicatorPill
 * so they can be tested without React dependencies.
 *
 * Tasks: 4.5, 4.6, 4.8
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OverloadSuggestionData {
  exercise_name: string;
  suggested_weight_kg: number;
  suggested_reps: number;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface VolumeLandmarks {
  mev: number;
  mav: number;
  mrv: number;
}

export type VolumeColor = 'red' | 'yellow' | 'green';

// ─── Volume Indicator Logic ──────────────────────────────────────────────────

/**
 * Determines the color for a volume indicator pill based on current sets
 * relative to volume landmarks (MEV/MAV/MRV).
 *
 * Below MEV = red (under-training)
 * MEV to MAV = yellow (minimum effective)
 * MAV to MRV = green (optimal)
 * Above MRV = red (over-training)
 */
export function getVolumeColor(
  currentSets: number,
  mev: number,
  mav: number,
  mrv: number,
): VolumeColor {
  if (currentSets < mev) return 'red';
  if (currentSets >= mev && currentSets < mav) return 'yellow';
  if (currentSets >= mav && currentSets <= mrv) return 'green';
  // above MRV
  return 'red';
}

// ─── Overload Suggestion Formatting ──────────────────────────────────────────

/**
 * Formats an overload suggestion into a display string.
 * Returns: "💡 Try {weight}{unit} × {reps} ({reasoning})"
 */
export function formatSuggestionText(
  suggestion: OverloadSuggestionData,
  unitSystem: 'metric' | 'imperial',
): string {
  const unit = unitSystem === 'metric' ? 'kg' : 'lbs';
  const weight = unitSystem === 'metric'
    ? suggestion.suggested_weight_kg
    : Math.round(suggestion.suggested_weight_kg * 2.20462 * 10) / 10;
  return `💡 Try ${weight}${unit} × ${suggestion.suggested_reps} (${suggestion.reasoning})`;
}

// ─── RPE-to-Suggestion Mapping ───────────────────────────────────────────────

/**
 * Maps average RPE to a suggestion type.
 * RPE < 7: increase weight
 * RPE 7-9: increase reps (same weight)
 * RPE > 9: maintain
 */
export type SuggestionType = 'increase_weight' | 'increase_reps' | 'maintain';

export function rpeToSuggestionType(avgRpe: number): SuggestionType {
  if (avgRpe < 7) return 'increase_weight';
  if (avgRpe <= 9) return 'increase_reps';
  return 'maintain';
}

/**
 * Gets the weight increment based on equipment type.
 * Barbell: +2.5kg, Dumbbell/Cable/other: +1kg
 */
export function getWeightIncrement(equipment: string): number {
  if (equipment === 'barbell') return 2.5;
  return 1;
}
