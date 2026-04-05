import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/Skeleton';
import { Icon } from '../../components/common/Icon';
import { ReportCard } from '../../components/reports/ReportCard';
import { useWNSVolume } from '../../hooks/useWNSVolume';
import type { WNSMuscleVolume } from '../../types/volume';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';
import type { AnalyticsScreenProps } from '../../types/navigation';

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

interface UserGoals {
  goalType: string;
  goalRatePerWeek: number | null;
}

const GOAL_LABELS: Record<string, string> = {
  cutting: 'Cutting',
  bulking: 'Bulking',
  maintaining: 'Maintaining',
  recomposition: 'Recomposition',
};

function getGoalMultiplier(goalType: string, rate: number | null): number {
  const r = Math.abs(rate ?? 0);
  if (goalType === 'cutting') return Math.max(0.70, 1.0 - r * 0.3);
  if (goalType === 'bulking') return Math.min(1.20, 1.0 + r * 0.25);
  if (goalType === 'recomposition') return 0.95;
  return 1.0;
}

function getWNSStatusInfo(status: WNSMuscleVolume['status']): { label: string; color: string } {
  const c = getThemeColors();
  switch (status) {
    case 'optimal': return { label: '✅ Optimal', color: c.semantic.positive };
    case 'below_mev': return { label: '⬇️ Below MEV', color: c.semantic.warning };
    case 'approaching_mrv': return { label: '⚠️ Near MRV', color: c.semantic.warning };
    case 'above_mrv': return { label: '🔴 Above MRV', color: c.semantic.negative };
    default: return { label: status, color: c.text.secondary };
  }
}

function getMuscleInsight(m: WNSMuscleVolume): string | null {
  if (m.status === 'below_mev') return `Add ${Math.ceil(m.landmarks.mev - m.hypertrophy_units)} HU to reach minimum effective volume`;
  if (m.status === 'above_mrv') return `Reduce volume — exceeding recovery capacity by ${Math.round(m.hypertrophy_units - m.landmarks.mrv)} HU`;
  if (m.status === 'approaching_mrv') return 'Close to MRV — monitor fatigue and recovery';
  return null;
}

export function WeeklyReportScreen({ navigation }: AnalyticsScreenProps<'WeeklyReport'>) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const now = getISOWeek(new Date());
  const [year, setYear] = useState(now.year);
  const [week, setWeek] = useState(now.week);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const reportCardRef = useRef<any>(null);

  const isCurrentWeek = year === now.year && week === now.week;

  // Compute Monday of the selected ISO week for volume data
  const weekStart = useMemo(() => {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7;
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
    return getLocalDateString(monday);
  }, [year, week]);

  const { data: volumeData, isWNS } = useWNSVolume(weekStart, goals?.goalType);

  // Fetch user goals once
  useEffect(() => {
    api.get('users/goals').then(({ data }) => {
      if (data) setGoals({ goalType: data.goal_type, goalRatePerWeek: data.goal_rate_per_week ?? null });
    }).catch(() => {}); // Intentional: goals fetch is best-effort for report display
  }, []);

  // Top trained muscles sorted by HU, limited to 4
  const topMuscles = useMemo(() => {
    if (!isWNS || !volumeData?.muscle_groups) return [];
    return [...volumeData.muscle_groups]
      .filter(m => m.hypertrophy_units > 0)
      .sort((a, b) => b.hypertrophy_units - a.hypertrophy_units)
      .slice(0, 4);
  }, [volumeData, isWNS]);

  const fetchReport = useCallback(async (y: number, w: number) => {
    setError(null);
    try {
      const { data } = await api.get('reports/weekly', { params: { year: y, week: w } });
      setReport(data);
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Failed to load report');
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
    <SafeAreaView style={[getStyles().safe, { backgroundColor: c.bg.base }]} edges={['top']}>
      <ScrollView style={getStyles().container} contentContainerStyle={getStyles().content}>
        {/* Header */}
        <View style={getStyles().header}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[getStyles().backBtn, { color: c.accent.primary }]}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={[getStyles().title, { color: c.text.primary }]}>Weekly Report</Text>
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="share" size={20} color={c.accent.primary} />
          </TouchableOpacity>
        </View>

        {/* Week Selector */}
        <View style={getStyles().weekSelector}>
          <TouchableOpacity onPress={() => changeWeek(-1)} style={getStyles().weekArrow}>
            <Text style={[getStyles().arrowText, { color: c.accent.primary }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[getStyles().weekLabel, { color: c.text.primary }]}>Week {week}, {year}</Text>
          <TouchableOpacity
            onPress={() => changeWeek(1)}
            style={[getStyles().weekArrow, isCurrentWeek && getStyles().weekArrowDisabled]}
            disabled={isCurrentWeek}
          >
            <Text style={[getStyles().arrowText, isCurrentWeek && getStyles().arrowDisabled]}>›</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={getStyles().skeletons}>
            <Skeleton width="100%" height={120} borderRadius={8} />
            <Skeleton width="100%" height={120} borderRadius={8} />
            <Skeleton width="100%" height={80} borderRadius={8} />
            <Skeleton width="100%" height={100} borderRadius={8} />
          </View>
        ) : error ? (
          <View style={getStyles().errorContainer}>
            <Icon name="alert-circle" size={40} color={c.semantic.negative} />
            <Text style={[getStyles().errorTitle, { color: c.text.primary }]}>Something went wrong</Text>
            <Text style={[getStyles().errorMessage, { color: c.text.secondary }]}>{error}</Text>
            <TouchableOpacity style={[getStyles().retryButton, { backgroundColor: c.accent.primary }]} onPress={handleRetry}>
              <Text style={[getStyles().retryText, { color: c.text.inverse }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : !report ? (
          <EmptyState icon={<Icon name="chart" />} title="No report data" description="No data available for this week. Start logging to see your weekly report." />
        ) : (
          <>
            {/* Training Section */}
            <Text style={[getStyles().sectionTitle, { color: c.text.primary }]}>Training</Text>
            <Card>
              {report.training.session_count === 0 ? (
                <Text style={[getStyles().emptyText, { color: c.text.muted }]}>No training sessions this week</Text>
              ) : (
                <View style={getStyles().metricsGrid}>
                  <MetricItem label="Total Volume" value={`${Math.round(report.training.total_volume)} kg`} />
                  <MetricItem label="Sessions" value={String(report.training.session_count)} />
                  {Object.entries(report.training.volume_by_muscle_group).slice(0, 4).map(([mg, vol]) => (
                    <MetricItem key={mg} label={mg} value={`${Math.round(vol)} kg`} />
                  ))}
                  {report.training.personal_records.map((pr, i) => (
                    <Text key={i} style={[getStyles().prText, { color: c.semantic.positive }]}>🏆 {pr.exercise_name}: {pr.new_weight_kg}kg × {pr.reps}</Text>
                  ))}
                </View>
              )}
            </Card>

            {/* Nutrition Section */}
            <Text style={[getStyles().sectionTitle, { color: c.text.primary }]}>Nutrition</Text>
            <Card>
              {report.nutrition.days_logged === 0 ? (
                <Text style={[getStyles().emptyText, { color: c.text.muted }]}>No nutrition data this week</Text>
              ) : (
                <View style={getStyles().metricsGrid}>
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
            <Text style={[getStyles().sectionTitle, { color: c.text.primary }]}>Body</Text>
            <Card>
              {report.body.start_weight_kg == null && report.body.end_weight_kg == null ? (
                <Text style={[getStyles().emptyText, { color: c.text.muted }]}>No bodyweight data this week</Text>
              ) : (
                <View style={getStyles().metricsGrid}>
                  {report.body.start_weight_kg != null && <MetricItem label="Start" value={`${report.body.start_weight_kg} kg`} />}
                  {report.body.end_weight_kg != null && <MetricItem label="End" value={`${report.body.end_weight_kg} kg`} />}
                  {report.body.weight_trend_kg != null && (
                    <MetricItem label="Trend" value={`${report.body.weight_trend_kg > 0 ? '+' : ''}${report.body.weight_trend_kg} kg`} />
                  )}
                </View>
              )}
            </Card>

            {/* Recommendations Section */}
            <Text style={[getStyles().sectionTitle, { color: c.text.primary }]}>Recommendations</Text>
            <Card>
              {report.recommendations.length === 0 ? (
                <Text style={[getStyles().emptyText, { color: c.text.muted }]}>No recommendations this week</Text>
              ) : (
                report.recommendations.map((rec, i) => (
                  <View key={i} style={getStyles().recRow}>
                    <Text style={getStyles().recBullet}>💡</Text>
                    <Text style={[getStyles().recText, { color: c.text.primary }]}>{rec}</Text>
                  </View>
                ))
              )}
            </Card>

            {/* Volume Intelligence Section */}
            {isWNS && topMuscles.length > 0 && (
              <>
                <Text style={[getStyles().sectionTitle, { color: c.text.primary }]}>Volume Intelligence</Text>
                <Card>
                  {goals && (
                    <>
                      <Text style={[getStyles().goalText, { color: c.text.primary }]}>
                        Your goal: {GOAL_LABELS[goals.goalType] ?? goals.goalType}
                        {goals.goalRatePerWeek ? ` (${goals.goalRatePerWeek > 0 ? '+' : ''}${goals.goalRatePerWeek} kg/week)` : ''}
                      </Text>
                      {(() => {
                        const mult = getGoalMultiplier(goals.goalType, goals.goalRatePerWeek);
                        if (mult === 1.0) return null;
                        const pct = Math.round(Math.abs(1 - mult) * 100);
                        return (
                          <Text style={[getStyles().adjustmentText, { color: c.text.secondary }]}>
                            Volume adjustment: {mult < 1 ? `-${pct}%` : `+${pct}%`} (recovery capacity {mult < 1 ? 'reduced' : 'enhanced'})
                          </Text>
                        );
                      })()}
                    </>
                  )}
                  {topMuscles.map(m => {
                    const { label, color } = getWNSStatusInfo(m.status);
                    const insight = getMuscleInsight(m);
                    return (
                      <View key={m.muscle_group} style={[getStyles().muscleRow, { borderTopColor: c.border.subtle }]}>
                        <View style={getStyles().muscleHeader}>
                          <Text style={[getStyles().muscleName, { color: c.text.primary }]}>{m.muscle_group}</Text>
                          <Text style={[getStyles().muscleStatus, { color }]}>{label}</Text>
                        </View>
                        <Text style={[getStyles().muscleHU, { color: c.text.secondary }]}>
                          {m.hypertrophy_units.toFixed(1)} / {m.landmarks.mav_high.toFixed(1)} HU
                        </Text>
                        {insight && <Text style={[getStyles().insight, { color: c.text.secondary }]}>💡 {insight}</Text>}
                      </View>
                    );
                  })}
                </Card>
              </>
            )}

            {/* Shareable Report Card */}
            <ReportCard ref={reportCardRef} report={report} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  const c = useThemeColors();
  return (
    <View style={getStyles().metricItem}>
      <Text style={[getStyles().metricLabel, { color: c.text.secondary }]}>{label}</Text>
      <Text style={[getStyles().metricValue, { color: c.text.primary }]}>{value}</Text>
    </View>
  );
}


/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.base },
  container: { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[12] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  backBtn: { color: c.accent.primary, fontSize: typography.size.lg },
  title: { color: c.text.primary, fontSize: typography.size.xl, fontWeight: typography.weight.semibold },
  weekSelector: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: spacing[4], gap: spacing[4] },
  weekArrow: { padding: spacing[2] },
  weekArrowDisabled: { opacity: 0.3 },
  arrowText: { color: c.accent.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold },
  arrowDisabled: { color: c.text.muted },
  weekLabel: { color: c.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.medium },
  sectionTitle: { color: c.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.semibold, marginTop: spacing[5], marginBottom: spacing[3] },
  skeletons: { gap: spacing[4] },
  emptyText: { color: c.text.muted, fontSize: typography.size.sm, textAlign: 'center', padding: spacing[4] },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  metricItem: { width: '45%', marginBottom: spacing[2] },
  metricLabel: { color: c.text.secondary, fontSize: typography.size.xs },
  metricValue: { color: c.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
  prText: { color: c.semantic.positive, fontSize: typography.size.sm, marginTop: spacing[2] },
  recRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  recBullet: { fontSize: typography.size.base },
  recText: { color: c.text.primary, fontSize: typography.size.sm, flex: 1, lineHeight: 20 },
  errorContainer: { alignItems: 'center', paddingVertical: spacing[10], gap: spacing[3] },
  errorTitle: { color: c.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
  errorMessage: { color: c.text.secondary, fontSize: typography.size.sm, textAlign: 'center', paddingHorizontal: spacing[6] },
  retryButton: { backgroundColor: c.accent.primary, paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.sm, marginTop: spacing[2] },
  retryText: { color: c.text.inverse, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  goalText: { color: c.text.primary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, marginBottom: spacing[1] },
  adjustmentText: { color: c.text.secondary, fontSize: typography.size.xs, marginBottom: spacing[3] },
  muscleRow: { paddingVertical: spacing[3], borderTopWidth: 1, borderTopColor: c.border.subtle },
  muscleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muscleName: { color: c.text.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  muscleStatus: { fontSize: typography.size.xs, fontWeight: typography.weight.medium },
  muscleHU: { color: c.text.secondary, fontSize: typography.size.xs, marginTop: spacing[1] },
  insight: { color: c.text.secondary, fontSize: typography.size.xs, marginTop: spacing[1], fontStyle: 'italic' },
});
