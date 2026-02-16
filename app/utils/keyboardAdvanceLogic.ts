export type FieldName = 'weight' | 'reps' | 'rpe';
export type AdvanceResult = FieldName | 'next-row' | null;

export function getNextField(
  currentField: FieldName,
  rpeEnabled: boolean,
  currentValues: { weight: string; reps: string; rpe: string }
): AdvanceResult {
  const fields: FieldName[] = rpeEnabled
    ? ['weight', 'reps', 'rpe']
    : ['weight', 'reps'];

  const currentIndex = fields.indexOf(currentField);

  // Look for next empty field after current
  for (let i = currentIndex + 1; i < fields.length; i++) {
    if (!currentValues[fields[i]].trim()) return fields[i];
  }

  // All fields after current are filled — check if all fields are filled
  const allFilled = fields.every(f => currentValues[f].trim());
  if (allFilled) return 'next-row';

  // Some earlier field is empty but we don't go backward
  return null;
}
