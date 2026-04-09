import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/Skeleton';
import { Icon } from '../../components/common/Icon';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';
import type { ProfileScreenProps } from '../../types/navigation';

interface YearlyReport {
  year: number;
  training: { total_volume: number; session_count: number; volume_by_muscle_group: Record<string, number> };
  nutrition: { avg_calories: number; avg_protein_g: number; compliance_pct: number; days_logged: number };
  body: { start_weight_kg: number | null; end_weight_kg: number | null; weight_change_kg: number | null };
  total_workouts: number;
  total_prs: number;
  longest_streak: number;
  most_trained_muscle: string | null;
}

export function YearInReviewScreen({ navigation }: ProfileScreenProps<'YearInReview'>) {
  const c = useThemeColors();
  const s = getThemedStyles(c);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState<YearlyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCurrent = year >= now.getFullYear();

  const fetchReport = useCallback(async (y: number) => {
    setError(null);
    try {
      const { data } = await api.get('reports/yearly', { params: { year: y } });
      setReport(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load report'));
      setReport(null);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchReport(year).finally(() => setIsLoading(false));
  }, [year, fetchReport]);

  const changeYear = (delta: number) => {
    const next = year + delta;
    if (next > now.getFullYear()) return;
    setYear(next);
  };

  const handleShare = async () => {
    if (!report) return;
    try {
      await Share.share({
        message: `${report.year} Year in Review — ${report.total_workouts} workouts, ${Math.round(report.training.total_volume)}kg volume, ${report.total_prs} PRs, ${report.longest_streak}-day streak`,
      });
    } catch {
      Alert.alert('Error', 'Could not share report');
    }
  };

  const r = report;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[s.backBtn, { color: c.accent.primary }]}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: c.text.primary }]}>Year in Review</Text>
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="share" size={20} color={c.accent.primary} />
          </TouchableOpacity>
        </View>

        {/* Year Selector */}
        <View style={s.selector}>
          <TouchableOpacity onPress={() => changeYear(-1)} style={s.arrow}>
            <Text style={[s.arrowText, { color: c.accent.primary }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[s.selectorLabel, { color: c.text.primary }]}>{year}</Text>
          <TouchableOpacity onPress={() => changeYear(1)} style={[s.arrow, isCurrent && s.arrowDisabled]} disabled={isCurrent}>
            <Text style={[s.arrowText, isCurrent && { color: c.text.muted }]}>›</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={s.skeletons}>
            <Skeleton width="100%" height={120} borderRadius={8} />
            <Skeleton width="100%" height={120} borderRadius={8} />
          </View>
        ) : error ? (
          <View style={s.errorContainer}>
            <Icon name="alert-circle" size={40} color={c.semantic.negative} />
            <Text style={[s.errorTitle, { color: c.text.primary }]}>Something went wrong</Text>
            <Text style={[s.errorMessage, { color: c.text.secondary }]}>{error}</Text>
            <TouchableOpacity style={[s.retryButton, { backgroundColor: c.accent.primary }]} onPress={() => { setIsLoading(true); fetchReport(year).finally(() => setIsLoading(false)); }}>
              <Text style={[s.retryText, { color: c.text.inverse }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : !r ? (
          <EmptyState icon={<Icon name="chart" />} title="No data" description="No data available for this year." />
        ) : (
          <>
            {/* Stats Grid */}
            <Text style={[s.sectionTitle, { color: c.text.primary }]}>Highlights</Text>
            <Card>
              <View style={s.grid}>
                <StatItem label="Total Workouts" value={`${r.total_workouts}`} c={c} />
                <StatItem label="Total Volume" value={`${Math.round(r.training.total_volume)} kg`} c={c} />
                <StatItem label="PRs Set" value={`${r.total_prs}`} c={c} />
                <StatItem label="Longest Streak" value={`${r.longest_streak} days`} c={c} />
                <StatItem label="Meals Logged" value={`${r.nutrition.days_logged}`} c={c} />
                <StatItem label="Compliance" value={`${r.nutrition.compliance_pct.toFixed(0)}%`} c={c} />
              </View>
            </Card>

            {/* Most Trained Muscle */}
            {r.most_trained_muscle && (
              <>
                <Text style={[s.sectionTitle, { color: c.text.primary }]}>Most Trained Muscle</Text>
                <Card>
                  <Text style={[s.highlight, { color: c.accent.primary }]}>{r.most_trained_muscle}</Text>
                  <Text style={[s.highlightSub, { color: c.text.secondary }]}>
                    {Math.round(r.training.volume_by_muscle_group[r.most_trained_muscle] ?? 0)} kg volume
                  </Text>
                </Card>
              </>
            )}

            {/* Weight Change */}
            {(r.body.start_weight_kg != null || r.body.end_weight_kg != null) && (
              <>
                <Text style={[s.sectionTitle, { color: c.text.primary }]}>Body</Text>
                <Card>
                  <View style={s.grid}>
                    {r.body.start_weight_kg != null && <StatItem label="Start" value={`${r.body.start_weight_kg} kg`} c={c} />}
                    {r.body.end_weight_kg != null && <StatItem label="End" value={`${r.body.end_weight_kg} kg`} c={c} />}
                    {r.body.weight_change_kg != null && (
                      <StatItem label="Change" value={`${r.body.weight_change_kg > 0 ? '+' : ''}${r.body.weight_change_kg} kg`} c={c} />
                    )}
                  </View>
                </Card>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ label, value, c }: { label: string; value: string; c: ThemeColors }) {
  const s = getThemedStyles(c);
  return (
    <View style={s.statItem}>
      <Text style={[s.statLabel, { color: c.text.secondary }]}>{label}</Text>
      <Text style={[s.statValue, { color: c.text.primary }]}>{value}</Text>
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[12] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  backBtn: { fontSize: typography.size.lg },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.semibold },
  selector: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: spacing[4], gap: spacing[4] },
  arrow: { padding: spacing[2] },
  arrowDisabled: { opacity: 0.3 },
  arrowText: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold },
  selectorLabel: { fontSize: typography.size.lg, fontWeight: typography.weight.medium },
  sectionTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, marginTop: spacing[5], marginBottom: spacing[3] },
  skeletons: { gap: spacing[4] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  statItem: { width: '45%', marginBottom: spacing[2] },
  statLabel: { fontSize: typography.size.xs },
  statValue: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
  highlight: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, textTransform: 'capitalize' },
  highlightSub: { fontSize: typography.size.sm, marginTop: spacing[1] },
  errorContainer: { alignItems: 'center', paddingVertical: spacing[10], gap: spacing[3] },
  errorTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
  errorMessage: { fontSize: typography.size.sm, textAlign: 'center', paddingHorizontal: spacing[6] },
  retryButton: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.sm, marginTop: spacing[2] },
  retryText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
});
