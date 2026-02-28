import { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { colors, radius, spacing, typography, motion } from '../../theme/tokens';
import type { PersonalRecordResponse } from '../../types/training';

interface PRCelebrationProps {
  prs: PersonalRecordResponse[];
  visible: boolean;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 3000;

export function PRCelebration({
  prs,
  visible,
  onDismiss,
}: PRCelebrationProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const dismiss = useCallback(() => {
    onDismissRef.current();
  }, []);

  useEffect(() => {
    if (visible && prs.length > 0) {
      // Animate in
      opacity.value = withTiming(1, { duration: motion.duration.slow });
      scale.value = withSequence(
        withTiming(1.05, { duration: 200 }),
        withTiming(1, { duration: 150 }),
      );

      // Auto-dismiss after 3 seconds
      timerRef.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: motion.duration.default }, () => {
          runOnJS(dismiss)();
        });
      }, AUTO_DISMISS_MS);
    } else {
      opacity.value = 0;
      scale.value = 0.8;
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, prs.length, opacity, scale, dismiss]);

  const handleTap = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    opacity.value = withTiming(0, { duration: motion.duration.fast }, () => {
      runOnJS(dismiss)();
    });
  }, [opacity, dismiss]);

  const animatedOverlay = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const animatedBanner = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!visible || prs.length === 0) return null;

  return (
    <TouchableWithoutFeedback onPress={handleTap} accessibilityRole="alert">
      <Animated.View style={[styles.overlay, animatedOverlay]}>
        <Animated.View style={[styles.banner, animatedBanner]} accessibilityRole="alert" accessibilityLabel={`${prs.length === 1 ? 'New personal record' : `${prs.length} new personal records`}`}>
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.title}>
            {prs.length === 1 ? 'New PR!' : `${prs.length} New PRs!`}
          </Text>
          {prs.map((pr, i) => (
            <Text key={`${pr.exercise_name}-${i}`} style={styles.prText}>
              {pr.exercise_name} — {pr.new_weight_kg}kg × {pr.reps}
            </Text>
          ))}
        </Animated.View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  banner: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.premium.gold,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[6],
    alignItems: 'center',
    maxWidth: 320,
  },
  trophy: {
    fontSize: 48,
    marginBottom: spacing[3],
  },
  title: {
    color: colors.premium.gold,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight['2xl'],
    marginBottom: spacing[3],
  },
  prText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    marginBottom: spacing[1],
    textAlign: 'center',
  },
});
