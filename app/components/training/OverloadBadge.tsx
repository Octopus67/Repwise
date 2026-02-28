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
import { colors, typography, spacing, radius } from '../../theme/tokens';

export interface OverloadBadgeProps {
  suggestion: OverloadSuggestion | null;
  unitSystem: UnitSystem;
  onApply: () => void;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: colors.semantic.positive,
  medium: colors.semantic.warning,
  low: colors.text.muted,
};

export const OverloadBadge: React.FC<OverloadBadgeProps> = ({
  suggestion,
  unitSystem,
  onApply,
}) => {
  if (!suggestion) return null;

  const displayWeight = convertWeight(suggestion.suggested_weight_kg, unitSystem);
  const unit = unitSystem === 'metric' ? 'kg' : 'lbs';
  const dotColor = CONFIDENCE_COLORS[suggestion.confidence] ?? colors.text.muted;

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
        💡 Try {displayWeight}{unit} × {suggestion.suggested_reps}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.primaryMuted,
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
    color: colors.accent.primary,
  },
});

export default OverloadBadge;
