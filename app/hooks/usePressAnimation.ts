import { useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { springs } from '../theme/tokens';
import { useReduceMotion } from './useReduceMotion';

const STATIC_STYLE = { transform: [{ scale: 1 }], opacity: 1 };

/**
 * Hook that provides a subtle press-in / press-out scale + opacity animation.
 * Uses spring physics from design tokens for a premium feel.
 * Returns an animated style and press handlers to attach to a Touchable.
 *
 * When reduce-motion is enabled, returns static style with scale: 1, opacity: 1
 * and no-op press handlers — no animation occurs.
 */
export function usePressAnimation() {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const pressOpacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: pressOpacity.value,
  }));

  const onPressIn = useCallback(() => {
    if (reduceMotion) return;
    scale.value = withSpring(0.97, springs.snappy);
    pressOpacity.value = withSpring(0.9, springs.snappy);
  }, [reduceMotion]);

  const onPressOut = useCallback(() => {
    if (reduceMotion) return;
    scale.value = withSpring(1.0, springs.snappy);
    pressOpacity.value = withSpring(1.0, springs.snappy);
  }, [reduceMotion]);

  if (reduceMotion) {
    return { animatedStyle: STATIC_STYLE, onPressIn, onPressOut };
  }

  return { animatedStyle, onPressIn, onPressOut };
}
