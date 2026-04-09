/**
 * ActiveWorkoutBody — Extracted from ActiveWorkoutScreen (Task 8.1)
 *
 * Contains the scrollable body: volume pills, HU pill, exercise cards, and add button.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';
import { VolumePills } from '../../components/training/VolumePills';
import { ExerciseCardPremium } from '../../components/training/ExerciseCardPremium';
import { HUFloatingPill } from '../../components/training/HUFloatingPill';
import { showAlert } from '../../utils/crossPlatformAlert';
import { spacing, radius, typography } from '../../theme/tokens';
import type { ThemeColors } from '../../hooks/useThemeColors';
import type { ActiveWorkoutState, ActiveWorkoutActions, ActiveExercise, ActiveSet, PreviousPerformanceData, SetType } from '../../types/training';
import type { MuscleVolumeEntry } from '../../utils/volumeAggregator';
import type { WarmUpSet } from '../../utils/warmUpGenerator';
import type { UserProfile } from '../../store';

function ExerciseCardWrapper({ children, index }: { children: React.ReactNode; index: number }) {
  const entranceStyle = useStaggeredEntrance(index, 60);
  return <Animated.View style={entranceStyle}>{children}</Animated.View>;
}

interface ActiveWorkoutBodyProps {
  c: ThemeColors;
  store: ActiveWorkoutState & ActiveWorkoutActions;
  unitSystem: 'metric' | 'imperial';
  rpeMode: 'rpe' | 'rir';
  showRpeRir: boolean;
  muscleGroupMap: Record<string, string>;
  volumeData: MuscleVolumeEntry[];
  sessionHU: Record<string, number>;
  exerciseHUMap: Record<string, number>;
  onHUPillPress: () => void;
  onSwapExercise: (localId: string) => void;
  onGenerateWarmUp: (localId: string) => void;
  onWeightStep: (exerciseLocalId: string, setLocalId: string, direction: 'up' | 'down') => void;
  onApplyOverload: (localId: string) => void;
  onOpenExercisePicker: () => void;
  onShowRpeEducation: () => void;
  onShowHUExplainer: (exerciseName: string, hu?: number) => void;
  onOpenPlateCalculator: (weightKg: number) => void;
  profile: UserProfile | null;
}

export function ActiveWorkoutBody({
  c,
  store,
  unitSystem,
  rpeMode,
  showRpeRir,
  muscleGroupMap,
  volumeData,
  sessionHU,
  exerciseHUMap,
  onHUPillPress,
  onSwapExercise,
  onGenerateWarmUp,
  onWeightStep,
  onApplyOverload,
  onOpenExercisePicker,
  onShowRpeEducation,
  onShowHUExplainer,
  onOpenPlateCalculator,
  profile,
}: ActiveWorkoutBodyProps) {
  const styles = getStyles(c);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Volume pills */}
      <VolumePills muscleVolumes={volumeData} />

      {/* HU floating pill */}
      <HUFloatingPill huByMuscle={sessionHU} onPress={onHUPillPress} />

      {/* Exercise cards */}
      {store.exercises.map((exercise: ActiveExercise, idx: number) => {
        const prevKey = exercise.exerciseName.toLowerCase();
        const prevPerf: PreviousPerformanceData | null = store.previousPerformance[prevKey] ?? null;
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
              currentHU={exerciseHUMap[exercise.localId]}
              onSwap={() => onSwapExercise(exercise.localId)}
              onSkip={() => store.toggleExerciseSkip(exercise.localId)}
              onGenerateWarmUp={(sets?: WarmUpSet[]) => {
                if (sets?.length) {
                  store.insertWarmUpSets(exercise.localId, sets);
                } else {
                  onGenerateWarmUp(exercise.localId);
                }
              }}
              onRemove={() => store.removeExercise(exercise.localId)}
              onAddSet={() => store.addSet(exercise.localId)}
              onRemoveSet={(setLocalId: string) => store.removeSet(exercise.localId, setLocalId)}
              onReorder={(direction: 'up' | 'down') => {
                const newIdx = direction === 'up' ? idx - 1 : idx + 1;
                store.reorderExercises(idx, newIdx);
              }}
              isFirst={idx === 0}
              isLast={idx === store.exercises.length - 1}
              onUpdateSetField={(setLocalId: string, field: 'weight' | 'reps' | 'rpe' | 'rir', value: string) =>
                store.updateSetField(exercise.localId, setLocalId, field, value)
              }
              onToggleSetCompleted={(setLocalId: string) => {
                const result = store.toggleSetCompleted(exercise.localId, setLocalId);
                if (result.validationError) {
                  showAlert('Missing Fields', result.validationError);
                }
                if (result.completed) {
                  const currentSet = exercise.sets.find((s: ActiveSet) => s.localId === setLocalId);
                  const normalSets = exercise.sets.filter((s: ActiveSet) => s.setType === 'normal');
                  const isLastNormalSet = normalSets[normalSets.length - 1]?.localId === setLocalId;
                  const shouldSkip = currentSet?.setType === 'warm-up' || currentSet?.setType === 'drop-set';

                  const { shouldStartRestTimer } = require('../../utils/supersetLogic');
                  const canStartTimer = shouldStartRestTimer(store.supersetGroups, exercise.localId);

                  if (!isLastNormalSet && !shouldSkip && canStartTimer) {
                    const { getRestDuration } = require('../../utils/getRestDuration');
                    const duration = getRestDuration(exercise.exerciseName, profile?.preferences?.rest_timer);
                    store.startRestTimer(exercise.exerciseName, duration);
                  }
                }
              }}
              onCopyPreviousToSet={(setLocalId: string) =>
                store.copyPreviousToSet(exercise.localId, setLocalId)
              }
              onWeightStep={(setLocalId: string, direction: 'up' | 'down') =>
                onWeightStep(exercise.localId, setLocalId, direction)
              }
              onUpdateSetType={(setLocalId: string, setType: SetType) =>
                store.updateSetType(exercise.localId, setLocalId, setType)
              }
              onApplyOverload={() => onApplyOverload(exercise.localId)}
              onSetExerciseNotes={(localId: string, notes: string) => store.setExerciseNotes(localId, notes)}
              onShowRpeEducation={onShowRpeEducation}
              onShowHUExplainer={() => onShowHUExplainer(exercise.exerciseName, exerciseHUMap[exercise.localId])}
              onOpenPlateCalculator={onOpenPlateCalculator}
            />
          </ExerciseCardWrapper>
        );
      })}

      {/* Add Exercise button */}
      <TouchableOpacity
        style={[styles.addExerciseBtn, { backgroundColor: c.bg.surface, borderColor: c.border.default }]}
        onPress={onOpenExercisePicker}
        accessibilityLabel="Add exercise"
        accessibilityRole="button"
      >
        <Text style={[styles.addExerciseText, { color: c.accent.primary }]}>+ Add Exercise</Text>
      </TouchableOpacity>

      {/* Bottom spacer for sticky bars */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: spacing[4], paddingBottom: spacing[4] },
  bottomSpacer: { height: 140 },
  addExerciseBtn: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.default,
    borderStyle: 'dashed',
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  addExerciseText: {
    color: c.accent.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
});
