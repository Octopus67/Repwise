import { useEffect, useState, useCallback, useMemo } from 'react'; // Audit fix 7.3
import { getLocalDateString } from '../../utils/localDate';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, letterSpacing } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { AnimatedTabIndicator } from '../../components/common/AnimatedTabIndicator';
import { TimeRangeSelector } from '../../components/charts/TimeRangeSelector';
import { filterByTimeRange } from '../../utils/filterByTimeRange';
import { useStore, isPremium } from '../../store';
import { Icon } from '../../components/common/Icon';
import api from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'; // Audit fix 7.7
import type { AnalyticsStackParamList } from '../../navigation/BottomTabNavigator'; // Audit fix 7.7
import { useHaptics } from '../../hooks/useHaptics';
import { TrainingTabContent } from './TrainingTabContent';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useRoute } from '@react-navigation/native';
import type { WNSMuscleVolume } from '../../types/volume';
import type { TimeRange, TrendPoint, FatigueScore, Classification } from '../../types/analytics';
import { NutritionTab } from './tabs/NutritionTab';
import { BodyTab } from './tabs/BodyTab';
import { VolumeTab } from './tabs/VolumeTab';

type AnalyticsTab = 'nutrition' | 'training' | 'body' | 'volume';

interface DietaryGap {
  nutrient: string;
  average: number;
  recommended: number;
  deficit_pct: number;
}

const EXERCISE_OPTIONS = [
  'bench press',
  'squat',
  'deadlift',
  'overhead press',
  'barbell row',
] as const;

type ExerciseOption = typeof EXERCISE_OPTIONS[number];

const E1RM_EXERCISE_OPTIONS = [
  'barbell bench press',
  'barbell back squat',
  'conventional deadlift',
  'overhead press',
  'barbell row',
] as const;

type E1RMExerciseOption = typeof E1RM_EXERCISE_OPTIONS[number];

export function AnalyticsScreen() {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const store = useStore();
  const premium = isPremium(store);
  const unitSystem = store.unitSystem;
  const navigation = useNavigation<NativeStackNavigationProp<AnalyticsStackParamList>>(); // Audit fix 7.7
  const route = useRoute<any>();
  const { impact } = useHaptics();

  const [selectedTab, setSelectedTab] = useState<AnalyticsTab>(route.params?.initialTab ?? 'nutrition');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weightTrend, setWeightTrend] = useState<TrendPoint[]>([]);
  const [calorieTrend, setCalorieTrend] = useState<TrendPoint[]>([]);
  const [proteinTrend, setProteinTrend] = useState<TrendPoint[]>([]);
  const [volumeTrend, setVolumeTrend] = useState<TrendPoint[]>([]);
  const [strengthData, setStrengthData] = useState<TrendPoint[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseOption>(EXERCISE_OPTIONS[0]);
  const [gaps, setGaps] = useState<DietaryGap[]>([]);
  const [adaptiveTarget, setAdaptiveTarget] = useState<{ calories: number; protein: number } | null>(null);
  const [e1rmTrend, setE1rmTrend] = useState<TrendPoint[]>([]);
  const [selectedE1RMExercise, setSelectedE1RMExercise] = useState<E1RMExerciseOption>(E1RM_EXERCISE_OPTIONS[0]);
  const [strengthStandards, setStrengthStandards] = useState<{
    classifications: Classification[];
    milestones: { message: string }[];
    bodyweight_kg: number | null;
  } | null>(null);
  const [fatigueScores, setFatigueScores] = useState<FatigueScore[]>([]);
  const [selectedFatigueGroup, setSelectedFatigueGroup] = useState<FatigueScore | null>(null);
  const [wnsExplainerExpanded, setWnsExplainerExpanded] = useState(false);
  const [volumeLandmarks, setVolumeLandmarks] = useState<WNSMuscleVolume[]>([]);
  const [volumeLoading, setVolumeLoading] = useState(false);
  const { enabled: volumeFlagEnabled } = useFeatureFlag('volume_landmarks');
  const [refreshing, setRefreshing] = useState(false);
  const [tabContainerWidth, setTabContainerWidth] = useState(0);

  const loadAnalytics = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    setIsLoading(true);
    try {
      const end = getLocalDateString();
      const days = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[timeRange];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const start = getLocalDateString(startDate);

      const [bwRes, nutritionRes, adaptiveRes] = await Promise.allSettled([
        api.get('users/bodyweight/history', { params: { limit: days }, signal }),
        api.get('nutrition/entries', { params: { start_date: start, end_date: end, limit: 500 }, signal }),
        api.get('adaptive/snapshots', { params: { limit: 1 }, signal }),
      ]);

      if (bwRes.status === 'fulfilled') {
        const logs = bwRes.value.data?.items ?? [];
        setWeightTrend(logs.map((l: { recorded_date: string; weight_kg: number }) => ({ date: l.recorded_date, value: l.weight_kg })));
      }

      if (nutritionRes.status === 'fulfilled') {
        const entries = nutritionRes.value.data?.items ?? [];
        const byDate: Record<string, { cal: number; pro: number }> = {};
        entries.forEach((e: { entry_date: string; calories?: number; protein_g?: number }) => {
          if (!byDate[e.entry_date]) byDate[e.entry_date] = { cal: 0, pro: 0 };
          byDate[e.entry_date].cal += e.calories ?? 0;
          byDate[e.entry_date].pro += e.protein_g ?? 0;
        });
        const dates = Object.keys(byDate).sort();
        setCalorieTrend(dates.map((d) => ({ date: d, value: Math.round(byDate[d].cal) })));
        setProteinTrend(dates.map((d) => ({ date: d, value: Math.round(byDate[d].pro) })));
      }

      if (adaptiveRes.status === 'fulfilled') {
        const snap = adaptiveRes.value.data.items?.[0];
        if (snap) {
          setAdaptiveTarget({
            calories: Math.round(snap.target_calories),
            protein: Math.round(snap.target_protein_g),
          });
        }
      }

      if (premium) {
        try {
          const { data } = await api.get('dietary/gaps', { params: { window_days: 14 }, signal });
          setGaps(data.gaps ?? []);
        } catch (e: unknown) { console.warn('[Analytics] dietary gaps fetch failed:', getErrorMessage(e)); }
      }

      // Fetch fatigue scores
      try {
        const { data } = await api.get('training/fatigue', { signal });
        setFatigueScores(data.scores ?? []);
      } catch (e: unknown) {
        console.warn('[Analytics] fatigue fetch failed:', getErrorMessage(e));
        setFatigueScores([]);
      }
    } catch {
      setError('Unable to load analytics. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [premium, timeRange]);

  const loadVolumeTrend = useCallback(async (signal?: AbortSignal) => {
    try {
      const end = getLocalDateString();
      const days = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[timeRange];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const start = getLocalDateString(startDate);
      const { data } = await api.get('training/analytics/volume-trend', {
        params: { start_date: start, end_date: end }, signal,
      });
      const items = data.items ?? data ?? [];
      setVolumeTrend(items.map((p: { date: string; total_volume: number }) => ({ date: p.date, value: p.total_volume })));
    } catch (e: unknown) { console.warn('[Analytics] volume trend fetch failed:', getErrorMessage(e)); }
  }, [timeRange]);

  const loadStrengthProgression = useCallback(async (signal?: AbortSignal) => {
    try {
      const end = getLocalDateString();
      const days = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[timeRange];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const start = getLocalDateString(startDate);
      const { data } = await api.get('training/analytics/strength-progression', {
        params: { exercise_name: selectedExercise, start_date: start, end_date: end }, signal,
      });
      const items = data.items ?? data ?? [];
      setStrengthData(items.map((p: { date: string; best_weight_kg: number }) => ({ date: p.date, value: p.best_weight_kg })));
    } catch (e: unknown) { console.warn('[Analytics] strength progression fetch failed:', getErrorMessage(e)); }
  }, [selectedExercise, timeRange]);

  const loadE1RMTrend = useCallback(async (signal?: AbortSignal) => {
    try {
      const end = getLocalDateString();
      const days = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[timeRange];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const start = getLocalDateString(startDate);
      const { data } = await api.get('training/analytics/e1rm-history', {
        params: { exercise_name: selectedE1RMExercise, start_date: start, end_date: end }, signal,
      });
      const items = Array.isArray(data) ? data : data.items ?? [];
      setE1rmTrend(items.map((p: { date: string; e1rm_kg: number }) => ({ date: p.date, value: p.e1rm_kg })));
    } catch (e: unknown) { console.warn('[Analytics] e1rm trend fetch failed:', getErrorMessage(e)); }
  }, [selectedE1RMExercise, timeRange]);

  const loadStrengthStandards = useCallback(async (signal?: AbortSignal) => {
    try {
      const { data } = await api.get('training/analytics/strength-standards', { signal });
      setStrengthStandards(data);
    } catch (e: unknown) { console.warn('[Analytics] strength standards fetch failed:', getErrorMessage(e)); }
  }, []);

  const loadVolumeLandmarks = useCallback(async (signal?: AbortSignal) => {
    setVolumeLoading(true);
    try {
      const { data } = await api.get('training/analytics/muscle-volume', { signal });
      const groups: WNSMuscleVolume[] = data.muscle_groups ?? data ?? [];
      groups.sort((a, b) => (b.hypertrophy_units ?? 0) - (a.hypertrophy_units ?? 0));
      setVolumeLandmarks(groups);
    } catch (e: unknown) { console.warn('[Analytics] volume landmarks fetch failed:', getErrorMessage(e)); }
    finally { setVolumeLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadAnalytics(controller.signal);
    return () => controller.abort();
  }, [loadAnalytics]);

  useEffect(() => {
    const controller = new AbortController(); // Audit fix 7.3
    loadVolumeTrend(controller.signal);
    return () => controller.abort();
  }, [loadVolumeTrend]);

  useEffect(() => {
    const controller = new AbortController(); // Audit fix 7.3
    loadStrengthProgression(controller.signal);
    return () => controller.abort();
  }, [loadStrengthProgression]);

  useEffect(() => {
    const controller = new AbortController(); // Audit fix 7.3
    loadE1RMTrend(controller.signal);
    return () => controller.abort();
  }, [loadE1RMTrend]);

  useEffect(() => {
    const controller = new AbortController(); // Audit fix 7.3
    loadStrengthStandards(controller.signal);
    return () => controller.abort();
  }, [loadStrengthStandards]);

  useEffect(() => {
    const controller = new AbortController(); // Audit fix 7.3
    if (selectedTab === 'volume') loadVolumeLandmarks(controller.signal);
    return () => controller.abort();
  }, [selectedTab, loadVolumeLandmarks]);

  // Audit fix 7.3 — memoize expensive computations
  const filteredCalories = useMemo(() => filterByTimeRange(calorieTrend, timeRange), [calorieTrend, timeRange]);
  const filteredProtein = useMemo(() => filterByTimeRange(proteinTrend, timeRange), [proteinTrend, timeRange]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']} testID="analytics-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadAnalytics(); setRefreshing(false); }} tintColor={c.accent.primary} />}>
        <Text style={[styles.title, { color: c.text.primary }]}>Analytics</Text>

        {error && <ErrorBanner message={error} onRetry={loadAnalytics} onDismiss={() => setError(null)} />}

        {/* Tab Pills */}
        <View style={[styles.analyticsTabRow, { backgroundColor: c.bg.surface }]}
          onLayout={(e) => setTabContainerWidth(e.nativeEvent.layout.width)}>
          {(['nutrition', 'training', 'body', 'volume'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.analyticsTab, selectedTab === t && styles.analyticsTabActive]}
              onPress={() => { impact('light'); setSelectedTab(t); }}
              testID={`analytics-tab-${t}`}
              accessibilityRole="tab"
              accessibilityLabel={`${t.charAt(0).toUpperCase() + t.slice(1)} analytics tab`}
              accessibilityState={{ selected: selectedTab === t }}
            >
              <Text style={[styles.analyticsTabText, selectedTab === t && styles.analyticsTabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          <AnimatedTabIndicator activeIndex={['nutrition', 'training', 'body', 'volume'].indexOf(selectedTab)} tabCount={4} containerWidth={tabContainerWidth} />
        </View>

        {/* Weekly Intelligence Report link — visible on ALL tabs */}
        <TouchableOpacity
          testID="analytics-weekly-report-link"
          style={[styles.nutritionReportBtn, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}
          onPress={() => navigation.navigate('WeeklyReport')}
          accessibilityRole="link"
          accessibilityLabel="Weekly Intelligence Report"
          accessibilityHint="Opens the weekly intelligence report"
        >
          <Text style={[styles.nutritionReportText, { color: c.accent.primary }]}><Icon name="chart" /> Weekly Intelligence Report</Text>
          <Text style={[styles.nutritionReportArrow, { color: c.accent.primary }]}>›</Text>
        </TouchableOpacity>

        {/* Time Range Selector — visible on ALL tabs */}
        <View testID="analytics-time-range" accessibilityLabel="Time range selector">
          <TimeRangeSelector selected={timeRange} onSelect={(r) => setTimeRange(r as TimeRange)} />
        </View>

        {selectedTab === 'nutrition' && (
          <NutritionTab
            isLoading={isLoading}
            filteredCalories={filteredCalories}
            filteredProtein={filteredProtein}
            calorieTrend={calorieTrend}
            proteinTrend={proteinTrend}
            adaptiveTarget={adaptiveTarget}
            gaps={gaps}
            premium={premium}
            timeRange={timeRange}
            onNavigateNutritionReport={() => navigation.navigate('NutritionReport')}
            onNavigateMicroDashboard={() => navigation.navigate('MicronutrientDashboard')}
          />
        )}

        {selectedTab === 'training' && (
          <TrainingTabContent
            c={c}
            isLoading={isLoading}
            unitSystem={unitSystem}
            wnsExplainerExpanded={wnsExplainerExpanded}
            onToggleWnsExplainer={() => setWnsExplainerExpanded(!wnsExplainerExpanded)}
            onNavigateHUExplainer={() => navigation.navigate('HUExplainer')}
            volumeTrend={volumeTrend}
            fatigueScores={fatigueScores}
            selectedFatigueGroup={selectedFatigueGroup}
            onFatigueGroupPress={(mg) => {
              const found = fatigueScores.find((s) => s.muscle_group === mg);
              setSelectedFatigueGroup(found ?? null);
            }}
            onFatigueModalClose={() => setSelectedFatigueGroup(null)}
            selectedExercise={selectedExercise}
            onSelectExercise={setSelectedExercise}
            strengthData={strengthData}
            selectedE1RMExercise={selectedE1RMExercise}
            onSelectE1RMExercise={setSelectedE1RMExercise}
            e1rmTrend={e1rmTrend}
            strengthStandards={strengthStandards}
          />
        )}

        {selectedTab === 'body' && (
          <BodyTab
            isLoading={isLoading}
            weightTrend={weightTrend}
            calorieTrend={calorieTrend}
            timeRange={timeRange}
            unitSystem={unitSystem}
          />
        )}

        {selectedTab === 'volume' && (
          <VolumeTab
            volumeFlagEnabled={volumeFlagEnabled}
            volumeLoading={volumeLoading}
            volumeLandmarks={volumeLandmarks}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.base },
  container: { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[12] },
  title: {
    color: c.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[4],
    lineHeight: typography.lineHeight.xl,
    letterSpacing: letterSpacing.tight,
  },
  nutritionReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.bg.surface,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  nutritionReportText: {
    color: c.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.base,
  },
  nutritionReportArrow: {
    color: c.accent.primary,
    fontSize: typography.size.lg,
  },
  analyticsTabRow: {
    flexDirection: 'row',
    backgroundColor: c.bg.surface,
    borderRadius: radius.sm,
    padding: spacing[1],
    marginBottom: spacing[3],
  },
  analyticsTab: {
    flex: 1,
    paddingVertical: spacing[2],
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  analyticsTabActive: { backgroundColor: c.accent.primaryMuted },
  analyticsTabText: { color: c.text.muted, fontSize: typography.size.base, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.base },
  analyticsTabTextActive: { color: c.accent.primary },
});
