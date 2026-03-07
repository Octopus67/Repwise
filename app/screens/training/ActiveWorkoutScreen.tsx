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
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { showAlert } from '../../utils/crossPlatformAlert';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useActiveWorkoutStore } from '../../store/activeWorkoutSlice';
import { useStore } from '../../store';
import { useWorkoutPreferencesStore } from '../../store/workoutPreferencesStore';
import api from '../../services/api';
import { colors, spacing, typography, radius, shadows, letterSpacing as ls } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';

// Phase 4 components
import { VolumePills } from '../../components/training/VolumePills';
import { ExerciseCardPremium } from '../../components/training/ExerciseCardPremium';
import { FloatingRestTimerBar } from '../../components/training/FloatingRestTimerBar';
import { StickyFinishBar } from '../../components/training/StickyFinishBar';
import { FinishConfirmationSheet } from '../../components/training/FinishConfirmationSheet';
import { ExercisePickerSheet } from '../../components/training/ExercisePickerSheet';
import { PRCelebration } from '../../components/training/PRCelebration';
import { RPEEducationSheet } from '../../components/training/RPEEducationSheet';

// Utilities
import { formatDuration } from '../../utils/durationFormat';
import { computeWorkoutSummary } from '../../utils/workoutSummary';
import { stepWeight } from '../../utils/weightStepper';
import { aggregateVolume } from '../../utils/volumeAggregator';
import { hasUnsavedData } from '../../utils/setCompletionLogic';
import { activeExercisesToPayload } from '../../utils/sessionEditConversion';
import { sessionResponseToActiveExercises } from '../../utils/sessionEditConversion';
import { templateToActiveExercises } from '../../utils/templateConversion';
// Types
import type { PreviousPerformanceData, PersonalRecordResponse } from '../../types/training';
import type { WorkoutSummaryResult } from '../../utils/workoutSummary';

import Animated from 'react-native-reanimated';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';

// ─── Staggered entrance wrapper ──────────────────────────────────────────────

function ExerciseCardWrapper({ children, index }: { children: React.ReactNode; index: number }) {
  const entranceStyle = useStaggeredEntrance(index, 60);
  return <Animated.View style={entranceStyle}>{children}</Animated.View>;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function ActiveWorkoutScreen({ route, navigation }: any) {
  const c = useThemeColors();
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
  const [saving, setSaving] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [finishSheetVisible, setFinishSheetVisible] = useState(false);
  const [prCelebrationVisible, setPrCelebrationVisible] = useState(false);
  const [prData, setPrData] = useState<PersonalRecordResponse[]>([]);
  const [overflowMenuVisible, setOverflowMenuVisible] = useState(false);
  const [rpeEducationVisible, setRpeEducationVisible] = useState(false);
  const [exerciseList, setExerciseList] = useState<string[]>([]);
  const [recentExercises, setRecentExercises] = useState<string[]>([]);
  const [muscleGroupMap, setMuscleGroupMap] = useState<Record<string, string>>({});
  const initialized = useRef(false);
  const isNavigatingAway = useRef(false);

  // ── Duration timer (Req 9.1, 9.2) ──

  useEffect(() => {
    if (!store.startedAt) return;
    const tick = () => {
      const start = new Date(store.startedAt).getTime();
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
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
          const { data } = await api.get(`training/sessions/${sessionId}`);
          const exercises = sessionResponseToActiveExercises(data, unitSystem);
          store.startWorkout({ mode: 'edit', editSessionId: sessionId, templateExercises: exercises, sessionDate: data.session_date });
        } else if (mode === 'template' && templateId) {
          try {
            const { data } = await api.get('training/user-templates');
            const tmpl = data.find?.((t: any) => t.id === templateId);
            if (tmpl) {
              store.startWorkout({ mode: 'new', templateExercises: templateToActiveExercises(tmpl, unitSystem), sessionDate: sessionDate || undefined });
            } else {
              const { data: sys } = await api.get('training/templates');
              const sysTmpl = sys.find?.((t: any) => t.id === templateId);
              if (sysTmpl) {
                store.startWorkout({ mode: 'new', templateExercises: templateToActiveExercises(sysTmpl, unitSystem), sessionDate: sessionDate || undefined });
              } else {
                store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
              }
            }
          } catch {
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
              store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
            }
          } catch {
            store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
          }
        } else if (!store.isActive) {
          store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
        }
      } catch {
        if (!store.isActive) {
          store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch batch data on mount: previous performance, overload, volume, exercises ──

  useEffect(() => {
    const names = store.exercises.map((e) => e.exerciseName).filter(Boolean);
    if (names.length === 0) return;

    // Batch previous performance
    const uncachedPrev = names.filter((n) => !(n.toLowerCase() in store.previousPerformance));
    if (uncachedPrev.length > 0) {
      api.post('training/previous-performance/batch', { exercise_names: uncachedPrev.slice(0, 20) })
        .then(({ data }) => {
          if (!data.results) return;
          const mapped: Record<string, PreviousPerformanceData | null> = {};
          for (const [key, val] of Object.entries(data.results)) {
            if (val) {
              const v = val as any;
              mapped[key.toLowerCase()] = {
                exerciseName: v.exercise_name,
                sessionDate: v.session_date,
                sets: v.sets.map((s: any) => ({ weightKg: s.weight_kg, reps: s.reps, rpe: s.rpe })),
              };
            } else {
              mapped[key.toLowerCase()] = null;
            }
          }
          store.setPreviousPerformance(mapped);
        })
        .catch(() => {});
    }

    // Batch overload suggestions
    api.post('training/exercises/batch-overload-suggestions', { exercise_names: names.slice(0, 20) })
      .then(({ data }) => {
        if (data.suggestions) store.setOverloadSuggestions(data.suggestions);
      })
      .catch(() => {});

    // Weekly volume
    const monday = getWeekMonday();
    api.get('training/analytics/muscle-volume', { params: { week_start: monday } })
      .then(({ data }) => {
        if (Array.isArray(data)) store.setWeeklyVolumeData(data);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.exercises.length]);

  // ── Fetch exercise list + muscle group map for picker and volume ──

  useEffect(() => {
    api.get('training/exercises')
      .then(({ data }) => {
        if (!Array.isArray(data)) return;
        setExerciseList(data.map((e: any) => e.name).filter(Boolean));
        const map: Record<string, string> = {};
        for (const ex of data) {
          if (ex.name && ex.muscle_group) map[ex.name] = ex.muscle_group;
        }
        setMuscleGroupMap(map);
      })
      .catch(() => {});

    // Recent exercises
    api.get('training/sessions', { params: { limit: 5 } })
      .then(({ data }) => {
        const sessions = data.items ?? data ?? [];
        const names = new Set<string>();
        for (const s of sessions) {
          for (const ex of s.exercises ?? []) {
            if (ex.exercise_name) names.add(ex.exercise_name);
          }
        }
        setRecentExercises(Array.from(names).slice(0, 10));
      })
      .catch(() => {});
  }, []);

  // ── Back navigation guard ──

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      // Skip guard when we intentionally navigated away (discard / finish)
      if (isNavigatingAway.current) return;
      if (!hasUnsavedData(store.exercises)) return;
      e.preventDefault();
      showAlert('Unsaved Workout', 'You have unsaved data. What would you like to do?', [
        { text: 'Keep Workout', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => { store.discardWorkout(); navigation.dispatch(e.data.action); } },
      ]);
    });
    return unsubscribe;
  }, [navigation, store.exercises]);

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
    if (!workingSet) {
      showAlert('Enter a working weight first.');
      return;
    }
    const { generateWarmUpSets } = require('../../utils/warmUpGenerator');
    const sets = generateWarmUpSets(parseFloat(workingSet.weight) || 0);
    store.insertWarmUpSets(exerciseLocalId, sets);
  }, [store]);

  const handleFinishTap = useCallback(() => {
    if (saving) return;
    const completedSets = store.exercises.flatMap((e) => e.sets).filter((s) => s.completed);
    if (completedSets.length === 0) {
      showAlert('No Completed Sets', 'Complete at least one set to save.');
      return;
    }
    setFinishSheetVisible(true);
  }, [store, saving]);

  const handleConfirmFinish = useCallback(async () => {
    setSaving(true);
    try {
      const payload = store.finishWorkout();

      let response: any;
      if (store.mode === 'edit' && store.editSessionId) {
        response = await api.put(`training/sessions/${store.editSessionId}`, payload);
      } else {
        response = await api.post('training/sessions', payload);
      }

      setFinishSheetVisible(false);

      // Prepare exercise breakdown data
      const exerciseBreakdown = store.exercises
        .filter(ex => !ex.skipped)
        .map(ex => {
          const completedSets = ex.sets.filter(s => s.completed && s.setType !== 'warm-up');
          let bestSet = null;
          
          if (completedSets.length > 0) {
            // Find best set by volume (weight × reps)
            bestSet = completedSets.reduce((best, current) => {
              const currentVolume = (parseFloat(current.weight) || 0) * (parseInt(current.reps, 10) || 0);
              const bestVolume = (parseFloat(best.weight) || 0) * (parseInt(best.reps, 10) || 0);
              return currentVolume > bestVolume ? current : best;
            });
          }

          return {
            exerciseName: ex.exerciseName,
            setsCompleted: completedSets.length,
            bestSet: bestSet ? { weight: bestSet.weight, reps: bestSet.reps } : null,
          };
        });

      // Navigate to WorkoutSummary
      const prs: PersonalRecordResponse[] = response.data?.personal_records ?? [];
      store.discardWorkout();
      isNavigatingAway.current = true;
      
      navigation.navigate('WorkoutSummary', {
        summary,
        duration: elapsedSeconds,
        personalRecords: prs,
        exerciseBreakdown,
      });
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Could not save workout. Please try again.';
      showAlert('Save Failed', errorMessage);
    } finally {
      setSaving(false);
    }
  }, [store, navigation]);

  const handleSaveAsTemplate = useCallback(async () => {
    const payload = store.finishWorkout();
    const templateName = `Workout - ${store.sessionDate || new Date().toLocaleDateString('en-CA')}`;
    try {
      await api.post('training/user-templates', { name: templateName, exercises: payload.exercises });
      showAlert('Template Saved', `"${templateName}" saved.`);
    } catch {
      showAlert('Error', 'Could not save template.');
    }
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

  // ── Derived state ──

  const summary = computeWorkoutSummary(store.exercises);
  const durationFormatted = formatDuration(elapsedSeconds);
  const volumeData = aggregateVolume(store.weeklyVolumeData, store.exercises, muscleGroupMap);

  const formattedDate = store.sessionDate
    ? new Date(store.sessionDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Today';

  // ── Render ──

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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Volume pills */}
        <VolumePills muscleVolumes={volumeData} />

        {/* Exercise cards */}
        {store.exercises.map((exercise, idx) => {
          const prevKey = exercise.exerciseName.toLowerCase();
          const prevPerf = store.previousPerformance[prevKey] ?? null;
          const overload = store.overloadSuggestions[exercise.exerciseName] ?? null;

          return (
            <ExerciseCardWrapper key={exercise.localId} index={idx}>
              <ExerciseCardPremium
              exercise={exercise}
              previousPerformance={prevPerf}
              overloadSuggestion={overload}
              unitSystem={unitSystem}
              showRpeRir={showRpeRir}
              rpeMode={rpeMode}
              onSwap={() => handleSwapExercise(exercise.localId)}
              onSkip={() => store.toggleExerciseSkip(exercise.localId)}
              onGenerateWarmUp={() => handleGenerateWarmUp(exercise.localId)}
              onRemove={() => store.removeExercise(exercise.localId)}
              onAddSet={() => store.addSet(exercise.localId)}
              onRemoveSet={(setLocalId) => store.removeSet(exercise.localId, setLocalId)}
              onReorder={() => {}}
              onUpdateSetField={(setLocalId, field, value) =>
                store.updateSetField(exercise.localId, setLocalId, field, value)
              }
              onToggleSetCompleted={(setLocalId) => {
                const result = store.toggleSetCompleted(exercise.localId, setLocalId);
                if (result.validationError) {
                  showAlert('Missing Fields', result.validationError);
                }
              }}
              onCopyPreviousToSet={(setLocalId) =>
                store.copyPreviousToSet(exercise.localId, setLocalId)
              }
              onWeightStep={(setLocalId, direction) =>
                handleWeightStep(exercise.localId, setLocalId, direction)
              }
              onApplyOverload={() => handleApplyOverload(exercise.localId)}
              onShowRpeEducation={() => setRpeEducationVisible(true)}
              />
            </ExerciseCardWrapper>
          );
        })}

        {/* Add Exercise button */}
        <TouchableOpacity
          style={[styles.addExerciseBtn, { backgroundColor: c.bg.surface, borderColor: c.border.default }]}
          onPress={() => setExercisePickerVisible(true)}
          accessibilityLabel="Add exercise"
          accessibilityRole="button"
        >
          <Text style={[styles.addExerciseText, { color: c.accent.primary }]}>+ Add Exercise</Text>
        </TouchableOpacity>

        {/* Bottom spacer for sticky bars */}
        <View style={{ height: 140 }} />
      </ScrollView>

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
        onFinish={handleFinishTap}
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
        onDismiss={() => setPrCelebrationVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function getWeekMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return monday.toISOString().split('T')[0];
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  dateText: {
    color: colors.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  durationText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    fontVariant: ['tabular-nums'],
  },
  overflowBtn: {
    color: colors.text.muted,
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
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    zIndex: 100,
    ...shadows.md,
    minWidth: 180,
  },
  overflowMenuItem: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  overflowMenuItemTextDanger: {
    color: colors.semantic.negative,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  overflowMenuItemText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing[4], paddingBottom: spacing[4] },

  addExerciseBtn: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  addExerciseText: {
    color: colors.accent.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
});
