import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { Skeleton } from '../common/Skeleton';
import { Icon } from '../common/Icon';

interface DayBadgeProps {
  isTrainingDay: boolean;
  muscleGroups: string[];
  isLoading: boolean;
}

export function DayBadge({ isTrainingDay, muscleGroups, isLoading }: DayBadgeProps) {
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
        <Icon name="dumbbell" size={16} color={colors.accent.primary} />
        <Text style={styles.trainingText}>Training Day</Text>
        {muscleGroups.map((group) => (
          <View key={group} style={styles.chip}>
            <Text style={styles.chipText}>{group}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Icon name="moon" size={16} color={colors.text.muted} />
      <Text style={styles.restText}>Rest Day</Text>
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
