/**
 * RPE/RIR conversion utilities
 *
 * Pure functions for converting between RPE and RIR scales.
 * Formula: RPE = 10 - RIR (so RIR 0 = RPE 10, RIR 1 = RPE 9, etc.)
 *
 * Extracted to a separate file so tests can import without React dependencies.
 *
 * Task: 3c.1
 */

/** RPE quick-select values */
export const RPE_VALUES: number[] = [6, 7, 8, 9, 10];

/** RIR quick-select values (4 means "4+") */
export const RIR_VALUES: number[] = [4, 3, 2, 1, 0];

/** Convert RIR to RPE for storage. RPE = 10 - RIR */
export function rirToRpe(rir: number): number {
  return 10 - rir;
}

/** Convert RPE to RIR for display. RIR = 10 - RPE */
export function rpeToRir(rpe: number): number {
  return 10 - rpe;
}

/** Get display label for an RIR value (4 shows as "4+") */
export function getRirDisplayLabel(rir: number): string {
  return rir >= 4 ? '4+' : String(rir);
}

/**
 * Convert a stored RPE value to the display value in the user's preferred mode.
 * Returns the string to show in the set row.
 */
export function getDisplayValue(storedRpe: string, mode: 'rpe' | 'rir'): string {
  if (!storedRpe || storedRpe.trim() === '') return '';
  const rpeNum = parseFloat(storedRpe);
  if (isNaN(rpeNum)) return '';
  if (mode === 'rpe') return String(rpeNum);
  const rir = rpeToRir(rpeNum);
  return getRirDisplayLabel(rir);
}
