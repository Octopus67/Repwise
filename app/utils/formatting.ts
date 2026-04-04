/**
 * Shared formatting utilities.
 *
 * Consolidates duplicated formatting functions from across the codebase.
 */

/** Format a Date as YYYY-MM-DD string. */
export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format a Date for user-facing display (e.g. "Jan 5, 2025"). */
export function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Convert a hex color string to rgba. */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Title-case a snake_case muscle name (e.g. "upper_chest" → "Upper Chest"). */
export function formatMuscle(muscle: string): string {
  return muscle
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Title-case an exercise name (e.g. "barbell bench press" → "Barbell Bench Press"). */
export function formatExerciseName(name: string): string {
  return name.split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}
