import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useReduceMotion } from './useReduceMotion';
import { motion } from '../theme/tokens';

/**
 * Pure function: computes the stagger delay for a given index.
 * Items at index < 8 get `index * staggerDelay` ms; items at index >= 8 get 0 (appear instantly).
 */
export function computeStaggerDelay(index: number, staggerDelay: number): number {
  return index < 8 ? index * staggerDelay : 0;
}

const STATIC_STYLE = { opacity: 1, transform: [{ translateY: 0 }] };

/**
 * Hook that provides a staggered fade-in + slide-up entrance animation.
 * Falls back to a static style on web if Reanimated is unavailable.
 *
 * When reduce-motion is enabled, returns STATIC_STYLE immediately
 * (opacity: 1, translateY: 0) — no entrance animation occurs.
 */
export function useStaggeredEntrance(index: number, staggerDelay = 60) {
  const reduceMotion = useReduceMotion();
  const isInitialLoad = useRef(true);
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : 12);

  useEffect(() => {
    if (reduceMotion) return;
    if (!isInitialLoad.current) return;
    isInitialLoad.current = false;

    const delay = computeStaggerDelay(index, staggerDelay);
    const animStart = __DEV__ ? Date.now() : 0;

    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: motion.duration.slow, easing: Easing.out(Easing.ease) }),
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: motion.duration.slow, easing: Easing.out(Easing.ease) }),
    );

    // DEV-only: warn if animation takes >500ms (potential jank)
    if (__DEV__) {
      const expectedDuration = delay + motion.duration.slow;
      setTimeout(() => {
        const elapsed = Date.now() - animStart;
        if (elapsed > 500 && elapsed > expectedDuration * 1.2) {
          console.warn(`[useStaggeredEntrance] index=${index} took ${elapsed}ms (expected ~${expectedDuration}ms) — potential jank`);
        }
      }, delay + motion.duration.slow + 50);
    }
  }, []); // mount only

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Reduce-motion: return static fully-visible style
  if (reduceMotion) {
    return STATIC_STYLE;
  }

  // Web fallback: if Platform is web, return static style to avoid Reanimated issues
  if (Platform.OS === 'web') {
    return STATIC_STYLE;
  }

  return animatedStyle;
}
