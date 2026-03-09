/**
 * MeasurementTrendChart — Line chart for weight and body fat % trends over time.
 * Reuses the existing TrendLineChart component.
 */

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../common/Card';
import { TrendLineChart } from '../charts/TrendLineChart';
import { TimeRangeSelector } from '../charts/TimeRangeSelector';
import { filterByTimeRange } from '../../utils/filterByTimeRange';
import { useStore } from '../../store';
import { formatWeight } from '../../utils/unitConversion';
import type { BodyMeasurement } from '../../types/measurements';

type Metric = 'weight' | 'bodyFat';
type TimeRange = '7d' | '14d' | '30d' | '90d';

interface MeasurementTrendChartProps {
  measurements: BodyMeasurement[];
}

export function MeasurementTrendChart({ measurements }: MeasurementTrendChartProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const unitSystem = useStore((s) => s.unitSystem);
  const [metric, setMetric] = useState<Metric>('weight');
  const [range, setRange] = useState<TimeRange>('30d');

  const dataPoints = measurements
    .filter((m) => (metric === 'weight' ? m.weightKg != null : m.bodyFatPct != null))
    .map((m) => ({
      date: m.measuredAt,
      value: metric === 'weight' ? m.weightKg! : m.bodyFatPct!,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const filtered = filterByTimeRange(dataPoints, range);

  const chartColor = metric === 'weight' ? c.accent.primary : c.semantic.warning;
  const suffix = metric === 'weight'
    ? (unitSystem === 'imperial' ? ' lbs' : ' kg')
    : '%';

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text.primary }]}>Trends</Text>
        <View style={[styles.metricToggle, { backgroundColor: c.bg.surfaceRaised }]}>
          {(['weight', 'bodyFat'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, metric === m && styles.toggleBtnActive]}
              onPress={() => setMetric(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: metric === m }}
            >
              <Text style={[styles.toggleText, metric === m && styles.toggleTextActive]}>
                {m === 'weight' ? 'Weight' : 'BF%'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TimeRangeSelector selected={range} onSelect={(r) => setRange(r as TimeRange)} />

      <View style={styles.chartWrap}>
        <TrendLineChart
          data={filtered}
          color={chartColor}
          suffix={suffix}
          emptyMessage={`No ${metric === 'weight' ? 'weight' : 'body fat'} data for this period`}
        />
      </View>
    </Card>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  card: { marginBottom: spacing[3] },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing[3],
  },
  title: {
    color: c.text.primary, fontSize: typography.size.md,
    fontWeight: typography.weight.semibold, lineHeight: typography.lineHeight.md,
  },
  metricToggle: {
    flexDirection: 'row', backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.sm, padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    borderRadius: radius.sm - 2,
  },
  toggleBtnActive: { backgroundColor: c.accent.primary },
  toggleText: {
    color: c.text.secondary, fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  toggleTextActive: { color: c.text.inverse, fontWeight: typography.weight.semibold },
  chartWrap: { marginTop: spacing[3] },
});
