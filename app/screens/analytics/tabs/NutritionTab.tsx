import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../../hooks/useThemeColors';
import { Card } from '../../../components/common/Card';
import { EmptyState } from '../../../components/common/EmptyState';
import { Skeleton } from '../../../components/common/Skeleton';
import { TrendLineChart } from '../../../components/charts/TrendLineChart';
import { WeeklySummaryCard } from '../../../components/analytics/WeeklySummaryCard';
import { Icon } from '../../../components/common/Icon';
import { getComparisonColor } from '../../../utils/comparisonColor';
import type { TrendPoint, TimeRange } from '../../../types/analytics';

interface DietaryGap {
  nutrient: string;
  average: number;
  recommended: number;
  deficit_pct: number;
}

interface NutritionTabProps {
  isLoading: boolean;
  filteredCalories: TrendPoint[];
  filteredProtein: TrendPoint[];
  calorieTrend: TrendPoint[];
  proteinTrend: TrendPoint[];
  adaptiveTarget: { calories: number; protein: number } | null;
  gaps: DietaryGap[];
  premium: boolean;
  timeRange: TimeRange;
  onNavigateNutritionReport: () => void;
  onNavigateMicroDashboard: () => void;
}

function ChartSkeleton() {
  return (
    <View style={{ padding: spacing[4] }}>
      <Skeleton width="100%" height={160} borderRadius={8} />
    </View>
  );
}

function ComparisonItem({ label, actual, target, unit }: { label: string; actual: number; target: number; unit: string }) {
  const c = useThemeColors();
  const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
  const pctColor = getComparisonColor(actual, target);
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: c.text.secondary, fontSize: typography.size.sm }}>{label}</Text>
      <Text style={{ color: c.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginTop: spacing[1] }}>{actual} {unit}</Text>
      <Text style={{ color: c.text.muted, fontSize: typography.size.sm }}>/ {target} {unit}</Text>
      <Text style={{ color: pctColor, fontSize: typography.size.sm, fontWeight: typography.weight.medium, marginTop: spacing[1] }}>{pct}%</Text>
    </View>
  );
}

export function NutritionTab({
  isLoading, filteredCalories, filteredProtein, calorieTrend, proteinTrend,
  adaptiveTarget, gaps, premium, timeRange, onNavigateNutritionReport, onNavigateMicroDashboard,
}: NutritionTabProps) {
  const c = useThemeColors();
  const s = getStyles(c);
  const days = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[timeRange];

  return (
    <>
      <TouchableOpacity testID="analytics-nutrition-report-link" style={s.linkBtn} onPress={onNavigateNutritionReport} accessibilityRole="link" accessibilityLabel="Nutrition Report with 27 nutrients" accessibilityHint="Opens detailed nutrition report">
        <Text style={[s.linkText, { color: c.accent.primary }]}><Icon name="salad" /> Nutrition Report (27 nutrients)</Text>
        <Text style={{ color: c.accent.primary, fontSize: typography.size.lg }}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity testID="analytics-micro-dashboard-link" style={s.linkBtn} onPress={onNavigateMicroDashboard} accessibilityRole="link" accessibilityLabel="Micronutrient Dashboard" accessibilityHint="Opens micronutrient dashboard">
        <Text style={[s.linkText, { color: c.accent.primary }]}><Icon name="salad" /> Micronutrient Dashboard</Text>
        <Text style={{ color: c.accent.primary, fontSize: typography.size.lg }}>›</Text>
      </TouchableOpacity>

      {adaptiveTarget && (
        <Card>
          <Text style={[s.sectionTitle, { color: c.text.muted, marginTop: 0 }]}>Estimated TDEE</Text>
          <Text style={{ color: c.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold }}>{adaptiveTarget.calories} kcal</Text>
        </Card>
      )}

      <Text style={[s.sectionTitle, { color: c.text.primary }]}>Calorie Trend</Text>
      <View testID="analytics-calorie-chart" accessibilityLabel={`Calorie trend chart, ${filteredCalories.length} data points`}>
        <Card>
          {isLoading ? <ChartSkeleton /> : filteredCalories.length === 0 ? (
            <EmptyState icon={<Icon name="flame" />} title="No calorie data" description="Log meals to see calorie trends" />
          ) : (
            <TrendLineChart data={filteredCalories} color={c.chart.calories} suffix=" kcal" targetLine={adaptiveTarget?.calories} emptyMessage="No calorie data for this period" />
          )}
        </Card>
      </View>

      {!isLoading && (
        <>
          <Text style={[s.sectionTitle, { color: c.text.primary }]}>Weekly Summary</Text>
          <WeeklySummaryCard
            entries={calorieTrend.map((p) => ({
              entry_date: p.date, calories: p.value,
              protein_g: proteinTrend.find((pt) => pt.date === p.date)?.value ?? 0,
              carbs_g: 0, fat_g: 0, micro_nutrients: null,
            }))}
            targetCalories={adaptiveTarget?.calories ?? 2400}
            timeRangeDays={days}
          />
        </>
      )}

      <Text style={[s.sectionTitle, { color: c.text.primary }]}>Protein Trend</Text>
      <Card>
        {isLoading ? <ChartSkeleton /> : filteredProtein.length === 0 ? (
          <EmptyState icon={<Icon name="meat" />} title="No protein data" description="Log meals to see protein trends" />
        ) : (
          <TrendLineChart data={filteredProtein} color={c.semantic.positive} suffix="g" targetLine={adaptiveTarget?.protein} emptyMessage="No protein data for this period" />
        )}
      </Card>

      {adaptiveTarget && filteredCalories.length > 0 && (
        <>
          <Text style={[s.sectionTitle, { color: c.text.primary }]}>Target vs Actual (Today)</Text>
          <Card>
            <View style={{ flexDirection: 'row', gap: spacing[4] }}>
              <ComparisonItem label="Calories" actual={filteredCalories.at(-1)?.value ?? 0} target={adaptiveTarget.calories} unit="kcal" />
              <ComparisonItem label="Protein" actual={filteredProtein.at(-1)?.value ?? 0} target={adaptiveTarget.protein} unit="g" />
            </View>
          </Card>
        </>
      )}

      {premium && gaps.length > 0 && (
        <>
          <Text style={[s.sectionTitle, { color: c.text.primary }]}>Dietary Gaps</Text>
          <Card>
            <FlatList
              data={gaps}
              keyExtractor={(gap) => gap.nutrient}
              scrollEnabled={false}
              renderItem={({ item: gap }) => (
                <View style={s.gapRow}>
                  <Text style={{ color: c.text.secondary, fontSize: typography.size.sm, width: 80 }}>{gap.nutrient}</Text>
                  <View style={[s.gapBar, { backgroundColor: c.bg.surfaceRaised }]}>
                    <View style={[s.gapFill, {
                      width: `${Math.min((gap.average / gap.recommended) * 100, 100)}%`,
                      backgroundColor: gap.deficit_pct > 30 ? c.semantic.negative : gap.deficit_pct > 10 ? c.semantic.warning : c.semantic.positive,
                    }]} />
                  </View>
                  <Text style={{ color: c.semantic.negative, fontSize: typography.size.sm, fontWeight: typography.weight.medium, width: 44, textAlign: 'right' }}>-{Math.round(gap.deficit_pct)}%</Text>
                </View>
              )}
            />
          </Card>
        </>
      )}
    </>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.bg.surface, borderRadius: radius.sm, padding: spacing[3],
    marginBottom: spacing[4], borderWidth: 1, borderColor: c.border.subtle,
  },
  linkText: { fontSize: typography.size.base, fontWeight: typography.weight.medium },
  sectionTitle: {
    fontSize: typography.size.lg, fontWeight: typography.weight.semibold,
    marginTop: spacing[6], marginBottom: spacing[3],
  },
  gapRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[2] },
  gapBar: { flex: 1, height: 6, borderRadius: radius.full, overflow: 'hidden' },
  gapFill: { height: '100%', borderRadius: radius.full },
});
