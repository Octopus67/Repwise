;
import { getThemeColors, type ThemeColors } from '../hooks/useThemeColors';

export interface MuscleGroupConfig {
  key: string;
  label: string;
  color: string;
}

export const getMuscleGroupConfig = (c: ThemeColors = getThemeColors()): MuscleGroupConfig[] => [
  { key: 'chest', label: 'Chest', color: c.semantic.negative },
  { key: 'back', label: 'Back', color: c.accent.primary },
  { key: 'shoulders', label: 'Shoulders', color: c.accent.primaryHover },
  { key: 'biceps', label: 'Biceps', color: c.semantic.warning },
  { key: 'triceps', label: 'Triceps', color: c.semantic.caution },
  { key: 'quads', label: 'Quads', color: c.semantic.positive },
  { key: 'hamstrings', label: 'Hamstrings', color: c.macro.carbs },
  { key: 'glutes', label: 'Glutes', color: c.premium.gold },
  { key: 'calves', label: 'Calves', color: c.accent.primary },
  { key: 'abs', label: 'Abs', color: c.semantic.warning },
  { key: 'traps', label: 'Traps', color: c.accent.primaryHover },
  { key: 'forearms', label: 'Forearms', color: c.semantic.caution },
  { key: 'full_body', label: 'Full Body', color: c.accent.primary },
];

export function findMuscleGroupConfig(key: string, c: ThemeColors = getThemeColors()): MuscleGroupConfig | undefined {
  return getMuscleGroupConfig(c).find((config) => config.key === key);
}

/** @deprecated Use getMuscleGroupConfig(c) instead */
export const MUSCLE_GROUP_CONFIG = getMuscleGroupConfig();
