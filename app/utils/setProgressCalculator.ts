import { ActiveSet } from '../types/training';

export interface SetProgress {
  completed: number;
  total: number;
  allComplete: boolean;
}

export function calculateSetProgress(sets: ActiveSet[]): SetProgress {
  const completed = sets.filter(s => s.completed).length;
  return {
    completed,
    total: sets.length,
    allComplete: sets.length > 0 && completed === sets.length,
  };
}
