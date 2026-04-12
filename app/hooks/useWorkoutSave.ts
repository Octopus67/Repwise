/**
 * useWorkoutSave — Extracted from ActiveWorkoutScreen (P0-0)
 *
 * Handles workout finish tap validation, confirm/save via TanStack Query
 * useMutation (offline-resilient), payload building, PR detection,
 * and save-as-template.
 */

import { useState, useCallback, useRef } from 'react';
import { getLocalDateString } from '../utils/localDate';
import { useMutation } from '@tanstack/react-query';
import api from '../services/api';
import { queryClient } from '../services/queryClient';
import { showAlert } from '../utils/crossPlatformAlert';
import { computeWorkoutSummary } from '../utils/workoutSummary';
import { generateRecommendations } from '../utils/wnsRecommendations';
import { getApiErrorMessage } from '../utils/errors';
import { isNetworkError, enqueueOfflineWorkout } from '../hooks/useOfflineWorkoutQueue';
import type { PersonalRecordResponse, UnitSystem } from '../types/training';
import type { ActiveWorkoutState, ActiveWorkoutActions } from '../types/training';
import { useWorkoutPreferencesStore } from '../store/workoutPreferencesStore';

interface UseWorkoutSaveParams {
  store: ActiveWorkoutState & ActiveWorkoutActions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigation: { navigate: (...args: any[]) => void };
  unitSystem: UnitSystem;
  elapsedSeconds: number;
  muscleGroupMap: Record<string, string>;
  sessionHURef: React.MutableRefObject<Record<string, number>>;
  isNavigatingAway: React.MutableRefObject<boolean>;
}

export function useWorkoutSave({
  store,
  navigation,
  unitSystem,
  elapsedSeconds,
  muscleGroupMap,
  sessionHURef,
  isNavigatingAway,
}: UseWorkoutSaveParams) {
  const [prData, setPrData] = useState<PersonalRecordResponse[]>([]);
  const [prCelebrationVisible, setPrCelebrationVisible] = useState(false);
  const [finishSheetVisible, setFinishSheetVisible] = useState(false);
  const summaryDataRef = useRef<Record<string, unknown> | null>(null);
  const savingRef = useRef(false);
  const templateSavingRef = useRef(false);

  const saveWorkoutMutation = useMutation({
    mutationKey: ['saveWorkout'],
    mutationFn: async (params: { payload: Record<string, unknown>; isEdit: boolean; editSessionId?: string }) => {
      if (params.isEdit) {
        return api.put(`training/sessions/${params.editSessionId}`, params.payload);
      }
      return api.post('training/sessions', params.payload);
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ['sessions'] });
      const previous = queryClient.getQueryData(['sessions']);
      const optimisticSession = {
        id: `temp_${Date.now()}`,
        user_id: '',
        session_date: getLocalDateString(),
        duration_minutes: 0,
        exercises: params.payload.exercises || [],
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...params.payload,
      };
      queryClient.setQueryData(['sessions'], (old: unknown) => {
        if (Array.isArray(old)) {
          if (params.isEdit) return old.map((item: any) => (item.id === params.editSessionId ? optimisticSession : item));
          return [optimisticSession, ...old];
        }
        if (old && typeof old === 'object' && 'items' in old) {
          const o = old as { items: any[] };
          if (params.isEdit) return { ...o, items: o.items.map((item) => (item.id === params.editSessionId ? optimisticSession : item)) };
          return { ...o, items: [optimisticSession, ...o.items] };
        }
        return old;
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['sessions'], context.previous);
      showAlert('Save Failed', 'Workout save failed — please try again.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      useWorkoutPreferencesStore.setState({ hasCompletedFirstManualWorkout: true });
    },
  });

  const handleFinishTap = useCallback(() => {
    if (saveWorkoutMutation.isPending) return;
    const completedSets = store.exercises.flatMap((e) => e.sets).filter((s) => s.completed);
    if (completedSets.length === 0) {
      showAlert('No Completed Sets', 'Complete at least one set to save.');
      return;
    }
    setFinishSheetVisible(true);
  }, [store, saveWorkoutMutation.isPending]);

  const handleConfirmFinish = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      // Snapshot state BEFORE finishWorkout() resets the store
      const exercisesSnapshot = [...store.exercises];
      const previousPerformanceSnapshot = { ...store.previousPerformance };
      const isEdit = store.mode === 'edit' && !!store.editSessionId;
      const editSessionId = store.editSessionId ?? undefined;

      const payload = store.finishWorkout(unitSystem);
      payload.client_id = Date.now().toString() + '_' + Math.random().toString(36).slice(2);
      payload.client_updated_at = new Date().toISOString();

      const response = await saveWorkoutMutation.mutateAsync({
        payload,
        isEdit,
        editSessionId,
      });

      setFinishSheetVisible(false);

      // Prepare exercise breakdown data (from snapshot, store is already reset)
      const exerciseBreakdown = exercisesSnapshot
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

      // Check for personal records
      const prs: PersonalRecordResponse[] = response.data?.personal_records ?? [];
      
      // Compute summary from snapshot (store is already reset by finishWorkout)
      const currentSummary = computeWorkoutSummary(exercisesSnapshot);
      const finalRecs = generateRecommendations(sessionHURef.current, {});

      const navigateToSummary = () => {
        store.discardWorkout();
        isNavigatingAway.current = true;
        navigation.navigate('WorkoutSummary', {
          summary: currentSummary,
          duration: elapsedSeconds,
          personalRecords: prs,
          exerciseBreakdown,
          huByMuscle: sessionHURef.current,
          recommendations: finalRecs,
          previousPerformance: previousPerformanceSnapshot,
        });
      };

      // Show PR celebration before navigating, or navigate immediately
      if (prs.length > 0) {
        // Store navigation data in ref for PR celebration onDismiss
        summaryDataRef.current = {
          summary: currentSummary,
          duration: elapsedSeconds,
          personalRecords: prs,
          exerciseBreakdown,
          huByMuscle: sessionHURef.current,
          recommendations: finalRecs,
          previousPerformance: previousPerformanceSnapshot,
        };
        setPrData(prs);
        setPrCelebrationVisible(true);
        // Navigation will be triggered by PRCelebration onDismiss callback
      } else {
        navigateToSummary();
      }
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error, 'Could not save workout. Please try again.');
      // Queue for offline retry if it's a network error (#18)
      if (isNetworkError(error)) {
        // The payload was already built and sent to mutateAsync — retrieve from mutation variables
        const vars = saveWorkoutMutation.variables;
        if (vars?.payload) {
          enqueueOfflineWorkout(vars.payload, vars.isEdit, vars.editSessionId);
          showAlert('Saved Offline', 'No connection. Your workout will be saved when you reconnect.');
        } else {
          showAlert('Save Failed', errorMessage);
        }
      } else {
        showAlert('Save Failed', errorMessage);
      }
    } finally {
      savingRef.current = false;
    }
  }, [store, navigation, unitSystem, elapsedSeconds, muscleGroupMap]);

  const handleSaveAsTemplate = useCallback(async () => {
    if (templateSavingRef.current) return;
    templateSavingRef.current = true;
    try {
      // Build template from current exercises WITHOUT resetting the store
      const templateName = `Workout - ${store.sessionDate || new Date().toLocaleDateString('en-CA')}`;
      const exercises = store.exercises
        .filter(ex => !ex.skipped)
        .map(ex => ({
          exercise_name: ex.exerciseName,
          sets: ex.sets.filter(s => s.setType === 'normal').map(s => ({
            reps: parseInt(s.reps, 10) || 0,
            weight_kg: parseFloat(s.weight) || 0,
            rpe: s.rpe ? parseFloat(s.rpe) : null,
          })),
        }));
      try {
        await api.post('training/user-templates', { name: templateName, exercises });
        showAlert('Template Saved', `"${templateName}" saved.`);
      } catch {
        showAlert('Error', 'Could not save template.');
      }
    } finally {
      templateSavingRef.current = false;
    }
  }, [store]);

  const handlePrDismiss = useCallback(() => {
    setPrCelebrationVisible(false);
    // Navigate using stored params from ref
    if (summaryDataRef.current) {
      store.discardWorkout();
      isNavigatingAway.current = true;
      navigation.navigate('WorkoutSummary', summaryDataRef.current);
      summaryDataRef.current = null;
    }
  }, [store, navigation, isNavigatingAway]);

  return {
    saving: saveWorkoutMutation.isPending,
    isSaving: saveWorkoutMutation.isPending,
    prData,
    prCelebrationVisible,
    finishSheetVisible,
    setFinishSheetVisible,
    handleFinishTap,
    handleConfirmFinish,
    handleSaveAsTemplate,
    handlePrDismiss,
  };
}
