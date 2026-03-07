import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Skeleton } from '../common/Skeleton';
import { Icon } from '../common/Icon';

interface DayBadgeProps {
  isTrainingDay: boolean;
  muscleGroups: string[];
  isLoading: boolean;
}

export function DayBadge({ isTrainingDay, muscleGroups, isLoading }: DayBadgeProps) {
  const c = useThemeColors();
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Skeleton width={200} height={32} borderRadius={16} />
      </View>
    );
  }

  if (isTrainingDay) {
    return (
      <View style={styles.container}>
        <Icon name="dumbbell" size={16} color={c.accent.primary} />
        <Text style={[styles.trainingText, { color: c.accent.primary }]}>Training Day</Text>
        {muscleGroups.map((group) => (
          <View key={group} style={[styles.chip, { backgroundColor: c.accent.primaryMuted }]}>
            <Text style={[styles.chipText, { color: c.accent.primary }]}>{group}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Icon name="moon" size={16} color={c.text.muted} />
      <Text style={[styles.restText, { color: c.text.muted }]}>Rest Day</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
    flexWrap: 'wrap',
  },
  trainingText: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  restText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  chip: {
    backgroundColor: colors.accent.primaryMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  chipText: {
    color: colors.accent.primary,
    fontSize: typography.size.xs,
  },
});
