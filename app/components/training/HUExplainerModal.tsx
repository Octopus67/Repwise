/**
 * HUExplainerModal — Explains the Hard Units concept to users.
 *
 * Triggered by tapping the info icon on the HU badge in ExerciseCardPremium.
 * Uses ModalContainer for consistent sheet/dialog behavior.
 *
 * Requirements: Feature 6, Step 10
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ModalContainer } from '../common/ModalContainer';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors } from '../../hooks/useThemeColors';

interface HUExplainerModalProps {
  visible: boolean;
  exerciseName?: string;
  currentHU?: number;
  onClose: () => void;
}

const CONCEPTS = [
  {
    title: 'What are Hard Units?',
    body: 'Hard Units (HU) measure effective training stimulus per muscle group. Only reps close to failure count — easy warm-up reps don\'t add HU.',
  },
  {
    title: 'How are they calculated?',
    body: 'Each set contributes stimulating reps based on how close you are to failure (RPE/RIR). Additional sets have diminishing returns — your 6th set adds less stimulus than your 1st.',
  },
  {
    title: 'Why does this matter?',
    body: 'Training within your optimal HU range maximizes muscle growth while managing fatigue. Too little = under-stimulation. Too much = excess fatigue without extra growth.',
  },
] as const;

export function HUExplainerModal({ visible, exerciseName, currentHU, onClose }: HUExplainerModalProps) {
  const c = useThemeColors();

  return (
    <ModalContainer visible={visible} onClose={onClose} title="Understanding Hard Units">
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {exerciseName != null && currentHU != null && (
          <View style={[styles.currentBox, { backgroundColor: c.accent.primaryMuted }]}>
            <Text style={[styles.currentLabel, { color: c.text.secondary }]}>{exerciseName}</Text>
            <Text style={[styles.currentValue, { color: c.accent.primary }]}>{currentHU.toFixed(1)} HU</Text>
          </View>
        )}

        {CONCEPTS.map((item) => (
          <View key={item.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text.primary }]}>{item.title}</Text>
            <Text style={[styles.sectionBody, { color: c.text.secondary }]}>{item.body}</Text>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: c.accent.primary }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Got it"
      >
        <Text style={[styles.buttonText, { color: c.text.inverse }]}>Got it</Text>
      </TouchableOpacity>
    </ModalContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 380 },
  currentBox: {
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[4],
    alignItems: 'center',
  },
  currentLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
  currentValue: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  section: { marginBottom: spacing[4] },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[1],
  },
  sectionBody: {
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
    marginTop: spacing[4],
  },
  buttonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});
