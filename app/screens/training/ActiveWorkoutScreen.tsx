/**
 * ActiveWorkoutScreen — Premium workout logging interface (Phase 5)
 *
 * Thin orchestrator that assembles Phase 4 components:
 * - ExerciseCardPremium (set rows, overload badges, action menus)
 * - VolumePills (weekly muscle volume tracking)
 * - FloatingRestTimerBar (floating countdown)
 * - StickyFinishBar (sticky bottom bar)
 * - FinishConfirmationSheet (summary before save)
 * - ExercisePickerSheet (bottom sheet exercise picker)
 * - PRCelebration (confetti overlay)
 *
 * All state lives in useActiveWorkoutStore. This screen only wires
 * store actions to component props and handles API calls.
 *
 * Requirements: 1.1, 1.3, 2.1, 3.3, 3.4, 4.1, 5.1, 8.1, 9.1, 9.2, 9.3, 10.1, 17.3, 18.3
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '../../utils/crossPlatformAlert';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useActiveWorkoutStore } from '../../store/activeWorkoutSlice';
import { useStore } from '../../store';
import { useWorkoutPreferencesStore } from '../../store/workoutPreferencesStore';
import api from '../../services/api';
import type { AxiosError } from 'axios';
import { spacing, typography, radius, shadows, letterSpacing as ls } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

// Phase 4 components
import { FloatingRestTimerBar } from '../../components/training/FloatingRestTimerBar';
import { StickyFinishBar } from '../../components/training/StickyFinishBar';
import { FinishConfirmationSheet } from '../../components/training/FinishConfirmationSheet';
import { ExercisePickerSheet } from '../../components/training/ExercisePickerSheet';
import { PRCelebration } from '../../components/training/PRCelebration';
import { RPEEducationSheet } from '../../components/training/RPEEducationSheet';
import { PlateCalculatorSheet } from '../../components/training/PlateCalculatorSheet';
import { HUExplainerModal } from '../../components/training/HUExplainerModal';
import { WorkoutSummaryModal } from '../../components/training/WorkoutSummaryModal';
import { ActiveWorkoutBody } from './ActiveWorkoutBody';

// Extracted hooks
import { useWorkoutSave } from '../../hooks/useWorkoutSave';
import { useWorkoutData } from '../../hooks/useWorkoutData';

// Utilities
import { formatDuration } from '../../utils/durationFormat';
import { haptic } from '../../utils/haptics';
import { computeWorkoutSummary } from '../../utils/workoutSummary';
import { stepWeight } from '../../utils/weightStepper';
import { aggregateVolume } from '../../utils/volumeAggregator';
import { hasUnsavedData } from '../../utils/setCompletionLogic';
import { sessionResponseToActiveExercises } from '../../utils/sessionEditConversion';
import { templateToActiveExercises } from '../../utils/templateConversion';
import { calculateExerciseStimulus, calculateSessionStimulus } from '../../utils/wnsCalculator';
import { generateRecommendations } from '../../utils/wnsRecommendations';
// Types
import type { WorkoutTemplateResponse } from '../../types/training';
import type { DashboardScreenProps } from '../../types/navigation';

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function ActiveWorkoutScreen({ route, navigation }: DashboardScreenProps<'ActiveWorkout'>) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const { mode, sessionId, templateId, sessionDate } = route.params ?? {};

  // ── Store ──
  const store = useActiveWorkoutStore();
  const unitSystem = useStore((s) => s.unitSystem);
  const rpeMode = useStore((s) => s.rpeMode);
  const profile = useStore((s) => s.profile);
  const showRpeRir = useWorkoutPreferencesStore((s) => s.showRpeColumn);
  const toggleRpeColumn = useWorkoutPreferencesStore((s) => s.toggleRpeColumn);
  const showRpeRirTooltip = useWorkoutPreferencesStore((s) => s.showRpeRirTooltip);
  const dismissRpeRirTooltip = useWorkoutPreferencesStore((s) => s.dismissRpeRirTooltip);

  // ── Local UI state ──
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [overflowMenuVisible, setOverflowMenuVisible] = useState(false);
  const [rpeEducationVisible, setRpeEducationVisible] = useState(false);
  const [huExplainerVisible, setHuExplainerVisible] = useState(false);
  const [huExplainerExercise, setHuExplainerExercise] = useState<string | undefined>();
  const [huExplainerHU, setHuExplainerHU] = useState<number | undefined>();
  const [workoutSummaryVisible, setWorkoutSummaryVisible] = useState(false);
  const [plateCalcVisible, setPlateCalcVisible] = useState(false);
  const [plateCalcWeightKg, setPlateCalcWeightKg] = useState(0);
  const [summaryHU, setSummaryHU] = useState<Record<string, number>>({});
  const [summaryRecs, setSummaryRecs] = useState<string[]>([]);
  const [initializing, setInitializing] = useState(true);
  const initialized = useRef(false);
  const isNavigatingAway = useRef(false);

  // ── Extracted hooks ──

  const { exerciseList, recentExercises, muscleGroupMap } = useWorkoutData({ store });

  // ── HU computation (recalculates on every set change) ──

  const sessionHU = React.useMemo(() => {
    const exerciseData = store.exercises
      .filter((ex) => !ex.skipped)
      .map((ex) => ({
        exerciseName: ex.exerciseName,
        sets: ex.sets
          .filter((s) => s.completed && s.setType !== 'warm-up')
          .map((s) => ({
            reps: parseInt(s.reps, 10) || 0,
            rpe: s.rpe ? parseFloat(s.rpe) : null,
            intensityPct: null as number | null,
          })),
      }));
    return calculateSessionStimulus(exerciseData, muscleGroupMap);
  }, [store.exercises, muscleGroupMap]);

  const sessionHURef = useRef(sessionHU);
  sessionHURef.current = sessionHU;

  const {
    saving,
    prData,
    prCelebrationVisible,
    finishSheetVisible,
    setFinishSheetVisible,
    handleFinishTap,
    handleConfirmFinish,
    handleSaveAsTemplate,
    handlePrDismiss,
  } = useWorkoutSave({
    store,
    navigation,
    unitSystem,
    elapsedSeconds,
    muscleGroupMap,
    sessionHURef,
    isNavigatingAway,
  });

  // ── Duration timer (Req 9.1, 9.2) ──

  useEffect(() => {
    if (!store.startedAt) return;
    const tick = () => {
      const start = new Date(store.startedAt).getTime();
      if (isNaN(start)) return;
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [store.startedAt]);

  // ── Mount: initialize workout ──

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        if (mode === 'edit' && sessionId) {
          try {
            const { data } = await api.get(`training/sessions/${sessionId}`);
            const exercises = sessionResponseToActiveExercises(data, unitSystem);
            store.startWorkout({ mode: 'edit', editSessionId: sessionId, templateExercises: exercises, sessionDate: data.session_date });
          } catch (err: unknown) {
            if ((err as AxiosError)?.response?.status === 404) {
              showAlert('Session Not Found', 'This workout session no longer exists. It may have been deleted.', [
                { text: 'Go Back', onPress: () => navigation.goBack() },
              ]);
              return;
            }
            throw err;
          }
        } else if (mode === 'template' && templateId) {
          try {
            const { data } = await api.get('training/user-templates');
            const templates: WorkoutTemplateResponse[] = data ?? [];
            const userMap = new Map(templates.map((t) => [String(t.id), t]));
            const tmpl = userMap.get(String(templateId));
            if (tmpl) {
              store.startWorkout({ mode: 'new', templateExercises: templateToActiveExercises(tmpl, unitSystem), sessionDate: sessionDate || undefined });
            } else {
              const { data: sys } = await api.get('training/templates');
              const sysTemplates: WorkoutTemplateResponse[] = sys ?? [];
              const sysMap = new Map(sysTemplates.map((t) => [String(t.id), t]));
              const sysTmpl = sysMap.get(String(templateId));
              if (sysTmpl) {
                store.startWorkout({ mode: 'new', templateExercises: templateToActiveExercises(sysTmpl, unitSystem), sessionDate: sessionDate || undefined });
              } else {
                showAlert('Template Not Found', 'The selected template could not be loaded. Starting a blank workout.');
                store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
              }
            }
          } catch (err) {
            console.error('[ActiveWorkout] Template load failed:', err);
            showAlert('Template Load Failed', 'Could not load the template. Starting a blank workout.');
            store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
          }
        } else if (mode === 'copy-last') {
          try {
            const { data } = await api.get('training/sessions', { params: { limit: 1 } });
            const last = data.items?.[0];
            if (last) {
              const exercises = sessionResponseToActiveExercises(last, unitSystem);
              exercises.forEach(ex => ex.sets.forEach(s => { s.completed = false; s.completedAt = null; }));
              store.startWorkout({ mode: 'new', templateExercises: exercises, sessionDate: sessionDate || undefined });
            } else {
              showAlert('No Previous Workout', 'No previous session found to copy. Starting a blank workout.');
              store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
            }
          } catch (err) {
            console.error('[ActiveWorkout] Copy last failed:', err);
            showAlert('Copy Failed', 'Could not load your last workout. Starting a blank workout.');
            store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
          }
        } else if (!store.isActive) {
          store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
        }
      } catch (err) {
        console.error('[ActiveWorkout] Init failed:', err);
        if (!store.isActive) {
          store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
        }
      } finally {
        setInitializing(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Back navigation guard (Android back button + iOS swipe) ──

  const hasActive = hasUnsavedData(store.exercises);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !hasActive });
  }, [hasActive, navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: { preventDefault: () => void; data: { action: { type: string } } }) => {
      if (isNavigatingAway.current) return;
      if (!hasUnsavedData(store.exercises)) return;
      e.preventDefault();
      showAlert('Unsaved Workout', 'You have unsaved data. What would you like to do?', [
        { text: 'Continue Workout', style: 'cancel' },
        {
          text: 'Save & Exit',
          onPress: () => handleConfirmFinish(),
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => { store.discardWorkout(); navigation.dispatch(e.data.action); },
        },
      ]);
    });
    return unsubscribe;
  }, [navigation, store.exercises, handleConfirmFinish]);

  // ── Handle exercise swap from picker navigation ──

  useEffect(() => {
    const swappedName = route.params?.swappedExerciseName;
    const swapTargetId = route.params?.swapTargetLocalId;
    if (swappedName && swapTargetId) {
      store.swapExercise(swapTargetId, swappedName);
      navigation.setParams({ swappedExerciseName: undefined, swapTargetLocalId: undefined });
    }
  }, [route.params?.swappedExerciseName, route.params?.swapTargetLocalId]);

  // ── Callbacks (declared before use — project rule) ──

  const handleDiscard = useCallback(() => {
    setOverflowMenuVisible(false);
    if (hasUnsavedData(store.exercises)) {
      showAlert('Discard Workout?', 'All progress will be lost.', [
        { text: 'Keep Workout', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => {
          store.discardWorkout();
          isNavigatingAway.current = true;
          navigation.navigate('DashboardHome');
        } },
      ]);
    } else {
      store.discardWorkout();
      isNavigatingAway.current = true;
      navigation.navigate('DashboardHome');
    }
  }, [store, navigation]);

  const handleAddExerciseFromPicker = useCallback((name: string) => {
    store.addExercise(name);
    setExercisePickerVisible(false);
  }, [store]);

  const handleWeightStep = useCallback((exerciseLocalId: string, setLocalId: string, direction: 'up' | 'down') => {
    const exercise = store.exercises.find((e) => e.localId === exerciseLocalId);
    const set = exercise?.sets.find((s) => s.localId === setLocalId);
    if (!set) return;
    const currentKg = parseFloat(set.weight) || 0;
    const newKg = stepWeight(currentKg, direction, unitSystem);
    store.updateSetField(exerciseLocalId, setLocalId, 'weight', String(newKg));
  }, [store, unitSystem]);

  const handleApplyOverload = useCallback((exerciseLocalId: string) => {
    const exercise = store.exercises.find((e) => e.localId === exerciseLocalId);
    const suggestion = store.overloadSuggestions[exercise?.exerciseName ?? ''];
    if (!suggestion || !exercise) return;
    // Apply to first uncompleted set
    const target = exercise.sets.find((s) => !s.completed);
    if (!target) return;
    store.updateSetField(exerciseLocalId, target.localId, 'weight', String(suggestion.suggested_weight_kg));
    store.updateSetField(exerciseLocalId, target.localId, 'reps', String(suggestion.suggested_reps));
  }, [store]);

  const handleSwapExercise = useCallback((exerciseLocalId: string) => {
    const exercise = store.exercises.find((e) => e.localId === exerciseLocalId);
    const mg = exercise ? muscleGroupMap[exercise.exerciseName] : undefined;
    navigation.push('ExercisePicker', {
      target: 'swapExercise',
      currentExerciseLocalId: exerciseLocalId,
      muscleGroup: mg,
    });
  }, [store.exercises, muscleGroupMap, navigation]);

  const handleGenerateWarmUp = useCallback((exerciseLocalId: string) => {
    const exercise = store.exercises.find((e) => e.localId === exerciseLocalId);
    if (!exercise) return;
    const workingSet = exercise.sets.find((s) => s.setType === 'normal' && s.weight !== '');
    const workingWeight = workingSet ? parseFloat(workingSet.weight) || 0 : 0;

    // Predictive fallback: use previous performance best weight
    const prevKey = exercise.exerciseName.toLowerCase();
    const prevPerf = store.previousPerformance[prevKey];
    const prevBest = prevPerf?.sets?.reduce((max: number, s: { weightKg?: number }) => Math.max(max, s.weightKg || 0), 0) || 0;

    if (workingWeight <= 0 && prevBest <= 0) {
      showAlert('Enter a working weight first.');
      return;
    }

    const { generateWarmUpSets } = require('../../utils/warmUpGenerator');
    const sets = workingWeight > 0
      ? generateWarmUpSets(workingWeight)
      : generateWarmUpSets(undefined, { previousBestWeight: prevBest });
    store.insertWarmUpSets(exerciseLocalId, sets);
  }, [store]);

  const handleRestTimerComplete = useCallback(() => {
    store.dismissRestTimer();
  }, [store]);

  const handleRestTimerDismiss = useCallback(() => {
    store.dismissRestTimer();
  }, [store]);

  const handleRpeEducationClose = useCallback(() => {
    setRpeEducationVisible(false);
  }, []);

  const handleRpeEducationDontShowAgain = useCallback(() => {
    dismissRpeRirTooltip();
    setRpeEducationVisible(false);
  }, [dismissRpeRirTooltip]);

  const handleOpenPlateCalculator = useCallback((weightKg: number) => {
    setPlateCalcWeightKg(weightKg);
    setPlateCalcVisible(true);
  }, []);

  // ── Derived state ──

  const summary = computeWorkoutSummary(store.exercises);
  const durationFormatted = formatDuration(elapsedSeconds);
  const volumeData = aggregateVolume(store.weeklyVolumeData, store.exercises, muscleGroupMap);

  const formattedDate = store.sessionDate
    ? new Date(store.sessionDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Today';

  const exerciseHUMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const ex of store.exercises) {
      if (ex.skipped) continue;
      const completedSets = ex.sets
        .filter((s) => s.completed && s.setType !== 'warm-up')
        .map((s) => ({
          reps: parseInt(s.reps, 10) || 0,
          rpe: s.rpe ? parseFloat(s.rpe) : null,
          intensityPct: null as number | null,
        }));
      if (completedSets.length > 0) {
        map[ex.localId] = calculateExerciseStimulus(completedSets);
      }
    }
    return map;
  }, [store.exercises]);

  // ── Render ──

  if (initializing) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={c.accent.primary} />
          <Text style={[styles.loadingText, { color: c.text.secondary }]}>Loading workout…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
      {/* Header: date, duration, overflow menu */}
      <View style={[styles.topBar, { borderBottomColor: c.border.subtle }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.dateText, { color: c.accent.primary }]}>{formattedDate}</Text>
          <Text style={[styles.durationText, { color: c.text.secondary }]}>{durationFormatted}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setOverflowMenuVisible(!overflowMenuVisible)}
          accessibilityLabel="Workout options"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.overflowBtn, { color: c.text.muted }]}>•••</Text>
        </TouchableOpacity>
      </View>

      {/* Overflow menu */}
      {overflowMenuVisible && (
        <>
          <Pressable style={styles.overflowBackdrop} onPress={() => setOverflowMenuVisible(false)} />
          <View style={[styles.overflowMenu, { backgroundColor: c.bg.surfaceRaised, borderColor: c.border.default }]}>
            <TouchableOpacity
              style={styles.overflowMenuItem}
              onPress={() => { 
                const wasHidden = !showRpeRir;
                toggleRpeColumn(); 
                setOverflowMenuVisible(false);
                // Show education sheet on first enable
                if (wasHidden && showRpeRirTooltip) {
                  setRpeEducationVisible(true);
                }
              }}
              accessibilityLabel={showRpeRir ? 'Hide RPE/RIR column' : 'Show RPE/RIR column'}
              accessibilityRole="button"
            >
              <Text style={[styles.overflowMenuItemText, { color: c.text.primary }]}>
                {showRpeRir ? 'Hide RPE/RIR' : 'Show RPE/RIR'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.overflowMenuItem} onPress={handleDiscard}>
              <Text style={[styles.overflowMenuItemTextDanger, { color: c.semantic.negative }]}>Discard Workout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Body */}
      <ActiveWorkoutBody
        c={c}
        store={store}
        unitSystem={unitSystem}
        rpeMode={rpeMode}
        showRpeRir={showRpeRir}
        muscleGroupMap={muscleGroupMap}
        volumeData={volumeData}
        sessionHU={sessionHU}
        exerciseHUMap={exerciseHUMap}
        onHUPillPress={() => {
          setSummaryHU(sessionHU);
          setSummaryRecs(generateRecommendations(sessionHU, {}));
          setWorkoutSummaryVisible(true);
        }}
        onSwapExercise={handleSwapExercise}
        onGenerateWarmUp={handleGenerateWarmUp}
        onWeightStep={handleWeightStep}
        onApplyOverload={handleApplyOverload}
        onOpenExercisePicker={() => setExercisePickerVisible(true)}
        onShowRpeEducation={() => setRpeEducationVisible(true)}
        onShowHUExplainer={(name, hu) => {
          setHuExplainerExercise(name);
          setHuExplainerHU(hu);
          setHuExplainerVisible(true);
        }}
        onOpenPlateCalculator={handleOpenPlateCalculator}
        profile={profile}
      />

      {/* Bottom overlay stack */}
      <FloatingRestTimerBar
        durationSeconds={store.restTimerDuration}
        isActive={store.restTimerActive}
        exerciseName={store.restTimerExerciseName}
        onComplete={handleRestTimerComplete}
        onDismiss={handleRestTimerDismiss}
      />

      <StickyFinishBar
        exerciseCount={summary.exerciseCount}
        setCount={summary.setCount}
        durationFormatted={durationFormatted}
        onFinish={() => { haptic.heavy(); handleFinishTap(); }}
        loading={saving}
        disabled={saving}
      />

      {/* Bottom sheets */}
      <ExercisePickerSheet
        visible={exercisePickerVisible}
        onSelect={handleAddExerciseFromPicker}
        onClose={() => setExercisePickerVisible(false)}
        exercises={exerciseList}
        recentExercises={recentExercises}
      />

      <FinishConfirmationSheet
        visible={finishSheetVisible}
        summary={summary}
        prs={prData}
        onConfirm={handleConfirmFinish}
        onSaveAsTemplate={handleSaveAsTemplate}
        onCancel={() => setFinishSheetVisible(false)}
      />

      <RPEEducationSheet
        visible={rpeEducationVisible}
        onClose={handleRpeEducationClose}
        onDontShowAgain={handleRpeEducationDontShowAgain}
      />

      {/* PR Celebration overlay */}
      <PRCelebration
        prs={prData}
        visible={prCelebrationVisible}
        onDismiss={handlePrDismiss}
      />

      {/* HU Explainer modal */}
      <HUExplainerModal
        visible={huExplainerVisible}
        exerciseName={huExplainerExercise}
        currentHU={huExplainerHU}
        onClose={() => setHuExplainerVisible(false)}
      />

      {/* Workout Summary modal (post-workout) */}
      <WorkoutSummaryModal
        visible={workoutSummaryVisible}
        durationFormatted={durationFormatted}
        totalSets={summary.setCount}
        huByMuscle={summaryHU}
        recommendations={summaryRecs}
        onClose={() => setWorkoutSummaryVisible(false)}
        onShowExplainer={() => {
          setWorkoutSummaryVisible(false);
          setHuExplainerExercise(undefined);
          setHuExplainerHU(undefined);
          setHuExplainerVisible(true);
        }}
      />

      {/* Plate Calculator */}
      <PlateCalculatorSheet
        weightKg={plateCalcWeightKg}
        unitSystem={unitSystem}
        visible={plateCalcVisible}
        onClose={() => setPlateCalcVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.base },
  loadingCenter: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const },
  loadingText: { marginTop: spacing[3], fontSize: typography.size.sm },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: c.border.subtle,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  dateText: {
    color: c.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  durationText: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    fontVariant: ['tabular-nums'],
  },
  overflowBtn: {
    color: c.text.muted,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    paddingHorizontal: spacing[2],
    letterSpacing: ls.wider,
  },

  overflowBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  overflowMenu: {
    position: 'absolute',
    top: 56,
    right: spacing[4],
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border.default,
    zIndex: 100,
    ...shadows.md,
    minWidth: 180,
  },
  overflowMenuItem: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  overflowMenuItemTextDanger: {
    color: c.semantic.negative,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  overflowMenuItemText: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
});
