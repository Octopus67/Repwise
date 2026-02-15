import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';
import { Card } from '../common/Card';
import {
  computeWeeklySummary,
  NutritionEntry,
} from '../../utils/weeklySummary';

interface WeeklySummaryCardProps {
  entries: NutritionEntry[];
  targetCalories: number;
}

export function WeeklySummaryCard({ entries, targetCalories }: WeeklySummaryCardProps) {
  const summary = computeWeeklySummary(entries, targetCalories);

  // Insufficient data
  if (summary.daysLogged < 2) {
    return (
      <Card variant="flat">
        <Text style={styles.title}>Weekly Summary</Text>
        <Text style={styles.emptyText}>
          Log more days to see weekly patterns. ({summary.daysLogged} of 7 days logged)
        </Text>
      </Card>
    );
  }

  return (
    <Card variant="flat">
      <Text style={styles.title}>Weekly Summary</Text>
      <Text style={styles.daysLogged}>{summary.daysLogged} of 7 days logged</Text>

      {/* Averages */}
      <View style={styles.avgRow}>
        <StatBlock label="Avg Calories" value={`${Math.round(summary.avgCalories)}`} unit="kcal" />
        <StatBlock label="Avg Protein" value={`${Math.round(summary.avgProtein)}`} unit="g" />
        <StatBlock label="Avg Carbs" value={`${Math.round(summary.avgCarbs)}`} unit="g" />
        <StatBlock label="Avg Fat" value={`${Math.round(summary.avgFat)}`} unit="g" />
      </View>

      {/* Adherence */}
      <View style={styles.adherenceRow}>
        {summary.bestDay && (
          <View style={styles.adherenceBlock}>
            <Text style={styles.adherenceLabel}>Best Day</Text>
            <Text style={styles.adherenceDate}>{summary.bestDay.date}</Text>
            <Text style={styles.adherenceDeviation}>
              ±{Math.round(summary.bestDay.deviation)} kcal
            </Text>
          </View>
        )}
        {summary.worstDay && (
          <View style={styles.adherenceBlock}>
            <Text style={styles.adherenceLabel}>Worst Day</Text>
            <Text style={styles.adherenceDate}>{summary.worstDay.date}</Text>
            <Text style={styles.adherenceDeviation}>
              ±{Math.round(summary.worstDay.deviation)} kcal
            </Text>
          </View>
        )}
      </View>

      {/* Water */}
      {summary.totalWaterMl > 0 && (
        <View style={styles.waterRow}>
          <Text style={styles.waterLabel}>Total Water</Text>
          <Text style={styles.waterValue}>{Math.round(summary.totalWaterMl)} ml</Text>
        </View>
      )}
    </Card>
  );
}

function StatBlock({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value}
        <Text style={styles.statUnit}> {unit}</Text>
      </Text>
    </View>
  );
}


const styles = StyleSheet.create({
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  daysLogged: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    marginBottom: spacing[3],
  },
  emptyText: {
    fontSize: typography.size.base,
    color: colors.text.muted,
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
    color: colors.text.muted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  statUnit: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    fontWeight: typography.weight.regular,
  },
  adherenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing[3],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  adherenceBlock: {
    alignItems: 'center',
  },
  adherenceLabel: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    marginBottom: 2,
  },
  adherenceDate: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
    fontWeight: typography.weight.medium,
  },
  adherenceDeviation: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
  waterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  waterLabel: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
  },
  waterValue: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
    fontWeight: typography.weight.medium,
  },
});
