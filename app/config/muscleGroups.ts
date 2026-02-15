export interface MuscleGroupConfig {
  key: string;
  label: string;
  color: string;
}

export const MUSCLE_GROUP_CONFIG: MuscleGroupConfig[] = [
  { key: 'chest', label: 'Chest', color: '#EF4444' },
  { key: 'back', label: 'Back', color: '#3B82F6' },
  { key: 'shoulders', label: 'Shoulders', color: '#8B5CF6' },
  { key: 'biceps', label: 'Biceps', color: '#F59E0B' },
  { key: 'triceps', label: 'Triceps', color: '#F97316' },
  { key: 'quads', label: 'Quads', color: '#22C55E' },
  { key: 'hamstrings', label: 'Hamstrings', color: '#14B8A6' },
  { key: 'glutes', label: 'Glutes', color: '#EC4899' },
  { key: 'calves', label: 'Calves', color: '#06B6D4' },
  { key: 'abs', label: 'Abs', color: '#EAB308' },
  { key: 'traps', label: 'Traps', color: '#6366F1' },
  { key: 'forearms', label: 'Forearms', color: '#D97706' },
  { key: 'full_body', label: 'Full Body', color: '#2563EB' },
];

export function getMuscleGroupConfig(key: string): MuscleGroupConfig | undefined {
  return MUSCLE_GROUP_CONFIG.find((config) => config.key === key);
}
