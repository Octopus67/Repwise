/**
 * Plate Calculator Utility
 *
 * Pure function that computes the plate breakdown per side for a given barbell weight.
 * Uses a greedy algorithm: subtract bar weight, divide by 2, fill from largest plate down.
 *
 * All internal calculations are in kg. The unitSystem param selects which plate set to use.
 */

import type { UnitSystem } from './unitConversion';

export interface PlateBreakdown {
  barWeightKg: number;
  totalWeightKg: number;
  platesPerSide: Array<{ weightKg: number; count: number }>;
  achievableWeightKg: number;
  isExact: boolean;
}

/** Standard metric plates in kg, largest first */
const METRIC_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Standard imperial plates converted to kg (from [45, 35, 25, 10, 5, 2.5] lbs) */
const IMPERIAL_PLATES_KG = [20.4117, 15.876, 11.34, 4.536, 2.268, 1.134];

const DEFAULT_BAR_WEIGHT_KG = 20;

export function calculatePlates(
  targetWeightKg: number,
  barWeightKg: number = DEFAULT_BAR_WEIGHT_KG,
  unitSystem: UnitSystem = 'metric',
): PlateBreakdown {
  // Edge case: weight <= bar or zero/negative
  if (targetWeightKg <= barWeightKg) {
    return {
      barWeightKg,
      totalWeightKg: targetWeightKg,
      platesPerSide: [],
      achievableWeightKg: barWeightKg,
      isExact: true,
    };
  }

  const plates = unitSystem === 'imperial' ? IMPERIAL_PLATES_KG : METRIC_PLATES_KG;
  const weightPerSide = (targetWeightKg - barWeightKg) / 2;

  // Greedy fill from largest plate down
  const platesPerSide: Array<{ weightKg: number; count: number }> = [];
  let remaining = weightPerSide;

  for (const plate of plates) {
    if (remaining < plate - 1e-9) continue;
    const count = Math.floor((remaining + 1e-9) / plate);
    if (count > 0) {
      platesPerSide.push({ weightKg: plate, count });
      remaining -= count * plate;
    }
  }

  // Round remaining to avoid floating point dust
  remaining = Math.round(remaining * 10000) / 10000;

  const achievedPerSide = weightPerSide - remaining;
  const achievableWeightKg =
    Math.round((barWeightKg + achievedPerSide * 2) * 10000) / 10000;
  const isExact = remaining < 1e-9;

  return {
    barWeightKg,
    totalWeightKg: targetWeightKg,
    platesPerSide,
    achievableWeightKg,
    isExact,
  };
}
