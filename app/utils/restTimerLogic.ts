/**
 * Rest timer logic utilities — pure functions, no side effects.
 * Requirements: 8.3, 8.6, 8.7
 */

/** Adjust remaining time by delta, clamped to >= 0. */
export function adjustTime(remaining: number, delta: number): number {
  return Math.max(0, remaining + delta);
}

/** Timer color based on remaining vs total duration. */
export function getTimerColor(
  remaining: number,
  total: number,
): 'green' | 'yellow' | 'red' {
  if (remaining <= 10) return 'red';
  if (remaining <= total / 2) return 'yellow';
  return 'green';
}

/** Resolve rest duration with precedence: per-exercise override > compound/isolation default. */
export function resolveRestDuration(
  exerciseName: string,
  exerciseOverrides: Record<string, number>,
  compoundDefault: number,
  isolationDefault: number,
  exerciseDb: Array<{ name: string; category: string }>,
): number {
  if (Object.prototype.hasOwnProperty.call(exerciseOverrides, exerciseName)) {
    return exerciseOverrides[exerciseName];
  }

  const entry = exerciseDb.find((e) => e.name === exerciseName);
  if (entry && entry.category === 'compound') {
    return compoundDefault;
  }

  return isolationDefault;
}
