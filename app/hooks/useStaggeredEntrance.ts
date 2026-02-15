import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

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
 */
export function useStaggeredEntrance(index: number, staggerDelay = 60) {
  const isInitialLoad = useRef(true);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    if (!isInitialLoad.current) return;
    isInitialLoad.current = false;

    const delay = computeStaggerDelay(index, staggerDelay);

    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) }),
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) }),
    );
  }, []); // mount only

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Web fallback: if Platform is web, return static style to avoid Reanimated issues
  if (Platform.OS === 'web') {
    return STATIC_STYLE;
  }

  return animatedStyle;
}
