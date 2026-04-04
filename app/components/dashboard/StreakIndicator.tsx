import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { typography, spacing } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';

interface StreakIndicatorProps {
  count: number;
  type?: 'day' | 'week';
}

export function StreakIndicator({ count, type = 'week' }: StreakIndicatorProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);

  if (count === 0) return null;

  const streakText = `${count} ${type} streak`;

  return (
    <View style={styles.container}>
      <Icon name="flame" size={18} color={c.semantic.warning} />
      <Text style={[styles.count, { color: c.accent.primary }]}>{streakText}</Text>
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  count: {
    color: c.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.sm,
  },
});
