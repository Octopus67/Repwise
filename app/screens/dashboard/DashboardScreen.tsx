import React, { useEffect, useState, useCallback, useMemo } from 'react'; // Audit fix 7.2 — memoization
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateString } from '../../utils/localDate';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { VerificationBanner } from '../../components/common/VerificationBanner';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { MacroRingsRow } from '../../components/dashboard/MacroRingsRow';
import { QuickActionButton } from '../../components/dashboard/QuickActionButton';
import { DateScroller } from '../../components/dashboard/DateScroller';
import { WeeklyTrainingCalendar } from '../../components/dashboard/WeeklyTrainingCalendar';
import { MealSlotDiary } from '../../components/dashboard/MealSlotDiary';
import { BudgetBar } from '../../components/nutrition/BudgetBar';
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
import { QuickAddModal } from '../../components/modals/QuickAddModal';
import { MealBuilder } from '../../components/nutrition/MealBuilder';
import { CelebrationModal } from '../../components/achievements/CelebrationModal';
import { TodayWorkoutCard } from '../../components/dashboard/TodayWorkoutCard';
import { RestDayCard } from '../../components/dashboard/RestDayCard';
import { WeeklyChallengeCard } from '../../components/dashboard/WeeklyChallengeCard';
import { useStore, isPremium } from '../../store';
import { useActiveWorkoutStore } from '../../store/activeWorkoutSlice';
import { computeEMA, computeWeeklyChange, formatWeeklyChange } from '../../utils/emaTrend';
import { WeeklyCheckinCard } from '../../components/coaching/WeeklyCheckinCard';
import { FatigueAlertCard } from '../../components/dashboard/FatigueAlertCard';
import { StepCountCard } from '../../components/dashboard/StepCountCard';
import { RecompDashboardCard } from '../../components/dashboard/RecompDashboardCard';
import NudgeCard from '../../components/dashboard/NudgeCard';
import GoalProgressPill from '../../components/dashboard/GoalProgressPill';
import { RecoveryCheckinModal } from '../../components/modals/RecoveryCheckinModal';
import { Icon } from '../../components/common/Icon';
import { TrendLineChart } from '../../components/charts/TrendLineChart';
import api from '../../services/api';
import { haptic } from '../../utils/haptics';
import { getApiErrorMessage } from '../../utils/errors';
import { showRetryAlert } from '../../utils/alertRetry';
import { validateApiResponse, PaymentStatusSchema } from '../../schemas/api';
import { isPremiumWorkoutLoggerEnabled } from '../../utils/featureFlags';
import { getOfferings, executePurchase } from '../../services/purchases';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useDashboardModals } from '../../hooks/useDashboardModals';
import { useDashboardNavigation } from '../../hooks/useDashboardNavigation';
import { useRecoveryScore } from '../../hooks/useRecoveryScore';
import { RecoveryInsightCard } from '../../components/dashboard/RecoveryInsightCard';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import type { MacroTargets } from '../../types/nutrition';
import type { DashboardScreenProps } from '../../types/navigation';
import type { IconName } from '../../components/common/Icon';

// ── Inline banner component to reduce JSX repetition ─────────────────────
interface InfoBannerProps {
  icon?: IconName;
  emoji?: string;
  text: string;
  chevronColor: string;
  onPress: () => void;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
  accessibilityLabel?: string;
}

function InfoBanner({ icon, emoji, text, chevronColor, onPress, style, accessibilityLabel }: InfoBannerProps) {
  const c = useThemeColors();
  return (
    <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.7} accessibilityLabel={accessibilityLabel} accessibilityRole="button">
      {icon && <Icon name={icon} size={16} color={c.accent.primary} />}
      {emoji && <Text style={{ fontSize: 16 }}>{emoji}</Text>}
      <Text style={{ flex: 1, fontSize: typography.size.sm, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.sm, color: c.text.primary }} numberOfLines={1}>{text}</Text>
      <Icon name="chevron-right" size={16} color={c.text.muted} />
    </TouchableOpacity>
  );
}

const TRIAL_MODAL_DISMISS_KEY = '@repwise:trial_modal_dismissed';

/** Inline per-section error indicator (#17) */
function SectionError({ label, onRetry }: { label: string; onRetry: () => void }) {
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[2], gap: spacing[2] }}>
      <Text style={{ color: c.semantic.negative, fontSize: typography.size.xs }}>Failed to load {label}</Text>
      <TouchableOpacity onPress={onRetry} accessibilityRole="button" accessibilityLabel={`Retry loading ${label}`}>
        <Text style={{ color: c.accent.primary, fontSize: typography.size.xs, fontWeight: typography.weight.medium }}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

export function DashboardScreen({ navigation }: DashboardScreenProps<'DashboardHome'>) {
  const c = useThemeColors();
  const s = getThemedStyles(c);
  const store = useStore();
  const premium = isPremium(store);
  const { status: trialStatus, eligibility: trialEligibility, startTrial, fetchInsights } = useTrial();
  const [showTrialExpiration, setShowTrialExpiration] = useState(false);
  const [trialInsights, setTrialInsights] = useState<TrialInsights | null>(null);
  const [trialModalDismissed, setTrialModalDismissed] = useState(false);
  const pendingCelebrations = useStore((st) => st.pendingCelebrations);
  const clearCelebrations = useStore((st) => st.clearCelebrations);
  const isWorkoutActive = useActiveWorkoutStore(st => st.exercises.length > 0);
  const activeExerciseCount = useActiveWorkoutStore(st => st.exercises.length);
  const emailVerified = useStore((st) => st.user?.emailVerified);
  const [verifyDismissed, setVerifyDismissed] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [coachingLoading, setCoachingLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@repwise:verify_dismissed').then(val => {
      if (val && Date.now() - Number(val) < 86_400_000) setVerifyDismissed(true);
    }).catch(err => console.warn('[Repwise] verify dismissed read:', err));
    AsyncStorage.getItem(TRIAL_MODAL_DISMISS_KEY).then(val => {
      if (val && Date.now() - Number(val) < 86_400_000) setTrialModalDismissed(true);
    }).catch(err => console.warn('[Repwise] trial modal dismissed read:', err));
    AsyncStorage.getItem('@repwise:nudge_dismissed').then(val => {
      if (val && Date.now() - Number(val) < 86_400_000) setNudgeDismissed(true);
    }).catch(err => console.warn('[Repwise] nudge dismissed read:', err));
  }, []);
  const dismissVerify = () => {
    setVerifyDismissed(true);
    AsyncStorage.setItem('@repwise:verify_dismissed', Date.now().toString());
  };

  const { data, setData, isLoading, error, setError, refreshing, dateLoading, handleDateSelect, handleRefresh, loadDashboardData, targets, consumed, volumeFlagEnabled, selectedDate, sectionErrors, refetchBySection } = useDashboardData();
  const { modals, openNutrition, closeNutrition, openUpgrade, closeUpgrade, openTraining, closeTraining, openBodyweight, closeBodyweight, openQuickAdd, closeQuickAdd, openMealBuilder, closeMealBuilder, openCheckin, closeCheckin } = useDashboardModals();
  const nav = useDashboardNavigation({ navigation, openNutrition, openTraining, openMealBuilder, openBodyweight, openCheckin, openUpgrade });
  const recovery = useRecoveryScore();
  const { enabled: combinedReadinessEnabled } = useFeatureFlag('combined_readiness');

  useEffect(() => { if (trialStatus && !trialStatus.active && trialStatus.has_used_trial && trialStatus.days_remaining === 0 && !trialModalDismissed) { fetchInsights().then(setTrialInsights).catch(err => console.warn('[Repwise] trial insights fetch:', err)); setShowTrialExpiration(true); } }, [trialStatus, fetchInsights, trialModalDismissed]);
  
  // Load data on mount and when date changes - handled by useDashboardQueries via TanStack Query
  // TanStack Query auto-refetches stale data, no manual useFocusEffect needed

  const anim = useStaggeredEntrance;
  const hA = anim(0, 60);
  const dsA = anim(1, 60);
  const qaA = anim(3, 60);
  const rA = anim(4, 60);
  const bA = anim(5, 60);
  const msA = anim(6, 60);
  const fA = anim(8, 60);

  const bannerStyle = useMemo(() => [s.banner, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }], [s.banner, c.bg.surface, c.border.subtle]); // Audit fix 7.2
  const emaSeries = useMemo(() => computeEMA(data.weightHistory), [data.weightHistory]); // Audit fix 7.2
  const unitSys = store.unitSystem;
  const unit = unitSys === 'metric' ? 'kg' : 'lbs';

  const today = useMemo(() => getLocalDateString(), []); // Audit fix 7.2
  const isToday = selectedDate === today;
  const showRestDay = !isLoading && data.trainingSessions.length === 0 && (!isToday || new Date().getHours() >= 14);

  const handleCheckinAccept = useCallback(async (id: string) => { if (coachingLoading) return; setCoachingLoading(true); try { await api.post(`adaptive/suggestions/${id}/accept`); store.setWeeklyCheckin(null); loadDashboardData(selectedDate); } catch (err: unknown) { Alert.alert('Error', 'Could not update. Please try again.'); } finally { setCoachingLoading(false); } }, [store, loadDashboardData, selectedDate, coachingLoading]); // Audit fix 7.2
  const handleCheckinModify = useCallback(async (id: string, t: MacroTargets) => { if (coachingLoading) return; setCoachingLoading(true); try { await api.post(`adaptive/suggestions/${id}/modify`, t); store.setWeeklyCheckin(null); loadDashboardData(selectedDate); } catch (err: unknown) { Alert.alert('Error', 'Could not update. Please try again.'); } finally { setCoachingLoading(false); } }, [store, loadDashboardData, selectedDate, coachingLoading]); // Audit fix 7.2
  const handleCheckinDismiss = useCallback(async (id: string) => { if (coachingLoading) return; setCoachingLoading(true); try { await api.post(`adaptive/suggestions/${id}/dismiss`); store.setWeeklyCheckin(null); } catch (err: unknown) { Alert.alert('Error', 'Could not update. Please try again.'); } finally { setCoachingLoading(false); } }, [store, coachingLoading]); // Audit fix 7.2

  const dismissTrialModal = useCallback(() => {
    setShowTrialExpiration(false);
    AsyncStorage.setItem(TRIAL_MODAL_DISMISS_KEY, Date.now().toString());
  }, []); // Audit fix 7.2

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
      <View style={s.trendSection}>
        <TouchableOpacity onPress={openBodyweight} activeOpacity={0.7} accessibilityLabel="Log bodyweight" accessibilityRole="button">
          <View style={s.trendRow}>
            <Text style={[s.trendLabel, { color: c.text.secondary }]}>Trend: {dw}{unit}</Text>
            <Text style={[s.trendBadge, { color: bc }]}>{formatWeeklyChange(wc, unit)}</Text>
            <Text style={[s.trendLogHint, { color: c.accent.primary }]}>+ Log</Text>
          </View>
        </TouchableOpacity>
        {emaSeries.length >= 3 && (
          <TrendLineChart
            data={emaSeries}
            color={c.accent.primary}
            suffix={unit}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
      <ScrollView testID="dashboard-screen" style={s.container} contentContainerStyle={s.content}
        removeClippedSubviews={Platform.OS !== 'web'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { haptic.light(); handleRefresh(); }} tintColor={c.accent.primary} />}>

        <Animated.View style={hA}><View style={s.header} testID="dashboard-greeting">
          {premium && <PremiumBadge size="md" />}
          {trialStatus?.active && trialStatus.days_remaining > 0 && <TrialBadge daysRemaining={trialStatus.days_remaining} />}
        </View></Animated.View>

        {error && <ErrorBanner message={error} onRetry={() => loadDashboardData(selectedDate)} onDismiss={() => setError(null)} />}
        {emailVerified === false && !verifyDismissed && (
          <VerificationBanner onVerify={async () => {
            try {
              await api.post('auth/resend-verification');
              const verifyCode = async (code: string | null) => {
                if (!code) return;
                if (code.length !== 6) { Alert.alert('Invalid Code', 'Please enter a 6-digit verification code.'); return; }
                try {
                  await api.post('auth/verify-email', { code });
                  Alert.alert('Verified!', 'Your email has been verified.');
                  useStore.getState().setAuth(
                    { ...useStore.getState().user!, emailVerified: true },
                    useStore.getState().tokens!,
                  );
                  setVerifyDismissed(true);
                } catch (err) {
                  console.error('[Dashboard] Verification failed:', err);
                  Alert.alert('Verification Failed', 'Invalid or expired code. Please try again.');
                }
              };
              if (Platform.OS === 'web') {
                const code = window.prompt('Enter the 6-digit verification code sent to your email:');
                await verifyCode(code);
              } else {
                Alert.prompt(
                  'Enter Verification Code',
                  'We sent a 6-digit code to your email.',
                  async (code) => { await verifyCode(code); },
                  'plain-text',
                );
              }
            } catch (err: unknown) {
              const msg = getApiErrorMessage(err, 'Could not send verification email. Please try again later.');
              Alert.alert('Error', msg);
            }
          }} onDismiss={dismissVerify} />
        )}
        <Animated.View style={dsA} testID="dashboard-date-scroller"><DateScroller selectedDate={selectedDate} onDateSelect={handleDateSelect} loggedDates={data.loggedDates} /></Animated.View>
        {!isLoading && <WeeklyTrainingCalendar selectedDate={selectedDate} trainedDates={data.trainedDates} onDateSelect={handleDateSelect} />}
        {!isLoading && store.goals?.goalType && <View style={s.goalPill}><GoalProgressPill goalType={store.goals.goalType} targetCalories={targets.calories} /></View>}

        <Animated.View style={qaA}>
          <SectionHeader title="Quick Log" />
          {isLoading ? <View style={s.quickRow}><Skeleton width="30%" height={100} borderRadius={radius.md} /><Skeleton width="30%" height={100} borderRadius={radius.md} /><Skeleton width="30%" height={100} borderRadius={radius.md} /></View> : (
            <View style={s.quickRow}>
              <View style={s.quickItem} testID="dashboard-log-food-button"><QuickActionButton icon="utensils" label="Log Food" accentColor={c.macro.calories} completed={data.nutritionLogged} onPress={() => nav.handleQuickAction(() => openNutrition())} accessibilityLabel="Log food" accessibilityRole="button" /></View>
              <View style={s.quickItem}><QuickActionButton icon="lunchbox" label="Build Meal" accentColor={c.accent.primary} completed={false} onPress={() => nav.handleQuickAction(openMealBuilder)} accessibilityLabel="Build meal" accessibilityRole="button" /></View>
              <View style={s.quickItem} testID="dashboard-log-training-button"><QuickActionButton icon="dumbbell" label="Training" accentColor={c.macro.protein} completed={data.trainingLogged} onPress={() => nav.handleQuickAction(nav.handleStartWorkout)} accessibilityLabel="Start workout" accessibilityRole="button" /></View>
            </View>
          )}
        </Animated.View>

        <Animated.View style={rA}>
          {isLoading ? <View style={s.skelRings}><Skeleton width={96} height={96} variant="circle" /><Skeleton width={96} height={96} variant="circle" /><Skeleton width={96} height={96} variant="circle" /><Skeleton width={96} height={96} variant="circle" /></View> : (
            <View>
              <MacroRingsRow calories={{ ...data.calories, target: targets.calories }} protein={{ ...data.protein, target: targets.protein_g }} carbs={{ ...data.carbs, target: targets.carbs_g }} fat={{ value: data.totalFat, target: targets.fat_g }} />
              {dateLoading && <View style={[s.dateOverlay, { backgroundColor: c.bg.overlay }]}><ActivityIndicator size="small" color={c.accent.primary} /></View>}
            </View>
          )}
        </Animated.View>

        <Animated.View style={bA}>{!isLoading && <BudgetBar consumed={consumed} targets={targets} />}</Animated.View>
        {sectionErrors.nutrition && <SectionError label="nutrition" onRetry={refetchBySection.nutrition} />}
        <Animated.View style={msA}>{!isLoading && <MealSlotDiary entries={data.nutritionEntries} onAddToSlot={nav.handleAddToSlot} />}</Animated.View>

        {!isLoading && !nudgeDismissed && data.nudges.length > 0 && <NudgeCard nudge={data.nudges[0]} onDismiss={async () => { setNudgeDismissed(true); setData(); try { await AsyncStorage.setItem('@repwise:nudge_dismissed', Date.now().toString()); } catch (e) { console.error('[Dashboard] Nudge dismiss save failed:', e); } }} onAction={(a) => { if (a === 'recalculate' || a === 'edit_goals') { navigation.getParent()?.navigate('Profile'); } }} />}
        {showRestDay
          ? <RestDayCard proteinTarget={targets.protein_g} />
          : !isLoading && <TodayWorkoutCard sessions={data.trainingSessions} isWorkoutActive={isWorkoutActive} activeExerciseCount={activeExerciseCount} onPress={nav.handleSessionPress} onResume={nav.handleResumeWorkout} onStartWorkout={nav.handleStartWorkout} />}
        {sectionErrors.training && <SectionError label="training" onRetry={refetchBySection.training} />}

        {!isLoading && <WeeklyChallengeCard challenges={data.challenges} />}

        {Platform.OS !== 'web' && <StepCountCard />}

        {renderWeightTrend()}

        {isLoading ? <View style={bannerStyle}><Skeleton width={16} height={16} variant="circle" /><Skeleton width="70%" height={16} /><Skeleton width={16} height={16} /></View>
          : data.milestoneMessage && <InfoBanner style={bannerStyle} icon="dumbbell" text={data.milestoneMessage} chevronColor={c.accent.primary} onPress={nav.handleNavigateAnalytics} accessibilityLabel="View milestone progress" />}

        {!isLoading && combinedReadinessEnabled && !recovery.isLoading && recovery.score > 0
          ? <RecoveryInsightCard score={recovery.score} volumeMultiplier={recovery.volumeMultiplier} label={recovery.label} factors={recovery.factors} onPress={openCheckin} />
          : !isLoading && (data.readinessScore !== null && !Number.isNaN(data.readinessScore)
          ? <InfoBanner style={bannerStyle} icon="lightning" text={`Readiness: ${data.readinessScore}/100`} chevronColor={c.accent.primary} onPress={openCheckin} accessibilityLabel={`Readiness score ${data.readinessScore}`} />
          : <InfoBanner style={bannerStyle} icon="moon" text="Tap to log recovery" chevronColor={c.accent.primary} onPress={openCheckin} accessibilityLabel="Log recovery check-in" />
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
      <TrialExpirationModal visible={showTrialExpiration} onClose={dismissTrialModal} onUpgrade={async (planId?: string) => {
          setShowTrialExpiration(false);
          if (planId) {
            try {
              const offerings = await getOfferings();
              if (!offerings) { Alert.alert('Error', 'Unable to load subscription options.'); return; }
              const planKey = planId?.includes('yearly') ? 'yearly' : 'monthly';
              const result = await executePurchase(offerings, planKey as 'monthly' | 'yearly');
              if (result.success) {
                Alert.alert('Success', 'Welcome to Repwise Pro!');
                // Sync with backend in background - don't let sync failure affect UX
                try {
                  const { data } = await api.get('payments/status');
                  if (data) useStore.getState().setSubscription(validateApiResponse(PaymentStatusSchema, data, 'payments/status'));
                } catch {
                  console.warn('[Repwise] Backend sync failed after purchase, will retry');
                  setTimeout(async () => {
                    try {
                      const { data } = await api.get('payments/status');
                      if (data) useStore.getState().setSubscription(validateApiResponse(PaymentStatusSchema, data, 'payments/status'));
                    } catch { /* will sync on next app launch */ }
                  }, 5000);
                }
              } else if (result.pending) {
                Alert.alert('Purchase Pending', 'Your purchase is awaiting approval.');
              }
            } catch (e: unknown) {
              if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '1') return; // PURCHASE_CANCELLED_ERROR
              showRetryAlert('Purchase Failed', 'Purchase failed. Please try again.', () => openUpgrade());
            }
          } else {
            openUpgrade();
          }
        }} insights={trialInsights} />
      <AddNutritionModal visible={modals.showNutrition} onClose={closeNutrition} onSuccess={() => loadDashboardData(selectedDate)} prefilledMealName={modals.prefilledMealName} />
      {!isPremiumWorkoutLoggerEnabled() && <AddTrainingModal visible={modals.showTraining} onClose={closeTraining} onSuccess={() => loadDashboardData(selectedDate)} />}
      <AddBodyweightModal visible={modals.showBodyweight} onClose={closeBodyweight} onSuccess={() => loadDashboardData(selectedDate)} />
      <QuickAddModal visible={modals.showQuickAdd} onClose={closeQuickAdd} onSuccess={() => loadDashboardData(selectedDate)} targetDate={selectedDate} />
      <MealBuilder visible={modals.showMealBuilder} onClose={closeMealBuilder} onSuccess={() => loadDashboardData(selectedDate)} targets={targets} consumed={consumed} />
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
  quickRow: { flexDirection: 'row', gap: spacing[3] },
  quickItem: { flex: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  skelRings: { flexDirection: 'row', justifyContent: 'center', gap: spacing[3], marginTop: spacing[4] },
  dateOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: c.bg.overlay, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
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
