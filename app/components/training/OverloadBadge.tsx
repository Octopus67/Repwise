/**
 * OverloadBadge — Inline progressive overload suggestion display.
 *
 * Renders "💡 Try 27.5kg × 10 (+2.5kg)" with a confidence dot.
 * Tappable to auto-fill the suggestion into the next uncompleted set.
 *
 * Requirements: 4.1, 4.6
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { OverloadSuggestion, UnitSystem } from '../../types/training';
import { convertWeight } from '../../utils/unitConversion';
import { typography, spacing, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';

export interface OverloadBadgeProps {
  suggestion: OverloadSuggestion | null;
  unitSystem: UnitSystem;
  onApply: () => void;
}

const getCONFIDENCE_COLORS = (c: ThemeColors): Record<string, string> => ({
  high: c.semantic.positive,
  medium: c.semantic.warning,
  low: c.text.muted,
});

export const OverloadBadge = React.memo<OverloadBadgeProps>(({
  suggestion,
  unitSystem,
  onApply,
}) => {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  if (!suggestion) return null;

  const displayWeight = convertWeight(suggestion.suggested_weight_kg, unitSystem);
  const unit = unitSystem === 'metric' ? 'kg' : 'lbs';
  const dotColor = getCONFIDENCE_COLORS(c)[suggestion.confidence] ?? c.text.muted;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onApply}
      activeOpacity={0.7}
      accessibilityLabel={`Overload suggestion: Try ${displayWeight} ${unit} times ${suggestion.suggested_reps}`}
      accessibilityRole="button"
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.text}>
        <Icon name="lightbulb" size={14} color={c.text.secondary} /> Try {displayWeight}{unit} × {suggestion.suggested_reps}
        {suggestion.biomechanics_informed ? ' 🧬' : ''}
      </Text>
    </TouchableOpacity>
  );
});

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.accent.primaryMuted,
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    gap: spacing[1],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: c.accent.primary,
  },
});

export default OverloadBadge;
