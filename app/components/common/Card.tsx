import { View, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors, radius, spacing, shadows } from '../../theme/tokens';
import { useThemeColors, getThemeColors, type ThemeColors } from '../../hooks/useThemeColors';
import { useThemeStore } from '../../store/useThemeStore';
import { getThemedShadow } from '../../theme/themedShadows';
import { usePressAnimation } from '../../hooks/usePressAnimation';
import { useHoverState } from '../../hooks/useHoverState';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance';

type CardVariant = 'flat' | 'raised' | 'outlined';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  animated?: boolean;
  animationIndex?: number;
  /** @deprecated Use variant='raised' instead */
  raised?: boolean;
}

/**
 * Returns computed styles for a given card variant.
 * Exported for testing (Property 9).
 */
export function getCardStyles(
  variant: CardVariant,
  themeColors: ThemeColors = colors,
  theme: 'dark' | 'light' = 'dark',
): ViewStyle {
  const base: ViewStyle = {
    padding: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
  };

  switch (variant) {
    case 'flat':
      base.backgroundColor = themeColors.bg.surface;
      base.borderColor = themeColors.border.subtle;
      break;
    case 'raised':
      base.backgroundColor = themeColors.bg.surfaceRaised;
      base.borderColor = themeColors.border.default;
      base.borderTopColor = themeColors.border.highlight;
      Object.assign(base, getThemedShadow('md', theme));
      break;
    case 'outlined':
      base.backgroundColor = 'transparent';
      base.borderColor = themeColors.border.default;
      break;
  }

  return base;
}


export function Card({
  children,
  variant = 'flat',
  style,
  onPress,
  animated = false,
  animationIndex = 0,
  raised,
}: CardProps) {
  const c = useThemeColors();
  const theme = useThemeStore((s) => s.theme);
  // Support legacy raised prop
  const resolvedVariant = raised && variant === 'flat' ? 'raised' : variant;
  const effectiveTheme: 'dark' | 'light' = theme === 'light' ? 'light' : 'dark';
  const cardStyles = getCardStyles(resolvedVariant, c, effectiveTheme);

  const { animatedStyle: pressStyle, onPressIn, onPressOut } = usePressAnimation();
  const { isHovered, hoverProps } = useHoverState();
  const entranceStyle = useStaggeredEntrance(animationIndex);

  const hoverBorder = isHovered && onPress ? { borderColor: c.border.hover } : undefined;

  const content = onPress ? (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={0.8}
      accessibilityRole="button"
      style={[cardStyles, hoverBorder, style]}
      {...hoverProps}
    >
      {children}
    </TouchableOpacity>
  ) : (
    <View style={[cardStyles, style]}>{children}</View>
  );

  if (animated || onPress) {
    return (
      <Animated.View style={[onPress ? pressStyle : undefined, animated ? entranceStyle : undefined]}>
        {content}
      </Animated.View>
    );
  }

  return content;
}
