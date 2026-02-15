/**
 * Previous Performance Formatting
 *
 * Pure function for displaying previous set data in the Set_Row Previous_Column.
 */

import type { PreviousPerformanceData } from '../types/training';
import { convertWeight, type UnitSystem } from './unitConversion';

/**
 * Format a single set's previous performance for display.
 * Returns e.g. "80kg × 8" or "176.4lbs × 8" or "—".
 */
export function formatPreviousPerformance(
  data: PreviousPerformanceData | null,
  setIndex: number,
  unitSystem: UnitSystem,
): string {
  if (!data || setIndex < 0 || setIndex >= data.sets.length) {
    return '—';
  }
  const set = data.sets[setIndex];
  const weight = convertWeight(set.weightKg, unitSystem);
  const unit = unitSystem === 'metric' ? 'kg' : 'lbs';
  return `${weight}${unit} × ${set.reps}`;
}
