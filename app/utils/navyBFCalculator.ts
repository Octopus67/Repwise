/**
 * Navy Body Fat Calculator
 *
 * Uses the U.S. Navy circumference method to estimate body fat percentage.
 * All inputs in centimetres. Returns percentage (0-100).
 *
 * Male formula:   495 / (1.0324 - 0.19077 * log10(waist - neck) + 0.15456 * log10(height)) - 450
 * Female formula: 495 / (1.29579 - 0.35004 * log10(waist + hips - neck) + 0.22100 * log10(height)) - 450
 */

import type { NavyBFInput } from '../types/measurements';

export function calculateNavyBF(input: NavyBFInput): number | null {
  const { sex, heightCm, waistCm, neckCm, hipsCm } = input;

  if (heightCm <= 0 || waistCm <= 0 || neckCm <= 0) return null;
  if (sex === 'female' && hipsCm <= 0) return null;

  // Guard against log of non-positive numbers
  if (sex === 'male' && waistCm <= neckCm) return null;
  if (sex === 'female' && waistCm + hipsCm <= neckCm) return null;

  let bf: number;

  if (sex === 'male') {
    bf =
      495 /
        (1.0324 -
          0.19077 * Math.log10(waistCm - neckCm) +
          0.15456 * Math.log10(heightCm)) -
      450;
  } else {
    bf =
      495 /
        (1.29579 -
          0.35004 * Math.log10(waistCm + hipsCm - neckCm) +
          0.22100 * Math.log10(heightCm)) -
      450;
  }

  // Clamp to reasonable range
  if (bf < 2 || bf > 60 || !isFinite(bf)) return null;

  return Math.round(bf * 10) / 10;
}

/**
 * Convert inches to cm for Navy BF inputs.
 */
export function inchesToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}

/**
 * Convert cm to inches for display.
 */
export function cmToInches(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}
