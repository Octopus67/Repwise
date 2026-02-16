import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';

let Haptics: any = null;
try { Haptics = require('expo-haptics'); } catch {}
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { colors, spacing, typography } from '../../theme/tokens';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { calculateStreak } from '../../utils/calculateStreak';
import { MacroRingsRow } from '../../components/dashboard/MacroRingsRow';
import { TodaySummaryRow } from '../../components/dashboard/TodaySummaryRow';
import { StreakIndicator } from '../../components/dashboard/StreakIndicator';
import { QuickActionButton } from '../../components/dashboard/QuickActionButton';
import { ArticleCardCompact } from '../../components/dashboard/ArticleCardCompact';
import { DateScroller } from '../../components/dashboard/DateScroller';
import { DayBadge } from '../../components/dashboard/DayBadge';
import { DayIndicator } from '../../components/dashboard/DayIndicator';
import { MealSlotDiary } from '../../components/dashboard/MealSlotDiary';
import { BudgetBar } from '../../components/nutrition/BudgetBar';
import { QuickAddModal } from '../../components/modals/QuickAddModal';
import { SectionHeader } from '../../components/common/SectionHeader';
import { Skeleton } from '../../components/common/Skeleton';
import { PremiumBadge } from '../../components/premium/PremiumBadge';
import { UpgradeBanner } from '../../components/premium/UpgradeBanner';
import { UpgradeModal } from '../../components/premium/UpgradeModal';
import { SetupBanner } from '../../components/common/SetupBanner';
import { AddNutritionModal } from '../../components/modals/AddNutritionModal';
import { AddTrainingModal } from '../../components/modals/AddTrainingModal';
import { AddBodyweightModal } from '../../components/modals/AddBodyweightModal';
import { MealBuilder } from '../../components/nutrition/MealBuilder';
import { CelebrationModal } from '../../components/achievements/CelebrationModal';
import { useStore, isPremium } from '../../store';
import { computeEMA, computeWeeklyChange, formatWeeklyChange } from '../../utils/emaTrend';
import { formatMuscleGroups } from '../../utils/dayClassificationLogic';
import { WeeklyCheckinCard } from '../../components/coaching/WeeklyCheckinCard';
import { FatigueAlertCard } from '../../components/dashboard/FatigueAlertCard';
import { ReadinessGauge } from '../../components/dashboard/ReadinessGauge';
import { RecompDashboardCard } from '../../components/dashboard/RecompDashboardCard';
import { RecoveryCheckinModal } from '../../components/modals/RecoveryCheckinModal';
import { Icon } from '../../components/common/Icon';
import { useDailyTargets } from '../../hooks/useDailyTargets';
import { useHealthData } from '../../hooks/useHealthData';
import api from '../../services/api';
import { isTrainingLogV2Enabled } from '../../utils/featureFlags';

interface Article {
  id: string;
  title: string;
  module_name: string;
  estimated_read_time_min: number;
}

interface NutritionEntryRaw {
  id: string;
  meal_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  entry_date: string;
  created_at: string | null;
  micro_nutrients?: { water_ml?: number; fibre_g?: number } | null;
}

export function DashboardScreen({ navigation }: any) {
  const store = useStore();
  const premium = isPremium(store);
  const onboardingSkipped = useStore((s) => s.onboardingSkipped);
  const setNeedsOnboarding = useStore((s) => s.setNeedsOnboarding);
  const setOnboardingSkipped = useStore((s) => s.setOnboardingSkipped);
  const selectedDate = useStore((s) => s.selectedDate);
  const setSelectedDate = useStore((s) => s.setSelectedDate);
  const adaptiveTargets = useStore((s) => s.adaptiveTargets);
  const setAdaptiveTargets = useStore((s) => s.setAdaptiveTargets);
  const pendingCelebrations = useStore((s) => s.pendingCelebrations);
  const setPendingCelebrations = useStore((s) => s.setPendingCelebrations);
  const clearCelebrations = useStore((s) => s.clearCelebrations);

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const [showBodyweight, setShowBodyweight] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showMealBuilder, setShowMealBuilder] = useState(false);
  const [prefilledMealName, setPrefilledMealName] = useState<string | undefined>(undefined);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateLoading, setDateLoading] = useState(false);
  const isInitialLoad = useRef(true);
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // KPI state
  const [calories, setCalories] = useState({ value: 0, target: 2400 });
  const [protein, setProtein] = useState({ value: 0, target: 180 });
  const [carbs, setCarbs] = useState({ value: 0, target: 250 });
  const [workoutsCompleted, setWorkoutsCompleted] = useState(0);
  const [streak, setStreak] = useState(0);
  const [articles, setArticles] = useState<Article[]>([]);
  const [nutritionLogged, setNutritionLogged] = useState(false);
  const [trainingLogged, setTrainingLogged] = useState(false);
  const [totalFat, setTotalFat] = useState(0);
  const [totalWaterMl, setTotalWaterMl] = useState(0);
  const [totalFibreG, setTotalFibreG] = useState(0);

  // Raw nutrition entries for MealSlotDiary
  const [nutritionEntries, setNutritionEntries] = useState<NutritionEntryRaw[]>([]);
  // Day classification state
  const [dayClassification, setDayClassification] = useState<{
    isTrainingDay: boolean;
    muscleGroups: string[];
  }>({ isTrainingDay: false, muscleGroups: [] });
  const [dayClassLoading, setDayClassLoading] = useState(true);
  // Logged dates for DateScroller dot indicators
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());
  // Bodyweight history for trend display
  const [weightHistory, setWeightHistory] = useState<{ date: string; value: number }[]>([]);
  // Milestone banner
  const [milestoneMessage, setMilestoneMessage] = useState<string | null>(null);
  // Fatigue suggestions
  const [fatigueSuggestions, setFatigueSuggestions] = useState<any[]>([]);
  // Readiness score
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [readinessFactors, setReadinessFactors] = useState<any[]>([]);
  const [showCheckin, setShowCheckin] = useState(false);
  // Recomp metrics
  const [recompMetrics, setRecompMetrics] = useState<any>(null);

  // Health data hook
  const healthData = useHealthData();

  // Sync engine: adjusted daily targets
  const {
    effectiveTargets: syncTargets,
    dayClassification: syncDayClass,
    explanation: syncExplanation,
    isOverride: syncIsOverride,
    isLoading: syncLoading,
    refetch: refetchSync,
  } = useDailyTargets(selectedDate);

  // Staggered entrance for each section
  const headerAnim = useStaggeredEntrance(0, 60);
  const dateScrollerAnim = useStaggeredEntrance(1, 60);
  const dayBadgeAnim = useStaggeredEntrance(2, 60);
  const quickActionsAnim = useStaggeredEntrance(3, 60);
  const ringsAnim = useStaggeredEntrance(4, 60);
  const budgetAnim = useStaggeredEntrance(5, 60);
  const mealSlotAnim = useStaggeredEntrance(6, 60);
  const summaryAnim = useStaggeredEntrance(7, 60);
  const featuredAnim = useStaggeredEntrance(8, 60);

  useEffect(() => {
    loadDashboardData(selectedDate);
  }, []);

  // Debounced date switching
  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
    setDateLoading(true);
    if (dateDebounceRef.current) {
      clearTimeout(dateDebounceRef.current);
    }
    dateDebounceRef.current = setTimeout(() => {
      loadDashboardData(date);
    }, 300);
  }, []);

  const loadDashboardData = useCallback(async (dateToLoad?: string) => {
    try {
      const targetDate = dateToLoad ?? selectedDate;
      setDayClassLoading(true);

      const [nutritionRes, adaptiveRes, trainingRes, articlesRes, bwRes, dayClassRes, streakRes] = await Promise.allSettled([
        api.get('nutrition/entries', { params: { start_date: targetDate, end_date: targetDate } }),
        api.get('adaptive/snapshots', { params: { limit: 1 } }),
        api.get('training/sessions', { params: { start_date: targetDate, end_date: targetDate, limit: 10 } }),
        api.get('content/articles', { params: { limit: 5, status: 'published' } }),
        api.get('users/bodyweight/history', { params: { limit: 90 } }),
        api.get('training/day-classification', { params: { date: targetDate } }),
        api.get('achievements/streak'),
      ]);

      // Process nutrition entries — store raw entries for MealSlotDiary
      if (nutritionRes.status === 'fulfilled') {
        const entries: NutritionEntryRaw[] = nutritionRes.value.data.items ?? [];
        setNutritionEntries(entries);

        const totals = entries.reduce(
          (acc: { cal: number; pro: number; carb: number; fat: number; water: number; fibre: number }, e: any) => ({
            cal: acc.cal + (e.calories ?? 0),
            pro: acc.pro + (e.protein_g ?? 0),
            carb: acc.carb + (e.carbs_g ?? 0),
            fat: acc.fat + (e.fat_g ?? 0),
            water: acc.water + (e.micro_nutrients?.water_ml ?? 0),
            fibre: acc.fibre + (e.micro_nutrients?.fibre_g ?? 0),
          }),
          { cal: 0, pro: 0, carb: 0, fat: 0, water: 0, fibre: 0 },
        );
        setCalories((prev) => ({ ...prev, value: Math.round(totals.cal) }));
        setProtein((prev) => ({ ...prev, value: Math.round(totals.pro) }));
        setCarbs((prev) => ({ ...prev, value: Math.round(totals.carb) }));
        setTotalFat(Math.round(totals.fat));
        setTotalWaterMl(totals.water);
        setTotalFibreG(totals.fibre);
        setNutritionLogged(entries.length > 0);

        // Build logged dates set from entry_date values
        const dates = new Set<string>();
        entries.forEach((e: any) => {
          if (e.entry_date) dates.add(e.entry_date);
        });
        setLoggedDates(dates);
      }

      // Process adaptive targets
      if (adaptiveRes.status === 'fulfilled') {
        const snap = adaptiveRes.value.data.items?.[0];
        if (snap) {
          setCalories((prev) => ({ ...prev, target: Math.round(snap.target_calories) }));
          setProtein((prev) => ({ ...prev, target: Math.round(snap.target_protein_g) }));
          if (snap.target_carbs_g) {
            setCarbs((prev) => ({ ...prev, target: Math.round(snap.target_carbs_g) }));
          }
          setAdaptiveTargets({
            calories: Math.round(snap.target_calories),
            protein_g: Math.round(snap.target_protein_g),
            carbs_g: Math.round(snap.target_carbs_g ?? 250),
            fat_g: Math.round(snap.target_fat_g ?? 65),
          });
        }
      }

      // Process training sessions
      if (trainingRes.status === 'fulfilled') {
        const sessions = trainingRes.value.data.items ?? [];
        setWorkoutsCompleted(sessions.length);
        setTrainingLogged(sessions.length > 0);
      }

      // Process day classification
      if (dayClassRes.status === 'fulfilled') {
        const data = dayClassRes.value.data;
        setDayClassification({
          isTrainingDay: data.is_training_day,
          muscleGroups: formatMuscleGroups(data.muscle_groups),
        });
      }
      // On failure: leave default rest day state — graceful degradation

      // Process articles
      if (articlesRes.status === 'fulfilled') {
        const items = articlesRes.value.data.items ?? [];
        setArticles(items);
      }

      // Process bodyweight history for trend display
      if (bwRes.status === 'fulfilled') {
        const logs = bwRes.value.data.items ?? [];
        setWeightHistory(logs.map((l: any) => ({ date: l.recorded_date, value: l.weight_kg })));
      }

      // Fetch milestone for banner (fire-and-forget)
      try {
        const { data } = await api.get('training/analytics/strength-standards');
        if (data.milestones?.length > 0) {
          setMilestoneMessage(data.milestones[0].message);
        } else {
          setMilestoneMessage(null);
        }
      } catch {
        // Non-critical
      }

      // Fetch weekly check-in (fire-and-forget, don't block dashboard)
      try {
        const checkinRes = await api.post('adaptive/weekly-checkin');
        store.setWeeklyCheckin(checkinRes.data);
      } catch {
        // Non-critical — dashboard works without check-in
      }

      // Fetch fatigue data (fire-and-forget)
      try {
        const fatigueRes = await api.get('training/fatigue');
        setFatigueSuggestions(fatigueRes.data.suggestions ?? []);
      } catch {
        setFatigueSuggestions([]);
      }

      // Fetch readiness score (fire-and-forget)
      try {
        const readinessRes = await api.post('readiness/score', {
          hrv_ms: healthData.hrv_ms,
          resting_hr_bpm: healthData.resting_hr_bpm,
          sleep_duration_hours: healthData.sleep_duration_hours,
        });
        setReadinessScore(readinessRes.data.score);
        setReadinessFactors(readinessRes.data.factors ?? []);
      } catch {
        setReadinessScore(null);
        setReadinessFactors([]);
      }

      // Fetch recomp metrics if user is in recomp mode (fire-and-forget)
      try {
        const goalType = store.goals?.goalType;
        if (goalType === 'recomposition') {
          const recompRes = await api.get('recomp/metrics');
          setRecompMetrics(recompRes.data);
        } else {
          setRecompMetrics(null);
        }
      } catch {
        setRecompMetrics(null);
      }

      // Use achievement API streak if available, fall back to client-side calculation
      if (streakRes.status === 'fulfilled' && streakRes.value.data?.current_streak != null) {
        setStreak(streakRes.value.data.current_streak);
      } else {
        // Fallback: compute streak from all log dates
        const allDates: string[] = [];
        if (nutritionRes.status === 'fulfilled') {
          const entries = nutritionRes.value.data.items ?? [];
          entries.forEach((e: any) => {
            if (e.entry_date) allDates.push(e.entry_date);
          });
        }
        if (trainingRes.status === 'fulfilled') {
          const sessions = trainingRes.value.data.items ?? [];
          sessions.forEach((s: any) => {
            if (s.session_date) allDates.push(s.session_date);
          });
        }
        const today = new Date().toISOString().split('T')[0];
        setStreak(calculateStreak(allDates, today));
      }
    } catch {
      // Dashboard is best-effort — silently degrade
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      setDateLoading(false);
      setDayClassLoading(false);
    }
  }, [selectedDate]);

  const handleRefresh = useCallback(() => {
    isInitialLoad.current = false;
    setRefreshing(true);
    loadDashboardData(selectedDate);
  }, [loadDashboardData, selectedDate]);

  const handleArticlePress = (articleId: string) => {
    navigation?.navigate?.('ArticleDetail', { articleId });
  };

  const handleAddToSlot = (slotName: string) => {
    setPrefilledMealName(slotName);
    setShowNutrition(true);
  };

  const handleQuickAction = (action: () => void) => {
    try { Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Light)?.catch?.(() => {}); } catch {}
    action();
  };

  const consumed = {
    calories: calories.value,
    protein_g: protein.value,
    carbs_g: carbs.value,
    fat_g: totalFat,
  };

  const targets = syncTargets
    ? {
        calories: Math.round(syncTargets.calories),
        protein_g: Math.round(syncTargets.protein_g),
        carbs_g: Math.round(syncTargets.carbs_g),
        fat_g: Math.round(syncTargets.fat_g),
      }
    : adaptiveTargets ?? {
        calories: calories.target,
        protein_g: protein.target,
        carbs_g: carbs.target,
        fat_g: 65,
      };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        testID="dashboard-screen"
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent.primary}
          />
        }
      >
        {/* Section 1: Header */}
        <Animated.View style={headerAnim}>
          <View style={styles.header} testID="dashboard-greeting">
            {premium && <PremiumBadge size="md" />}
          </View>
        </Animated.View>

        {onboardingSkipped && (
          <SetupBanner
            onPress={() => {
              setOnboardingSkipped(false);
              setNeedsOnboarding(true);
            }}
          />
        )}

        {/* Date Scroller — between header and macro rings */}
        <Animated.View style={dateScrollerAnim} testID="dashboard-date-scroller">
          <DateScroller
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            loggedDates={loggedDates}
          />
        </Animated.View>

        {/* Quick Actions — above the fold */}
        <Animated.View style={quickActionsAnim}>
          <SectionHeader title="Quick Log" />
          {isLoading ? (
            <View style={styles.quickRow}>
              <Skeleton width="30%" height={100} borderRadius={12} />
              <Skeleton width="30%" height={100} borderRadius={12} />
              <Skeleton width="30%" height={100} borderRadius={12} />
            </View>
          ) : (
            <View style={styles.quickRow}>
              <View style={styles.quickItem} testID="dashboard-log-food-button">
                <QuickActionButton
                  icon="utensils"
                  label="Log Food"
                  accentColor={colors.macro.calories}
                  completed={nutritionLogged}
                  onPress={() => handleQuickAction(() => setShowNutrition(true))}
                />
              </View>
              <View style={styles.quickItem}>
                <QuickActionButton
                  icon="lunchbox"
                  label="Build Meal"
                  accentColor={colors.accent.primary}
                  completed={false}
                  onPress={() => handleQuickAction(() => setShowMealBuilder(true))}
                />
              </View>
              <View style={styles.quickItem} testID="dashboard-log-training-button">
                <QuickActionButton
                  icon="dumbbell"
                  label="Training"
                  accentColor={colors.macro.protein}
                  completed={trainingLogged}
                  onPress={() => handleQuickAction(() => {
                    if (isTrainingLogV2Enabled()) {
                      navigation.push('ActiveWorkout', { mode: 'new' });
                    } else {
                      setShowTraining(true);
                    }
                  })}
                />
              </View>
              <View style={styles.quickItem} testID="dashboard-log-bodyweight-button">
                <QuickActionButton
                  icon="scale"
                  label="Bodyweight"
                  accentColor={colors.macro.carbs}
                  completed={false}
                  onPress={() => handleQuickAction(() => setShowBodyweight(true))}
                />
              </View>
            </View>
          )}
        </Animated.View>

        {/* Section 2: Macro Rings */}
        <Animated.View style={ringsAnim}>
          {isLoading ? (
            <View style={styles.skeletonRingsRow}>
              <Skeleton width={96} height={96} variant="circle" />
              <Skeleton width={96} height={96} variant="circle" />
              <Skeleton width={96} height={96} variant="circle" />
            </View>
          ) : (
            <View>
              <MacroRingsRow
                calories={{ ...calories, target: targets.calories }}
                protein={{ ...protein, target: targets.protein_g }}
                carbs={{ ...carbs, target: targets.carbs_g }}
                fat={{ value: totalFat, target: targets.fat_g }}
              />
              {dateLoading && (
                <View style={styles.dateLoadingOverlay}>
                  <ActivityIndicator size="small" color={colors.accent.primary} />
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* Budget Bar — above meal slots */}
        <Animated.View style={budgetAnim}>
          {!isLoading && (
            <BudgetBar consumed={consumed} targets={targets} />
          )}
        </Animated.View>

        {/* Meal Slot Diary — below BudgetBar */}
        <Animated.View style={mealSlotAnim}>
          {!isLoading && (
            <MealSlotDiary
              entries={nutritionEntries}
              onAddToSlot={handleAddToSlot}
            />
          )}
        </Animated.View>

        {/* Section 3: Today Summary (workouts + streak only, meals count now in MealSlotDiary) */}
        <Animated.View style={[summaryAnim, styles.summarySection]}>
          {isLoading ? (
            <View style={styles.skeletonSummaryRow}>
              <Skeleton width={120} height={24} />
              <Skeleton width={120} height={24} />
            </View>
          ) : (
            <>
              <View style={styles.summaryRow}>
                <TodaySummaryRow
                  mealsLogged={nutritionEntries.length}
                  workoutsCompleted={workoutsCompleted}
                />
                <StreakIndicator count={streak} />
              </View>
              <View style={styles.nutritionSummary}>
                <Text style={styles.nutritionItem}><Icon name="droplet" size={14} color={colors.accent.primary} /> {Math.round(totalWaterMl / 250)} glasses ({totalWaterMl}ml)</Text>
                <Text style={styles.nutritionItem}><Icon name="wheat" size={14} color={colors.semantic.warning} /> {totalFibreG.toFixed(1)}g fibre</Text>
              </View>
            </>
          )}
        </Animated.View>

        {/* Weight Trend Section — show trend weight + weekly change if ≥3 data points */}
        {!isLoading && (() => {
          const emaSeries = computeEMA(weightHistory);
          const unitSystem = store.unitSystem;
          const unit = unitSystem === 'metric' ? 'kg' : 'lbs';

          if (weightHistory.length === 0) return null;

          // <3 data points: no trend section
          if (emaSeries.length === 0) return null;

          const trendWeight = emaSeries[emaSeries.length - 1].value;
          const weeklyChange = computeWeeklyChange(emaSeries);
          const changeText = formatWeeklyChange(weeklyChange, unit);
          const displayWeight = unitSystem === 'metric'
            ? trendWeight.toFixed(1)
            : (trendWeight * 2.20462).toFixed(1);

          // Determine badge color based on weight change direction
          let badgeColor: string = colors.text.secondary;
          if (weeklyChange !== null) {
            if (weeklyChange < 0) badgeColor = colors.semantic.positive;
            else if (weeklyChange > 0) badgeColor = colors.accent.primary;
          }

          return (
            <View style={styles.trendSection}>
              <View style={styles.trendRow}>
                <Text style={styles.trendLabel}>Trend: {displayWeight}{unit}</Text>
                <Text style={[styles.trendBadge, { color: badgeColor }]}>{changeText}</Text>
                <TouchableOpacity
                  onPress={() => Alert.alert(
                    'Trend Weight',
                    'Trend weight smooths out daily fluctuations from water, sodium, and other factors.'
                  )}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.infoIcon}>ⓘ</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {/* Milestone Banner */}
        {!isLoading && milestoneMessage && (
          <TouchableOpacity
            style={styles.milestoneBanner}
            onPress={() => navigation?.navigate?.('Analytics')}
            activeOpacity={0.7}
          >
            <Icon name="dumbbell" size={16} color={colors.accent.primary} />
            <Text style={styles.milestoneText} numberOfLines={1}>{milestoneMessage}</Text>
            <Text style={styles.milestoneChevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* Readiness Gauge */}
        {!isLoading && (
          <ReadinessGauge
            score={readinessScore}
            factors={readinessFactors}
            onPress={() => setShowCheckin(true)}
          />
        )}

        {/* Weekly Report Link */}
        {!isLoading && (
          <TouchableOpacity
            style={styles.milestoneBanner}
            onPress={() => navigation?.navigate?.('WeeklyReport')}
            activeOpacity={0.7}
          >
            <Icon name="chart" size={16} color={colors.accent.primary} />
            <Text style={styles.milestoneText} numberOfLines={1}>Weekly Intelligence Report</Text>
            <Text style={styles.milestoneChevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* Recomp Dashboard Card — only for recomp users */}
        {!isLoading && recompMetrics && store.goals?.goalType === 'recomposition' && (
          <RecompDashboardCard metrics={recompMetrics} />
        )}

        {/* Weekly Check-in Card */}
        {!isLoading && store.weeklyCheckin && (
          <WeeklyCheckinCard
            checkin={store.weeklyCheckin}
            onDismiss={() => store.setWeeklyCheckin(null)}
            onAccept={async (id) => {
              try {
                await api.post(`adaptive/suggestions/${id}/accept`);
                store.setWeeklyCheckin(null);
                loadDashboardData(selectedDate);
              } catch { /* ignore */ }
            }}
            onModify={async (id, targets) => {
              try {
                await api.post(`adaptive/suggestions/${id}/modify`, targets);
                store.setWeeklyCheckin(null);
                loadDashboardData(selectedDate);
              } catch { /* ignore */ }
            }}
            onDismissSuggestion={async (id) => {
              try {
                await api.post(`adaptive/suggestions/${id}/dismiss`);
                store.setWeeklyCheckin(null);
              } catch { /* ignore */ }
            }}
          />
        )}

        {/* Fatigue Alert Card */}
        {!isLoading && (
          <FatigueAlertCard
            suggestions={fatigueSuggestions}
            onPress={() => navigation?.navigate?.('Analytics')}
          />
        )}

        {/* Section 5: Featured Articles (show empty state if no articles) */}
        {!isLoading && (
          <Animated.View style={featuredAnim} testID="dashboard-articles-section">
            <SectionHeader title="Featured" />
            {articles.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.articlesRow}
              >
                {articles.map((article) => (
                  <ArticleCardCompact
                    key={article.id}
                    article={article}
                    onPress={() => handleArticlePress(article.id)}
                  />
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.articlesEmpty}>No articles available right now.</Text>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('Learn')} style={{ alignItems: 'flex-end', paddingVertical: spacing[2] }}>
              <Text style={{ color: colors.accent.primary, fontSize: typography.size.sm, fontWeight: typography.weight.medium }}>See All Articles →</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {!premium && <UpgradeBanner onPress={() => setShowUpgrade(true)} />}
      </ScrollView>

      <UpgradeModal visible={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <AddNutritionModal
        visible={showNutrition}
        onClose={() => {
          setShowNutrition(false);
          setPrefilledMealName(undefined);
        }}
        onSuccess={() => loadDashboardData(selectedDate)}
        prefilledMealName={prefilledMealName}
      />
      {!isTrainingLogV2Enabled() && (
        <AddTrainingModal
          visible={showTraining}
          onClose={() => setShowTraining(false)}
          onSuccess={() => loadDashboardData(selectedDate)}
        />
      )}
      <AddBodyweightModal
        visible={showBodyweight}
        onClose={() => setShowBodyweight(false)}
        onSuccess={() => loadDashboardData(selectedDate)}
      />
      <QuickAddModal
        visible={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSuccess={() => loadDashboardData(selectedDate)}
        targetDate={selectedDate}
      />
      <MealBuilder
        visible={showMealBuilder}
        onClose={() => setShowMealBuilder(false)}
        onSuccess={() => loadDashboardData(selectedDate)}
      />
      <CelebrationModal
        achievements={pendingCelebrations}
        visible={pendingCelebrations.length > 0}
        onDismiss={clearCelebrations}
      />
      <RecoveryCheckinModal
        visible={showCheckin}
        onClose={() => setShowCheckin(false)}
        onSuccess={() => loadDashboardData(selectedDate)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  container: { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[12] },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  summarySection: {
    marginTop: spacing[6],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  quickItem: {
    flex: 1,
  },
  articlesRow: {
    gap: spacing[3],
  },
  articlesEmpty: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    textAlign: 'center',
    paddingVertical: spacing[4],
  },
  skeletonRingsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  dateLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,14,19,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  skeletonSummaryRow: {
    flexDirection: 'row',
    gap: spacing[6],
  },
  nutritionSummary: {
    flexDirection: 'row',
    gap: 16,
    marginTop: spacing[2],
  },
  nutritionItem: {
    color: colors.text.secondary,
    fontSize: 13,
  },
  trendSection: {
    marginTop: spacing[3],
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  trendLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  trendBadge: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  infoIcon: {
    color: colors.text.muted,
    fontSize: 14,
  },
  milestoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: 8,
    padding: spacing[3],
    marginTop: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing[2],
  },
  milestoneText: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  milestoneChevron: {
    color: colors.accent.primary,
    fontSize: typography.size.lg,
  },
});
