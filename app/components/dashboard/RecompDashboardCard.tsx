import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Card } from '../common/Card';
import { colors, spacing, typography } from '../../theme/tokens';

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
  if (direction === 'decreasing') return invertGood ? colors.semantic.negative : colors.semantic.positive;
  if (direction === 'increasing') return invertGood ? colors.semantic.positive : colors.semantic.negative;
  return colors.text.secondary;
}

function scoreColor(score: number): string {
  if (score > 10) return colors.semantic.positive;
  if (score < -10) return colors.semantic.negative;
  return colors.text.secondary;
}

function formatTrend(trend: TrendData | null, label: string, invertGood = false): React.ReactNode {
  if (!trend) return null;
  const slope = safeNumber(trend.slope_per_week);
  const sign = slope >= 0 ? '+' : '';
  return (
    <View style={styles.trendRow}>
      <Text style={styles.trendLabel}>{label}</Text>
      <Text style={[styles.trendValue, { color: trendColor(trend.direction, invertGood) }]}>
        {sign}{slope.toFixed(1)} cm/wk
      </Text>
    </View>
  );
}

export function RecompDashboardCard({ metrics, loading = false, error = null }: Props) {
  if (loading) {
    return (
      <Card variant="flat" style={styles.card}>
        <Text style={styles.title}>Body Recomposition</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.accent.primary} />
          <Text style={styles.loadingText}>Loading metrics…</Text>
        </View>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="flat" style={styles.card}>
        <Text style={styles.title}>Body Recomposition</Text>
        <Text style={styles.errorText}>{error}</Text>
      </Card>
    );
  }

  if (!metrics || !metrics.has_sufficient_data) {
    return (
      <Card variant="flat" style={styles.card}>
        <Text style={styles.title}>Body Recomposition</Text>
        <Text style={styles.prompt}>Log waist, arm, and chest measurements to track your recomp progress</Text>
      </Card>
    );
  }

  const score = safeNumber(metrics.recomp_score);

  return (
    <Card variant="flat" style={styles.card}>
      <Text style={styles.title}>Body Recomposition</Text>
      {formatTrend(metrics.waist_trend, 'Waist')}
      {formatTrend(metrics.arm_trend, 'Arms', true)}
      {formatTrend(metrics.chest_trend, 'Chest', true)}
      {formatTrend(metrics.weight_trend, 'Weight')}
      {metrics.recomp_score != null && Number.isFinite(metrics.recomp_score) && (
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>Recomp Score</Text>
          <Text style={[styles.scoreValue, { color: scoreColor(score) }]}>
            {score > 0 ? '+' : ''}{score.toFixed(0)}
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing[3] },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  prompt: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
  },
  errorText: {
    color: colors.semantic.negative,
    fontSize: typography.size.sm,
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  trendLabel: {
    color: colors.text.secondary,
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
    borderTopColor: colors.border.subtle,
  },
  scoreLabel: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  scoreValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
});
