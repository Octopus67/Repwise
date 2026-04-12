import type { ProgressionStatus } from './progressionLogic';

/** Subtle background tint for completed set rows based on progression status. */
export function getProgressionBg(status: ProgressionStatus): string {
  switch (status) {
    case 'progressed': return 'rgba(34, 197, 94, 0.08)';
    case 'matched':    return 'rgba(234, 179, 8, 0.08)';
    case 'regressed':  return 'rgba(239, 68, 68, 0.08)';
    case 'no_data':    return 'transparent';
  }
}

/** Left border accent color for progression indicator. */
export function getProgressionBorder(status: ProgressionStatus): string {
  switch (status) {
    case 'progressed': return '#22C55E';
    case 'matched':    return '#EAB308';
    case 'regressed':  return '#EF4444';
    case 'no_data':    return 'transparent';
  }
}
