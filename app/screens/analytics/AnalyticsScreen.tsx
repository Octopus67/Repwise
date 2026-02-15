import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/Skeleton';
import { TrendLineChart } from '../../components/charts/TrendLineChart';
import { TimeRangeSelector } from '../../components/charts/TimeRangeSelector';
import { filterByTimeRange } from '../../utils/filterByTimeRange';
import { formatWeight } from '../../utils/unitConversion';
import { getComparisonColor } from '../../utils/comparisonColor';
import { computeEMA } from '../../utils/emaTrend';
import { WeeklySummaryCard } from '../../components/analytics/WeeklySummaryCard';
import { ExpenditureTrendCard } from '../../components/analytics/ExpenditureTrendCard';
import { StrengthStandardsCard } from '../../components/analytics/StrengthStandardsCard';
import { StrengthLeaderboard } from '../../components/analytics/StrengthLeaderboard';
import { useStore, isPremium } from '../../store';
import { Icon } from '../../components/common/Icon';
import api from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import { PeriodizationCalendar } from '../../components/periodization/PeriodizationCalendar';
import { HeatMapCard } from '../../components/analytics/HeatMapCard';
import { FatigueHeatMapOverlay } from '../../components/analytics/FatigueHeatMapOverlay';
import { FatigueBreakdownModal } from '../../components/analytics/FatigueBreakdownModal';
import { ReadinessTrendChart } from '../../components/analytics/ReadinessTrendChart';

type TimeRange = '7d' | '14d' | '30d' | '90d';
type AnalyticsTab = 'nutrition' | 'training' | 'body';

interface TrendPoint {
  date: string;
  value: number;
}

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
  const store = useStore();
  const premium = isPremium(store);
  const unitSystem = store.unitSystem;
  const navigation = useNavigation<any>();

  const [selectedTab, setSelectedTab] = useState<AnalyticsTab>('nutrition');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [isLoading, setIsLoading] = useState(true);
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
    classifications: any[];
    milestones: any[];
    bodyweight_kg: number | null;
  } | null>(null);
  const [fatigueScores, setFatigueScores] = useState<any[]>([]);
  const [selectedFatigueGroup, setSelectedFatigueGroup] = useState<any | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  useEffect(() => {
    loadVolumeTrend();
  }, [timeRange]);

  useEffect(() => {
    loadStrengthProgression();
  }, [selectedExercise, timeRange]);

  useEffect(() => {
    loadE1RMTrend();
  }, [selectedE1RMExercise, timeRange]);

  useEffect(() => {
    loadStrengthStandards();
  }, []);

  const loadAnalytics = async () => {
    try {
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

      const [bwRes, nutritionRes, adaptiveRes] = await Promise.allSettled([
        api.get('user/bodyweight/history', { params: { limit: 90 } }),
        api.get('nutrition/entries', { params: { start_date: start, end_date: end, limit: 500 } }),
        api.get('adaptive/snapshots', { params: { limit: 1 } }),
      ]);

      if (bwRes.status === 'fulfilled') {
        const logs = bwRes.value.data.items ?? [];
        setWeightTrend(logs.map((l: any) => ({ date: l.recorded_date, value: l.weight_kg })));
      }

      if (nutritionRes.status === 'fulfilled') {
        const entries = nutritionRes.value.data.items ?? [];
        const byDate: Record<string, { cal: number; pro: number }> = {};
        entries.forEach((e: any) => {
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
          const { data } = await api.get('dietary-analysis/gaps', { params: { window_days: 14 } });
          setGaps(data.gaps ?? []);
        } catch { /* ignore */ }
      }

      // Fetch fatigue scores
      try {
        const { data } = await api.get('training/fatigue');
        setFatigueScores(data.scores ?? []);
      } catch {
        setFatigueScores([]);
      }
    } catch { /* best-effort */ } finally {
      setIsLoading(false);
    }
  };

  const loadVolumeTrend = async () => {
    try {
      const end = new Date().toISOString().split('T')[0];
      const days = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[timeRange];
      const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      const { data } = await api.get('training/analytics/volume', {
        params: { start_date: start, end_date: end },
      });
      const items = data.items ?? data ?? [];
      setVolumeTrend(items.map((p: any) => ({ date: p.date, value: p.total_volume })));
    } catch { /* best-effort */ }
  };

  const loadStrengthProgression = async () => {
    try {
      const end = new Date().toISOString().split('T')[0];
      const days = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[timeRange];
      const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      const { data } = await api.get(`training/analytics/strength/${encodeURIComponent(selectedExercise)}`, {
        params: { start_date: start, end_date: end },
      });
      const items = data.items ?? data ?? [];
      setStrengthData(items.map((p: any) => ({ date: p.date, value: p.best_weight_kg })));
    } catch { /* best-effort */ }
  };

  const loadE1RMTrend = async () => {
    try {
      const end = new Date().toISOString().split('T')[0];
      const days = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[timeRange];
      const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      const { data } = await api.get('training/analytics/e1rm-history', {
        params: { exercise_name: selectedE1RMExercise, start_date: start, end_date: end },
      });
      const items = Array.isArray(data) ? data : data.items ?? [];
      setE1rmTrend(items.map((p: any) => ({ date: p.date, value: p.e1rm_kg })));
    } catch { /* best-effort */ }
  };

  const loadStrengthStandards = async () => {
    try {
      const { data } = await api.get('training/analytics/strength-standards');
      setStrengthStandards(data);
    } catch { /* best-effort */ }
  };

  const filteredWeight = filterByTimeRange(weightTrend, timeRange);
  const filteredCalories = filterByTimeRange(calorieTrend, timeRange);
  const filteredProtein = filterByTimeRange(proteinTrend, timeRange);

  // Compute EMA trend line for bodyweight chart
  const weightEMA = computeEMA(filteredWeight);

  // Compute caloriesByDate record for ExpenditureTrendCard
  const caloriesByDate: Record<string, number> = {};
  calorieTrend.forEach((p) => {
    caloriesByDate[p.date] = p.value;
  });

  const weightSuffix = unitSystem === 'metric' ? ' kg' : ' lbs';

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="analytics-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Analytics</Text>

        {/* Tab Pills */}
        <View style={styles.analyticsTabRow}>
          {(['nutrition', 'training', 'body'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.analyticsTab, selectedTab === t && styles.analyticsTabActive]}
              onPress={() => setSelectedTab(t)}
              testID={`analytics-tab-${t}`}
            >
              <Text style={[styles.analyticsTabText, selectedTab === t && styles.analyticsTabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Weekly Intelligence Report link — visible on ALL tabs */}
        <TouchableOpacity
          testID="analytics-weekly-report-link"
          style={styles.nutritionReportBtn}
          onPress={() => navigation.navigate('WeeklyReport')}
        >
          <Text style={styles.nutritionReportText}><Icon name="chart" /> Weekly Intelligence Report</Text>
          <Text style={styles.nutritionReportArrow}>›</Text>
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
              style={styles.nutritionReportBtn}
              onPress={() => navigation.navigate('NutritionReport')}
            >
              <Text style={styles.nutritionReportText}><Icon name="salad" /> Nutrition Report (27 nutrients)</Text>
              <Text style={styles.nutritionReportArrow}>›</Text>
            </TouchableOpacity>

            {/* Calorie trend */}
            <Text style={styles.sectionTitle}>Calorie Trend</Text>
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
                  color={colors.chart.calories}
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
                <Text style={styles.sectionTitle}>Weekly Summary</Text>
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
                />
              </>
            )}

            {/* Protein trend */}
            <Text style={styles.sectionTitle}>Protein Trend</Text>
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
                  color={colors.semantic.positive}
                  suffix="g"
                  targetLine={adaptiveTarget?.protein}
                  emptyMessage="No protein data for this period"
                />
              )}
            </Card>

            {/* Target vs Actual */}
            {adaptiveTarget && filteredCalories.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Target vs Actual (Today)</Text>
                <Card>
                  <View style={styles.comparisonRow}>
                    <ComparisonItem
                      label="Calories"
                      actual={filteredCalories[filteredCalories.length - 1]?.value ?? 0}
                      target={adaptiveTarget.calories}
                      unit="kcal"
                    />
                    <ComparisonItem
                      label="Protein"
                      actual={filteredProtein[filteredProtein.length - 1]?.value ?? 0}
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
                <Text style={styles.sectionTitle}>Dietary Gaps</Text>
                <Card>
                  {gaps.map((gap) => (
                    <View key={gap.nutrient} style={styles.gapRow}>
                      <Text style={styles.gapNutrient}>{gap.nutrient}</Text>
                      <View style={styles.gapBar}>
                        <View
                          style={[
                            styles.gapFill,
                            {
                              width: `${Math.min((gap.average / gap.recommended) * 100, 100)}%`,
                              backgroundColor:
                                gap.deficit_pct > 30
                                  ? colors.semantic.negative
                                  : gap.deficit_pct > 10
                                    ? colors.semantic.warning
                                    : colors.semantic.positive,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.gapPct}>-{Math.round(gap.deficit_pct)}%</Text>
                    </View>
                  ))}
                </Card>
              </>
            )}
          </>
        )}

        {/* ===== TRAINING TAB ===== */}
        {selectedTab === 'training' && (
          <>
            {/* Training Volume */}
            <Text style={styles.sectionTitle}>Training Volume</Text>
            <Card>
              {isLoading ? (
                <ChartSkeleton />
              ) : volumeTrend.length === 0 ? (
                <EmptyState
                  icon={<Icon name="chart" />}
                  title="No volume data"
                  description="Log training sessions to see volume trends"
                />
              ) : (
                <TrendLineChart
                  data={volumeTrend}
                  color={colors.accent.primary}
                  suffix=" kg"
                  emptyMessage="No training volume data for this period"
                />
              )}
            </Card>

            {/* Muscle Volume Heat Map */}
            <Text style={styles.sectionTitle}>Muscle Volume Heat Map</Text>
            <HeatMapCard />

            {/* Muscle Fatigue */}
            {fatigueScores.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Muscle Fatigue</Text>
                <Card>
                  <FatigueHeatMapOverlay
                    scores={fatigueScores}
                    onMuscleGroupPress={(mg) => {
                      const found = fatigueScores.find((s: any) => s.muscle_group === mg);
                      setSelectedFatigueGroup(found ?? null);
                    }}
                  />
                </Card>
              </>
            )}

            <FatigueBreakdownModal
              visible={!!selectedFatigueGroup}
              score={selectedFatigueGroup}
              onClose={() => setSelectedFatigueGroup(null)}
            />

            {/* Strength Progression */}
            <Text style={styles.sectionTitle}>Strength Progression</Text>
            <Card>
              <View style={styles.exerciseSelector}>
                {EXERCISE_OPTIONS.map((ex) => (
                  <TouchableOpacity
                    key={ex}
                    style={[
                      styles.exercisePill,
                      selectedExercise === ex && styles.exercisePillActive,
                    ]}
                    onPress={() => setSelectedExercise(ex)}
                  >
                    <Text
                      style={[
                        styles.exercisePillText,
                        selectedExercise === ex && styles.exercisePillTextActive,
                      ]}
                    >
                      {ex.split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {isLoading ? (
                <ChartSkeleton />
              ) : (
                <TrendLineChart
                  data={strengthData.map((p) => ({
                    date: p.date,
                    value: Number(formatWeight(p.value, unitSystem).split(' ')[0]),
                  }))}
                  color={colors.semantic.positive}
                  suffix={weightSuffix}
                  emptyMessage={`No data for ${selectedExercise} in this period`}
                />
              )}
            </Card>

            {/* e1RM Trend, Strength Standards, Strength Leaderboard */}
            {!isLoading && (
              <>
                <Text style={styles.sectionTitle}>e1RM Trend</Text>
                <Card>
                  <View style={styles.exerciseSelector}>
                    {E1RM_EXERCISE_OPTIONS.map((ex) => (
                      <TouchableOpacity
                        key={ex}
                        style={[
                          styles.exercisePill,
                          selectedE1RMExercise === ex && styles.exercisePillActive,
                        ]}
                        onPress={() => setSelectedE1RMExercise(ex)}
                      >
                        <Text
                          style={[
                            styles.exercisePillText,
                            selectedE1RMExercise === ex && styles.exercisePillTextActive,
                          ]}
                        >
                          {ex.split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TrendLineChart
                    data={e1rmTrend.map((p) => ({
                      date: p.date,
                      value: Number(formatWeight(p.value, unitSystem).split(' ')[0]),
                    }))}
                    color={colors.accent.primary}
                    suffix={weightSuffix}
                    emptyMessage={`No e1RM data for ${selectedE1RMExercise} in this period`}
                  />
                </Card>

                <Text style={styles.sectionTitle}>Strength Standards</Text>
                <StrengthStandardsCard
                  classifications={strengthStandards?.classifications ?? []}
                  bodyweightKg={strengthStandards?.bodyweight_kg ?? null}
                />

                <Text style={styles.sectionTitle}>Strength Leaderboard</Text>
                <StrengthLeaderboard
                  classifications={strengthStandards?.classifications ?? []}
                />
              </>
            )}
          </>
        )}

        {/* ===== BODY TAB ===== */}
        {selectedTab === 'body' && (
          <>
            {/* Periodization Calendar */}
            <Text style={styles.sectionTitle}>Periodization</Text>
            <PeriodizationCalendar />

            {/* Readiness Trend */}
            <Text style={styles.sectionTitle}>Readiness Trend</Text>
            <ReadinessTrendChart timeRange={timeRange} />

            {/* Bodyweight trend */}
            <Text style={styles.sectionTitle}>Bodyweight Trend</Text>
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
                  color={colors.chart.calories}
                  suffix={weightSuffix}
                  emptyMessage="No bodyweight data for this period"
                  primaryAsDots={weightEMA.length > 0}
                  secondaryData={weightEMA.length > 0 ? weightEMA.map((p) => ({
                    date: p.date,
                    value: Number(formatWeight(p.value, unitSystem).split(' ')[0]),
                  })) : undefined}
                  secondaryColor={colors.accent.primary}
                />
              )}
            </Card>
            </View>

            {/* Expenditure Trend (TDEE) */}
            {!isLoading && (
              <>
                <Text style={styles.sectionTitle}>Expenditure Trend (TDEE)</Text>
                <ExpenditureTrendCard
                  weightHistory={weightTrend.map((p) => ({ date: p.date, weight_kg: p.value }))}
                  caloriesByDate={caloriesByDate}
                />
              </>
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

const compStyles = StyleSheet.create({
  item: { flex: 1, alignItems: 'center' },
  label: { color: colors.text.secondary, fontSize: typography.size.sm },
  actual: { color: colors.text.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginTop: spacing[1] },
  target: { color: colors.text.muted, fontSize: typography.size.sm },
  diff: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, marginTop: spacing[1] },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  container: { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[12] },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[4],
  },
  nutritionReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  nutritionReportText: {
    color: colors.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  nutritionReportArrow: {
    color: colors.accent.primary,
    fontSize: typography.size.lg,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[5],
    marginBottom: spacing[3],
  },
  comparisonRow: { flexDirection: 'row', gap: spacing[4] },
  exerciseSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  exercisePill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    backgroundColor: colors.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  exercisePillActive: {
    backgroundColor: colors.accent.primaryMuted,
    borderColor: colors.accent.primary,
  },
  exercisePillText: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  exercisePillTextActive: {
    color: colors.accent.primary,
  },
  gapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  gapNutrient: { color: colors.text.secondary, fontSize: typography.size.sm, width: 80 },
  gapBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  gapFill: { height: '100%', borderRadius: radius.full },
  gapPct: { color: colors.semantic.negative, fontSize: typography.size.sm, fontWeight: typography.weight.medium, width: 44, textAlign: 'right' },
  analyticsTabRow: {
    flexDirection: 'row',
    backgroundColor: colors.bg.surface,
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
  analyticsTabActive: { backgroundColor: colors.accent.primaryMuted },
  analyticsTabText: { color: colors.text.muted, fontSize: typography.size.base, fontWeight: typography.weight.medium },
  analyticsTabTextActive: { color: colors.accent.primary },
});
