import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SetType } from '../../types/training';
import { radius, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

interface TypeBadgeProps {
  setType: SetType;
}

const labelMap: Record<string, string> = {
  'warm-up': 'W',
  'drop-set': 'D',
  'amrap': 'A',
};

export const TypeBadge = React.memo(function TypeBadge({ setType }: TypeBadgeProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const label = labelMap[setType];
  if (!label) return null;

  return (
    <View style={[styles.pill, { backgroundColor: c.accent.primaryMuted }]}>
      <Text style={[styles.label, { color: c.accent.primary }]}>{label}</Text>
    </View>
  );
});

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  pill: {
    height: 20,
    borderRadius: radius.full,
    backgroundColor: c.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: c.accent.primary,
  },
});
