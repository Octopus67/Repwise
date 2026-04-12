import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { convertWeight } from '../../utils/unitConversion';
import { useStore } from '../../store';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/Skeleton';
import { Icon } from '../../components/common/Icon';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';
import type { AnalyticsScreenProps } from '../../types/navigation';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthlyReport {
  year: number;
  month: number;
  month_start: string;
  month_end: string;
  training: {
    total_volume: number;
    session_count: number;
    volume_by_muscle_group: Record<string, number>;
  };
  nutrition: {
    avg_calories: number;
    avg_protein_g: number;
    avg_carbs_g: number;
    avg_fat_g: number;
    compliance_pct: number;
    days_logged: number;
  };
  body: {
    start_weight_kg: number | null;
    end_weight_kg: number | null;
    weight_change_kg: number | null;
  };
  previous_month_delta: {
    volume_delta: number;
    session_delta: number;
    avg_calories_delta: number;
    avg_protein_delta: number;
    compliance_delta: number;
    weight_change_delta: number | null;
  };
}

function DeltaBadge({ value, unit, invert }: { value: number | null; unit: string; invert?: boolean }) {
  const c = useThemeColors();
  if (value == null || value === 0) return null;
  const positive = invert ? value < 0 : value > 0;
  const color = positive ? c.semantic.positive : c.semantic.negative;
  const sign = value > 0 ? '+' : '';
  return (
    <Text style={[getStyles().deltaBadge, { color }]}>
      {sign}{Math.round(value * 10) / 10}{unit}
    </Text>
  );
}

export function MonthlyReportScreen({ navigation }: AnalyticsScreenProps<'MonthlyReport'>) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const unitSystem = useStore((s) => s.unitSystem);
  const wUnit = unitSystem === 'imperial' ? 'lbs' : 'kg';
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const fetchReport = useCallback(async (y: number, m: number) => {
    setError(null);
    try {
      const { data } = await api.get('reports/monthly', { params: { year: y, month: m } });
      setReport(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load report'));
      setReport(null);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchReport(year, month).finally(() => setIsLoading(false));
  }, [year, month, fetchReport]);

  const changeMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) { newYear -= 1; newMonth = 12; }
    if (newMonth > 12) { newYear += 1; newMonth = 1; }
    if (newYear > now.getFullYear() || (newYear === now.getFullYear() && newMonth > now.getMonth() + 1)) return;
    setYear(newYear);
    setMonth(newMonth);
  };

  const handleShare = async () => {
    if (!report) return;
    try {
      const msg = `${MONTH_NAMES[report.month - 1]} ${report.year} — ${report.training.session_count} sessions, ${Math.round(convertWeight(report.training.total_volume, unitSystem))}${wUnit} volume, ${report.nutrition.compliance_pct}% compliance`;
      await Share.share({ message: msg });
    } catch {
      Alert.alert('Error', 'Could not share report');
    }
  };

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    fetchReport(year, month).finally(() => setIsLoading(false));
  };

  const d = report?.previous_month_delta;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.backBtn, { color: c.accent.primary }]}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: c.text.primary }]}>Monthly Recap</Text>
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="share" size={20} color={c.accent.primary} />
          </TouchableOpacity>
        </View>

        {/* Month Selector */}
        <View style={styles.selector}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.arrow}>
            <Text style={[styles.arrowText, { color: c.accent.primary }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.selectorLabel, { color: c.text.primary }]}>{MONTH_NAMES[month - 1]} {year}</Text>
          <TouchableOpacity
            onPress={() => changeMonth(1)}
            style={[styles.arrow, isCurrentMonth && styles.arrowDisabled]}
            disabled={isCurrentMonth}
          >
            <Text style={[styles.arrowText, isCurrentMonth && { color: c.text.muted }]}>›</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.skeletons}>
            <Skeleton width="100%" height={120} borderRadius={8} />
            <Skeleton width="100%" height={120} borderRadius={8} />
            <Skeleton width="100%" height={80} borderRadius={8} />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={40} color={c.semantic.negative} />
            <Text style={[styles.errorTitle, { color: c.text.primary }]}>Something went wrong</Text>
            <Text style={[styles.errorMessage, { color: c.text.secondary }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryButton, { backgroundColor: c.accent.primary }]} onPress={handleRetry}>
              <Text style={[styles.retryText, { color: c.text.inverse }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : !report ? (
          <EmptyState icon={<Icon name="chart" />} title="No report data" description="No data available for this month." />
        ) : (
          <>
            {/* Training */}
            <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Training</Text>
            <Card>
              {report.training.session_count === 0 ? (
                <Text style={[styles.emptyText, { color: c.text.muted }]}>No training sessions this month</Text>
              ) : (
                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: c.text.secondary }]}>Total Volume</Text>
                    <Text style={[styles.metricValue, { color: c.text.primary }]}>{Math.round(convertWeight(report.training.total_volume, unitSystem))} {wUnit}</Text>
                    <DeltaBadge value={d?.volume_delta ?? null} unit={` ${wUnit}`} />
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: c.text.secondary }]}>Sessions</Text>
                    <Text style={[styles.metricValue, { color: c.text.primary }]}>{report.training.session_count}</Text>
                    <DeltaBadge value={d?.session_delta ?? null} unit="" />
                  </View>
                  {Object.entries(report.training.volume_by_muscle_group).slice(0, 4).map(([mg, vol]) => (
                    <View key={mg} style={styles.metricItem}>
                      <Text style={[styles.metricLabel, { color: c.text.secondary }]}>{mg}</Text>
                      <Text style={[styles.metricValue, { color: c.text.primary }]}>{Math.round(convertWeight(vol, unitSystem))} {wUnit}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* Nutrition */}
            <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Nutrition</Text>
            <Card>
              {report.nutrition.days_logged === 0 ? (
                <Text style={[styles.emptyText, { color: c.text.muted }]}>No nutrition data this month</Text>
              ) : (
                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: c.text.secondary }]}>Avg Calories</Text>
                    <Text style={[styles.metricValue, { color: c.text.primary }]}>{Math.round(report.nutrition.avg_calories)} kcal</Text>
                    <DeltaBadge value={d?.avg_calories_delta ?? null} unit=" kcal" />
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: c.text.secondary }]}>Protein</Text>
                    <Text style={[styles.metricValue, { color: c.text.primary }]}>{Math.round(report.nutrition.avg_protein_g)}g</Text>
                    <DeltaBadge value={d?.avg_protein_delta ?? null} unit="g" />
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: c.text.secondary }]}>Carbs</Text>
                    <Text style={[styles.metricValue, { color: c.text.primary }]}>{Math.round(report.nutrition.avg_carbs_g)}g</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: c.text.secondary }]}>Fat</Text>
                    <Text style={[styles.metricValue, { color: c.text.primary }]}>{Math.round(report.nutrition.avg_fat_g)}g</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: c.text.secondary }]}>Compliance</Text>
                    <Text style={[styles.metricValue, { color: c.text.primary }]}>{report.nutrition.compliance_pct.toFixed(0)}%</Text>
                    <DeltaBadge value={d?.compliance_delta ?? null} unit="%" />
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: c.text.secondary }]}>Days Logged</Text>
                    <Text style={[styles.metricValue, { color: c.text.primary }]}>{report.nutrition.days_logged}</Text>
                  </View>
                </View>
              )}
            </Card>

            {/* Body */}
            <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Body</Text>
            <Card>
              {report.body.start_weight_kg == null && report.body.end_weight_kg == null ? (
                <Text style={[styles.emptyText, { color: c.text.muted }]}>No bodyweight data this month</Text>
              ) : (
                <View style={styles.metricsGrid}>
                  {report.body.start_weight_kg != null && (
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricLabel, { color: c.text.secondary }]}>Start</Text>
                      <Text style={[styles.metricValue, { color: c.text.primary }]}>{report.body.start_weight_kg} kg</Text>
                    </View>
                  )}
                  {report.body.end_weight_kg != null && (
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricLabel, { color: c.text.secondary }]}>End</Text>
                      <Text style={[styles.metricValue, { color: c.text.primary }]}>{report.body.end_weight_kg} kg</Text>
                    </View>
                  )}
                  {report.body.weight_change_kg != null && (
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricLabel, { color: c.text.secondary }]}>Change</Text>
                      <Text style={[styles.metricValue, { color: c.text.primary }]}>
                        {report.body.weight_change_kg > 0 ? '+' : ''}{report.body.weight_change_kg} kg
                      </Text>
                      <DeltaBadge value={d?.weight_change_delta ?? null} unit={` ${wUnit}`} invert />
                    </View>
                  )}
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles() { return getThemedStyles(getThemeColors()); }

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
  emptyText: { fontSize: typography.size.sm, textAlign: 'center', padding: spacing[4] },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  metricItem: { width: '45%', marginBottom: spacing[2] },
  metricLabel: { fontSize: typography.size.xs },
  metricValue: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
  deltaBadge: { fontSize: typography.size.xs, marginTop: spacing[1] },
  errorContainer: { alignItems: 'center', paddingVertical: spacing[10], gap: spacing[3] },
  errorTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
  errorMessage: { fontSize: typography.size.sm, textAlign: 'center', paddingHorizontal: spacing[6] },
  retryButton: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.sm, marginTop: spacing[2] },
  retryText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
});
