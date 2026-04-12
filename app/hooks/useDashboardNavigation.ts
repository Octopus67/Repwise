import { useCallback, useRef } from 'react';
import { useHaptics } from './useHaptics';
import { isPremiumWorkoutLoggerEnabled } from '../utils/featureFlags';

interface NavigationActions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigate?: (...args: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  push?: (...args: any[]) => void;
}

interface UseDashboardNavigationParams {
  navigation: NavigationActions;
  openNutrition: (mealName?: string) => void;
  openTraining: () => void;
  openMealBuilder: () => void;
  openBodyweight: () => void;
  openCheckin: () => void;
  openUpgrade: () => void;
}

export function useDashboardNavigation({
  navigation,
  openNutrition,
  openTraining,
  openMealBuilder,
  openBodyweight,
  openCheckin,
  openUpgrade,
}: UseDashboardNavigationParams) {
  const { impact } = useHaptics();
  const startingRef = useRef(false);

  const handleArticlePress = useCallback((articleId: string) => {
    navigation?.navigate?.('ArticleDetail', { articleId });
  }, [navigation]);

  const handleAddToSlot = useCallback((slotName: string) => {
    openNutrition(slotName);
  }, [openNutrition]);

  const handleQuickAction = useCallback((action: () => void) => {
    impact('light');
    action();
  }, [impact]);

  const handleStartWorkout = useCallback(() => {
    if (startingRef.current) return;
    startingRef.current = true;
    if (isPremiumWorkoutLoggerEnabled()) {
      navigation.push?.('ActiveWorkout', { mode: 'new' });
    } else {
      openTraining();
    }
    setTimeout(() => { startingRef.current = false; }, 1000);
  }, [navigation, openTraining]);

  const handleSessionPress = useCallback((sessionId: string) => {
    navigation?.navigate?.('SessionDetail', { sessionId });
  }, [navigation]);

  const handleResumeWorkout = useCallback(() => {
    navigation?.navigate?.('ActiveWorkout');
  }, [navigation]);

  const handleNavigateAnalytics = useCallback((params?: Record<string, unknown>) => {
    navigation?.navigate?.('Analytics', params);
  }, [navigation]);

  const handleNavigateLearn = useCallback(() => {
    navigation?.navigate?.('Learn');
  }, [navigation]);

  return {
    handleArticlePress,
    handleAddToSlot,
    handleQuickAction,
    handleStartWorkout,
    handleSessionPress,
    handleResumeWorkout,
    handleNavigateAnalytics,
    handleNavigateLearn,
    openNutrition,
    openTraining,
    openMealBuilder,
    openBodyweight,
    openCheckin,
    openUpgrade,
  };
}
