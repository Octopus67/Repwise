import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { Icon } from '../../components/common/Icon';
import api from '../../services/api';
import { Exercise } from '../../types/exercise';
import { filterExercises } from '../../utils/filterExercises';
import { extractRecentExercises, TrainingSession } from '../../utils/extractRecentExercises';
import { SearchBar } from '../../components/exercise-picker/SearchBar';
import { MuscleGroupGrid } from '../../components/exercise-picker/MuscleGroupGrid';
import { ExerciseCard } from '../../components/exercise-picker/ExerciseCard';
import { RecentExercises } from '../../components/exercise-picker/RecentExercises';
import { useActiveWorkoutStore } from '../../store/activeWorkoutSlice';
import { ExerciseDetailSheet } from '../../components/training/ExerciseDetailSheet';
import { CustomExerciseForm } from '../../components/exercise-picker/CustomExerciseForm';

type ExercisePickerParams = {
  ExercisePicker: { onSelect?: (exerciseName: string) => void; onCancel?: () => void; target?: 'modal' | 'activeWorkout' };
};

type Props = StackScreenProps<ExercisePickerParams, 'ExercisePicker'>;

const EQUIPMENT_FILTERS = ['All', 'Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Band', 'Kettlebell'] as const;
export { EQUIPMENT_FILTERS };

export function ExercisePickerScreen({ route, navigation }: Props) {
  const { onSelect, onCancel, target = 'modal' } = route.params ?? {};

  const didSelectRef = useRef(false);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [recentExercises, setRecentExercises] = useState<Exercise[]>([]);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Exercise detail sheet state (5.4)
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Custom exercise form state (6.7)
  const [showCustomForm, setShowCustomForm] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search text at 300ms
  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(text), 300);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchText('');
    setDebouncedSearch('');
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  // Fetch exercises on mount
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [exRes, sessRes] = await Promise.all([
        api.get('training/exercises'),
        api.get('training/sessions', { params: { limit: 5 } }).catch(() => ({ data: [] })),
      ]);
      const allExercises: Exercise[] = exRes.data ?? [];
      setExercises(allExercises);
      const sessions: TrainingSession[] = Array.isArray(sessRes.data) ? sessRes.data : [];
      setRecentExercises(extractRecentExercises(sessions, allExercises));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Handle hardware back / swipe-back so onCancel fires
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (!didSelectRef.current && onCancel) onCancel();
    });
    return unsubscribe;
  }, [navigation, onCancel]);

  const filteredExercises = useMemo(
    () => filterExercises(exercises, debouncedSearch, selectedMuscleGroup, selectedEquipment),
    [exercises, debouncedSearch, selectedMuscleGroup, selectedEquipment],
  );

  const isFiltering = debouncedSearch.trim().length > 0 || selectedMuscleGroup != null || selectedEquipment != null;

  const handleExercisePress = useCallback((exercise: Exercise) => {
    didSelectRef.current = true;
    if (target === 'activeWorkout') {
      useActiveWorkoutStore.getState().addExercise(exercise.name);
    } else {
      onSelect?.(exercise.name);
    }
    navigation.goBack();
  }, [onSelect, navigation, target]);

  const handleExerciseLongPress = useCallback((exercise: Exercise) => {
    setDetailExercise(exercise);
    setDetailVisible(true);
  }, []);

  const handleCustomExerciseCreated = useCallback((exercise: { id: string; name: string }) => {
    setShowCustomForm(false);
    didSelectRef.current = true;
    if (target === 'activeWorkout') {
      useActiveWorkoutStore.getState().addExercise(exercise.name);
    } else {
      onSelect?.(exercise.name);
    }
    navigation.goBack();
  }, [onSelect, navigation, target]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.errorIcon}><Icon name="warning" /></Text>
          <Text style={styles.errorText}>Failed to load exercises</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchData} activeOpacity={0.7}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show custom exercise form (6.7)
  if (showCustomForm) {
    return (
      <SafeAreaView style={styles.screen}>
        <CustomExerciseForm
          initialName={searchText.trim()}
          onCreated={handleCustomExerciseCreated}
          onCancel={() => setShowCustomForm(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backBtn}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose Exercise</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Search bar */}
      <SearchBar
        value={searchText}
        onChangeText={handleSearchChange}
        onClear={handleSearchClear}
        resultCount={isFiltering ? filteredExercises.length : null}
      />

      {/* Equipment filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroll}
      >
        {EQUIPMENT_FILTERS.map((label) => {
          const isAll = label === 'All';
          const isActive = isAll ? selectedEquipment === null : selectedEquipment?.toLowerCase() === label.toLowerCase();
          return (
            <TouchableOpacity
              key={label}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => setSelectedEquipment(isAll ? null : label.toLowerCase())}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${label}`}
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Muscle group header when filtered */}
      {selectedMuscleGroup && (
        <View style={styles.filterHeader}>
          <Text style={styles.filterLabel}>
            {selectedMuscleGroup.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
          <TouchableOpacity onPress={() => setSelectedMuscleGroup(null)} accessibilityLabel="Clear muscle group filter">
            <Text style={styles.clearFilter}><Icon name="close" /> Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {isFiltering ? (
        filteredExercises.length > 0 ? (
          <FlatList
            data={filteredExercises}
            renderItem={({ item }) => <ExerciseCard exercise={item} onPress={handleExercisePress} onLongPress={handleExerciseLongPress} />}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="on-drag"
          />
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No exercises match your search</Text>
            {selectedMuscleGroup && (
              <Text style={styles.emptyHint}>Try clearing the muscle group filter</Text>
            )}
            <TouchableOpacity
              style={styles.createCustomBtn}
              onPress={() => setShowCustomForm(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Create custom exercise"
            >
              <Text style={styles.createCustomText}>+ Create Custom Exercise</Text>
            </TouchableOpacity>
          </View>
        )
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <>
              <RecentExercises exercises={recentExercises} onPress={handleExercisePress} />
              <MuscleGroupGrid exercises={exercises} onSelectMuscleGroup={setSelectedMuscleGroup} />
            </>
          }
          keyboardDismissMode="on-drag"
        />
      )}

      {/* Exercise Detail Sheet for long-press preview (5.4) */}
      <ExerciseDetailSheet
        exercise={detailExercise}
        visible={detailVisible}
        onDismiss={() => setDetailVisible(false)}
      />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  backBtn: {
    width: 40,
    alignItems: 'center',
  },
  backText: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  filterLabel: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  clearFilter: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: spacing[3],
  },
  errorText: {
    color: colors.text.secondary,
    fontSize: typography.size.md,
    marginBottom: spacing[3],
  },
  retryBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
  },
  retryText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: typography.size.md,
  },
  emptyHint: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    marginTop: spacing[2],
  },
  createCustomBtn: {
    marginTop: spacing[4],
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
  },
  createCustomText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  chipScroll: {
    flexGrow: 0,
  },
  chipRow: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    backgroundColor: colors.bg.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  chipActive: {
    backgroundColor: colors.accent.primaryMuted,
    borderColor: colors.accent.primary,
  },
  chipText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  chipTextActive: {
    color: colors.accent.primary,
  },
});
