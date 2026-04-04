import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../../components/common/Card';
import { Skeleton } from '../../components/common/Skeleton';
import { Icon } from '../../components/common/Icon';
import { TrendLineChart } from '../../components/charts/TrendLineChart';
import { TimeRangeSelector } from '../../components/charts/TimeRangeSelector';
import { convertWeight } from '../../utils/unitConversion';
import { useStore } from '../../store';
import api from '../../services/api';
import type { TimeRange } from '../../types/analytics';

const RANGE_DAYS: Record<TimeRange, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };

interface E1RMPoint {
  date: string;
  e1rm_kg: number;
  formula: string;
  low_confidence: boolean;
}

interface StrengthPoint {
  date: string;
  best_weight_kg: number;
  best_reps: number;
  estimated_1rm: number;
}

interface ExerciseHistoryScreenProps {
  route: { params: { exerciseName: string } };
  navigation: { goBack: () => void };
}

export function ExerciseHistoryScreen({ route, navigation }: ExerciseHistoryScreenProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const { exerciseName } = route.params;
  const unitSystem = useStore((s) => s.unitSystem);
  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';

  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [e1rmData, setE1rmData] = useState<E1RMPoint[]>([]);
  const [strengthData, setStrengthData] = useState<StrengthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - RANGE_DAYS[timeRange] * 86400000).toISOString().split('T')[0];
      const encoded = encodeURIComponent(exerciseName);

      const [e1rmRes, strengthRes] = await Promise.allSettled([
        api.get('training/analytics/e1rm-history', {
          params: { exercise_name: exerciseName, start_date: start, end_date: end },
        }),
        api.get('training/analytics/strength-progression', {
          params: { exercise_name: exerciseName, start_date: start, end_date: end },
        }),
      ]);

      if (e1rmRes.status === 'fulfilled') {
        const items = Array.isArray(e1rmRes.value.data) ? e1rmRes.value.data : e1rmRes.value.data?.items ?? [];
        setE1rmData(items);
      }
      if (strengthRes.status === 'fulfilled') {
        const items = Array.isArray(strengthRes.value.data) ? strengthRes.value.data : strengthRes.value.data?.items ?? [];
        setStrengthData(items);
      }
      if (e1rmRes.status === 'rejected' && strengthRes.status === 'rejected') {
        setError('Failed to load exercise history');
      }
    } catch {
      setError('Failed to load exercise history');
    } finally {
      setLoading(false);
    }
  }, [exerciseName, timeRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = e1rmData.map((p) => ({
    date: p.date,
    value: unitSystem === 'metric' ? p.e1rm_kg : convertWeight(p.e1rm_kg, unitSystem),
  }));

  const renderSession = ({ item }: { item: StrengthPoint }) => {
    const displayWeight = convertWeight(item.best_weight_kg, unitSystem);
    const d = new Date(item.date + 'T00:00:00');
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return (
      <View style={[styles.sessionRow, { borderBottomColor: c.border.subtle }]}>
        <Text style={[styles.sessionDate, { color: c.text.secondary }]}>{dateStr}</Text>
        <Text style={[styles.sessionDetail, { color: c.text.primary }]}>
          {item.best_reps} reps @ {displayWeight} {unitLabel}
        </Text>
      </View>
    );
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-left" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.text.primary }]} numberOfLines={1}>{exerciseName}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.skeletonContainer}>
          <Skeleton width="100%" height={160} borderRadius={8} />
          <View style={{ height: spacing[3] }} />
          <Skeleton width="100%" height={40} borderRadius={8} />
          <View style={{ height: spacing[3] }} />
          <Skeleton width="100%" height={80} borderRadius={8} />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && e1rmData.length === 0 && strengthData.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-left" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.text.primary }]} numberOfLines={1}>{exerciseName}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" />
          <Text style={[styles.errorText, { color: c.text.secondary }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: c.accent.primaryMuted }]} onPress={fetchData}>
            <Text style={[styles.retryText, { color: c.accent.primary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']} testID="exercise-history-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text.primary }]} numberOfLines={1}>{exerciseName}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={strengthData}
        keyExtractor={(item) => item.date}
        renderItem={renderSession}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <Card style={styles.chartCard}>
              <Text style={[styles.chartLabel, { color: c.text.muted }]}>Estimated 1RM</Text>
              <TrendLineChart
                data={chartData}
                color={c.accent.primary}
                suffix={` ${unitLabel}`}
                emptyMessage="No e1RM data for this period"
              />
            </Card>
            <View style={styles.rangeRow}>
              <TimeRangeSelector selected={timeRange} onSelect={(r) => setTimeRange(r as TimeRange)} />
            </View>
            {strengthData.length > 0 && (
              <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Sessions</Text>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: c.text.muted }]}>No sessions found for this period</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  headerSpacer: { width: 32 },
  skeletonContainer: { padding: spacing[4] },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    gap: spacing[3],
  },
  errorText: { fontSize: typography.size.md, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
  },
  retryText: { fontSize: typography.size.base, fontWeight: typography.weight.semibold },
  listContent: { padding: spacing[4], paddingBottom: spacing[12] },
  chartCard: { marginBottom: spacing[3] },
  chartLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase' as const,
    marginBottom: spacing[2],
  },
  rangeRow: { marginBottom: spacing[4] },
  sectionTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  sessionDate: { fontSize: typography.size.sm },
  sessionDetail: { fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  emptyContainer: { paddingVertical: spacing[6], alignItems: 'center' },
  emptyText: { fontSize: typography.size.base, textAlign: 'center' },
});
