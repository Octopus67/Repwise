/**
 * HUExplainerScreen — Full-screen education page for Hypertrophy Units.
 * Destination for "Learn More →" in the WNS explainer card.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AnalyticsStackParamList } from '../../navigation/BottomTabNavigator';

type Props = NativeStackScreenProps<AnalyticsStackParamList, 'HUExplainer'>;

const HU_SECTIONS = [
  { number: '01', title: 'Stimulating Reps', body: 'Not all reps build muscle equally. Only the last ~5 reps before failure — when your muscles are fully recruited and moving slowly — create enough tension to trigger growth. We call these "stimulating reps."' },
  { number: '02', title: 'Proximity to Failure', body: 'Sets taken close to failure (0–3 reps in reserve) produce the most stimulating reps. Sets with 4+ reps in reserve produce almost no growth stimulus — that\'s "junk volume."' },
  { number: '03', title: 'Direct & Fractional Volume', body: 'Compound exercises train multiple muscles. Bench press gives your chest full credit (1.0×) but also gives your triceps partial credit (0.5×). We track both.' },
  { number: '04', title: 'Diminishing Returns', body: 'Your 1st set of the day produces the most growth. Each additional set contributes less. 6 sets produce roughly 2× the stimulus of 1 set — not 6×.' },
  { number: '05', title: 'Recovery Between Sessions', body: 'Muscle protein synthesis stays elevated for ~48 hours after training. After that, a small amount of atrophy occurs until your next session. Training more frequently reduces this loss.' },
] as const;

const FORMULA_STEPS = [
  { label: 'Stimulating Reps', formula: 'reps × proximity_factor(RIR)', desc: 'Only reps near failure count. RIR 0 = 1.0×, RIR 1 = 0.85×, RIR 2 = 0.70×, RIR 3 = 0.50×, RIR 4+ = 0.0×' },
  { label: 'Set Stimulus', formula: 'stim_reps × diminishing_factor(set_number)', desc: 'Each additional set for a muscle contributes less. Set 1 = 1.0×, Set 2 = 0.95×, Set 6 = 0.75×' },
  { label: 'Muscle Credit', formula: 'set_stimulus × muscle_fraction', desc: 'Direct work = 1.0×. Compound overlap: triceps from bench = 0.5×, biceps from rows = 0.4×' },
  { label: 'Weekly HU', formula: 'Σ(muscle_credit) − inter_session_decay', desc: 'Sum all sessions, subtract decay for gaps >48h between sessions targeting the same muscle' },
] as const;

const COLOR_LEGEND = [
  { label: 'Below MEV', desc: 'Not enough stimulus to grow — add more sets', colorKey: 'belowMev' as const },
  { label: 'Optimal', desc: 'Sweet spot for hypertrophy — keep it here', colorKey: 'optimal' as const },
  { label: 'Approaching MRV', desc: 'High volume — monitor fatigue and recovery', colorKey: 'nearMrv' as const },
  { label: 'Above MRV', desc: 'Exceeding recovery capacity — consider reducing', colorKey: 'aboveMrv' as const },
];

export function HUExplainerScreen({ navigation }: Props) {
  const c = useThemeColors();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bg.base }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: c.text.primary }]}>Hypertrophy Units</Text>
        <Text style={[styles.intro, { color: c.text.secondary }]}>
          Your HU score measures the actual growth stimulus reaching each muscle — not just how many sets you did.
        </Text>

        {/* How it works */}
        <Text style={[styles.sectionHeading, { color: c.text.primary }]}>How It Works</Text>
        {HU_SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <View style={styles.numberRow}>
              <Text style={[styles.sectionNumber, { color: c.accent.primary }]}>{s.number}</Text>
              <Text style={[styles.sectionTitle, { color: c.text.primary }]}>{s.title}</Text>
            </View>
            <Text style={[styles.sectionBody, { color: c.text.secondary }]}>{s.body}</Text>
          </View>
        ))}

        {/* Formula breakdown */}
        <Text style={[styles.sectionHeading, { color: c.text.primary }]}>The Formula</Text>
        {FORMULA_STEPS.map((step) => (
          <View key={step.label} style={[styles.formulaCard, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}>
            <Text style={[styles.formulaLabel, { color: c.accent.primary }]}>{step.label}</Text>
            <Text style={[styles.formulaCode, { color: c.text.primary, backgroundColor: c.bg.surfaceRaised }]}>{step.formula}</Text>
            <Text style={[styles.formulaDesc, { color: c.text.muted }]}>{step.desc}</Text>
          </View>
        ))}

        {/* Color legend */}
        <Text style={[styles.sectionHeading, { color: c.text.primary }]}>Volume Zones</Text>
        {COLOR_LEGEND.map((item) => (
          <View key={item.label} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: c.heatmap[item.colorKey] }]} />
            <View style={styles.legendText}>
              <Text style={[styles.legendLabel, { color: c.text.primary }]}>{item.label}</Text>
              <Text style={[styles.legendDesc, { color: c.text.muted }]}>{item.desc}</Text>
            </View>
          </View>
        ))}

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing[4] },
  heading: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginBottom: spacing[2] },
  intro: { fontSize: typography.size.sm, lineHeight: 20, marginBottom: spacing[6] },
  sectionHeading: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, marginBottom: spacing[3], marginTop: spacing[4] },
  section: { marginBottom: spacing[4] },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  sectionNumber: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, width: 20 },
  sectionTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  sectionBody: { fontSize: typography.size.sm, lineHeight: 20, paddingLeft: 28 },
  formulaCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing[3], marginBottom: spacing[3] },
  formulaLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, marginBottom: spacing[1] },
  formulaCode: { fontSize: typography.size.xs, fontFamily: 'monospace', padding: spacing[2], borderRadius: radius.sm, overflow: 'hidden', marginBottom: spacing[1] },
  formulaDesc: { fontSize: typography.size.xs, lineHeight: 16 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { flex: 1 },
  legendLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  legendDesc: { fontSize: typography.size.xs },
});
