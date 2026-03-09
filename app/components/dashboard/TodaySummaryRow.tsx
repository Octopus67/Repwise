import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { typography, spacing } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';

interface TodaySummaryRowProps {
  mealsLogged: number;
  workoutsCompleted: number;
}

export function TodaySummaryRow({ mealsLogged, workoutsCompleted }: TodaySummaryRowProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  return (
    <View style={getStyles().container}>
      <SummaryItem icon={<Icon name="utensils" />} count={mealsLogged} label="meals" />
      <SummaryItem icon={<Icon name="dumbbell" />} count={workoutsCompleted} label="workouts" />
    </View>
  );
}

function SummaryItem({ icon, count, label }: { icon: React.ReactNode; count: number; label: string }) {
  const c = useThemeColors();
  return (
    <View style={getStyles().item}>
      <View style={getStyles().icon}>{icon}</View>
      <Text style={[getStyles().count, { color: count > 0 ? c.semantic.positive : c.text.muted }]}>
        {count}
      </Text>
      <Text style={[getStyles().label, { color: c.text.secondary }]}>{label}</Text>
    </View>
  );
}

/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
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
    color: c.text.secondary,
  },
});
