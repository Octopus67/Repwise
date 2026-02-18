/**
 * ActiveWorkoutScreen — Full-screen workout logging interface
 *
 * Replaces the old AddTrainingModal with a push-navigation screen.
 * Implements: exercise cards with set rows, inline previous performance,
 * set completion with haptics + PR detection + rest timer, finish/discard
 * flow, superset grouping, and crash recovery support.
 *
 * Tasks: 16.1–16.5, 7.1–7.4, 8.1–8.3
 */

import { useEffect, useState, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useActiveWorkoutStore } from '../../store/activeWorkoutSlice';
import { useStore } from '../../store';
import { useWorkoutPreferencesStore } from '../../store/workoutPreferencesStore';
import api from '../../services/api';
import { colors, spacing, typography, radius, shadows, motion, letterSpacing as ls } from '../../theme/tokens';

// Components
import { DurationTimer } from '../../components/training/DurationTimer';
import { RestTimerOverlay } from '../../components/training/RestTimerOverlay';
import { RestTimerBar } from '../../components/training/RestTimerBar';
import { PRBanner } from '../../components/training/PRBanner';
import { SetTypeSelector } from '../../components/training/SetTypeSelector';
import { RPEPicker } from '../../components/training/RPEPicker';
import { RPEBadge } from '../../components/training/RPEBadge';
import { TypeBadge } from '../../components/training/TypeBadge';
import { Tooltip } from '../../components/common/Tooltip';
import { OverloadSuggestionBadge } from '../../components/training/OverloadSuggestionBadge';
import { VolumeIndicatorPill } from '../../components/training/VolumeIndicatorPill';
import { ExerciseDetailSheet } from '../../components/training/ExerciseDetailSheet';
import { FinishBar } from '../../components/training/FinishBar';
import { ConfirmationSheet } from '../../components/training/ConfirmationSheet';
import { ExerciseContextMenu } from '../../components/training/ExerciseContextMenu';
import { WarmUpSuggestion } from '../../components/training/WarmUpSuggestion';
import { getDisplayValue } from '../../utils/rpeConversion';

// Utilities
import { formatPreviousPerformance } from '../../utils/previousPerformanceFormat';
import { hasUnsavedData } from '../../utils/setCompletionLogic';
import { shouldStartRestTimer } from '../../utils/supersetLogic';
import { getRestDurationV2 } from '../../utils/restDurationV2';
import { calculateWorkingVolume } from '../../utils/volumeCalculation';
import { formatDuration } from '../../utils/durationFormat';
import { sessionResponseToActiveExercises } from '../../utils/sessionEditConversion';
import { templateToActiveExercises } from '../../utils/templateConversion';
import { activeExercisesToPayload } from '../../utils/sessionEditConversion';
import { convertWeight } from '../../utils/unitConversion';
import { calculateSetProgress } from '../../utils/setProgressCalculator';
import { shouldShowTypeBadge } from '../../utils/rpeBadgeColor';
import { getNextField, FieldName } from '../../utils/keyboardAdvanceLogic';

// Types
import type { ActiveExercise, ActiveSet, SetType, PreviousPerformanceData } from '../../types/training';
import type { Exercise } from '../../types/exercise';

// ─── Rest Timer State Type ───────────────────────────────────────────────────

interface RestTimerState {
  active: boolean;
  remaining: number;
  paused: boolean;
  completed: boolean;
  duration: number;
}

const INITIAL_REST_TIMER_STATE: RestTimerState = {
  active: false,
  remaining: 0,
  paused: false,
  completed: false,
  duration: 0,
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function ActiveWorkoutScreen({ route, navigation }: any) {
  const { mode, sessionId, templateId, sessionDate } = route.params ?? {};

  // Store state
  const store = useActiveWorkoutStore();
  const unitSystem = useStore((s) => s.unitSystem);
  const rpeMode = useStore((s) => s.rpeMode);
  const profile = useStore((s) => s.profile);
  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';
  const showRpeColumn = useWorkoutPreferencesStore((s) => s.showRpeColumn);

  // Local UI state
  const [saving, setSaving] = useState(false);
  const [prBannerVisible, setPrBannerVisible] = useState(false);
  const [prBannerData, setPrBannerData] = useState<Array<{ type: 'weight' | 'reps' | 'volume' | 'e1rm'; exerciseName: string; value: string }>>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const initialized = useRef(false);

  // Rest timer state (8.1 — floating bar instead of overlay)
  const [restTimerState, setRestTimerState] = useState<RestTimerState>(INITIAL_REST_TIMER_STATE);
  const [expandedTimerVisible, setExpandedTimerVisible] = useState(false);
  const restTimerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Confirmation sheet state (8.2)
  const [confirmationVisible, setConfirmationVisible] = useState(false);

  // Overflow menu state (8.3)
  const [overflowMenuVisible, setOverflowMenuVisible] = useState(false);

  // Intelligence layer state (4.7)
  const [muscleGroupMap, setMuscleGroupMap] = useState<Record<string, string>>({});
  const [volumeSetCounts, setVolumeSetCounts] = useState<Record<string, number>>({});

  // Exercise detail sheet state (5.3)
  const [exerciseCache, setExerciseCache] = useState<Record<string, Exercise>>({});
  const [detailSheetExercise, setDetailSheetExercise] = useState<Exercise | null>(null);
  const [detailSheetVisible, setDetailSheetVisible] = useState(false);

  // Elapsed time for FinishBar
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Exercise context menu state (10.1)
  const [contextMenuExerciseId, setContextMenuExerciseId] = useState<string | null>(null);

  // Per-exercise notes visibility (10.4)
  const [notesVisibleMap, setNotesVisibleMap] = useState<Record<string, boolean>>({});

  // ScrollView ref for auto-scroll (11.3)
  const scrollViewRef = useRef<ScrollView>(null);
  const setRowPositions = useRef<Record<string, number>>({});

  // Keyboard auto-advance refs (10.5)
  const inputRefs = useRef<Record<string, Record<string, TextInput | null>>>({});

  // ── Elapsed time ticker for FinishBar ────────────────────────────────────

  useEffect(() => {
    if (!store.startedAt) return;
    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - new Date(store.startedAt!).getTime()) / 1000));
    };
    tick();
    const id = setInterval(tick, 10000); // update every 10s is enough for "X min"
    return () => clearInterval(id);
  }, [store.startedAt]);

  // ── Rest timer countdown (8.1) ──────────────────────────────────────────

  useEffect(() => {
    if (!restTimerState.active || restTimerState.paused || restTimerState.completed) {
      if (restTimerIntervalRef.current) {
        clearInterval(restTimerIntervalRef.current);
        restTimerIntervalRef.current = null;
      }
      return;
    }

    restTimerIntervalRef.current = setInterval(() => {
      setRestTimerState((prev) => {
        if (prev.remaining <= 1) {
          return { ...prev, remaining: 0, completed: true };
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);

    return () => {
      if (restTimerIntervalRef.current) {
        clearInterval(restTimerIntervalRef.current);
        restTimerIntervalRef.current = null;
      }
    };
  }, [restTimerState.active, restTimerState.paused, restTimerState.completed]);

  // Auto-dismiss rest timer bar 3s after completion
  useEffect(() => {
    if (!restTimerState.completed) return;
    const timeout = setTimeout(() => {
      setRestTimerState(INITIAL_REST_TIMER_STATE);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [restTimerState.completed]);

  // ── Mount: initialize workout based on mode ──────────────────────────────

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
            const { data } = await api.get(`training/user-templates`);
            const tmpl = data.find?.((t: any) => t.id === templateId);
            if (tmpl) {
              const exercises = templateToActiveExercises(tmpl, unitSystem);
              store.startWorkout({ mode: 'new', templateExercises: exercises, sessionDate: sessionDate || undefined });
            } else {
              // Try system templates
              const { data: sysTmpls } = await api.get('training/templates');
              const sysTmpl = sysTmpls.find?.((t: any) => t.id === templateId);
              if (sysTmpl) {
                const exercises = templateToActiveExercises(sysTmpl, unitSystem);
                store.startWorkout({ mode: 'new', templateExercises: exercises, sessionDate: sessionDate || undefined });
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
            const lastSession = data.items?.[0];
            if (lastSession) {
              const exercises = sessionResponseToActiveExercises(lastSession, unitSystem);
              exercises.forEach(ex => ex.sets.forEach(s => { s.completed = false; s.completedAt = null; }));
              store.startWorkout({ mode: 'new', templateExercises: exercises, sessionDate: sessionDate || undefined });
            } else {
              store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
            }
          } catch {
            store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
          }
        } else {
          if (!store.isActive) {
            store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
          }
        }
      } catch {
        if (!store.isActive) {
          store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
        }
      }
    })();
  }, []);

  // ── Fetch previous performance when exercises change ─────────────────────

  useEffect(() => {
    const names = store.exercises.map((e) => e.exerciseName).filter(Boolean);
    const uncached = names.filter((n) => !(n.toLowerCase() in store.previousPerformance));
    if (uncached.length === 0) return;

    (async () => {
      try {
        const { data } = await api.post('training/previous-performance/batch', {
          exercise_names: uncached.slice(0, 20),
        });
        if (data.results) {
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
        }
      } catch {
        // best-effort
      }
    })();
  }, [store.exercises.length]);

  // ── Back navigation interception ─────────────────────────────────────────

  // ── Handle exercise swap result from ExercisePicker (10.1) ───────────────

  useEffect(() => {
    const swappedName = route.params?.swappedExerciseName;
    const swapTargetId = route.params?.swapTargetLocalId;
    if (swappedName && swapTargetId) {
      store.swapExercise(swapTargetId, swappedName);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); } catch {}
      // Clear the params to prevent re-triggering
      navigation.setParams({ swappedExerciseName: undefined, swapTargetLocalId: undefined });
    }
  }, [route.params?.swappedExerciseName, route.params?.swapTargetLocalId]);

  // ── Fetch muscle group mappings for volume indicators (4.7) ──────────────

  useEffect(() => {
    const names = store.exercises.map((e) => e.exerciseName).filter(Boolean);
    const unmapped = names.filter((n) => !(n.toLowerCase() in muscleGroupMap));
    if (unmapped.length === 0) return;

    (async () => {
      try {
        const { data } = await api.get('training/exercises');
        if (data) {
          const mapped: Record<string, string> = { ...muscleGroupMap };
          for (const ex of data) {
            if (ex.name && ex.muscle_group) {
              mapped[ex.name.toLowerCase()] = ex.muscle_group.toLowerCase();
            }
          }
          setMuscleGroupMap(mapped);
        }
      } catch {
        // best-effort
      }
    })();
  }, [store.exercises.length]);

  // ── Compute muscle groups for current exercises ──────────────────────────

  const workoutMuscleGroups = store.exercises
    .map((e) => muscleGroupMap[e.exerciseName.toLowerCase()])
    .filter(Boolean);

  // ── Fetch exercise cache for detail sheet (5.3) ──────────────────────────

  useEffect(() => {
    if (Object.keys(exerciseCache).length > 0) return;
    (async () => {
      try {
        const { data } = await api.get('training/exercises');
        if (Array.isArray(data)) {
          const cache: Record<string, Exercise> = {};
          for (const ex of data) {
            if (ex.name) cache[ex.name.toLowerCase()] = ex;
          }
          setExerciseCache(cache);
        }
      } catch {
        // best-effort — detail sheet just won't have full data
      }
    })();
  }, []);

  const handleOpenExerciseDetail = useCallback((exerciseName: string) => {
    const cached = exerciseCache[exerciseName.toLowerCase()];
    if (cached) {
      setDetailSheetExercise(cached);
      setDetailSheetVisible(true);
    }
  }, [exerciseCache]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!hasUnsavedData(store.exercises)) return;
      e.preventDefault();
      Alert.alert('Unsaved Workout', 'You have unsaved data. What would you like to do?', [
        { text: 'Keep Workout', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => { store.discardWorkout(); navigation.dispatch(e.data.action); } },
      ]);
    });
    return unsubscribe;
  }, [navigation, store.exercises]);

  // ── Date picker ──────────────────────────────────────────────────────────

  const handleDatePress = useCallback(() => {
    Alert.prompt?.(
      'Session Date',
      'Enter date (YYYY-MM-DD):',
      (text) => { if (text) store.setSessionDate(text); },
      'plain-text',
      store.sessionDate,
    );
  }, [store.sessionDate]);

  // ── Set completion handler (16.3) — updated for rest timer bar (8.1) ─────

  const handleToggleSet = useCallback((exerciseLocalId: string, setLocalId: string, exerciseName: string) => {
    const result = store.toggleSetCompleted(exerciseLocalId, setLocalId);

    if (result.validationError) {
      Alert.alert('Missing Fields', result.validationError);
      return;
    }

    if (result.completed) {
      // Haptic feedback
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } catch {}

      // Client-side PR check against previous performance cache
      const exercise = store.exercises.find(e => e.localId === exerciseLocalId);
      const set = exercise?.sets.find(s => s.localId === setLocalId);
      if (set && exercise) {
        const prevKey = exerciseName.toLowerCase();
        const prevData = store.previousPerformance[prevKey];
        if (prevData) {
          const currentWeight = parseFloat(set.weight) || 0;
          const currentReps = parseInt(set.reps, 10) || 0;
          const prevMaxWeight = Math.max(...prevData.sets.map(s => convertWeight(s.weightKg, unitSystem)));
          if (currentWeight > prevMaxWeight && currentWeight > 0) {
            setPrBannerData([{ type: 'weight', exerciseName, value: `${currentWeight}${unitLabel} × ${currentReps}` }]);
            setPrBannerVisible(true);
          }
        }
      }

      // Rest timer — floating bar instead of overlay (8.1)
      if (shouldStartRestTimer(store.supersetGroups, exerciseLocalId)) {
        const restPrefs = profile?.preferences?.rest_timer;
        const dur = getRestDurationV2(exerciseName, [], restPrefs);
        setRestTimerState({
          active: true,
          remaining: dur,
          paused: false,
          completed: false,
          duration: dur,
        });
      }

      // Increment volume count for muscle group (4.7)
      const mg = muscleGroupMap[exerciseName.toLowerCase()];
      if (mg) {
        setVolumeSetCounts((prev) => ({ ...prev, [mg]: (prev[mg] ?? 0) + 1 }));
      }

      // Auto-scroll to next uncompleted set (11.3)
      setTimeout(() => {
        const allSets = store.exercises.flatMap(e => e.sets);
        const nextUncompleted = allSets.find(s => !s.completed && s.localId !== setLocalId);
        if (nextUncompleted) {
          const targetY = setRowPositions.current[nextUncompleted.localId];
          if (targetY != null && scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ y: Math.max(0, targetY - 100), animated: true });
          }
        }
      }, 100);
    }
  }, [store, unitSystem, unitLabel, profile, muscleGroupMap]);

  // ── Rest timer bar handlers (8.1) ────────────────────────────────────────

  const handleRestTimerSkip = useCallback(() => {
    setRestTimerState(INITIAL_REST_TIMER_STATE);
  }, []);

  const handleRestTimerExpand = useCallback(() => {
    setExpandedTimerVisible(true);
  }, []);

  const handleExpandedTimerDismiss = useCallback(() => {
    setExpandedTimerVisible(false);
    setRestTimerState(INITIAL_REST_TIMER_STATE);
  }, []);

  // ── Finish workout (8.2 — via ConfirmationSheet) ─────────────────────────

  const handleFinishTap = useCallback(() => {
    const completedSets = store.exercises.flatMap(e => e.sets).filter(s => s.completed);
    if (completedSets.length === 0) {
      Alert.alert('No Completed Sets', 'Complete at least one set to save.');
      return;
    }
    // Clear rest timer before showing confirmation
    setRestTimerState(INITIAL_REST_TIMER_STATE);
    setConfirmationVisible(true);
  }, [store]);

  const handleConfirm = useCallback(async (saveAsTemplate: boolean) => {
    setSaving(true);
    try {
      const exercisePayload = activeExercisesToPayload(store.exercises, unitSystem);

      // Build exercise_notes and skipped_exercises metadata
      const exerciseNotes: Record<string, string> = {};
      const skippedExercises: string[] = [];
      for (const ex of store.exercises) {
        if (ex.notes && ex.notes.trim()) {
          exerciseNotes[ex.exerciseName] = ex.notes;
        }
        if (ex.skipped) {
          skippedExercises.push(ex.exerciseName);
        }
      }

      const payload = {
        session_date: store.sessionDate,
        exercises: exercisePayload,
        start_time: store.startedAt || null,
        end_time: new Date().toISOString(),
        metadata: {
          ...(store.notes ? { notes: store.notes } : {}),
          ...(store.supersetGroups.length > 0 ? {
            superset_groups: store.supersetGroups.map(sg => ({
              id: sg.id,
              exercise_names: sg.exerciseLocalIds.map(lid => {
                const ex = store.exercises.find(e => e.localId === lid);
                return ex?.exerciseName ?? '';
              }),
            })),
          } : {}),
          ...(Object.keys(exerciseNotes).length > 0 ? { exercise_notes: exerciseNotes } : {}),
          ...(skippedExercises.length > 0 ? { skipped_exercises: skippedExercises } : {}),
        },
      };

      if (store.mode === 'edit' && store.editSessionId) {
        await api.put(`training/sessions/${store.editSessionId}`, payload);
      } else {
        await api.post('training/sessions', payload);
      }

      // Save as template if requested (exclude warm-up sets and skipped exercises)
      if (saveAsTemplate) {
        const templateExercises = store.exercises
          .filter(ex => !ex.skipped)
          .map(ex => ({
            exercise_name: ex.exerciseName,
            sets: ex.sets
              .filter(s => s.setType !== 'warm-up')
              .map(s => ({
                reps: parseInt(s.reps, 10) || 0,
                weight_kg: parseFloat(s.weight) || 0,
                rpe: s.rpe ? parseFloat(s.rpe) : null,
                set_type: s.setType,
              })),
          }));
        const templateName = `Workout - ${store.sessionDate || new Date().toISOString().slice(0, 10)}`;
        try {
          await api.post('training/user-templates', { name: templateName, exercises: templateExercises });
        } catch {
          // template save is best-effort
        }
      }

      store.discardWorkout();
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Save Failed', 'Could not save workout. Please try again.');
    } finally {
      setSaving(false);
      setConfirmationVisible(false);
    }
  }, [store, unitSystem, navigation]);

  const handleConfirmCancel = useCallback(() => {
    setConfirmationVisible(false);
  }, []);

  // ── Discard workout (8.3 — via overflow menu) ────────────────────────────

  const handleDiscard = useCallback(() => {
    setOverflowMenuVisible(false);
    if (hasUnsavedData(store.exercises)) {
      Alert.alert('Discard Workout?', 'All progress will be lost.', [
        { text: 'Keep Workout', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => { store.discardWorkout(); navigation.goBack(); } },
      ]);
    } else {
      store.discardWorkout();
      navigation.goBack();
    }
  }, [store, navigation]);

  // ── Add exercise ─────────────────────────────────────────────────────────

  const handleAddExercise = useCallback(() => {
    navigation.push('ExercisePicker', { target: 'activeWorkout' });
  }, [navigation]);

  // ── Copy from specific date (11.1) ───────────────────────────────────────

  const handleCopyFromDate = useCallback(() => {
    setOverflowMenuVisible(false);
    Alert.prompt?.(
      'Copy from Date',
      'Enter date (YYYY-MM-DD):',
      async (dateText) => {
        if (!dateText || !/^\d{4}-\d{2}-\d{2}$/.test(dateText.trim())) {
          Alert.alert('Invalid Date', 'Please enter a date in YYYY-MM-DD format.');
          return;
        }
        try {
          const { data } = await api.get('training/sessions', { params: { date: dateText.trim(), limit: 10 } });
          const sessions = data.items ?? data ?? [];
          if (!Array.isArray(sessions) || sessions.length === 0) {
            Alert.alert('No Sessions', 'No sessions found for this date.');
            return;
          }
          // Use the first session found
          const session = sessions[0];
          Alert.alert(
            'Replace Current Exercises?',
            'This will replace your current workout with exercises from the selected session.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Replace',
                onPress: () => {
                  const exercises = sessionResponseToActiveExercises(session, unitSystem);
                  exercises.forEach(ex => ex.sets.forEach(s => { s.completed = false; s.completedAt = null; }));
                  // Replace current exercises
                  store.discardWorkout();
                  store.startWorkout({ mode: 'new', templateExercises: exercises, sessionDate: store.sessionDate });
                },
              },
            ],
          );
        } catch {
          Alert.alert('Error', 'Could not fetch sessions. Please try again.');
        }
      },
      'plain-text',
      '',
    );
  }, [store, unitSystem]);

  // ── Exercise context menu handlers (10.1, 10.2, 10.4, 11.2) ─────────────

  const handleSwapExercise = useCallback((exerciseLocalId: string, exerciseName: string) => {
    const mg = muscleGroupMap[exerciseName.toLowerCase()] ?? undefined;
    navigation.push('ExercisePicker', {
      target: 'swapExercise',
      currentExerciseLocalId: exerciseLocalId,
      muscleGroup: mg,
    });
  }, [navigation, muscleGroupMap]);

  const handleToggleNotes = useCallback((exerciseLocalId: string) => {
    setNotesVisibleMap(prev => ({ ...prev, [exerciseLocalId]: !prev[exerciseLocalId] }));
  }, []);

  const handleWarmUpGenerate = useCallback((exerciseLocalId: string, sets: any[]) => {
    store.insertWarmUpSets(exerciseLocalId, sets);
  }, [store]);

  // ── Superset grouping (16.5) ─────────────────────────────────────────────

  const toggleExerciseSelect = useCallback((localId: string) => {
    setSelectedExercises(prev =>
      prev.includes(localId) ? prev.filter(id => id !== localId) : [...prev, localId]
    );
  }, []);

  const handleGroupSuperset = useCallback(() => {
    if (selectedExercises.length >= 2) {
      store.createSuperset(selectedExercises);
    }
    setSelectedExercises([]);
    setSelectMode(false);
  }, [selectedExercises, store]);

  const handleUngroupSuperset = useCallback((groupId: string) => {
    store.removeSuperset(groupId);
  }, [store]);

  const getSupersetGroupForExercise = useCallback((exerciseLocalId: string) => {
    return store.supersetGroups.find(sg => sg.exerciseLocalIds.includes(exerciseLocalId));
  }, [store.supersetGroups]);

  // ── Copy previous to set ─────────────────────────────────────────────────

  const handleCopyPrevious = useCallback((exerciseLocalId: string, setLocalId: string) => {
    store.copyPreviousToSet(exerciseLocalId, setLocalId);
  }, [store]);

  // ── Render ───────────────────────────────────────────────────────────────

  const isEditMode = store.mode === 'edit';
  const formattedDate = store.sessionDate
    ? new Date(store.sessionDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Today';

  // Compute completed set count for FinishBar
  const completedSetCount = store.exercises.flatMap(e => e.sets).filter(s => s.completed).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top Bar (8.3 — overflow menu replaces discard button) */}
      <View style={styles.topBar}>
        <View />
        <TouchableOpacity onPress={handleDatePress}>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setOverflowMenuVisible(!overflowMenuVisible)}>
          <Text style={styles.overflowBtn}>•••</Text>
        </TouchableOpacity>
      </View>

      {/* Overflow menu (8.3, 11.1) */}
      {overflowMenuVisible && (
        <>
          <Pressable style={styles.overflowBackdrop} onPress={() => setOverflowMenuVisible(false)} />
          <View style={styles.overflowMenu}>
            <TouchableOpacity style={styles.overflowMenuItem} onPress={handleCopyFromDate}>
              <Text style={styles.overflowMenuItemText}>Copy from Date</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.overflowMenuItem} onPress={handleDiscard}>
              <Text style={styles.overflowMenuItemTextDanger}>Discard Workout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <ScrollView ref={scrollViewRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Superset select mode bar */}
        {selectMode && (
          <View style={styles.selectBar}>
            <Text style={styles.selectBarText}>{selectedExercises.length} selected</Text>
            <TouchableOpacity
              style={[styles.groupBtn, selectedExercises.length < 2 && styles.groupBtnDisabled]}
              onPress={handleGroupSuperset}
              disabled={selectedExercises.length < 2}
            >
              <Text style={styles.groupBtnText}>Group as Superset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSelectMode(false); setSelectedExercises([]); }}>
              <Text style={styles.cancelSelectText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Volume Indicator Pills (4.7) */}
        <VolumeIndicatorPill
          muscleGroups={workoutMuscleGroups}
          completedSetCounts={volumeSetCounts}
        />

        {/* 7.1 — Info banner REMOVED. Tooltips added to RPE header and first set row instead. */}

        {/* Exercise Cards */}
        {store.exercises.map((exercise, exIdx) => {
          const supersetGroup = getSupersetGroupForExercise(exercise.localId);
          const prevData = store.previousPerformance[exercise.exerciseName.toLowerCase()] ?? null;
          const setProgress = calculateSetProgress(exercise.sets);
          const isSkipped = exercise.skipped === true;
          const hasExistingWarmUp = exercise.sets.some(s => s.setType === 'warm-up');
          const workingWeight = prevData ? Math.max(...prevData.sets.map(s => s.weightKg), 0) : 0;

          return (
            <View key={exercise.localId}>
              {/* Superset header */}
              {supersetGroup && supersetGroup.exerciseLocalIds[0] === exercise.localId && (
                <View style={styles.supersetHeader}>
                  <View style={styles.supersetBracket} />
                  <Text style={styles.supersetLabel}>Superset</Text>
                  <TouchableOpacity onPress={() => handleUngroupSuperset(supersetGroup.id)}>
                    <Text style={styles.ungroupText}>Ungroup</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={[
                styles.exerciseCard,
                supersetGroup && styles.exerciseCardSuperset,
                isSkipped && styles.exerciseCardSkipped,
              ]}>
                {/* Exercise header (7.3, 7.4, 10.1, 10.2, 11.5) */}
                <View style={styles.exerciseHeader}>
                  {/* Drag handle (11.5) */}
                  <Text style={styles.dragHandle}>≡</Text>

                  {selectMode && (
                    <TouchableOpacity
                      style={[styles.selectCheckbox, selectedExercises.includes(exercise.localId) && styles.selectCheckboxActive]}
                      onPress={() => toggleExerciseSelect(exercise.localId)}
                    >
                      <Text style={styles.selectCheckboxText}>
                        {selectedExercises.includes(exercise.localId) ? '✓' : ''}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => handleOpenExerciseDetail(exercise.exerciseName)}
                    onLongPress={() => { setSelectMode(true); toggleExerciseSelect(exercise.localId); }}
                  >
                    <View style={styles.exerciseNameRow}>
                      <Text style={[
                        styles.exerciseName,
                        isSkipped && styles.exerciseNameSkipped,
                      ]}>{exercise.exerciseName}</Text>
                      {/* 7.3 — Set progress indicator */}
                      <Text style={[
                        styles.setProgressText,
                        setProgress.allComplete && styles.setProgressComplete,
                      ]}>
                        {setProgress.completed}/{setProgress.total} sets
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Notes icon (10.4) */}
                  <TouchableOpacity
                    onPress={() => handleToggleNotes(exercise.localId)}
                    style={styles.notesIconBtn}
                  >
                    <Text style={[
                      styles.notesIcon,
                      (exercise.notes && exercise.notes.trim()) && styles.notesIconActive,
                    ]}>📝</Text>
                  </TouchableOpacity>

                  {/* Context menu trigger (10.1) */}
                  <TouchableOpacity
                    onPress={() => setContextMenuExerciseId(
                      contextMenuExerciseId === exercise.localId ? null : exercise.localId
                    )}
                    style={styles.contextMenuBtn}
                  >
                    <Text style={styles.contextMenuDots}>•••</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => store.removeExercise(exercise.localId)}>
                    <Text style={styles.removeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Exercise Context Menu (10.1, 10.2, 10.4, 11.2) */}
                {contextMenuExerciseId === exercise.localId && (
                  <View style={styles.contextMenuContainer}>
                    <ExerciseContextMenu
                      visible={true}
                      isSkipped={isSkipped}
                      hasNotes={!!(exercise.notes && exercise.notes.trim())}
                      hasPreviousPerformance={!!prevData && !hasExistingWarmUp}
                      onSwap={() => handleSwapExercise(exercise.localId, exercise.exerciseName)}
                      onSkip={() => store.toggleExerciseSkip(exercise.localId)}
                      onUnskip={() => store.toggleExerciseSkip(exercise.localId)}
                      onAddNote={() => handleToggleNotes(exercise.localId)}
                      onGenerateWarmUp={() => {
                        if (prevData) {
                          const { generateWarmUpSets } = require('../../utils/warmUpGenerator');
                          const sets = generateWarmUpSets(workingWeight);
                          handleWarmUpGenerate(exercise.localId, sets);
                        }
                      }}
                      onDismiss={() => setContextMenuExerciseId(null)}
                    />
                  </View>
                )}

                {/* Warm-Up Suggestion (11.2) */}
                {prevData && !hasExistingWarmUp && workingWeight > 20 && (
                  <WarmUpSuggestion
                    workingWeightKg={workingWeight}
                    barWeightKg={20}
                    onGenerate={(sets) => handleWarmUpGenerate(exercise.localId, sets)}
                  />
                )}

                {/* Overload Suggestion Badge (4.7) */}
                <OverloadSuggestionBadge
                  exerciseName={exercise.exerciseName}
                  unitSystem={unitSystem}
                />

                {/* Set header row (7.1, 7.2) */}
                <View style={styles.setHeaderRow}>
                  <Text style={[styles.setHeaderCell, styles.setNumCol]}>#</Text>
                  {!!prevData && <Text style={[styles.setHeaderCell, styles.prevCol]}>Previous</Text>}
                  <Text style={[styles.setHeaderCell, styles.weightCol]}>{unitLabel}</Text>
                  <Text style={[styles.setHeaderCell, styles.repsCol]}>Reps</Text>
                  {showRpeColumn && (
                    <Tooltip tooltipId="rpe-intro" text="RPE measures how hard a set felt (6=easy, 10=max)">
                      <Text style={[styles.setHeaderCell, styles.rpeCol]}>RPE</Text>
                    </Tooltip>
                  )}
                  <Text style={[styles.setHeaderCell, styles.checkCol]}>✓</Text>
                </View>

                {/* Set rows (7.1, 7.2, 10.5) */}
                {exercise.sets.map((set, setIdx) => {
                  // Compute next row's weight ref key for keyboard advance (10.5)
                  const nextSet = exercise.sets[setIdx + 1];
                  const nextRowWeightRefKey = nextSet ? `${exercise.localId}-${nextSet.localId}-weight` : null;
                  // If last set in this exercise, try first set of next exercise
                  let crossExerciseNextRefKey: string | null = null;
                  if (!nextSet && exIdx < store.exercises.length - 1) {
                    const nextEx = store.exercises[exIdx + 1];
                    if (nextEx.sets.length > 0) {
                      crossExerciseNextRefKey = `${nextEx.localId}-${nextEx.sets[0].localId}-weight`;
                    }
                  }
                  const effectiveNextWeightRef = nextRowWeightRefKey || crossExerciseNextRefKey;

                  const setRow = (
                    <SetRow
                      key={set.localId}
                      set={set}
                      setIndex={setIdx}
                      exerciseLocalId={exercise.localId}
                      exerciseName={exercise.exerciseName}
                      prevData={prevData}
                      unitSystem={unitSystem}
                      rpeMode={rpeMode}
                      showPrevCol={!!prevData}
                      showRpeColumn={showRpeColumn}
                      onUpdateField={store.updateSetField}
                      onUpdateType={store.updateSetType}
                      onToggleComplete={handleToggleSet}
                      onCopyPrevious={handleCopyPrevious}
                      onRemoveSet={store.removeSet}
                      inputRefs={inputRefs}
                      nextRowWeightRefKey={effectiveNextWeightRef}
                      onLayoutCapture={(y) => {
                        setRowPositions.current[set.localId] = y;
                      }}
                    />
                  );

                  // 7.1 — Wrap first set row of first exercise in type tooltip
                  if (exIdx === 0 && setIdx === 0) {
                    return (
                      <Tooltip
                        key={`tooltip-${set.localId}`}
                        tooltipId="type-intro"
                        text="Long-press a set row to change type (warm-up, drop, AMRAP)"
                      >
                        {setRow}
                      </Tooltip>
                    );
                  }
                  return setRow;
                })}

                {/* Add Set button */}
                <TouchableOpacity style={styles.addSetBtn} onPress={() => store.addSet(exercise.localId)}>
                  <Text style={styles.addSetText}>+ Add Set</Text>
                </TouchableOpacity>

                {/* Per-exercise notes (10.4) */}
                {notesVisibleMap[exercise.localId] && (
                  <View style={styles.exerciseNotesContainer}>
                    <TextInput
                      style={styles.exerciseNotesInput}
                      value={exercise.notes || ''}
                      onChangeText={(text) => store.setExerciseNotes(exercise.localId, text)}
                      placeholder="Exercise notes (cues, pain notes, technique)..."
                      placeholderTextColor={colors.text.muted}
                      multiline
                      maxLength={500}
                    />
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* Add Exercise button */}
        <TouchableOpacity style={styles.addExerciseBtn} onPress={handleAddExercise}>
          <Text style={styles.addExerciseText}>+ Add Exercise</Text>
        </TouchableOpacity>

        {/* Notes */}
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            value={store.notes}
            onChangeText={store.setNotes}
            placeholder="Workout notes..."
            placeholderTextColor={colors.text.muted}
            multiline
          />
        </View>

        {/* Spacer for bottom bars */}
        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Rest Timer Bar (8.1 — floating above FinishBar) */}
      {restTimerState.active && (
        <RestTimerBar
          durationSeconds={restTimerState.duration}
          remainingSeconds={restTimerState.remaining}
          paused={restTimerState.paused}
          completed={restTimerState.completed}
          onSkip={handleRestTimerSkip}
          onExpand={handleRestTimerExpand}
        />
      )}

      {/* FinishBar (8.2 — sticky bottom, replaces old bottomBar) */}
      <FinishBar
        exerciseCount={store.exercises.length}
        completedSetCount={completedSetCount}
        elapsedSeconds={elapsedSeconds}
        saving={saving}
        isEditMode={isEditMode}
        onFinish={handleFinishTap}
      />

      {/* ConfirmationSheet (8.2) */}
      <ConfirmationSheet
        visible={confirmationVisible}
        exercises={store.exercises}
        startedAt={store.startedAt || ''}
        notes={store.notes}
        unitSystem={unitSystem}
        onConfirm={handleConfirm}
        onCancel={handleConfirmCancel}
      />

      {/* Rest Timer overlay — expanded view (8.1) */}
      <RestTimerOverlay
        durationSeconds={restTimerState.duration || 180}
        visible={expandedTimerVisible}
        onDismiss={handleExpandedTimerDismiss}
        onComplete={handleExpandedTimerDismiss}
      />

      {/* PR Banner overlay */}
      <PRBanner
        prs={prBannerData}
        visible={prBannerVisible}
        onDismiss={() => setPrBannerVisible(false)}
      />

      {/* Exercise Detail Sheet (5.3) */}
      <ExerciseDetailSheet
        exercise={detailSheetExercise}
        visible={detailSheetVisible}
        onDismiss={() => setDetailSheetVisible(false)}
      />
    </SafeAreaView>
  );
}


// ─── SetRow Sub-Component (7.2 — completed tint, RPE/Type badges, long-press) ─

interface SetRowProps {
  set: ActiveSet;
  setIndex: number;
  exerciseLocalId: string;
  exerciseName: string;
  prevData: PreviousPerformanceData | null;
  unitSystem: 'metric' | 'imperial';
  rpeMode: 'rpe' | 'rir';
  showPrevCol: boolean;
  showRpeColumn: boolean;
  onUpdateField: (exId: string, setId: string, field: 'weight' | 'reps' | 'rpe', value: string) => void;
  onUpdateType: (exId: string, setId: string, type: SetType) => void;
  onToggleComplete: (exId: string, setId: string, name: string) => void;
  onCopyPrevious: (exId: string, setId: string) => void;
  onRemoveSet: (exId: string, setId: string) => void;
  inputRefs: React.MutableRefObject<Record<string, Record<string, TextInput | null>>>;
  nextRowWeightRefKey: string | null;
  onLayoutCapture: (y: number) => void;
}

const SetRow = memo(function SetRow({
  set,
  setIndex,
  exerciseLocalId,
  exerciseName,
  prevData,
  unitSystem,
  rpeMode,
  showPrevCol,
  showRpeColumn,
  onUpdateField,
  onUpdateType,
  onToggleComplete,
  onCopyPrevious,
  onRemoveSet,
  inputRefs,
  nextRowWeightRefKey,
  onLayoutCapture,
}: SetRowProps) {
  const bgAnim = useRef(new Animated.Value(set.completed ? 1 : 0)).current;
  const [rpePickerVisible, setRpePickerVisible] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);

  useEffect(() => {
    Animated.timing(bgAnim, {
      toValue: set.completed ? 1 : 0,
      duration: motion.duration.default,
      useNativeDriver: false,
    }).start();
  }, [set.completed]);

  // 7.2 — Use positiveSubtle for completed rows
  const rowBg = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', colors.semantic.positiveSubtle],
  });

  const prevText = formatPreviousPerformance(prevData, setIndex, unitSystem);
  const rpeDisplayText = getDisplayValue(set.rpe, rpeMode);
  const rpeNumeric = parseFloat(set.rpe) || 0;

  // Keyboard auto-advance refs (10.5)
  const weightRefKey = `${exerciseLocalId}-${set.localId}-weight`;
  const repsRefKey = `${exerciseLocalId}-${set.localId}-reps`;
  const rpeRefKey = `${exerciseLocalId}-${set.localId}-rpe`;

  const registerRef = useCallback((key: string, ref: TextInput | null) => {
    if (!inputRefs.current[exerciseLocalId]) inputRefs.current[exerciseLocalId] = {};
    inputRefs.current[exerciseLocalId][key] = ref;
  }, [exerciseLocalId, inputRefs]);

  const handleSubmitEditing = useCallback((currentField: FieldName) => {
    const result = getNextField(currentField, showRpeColumn, {
      weight: set.weight,
      reps: set.reps,
      rpe: set.rpe,
    });

    if (result === 'weight' || result === 'reps' || result === 'rpe') {
      const refKey = `${exerciseLocalId}-${set.localId}-${result}`;
      const ref = inputRefs.current[exerciseLocalId]?.[refKey];
      ref?.focus();
    } else if (result === 'next-row' && nextRowWeightRefKey) {
      // Find the ref across all exercises
      for (const exRefs of Object.values(inputRefs.current)) {
        if (exRefs[nextRowWeightRefKey]) {
          exRefs[nextRowWeightRefKey]?.focus();
          return;
        }
      }
    }
  }, [exerciseLocalId, set.localId, set.weight, set.reps, set.rpe, showRpeColumn, nextRowWeightRefKey, inputRefs]);

  return (
    <Animated.View
      style={[styles.setRow, { backgroundColor: rowBg }]}
      onLayout={(e) => onLayoutCapture(e.nativeEvent.layout.y)}
    >
      <Text style={[styles.setCell, styles.setNumCol]}>{set.setNumber}</Text>

      {showPrevCol && (
        <TouchableOpacity
          style={styles.prevCol}
          onPress={() => prevData && onCopyPrevious(exerciseLocalId, set.localId)}
          disabled={!prevData}
        >
          <Text style={styles.prevText}>{prevText}</Text>
        </TouchableOpacity>
      )}

      {/* 7.4 — Weight with accent color + keyboard advance (10.5) */}
      <TextInput
        ref={(ref) => registerRef(weightRefKey, ref)}
        style={[styles.setInput, styles.weightCol, styles.weightInput]}
        value={set.weight}
        onChangeText={(v) => onUpdateField(exerciseLocalId, set.localId, 'weight', v)}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.text.muted}
        returnKeyType="next"
        onSubmitEditing={() => handleSubmitEditing('weight')}
      />

      {/* 7.4 — Reps with secondary color + keyboard advance (10.5) */}
      <TextInput
        ref={(ref) => registerRef(repsRefKey, ref)}
        style={[styles.setInput, styles.repsCol, styles.repsInput]}
        value={set.reps}
        onChangeText={(v) => onUpdateField(exerciseLocalId, set.localId, 'reps', v)}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.text.muted}
        returnKeyType={showRpeColumn ? 'next' : 'done'}
        onSubmitEditing={() => handleSubmitEditing('reps')}
      />

      {/* 7.2 — RPE: show RPEBadge when column enabled */}
      {showRpeColumn && (
        <TouchableOpacity
          style={[styles.rpeCol, { justifyContent: 'center', alignItems: 'center' }]}
          onPress={() => setRpePickerVisible(true)}
        >
          {rpeNumeric > 0 ? (
            <RPEBadge rpeValue={rpeNumeric} mode={rpeMode} />
          ) : (
            <Text style={[styles.rpeTapText, styles.rpePlaceholder]}>—</Text>
          )}
        </TouchableOpacity>
      )}

      {showRpeColumn && (
        <RPEPicker
          visible={rpePickerVisible}
          mode={rpeMode}
          onSelect={(value) => {
            onUpdateField(exerciseLocalId, set.localId, 'rpe', value);
            setRpePickerVisible(false);
          }}
          onDismiss={() => setRpePickerVisible(false)}
        />
      )}

      {/* 7.2 — Type: hidden by default, show TypeBadge for non-normal, long-press to change */}
      {shouldShowTypeBadge(set.setType) && (
        <TouchableOpacity
          style={styles.typeBadgeCol}
          onPress={() => setTypePickerVisible(true)}
        >
          <TypeBadge setType={set.setType} />
        </TouchableOpacity>
      )}

      {/* Long-press on the row area to reveal SetTypeSelector */}
      {typePickerVisible && (
        <View style={styles.typePickerOverlay}>
          <SetTypeSelector
            value={set.setType}
            onChange={(type) => {
              onUpdateType(exerciseLocalId, set.localId, type);
              setTypePickerVisible(false);
            }}
          />
        </View>
      )}

      <TouchableOpacity
        style={[styles.checkCol, styles.checkBtn, set.completed && styles.checkBtnCompleted]}
        onPress={() => onToggleComplete(exerciseLocalId, set.localId, exerciseName)}
        onLongPress={() => setTypePickerVisible(true)}
      >
        <Text style={[styles.checkText, set.completed && styles.checkTextCompleted]}>✓</Text>
      </TouchableOpacity>

      {/* Remove set — long press on set number */}
      {!set.completed && (
        <TouchableOpacity
          style={styles.removeSetBtn}
          onPress={() => onRemoveSet(exerciseLocalId, set.localId)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.removeSetText}>✕</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});


// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },

  // Top bar (8.3 — overflow menu replaces discard text)
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  dateText: {
    color: colors.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  overflowBtn: {
    color: colors.text.muted,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    paddingHorizontal: spacing[2],
    letterSpacing: ls.wider,
  },

  // Overflow menu (8.3)
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

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: spacing[4], paddingBottom: spacing[4] },

  // Select mode bar
  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    marginBottom: spacing[3],
  },
  selectBarText: { color: colors.text.secondary, fontSize: typography.size.sm, flex: 1 },
  groupBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  groupBtnDisabled: { opacity: 0.4 },
  groupBtnText: { color: colors.text.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  cancelSelectText: { color: colors.text.muted, fontSize: typography.size.sm },

  // Superset
  supersetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
    paddingLeft: spacing[2],
  },
  supersetBracket: {
    width: 3,
    height: 20,
    backgroundColor: colors.accent.primary,
    borderRadius: 2,
  },
  supersetLabel: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    flex: 1,
  },
  ungroupText: { color: colors.text.muted, fontSize: typography.size.xs },

  // Exercise card (7.4 — increased marginBottom)
  exerciseCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  exerciseCardSuperset: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.primary,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  // 7.3 — Exercise name + progress in a row
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  // 7.4 — Exercise name: lg + bold
  exerciseName: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  // 7.3 — Set progress text
  setProgressText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  setProgressComplete: {
    color: colors.semantic.positive,
  },
  removeBtn: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    paddingHorizontal: spacing[1],
    opacity: 0.6,
  },

  // Select checkbox
  selectCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[2],
  },
  selectCheckboxActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  selectCheckboxText: { color: colors.text.primary, fontSize: 12, fontWeight: typography.weight.bold },

  // Set header
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    marginBottom: spacing[1],
  },
  setHeaderCell: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
  },

  // Column widths
  setNumCol: { width: 24, textAlign: 'center' },
  prevCol: { flex: 0.8, paddingHorizontal: 2 },
  weightCol: { flex: 1.2, paddingHorizontal: 2 },
  repsCol: { flex: 0.7, paddingHorizontal: 2 },
  rpeCol: { width: 36, paddingHorizontal: 2 },
  checkCol: { width: 36, alignItems: 'center', justifyContent: 'center' },

  // Set row
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1],
    minHeight: 36,
  },
  setCell: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  prevText: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
  },
  setInput: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    textAlign: 'center',
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: 4,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    paddingHorizontal: 4,
    minHeight: 28,
  },
  // 7.4 — Weight values: accent primary + semibold
  weightInput: {
    color: colors.accent.primary,
    fontWeight: typography.weight.semibold,
  },
  // 7.4 — Rep values: secondary text color
  repsInput: {
    color: colors.text.secondary,
  },

  // RPE tappable field
  rpeTapText: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  rpePlaceholder: {
    color: colors.text.muted,
  },

  // 7.2 — Type badge column
  typeBadgeCol: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 7.2 — Type picker overlay for long-press
  typePickerOverlay: {
    position: 'absolute',
    right: 40,
    top: 0,
    zIndex: 50,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.sm,
  },

  // Checkmark
  checkBtn: {
    width: 36,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.bg.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnCompleted: {
    backgroundColor: colors.semantic.positiveSubtle,
    borderColor: colors.semantic.positive,
  },
  checkText: { color: colors.text.muted, fontSize: 11, fontWeight: typography.weight.medium },
  checkTextCompleted: { color: colors.semantic.positive },

  // Add set
  addSetBtn: {
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  addSetText: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  // Remove set (per-row delete button)
  removeSetBtn: {
    position: 'absolute' as const,
    right: -4,
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 10,
  },
  removeSetText: {
    color: colors.text.muted,
    fontSize: 8,
    fontWeight: typography.weight.semibold,
    lineHeight: 10,
  },

  // Add exercise
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

  // Notes
  notesContainer: { marginBottom: spacing[4] },
  notesLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
  notesInput: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    padding: spacing[3],
    color: colors.text.primary,
    fontSize: typography.size.base,
    minHeight: 60,
    textAlignVertical: 'top',
  },

  // Overflow menu item text (non-danger)
  overflowMenuItemText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },

  // Exercise card skipped state (10.2)
  exerciseCardSkipped: {
    opacity: 0.4,
  },
  exerciseNameSkipped: {
    textDecorationLine: 'line-through' as const,
  },

  // Drag handle (11.5)
  dragHandle: {
    color: colors.text.muted,
    fontSize: typography.size.lg,
    paddingRight: spacing[2],
    lineHeight: 20,
  },

  // Notes icon (10.4)
  notesIconBtn: {
    paddingHorizontal: spacing[1],
  },
  notesIcon: {
    fontSize: 14,
    opacity: 0.5,
  },
  notesIconActive: {
    opacity: 1,
  },

  // Context menu trigger (10.1)
  contextMenuBtn: {
    paddingHorizontal: spacing[1],
  },
  contextMenuDots: {
    color: colors.text.muted,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    letterSpacing: ls.wider,
  },
  contextMenuContainer: {
    position: 'relative' as const,
    zIndex: 100,
  },

  // Per-exercise notes (10.4)
  exerciseNotesContainer: {
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  exerciseNotesInput: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing[2],
    color: colors.text.primary,
    fontSize: typography.size.sm,
    minHeight: 40,
    textAlignVertical: 'top',
  },
});
