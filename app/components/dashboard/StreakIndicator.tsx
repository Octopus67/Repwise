import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { typography, spacing, glowShadow, colors } from '../../theme/tokens';
import { useThemeColors, ThemeColors, getThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';
import { useCountingValue } from '../../hooks/useCountingValue';
import { haptic } from '../../utils/haptics';

// Conditionally import LottieView
let LottieView: any = null;
try { LottieView = require('lottie-react-native').default; } catch {}

interface StreakIndicatorProps {
  count: number;
  type?: 'day' | 'week';
}

type Tier = { label: string; size: number; glow?: ReturnType<typeof glowShadow> };

function getTier(count: number): Tier {
  if (count >= 30) return { label: 'Legendary', size: 40, glow: glowShadow(colors.premium.gold, 16, 0.4) };
  if (count >= 7) return { label: 'Committed', size: 32, glow: glowShadow(colors.semantic.warning, 12, 0.3) };
  return { label: 'Building', size: 24 };
}

export function StreakIndicator({ count, type = 'week' }: StreakIndicatorProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const tier = getTier(count);
  const legendaryTriggered = useRef(false);
  const countValue = useCountingValue(count);

  useEffect(() => {
    if (count >= 30 && !legendaryTriggered.current) {
      legendaryTriggered.current = true;
      haptic.success();
    }
    if (count < 30) legendaryTriggered.current = false;
  }, [count]);

  if (count === 0) return null;

  return (
    <View style={styles.container}>
      <View style={tier.glow ? [{ borderRadius: tier.size / 2 }, tier.glow] : undefined}>
        {LottieView ? (
          <LottieView
            source={require('../../assets/animations/flame.json')}
            autoPlay
            loop
            style={{ width: tier.size, height: tier.size }}
          />
        ) : (
          <Icon name="flame" size={tier.size * 0.6} color={colors.premium.gold} />
        )}
      </View>
      <AnimatedCount value={countValue} type={type} styles={styles} />
      <Text style={styles.tierLabel}>{tier.label}</Text>
    </View>
  );
}

const AnimatedText = Animated.createAnimatedComponent(Text);

function AnimatedCount({ value, type, styles }: { value: SharedValue<number>; type: string; styles: any }) {
  const animatedProps = useAnimatedProps(() => ({
    text: `${Math.round(value.value)} ${type} streak`,
  } as any));

  return <AnimatedText animatedProps={animatedProps} style={styles.count}>{`${Math.round(value.value)} ${type} streak`}</AnimatedText>;
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing[0.5],
  },
  count: {
    color: c.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.sm,
  },
  tierLabel: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});
