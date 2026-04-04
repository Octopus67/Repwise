/**
 * StimulusIndicator — Traffic light dot for a single muscle group.
 * Shows colored dot + muscle name + short message based on HU vs landmarks.
 */

import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';

export const VOLUME_DEFAULTS: Record<string, { mev: number; mav: number; mrv: number }> = {
  chest: { mev: 8, mav: 14, mrv: 20 },
  back: { mev: 8, mav: 14, mrv: 22 },
  quads: { mev: 6, mav: 12, mrv: 18 },
  hamstrings: { mev: 4, mav: 10, mrv: 16 },
  shoulders: { mev: 6, mav: 14, mrv: 22 },
  biceps: { mev: 4, mav: 12, mrv: 20 },
  triceps: { mev: 4, mav: 10, mrv: 16 },
  glutes: { mev: 4, mav: 12, mrv: 16 },
  calves: { mev: 6, mav: 10, mrv: 16 },
  abs: { mev: 4, mav: 10, mrv: 16 },
};

interface Props {
  muscleGroup: string;
  currentHU: number;
  mev?: number;
  mav?: number;
  mrv?: number;
}

const INDICATORS = {
  red:    { color: '#EF4444', shape: '▲', message: 'Too much — consider stopping' },
  green:  { color: '#22C55E', shape: '●', message: 'Enough stimulus ✔️' },
  yellow: { color: '#F59E0B', shape: '◆', message: 'Getting close' },
  gray:   { color: '#6B7280', shape: '○', message: 'Not enough yet' },
} as const;

function getLevel(hu: number, mev: number, mav: number, mrv: number) {
  if (hu >= mrv) return INDICATORS.red;
  if (hu >= mav) return INDICATORS.green;
  if (hu >= mev) return INDICATORS.yellow;
  return INDICATORS.gray;
}

export function StimulusIndicator({ muscleGroup, currentHU, mev, mav, mrv }: Props) {
  const c = useThemeColors();
  const key = muscleGroup.toLowerCase();
  const defaults = VOLUME_DEFAULTS[key];
  const eMev = mev ?? defaults?.mev ?? 6;
  const eMav = mav ?? defaults?.mav ?? 12;
  const eMrv = mrv ?? defaults?.mrv ?? 18;
  const { color, shape, message } = getLevel(currentHU, eMev, eMav, eMrv);

  return (
    <View style={s.row} accessibilityLabel={`${muscleGroup}: ${message}`} accessibilityRole="text">
      <Text style={[s.shape, { color }]}>{shape}</Text>
      <Text style={[s.muscle, { color: c.text.primary }]} numberOfLines={1}>{muscleGroup}</Text>
      <Text style={[s.msg, { color: c.text.muted }]} numberOfLines={1}>{message}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[1] },
  shape: { fontSize: 14, width: 16, textAlign: 'center' },
  muscle: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, textTransform: 'capitalize', minWidth: 70 },
  msg: { fontSize: typography.size.xs, flex: 1 },
});
