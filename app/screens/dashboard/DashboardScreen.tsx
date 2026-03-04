import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { colors, spacing, typography, radius, letterSpacing } from '../../theme/tokens';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { calculateStreak } from '../../utils/calculateStreak';
import { MacroRingsRow } from '../../components/dashboard/MacroRingsRow';
import { TodaySummaryRow } from '../../components/dashboard/TodaySummaryRow';
import { StreakIndicator } from '../../components/dashboard/StreakIndicator';
import { QuickActionButton } from '../../components/dashboard/QuickActionButton';
import { DateScroller } from '../../components/dashboard/DateScroller';
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
import { TodayWorkoutCard } from '../../components/dashboard/TodayWorkoutCard';
import { useStore, isPremium } from '../../store';
import { useActiveWorkoutStore } from '../../store/activeWorkoutSlice';
import { computeEMA, computeWeeklyChange, formatWeeklyChange } from '../../utils/emaTrend';
import { WeeklyCheckinCard } from '../../components/coaching/WeeklyCheckinCard';
import { FatigueAlertCard } from '../../components/dashboard/FatigueAlertCard';
import { RecompDashboardCard } from '../../components/dashboard/RecompDashboardCard';
import NudgeCard from '../../components/dashboard/NudgeCard';
import GoalProgressPill from '../../components/dashboard/GoalProgressPill';
import { RecoveryCheckinModal } from '../../components/modals/RecoveryCheckinModal';
import { Icon } from '../../components/common/Icon';
import { useHaptics } from '../../hooks/useHaptics';
import { useDailyTargets } from '../../hooks/useDailyTargets';
import { useHealthData } from '../../hooks/useHealthData';
import api from '../../services/api';
import { isPremiumWorkoutLoggerEnabled } from '../../utils/featureFlags';

const DATE_DEBOUNCE_MS = 300;

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
  const { impact } = useHaptics();
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

  // Active workout state
  const isWorkoutActive = useActiveWorkoutStore(s => s.exercises.length > 0);
  const activeExerciseCount = useActiveWorkoutStore(s => s.exercises.length);

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const [showBodyweight, setShowBodyweight] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showMealBuilder, setShowMealBuilder] = useState(false);
  const [prefilledMealName, setPrefilledMealName] = useState<string | undefined>(undefined);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  // Raw nutrition entries for MealSlotDiary
  const [nutritionEntries, setNutritionEntries] = useState<NutritionEntryRaw[]>([]);
  // Training sessions for Today's Workout card
  const [trainingSessions, setTrainingSessions] = useState<any[]>([]);
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
  // Nudges
  const [nudges, setNudges] = useState<any[]>([]);

  // Health data hook
  const healthData = useHealthData();

  // Sync engine: adjusted daily targets
  const {
    effectiveTargets: syncTargets,
    isLoading: syncLoading,
    refetch: refetchSync,
  } = useDailyTargets(selectedDate);

  // Staggered entrance for each section
  const headerAnim = useStaggeredEntrance(0, 60);
  const dateScrollerAnim = useStaggeredEntrance(1, 60);
  const quickActionsAnim = useStaggeredEntrance(3, 60);
  const ringsAnim = useStaggeredEntrance(4, 60);
  const budgetAnim = useStaggeredEntrance(5, 60);
  const mealSlotAnim = useStaggeredEntrance(6, 60);
  const summaryAnim = useStaggeredEntrance(7, 60);
  const featuredAnim = useStaggeredEntrance(8, 60);

  const loadDashboardData = useCallback(async (dateToLoad?: string, signal?: AbortSignal) => {
    try {
      const targetDate = dateToLoad ?? selectedDate;
      setError(null);

      const [nutritionRes, adaptiveRes, trainingRes, articlesRes, bwRes, streakRes] = await Promise.allSettled([
        api.get('nutrition/entries', { params: { start_date: targetDate, end_date: targetDate }, signal }),
        api.get('adaptive/snapshots', { params: { limit: 1 }, signal }),
        api.get('training/sessions', { params: { start_date: targetDate, end_date: targetDate, limit: 10 }, signal }),
        api.get('content/articles', { params: { limit: 5, status: 'published' }, signal }),
        api.get('users/bodyweight/history', { params: { limit: 90 }, signal }),
        api.get('achievements/streak', { signal }),
      ]);

      // Process nutrition entries — store raw entries for MealSlotDiary
      if (nutritionRes.status === 'fulfilled') {
        const entries: NutritionEntryRaw[] = nutritionRes.value.data.items ?? [];
        setNutritionEntries(entries);

        const totals = entries.reduce(
          (acc: { cal: number; pro: number; carb: number; fat: number }, e: any) => ({
            cal: acc.cal + (e.calories ?? 0),
            pro: acc.pro + (e.protein_g ?? 0),
            carb: acc.carb + (e.carbs_g ?? 0),
            fat: acc.fat + (e.fat_g ?? 0),
          }),
          { cal: 0, pro: 0, carb: 0, fat: 0 },
        );
        setCalories((prev) => ({ ...prev, value: Math.round(totals.cal) }));
        setProtein((prev) => ({ ...prev, value: Math.round(totals.pro) }));
        setCarbs((prev) => ({ ...prev, value: Math.round(totals.carb) }));
        setTotalFat(Math.round(totals.fat));
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
          if (snap?.target_carbs_g) {
            setCarbs((prev) => ({ ...prev, target: Math.round(snap.target_carbs_g) }));
          }
          setAdaptiveTargets({
            calories: Math.round(snap.target_calories),
            protein_g: Math.round(snap.target_protein_g),
            carbs_g: Math.round(snap?.target_carbs_g ?? 250),
            fat_g: Math.round(snap?.target_fat_g ?? 65),
          });
        }
      }

      // Process training sessions
      if (trainingRes.status === 'fulfilled') {
        const sessions = trainingRes.value.data.items ?? [];
        setWorkoutsCompleted(sessions.length);
        setTrainingLogged(sessions.length > 0);
        setTrainingSessions(sessions);
      }

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
        const { data } = await api.get('training/analytics/strength-standards', { signal });
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
        const checkinRes = await api.post('adaptive/weekly-checkin', {}, { signal });
        store.setWeeklyCheckin(checkinRes.data);
      } catch {
        // Non-critical — dashboard works without check-in
      }

      // Fetch fatigue data (fire-and-forget)
      try {
        const fatigueRes = await api.get('training/fatigue', { signal });
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
        }, { signal });
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
          const recompRes = await api.get('recomp/metrics', { signal });
          setRecompMetrics(recompRes.data);
        } else {
          setRecompMetrics(null);
        }
      } catch {
        setRecompMetrics(null);
      }

      // Fetch nudges (fire-and-forget)
      try {
        const nudgesRes = await api.get('adaptive/nudges', { signal });
        setNudges(nudgesRes.data ?? []);
      } catch {
        setNudges([]);
      }

      // Use achievement API streak
      if (streakRes.status === 'fulfilled' && streakRes.value.data?.current_streak != null) {
        setStreak(streakRes.value.data.current_streak);
      } else {
        setStreak(0);
      }
    } catch {
      setError('Unable to load dashboard data. Check your connection.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      setDateLoading(false);
    }
  }, [selectedDate]);

  // Debounced date switching
  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
    setDateLoading(true);
    impact('light');
    if (dateDebounceRef.current) {
      clearTimeout(dateDebounceRef.current);
    }
    dateDebounceRef.current = setTimeout(() => {
      loadDashboardData(date);
    }, DATE_DEBOUNCE_MS);
  }, [loadDashboardData, impact]);

  useEffect(() => {
    const controller = new AbortController();
    loadDashboardData(selectedDate, controller.signal);
    return () => {
      controller.abort();
      if (dateDebounceRef.current) {
        clearTimeout(dateDebounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData(selectedDate);
    }, [selectedDate, loadDashboardData])
  );

  const handleRefresh = useCallback(async () => {
    isInitialLoad.current = false;
    setRefreshing(true);
    await loadDashboardData(selectedDate);
    impact('light');
  }, [loadDashboardData, selectedDate, impact]);

  const handleArticlePress = (articleId: string) => {
    navigation?.navigate?.('ArticleDetail', { articleId });
  };

  const handleAddToSlot = (slotName: string) => {
    setPrefilledMealName(slotName);
    setShowNutrition(true);
  };

  const handleQuickAction = (action: () => void) => {
    impact('light');
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

        {/* Error Banner */}
        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => loadDashboardData(selectedDate)}
            onDismiss={() => setError(null)}
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

        {/* Goal Progress Pill */}
        {!isLoading && store.goals?.goalType && (
          <View style={styles.goalPillContainer}>
            <GoalProgressPill
              goalType={store.goals.goalType}
              targetCalories={targets.calories}
            />
          </View>
        )}

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
                  accessibilityLabel="Log food"
                  accessibilityRole="button"
                />
              </View>
              <View style={styles.quickItem}>
                <QuickActionButton
                  icon="lunchbox"
                  label="Build Meal"
                  accentColor={colors.accent.primary}
                  completed={false}
                  onPress={() => handleQuickAction(() => setShowMealBuilder(true))}
                  accessibilityLabel="Build meal"
                  accessibilityRole="button"
                />
              </View>
              <View style={styles.quickItem} testID="dashboard-log-training-button">
                <QuickActionButton
                  icon="dumbbell"
                  label="Training"
                  accentColor={colors.macro.protein}
                  completed={trainingLogged}
                  onPress={() => handleQuickAction(() => {
                    if (isPremiumWorkoutLoggerEnabled()) {
                      navigation.push('ActiveWorkout', { mode: 'new' });
                    } else {
                      setShowTraining(true);
                    }
                  })}
                  accessibilityLabel="Start workout"
                  accessibilityRole="button"
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

        {/* Nudge Card */}
        {!isLoading && nudges.length > 0 && (
          <NudgeCard
            nudge={nudges[0]}
            onDismiss={() => setNudges([])}
            onAction={(action) => {
              if (action === 'recalculate') {
                navigation?.navigate?.('Recalculate');
              } else if (action === 'edit_goals') {
                navigation?.navigate?.('Goals');
              }
            }}
          />
        )}

        {/* Today's Workout Card */}
        {!isLoading && (
          <TodayWorkoutCard
            sessions={trainingSessions}
            isWorkoutActive={isWorkoutActive}
            activeExerciseCount={activeExerciseCount}
            onPress={(sessionId) => navigation?.navigate?.('SessionDetail', { sessionId })}
            onResume={() => navigation?.navigate?.('ActiveWorkout')}
            onStartWorkout={() => {
              if (isPremiumWorkoutLoggerEnabled()) {
                navigation.push('ActiveWorkout', { mode: 'new' });
              } else {
                setShowTraining(true);
              }
            }}
          />
        )}

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
            </>
          )}
        </Animated.View>

        {/* Weight Trend Section — show trend weight + weekly change if ≥3 data points */}
        {isLoading ? (
          <View style={styles.trendSection}>
            <Skeleton width="60%" height={20} />
          </View>
        ) : (() => {
          const emaSeries = computeEMA(weightHistory);
          const unitSystem = store.unitSystem;
          const unit = unitSystem === 'metric' ? 'kg' : 'lbs';

          if (weightHistory.length === 0) {
            return (
              <TouchableOpacity style={styles.trendSection} onPress={() => setShowBodyweight(true)} activeOpacity={0.7}>
                <Text style={styles.emptyStateText}>Tap to log your first weigh-in</Text>
              </TouchableOpacity>
            );
          }

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
            <TouchableOpacity style={styles.trendSection} onPress={() => setShowBodyweight(true)} activeOpacity={0.7} accessibilityLabel="Log bodyweight" accessibilityRole="button">
              <View style={styles.trendRow}>
                <Text style={styles.trendLabel}>Trend: {displayWeight}{unit}</Text>
                <Text style={[styles.trendBadge, { color: badgeColor }]}>{changeText}</Text>
                <Text style={styles.trendLogHint}>+ Log</Text>
              </View>
            </TouchableOpacity>
          );
        })()}

        {/* Milestone Banner */}
        {isLoading ? (
          <View style={styles.milestoneBanner}>
            <Skeleton width={16} height={16} variant="circle" />
            <Skeleton width="70%" height={16} />
            <Skeleton width={16} height={16} />
          </View>
        ) : milestoneMessage && (
          <TouchableOpacity
            style={styles.milestoneBanner}
            onPress={() => navigation?.navigate?.('Analytics')}
            activeOpacity={0.7}
            accessibilityLabel="View milestone progress"
            accessibilityRole="button"
          >
            <Icon name="dumbbell" size={16} color={colors.accent.primary} />
            <Text style={styles.milestoneText} numberOfLines={1}>{milestoneMessage}</Text>
            <Text style={styles.milestoneChevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* Readiness — compact inline badge */}
        {!isLoading && readinessScore !== null && !Number.isNaN(readinessScore) && (
          <TouchableOpacity
            style={styles.readinessBadge}
            onPress={() => setShowCheckin(true)}
            activeOpacity={0.7}
            accessibilityLabel={`Readiness score ${readinessScore}`}
            accessibilityRole="button"
          >
            <Text style={styles.readinessEmoji}>⚡</Text>
            <Text style={styles.readinessText}>Readiness: {readinessScore}/100</Text>
            <Text style={styles.milestoneChevron}>›</Text>
          </TouchableOpacity>
        )}
        {!isLoading && (readinessScore === null || Number.isNaN(readinessScore ?? NaN)) && (
          <TouchableOpacity
            style={styles.readinessBadge}
            onPress={() => setShowCheckin(true)}
            activeOpacity={0.7}
            accessibilityLabel="Log recovery check-in"
            accessibilityRole="button"
          >
            <Text style={styles.readinessEmoji}>💤</Text>
            <Text style={styles.readinessText}>Tap to log recovery</Text>
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

        {/* Fatigue Alert Card — only when actionable */}
        {!isLoading && fatigueSuggestions.length > 0 && (
            <FatigueAlertCard
              suggestions={fatigueSuggestions}
              onPress={() => navigation?.navigate?.('Analytics')}
            />
        )}

        {/* Featured — single tip card with link to all articles */}
        {!isLoading && articles.length > 0 && (
          <Animated.View style={featuredAnim}>
            <TouchableOpacity
              style={styles.milestoneBanner}
              onPress={() => handleArticlePress(articles[0].id)}
              activeOpacity={0.7}
              accessibilityLabel={`Read: ${articles[0].title}`}
              accessibilityRole="button"
            >
              <Icon name="book" size={16} color={colors.accent.primary} />
              <Text style={styles.milestoneText} numberOfLines={1}>{articles[0].title}</Text>
              <Text style={styles.milestoneChevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Learn')}
              style={styles.seeAllLink}
              activeOpacity={0.7}
              accessibilityLabel="See all articles"
              accessibilityRole="button"
            >
              <Text style={styles.seeAllText}>See all articles →</Text>
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
      {!isPremiumWorkoutLoggerEnabled() && (
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
  skeletonRingsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  dateLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  skeletonSummaryRow: {
    flexDirection: 'row',
    gap: spacing[6],
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
    lineHeight: typography.lineHeight.sm,
  },
  trendBadge: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.sm,
  },
  trendLogHint: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  milestoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginTop: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing[2],
    minHeight: 44,
  },
  milestoneText: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  milestoneChevron: {
    color: colors.accent.primary,
    fontSize: typography.size.lg,
  },
  emptyStateText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    textAlign: 'center',
    paddingVertical: spacing[2],
    lineHeight: typography.lineHeight.sm,
  },
  goalPillContainer: {
    alignItems: 'center',
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  readinessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginTop: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing[2],
    minHeight: 44,
  },
  seeAllLink: {
    alignItems: 'flex-end',
    paddingVertical: spacing[2],
  },
  seeAllText: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  readinessEmoji: {
    fontSize: 16,
  },
  readinessText: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
});
