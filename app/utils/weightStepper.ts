/**
 * Weight Stepper Utility
 *
 * Pure function for incrementing/decrementing weight values
 * based on the user's unit system preference.
 *
 * Metric: ±2.5 kg steps
 * Imperial: ±5 lbs steps (converted to kg for internal storage)
 */

import { type UnitSystem, lbsToKg } from './unitConversion';

const METRIC_STEP_KG = 2.5;
const IMPERIAL_STEP_LBS = 5;

/**
 * Step a weight value up or down by the appropriate increment.
 * All values are in kg internally. Imperial steps are converted to kg.
 * Result is always >= 0.
 */
export function stepWeight(
  currentKg: number,
  direction: 'up' | 'down',
  unitSystem: UnitSystem,
): number {
  const stepKg =
    unitSystem === 'imperial' ? lbsToKg(IMPERIAL_STEP_LBS) : METRIC_STEP_KG;

  if (direction === 'up') {
    return Math.round((currentKg + stepKg) * 100) / 100;
  }

  const result = currentKg - stepKg;
  return result < 0 ? 0 : Math.round(result * 100) / 100;
}
