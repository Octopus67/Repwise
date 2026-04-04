import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';

interface VerificationBannerProps {
  onVerify: () => void;
  onDismiss: () => void;
}

export function VerificationBanner({ onVerify, onDismiss }: VerificationBannerProps) {
  const c = useThemeColors();
  return (
    <View style={[s.container, { backgroundColor: c.semantic.warningSubtle, borderColor: c.semantic.warning }]}>
      <Icon name="mail" size={16} color={c.semantic.warning} />
      <Text style={[s.text, { color: c.text.primary }]} numberOfLines={2}>
        Verify your email to unlock all features
      </Text>
      <TouchableOpacity onPress={onVerify} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Verify email" accessibilityRole="button">
        <Text style={[s.action, { color: c.semantic.warning }]}>Verify Now</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Dismiss verification banner" accessibilityRole="button">
        <Icon name="x" size={14} color={c.text.muted} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, borderWidth: 1, padding: spacing[3], gap: spacing[2], minHeight: 44 },
  text: { flex: 1, fontSize: typography.size.sm, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.sm },
  action: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, lineHeight: typography.lineHeight.sm },
});
