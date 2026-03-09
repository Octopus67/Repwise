import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { getThemeColors, useThemeColors} from '../../hooks/useThemeColors';
import type { PasswordStrengthResult, PasswordValidation } from '../../utils/passwordStrength';

interface PasswordStrengthMeterProps {
  result: PasswordStrengthResult;
  password: string;
}

const STRENGTH_CONFIG = {
  weak: { color: '#EF4444', label: 'Weak', segments: 1 },
  fair: { color: '#F59E0B', label: 'Fair', segments: 2 },
  good: { color: '#06B6D4', label: 'Good', segments: 3 },
  strong: { color: '#22C55E', label: 'Strong', segments: 4 },
} as const;

const RULES: { key: keyof PasswordValidation; label: string }[] = [
  { key: 'minLength', label: 'At least 8 characters' },
];

export function PasswordStrengthMeter({ result, password }: PasswordStrengthMeterProps) {
  const c = useThemeColors();
  if (!password) return null;

  const config = STRENGTH_CONFIG[result.level];

  return (
    <View style={styles.container} accessibilityLabel={`Password strength: ${config.label}`}>
      <View style={styles.barRow}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { backgroundColor: i < config.segments ? config.color : c.border.subtle },
            ]}
          />
        ))}
        <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
      </View>
      <View style={styles.rules}>
        {RULES.map(({ key, label }) => {
          const passed = result.validation[key];
          return (
            <Text
              key={key}
              style={[styles.rule, { color: passed ? c.semantic.positive : c.text.muted }]}
              accessibilityLabel={`${label}: ${passed ? 'met' : 'not met'}`}
            >
              {passed ? '✓' : '✗'} {label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing[3] },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginBottom: spacing[2] },
  segment: { flex: 1, height: 4, borderRadius: radius.full },
  label: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, marginLeft: spacing[2] },
  rules: { gap: spacing[0.5] },
  rule: { fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs },
});
