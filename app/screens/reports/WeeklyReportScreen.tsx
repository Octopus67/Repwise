import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/Skeleton';
import { Icon } from '../../components/common/Icon';
import { ReportCard } from '../../components/reports/ReportCard';
import api from '../../services/api';

interface WeeklyReport {
  year: number;
  week: number;
  week_start: string;
  week_end: string;
  training: {
    total_volume: number;
    volume_by_muscle_group: Record<string, number>;
    session_count: number;
    personal_records: { exercise_name: string; reps: number; new_weight_kg: number }[];
  };
  nutrition: {
    avg_calories: number;
    avg_protein_g: number;
    avg_carbs_g: number;
    avg_fat_g: number;
    target_calories: number;
    compliance_pct: number;
    tdee_delta: number | null;
    days_logged: number;
  };
  body: {
    start_weight_kg: number | null;
    end_weight_kg: number | null;
    weight_trend_kg: number | null;
  };
  recommendations: string[];
}

function getISOWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

/** Returns the number of ISO weeks in a given ISO year. */
function getISOWeeksInYear(year: number): number {
  const dec28 = new Date(Date.UTC(year, 11, 28));
  dec28.setUTCDate(dec28.getUTCDate() + 4 - (dec28.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(dec28.getUTCFullYear(), 0, 1));
  return Math.ceil(((dec28.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function WeeklyReportScreen({ navigation }: any) {
  const now = getISOWeek(new Date());
  const [year, setYear] = useState(now.year);
  const [week, setWeek] = useState(now.week);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reportCardRef = useRef<any>(null);

  const isCurrentWeek = year === now.year && week === now.week;

  const fetchReport = useCallback(async (y: number, w: number) => {
    setError(null);
    try {
      const { data } = await api.get('reports/weekly', { params: { year: y, week: w } });
      setReport(data);
    } catch (err: any) {
      const message = err?.response?.data?.detail ?? err?.message ?? 'Failed to load report';
      setError(message);
      setReport(null);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchReport(year, week).finally(() => setIsLoading(false));
  }, [year, week, fetchReport]);

  const changeWeek = (delta: number) => {
    let newWeek = week + delta;
    let newYear = year;
    if (newWeek < 1) {
      newYear -= 1;
      newWeek = getISOWeeksInYear(newYear);
    }
    const maxWeeks = getISOWeeksInYear(newYear);
    if (newWeek > maxWeeks) {
      newYear += 1;
      newWeek = 1;
    }
    if (newYear > now.year || (newYear === now.year && newWeek > now.week)) return;
    setYear(newYear);
    setWeek(newWeek);
  };

  const handleShare = async () => {
    if (!report) return;
    try {
      const message = `Week ${report.week}, ${report.year} — ${report.training.session_count} sessions, ${Math.round(report.training.total_volume)}kg volume, ${report.nutrition.compliance_pct}% compliance`;
      await Share.share({ message });
    } catch {
      Alert.alert('Error', 'Could not share report');
    }
  };

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    fetchReport(year, week).finally(() => setIsLoading(false));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backBtn}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Weekly Report</Text>
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="share" size={20} color={colors.accent.primary} />
          </TouchableOpacity>
        </View>

        {/* Week Selector */}
        <View style={styles.weekSelector}>
          <TouchableOpacity onPress={() => changeWeek(-1)} style={styles.weekArrow}>
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.weekLabel}>Week {week}, {year}</Text>
          <TouchableOpacity
            onPress={() => changeWeek(1)}
            style={[styles.weekArrow, isCurrentWeek && styles.weekArrowDisabled]}
            disabled={isCurrentWeek}
          >
            <Text style={[styles.arrowText, isCurrentWeek && styles.arrowDisabled]}>›</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.skeletons}>
            <Skeleton width="100%" height={120} borderRadius={8} />
            <Skeleton width="100%" height={120} borderRadius={8} />
            <Skeleton width="100%" height={80} borderRadius={8} />
            <Skeleton width="100%" height={100} borderRadius={8} />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={40} color={colors.semantic.negative} />
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : !report ? (
          <EmptyState icon={<Icon name="chart" />} title="No report data" description="No data available for this week. Start logging to see your weekly report." />
        ) : (
          <>
            {/* Training Section */}
            <Text style={styles.sectionTitle}>Training</Text>
            <Card>
              {report.training.session_count === 0 ? (
                <Text style={styles.emptyText}>No training sessions this week</Text>
              ) : (
                <View style={styles.metricsGrid}>
                  <MetricItem label="Total Volume" value={`${Math.round(report.training.total_volume)} kg`} />
                  <MetricItem label="Sessions" value={String(report.training.session_count)} />
                  {Object.entries(report.training.volume_by_muscle_group).slice(0, 4).map(([mg, vol]) => (
                    <MetricItem key={mg} label={mg} value={`${Math.round(vol)} kg`} />
                  ))}
                  {report.training.personal_records.map((pr, i) => (
                    <Text key={i} style={styles.prText}>🏆 {pr.exercise_name}: {pr.new_weight_kg}kg × {pr.reps}</Text>
                  ))}
                </View>
              )}
            </Card>

            {/* Nutrition Section */}
            <Text style={styles.sectionTitle}>Nutrition</Text>
            <Card>
              {report.nutrition.days_logged === 0 ? (
                <Text style={styles.emptyText}>No nutrition data this week</Text>
              ) : (
                <View style={styles.metricsGrid}>
                  <MetricItem label="Avg Calories" value={`${Math.round(report.nutrition.avg_calories)} kcal`} />
                  <MetricItem label="Target" value={`${Math.round(report.nutrition.target_calories)} kcal`} />
                  <MetricItem label="Protein" value={`${Math.round(report.nutrition.avg_protein_g)}g`} />
                  <MetricItem label="Carbs" value={`${Math.round(report.nutrition.avg_carbs_g)}g`} />
                  <MetricItem label="Fat" value={`${Math.round(report.nutrition.avg_fat_g)}g`} />
                  <MetricItem label="Compliance" value={`${report.nutrition.compliance_pct.toFixed(0)}%`} />
                  <MetricItem label="Days Logged" value={String(report.nutrition.days_logged)} />
                  {report.nutrition.tdee_delta != null && (
                    <MetricItem label="TDEE Δ" value={`${report.nutrition.tdee_delta > 0 ? '+' : ''}${Math.round(report.nutrition.tdee_delta)} kcal`} />
                  )}
                </View>
              )}
            </Card>

            {/* Body Section */}
            <Text style={styles.sectionTitle}>Body</Text>
            <Card>
              {report.body.start_weight_kg == null && report.body.end_weight_kg == null ? (
                <Text style={styles.emptyText}>No bodyweight data this week</Text>
              ) : (
                <View style={styles.metricsGrid}>
                  {report.body.start_weight_kg != null && <MetricItem label="Start" value={`${report.body.start_weight_kg} kg`} />}
                  {report.body.end_weight_kg != null && <MetricItem label="End" value={`${report.body.end_weight_kg} kg`} />}
                  {report.body.weight_trend_kg != null && (
                    <MetricItem label="Trend" value={`${report.body.weight_trend_kg > 0 ? '+' : ''}${report.body.weight_trend_kg} kg`} />
                  )}
                </View>
              )}
            </Card>

            {/* Recommendations Section */}
            <Text style={styles.sectionTitle}>Recommendations</Text>
            <Card>
              {report.recommendations.length === 0 ? (
                <Text style={styles.emptyText}>No recommendations this week</Text>
              ) : (
                report.recommendations.map((rec, i) => (
                  <View key={i} style={styles.recRow}>
                    <Text style={styles.recBullet}>💡</Text>
                    <Text style={styles.recText}>{rec}</Text>
                  </View>
                ))
              )}
            </Card>

            {/* Shareable Report Card */}
            <ReportCard ref={reportCardRef} report={report} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  container: { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[12] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  backBtn: { color: colors.accent.primary, fontSize: typography.size.lg },
  title: { color: colors.text.primary, fontSize: typography.size.xl, fontWeight: typography.weight.semibold },
  weekSelector: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: spacing[4], gap: spacing[4] },
  weekArrow: { padding: spacing[2] },
  weekArrowDisabled: { opacity: 0.3 },
  arrowText: { color: colors.accent.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold },
  arrowDisabled: { color: colors.text.muted },
  weekLabel: { color: colors.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.medium },
  sectionTitle: { color: colors.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.semibold, marginTop: spacing[5], marginBottom: spacing[3] },
  skeletons: { gap: spacing[4] },
  emptyText: { color: colors.text.muted, fontSize: typography.size.sm, textAlign: 'center', padding: spacing[4] },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  metricItem: { width: '45%', marginBottom: spacing[2] },
  metricLabel: { color: colors.text.secondary, fontSize: typography.size.xs },
  metricValue: { color: colors.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
  prText: { color: colors.semantic.positive, fontSize: typography.size.sm, marginTop: spacing[2] },
  recRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  recBullet: { fontSize: typography.size.base },
  recText: { color: colors.text.primary, fontSize: typography.size.sm, flex: 1, lineHeight: 20 },
  errorContainer: { alignItems: 'center', paddingVertical: spacing[10], gap: spacing[3] },
  errorTitle: { color: colors.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
  errorMessage: { color: colors.text.secondary, fontSize: typography.size.sm, textAlign: 'center', paddingHorizontal: spacing[6] },
  retryButton: { backgroundColor: colors.accent.primary, paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.sm, marginTop: spacing[2] },
  retryText: { color: colors.text.inverse, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
});
