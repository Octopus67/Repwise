import { useEffect } from 'react';
import {
  useSharedValue,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

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
 */
export function useCountingValue(target: number, duration = 400) {
  const value = useSharedValue(target);

  useEffect(() => {
    // Cancel any in-flight animation so we start from the current interpolated value
    cancelAnimation(value);
    value.value = withTiming(target, {
      duration,
      easing: Easing.out(Easing.ease),
    });
  }, [target, duration]);

  return value;
}
