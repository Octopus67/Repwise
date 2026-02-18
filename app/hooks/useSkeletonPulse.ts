import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from './useReduceMotion';
import { motion } from '../theme/tokens';

const STATIC_STYLE = { opacity: 0.5 };

/**
 * Hook that returns an animated opacity style for skeleton loading placeholders.
 * Pulses between 0.3 and 0.7 opacity indefinitely.
 *
 * When reduce-motion is enabled, returns a static opacity of 0.5
 * (midpoint of the pulse range) — no pulsing animation occurs.
 */
export function useSkeletonPulse() {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(reduceMotion ? 0.5 : 0.3);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(
      withTiming(0.7, { duration: motion.duration.pulse }),
      -1,
      true,
    );
  }, [reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (reduceMotion) {
    return STATIC_STYLE;
  }

  return animatedStyle;
}
