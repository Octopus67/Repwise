import { SetType } from '../types/training';

export type RpeBadgeColor = 'green' | 'yellow' | 'orange' | 'red' | 'none';

export function getRpeBadgeColor(rpe: number): RpeBadgeColor {
  if (rpe >= 6 && rpe <= 7) return 'green';
  if (rpe === 8) return 'yellow';
  if (rpe === 9) return 'orange';
  if (rpe === 10) return 'red';
  return 'none';
}

export function shouldShowTypeBadge(setType: SetType): boolean {
  return setType !== 'normal';
}
