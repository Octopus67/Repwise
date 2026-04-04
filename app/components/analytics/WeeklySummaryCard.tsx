import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../common/Card';
import {
  computeWeeklyNutritionSummary,
  NutritionEntry,
} from '../../utils/weeklySummary';

interface WeeklySummaryCardProps {
  entries: NutritionEntry[];
  targetCalories: number;
  timeRangeDays?: number; // Number of days in selected range
}

export const WeeklySummaryCard = React.memo(function WeeklySummaryCard({ entries, targetCalories, timeRangeDays = 7 }: WeeklySummaryCardProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const summary = computeWeeklyNutritionSummary(entries, targetCalories);

  // Insufficient data
  if (summary.daysLogged < 2) {
    return (
      <Card variant="flat">
        <Text style={[getStyles().title, { color: c.text.primary }]}>Weekly Summary</Text>
        <Text style={[getStyles().emptyText, { color: c.text.muted }]}>
          Log more days to see patterns. ({summary.daysLogged} of {timeRangeDays} days logged)
        </Text>
      </Card>
    );
  }

  return (
    <Card variant="flat">
      <Text style={[getStyles().title, { color: c.text.primary }]}>Weekly Summary</Text>
      <Text style={[getStyles().daysLogged, { color: c.text.muted }]}>{summary.daysLogged} of {timeRangeDays} days logged</Text>

      {/* Averages */}
      <View style={getStyles().avgRow}>
        <StatBlock label="Avg Calories" value={`${Math.round(summary.avgCalories)}`} unit="kcal" />
        <StatBlock label="Avg Protein" value={`${Math.round(summary.avgProtein)}`} unit="g" />
        <StatBlock label="Avg Carbs" value={`${Math.round(summary.avgCarbs)}`} unit="g" />
        <StatBlock label="Avg Fat" value={`${Math.round(summary.avgFat)}`} unit="g" />
      </View>

      {/* Adherence */}
      <View style={[getStyles().adherenceRow, { borderTopColor: c.border.subtle }]}>
        {summary.bestDay && (
          <View style={getStyles().adherenceBlock}>
            <Text style={[getStyles().adherenceLabel, { color: c.text.muted }]}>Best Day</Text>
            <Text style={[getStyles().adherenceDate, { color: c.text.primary }]}>{summary.bestDay.date}</Text>
            <Text style={[getStyles().adherenceDeviation, { color: c.text.secondary }]}>
              ±{Math.round(summary.bestDay.deviation)} kcal
            </Text>
          </View>
        )}
        {summary.worstDay && (
          <View style={getStyles().adherenceBlock}>
            <Text style={[getStyles().adherenceLabel, { color: c.text.muted }]}>Worst Day</Text>
            <Text style={[getStyles().adherenceDate, { color: c.text.primary }]}>{summary.worstDay.date}</Text>
            <Text style={[getStyles().adherenceDeviation, { color: c.text.secondary }]}>
              ±{Math.round(summary.worstDay.deviation)} kcal
            </Text>
          </View>
        )}
      </View>

      {/* Water */}
      {summary.totalWaterMl > 0 && (
        <View style={[getStyles().waterRow, { borderTopColor: c.border.subtle }]}>
          <Text style={[getStyles().waterLabel, { color: c.text.muted }]}>Total Water</Text>
          <Text style={[getStyles().waterValue, { color: c.text.primary }]}>{Math.round(summary.totalWaterMl)} ml</Text>
        </View>
      )}
    </Card>
  );
});

function StatBlock({ label, value, unit }: { label: string; value: string; unit: string }) {
  const c = useThemeColors();
  return (
    <View style={getStyles().statBlock}>
      <Text style={[getStyles().statLabel, { color: c.text.muted }]}>{label}</Text>
      <Text style={[getStyles().statValue, { color: c.text.primary }]}>
        {value}
        <Text style={[getStyles().statUnit, { color: c.text.secondary }]}> {unit}</Text>
      </Text>
    </View>
  );
}


/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: c.text.primary,
    marginBottom: spacing[2],
  },
  daysLogged: {
    fontSize: typography.size.sm,
    color: c.text.muted,
    marginBottom: spacing[3],
  },
  emptyText: {
    fontSize: typography.size.base,
    color: c.text.muted,
    textAlign: 'center',
    paddingVertical: spacing[4],
  },
  avgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  statBlock: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: typography.size.xs,
    color: c.text.muted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: c.text.primary,
  },
  statUnit: {
    fontSize: typography.size.xs,
    color: c.text.secondary,
    fontWeight: typography.weight.regular,
  },
  adherenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing[3],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: c.border.subtle,
  },
  adherenceBlock: {
    alignItems: 'center',
  },
  adherenceLabel: {
    fontSize: typography.size.xs,
    color: c.text.muted,
    marginBottom: 2,
  },
  adherenceDate: {
    fontSize: typography.size.sm,
    color: c.text.primary,
    fontWeight: typography.weight.medium,
  },
  adherenceDeviation: {
    fontSize: typography.size.xs,
    color: c.text.secondary,
  },
  waterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: c.border.subtle,
  },
  waterLabel: {
    fontSize: typography.size.sm,
    color: c.text.muted,
  },
  waterValue: {
    fontSize: typography.size.sm,
    color: c.text.primary,
    fontWeight: typography.weight.medium,
  },
});
