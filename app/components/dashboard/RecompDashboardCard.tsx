import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Card } from '../common/Card';
import { spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

interface TrendData {
  slope_per_week: number;
  direction: string;
  data_points: number;
}

interface RecompMetrics {
  waist_trend: TrendData | null;
  arm_trend: TrendData | null;
  chest_trend: TrendData | null;
  weight_trend: TrendData | null;
  recomp_score: number | null;
  has_sufficient_data: boolean;
}

interface Props {
  metrics: RecompMetrics | null;
  loading?: boolean;
  error?: string | null;
}

function safeNumber(value: unknown): number {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return value;
}

function trendColor(direction: string, invertGood = false): string {
  const c = useThemeColors();
  if (direction === 'decreasing') return invertGood ? c.semantic.negative : c.semantic.positive;
  if (direction === 'increasing') return invertGood ? c.semantic.positive : c.semantic.negative;
  return c.text.secondary;
}

function scoreColor(score: number): string {
  const c = useThemeColors();
  if (score > 10) return c.semantic.positive;
  if (score < -10) return c.semantic.negative;
  return c.text.secondary;
}

function formatTrend(trend: TrendData | null, label: string, invertGood = false): React.ReactNode {
  const c = useThemeColors();
  if (!trend) return null;
  const slope = safeNumber(trend.slope_per_week);
  const sign = slope >= 0 ? '+' : '';
  return (
    <View style={getStyles().trendRow}>
      <Text style={[getStyles().trendLabel, { color: c.text.secondary }]}>{label}</Text>
      <Text style={[getStyles().trendValue, { color: trendColor(trend.direction, invertGood) }]}>
        {sign}{slope.toFixed(1)} cm/wk
      </Text>
    </View>
  );
}

export function RecompDashboardCard({ metrics, loading = false, error = null }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  if (loading) {
    return (
      <Card variant="flat" style={getStyles().card}>
        <Text style={[getStyles().title, { color: c.text.primary }]}>Body Recomposition</Text>
        <View style={getStyles().loadingContainer}>
          <ActivityIndicator size="small" color={c.accent.primary} />
          <Text style={[getStyles().loadingText, { color: c.text.secondary }]}>Loading metrics…</Text>
        </View>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="flat" style={getStyles().card}>
        <Text style={[getStyles().title, { color: c.text.primary }]}>Body Recomposition</Text>
        <Text style={[getStyles().errorText, { color: c.semantic.negative }]}>{error}</Text>
      </Card>
    );
  }
  if (!metrics || !metrics.has_sufficient_data) {
    return (
      <Card variant="flat" style={getStyles().card}>
        <Text style={[getStyles().title, { color: c.text.primary }]}>Body Recomposition</Text>
        <Text style={[getStyles().prompt, { color: c.text.secondary }]}>Log waist, arm, and chest measurements to track your recomp progress</Text>
      </Card>
    );
  }

  const score = safeNumber(metrics.recomp_score);

  return (
    <Card variant="flat" style={getStyles().card}>
      <Text style={[getStyles().title, { color: c.text.primary }]}>Body Recomposition</Text>
      {formatTrend(metrics.waist_trend, 'Waist')}
      {formatTrend(metrics.arm_trend, 'Arms', true)}
      {formatTrend(metrics.chest_trend, 'Chest', true)}
      {formatTrend(metrics.weight_trend, 'Weight')}
      {metrics.recomp_score != null && Number.isFinite(metrics.recomp_score) && (
        <View style={[getStyles().scoreRow, { borderTopColor: c.border.subtle }]}>
          <Text style={[getStyles().scoreLabel, { color: c.text.primary }]}>Recomp Score</Text>
          <Text style={[getStyles().scoreValue, { color: scoreColor(score) }]}>
            {score > 0 ? '+' : ''}{score.toFixed(0)}
          </Text>
        </View>
      )}
    </Card>
  );
}

/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  card: { marginBottom: spacing[3] },
  title: {
    color: c.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  prompt: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  loadingText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
  },
  errorText: {
    color: c.semantic.negative,
    fontSize: typography.size.sm,
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  trendLabel: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
  },
  trendValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: c.border.subtle,
  },
  scoreLabel: {
    color: c.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  scoreValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
});
