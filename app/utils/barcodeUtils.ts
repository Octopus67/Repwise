/** Validates barcode format: 8-14 digits only */
export function isValidBarcode(barcode: string): boolean {
  return /^\d{8,14}$/.test(barcode);
}

/** Debounce check: returns true if enough time has passed */
export function shouldProcessScan(
  now: number,
  lastScanTime: number,
  debounceMs: number,
): boolean {
  return now - lastScanTime >= debounceMs;
}

/** Scale macro values by multiplier with appropriate rounding */
export function scaleBarcodeResult(
  food: { calories: number; protein_g: number; carbs_g: number; fat_g: number },
  multiplier: number,
): { calories: number; protein_g: number; carbs_g: number; fat_g: number } {
  return {
    calories: Math.round(food.calories * multiplier),
    protein_g: Math.round(food.protein_g * multiplier * 10) / 10,
    carbs_g: Math.round(food.carbs_g * multiplier * 10) / 10,
    fat_g: Math.round(food.fat_g * multiplier * 10) / 10,
  };
}

/** Validates multiplier input: must be a positive finite number */
export function isValidMultiplier(input: string): boolean {
  const n = parseFloat(input);
  return !isNaN(n) && isFinite(n) && n > 0;
}

/**
 * Resolves scanner mode based on platform and feature flag.
 * Returns 'camera' only on mobile with flag enabled.
 */
export function resolveScannerMode(
  platform: 'ios' | 'android' | 'web' | 'windows' | 'macos',
  flagEnabled: boolean,
): 'camera' | 'manual' {
  if (platform === 'web' || platform === 'windows' || platform === 'macos') {
    return 'manual';
  }
  return flagEnabled ? 'camera' : 'manual';
}
