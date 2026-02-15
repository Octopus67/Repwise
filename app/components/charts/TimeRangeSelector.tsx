import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';

const OPTIONS = ['7d', '14d', '30d', '90d'] as const;

interface TimeRangeSelectorProps {
  selected: string;
  onSelect: (range: string) => void;
}

export function TimeRangeSelector({ selected, onSelect }: TimeRangeSelectorProps) {
  return (
    <View style={styles.container}>
      {OPTIONS.map((option) => {
        const isActive = selected === option;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.segment, isActive && styles.segmentActive]}
            onPress={() => onSelect(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${option} time range`}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.sm,
    padding: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderRadius: radius.sm - 2,
  },
  segmentActive: {
    backgroundColor: colors.accent.primary,
  },
  label: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  labelActive: {
    color: colors.text.inverse,
    fontWeight: typography.weight.semibold,
  },
});
