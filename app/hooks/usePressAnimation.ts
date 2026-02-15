import { useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { springs } from '../theme/tokens';

/**
 * Hook that provides a subtle press-in / press-out scale + opacity animation.
 * Uses spring physics from design tokens for a premium feel.
 * Returns an animated style and press handlers to attach to a Touchable.
 */
export function usePressAnimation() {
  const scale = useSharedValue(1);
  const pressOpacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: pressOpacity.value,
  }));

  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.97, springs.snappy);
    pressOpacity.value = withSpring(0.9, springs.snappy);
  }, []);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1.0, springs.snappy);
    pressOpacity.value = withSpring(1.0, springs.snappy);
  }, []);

  return { animatedStyle, onPressIn, onPressOut };
}
