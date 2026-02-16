import { ActiveExercise } from '../types/training';

export interface WorkoutSummary {
  exerciseCount: number;
  completedSetCount: number;
  totalVolumeKg: number;
  durationSeconds: number;
}

export function computeWorkoutSummary(
  exercises: ActiveExercise[],
  startedAt: string
): WorkoutSummary {
  const activeExercises = exercises.filter(e => !(e as any).skipped);
  const completedSets = activeExercises.flatMap(e => e.sets).filter(s => s.completed);
  const totalVolumeKg = completedSets.reduce((sum, s) => {
    const w = parseFloat(s.weight) || 0;
    const r = parseInt(s.reps, 10) || 0;
    return sum + w * r;
  }, 0);
  const durationSeconds = startedAt
    ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    : 0;

  return {
    exerciseCount: activeExercises.length,
    completedSetCount: completedSets.length,
    totalVolumeKg,
    durationSeconds,
  };
}

export function formatMiniSummary(summary: WorkoutSummary): string {
  const mins = Math.floor(summary.durationSeconds / 60);
  return `${summary.exerciseCount} exercises · ${summary.completedSetCount} sets · ${mins} min`;
}
