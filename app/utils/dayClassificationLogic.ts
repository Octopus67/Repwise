/**
 * Utility functions for day classification display formatting.
 */

/**
 * Format a raw muscle group name for display.
 * "quads" → "Quads", "full_body" → "Full Body", "Other" → "Other"
 *
 * Returns empty string for null/undefined/empty input.
 */
export function formatMuscleGroup(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format an array of raw muscle group names for display.
 * Filters out any null/undefined/empty entries.
 */
export function formatMuscleGroups(groups: (string | null | undefined)[]): string[] {
  if (!Array.isArray(groups)) return [];
  return groups
    .map(formatMuscleGroup)
    .filter((g): g is string => g.length > 0);
}
