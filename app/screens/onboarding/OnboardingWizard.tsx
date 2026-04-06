// DEFERRED: Food DNA step (step 9) is skipped for v1 launch.
import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import Animated from 'react-native-reanimated';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { useStepTransition } from '../../hooks/useStepTransition';
import { useHaptics } from '../../hooks/useHaptics';
import { useOnboardingStore } from '../../store/onboardingSlice';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

// Step components (will be created in subsequent tasks)
import { IntentStep } from './steps/IntentStep';
import { BodyBasicsStep } from './steps/BodyBasicsStep';
import { BodyMeasurementsStep } from './steps/BodyMeasurementsStep';
import { BodyCompositionStep } from './steps/BodyCompositionStep';
import { LifestyleStep } from './steps/LifestyleStep';
import { TDEERevealStep } from './steps/TDEERevealStep';
import { GoalStep } from './steps/GoalStep';
import { DietStyleStep } from './steps/DietStyleStep';
import { FoodDNAStep } from './steps/FoodDNAStep';
import { SummaryStep } from './steps/SummaryStep';

import { ONBOARDING_STEPS, TOTAL_STEPS, DISPLAY_TOTAL_STEPS } from './stepConstants';
import { OnboardingProgress } from '../../components/onboarding/OnboardingProgress';

interface Props {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const setStep = useOnboardingStore((s) => s.setStep);
  const reset = useOnboardingStore((s) => s.reset);

  const stepTransitionStyle = useStepTransition(currentStep);
  const { impact } = useHaptics();

  const goNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      impact('light');
      // Skip FOOD_DNA (step 9) — go straight from DIET_STYLE to SUMMARY
      const next = currentStep === ONBOARDING_STEPS.DIET_STYLE
        ? ONBOARDING_STEPS.SUMMARY
        : currentStep + 1;
      setStep(next);
    }
  }, [currentStep, setStep, impact]);

  const goBack = useCallback(() => {
    if (currentStep <= 1) return;
    impact('light');
    // Skip FOOD_DNA (step 9) when going back from SUMMARY
    const prev = currentStep === ONBOARDING_STEPS.SUMMARY
      ? ONBOARDING_STEPS.DIET_STYLE
      : currentStep - 1;
    setStep(prev);
  }, [currentStep, setStep, impact]);

  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Jump to a specific step (used by Summary screen's edit links)
  const jumpToStep = useCallback((step: number) => {
    setStep(step);
  }, [setStep]);

  // Map internal step index to display number (FOOD_DNA skipped)
  const displayStep = currentStep > ONBOARDING_STEPS.DIET_STYLE
    ? Math.min(currentStep - 1, DISPLAY_TOTAL_STEPS)
    : Math.min(currentStep, DISPLAY_TOTAL_STEPS);

  const renderStep = () => {
    switch (currentStep) {
      case ONBOARDING_STEPS.INTENT: return <IntentStep onNext={goNext} />;
      case ONBOARDING_STEPS.BODY_BASICS: return <BodyBasicsStep onNext={goNext} onBack={goBack} />;
      case ONBOARDING_STEPS.BODY_MEASUREMENTS: return <BodyMeasurementsStep onNext={goNext} onBack={goBack} />;
      case ONBOARDING_STEPS.BODY_COMPOSITION: return <BodyCompositionStep onNext={goNext} onBack={goBack} onSkip={goNext} />;
      case ONBOARDING_STEPS.LIFESTYLE: return <LifestyleStep onNext={goNext} onBack={goBack} />;
      case ONBOARDING_STEPS.TDEE_REVEAL: return <TDEERevealStep onNext={goNext} onBack={goBack} />;
      case ONBOARDING_STEPS.GOAL: return <GoalStep onNext={goNext} onBack={goBack} />;
      case ONBOARDING_STEPS.DIET_STYLE: return <DietStyleStep onNext={goNext} onBack={goBack} />;
      case ONBOARDING_STEPS.FOOD_DNA: return <FoodDNAStep onNext={goNext} onBack={goBack} onSkip={goNext} />;
      case ONBOARDING_STEPS.SUMMARY: return <SummaryStep onComplete={handleComplete} onBack={goBack} onEditStep={jumpToStep} />;
      default: return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bg.base }]}>
      <ErrorBoundary
        onError={(error, errorInfo) => {
          console.error('[ErrorBoundary:Onboarding]', error.message);
          console.error('[ErrorBoundary:Onboarding] Stack:', error.stack);
        }}
        fallback={(error, retry) => (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorTitle, { color: c.text.primary }]}>Something went wrong</Text>
            <Text style={[styles.errorMessage, { color: c.text.secondary }]}>We encountered an error during onboarding.</Text>
            <TouchableOpacity 
              style={[styles.restartButton, { backgroundColor: c.accent.primary }]} 
              onPress={() => {
                reset();
                setStep(1);
              }}
              accessibilityLabel="Restart onboarding"
              accessibilityRole="button"
            >
              <Text style={styles.restartButtonText}>Restart</Text>
            </TouchableOpacity>
          </View>
        )}
      >
        {/* Progress indicator */}
        <OnboardingProgress current={displayStep} total={DISPLAY_TOTAL_STEPS} />

        {/* Back button (hidden on step 1) */}
        {currentStep > 1 && (
          <TouchableOpacity onPress={goBack} style={styles.backButton} activeOpacity={0.7} accessibilityLabel="Go back" accessibilityRole="button">
            <Text style={[styles.backText, { color: c.text.secondary }]}>← Back</Text>
          </TouchableOpacity>
        )}

        {/* Current step content */}
        <Animated.View style={[styles.content, stepTransitionStyle]}>
          {renderStep()}
        </Animated.View>
      </ErrorBoundary>
    </SafeAreaView>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg.base,
  },
  backButton: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
  },
  backText: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  errorTitle: {
    color: c.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  errorMessage: {
    color: c.text.secondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  restartButton: {
    backgroundColor: c.accent.primary,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
  },
  restartButtonText: {
    color: 'white',
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});