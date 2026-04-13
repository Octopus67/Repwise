import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography } from '../../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../../hooks/useThemeColors';
import { Card } from '../../../components/common/Card';
import { EmptyState } from '../../../components/common/EmptyState';
import { Skeleton } from '../../../components/common/Skeleton';
import { TrendLineChart } from '../../../components/charts/TrendLineChart';
import { ExpenditureTrendCard } from '../../../components/analytics/ExpenditureTrendCard';
import { PeriodizationCalendar } from '../../../components/periodization/PeriodizationCalendar';
import { ReadinessTrendChart } from '../../../components/analytics/ReadinessTrendChart';
import { Icon } from '../../../components/common/Icon';
import { formatWeight } from '../../../utils/unitConversion';
import { computeEMA } from '../../../utils/emaTrend';
import { filterByTimeRange } from '../../../utils/filterByTimeRange';
import type { TrendPoint, TimeRange } from '../../../types/analytics';
import type { UnitSystem } from '../../../utils/unitConversion';
import { useMemo } from 'react';

interface BodyTabProps {
  isLoading: boolean;
  weightTrend: TrendPoint[];
  calorieTrend: TrendPoint[];
  timeRange: TimeRange;
  unitSystem: UnitSystem;
}

function ChartSkeleton() {
  return (
    <View style={{ padding: spacing[4] }}>
      <Skeleton width="100%" height={160} borderRadius={8} />
    </View>
  );
}

export function BodyTab({ isLoading, weightTrend, calorieTrend, timeRange, unitSystem }: BodyTabProps) {
  const c = useThemeColors();
  const s = getStyles(c);
  const weightSuffix = unitSystem === 'metric' ? ' kg' : ' lbs';

  const filteredWeight = useMemo(() => filterByTimeRange(weightTrend, timeRange), [weightTrend, timeRange]);
  const weightEMA = useMemo(() => computeEMA(filteredWeight), [filteredWeight]);
  const caloriesByDate = useMemo(() => {
    const result: Record<string, number> = {};
    calorieTrend.forEach((p) => { result[p.date] = p.value; });
    return result;
  }, [calorieTrend]);

  return (
    <>
      {/* Periodization Calendar */}
      <Text style={[s.sectionTitle, { color: c.text.primary }]}>Periodization</Text>
      <PeriodizationCalendar />

      {/* Readiness Trend */}
      <Text style={[s.sectionTitle, { color: c.text.primary }]}>Readiness Trend</Text>
      <ReadinessTrendChart timeRange={timeRange} />

      {/* Bodyweight trend */}
      <Text style={[s.sectionTitle, { color: c.text.primary }]}>Bodyweight Trend</Text>
      <View testID="analytics-bodyweight-chart" accessibilityLabel={`Bodyweight trend chart, ${filteredWeight.length} data points`}>
        <Card>
          {isLoading ? <ChartSkeleton /> : filteredWeight.length === 0 ? (
            <EmptyState icon={<Icon name="scale" />} title="No bodyweight data" description="Log bodyweight to see trends" />
          ) : (
            <TrendLineChart
              data={filteredWeight.map((p) => ({ date: p.date, value: Number(formatWeight(p.value, unitSystem).split(' ')[0]) }))}
              color={c.chart.calories}
              suffix={weightSuffix}
              emptyMessage="No bodyweight data for this period"
              primaryAsDots={weightEMA.length > 0}
              secondaryData={weightEMA.length > 0 ? weightEMA.map((p) => ({ date: p.date, value: Number(formatWeight(p.value, unitSystem).split(' ')[0]) })) : undefined}
              secondaryColor={c.accent.primary}
            />
          )}
        </Card>
      </View>

      {/* Expenditure Trend (TDEE) */}
      {!isLoading && (
        <>
          <Text style={[s.sectionTitle, { color: c.text.primary }]}>Expenditure Trend (TDEE)</Text>
          <ExpenditureTrendCard
            weightHistory={weightTrend.map((p) => ({ date: p.date, weight_kg: p.value }))}
            caloriesByDate={caloriesByDate}
          />
        </>
      )}
    </>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  sectionTitle: {
    fontSize: typography.size.lg, fontWeight: typography.weight.semibold,
    marginTop: spacing[6], marginBottom: spacing[3],
  },
});
