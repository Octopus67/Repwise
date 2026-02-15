import { useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { useOnboardingStore } from '../../store/onboardingSlice';

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

const TOTAL_STEPS = 10;

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingWizard({ onComplete, onSkip }: Props) {
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const setStep = useOnboardingStore((s) => s.setStep);
  const reset = useOnboardingStore((s) => s.reset);

  // Progress bar animation
  const progress = useSharedValue(currentStep / TOTAL_STEPS);
  useEffect(() => {
    progress.value = withTiming(currentStep / TOTAL_STEPS, { duration: 300, easing: Easing.out(Easing.ease) });
  }, [currentStep]);


  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const goNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      setStep(currentStep + 1);
    }
  }, [currentStep, setStep]);

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setStep(currentStep - 1);
    }
  }, [currentStep, setStep]);

  const handleComplete = useCallback(() => {
    reset();
    onComplete();
  }, [reset, onComplete]);

  const handleSkip = useCallback(() => {
    reset();
    onSkip();
  }, [reset, onSkip]);

  // Jump to a specific step (used by Summary screen's edit links)
  const jumpToStep = useCallback((step: number) => {
    setStep(step);
  }, [setStep]);

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <IntentStep onNext={goNext} onSkip={handleSkip} />;
      case 2: return <BodyBasicsStep onNext={goNext} onBack={goBack} />;
      case 3: return <BodyMeasurementsStep onNext={goNext} onBack={goBack} />;
      case 4: return <BodyCompositionStep onNext={goNext} onBack={goBack} onSkip={goNext} />;
      case 5: return <LifestyleStep onNext={goNext} onBack={goBack} />;
      case 6: return <TDEERevealStep onNext={goNext} onBack={goBack} />;
      case 7: return <GoalStep onNext={goNext} onBack={goBack} />;
      case 8: return <DietStyleStep onNext={goNext} onBack={goBack} />;
      case 9: return <FoodDNAStep onNext={goNext} onBack={goBack} onSkip={goNext} />;
      case 10: return <SummaryStep onComplete={handleComplete} onBack={goBack} onEditStep={jumpToStep} />;
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>
        <Text style={styles.stepCounter}>Step {currentStep} of {TOTAL_STEPS}</Text>
      </View>

      {/* Back button (hidden on step 1) */}
      {currentStep > 1 && (
        <TouchableOpacity onPress={goBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      )}

      {/* Current step content */}
      <View style={styles.content}>
        {renderStep()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  progressContainer: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.border.subtle,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
    borderRadius: 2,
  },
  stepCounter: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    textAlign: 'right',
    marginTop: spacing[1],
  },
  backButton: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
  },
  backText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
  },
});