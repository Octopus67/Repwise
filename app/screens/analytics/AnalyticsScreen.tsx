import { useEffect, useState, useCallback, useMemo } from 'react'; // Audit fix 7.3
import { getLocalDateString } from '../../utils/localDate';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, letterSpacing } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/Skeleton';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { AnimatedTabIndicator } from '../../components/common/AnimatedTabIndicator';
import { TrendLineChart } from '../../components/charts/TrendLineChart';
import { TimeRangeSelector } from '../../components/charts/TimeRangeSelector';
import { filterByTimeRange } from '../../utils/filterByTimeRange';
import { formatWeight } from '../../utils/unitConversion';
import { getComparisonColor } from '../../utils/comparisonColor';
import { computeEMA } from '../../utils/emaTrend';
import { WeeklySummaryCard } from '../../components/analytics/WeeklySummaryCard';
import { ExpenditureTrendCard } from '../../components/analytics/ExpenditureTrendCard';
import { useStore, isPremium } from '../../store';
import { Icon } from '../../components/common/Icon';
import api from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'; // Audit fix 7.7
import type { AnalyticsStackParamList } from '../../navigation/BottomTabNavigator'; // Audit fix 7.7
import { useHaptics } from '../../hooks/useHaptics';
import { PeriodizationCalendar } from '../../components/periodization/PeriodizationCalendar';
import { TrainingTabContent } from './TrainingTabContent';
import { ReadinessTrendChart } from '../../components/analytics/ReadinessTrendChart';
import { VolumeLandmarksCard } from '../../components/volume/VolumeLandmarksCard';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useRoute } from '@react-navigation/native';
import type { WNSMuscleVolume } from '../../types/volume';
import type { TimeRange, TrendPoint, FatigueScore, Classification } from '../../types/analytics';

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

function ChartSkeleton() {
  return (
    <View style={{ padding: spacing[4] }}>
      <Skeleton width="100%" height={160} borderRadius={8} />
    </View>
  );
}

export function AnalyticsScreen() {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const compStyles = getCompStyles(c);
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
  const filteredWeight = useMemo(() => filterByTimeRange(weightTrend, timeRange), [weightTrend, timeRange]);
  const filteredCalories = useMemo(() => filterByTimeRange(calorieTrend, timeRange), [calorieTrend, timeRange]);
  const filteredProtein = useMemo(() => filterByTimeRange(proteinTrend, timeRange), [proteinTrend, timeRange]);

  // Compute EMA trend line for bodyweight chart
  const weightEMA = useMemo(() => computeEMA(filteredWeight), [filteredWeight]);

  // Compute caloriesByDate record for ExpenditureTrendCard
  const caloriesByDate = useMemo(() => {
    const result: Record<string, number> = {};
    calorieTrend.forEach((p) => { result[p.date] = p.value; });
    return result;
  }, [calorieTrend]);

  const weightSuffix = unitSystem === 'metric' ? ' kg' : ' lbs';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']} testID="analytics-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadAnalytics(); setRefreshing(false); }} tintColor={c.accent.primary} />}>
        <Text style={[styles.title, { color: c.text.primary }]}>Analytics</Text>

        {/* Error Banner */}
        {error && (
          <ErrorBanner
            message={error}
            onRetry={loadAnalytics}
            onDismiss={() => setError(null)}
          />
        )}

        {/* Tab Pills */}
        <View style={[styles.analyticsTabRow, { backgroundColor: c.bg.surface }]}
          onLayout={(e) => setTabContainerWidth(e.nativeEvent.layout.width)}>
          {(['nutrition', 'training', 'body', 'volume'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.analyticsTab, selectedTab === t && styles.analyticsTabActive]}
              onPress={() => { impact('light'); setSelectedTab(t); }}
              testID={`analytics-tab-${t}`}
            >
              <Text style={[styles.analyticsTabText, selectedTab === t && styles.analyticsTabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          <AnimatedTabIndicator
            activeIndex={['nutrition', 'training', 'body', 'volume'].indexOf(selectedTab)}
            tabCount={4}
            containerWidth={tabContainerWidth}
          />
        </View>

        {/* Weekly Intelligence Report link — visible on ALL tabs */}
        <TouchableOpacity
          testID="analytics-weekly-report-link"
          style={[styles.nutritionReportBtn, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}
          onPress={() => navigation.navigate('WeeklyReport')}
        >
          <Text style={[styles.nutritionReportText, { color: c.accent.primary }]}><Icon name="chart" /> Weekly Intelligence Report</Text>
          <Text style={[styles.nutritionReportArrow, { color: c.accent.primary }]}>›</Text>
        </TouchableOpacity>

        {/* Time Range Selector — visible on ALL tabs */}
        <View testID="analytics-time-range">
          <TimeRangeSelector selected={timeRange} onSelect={(r) => setTimeRange(r as TimeRange)} />
        </View>

        {/* ===== NUTRITION TAB ===== */}
        {selectedTab === 'nutrition' && (
          <>
            {/* Nutrition Report link */}
            <TouchableOpacity
              testID="analytics-nutrition-report-link"
              style={[styles.nutritionReportBtn, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}
              onPress={() => navigation.navigate('NutritionReport')}
            >
              <Text style={[styles.nutritionReportText, { color: c.accent.primary }]}><Icon name="salad" /> Nutrition Report (27 nutrients)</Text>
              <Text style={[styles.nutritionReportArrow, { color: c.accent.primary }]}>›</Text>
            </TouchableOpacity>

            {/* Micronutrient Dashboard link */}
            <TouchableOpacity
              testID="analytics-micro-dashboard-link"
              style={[styles.nutritionReportBtn, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}
              onPress={() => navigation.navigate('MicronutrientDashboard')}
            >
              <Text style={[styles.nutritionReportText, { color: c.accent.primary }]}><Icon name="salad" /> Micronutrient Dashboard</Text>
              <Text style={[styles.nutritionReportArrow, { color: c.accent.primary }]}>›</Text>
            </TouchableOpacity>

            {/* Calorie trend */}
            <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Calorie Trend</Text>
            <View testID="analytics-calorie-chart">
            <Card>
              {isLoading ? (
                <ChartSkeleton />
              ) : filteredCalories.length === 0 ? (
                <EmptyState
                  icon={<Icon name="flame" />}
                  title="No calorie data"
                  description="Log meals to see calorie trends"
                />
              ) : (
                <TrendLineChart
                  data={filteredCalories}
                  color={c.chart.calories}
                  suffix=" kcal"
                  targetLine={adaptiveTarget?.calories}
                  emptyMessage="No calorie data for this period"
                />
              )}
            </Card>
            </View>

            {/* Weekly Summary Card */}
            {!isLoading && (
              <>
                <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Weekly Summary</Text>
                <WeeklySummaryCard
                  entries={calorieTrend.map((p) => ({
                    entry_date: p.date,
                    calories: p.value,
                    protein_g: proteinTrend.find((pt) => pt.date === p.date)?.value ?? 0,
                    carbs_g: 0,
                    fat_g: 0,
                    micro_nutrients: null,
                  }))}
                  targetCalories={adaptiveTarget?.calories ?? 2400}
                  timeRangeDays={{ '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[timeRange]}
                />
              </>
            )}

            {/* Protein trend */}
            <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Protein Trend</Text>
            <Card>
              {isLoading ? (
                <ChartSkeleton />
              ) : filteredProtein.length === 0 ? (
                <EmptyState
                  icon={<Icon name="meat" />}
                  title="No protein data"
                  description="Log meals to see protein trends"
                />
              ) : (
                <TrendLineChart
                  data={filteredProtein}
                  color={c.semantic.positive}
                  suffix="g"
                  targetLine={adaptiveTarget?.protein}
                  emptyMessage="No protein data for this period"
                />
              )}
            </Card>

            {/* Target vs Actual */}
            {adaptiveTarget && filteredCalories.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Target vs Actual (Today)</Text>
                <Card>
                  <View style={styles.comparisonRow}>
                    <ComparisonItem
                      label="Calories"
                      actual={filteredCalories.at(-1)?.value ?? 0}
                      target={adaptiveTarget.calories}
                      unit="kcal"
                    />
                    <ComparisonItem
                      label="Protein"
                      actual={filteredProtein.at(-1)?.value ?? 0}
                      target={adaptiveTarget.protein}
                      unit="g"
                    />
                  </View>
                </Card>
              </>
            )}

            {/* Dietary gap summary (premium) */}
            {premium && gaps.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Dietary Gaps</Text>
                <Card>
                  {gaps.map((gap) => (
                    <View key={gap.nutrient} style={styles.gapRow}>
                      <Text style={[styles.gapNutrient, { color: c.text.secondary }]}>{gap.nutrient}</Text>
                      <View style={[styles.gapBar, { backgroundColor: c.bg.surfaceRaised }]}>
                        <View
                          style={[
                            styles.gapFill,
                            {
                              width: `${Math.min((gap.average / gap.recommended) * 100, 100)}%`,
                              backgroundColor:
                                gap.deficit_pct > 30
                                  ? c.semantic.negative
                                  : gap.deficit_pct > 10
                                    ? c.semantic.warning
                                    : c.semantic.positive,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.gapPct, { color: c.semantic.negative }]}>-{Math.round(gap.deficit_pct)}%</Text>
                    </View>
                  ))}
                </Card>
              </>
            )}
          </>
        )}

        {/* ===== TRAINING TAB ===== */}
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

        {/* ===== BODY TAB ===== */}
        {selectedTab === 'body' && (
          <>
            {/* Periodization Calendar */}
            <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Periodization</Text>
            <PeriodizationCalendar />

            {/* Readiness Trend */}
            <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Readiness Trend</Text>
            <ReadinessTrendChart timeRange={timeRange} />

            {/* Bodyweight trend */}
            <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Bodyweight Trend</Text>
            <View testID="analytics-bodyweight-chart">
            <Card>
              {isLoading ? (
                <ChartSkeleton />
              ) : filteredWeight.length === 0 ? (
                <EmptyState
                  icon={<Icon name="scale" />}
                  title="No bodyweight data"
                  description="Log bodyweight to see trends"
                />
              ) : (
                <TrendLineChart
                  data={filteredWeight.map((p) => ({
                    date: p.date,
                    value: Number(formatWeight(p.value, unitSystem).split(' ')[0]),
                  }))}
                  color={c.chart.calories}
                  suffix={weightSuffix}
                  emptyMessage="No bodyweight data for this period"
                  primaryAsDots={weightEMA.length > 0}
                  secondaryData={weightEMA.length > 0 ? weightEMA.map((p) => ({
                    date: p.date,
                    value: Number(formatWeight(p.value, unitSystem).split(' ')[0]),
                  })) : undefined}
                  secondaryColor={c.accent.primary}
                />
              )}
            </Card>
            </View>

            {/* Expenditure Trend (TDEE) */}
            {!isLoading && (
              <>
                <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Expenditure Trend (TDEE)</Text>
                <ExpenditureTrendCard
                  weightHistory={weightTrend.map((p) => ({ date: p.date, weight_kg: p.value }))}
                  caloriesByDate={caloriesByDate}
                />
              </>
            )}
          </>
        )}

        {/* ===== VOLUME TAB ===== */}
        {selectedTab === 'volume' && (
          <>
            {!volumeFlagEnabled ? (
              <EmptyState
                icon={<Icon name="chart" />}
                title="Coming soon"
                description="Volume landmarks are not yet available for your account"
              />
            ) : volumeLoading ? (
              <View style={styles.volumeSkeletonContainer}>
                <Skeleton width="100%" height={140} borderRadius={8} />
                <Skeleton width="100%" height={140} borderRadius={8} />
                <Skeleton width="100%" height={140} borderRadius={8} />
              </View>
            ) : volumeLandmarks.length === 0 ? (
              <EmptyState
                icon={<Icon name="chart" />}
                title="No volume data"
                description="Start logging workouts to see your volume landmarks"
              />
            ) : (
              volumeLandmarks.map((mg) => (
                <VolumeLandmarksCard
                  key={mg.muscle_group}
                  muscleGroup={mg.muscle_group}
                  currentVolume={mg.hypertrophy_units ?? mg.net_stimulus ?? 0}
                  landmarks={mg.landmarks}
                  trend={mg.trend?.map((t) => ({ week: t.week, volume: t.volume })) ?? []}
                  status={mg.status}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ComparisonItem({
  label,
  actual,
  target,
  unit,
}: {
  label: string;
  actual: number;
  target: number;
  unit: string;
}) {
  const c = useThemeColors();
  const compStyles = getCompStyles(c);
  const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
  const pctColor = getComparisonColor(actual, target);

  return (
    <View style={compStyles.item}>
      <Text style={compStyles.label}>{label}</Text>
      <Text style={compStyles.actual}>{actual} {unit}</Text>
      <Text style={compStyles.target}>/ {target} {unit}</Text>
      <Text style={[compStyles.diff, { color: pctColor }]}>
        {pct}%
      </Text>
    </View>
  );
}

const getCompStyles = (c: ThemeColors) => StyleSheet.create({
  item: { flex: 1, alignItems: 'center' },
  label: { color: c.text.secondary, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm },
  actual: { color: c.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginTop: spacing[1], lineHeight: typography.lineHeight['2xl'] },
  target: { color: c.text.muted, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm },
  diff: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, marginTop: spacing[1], lineHeight: typography.lineHeight.sm },
});

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
  sectionTitle: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[6],
    marginBottom: spacing[3],
    lineHeight: typography.lineHeight.lg,
    letterSpacing: letterSpacing.tight,
  },
  comparisonRow: { flexDirection: 'row', gap: spacing[4] },
  gapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  gapNutrient: { color: c.text.secondary, fontSize: typography.size.sm, width: 80, lineHeight: typography.lineHeight.sm },
  gapBar: {
    flex: 1,
    height: 6,
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  gapFill: { height: '100%', borderRadius: radius.full },
  gapPct: { color: c.semantic.negative, fontSize: typography.size.sm, fontWeight: typography.weight.medium, width: 44, textAlign: 'right', lineHeight: typography.lineHeight.sm },
  analyticsTabRow: {
    flexDirection: 'row',
    backgroundColor: c.bg.surface,
    borderRadius: radius.sm,
    padding: spacing[1],
    marginBottom: spacing[3],
  },
  volumeSkeletonContainer: { marginTop: spacing[4], gap: spacing[3] },
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
