import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCountingValue } from '../../hooks/useCountingValue';
import { useDerivedValue } from 'react-native-reanimated';
import { colors, typography, spacing } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';

interface StreakIndicatorProps {
  count: number;
  type?: 'day' | 'week';
}

export function StreakIndicator({ count, type = 'week' }: StreakIndicatorProps) {
  const c = useThemeColors();
  const animatedCount = useCountingValue(count);

  // Derive a rounded display value from the shared value
  const displayCount = useDerivedValue(() => Math.round(animatedCount.value));

  if (count === 0) return null;

  const streakText = count === 1 ? `${count} ${type} streak` : `${count} ${type} streak`;

  return (
    <View style={styles.container}>
      <Icon name="flame" size={18} color={c.semantic.warning} />
      <Text style={[styles.count, { color: c.accent.primary }]}>{streakText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  fire: {},
  count: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.sm,
  },
});
