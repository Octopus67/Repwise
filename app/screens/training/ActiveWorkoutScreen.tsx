/**
 * ActiveWorkoutScreen — Full-screen workout logging interface
 *
 * Replaces the old AddTrainingModal with a push-navigation screen.
 * Implements: exercise cards with set rows, inline previous performance,
 * set completion with haptics + PR detection + rest timer, finish/discard
 * flow, superset grouping, and crash recovery support.
 *
 * Tasks: 16.1–16.5
 */

import { useEffect, useState, useCallback, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useActiveWorkoutStore } from '../../store/activeWorkoutSlice';
import { useStore } from '../../store';
import api from '../../services/api';
import { colors, spacing, typography, radius } from '../../theme/tokens';

// Components
import { DurationTimer } from '../../components/training/DurationTimer';
import { RestTimerOverlay } from '../../components/training/RestTimerOverlay';
import { PRBanner } from '../../components/training/PRBanner';
import { SetTypeSelector } from '../../components/training/SetTypeSelector';
import { RPEPicker } from '../../components/training/RPEPicker';
import { OverloadSuggestionBadge } from '../../components/training/OverloadSuggestionBadge';
import { VolumeIndicatorPill } from '../../components/training/VolumeIndicatorPill';
import { ExerciseDetailSheet } from '../../components/training/ExerciseDetailSheet';
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

// Types
import type { ActiveExercise, ActiveSet, SetType, PreviousPerformanceData } from '../../types/training';
import type { Exercise } from '../../types/exercise';

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function ActiveWorkoutScreen({ route, navigation }: any) {
  const { mode, sessionId, templateId, sessionDate } = route.params ?? {};

  // Store state
  const store = useActiveWorkoutStore();
  const unitSystem = useStore((s) => s.unitSystem);
  const rpeMode = useStore((s) => s.rpeMode);
  const profile = useStore((s) => s.profile);
  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';

  // Local UI state
  const [saving, setSaving] = useState(false);
  const [restTimerVisible, setRestTimerVisible] = useState(false);
  const [restDuration, setRestDuration] = useState(180);
  const [prBannerVisible, setPrBannerVisible] = useState(false);
  const [prBannerData, setPrBannerData] = useState<Array<{ type: 'weight' | 'reps' | 'volume' | 'e1rm'; exerciseName: string; value: string }>>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const initialized = useRef(false);

  // Intelligence layer state (4.7)
  const [muscleGroupMap, setMuscleGroupMap] = useState<Record<string, string>>({});
  const [volumeSetCounts, setVolumeSetCounts] = useState<Record<string, number>>({});

  // Exercise detail sheet state (5.3)
  const [exerciseCache, setExerciseCache] = useState<Record<string, Exercise>>({});
  const [detailSheetExercise, setDetailSheetExercise] = useState<Exercise | null>(null);
  const [detailSheetVisible, setDetailSheetVisible] = useState(false);

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
              // Mark all sets as incomplete for the copy
              exercises.forEach(ex => ex.sets.forEach(s => { s.completed = false; s.completedAt = null; }));
              store.startWorkout({ mode: 'new', templateExercises: exercises, sessionDate: sessionDate || undefined });
            } else {
              store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
            }
          } catch {
            store.startWorkout({ mode: 'new', sessionDate: sessionDate || undefined });
          }
        } else {
          // mode === 'new' (default)
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
    // Simple prompt for date — in production use a DatePicker component
    Alert.prompt?.(
      'Session Date',
      'Enter date (YYYY-MM-DD):',
      (text) => { if (text) store.setSessionDate(text); },
      'plain-text',
      store.sessionDate,
    );
  }, [store.sessionDate]);

  // ── Set completion handler (16.3) ────────────────────────────────────────

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

      // Rest timer — check superset logic
      if (shouldStartRestTimer(store.supersetGroups, exerciseLocalId)) {
        const restPrefs = profile?.preferences?.rest_timer;
        const dur = getRestDurationV2(exerciseName, [], restPrefs);
        setRestDuration(dur);
        setRestTimerVisible(true);
      }

      // Increment volume count for muscle group (4.7)
      const mg = muscleGroupMap[exerciseName.toLowerCase()];
      if (mg) {
        setVolumeSetCounts((prev) => ({ ...prev, [mg]: (prev[mg] ?? 0) + 1 }));
      }
    }
  }, [store, unitSystem, unitLabel, profile, muscleGroupMap]);

  // ── Finish workout (16.4) ────────────────────────────────────────────────

  const handleFinish = useCallback(async () => {
    const completedSets = store.exercises.flatMap(e => e.sets).filter(s => s.completed);
    if (completedSets.length === 0) {
      Alert.alert('No Completed Sets', 'Complete at least one set to save.');
      return;
    }

    setSaving(true);
    try {
      // Build payload with correct unit conversion
      const exercisePayload = activeExercisesToPayload(store.exercises, unitSystem);
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
        },
      };

      let response;
      if (store.mode === 'edit' && store.editSessionId) {
        response = await api.put(`training/sessions/${store.editSessionId}`, payload);
      } else {
        response = await api.post('training/sessions', payload);
      }

      // Show summary and navigate back
      const elapsed = store.startedAt
        ? Math.floor((Date.now() - new Date(store.startedAt).getTime()) / 1000)
        : 0;
      const volume = calculateWorkingVolume(store.exercises);
      const prCount = response.data?.personal_records?.length ?? 0;

      // Clean up and go back immediately — don't rely on Alert callbacks (broken on web)
      store.discardWorkout();
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Save Failed', 'Could not save workout. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [store, unitSystem, unitLabel, navigation]);

  // ── Discard workout (16.4) ───────────────────────────────────────────────

  const handleDiscard = useCallback(() => {
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        {/* Duration timer hidden — date and discard only */}
        <View />
        <TouchableOpacity onPress={handleDatePress}>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDiscard}>
          <Text style={styles.discardText}>Discard</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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

        {/* Quick guide for new users */}
        {store.exercises.length > 0 && (
          <View style={styles.infoHint}>
            <Text style={styles.infoHintText}>
              💡 RPE = how hard the set felt (6 easy → 10 max effort) · Type = Normal, Warm-up, Drop-set, or AMRAP · Tap Previous to copy last session's values
            </Text>
          </View>
        )}

        {/* Exercise Cards */}
        {store.exercises.map((exercise, exIdx) => {
          const supersetGroup = getSupersetGroupForExercise(exercise.localId);
          const prevData = store.previousPerformance[exercise.exerciseName.toLowerCase()] ?? null;

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

              <View style={[styles.exerciseCard, supersetGroup && styles.exerciseCardSuperset]}>
                {/* Exercise header */}
                <View style={styles.exerciseHeader}>
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
                    <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => store.removeExercise(exercise.localId)}>
                    <Text style={styles.removeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Overload Suggestion Badge (4.7) */}
                <OverloadSuggestionBadge
                  exerciseName={exercise.exerciseName}
                  unitSystem={unitSystem}
                />

                {/* Set header row */}
                <View style={styles.setHeaderRow}>
                  <Text style={[styles.setHeaderCell, styles.setNumCol]}>#</Text>
                  <Text style={[styles.setHeaderCell, styles.prevCol]}>Previous</Text>
                  <Text style={[styles.setHeaderCell, styles.weightCol]}>{unitLabel}</Text>
                  <Text style={[styles.setHeaderCell, styles.repsCol]}>Reps</Text>
                  <Text style={[styles.setHeaderCell, styles.rpeCol]}>RPE ⓘ</Text>
                  <Text style={[styles.setHeaderCell, styles.typeCol]}>Type</Text>
                  <Text style={[styles.setHeaderCell, styles.checkCol]}>✓</Text>
                </View>

                {/* Set rows */}
                {exercise.sets.map((set, setIdx) => (
                  <SetRow
                    key={set.localId}
                    set={set}
                    setIndex={setIdx}
                    exerciseLocalId={exercise.localId}
                    exerciseName={exercise.exerciseName}
                    prevData={prevData}
                    unitSystem={unitSystem}
                    rpeMode={rpeMode}
                    onUpdateField={store.updateSetField}
                    onUpdateType={store.updateSetType}
                    onToggleComplete={handleToggleSet}
                    onCopyPrevious={handleCopyPrevious}
                    onRemoveSet={store.removeSet}
                  />
                ))}

                {/* Add Set button */}
                <TouchableOpacity style={styles.addSetBtn} onPress={() => store.addSet(exercise.localId)}>
                  <Text style={styles.addSetText}>+ Add Set</Text>
                </TouchableOpacity>
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

        {/* Spacer for bottom button */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Finish button (sticky bottom) */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.finishBtn, saving && styles.finishBtnDisabled]}
          onPress={handleFinish}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.finishBtnText}>
            {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Finish Workout'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Rest Timer overlay */}
      <RestTimerOverlay
        durationSeconds={restDuration}
        visible={restTimerVisible}
        onDismiss={() => setRestTimerVisible(false)}
        onComplete={() => setRestTimerVisible(false)}
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


// ─── SetRow Sub-Component ────────────────────────────────────────────────────

interface SetRowProps {
  set: ActiveSet;
  setIndex: number;
  exerciseLocalId: string;
  exerciseName: string;
  prevData: PreviousPerformanceData | null;
  unitSystem: 'metric' | 'imperial';
  rpeMode: 'rpe' | 'rir';
  onUpdateField: (exId: string, setId: string, field: 'weight' | 'reps' | 'rpe', value: string) => void;
  onUpdateType: (exId: string, setId: string, type: SetType) => void;
  onToggleComplete: (exId: string, setId: string, name: string) => void;
  onCopyPrevious: (exId: string, setId: string) => void;
  onRemoveSet: (exId: string, setId: string) => void;
}

function SetRow({
  set,
  setIndex,
  exerciseLocalId,
  exerciseName,
  prevData,
  unitSystem,
  rpeMode,
  onUpdateField,
  onUpdateType,
  onToggleComplete,
  onCopyPrevious,
  onRemoveSet,
}: SetRowProps) {
  const bgAnim = useRef(new Animated.Value(set.completed ? 1 : 0)).current;
  const [rpePickerVisible, setRpePickerVisible] = useState(false);

  useEffect(() => {
    Animated.timing(bgAnim, {
      toValue: set.completed ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [set.completed]);

  const rowBg = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', 'rgba(34,197,94,0.08)'],
  });

  const prevText = formatPreviousPerformance(prevData, setIndex, unitSystem);

  const rpeDisplayText = getDisplayValue(set.rpe, rpeMode);

  return (
    <Animated.View style={[styles.setRow, { backgroundColor: rowBg }]}>
      <Text style={[styles.setCell, styles.setNumCol]}>{set.setNumber}</Text>

      <TouchableOpacity
        style={styles.prevCol}
        onPress={() => prevData && onCopyPrevious(exerciseLocalId, set.localId)}
        disabled={!prevData}
      >
        <Text style={styles.prevText}>{prevText}</Text>
      </TouchableOpacity>

      <TextInput
        style={[styles.setInput, styles.weightCol]}
        value={set.weight}
        onChangeText={(v) => onUpdateField(exerciseLocalId, set.localId, 'weight', v)}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.text.muted}
      />

      <TextInput
        style={[styles.setInput, styles.repsCol]}
        value={set.reps}
        onChangeText={(v) => onUpdateField(exerciseLocalId, set.localId, 'reps', v)}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.text.muted}
      />

      <TouchableOpacity
        style={[styles.setInput, styles.rpeCol, { justifyContent: 'center' }]}
        onPress={() => setRpePickerVisible(true)}
      >
        <Text style={[styles.rpeTapText, !rpeDisplayText && styles.rpePlaceholder]}>
          {rpeDisplayText || '—'}
        </Text>
      </TouchableOpacity>

      <RPEPicker
        visible={rpePickerVisible}
        mode={rpeMode}
        onSelect={(value) => {
          onUpdateField(exerciseLocalId, set.localId, 'rpe', value);
          setRpePickerVisible(false);
        }}
        onDismiss={() => setRpePickerVisible(false)}
      />

      <View style={styles.typeCol}>
        <SetTypeSelector
          value={set.setType}
          onChange={(type) => onUpdateType(exerciseLocalId, set.localId, type)}
        />
      </View>

      <TouchableOpacity
        style={[styles.checkCol, styles.checkBtn, set.completed && styles.checkBtnCompleted]}
        onPress={() => onToggleComplete(exerciseLocalId, set.localId, exerciseName)}
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
}


// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },

  // Top bar
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
  discardText: {
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

  // Exercise card
  exerciseCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
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
  exerciseName: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  removeBtn: {
    color: colors.text.muted,
    fontSize: typography.size.md,
    paddingHorizontal: spacing[2],
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
  prevCol: { flex: 1.2, paddingHorizontal: 2 },
  weightCol: { flex: 1, paddingHorizontal: 2 },
  repsCol: { width: 44, paddingHorizontal: 2 },
  rpeCol: { width: 36, paddingHorizontal: 2 },
  typeCol: { width: 32, alignItems: 'center', justifyContent: 'center' },
  checkCol: { width: 32, alignItems: 'center', justifyContent: 'center' },

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

  // RPE tappable field
  rpeTapText: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  rpePlaceholder: {
    color: colors.text.muted,
  },

  // Checkmark
  checkBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnCompleted: {
    backgroundColor: colors.semantic.positive,
    borderColor: colors.semantic.positive,
  },
  checkText: { color: colors.text.muted, fontSize: 13, fontWeight: typography.weight.bold },
  checkTextCompleted: { color: colors.text.inverse },

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
    right: -6,
    top: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.semantic.negative,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 10,
  },
  removeSetText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: typography.weight.bold,
    lineHeight: 12,
  },

  // Info hint for new users
  infoHint: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.primary,
  },
  infoHintText: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.size.xs * 1.5,
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

  // Bottom bar
  bottomBar: {
    padding: spacing[4],
    paddingBottom: spacing[6],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.bg.base,
  },
  finishBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  finishBtnDisabled: { opacity: 0.5 },
  finishBtnText: {
    color: colors.text.inverse,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
});
