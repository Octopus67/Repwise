import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, letterSpacing } from '../../theme/tokens';
import { Card } from '../common/Card';
import { TrendLineChart } from '../charts/TrendLineChart';
import {
  computeTDEEEstimate,
  WeightPoint,
} from '../../utils/tdeeEstimation';

interface ExpenditureTrendCardProps {
  weightHistory: WeightPoint[];
  caloriesByDate: Record<string, number>;
}

const MIN_DATA_DAYS = 14;

export function ExpenditureTrendCard({ weightHistory, caloriesByDate }: ExpenditureTrendCardProps) {
  const estimate = computeTDEEEstimate(weightHistory, caloriesByDate);

  // Build trend data points for the chart from calorie data
  const chartData = Object.entries(caloriesByDate)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Insufficient data
  if (!estimate) {
    const weightDays = weightHistory.length;
    const calorieDays = Object.keys(caloriesByDate).length;
    const minDays = Math.min(weightDays, calorieDays);
    const daysNeeded = MIN_DATA_DAYS - minDays;

    return (
      <Card variant="flat">
        <Text style={styles.title}>Expenditure Trend</Text>
        <Text style={styles.emptyText}>
          {daysNeeded > 0
            ? `${daysNeeded} more day${daysNeeded === 1 ? '' : 's'} needed`
            : 'Insufficient data for TDEE estimation'}
        </Text>
        <Text style={styles.emptySubtext}>
          Log bodyweight and nutrition daily for accurate estimates.
        </Text>
      </Card>
    );
  }

  return (
    <Card variant="flat">
      <Text style={styles.title}>Expenditure Trend</Text>

      {/* Prominent TDEE number */}
      <View style={styles.tdeeRow}>
        <Text style={styles.tdeeValue}>{Math.round(estimate.tdee)}</Text>
        <Text style={styles.tdeeUnit}>kcal/day</Text>
      </View>
      <Text style={styles.tdeeLabel}>Estimated TDEE ({estimate.windowDays}-day window)</Text>

      {/* Trend line chart */}
      {chartData.length > 1 && (
        <View style={styles.chartContainer}>
          <TrendLineChart
            data={chartData}
            color={colors.chart.calories}
            targetLine={estimate.tdee}
            suffix=" kcal"
          />
        </View>
      )}
    </Card>
  );
}


const styles = StyleSheet.create({
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: spacing[2],
    lineHeight: typography.lineHeight.md,
  },
  tdeeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[1],
    marginBottom: spacing[1],
  },
  tdeeValue: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    fontVariant: typography.numeric.fontVariant as any,
    letterSpacing: letterSpacing.tighter,
    lineHeight: typography.lineHeight['3xl'],
  },
  tdeeUnit: {
    fontSize: typography.size.base,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.base,
  },
  tdeeLabel: {
    fontSize: typography.size.xs,
    color: colors.text.muted,
    marginBottom: spacing[3],
    lineHeight: typography.lineHeight.xs,
  },
  chartContainer: {
    marginTop: spacing[2],
  },
  emptyText: {
    fontSize: typography.size.base,
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: spacing[2],
    lineHeight: typography.lineHeight.base,
  },
  emptySubtext: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    textAlign: 'center',
    paddingBottom: spacing[2],
    lineHeight: typography.lineHeight.sm,
  },
});
