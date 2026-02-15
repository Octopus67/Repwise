/**
 * Unit Conversion Utility
 *
 * Pure functions for converting between metric and imperial measurement systems.
 * All database values are stored in metric (kg, cm). Conversion is display-only.
 */

export type UnitSystem = 'metric' | 'imperial';

const KG_TO_LBS = 2.20462;
const CM_TO_INCH = 1 / 2.54;
const INCHES_PER_FOOT = 12;

/**
 * Convert a weight value from kg to the target unit system.
 * Returns kg as-is for metric, or pounds (rounded to 1 decimal) for imperial.
 */
export function convertWeight(valueKg: number, to: UnitSystem): number {
  if (to === 'imperial') {
    return Math.round(valueKg * KG_TO_LBS * 10) / 10;
  }
  return Math.round(valueKg * 10) / 10;
}

/**
 * Convert a height value from cm to the target unit system.
 * Returns { value, unit } for metric, or { feet, inches } for imperial.
 */
export function convertHeight(
  valueCm: number,
  to: UnitSystem,
): { value: number; unit: string } | { feet: number; inches: number } {
  if (to === 'imperial') {
    const totalInches = valueCm * CM_TO_INCH;
    const feet = Math.floor(totalInches / INCHES_PER_FOOT);
    const inches = Math.round(totalInches % INCHES_PER_FOOT);
    return { feet, inches };
  }
  return { value: Math.round(valueCm), unit: 'cm' };
}

/**
 * Format a weight value (stored as kg) for display in the given unit system.
 * e.g. "80.0 kg" or "176.4 lbs"
 */
export function formatWeight(valueKg: number, system: UnitSystem): string {
  const converted = convertWeight(valueKg, system);
  const suffix = system === 'metric' ? 'kg' : 'lbs';
  return `${converted.toFixed(1)} ${suffix}`;
}

/**
 * Format a height value (stored as cm) for display in the given unit system.
 * e.g. "180 cm" or "5'11\""
 */
export function formatHeight(valueCm: number, system: UnitSystem): string {
  if (system === 'imperial') {
    const result = convertHeight(valueCm, 'imperial') as { feet: number; inches: number };
    return `${result.feet}'${result.inches}"`;
  }
  return `${Math.round(valueCm)} cm`;
}

/**
 * Parse a weight input value from the user's unit system back to kg for storage.
 * If the user enters in imperial (lbs), convert to kg. Metric input is stored as-is.
 * Always returns kg, rounded to 1 decimal place.
 */
export function parseWeightInput(value: number, system: UnitSystem): number {
  if (system === 'imperial') {
    return Math.round((value / KG_TO_LBS) * 10) / 10;
  }
  return Math.round(value * 10) / 10;
}

/**
 * Convert kg to lbs, rounded to 2 decimal places.
 */
export function kgToLbs(kg: number): number {
  if (isNaN(kg) || !isFinite(kg)) return 0;
  return Math.round(kg * KG_TO_LBS * 100) / 100;
}

/**
 * Convert lbs to kg, rounded to 2 decimal places.
 */
export function lbsToKg(lbs: number): number {
  if (isNaN(lbs) || !isFinite(lbs)) return 0;
  return Math.round((lbs / KG_TO_LBS) * 100) / 100;
}

/**
 * Parse a weight value to kg based on the given unit.
 * If unit is 'lbs', converts to kg. If 'kg', returns as-is.
 */
export function parseWeightToKg(value: number, unit: 'kg' | 'lbs'): number {
  return unit === 'lbs' ? lbsToKg(value) : value;
}

/**
 * Convert a height in centimetres to feet and inches.
 * Useful for imperial height display and editing.
 */
export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  return { feet: Math.floor(totalInches / 12), inches: Math.round(totalInches % 12) };
}

/**
 * Convert feet + inches back to centimetres (rounded).
 * Inverse of cmToFtIn for storing user-entered imperial heights in metric.
 */
export function ftInToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54);
}
