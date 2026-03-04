/**
 * RPEEducationSheet — Explains RPE and RIR concepts for training intensity
 *
 * Shows on first use when RPE/RIR column is enabled, with 'don't show again' option.
 * Can also be triggered manually via info button in column header.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ModalContainer } from '../common/ModalContainer';
import { colors, spacing, typography, radius } from '../../theme/tokens';

interface RPEEducationSheetProps {
  visible: boolean;
  onClose: () => void;
  onDontShowAgain: () => void;
}

const RPE_GUIDE = [
  { rpe: 'RPE 6', desc: 'Could do 4+ more reps easily' },
  { rpe: 'RPE 7', desc: 'Could do 3 more reps' },
  { rpe: 'RPE 8', desc: 'Could do 2 more reps (recommended for most sets)' },
  { rpe: 'RPE 9', desc: 'Could do 1 more rep' },
  { rpe: 'RPE 10', desc: 'Could not do another rep' },
] as const;

const RIR_GUIDE = [
  { rir: 'RIR 0', desc: 'Failure — no reps left' },
  { rir: 'RIR 1', desc: '1 rep left in the tank' },
  { rir: 'RIR 2', desc: '2 reps left (sweet spot for hypertrophy)' },
  { rir: 'RIR 3', desc: '3 reps left (good for volume work)' },
] as const;

export function RPEEducationSheet({ visible, onClose, onDontShowAgain }: RPEEducationSheetProps) {
  return (
    <ModalContainer visible={visible} onClose={onClose} title="Understanding RPE & RIR">
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* RPE Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RPE — How hard was that set?</Text>
          <Text style={styles.sectionDesc}>
            Scale: 1-10 where 10 = absolute maximum effort
          </Text>
          <View style={styles.guideList}>
            {RPE_GUIDE.map((item) => (
              <View key={item.rpe} style={styles.guideRow}>
                <Text style={styles.guideLabel}>{item.rpe}</Text>
                <Text style={styles.guideDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* RIR Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RIR — How many reps left in the tank?</Text>
          <Text style={styles.sectionDesc}>
            It's the inverse of RPE: RIR 2 = RPE 8
          </Text>
          <View style={styles.guideList}>
            {RIR_GUIDE.map((item) => (
              <View key={item.rir} style={styles.guideRow}>
                <Text style={styles.guideLabel}>{item.rir}</Text>
                <Text style={styles.guideDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Why it matters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why it matters</Text>
          <View style={styles.benefitsList}>
            <Text style={styles.benefitItem}>
              Logging intensity helps the app track your training stimulus accurately
            </Text>
            <Text style={styles.benefitItem}>
              The WNS engine uses RPE/RIR to calculate Hypertrophy Units
            </Text>
            <Text style={styles.benefitItem}>
              Consistent intensity logging improves your volume recommendations
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Got it"
        >
          <Text style={styles.primaryButtonText}>Got it</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onDontShowAgain}
          accessibilityRole="button"
          accessibilityLabel="Don't show again"
        >
          <Text style={styles.secondaryButtonText}>Don't show again</Text>
        </TouchableOpacity>
      </View>
    </ModalContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 400,
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[1],
  },
  sectionDesc: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: 20,
    marginBottom: spacing[3],
  },
  guideList: {
    gap: spacing[2],
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  guideLabel: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    minWidth: 50,
  },
  guideDesc: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: 18,
  },
  benefitsList: {
    gap: spacing[2],
  },
  benefitItem: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'column',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  primaryButton: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.text.inverse,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  secondaryButtonText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
});