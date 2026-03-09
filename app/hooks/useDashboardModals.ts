import { useState, useCallback } from 'react';

export interface DashboardModals {
  showUpgrade: boolean;
  showNutrition: boolean;
  showTraining: boolean;
  showBodyweight: boolean;
  showQuickAdd: boolean;
  showMealBuilder: boolean;
  showCheckin: boolean;
  prefilledMealName: string | undefined;
}

export function useDashboardModals() {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const [showBodyweight, setShowBodyweight] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showMealBuilder, setShowMealBuilder] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [prefilledMealName, setPrefilledMealName] = useState<string | undefined>(undefined);

  const openNutrition = useCallback((mealName?: string) => {
    if (mealName) setPrefilledMealName(mealName);
    setShowNutrition(true);
  }, []);

  const closeNutrition = useCallback(() => {
    setShowNutrition(false);
    setPrefilledMealName(undefined);
  }, []);

  const openUpgrade = useCallback(() => setShowUpgrade(true), []);
  const closeUpgrade = useCallback(() => setShowUpgrade(false), []);
  const openTraining = useCallback(() => setShowTraining(true), []);
  const closeTraining = useCallback(() => setShowTraining(false), []);
  const openBodyweight = useCallback(() => setShowBodyweight(true), []);
  const closeBodyweight = useCallback(() => setShowBodyweight(false), []);
  const openQuickAdd = useCallback(() => setShowQuickAdd(true), []);
  const closeQuickAdd = useCallback(() => setShowQuickAdd(false), []);
  const openMealBuilder = useCallback(() => setShowMealBuilder(true), []);
  const closeMealBuilder = useCallback(() => setShowMealBuilder(false), []);
  const openCheckin = useCallback(() => setShowCheckin(true), []);
  const closeCheckin = useCallback(() => setShowCheckin(false), []);

  const modals: DashboardModals = {
    showUpgrade,
    showNutrition,
    showTraining,
    showBodyweight,
    showQuickAdd,
    showMealBuilder,
    showCheckin,
    prefilledMealName,
  };

  return {
    modals,
    openNutrition,
    closeNutrition,
    openUpgrade,
    closeUpgrade,
    openTraining,
    closeTraining,
    openBodyweight,
    closeBodyweight,
    openQuickAdd,
    closeQuickAdd,
    openMealBuilder,
    closeMealBuilder,
    openCheckin,
    closeCheckin,
  };
}
