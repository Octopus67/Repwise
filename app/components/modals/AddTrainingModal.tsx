import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { ModalContainer } from '../common/ModalContainer';
import api from '../../services/api';
import { useStore } from '../../store';
import { RestTimer } from '../training/RestTimer';
import { getRestDuration } from '../../utils/getRestDuration';
import { PreviousPerformance } from '../training/PreviousPerformance';
import { Icon } from '../common/Icon';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface SetState {
  id: string;
  reps: string;
  weight: string;
  rpe: string;
}

interface ExerciseState {
  id: string;
  name: string;
  sets: SetState[];
}

interface WorkoutTemplate {
  id: string;
  name: string;
  description: string;
  exercises: Array<{
    exercise_name: string;
    sets: Array<{ reps: number; weight_kg: number; rpe: number | null }>;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _counter = 0;
function localId(): string {
  _counter += 1;
  return `_${Date.now()}_${_counter}`;
}

function emptySet(): SetState {
  return { id: localId(), reps: '', weight: '', rpe: '' };
}

function emptyExercise(): ExerciseState {
  return { id: localId(), name: '', sets: [emptySet()] };
}

// ─── Debounce hook ───────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AddTrainingModal({ visible, onClose, onSuccess }: Props) {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const profile = useStore((s) => s.profile);
  const selectedDate = useStore((s) => s.selectedDate);
  const [exercises, setExercises] = useState<ExerciseState[]>([emptyExercise()]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Ref to preserve form state across exercise picker navigation
  const formStateRef = useRef<{ exercises: ExerciseState[]; notes: string } | null>(null);

  // Rest timer state
  const [restTimerVisible, setRestTimerVisible] = useState(false);
  const [restTimerExercise, setRestTimerExercise] = useState('');

  // Exercise search state
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseSearchResults, setExerciseSearchResults] = useState<Array<{ id: string; name: string }>>([]);
  const [exerciseSearchFocused, setExerciseSearchFocused] = useState(false);
  const debouncedSearch = useDebouncedValue(exerciseSearch, 300);

  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setExerciseSearchResults([]);
      return;
    }
    api
      .get('training/exercises/search', { params: { q: debouncedSearch } })
      .then((res) => {
        const data = res.data ?? [];
        setExerciseSearchResults(data.map((ex: any) => ({ id: ex.id, name: ex.name })));
      })
      .catch(() => setExerciseSearchResults([]));
  }, [debouncedSearch]);

  // Restore form state when modal re-opens after exercise picker navigation
  useEffect(() => {
    if (visible && formStateRef.current) {
      setExercises(formStateRef.current.exercises);
      setNotes(formStateRef.current.notes);
      formStateRef.current = null;
    }
  }, [visible]);

  // Template state — expanded by default (was false, now true)
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);

  // Fetch templates when modal opens
  useEffect(() => {
    if (!visible) return;
    setTemplatesLoading(true);
    api
      .get('training/templates')
      .then((res) => setTemplates(res.data ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }, [visible]);

  const reset = useCallback(() => {
    setExercises([emptyExercise()]);
    setNotes('');
    setTemplatesOpen(true);
    setRestTimerVisible(false);
    setRestTimerExercise('');
    setExerciseSearch('');
    setExerciseSearchResults([]);
  }, []);

  // ─── Exercise / Set operations ───────────────────────────────────────────

  const addExercise = () => {
    setExercises((prev) => [...prev, emptyExercise()]);
  };

  const removeExercise = (exId: string) => {
    setExercises((prev) => {
      const next = prev.filter((e) => e.id !== exId);
      return next.length > 0 ? next : [emptyExercise()];
    });
  };

  const updateExerciseName = (exId: string, name: string) => {
    setExercises((prev) =>
      prev.map((e) => (e.id === exId ? { ...e, name } : e)),
    );
  };

  const addSet = (exId: string) => {
    setExercises((prev) => {
      const updated = prev.map((e) => {
        if (e.id !== exId) return e;
        const lastSet = e.sets[e.sets.length - 1];
        const newSet: SetState = lastSet
          ? { id: localId(), reps: lastSet.reps, weight: lastSet.weight, rpe: lastSet.rpe }
          : emptySet();
        return { ...e, sets: [...e.sets, newSet] };
      });

      // Trigger rest timer using up-to-date state (avoids stale closure on `exercises`)
      const exercise = updated.find((e) => e.id === exId);
      if (exercise?.name) {
        setTimeout(() => {
          setRestTimerExercise(exercise.name);
          setRestTimerVisible(true);
        }, 0);
      }

      return updated;
    });
  };

  const removeSet = (exId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.id !== exId) return e;
        const next = e.sets.filter((s) => s.id !== setId);
        return { ...e, sets: next.length > 0 ? next : [emptySet()] };
      }),
    );
  };

  const updateSet = (exId: string, setId: string, field: keyof SetState, value: string) => {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.id !== exId) return e;
        return {
          ...e,
          sets: e.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
        };
      }),
    );
  };

  // ─── Template / Copy helpers ─────────────────────────────────────────────

  const loadFromTemplate = (tpl: WorkoutTemplate) => {
    const mapped: ExerciseState[] = tpl.exercises.map((ex) => ({
      id: localId(),
      name: ex.exercise_name,
      sets: ex.sets.map((s) => ({
        id: localId(),
        reps: String(s.reps),
        weight: String(s.weight_kg),
        rpe: s.rpe != null ? String(s.rpe) : '',
      })),
    }));
    setExercises(mapped);
    setTemplatesOpen(false);
  };

  const copyLastWorkout = async () => {
    setCopyLoading(true);
    try {
      const res = await api.get('training/sessions', { params: { limit: 1 } });
      const sessions = res.data;
      const last = Array.isArray(sessions) ? sessions[0] : sessions?.items?.[0];
      if (!last?.exercises?.length) {
        Alert.alert('No previous workout', 'No recent training session found.');
        return;
      }
      const mapped: ExerciseState[] = last.exercises.map(
        (ex: { exercise_name: string; sets: Array<{ reps: number; weight_kg: number; rpe: number | null }> }) => ({
          id: localId(),
          name: ex.exercise_name,
          sets: ex.sets.map((s: { reps: number; weight_kg: number; rpe: number | null }) => ({
            id: localId(),
            reps: String(s.reps),
            weight: String(s.weight_kg),
            rpe: s.rpe != null ? String(s.rpe) : '',
          })),
        }),
      );
      setExercises(mapped);
      setTemplatesOpen(false);
    } catch {
      Alert.alert('Error', 'Failed to load last workout.');
    } finally {
      setCopyLoading(false);
    }
  };

  // ─── Exercise search selection ─────────────────────────────────────────

  const handleSearchSelect = (name: string) => {
    // Find an exercise with an empty name and fill it, otherwise add a new one
    const emptyEx = exercises.find((e) => !e.name.trim());
    if (emptyEx) {
      updateExerciseName(emptyEx.id, name);
    } else {
      const newEx: ExerciseState = { id: localId(), name, sets: [emptySet()] };
      setExercises((prev) => [...prev, newEx]);
    }
    setExerciseSearch('');
    setExerciseSearchResults([]);
  };

  // ─── Validation & Submit ─────────────────────────────────────────────────

  const validate = (): string | null => {
    if (exercises.length === 0) return 'Add at least one exercise.';
    for (const ex of exercises) {
      if (!ex.name.trim()) return 'Every exercise needs a name.';
      if (ex.sets.length === 0) return `"${ex.name}" needs at least one set.`;
      for (const s of ex.sets) {
        if (s.reps === '' || s.weight === '') return `Fill in reps and weight for "${ex.name}".`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      Alert.alert('Validation', err);
      return;
    }
    setLoading(true);
    try {
      await api.post('training/sessions', {
        session_date: selectedDate,
        exercises: exercises.map((ex) => ({
          exercise_name: ex.name.trim(),
          sets: ex.sets.map((s) => ({
            reps: Number(s.reps),
            weight_kg: Number(s.weight),
            ...(s.rpe !== '' ? { rpe: Number(s.rpe) } : {}),
          })),
        })),
        ...(notes.trim() ? { metadata: { notes: notes.trim() } } : {}),
      });
      reset();
      Alert.alert('Logged!', 'Training session saved.');
      onSuccess();
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to log training session.');
    } finally {
      setLoading(false);
    }
  };

  const hasUnsavedData = (): boolean => {
    return exercises.some(
      (ex) =>
        ex.name.trim() !== '' ||
        ex.sets.some((s) => s.reps !== '' || s.weight !== ''),
    );
  };

  const handleClose = () => {
    if (hasUnsavedData()) {
      Alert.alert(
        'Discard changes?',
        'You have unsaved data. Are you sure you want to close?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => { reset(); onClose(); } },
        ],
      );
    } else {
      reset();
      onClose();
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <ModalContainer visible={visible} onClose={handleClose} title="Log Training" testID="add-training-modal" closeButtonTestID="training-cancel-button">
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* ── Template Picker ── */}
        <TouchableOpacity
          style={styles.sectionToggle}
          onPress={() => setTemplatesOpen((o) => !o)}
          activeOpacity={0.7}
          testID="training-template-toggle"
        >
          <Text style={styles.sectionToggleText}>
            {templatesOpen ? '▾ Templates' : '▸ Templates'}
          </Text>
        </TouchableOpacity>

        {templatesOpen && (
          <View style={styles.templateSection}>
            {templatesLoading ? (
              <ActivityIndicator color={colors.accent.primary} />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.copyLastBtn}
                  onPress={copyLastWorkout}
                  disabled={copyLoading}
                  activeOpacity={0.7}
                  testID="training-copy-last"
                >
                  {copyLoading ? (
                    <ActivityIndicator size="small" color={colors.text.primary} />
                  ) : (
                    <Text style={styles.copyLastText}><Icon name="clipboard" /> Copy Last Workout</Text>
                  )}
                </TouchableOpacity>

                {templates.map((tpl) => (
                  <TouchableOpacity
                    key={tpl.id}
                    style={styles.templateCard}
                    onPress={() => loadFromTemplate(tpl)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.templateName}>{tpl.name}</Text>
                    <Text style={styles.templateDesc}>{tpl.description}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        )}

        {/* ── Exercise Search ── */}
        <View style={styles.exerciseSearchContainer}>
          <TextInput
            style={[
              styles.exerciseSearchInput,
              exerciseSearchFocused && styles.exerciseSearchInputFocused,
            ]}
            value={exerciseSearch}
            onChangeText={setExerciseSearch}
            placeholder="Search exercises..."
            placeholderTextColor={colors.text.muted}
            onFocus={() => setExerciseSearchFocused(true)}
            onBlur={() => setExerciseSearchFocused(false)}
            testID="training-exercise-search"
          />
          {exerciseSearchResults.length > 0 && (
            <View style={styles.exerciseSearchDropdown}>
              {exerciseSearchResults.slice(0, 8).map((result) => (
                <TouchableOpacity
                  key={result.id}
                  style={styles.exerciseSearchResult}
                  onPress={() => handleSearchSelect(result.name)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.exerciseSearchResultText}>{result.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Exercise List ── */}
        {exercises.map((ex, exIdx) => (
          <View key={ex.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseIdx}>{exIdx + 1}</Text>
              <TouchableOpacity
                style={styles.exerciseNameBtn}
                onPress={() => {
                  formStateRef.current = { exercises, notes };
                  onClose();
                  navigation.navigate('ExercisePicker', {
                    onSelect: (name: string) => {
                      updateExerciseName(ex.id, name);
                    },
                    onCancel: () => {
                      // Parent will re-open the modal
                    },
                  });
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.exerciseNameText,
                    !ex.name && styles.exerciseNamePlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {ex.name || 'Tap to choose exercise'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeExercise(ex.id)}>
                <Text style={styles.removeBtn}><Icon name="close" size={16} /></Text>
              </TouchableOpacity>
            </View>

            {/* Previous performance hint */}
            {ex.name.trim() !== '' && (
              <PreviousPerformance exerciseName={ex.name} />
            )}

            {/* Set header */}
            <View style={styles.setHeaderRow}>
              <Text style={[styles.setHeaderCell, { flex: 0.5 }]}>#</Text>
              <Text style={styles.setHeaderCell}>Reps</Text>
              <Text style={styles.setHeaderCell}>kg</Text>
              <Text style={styles.setHeaderCell}>RPE</Text>
              <View style={{ width: 28 }} />
            </View>

            {/* Sets */}
            {ex.sets.map((s, sIdx) => (
              <View key={s.id} style={styles.setRow}>
                <Text style={[styles.setNum, { flex: 0.5 }]}>{sIdx + 1}</Text>
                <TextInput
                  style={styles.setInput}
                  value={s.reps}
                  onChangeText={(v) => updateSet(ex.id, s.id, 'reps', v)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.text.muted}
                />
                <TextInput
                  style={styles.setInput}
                  value={s.weight}
                  onChangeText={(v) => updateSet(ex.id, s.id, 'weight', v)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.text.muted}
                />
                <TextInput
                  style={styles.setInput}
                  value={s.rpe}
                  onChangeText={(v) => updateSet(ex.id, s.id, 'rpe', v)}
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor={colors.text.muted}
                />
                <TouchableOpacity onPress={() => removeSet(ex.id, s.id)} style={{ width: 28, alignItems: 'center' }}>
                  <Text style={styles.removeSetBtn}><Icon name="close" size={16} /></Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(ex.id)} activeOpacity={0.7}>
              <Text style={styles.addSetText}>+ Add Set</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addExerciseBtn} onPress={addExercise} activeOpacity={0.7}>
          <Text style={styles.addExerciseText}>+ Add Exercise</Text>
        </TouchableOpacity>

        {/* Notes */}
        <View style={styles.field}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Felt strong today"
            placeholderTextColor={colors.text.muted}
            multiline
          />
        </View>
      </ScrollView>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        activeOpacity={0.7}
        testID="training-submit-button"
      >
        {loading ? (
          <ActivityIndicator color={colors.text.primary} />
        ) : (
          <Text style={styles.submitText}>Save Session</Text>
        )}
      </TouchableOpacity>

      {/* Rest Timer Overlay */}
      <RestTimer
        durationSeconds={getRestDuration(restTimerExercise, profile?.preferences?.rest_timer)}
        visible={restTimerVisible}
        onDismiss={() => setRestTimerVisible(false)}
        onComplete={() => setRestTimerVisible(false)}
        onSettingsChange={async (compound, isolation) => {
          const existingPrefs = profile?.preferences ?? {};
          try {
            await api.put('users/profile', {
              preferences: {
                ...existingPrefs,
                rest_timer: { compound_seconds: compound, isolation_seconds: isolation },
              },
            });
            const store = useStore.getState();
            store.setProfile({
              ...store.profile!,
              preferences: {
                ...existingPrefs,
                rest_timer: { compound_seconds: compound, isolation_seconds: isolation },
              },
            });
          } catch {
            Alert.alert('Error', 'Failed to update rest timer settings.');
          }
        }}
      />
    </ModalContainer>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Template section
  sectionToggle: {
    paddingVertical: spacing[2],
    marginBottom: spacing[2],
  },
  sectionToggleText: {
    color: colors.accent.primary,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
    fontWeight: typography.weight.medium,
  },
  templateSection: {
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  copyLastBtn: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[3],
    alignItems: 'center',
  },
  copyLastText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    fontWeight: typography.weight.medium,
  },
  templateCard: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[3],
  },
  templateName: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    fontWeight: typography.weight.semibold,
  },
  templateDesc: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginTop: spacing[1],
  },

  // Exercise search
  exerciseSearchContainer: {
    marginBottom: spacing[3],
    zIndex: 10,
  },
  exerciseSearchInput: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    color: colors.text.primary,
    fontSize: typography.size.base,
    padding: 12,
  },
  exerciseSearchInputFocused: {
    borderColor: colors.accent.primary,
  },
  exerciseSearchDropdown: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginTop: spacing[1],
    maxHeight: 240,
    overflow: 'hidden',
  },
  exerciseSearchResult: {
    paddingVertical: spacing[2],
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  exerciseSearchResultText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
  },

  // Exercise card
  exerciseCard: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  exerciseIdx: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.semibold,
    width: 20,
    textAlign: 'center',
  },
  exerciseNameBtn: {
    flex: 1,
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  exerciseNameText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
  },
  exerciseNamePlaceholder: {
    color: colors.text.muted,
  },
  removeBtn: {
    color: colors.semantic.negative,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
    paddingHorizontal: spacing[2],
  },

  // Set rows
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[1],
    paddingHorizontal: spacing[1],
  },
  setHeaderCell: {
    flex: 1,
    color: colors.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[1],
  },
  setNum: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
  setInput: {
    flex: 1,
    minWidth: 56,
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    color: colors.text.primary,
    fontSize: typography.size.base,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    textAlign: 'center',
  },
  removeSetBtn: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  addSetBtn: {
    marginTop: spacing[2],
    alignItems: 'center',
  },
  addSetText: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.medium,
  },

  // Add exercise
  addExerciseBtn: {
    backgroundColor: colors.accent.primaryMuted,
    borderRadius: radius.sm,
    padding: spacing[3],
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  addExerciseText: {
    color: colors.accent.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    fontWeight: typography.weight.semibold,
  },

  // Notes & submit
  field: { marginBottom: spacing[3] },
  label: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
  input: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    color: colors.text.primary,
    fontSize: typography.size.base,
    padding: spacing[3],
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    padding: spacing[3],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
    fontWeight: typography.weight.semibold,
  },
});
