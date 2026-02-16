import { View, Text, StyleSheet } from 'react-native';
import { getRpeBadgeColor, RpeBadgeColor } from '../../utils/rpeBadgeColor';
import { colors, radius, typography } from '../../theme/tokens';

interface RPEBadgeProps {
  rpeValue: number;
  mode: 'rpe' | 'rir';
}

const colorMap: Record<Exclude<RpeBadgeColor, 'none'>, { text: string; bg: string }> = {
  green: { text: colors.semantic.positive, bg: colors.semantic.positiveSubtle },
  yellow: { text: colors.semantic.warning, bg: colors.semantic.warningSubtle },
  orange: { text: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  red: { text: colors.semantic.negative, bg: colors.semantic.negativeSubtle },
};

export function RPEBadge({ rpeValue, mode }: RPEBadgeProps) {
  if (!rpeValue || isNaN(rpeValue)) return null;

  const badgeColor = getRpeBadgeColor(rpeValue);
  if (badgeColor === 'none') return null;

  const { text, bg } = colorMap[badgeColor];
  const display = mode === 'rir' ? `${10 - rpeValue}` : `${rpeValue}`;

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 24,
    minWidth: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
});
