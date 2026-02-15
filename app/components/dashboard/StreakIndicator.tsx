import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCountingValue } from '../../hooks/useCountingValue';
import { useDerivedValue } from 'react-native-reanimated';
import { colors, typography, spacing } from '../../theme/tokens';
import { Icon } from '../common/Icon';

interface StreakIndicatorProps {
  count: number;
}

export function StreakIndicator({ count }: StreakIndicatorProps) {
  const animatedCount = useCountingValue(count);

  // Derive a rounded display value from the shared value
  const displayCount = useDerivedValue(() => Math.round(animatedCount.value));

  if (count === 0) return null;

  return (
    <View style={styles.container}>
      <Icon name="flame" size={18} color={colors.semantic.warning} />
      <Text style={styles.count}>{count}</Text>
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
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});
