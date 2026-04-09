import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemeColors, type ThemeColors } from '../../../theme/colors';
import { spacing, typography } from '../../../theme/tokens';
import { Button } from '../../../components/common/Button';
import { useHaptics } from '../../../hooks/useHaptics';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const DISCLAIMER_POINTS = [
  'Repwise provides general fitness and nutrition information — it is not a substitute for professional medical advice, diagnosis, or treatment.',
  'Always consult your physician or qualified health provider before starting any new exercise program, diet, or supplement regimen.',
  'If you experience pain, dizziness, or discomfort during exercise, stop immediately and seek medical attention.',
  'Nutritional targets and coaching recommendations are estimates based on the information you provide and may not be appropriate for everyone.',
  'Do not disregard professional medical advice or delay seeking it because of information provided by this app.',
];

export function HealthDisclaimerStep({ onNext, onBack }: Props) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const { impact } = useHaptics();
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    setAccepted(true);
    impact('light');
    onNext();
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={[styles.heading, { color: c.text.primary }]}>
        Health Disclaimer
      </Text>
      <Text style={[styles.subheading, { color: c.text.secondary }]}>
        Please read before continuing
      </Text>

      <View style={[styles.card, { backgroundColor: c.surface.secondary }]}>
        {DISCLAIMER_POINTS.map((point, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={[styles.bullet, { color: c.accent.primary }]}>•</Text>
            <Text style={[styles.bulletText, { color: c.text.primary }]}>
              {point}
            </Text>
          </View>
        ))}
      </View>

      <Button
        title="I Understand"
        onPress={handleAccept}
        disabled={accepted}
        style={styles.cta}
      />
      <Button
        title="Back"
        onPress={onBack}
        variant="ghost"
        style={styles.backBtn}
      />
    </ScrollView>
  );
}

const getThemedStyles = (c: ThemeColors) =>
  StyleSheet.create({
    scroll: {
      flexGrow: 1,
      paddingHorizontal: spacing[5],
      paddingTop: spacing[8],
      paddingBottom: spacing[6],
    },
    heading: {
      fontSize: typography.size['2xl'],
      fontWeight: typography.weight.bold as '700',
      marginBottom: spacing[2],
    },
    subheading: {
      fontSize: typography.size.base,
      lineHeight: typography.lineHeight.base,
      marginBottom: spacing[6],
    },
    card: {
      borderRadius: 12,
      padding: spacing[4],
      marginBottom: spacing[6],
    },
    bulletRow: {
      flexDirection: 'row',
      marginBottom: spacing[3],
    },
    bullet: {
      fontSize: typography.size.lg,
      marginRight: spacing[2],
      marginTop: -2,
    },
    bulletText: {
      flex: 1,
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
    },
    cta: {
      marginBottom: spacing[3],
    },
    backBtn: {
      marginBottom: spacing[2],
    },
  });
