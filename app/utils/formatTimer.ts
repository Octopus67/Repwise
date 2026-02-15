/**
 * Format a duration in seconds to "M:SS" display format.
 *
 * Examples:
 *   formatTimer(150) → "2:30"
 *   formatTimer(5)   → "0:05"
 *   formatTimer(0)   → "0:00"
 */
export function formatTimer(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
