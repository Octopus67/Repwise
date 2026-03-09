import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
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
import { TrialBadge } from '../../components/premium/TrialBadge';
import { TrialExpirationModal } from '../../components/premium/TrialExpirationModal';
import { UpgradeBanner } from '../../components/premium/UpgradeBanner';
import { UpgradeModal } from '../../components/premium/UpgradeModal';
import { useTrial } from '../../hooks/useTrial';
import type { TrialInsights } from '../../utils/trialLogic';
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
import api from '../../services/api';
import { isPremiumWorkoutLoggerEnabled } from '../../utils/featureFlags';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useDashboardModals } from '../../hooks/useDashboardModals';
import { useDashboardNavigation } from '../../hooks/useDashboardNavigation';
import { useRecoveryScore } from '../../hooks/useRecoveryScore';
import { RecoveryInsightCard } from '../../components/dashboard/RecoveryInsightCard';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

// ── Inline banner component to reduce JSX repetition ─────────────────────
function InfoBanner({ icon, emoji, text, chevronColor, onPress, style, accessibilityLabel }: any) {
  return (
    <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.7} accessibilityLabel={accessibilityLabel} accessibilityRole="button">
      {icon && <Icon name={icon} size={16} color={chevronColor} />}
      {emoji && <Text style={{ fontSize: 16 }}>{emoji}</Text>}
      <Text style={{ flex: 1, fontSize: typography.size.sm, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.sm }} numberOfLines={1}>{text}</Text>
      <Text style={{ color: chevronColor, fontSize: typography.size.lg }}>›</Text>
    </TouchableOpacity>
  );
}

export function DashboardScreen({ navigation }: any) {
  const c = useThemeColors();
  const s = getThemedStyles(c);
  const store = useStore();
  const premium = isPremium(store);
  const { status: trialStatus, eligibility: trialEligibility, startTrial, fetchInsights } = useTrial();
  const [showTrialExpiration, setShowTrialExpiration] = useState(false);
  const [trialInsights, setTrialInsights] = useState<TrialInsights | null>(null);
  const pendingCelebrations = useStore((st) => st.pendingCelebrations);
  const clearCelebrations = useStore((st) => st.clearCelebrations);
  const isWorkoutActive = useActiveWorkoutStore(st => st.exercises.length > 0);
  const activeExerciseCount = useActiveWorkoutStore(st => st.exercises.length);

  const { data, setData, isLoading, error, setError, refreshing, dateLoading, handleDateSelect, handleRefresh, loadDashboardData, targets, consumed, volumeFlagEnabled, selectedDate } = useDashboardData();
  const { modals, openNutrition, closeNutrition, openUpgrade, closeUpgrade, openTraining, closeTraining, openBodyweight, closeBodyweight, openQuickAdd, closeQuickAdd, openMealBuilder, closeMealBuilder, openCheckin, closeCheckin } = useDashboardModals();
  const nav = useDashboardNavigation({ navigation, openNutrition, openTraining, openMealBuilder, openBodyweight, openCheckin, openUpgrade });
  const recovery = useRecoveryScore();
  const { enabled: combinedReadinessEnabled } = useFeatureFlag('combined_readiness');

  useEffect(() => { if (trialStatus && !trialStatus.active && trialStatus.has_used_trial && trialStatus.days_remaining === 0) { fetchInsights().then(setTrialInsights); setShowTrialExpiration(true); } }, [trialStatus, fetchInsights]);
  
  // Load data on mount and when date changes - handled by useDashboardData hook internally
  // useFocusEffect for refresh on tab focus
  useFocusEffect(useCallback(() => { 
    const ac = new AbortController(); 
    loadDashboardData(selectedDate, ac.signal); 
    return () => ac.abort(); 
  }, [selectedDate])); // Remove loadDashboardData from deps!

  const anim = useStaggeredEntrance;
  const hA = anim(0, 60);
  const dsA = anim(1, 60);
  const qaA = anim(3, 60);
  const rA = anim(4, 60);
  const bA = anim(5, 60);
  const msA = anim(6, 60);
  const smA = anim(7, 60);
  const fA = anim(8, 60);

  const bannerStyle = [s.banner, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }];
  const emaSeries = computeEMA(data.weightHistory);
  const unitSys = store.unitSystem;
  const unit = unitSys === 'metric' ? 'kg' : 'lbs';

  const handleCheckinAccept = async (id: string) => { try { await api.post(`adaptive/suggestions/${id}/accept`); store.setWeeklyCheckin(null); loadDashboardData(selectedDate); } catch {} };
  const handleCheckinModify = async (id: string, t: any) => { try { await api.post(`adaptive/suggestions/${id}/modify`, t); store.setWeeklyCheckin(null); loadDashboardData(selectedDate); } catch {} };
  const handleCheckinDismiss = async (id: string) => { try { await api.post(`adaptive/suggestions/${id}/dismiss`); store.setWeeklyCheckin(null); } catch {} };

  // ── Weight trend render ────────────────────────────────────────────────
  const renderWeightTrend = () => {
    if (isLoading) return <View style={s.trendSection}><Skeleton width="60%" height={20} /></View>;
    if (data.weightHistory.length === 0) return (
      <TouchableOpacity style={s.trendSection} onPress={openBodyweight} activeOpacity={0.7}>
        <Text style={[s.emptyText, { color: c.text.muted }]}>Tap to log your first weigh-in</Text>
      </TouchableOpacity>
    );
    if (emaSeries.length === 0) return null;
    const tw = emaSeries[emaSeries.length - 1].value;
    const wc = computeWeeklyChange(emaSeries);
    const dw = unitSys === 'metric' ? tw.toFixed(1) : (tw * 2.20462).toFixed(1);
    const bc = wc === null ? c.text.secondary : wc < 0 ? c.semantic.positive : c.accent.primary;
    return (
      <TouchableOpacity style={s.trendSection} onPress={openBodyweight} activeOpacity={0.7} accessibilityLabel="Log bodyweight" accessibilityRole="button">
        <View style={s.trendRow}>
          <Text style={[s.trendLabel, { color: c.text.secondary }]}>Trend: {dw}{unit}</Text>
          <Text style={[s.trendBadge, { color: bc }]}>{formatWeeklyChange(wc, unit)}</Text>
          <Text style={[s.trendLogHint, { color: c.accent.primary }]}>+ Log</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
      <ScrollView testID="dashboard-screen" style={s.container} contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.accent.primary} />}>

        <Animated.View style={hA}><View style={s.header} testID="dashboard-greeting">
          {premium && <PremiumBadge size="md" />}
          {trialStatus?.active && trialStatus.days_remaining > 0 && <TrialBadge daysRemaining={trialStatus.days_remaining} />}
        </View></Animated.View>

        {error && <ErrorBanner message={error} onRetry={() => loadDashboardData(selectedDate)} onDismiss={() => setError(null)} />}
        <Animated.View style={dsA} testID="dashboard-date-scroller"><DateScroller selectedDate={selectedDate} onDateSelect={handleDateSelect} loggedDates={data.loggedDates} /></Animated.View>
        {!isLoading && store.goals?.goalType && <View style={s.goalPill}><GoalProgressPill goalType={store.goals.goalType} targetCalories={targets.calories} /></View>}

        <Animated.View style={qaA}>
          <SectionHeader title="Quick Log" />
          {isLoading ? <View style={s.quickRow}><Skeleton width="30%" height={100} borderRadius={12} /><Skeleton width="30%" height={100} borderRadius={12} /><Skeleton width="30%" height={100} borderRadius={12} /></View> : (
            <View style={s.quickRow}>
              <View style={s.quickItem} testID="dashboard-log-food-button"><QuickActionButton icon="utensils" label="Log Food" accentColor={c.macro.calories} completed={data.nutritionLogged} onPress={() => nav.handleQuickAction(() => openNutrition())} accessibilityLabel="Log food" accessibilityRole="button" /></View>
              <View style={s.quickItem}><QuickActionButton icon="lunchbox" label="Build Meal" accentColor={c.accent.primary} completed={false} onPress={() => nav.handleQuickAction(openMealBuilder)} accessibilityLabel="Build meal" accessibilityRole="button" /></View>
              <View style={s.quickItem} testID="dashboard-log-training-button"><QuickActionButton icon="dumbbell" label="Training" accentColor={c.macro.protein} completed={data.trainingLogged} onPress={() => nav.handleQuickAction(nav.handleStartWorkout)} accessibilityLabel="Start workout" accessibilityRole="button" /></View>
            </View>
          )}
        </Animated.View>

        <Animated.View style={rA}>
          {isLoading ? <View style={s.skelRings}><Skeleton width={96} height={96} variant="circle" /><Skeleton width={96} height={96} variant="circle" /><Skeleton width={96} height={96} variant="circle" /></View> : (
            <View>
              <MacroRingsRow calories={{ ...data.calories, target: targets.calories }} protein={{ ...data.protein, target: targets.protein_g }} carbs={{ ...data.carbs, target: targets.carbs_g }} fat={{ value: data.totalFat, target: targets.fat_g }} />
              {dateLoading && <View style={[s.dateOverlay, { backgroundColor: c.bg.overlay }]}><ActivityIndicator size="small" color={c.accent.primary} /></View>}
            </View>
          )}
        </Animated.View>

        <Animated.View style={bA}>{!isLoading && <BudgetBar consumed={consumed} targets={targets} />}</Animated.View>
        <Animated.View style={msA}>{!isLoading && <MealSlotDiary entries={data.nutritionEntries} onAddToSlot={nav.handleAddToSlot} />}</Animated.View>

        {!isLoading && data.nudges.length > 0 && <NudgeCard nudge={data.nudges[0]} onDismiss={() => setData((p) => ({ ...p, nudges: [] }))} onAction={(a) => { if (a === 'recalculate') navigation?.navigate?.('Recalculate'); else if (a === 'edit_goals') navigation?.navigate?.('Goals'); }} />}
        {!isLoading && <TodayWorkoutCard sessions={data.trainingSessions} isWorkoutActive={isWorkoutActive} activeExerciseCount={activeExerciseCount} onPress={nav.handleSessionPress} onResume={nav.handleResumeWorkout} onStartWorkout={nav.handleStartWorkout} />}

        <Animated.View style={[smA, s.summarySection]}>
          {isLoading ? <View style={s.skelSummary}><Skeleton width={120} height={24} /><Skeleton width={120} height={24} /></View> : (
            <View style={s.summaryRow}><TodaySummaryRow mealsLogged={data.nutritionEntries.length} workoutsCompleted={data.workoutsCompleted} /><StreakIndicator count={data.streak} /></View>
          )}
        </Animated.View>

        {renderWeightTrend()}

        {isLoading ? <View style={bannerStyle}><Skeleton width={16} height={16} variant="circle" /><Skeleton width="70%" height={16} /><Skeleton width={16} height={16} /></View>
          : data.milestoneMessage && <InfoBanner style={bannerStyle} icon="dumbbell" text={data.milestoneMessage} chevronColor={c.accent.primary} onPress={nav.handleNavigateAnalytics} accessibilityLabel="View milestone progress" />}

        {!isLoading && combinedReadinessEnabled && !recovery.isLoading && recovery.score > 0
          ? <RecoveryInsightCard score={recovery.score} volumeMultiplier={recovery.volumeMultiplier} label={recovery.label} factors={recovery.factors} onPress={openCheckin} />
          : !isLoading && (data.readinessScore !== null && !Number.isNaN(data.readinessScore)
          ? <InfoBanner style={bannerStyle} emoji="⚡" text={`Readiness: ${data.readinessScore}/100`} chevronColor={c.accent.primary} onPress={openCheckin} accessibilityLabel={`Readiness score ${data.readinessScore}`} />
          : <InfoBanner style={bannerStyle} emoji="💤" text="Tap to log recovery" chevronColor={c.accent.primary} onPress={openCheckin} accessibilityLabel="Log recovery check-in" />
        )}

        {!isLoading && data.recompMetrics && store.goals?.goalType === 'recomposition' && <RecompDashboardCard metrics={data.recompMetrics} />}
        {!isLoading && store.weeklyCheckin && <WeeklyCheckinCard checkin={store.weeklyCheckin} onDismiss={() => store.setWeeklyCheckin(null)} onAccept={handleCheckinAccept} onModify={handleCheckinModify} onDismissSuggestion={handleCheckinDismiss} />}
        {!isLoading && data.fatigueSuggestions.length > 0 && <FatigueAlertCard suggestions={data.fatigueSuggestions} onPress={nav.handleNavigateAnalytics} />}
        {!isLoading && volumeFlagEnabled && data.volumeSummary && <InfoBanner style={bannerStyle} icon="chart" text={`${data.volumeSummary.optimal} muscle${data.volumeSummary.optimal !== 1 ? 's' : ''} optimal${data.volumeSummary.approachingMrv > 0 ? `, ${data.volumeSummary.approachingMrv} approaching MRV` : ''}`} chevronColor={c.accent.primary} onPress={() => nav.handleNavigateAnalytics({ screen: 'AnalyticsHome', params: { initialTab: 'volume' } })} accessibilityLabel="View volume insights" />}

        {!isLoading && data.articles.length > 0 && (
          <Animated.View style={fA}>
            <InfoBanner style={bannerStyle} icon="book" text={data.articles[0].title} chevronColor={c.accent.primary} onPress={() => nav.handleArticlePress(data.articles[0].id)} accessibilityLabel={`Read: ${data.articles[0].title}`} />
            <TouchableOpacity onPress={nav.handleNavigateLearn} style={s.seeAll} activeOpacity={0.7}><Text style={[s.seeAllText, { color: c.accent.primary }]}>See all articles →</Text></TouchableOpacity>
          </Animated.View>
        )}

        {!premium && <UpgradeBanner onPress={openUpgrade} />}
      </ScrollView>

      <UpgradeModal visible={modals.showUpgrade} onClose={closeUpgrade} trialEligible={trialEligibility?.eligible} onStartTrial={startTrial} />
      <TrialExpirationModal visible={showTrialExpiration} onClose={() => setShowTrialExpiration(false)} onUpgrade={() => { setShowTrialExpiration(false); openUpgrade(); }} insights={trialInsights} />
      <AddNutritionModal visible={modals.showNutrition} onClose={closeNutrition} onSuccess={() => loadDashboardData(selectedDate)} prefilledMealName={modals.prefilledMealName} />
      {!isPremiumWorkoutLoggerEnabled() && <AddTrainingModal visible={modals.showTraining} onClose={closeTraining} onSuccess={() => loadDashboardData(selectedDate)} />}
      <AddBodyweightModal visible={modals.showBodyweight} onClose={closeBodyweight} onSuccess={() => loadDashboardData(selectedDate)} />
      <QuickAddModal visible={modals.showQuickAdd} onClose={closeQuickAdd} onSuccess={() => loadDashboardData(selectedDate)} targetDate={selectedDate} />
      <MealBuilder visible={modals.showMealBuilder} onClose={closeMealBuilder} onSuccess={() => loadDashboardData(selectedDate)} />
      <CelebrationModal achievements={pendingCelebrations} visible={pendingCelebrations.length > 0} onDismiss={clearCelebrations} />
      <RecoveryCheckinModal visible={modals.showCheckin} onClose={closeCheckin} onSuccess={() => loadDashboardData(selectedDate)} />
    </SafeAreaView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.base },
  container: { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[12] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[4] },
  summarySection: { marginTop: spacing[6] },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quickRow: { flexDirection: 'row', gap: spacing[3] },
  quickItem: { flex: 1 },
  skelRings: { flexDirection: 'row', justifyContent: 'center', gap: spacing[3], marginTop: spacing[4] },
  dateOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: c.bg.overlay, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  skelSummary: { flexDirection: 'row', gap: spacing[6] },
  trendSection: { marginTop: spacing[3] },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  trendLabel: { color: c.text.secondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.sm },
  trendBadge: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, lineHeight: typography.lineHeight.sm },
  trendLogHint: { color: c.accent.primary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.sm },
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg.surface, borderRadius: radius.sm, padding: spacing[3], marginTop: spacing[3], borderWidth: 1, borderColor: c.border.subtle, gap: spacing[2], minHeight: 44 },
  emptyText: { color: c.text.muted, fontSize: typography.size.sm, textAlign: 'center', paddingVertical: spacing[2], lineHeight: typography.lineHeight.sm },
  goalPill: { alignItems: 'center', marginTop: spacing[3], marginBottom: spacing[2] },
  seeAll: { alignItems: 'flex-end', paddingVertical: spacing[2] },
  seeAllText: { color: c.accent.primary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.sm },
});
