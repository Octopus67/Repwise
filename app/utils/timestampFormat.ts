/**
 * Entry time formatting and chronological sorting.
 *
 * Pure functions — no React Native imports.
 */

/**
 * Format a created_at ISO datetime string to a localized short time (e.g. "8:30 AM").
 * Returns empty string if input is null/undefined/invalid.
 */
export function formatEntryTime(createdAt: string | null | undefined): string {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Sort entries by created_at ascending. Entries without created_at go last.
 */
export function sortEntriesChronologically<T extends { created_at?: string | null }>(
  entries: T[],
): T[] {
  return [...entries].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : Infinity;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : Infinity;
    return aTime - bTime;
  });
}
