import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

export type CoachingMode = 'coached' | 'collaborative' | 'manual';

interface CoachingModeSelectorProps {
  value: CoachingMode;
  onChange: (mode: CoachingMode) => void;
}

const MODES: { key: CoachingMode; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    key: 'coached',
    label: 'Coached',
    description: 'App manages your targets weekly',
    icon: 'rocket-outline',
  },
  {
    key: 'collaborative',
    label: 'Collaborative',
    description: 'App suggests, you decide',
    icon: 'people-outline',
  },
  {
    key: 'manual',
    label: 'Manual',
    description: 'You set everything',
    icon: 'construct-outline',
  },
];

export function CoachingModeSelector({ value, onChange }: CoachingModeSelectorProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: c.text.primary }]}>Coaching Mode</Text>
      <Text style={[styles.subheading, { color: c.text.secondary }]}>Choose how the app manages your nutrition targets</Text>
      {MODES.map((mode) => {
        const isSelected = value === mode.key;
        return (
          <TouchableOpacity
            key={mode.key}
            style={[styles.option, isSelected && styles.optionSelected]}
            onPress={() => onChange(mode.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${mode.label}: ${mode.description}`}
          >
            <View style={styles.optionLeft}>
              <Ionicons
                name={mode.icon}
                size={22}
                color={isSelected ? c.accent.primary : c.text.muted}
              />
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {mode.label}
                </Text>
                <Text style={[styles.optionDescription, { color: c.text.muted }]}>{mode.description}</Text>
              </View>
            </View>
            <View style={[styles.radio, isSelected && styles.radioSelected]}>
              {isSelected && <View style={[styles.radioDot, { backgroundColor: c.accent.primary }]} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: { gap: spacing[2] },
  heading: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.lg * typography.lineHeight.tight,
    marginBottom: spacing[1],
  },
  subheading: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    marginBottom: spacing[2],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[3],
    minHeight: 44,
    borderWidth: 1,
    borderColor: c.border.default,
    borderRadius: radius.md,
    backgroundColor: c.bg.surface,
  },
  optionSelected: {
    borderColor: c.accent.primary,
    backgroundColor: c.accent.primaryMuted,
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1 },
  optionText: { flex: 1 },
  optionLabel: {
    color: c.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    lineHeight: typography.size.base * typography.lineHeight.normal,
  },
  optionLabelSelected: { color: c.accent.primary },
  optionDescription: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.size.xs * typography.lineHeight.normal,
    marginTop: spacing[1],
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: c.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: c.accent.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: c.accent.primary,
  },
});
