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
import { radius, spacing, typography, motion } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';
import type { PersonalRecordResponse } from '../../types/training';
import { useHaptics } from '../../hooks/useHaptics';
import { haptic } from '../../utils/haptics';
import { GoldParticleBurst } from './GoldParticleBurst';

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
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const { notification: hapticNotification } = useHaptics();
  const shakeX = useSharedValue(0);

  const dismiss = useCallback(() => {
    onDismissRef.current();
  }, []);

  useEffect(() => {
    if (visible && prs.length > 0) {
      haptic.heavy();
      // Screen shake
      shakeX.value = withSequence(
        withTiming(-2, { duration: 50 }),
        withTiming(2, { duration: 50 }),
        withTiming(-1, { duration: 50 }),
        withTiming(1, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
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
    transform: [{ translateX: shakeX.value }],
  }));

  const animatedBanner = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!visible || prs.length === 0) return null;

  return (
    <TouchableWithoutFeedback onPress={handleTap} accessibilityRole="alert">
      <Animated.View style={[styles.overlay, animatedOverlay]}>
        <Animated.View style={[styles.banner, animatedBanner]} accessibilityRole="alert" accessibilityLabel={`${prs.length === 1 ? 'New personal record' : `${prs.length} new personal records`}`}>
          <Icon name="trophy" size={48} color={c.premium.gold} />
          <GoldParticleBurst />
          <Text style={[styles.title, { color: c.premium.gold }]}>
            {prs.length === 1 ? 'New PR!' : `${prs.length} New PRs!`}
          </Text>
          {prs.map((pr, i) => (
            <Text key={`${pr.exercise_name}-${i}`} style={[styles.prText, { color: c.text.primary }]}>
              {pr.exercise_name} — {pr.new_weight_kg}kg × {pr.reps}
            </Text>
          ))}
        </Animated.View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  banner: {
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.premium.gold,
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
    color: c.premium.gold,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight['2xl'],
    marginBottom: spacing[3],
  },
  prText: {
    color: c.text.primary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    marginBottom: spacing[1],
    textAlign: 'center',
  },
});
