import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme/tokens';
import { Icon } from '../common/Icon';

interface TodaySummaryRowProps {
  mealsLogged: number;
  workoutsCompleted: number;
}

export function TodaySummaryRow({ mealsLogged, workoutsCompleted }: TodaySummaryRowProps) {
  return (
    <View style={styles.container}>
      <SummaryItem icon={<Icon name="utensils" />} count={mealsLogged} label="meals" />
      <SummaryItem icon={<Icon name="dumbbell" />} count={workoutsCompleted} label="workouts" />
    </View>
  );
}

function SummaryItem({ icon, count, label }: { icon: React.ReactNode; count: number; label: string }) {
  return (
    <View style={styles.item}>
      <View style={styles.icon}>{icon}</View>
      <Text style={[styles.count, { color: count > 0 ? colors.semantic.positive : colors.text.muted }]}>
        {count}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing[6],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  icon: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  count: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  label: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
  },
});
