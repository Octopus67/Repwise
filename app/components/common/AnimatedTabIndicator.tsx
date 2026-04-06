import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { springs } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';

interface Props {
  activeIndex: number;
  tabCount: number;
  containerWidth: number;
}

/**
 * Sliding gradient pill indicator for tab selectors.
 * Animates translateX to the active tab position with spring physics.
 */
export function AnimatedTabIndicator({ activeIndex, tabCount, containerWidth }: Props) {
  const c = useThemeColors();
  const tabWidth = containerWidth / tabCount;
  const translateX = useSharedValue(activeIndex * tabWidth);

  useEffect(() => {
    translateX.value = withSpring(activeIndex * tabWidth, springs.snappy);
  }, [activeIndex, tabWidth]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: tabWidth,
  }));

  if (containerWidth === 0) return null;

  return (
    <Animated.View style={[styles.indicator, animStyle]}>
      <LinearGradient
        colors={[c.accent.primary, c.accent.primaryHover]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.pill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    paddingHorizontal: 8,
  },
  pill: {
    flex: 1,
    borderRadius: 2,
  },
});
