import { View, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors, radius, spacing, shadows } from '../../theme/tokens';
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
export function getCardStyles(variant: CardVariant): ViewStyle {
  const base: ViewStyle = {
    padding: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
  };

  switch (variant) {
    case 'flat':
      base.backgroundColor = colors.bg.surface;
      base.borderColor = colors.border.subtle;
      break;
    case 'raised':
      base.backgroundColor = colors.bg.surfaceRaised;
      base.borderColor = colors.border.default;
      base.borderTopColor = colors.border.highlight;
      Object.assign(base, shadows.md);
      break;
    case 'outlined':
      base.backgroundColor = 'transparent';
      base.borderColor = colors.border.default;
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
  // Support legacy raised prop
  const resolvedVariant = raised && variant === 'flat' ? 'raised' : variant;
  const cardStyles = getCardStyles(resolvedVariant);

  const { animatedStyle: pressStyle, onPressIn, onPressOut } = usePressAnimation();
  const { isHovered, hoverProps } = useHoverState();
  const entranceStyle = useStaggeredEntrance(animationIndex);

  const hoverBorder = isHovered && onPress ? { borderColor: colors.border.hover } : undefined;

  const content = onPress ? (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={0.8}
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
