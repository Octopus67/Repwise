import { useEffect } from 'react';
import {
  useSharedValue,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useReduceMotion } from './useReduceMotion';

/**
 * Pure interpolation function.
 * Computes the value at a given progress between start and end.
 */
export function interpolateValue(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

/**
 * Hook that returns a Reanimated SharedValue which animates from its current
 * value to the target over `duration` ms. On target change mid-animation,
 * cancels the current animation and starts from the current interpolated value.
 *
 * When reduce-motion is enabled, snaps immediately to the target value
 * with no counting animation.
 */
export function useCountingValue(target: number, duration = 400) {
  const reduceMotion = useReduceMotion();
  const value = useSharedValue(target);

  useEffect(() => {
    if (reduceMotion) {
      // Snap immediately to target — no animation
      cancelAnimation(value);
      value.value = target;
      return;
    }

    // Cancel any in-flight animation so we start from the current interpolated value
    cancelAnimation(value);
    value.value = withTiming(target, {
      duration,
      easing: Easing.out(Easing.ease),
    });
  }, [target, duration, reduceMotion]);

  return value;
}
