/**
 * Duration Formatting Utilities
 *
 * Pure functions for formatting workout duration and rest timer displays.
 */

/**
 * Format elapsed seconds for display.
 * Returns "MM:SS" when < 3600 seconds, "H:MM:SS" when >= 3600 seconds.
 * Minutes and seconds are always zero-padded to 2 digits.
 */
export function formatDuration(elapsedSeconds: number): string {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    return '00:00';
  }
  const total = Math.floor(elapsedSeconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Format remaining seconds as "M:SS" (no leading zero on minutes).
 * Returns "0:00" for negative or NaN input.
 */
export function formatRestTimer(remainingSeconds: number): string {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds < 0) {
    return '0:00';
  }
  const total = Math.floor(remainingSeconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
