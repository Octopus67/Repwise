import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getRpeBadgeColor, RpeBadgeColor } from '../../utils/rpeBadgeColor';
import { radius, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

interface RPEBadgeProps {
  rpeValue: number;
  mode: 'rpe' | 'rir';
}

const getColorMap = (c: ThemeColors): Record<Exclude<RpeBadgeColor, 'none'>, { text: string; bg: string }> => ({
  green: { text: c.semantic.positive, bg: c.semantic.positiveSubtle },
  yellow: { text: c.semantic.warning, bg: c.semantic.warningSubtle },
  orange: { text: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  red: { text: c.semantic.negative, bg: c.semantic.negativeSubtle },
});

export const RPEBadge = React.memo(function RPEBadge({ rpeValue, mode }: RPEBadgeProps) {
  const c = useThemeColors();
  const colorMap = getColorMap(c);
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
});

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
