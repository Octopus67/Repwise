import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';

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
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const topRec = (report.recommendations ?? [])[0] ?? '';
  const trend = report.body?.weight_trend_kg ?? null;
  const trendStr = trend != null ? `${trend > 0 ? '+' : ''}${trend.toFixed(1)} kg` : '—';
  const compliancePct = report.nutrition?.compliance_pct;

  return (
    <View ref={ref} style={getStyles().card}>
      <Text style={getStyles().weekLabel}>Week {report.week}, {report.year}</Text>
      <View style={getStyles().row}>
        <StatBox label="Volume" value={`${Math.round(report.training?.total_volume ?? 0)} kg`} />
        <StatBox label="Sessions" value={String(report.training?.session_count ?? 0)} />
        <StatBox label="Compliance" value={compliancePct != null ? `${compliancePct.toFixed(0)}%` : '—'} />
        <StatBox label="Weight Δ" value={trendStr} />
      </View>
      {topRec ? <Text style={getStyles().rec}><Icon name="lightbulb" size={14} color={getThemeColors().text.secondary} /> {topRec}</Text> : null}
      <Text style={getStyles().brand}>Repwise</Text>
    </View>
  );
});

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={getStyles().statBox}>
      <Text style={getStyles().statValue}>{value}</Text>
      <Text style={getStyles().statLabel}>{label}</Text>
    </View>
  );
}

/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.md,
    padding: spacing[5],
    marginTop: spacing[6],
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  weekLabel: {
    color: c.accent.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { color: c.text.primary, fontSize: typography.size.xl, fontWeight: typography.weight.bold },
  statLabel: { color: c.text.secondary, fontSize: typography.size.xs, marginTop: spacing[1] },
  rec: { color: c.text.primary, fontSize: typography.size.sm, marginTop: spacing[4], textAlign: 'center', lineHeight: 20 },
  brand: { color: c.text.muted, fontSize: typography.size.xs, textAlign: 'center', marginTop: spacing[4] },
});
