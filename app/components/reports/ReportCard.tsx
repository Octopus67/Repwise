import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';

interface ReportCardProps {
  report: {
    year: number;
    week: number;
    training: { total_volume: number; session_count: number };
    nutrition: { compliance_pct: number };
    body: { weight_trend_kg: number | null };
    recommendations: string[];
  };
}

export const ReportCard = forwardRef<View, ReportCardProps>(({ report }, ref) => {
  const topRec = (report.recommendations ?? [])[0] ?? '';
  const trend = report.body?.weight_trend_kg ?? null;
  const trendStr = trend != null ? `${trend > 0 ? '+' : ''}${trend.toFixed(1)} kg` : '—';
  const compliancePct = report.nutrition?.compliance_pct;

  return (
    <View ref={ref} style={styles.card}>
      <Text style={styles.weekLabel}>Week {report.week}, {report.year}</Text>
      <View style={styles.row}>
        <StatBox label="Volume" value={`${Math.round(report.training?.total_volume ?? 0)} kg`} />
        <StatBox label="Sessions" value={String(report.training?.session_count ?? 0)} />
        <StatBox label="Compliance" value={compliancePct != null ? `${compliancePct.toFixed(0)}%` : '—'} />
        <StatBox label="Weight Δ" value={trendStr} />
      </View>
      {topRec ? <Text style={styles.rec}>💡 {topRec}</Text> : null}
      <Text style={styles.brand}>Repwise</Text>
    </View>
  );
});

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    padding: spacing[5],
    marginTop: spacing[6],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  weekLabel: {
    color: colors.accent.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { color: colors.text.primary, fontSize: typography.size.xl, fontWeight: typography.weight.bold },
  statLabel: { color: colors.text.secondary, fontSize: typography.size.xs, marginTop: spacing[1] },
  rec: { color: colors.text.primary, fontSize: typography.size.sm, marginTop: spacing[4], textAlign: 'center', lineHeight: 20 },
  brand: { color: colors.text.muted, fontSize: typography.size.xs, textAlign: 'center', marginTop: spacing[4] },
});
