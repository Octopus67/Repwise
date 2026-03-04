/**
 * HUExplainerSheet — Explains how Hypertrophy Units are calculated.
 *
 * Triggered by "ⓘ" icon in volume pills and drill-down modals.
 * Uses ModalContainer for consistent modal behavior.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ModalContainer } from '../common/ModalContainer';
import { colors, spacing, typography, radius } from '../../theme/tokens';

interface HUExplainerSheetProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: 'hu' | 'fatigue';
}

// ─── Hypertrophy Units Content ───────────────────────────────────────────────

const HU_SECTIONS = [
  {
    number: '01',
    title: 'Stimulating Reps',
    body: 'Not all reps build muscle equally. Only the last ~5 reps before failure — when your muscles are fully recruited and moving slowly — create enough tension to trigger growth. We call these "stimulating reps."',
  },
  {
    number: '02',
    title: 'Proximity to Failure',
    body: 'Sets taken close to failure (0–3 reps in reserve) produce the most stimulating reps. Sets with 4+ reps in reserve produce almost no growth stimulus — that\'s "junk volume."',
  },
  {
    number: '03',
    title: 'Direct & Fractional Volume',
    body: 'Compound exercises train multiple muscles. Bench press gives your chest full credit (1.0×) but also gives your triceps partial credit (0.5×). We track both.',
  },
  {
    number: '04',
    title: 'Diminishing Returns',
    body: 'Your 1st set of the day produces the most growth. Each additional set contributes less. 6 sets produce roughly 2× the stimulus of 1 set — not 6×.',
  },
  {
    number: '05',
    title: 'Recovery Between Sessions',
    body: 'Muscle protein synthesis stays elevated for ~48 hours after training. After that, a small amount of atrophy occurs until your next session. Training more frequently reduces this loss.',
  },
] as const;

const HU_COLOR_LEGEND = [
  { label: 'Below MEV', desc: 'Not enough stimulus to grow', color: '#6B7280' },
  { label: 'Optimal', desc: 'Sweet spot for hypertrophy', color: '#22C55E' },
  { label: 'Approaching MRV', desc: 'High volume — monitor recovery', color: '#EAB308' },
  { label: 'Above MRV', desc: 'Exceeding recovery capacity', color: '#EF4444' },
] as const;

// ─── Fatigue Score Content ───────────────────────────────────────────────────

const FATIGUE_SECTIONS = [
  {
    number: '01',
    title: 'Strength Regression',
    weight: '35%',
    body: 'Tracks your estimated 1RM over consecutive sessions. If your strength on a lift declines for 2–3 sessions in a row, this component rises — the most reliable signal of accumulated fatigue.',
  },
  {
    number: '02',
    title: 'Volume Load',
    weight: '30%',
    body: 'Compares your weekly sets to your Maximum Recoverable Volume (MRV). Training at or above MRV consistently increases fatigue accumulation.',
  },
  {
    number: '03',
    title: 'Training Frequency',
    weight: '20%',
    body: 'Higher frequency (5+ sessions per week) increases systemic fatigue even when per-session volume is moderate. This component accounts for cumulative neural and connective tissue stress.',
  },
  {
    number: '04',
    title: 'Nutrition Compliance',
    weight: '15%',
    body: 'Under-eating impairs recovery. When calorie intake drops below 80% of your target, this component rises — reflecting the reduced capacity to repair and adapt.',
  },
] as const;

const FATIGUE_COLOR_LEGEND = [
  { label: 'Low Fatigue (0–30)', desc: 'Fully recovered — push hard', color: '#22C55E' },
  { label: 'Moderate (31–60)', desc: 'Normal training fatigue', color: '#EAB308' },
  { label: 'High Fatigue (61–100)', desc: 'Consider a deload week', color: '#EF4444' },
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export function HUExplainerSheet({ visible, onClose, initialTab = 'hu' }: HUExplainerSheetProps) {
  const [tab, setTab] = useState<'hu' | 'fatigue'>(initialTab);

  // Reset tab when modal opens
  React.useEffect(() => {
    if (visible) setTab(initialTab);
  }, [visible, initialTab]);

  return (
    <ModalContainer visible={visible} onClose={onClose} title={tab === 'hu' ? 'Hypertrophy Units' : 'Fatigue Score'}>
      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'hu' && styles.tabActive]}
          onPress={() => setTab('hu')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'hu' }}
          accessibilityLabel="Hypertrophy Units tab"
        >
          <Text style={[styles.tabText, tab === 'hu' && styles.tabTextActive]}>Hypertrophy Units</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'fatigue' && styles.tabActive]}
          onPress={() => setTab('fatigue')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'fatigue' }}
          accessibilityLabel="Fatigue Score tab"
        >
          <Text style={[styles.tabText, tab === 'fatigue' && styles.tabTextActive]}>Fatigue Score</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'hu' ? (
          <>
            <Text style={styles.intro}>
              Your HU score measures the actual growth stimulus reaching each muscle — not just how many sets you did.
            </Text>

            {HU_SECTIONS.map((section) => (
              <View key={section.title} style={styles.section}>
                <View style={styles.numberRow}>
                  <Text style={styles.sectionNumber}>{section.number}</Text>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}

            <View style={styles.legendSection}>
              <Text style={styles.legendHeading}>Status Indicators</Text>
              {HU_COLOR_LEGEND.map((item) => (
                <View key={item.label} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <View style={styles.legendText}>
                    <Text style={styles.legendLabel}>{item.label}</Text>
                    <Text style={styles.legendDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.intro}>
              Your fatigue score (0–100) estimates accumulated training stress across four dimensions. Higher scores indicate greater need for recovery.
            </Text>

            {FATIGUE_SECTIONS.map((section) => (
              <View key={section.title} style={styles.section}>
                <View style={styles.numberRow}>
                  <Text style={styles.sectionNumber}>{section.number}</Text>
                  <View style={styles.titleWeightRow}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.weightBadge}>{section.weight}</Text>
                  </View>
                </View>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}

            <View style={styles.legendSection}>
              <Text style={styles.legendHeading}>Score Ranges</Text>
              {FATIGUE_COLOR_LEGEND.map((item) => (
                <View key={item.label} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <View style={styles.legendText}>
                    <Text style={styles.legendLabel}>{item.label}</Text>
                    <Text style={styles.legendDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                When your fatigue score exceeds 70, Repwise will suggest a deload — reducing volume by 40–60% for one week while maintaining intensity.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </ModalContainer>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.bg.surfaceRaised,
  },
  tabActive: {
    backgroundColor: colors.accent.primaryMuted,
  },
  tabText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.muted,
  },
  tabTextActive: {
    color: colors.accent.primary,
  },
  scroll: {
    maxHeight: 420,
  },
  intro: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: 20,
    marginBottom: spacing[4],
  },
  section: {
    marginBottom: spacing[4],
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  sectionNumber: {
    color: colors.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    width: 20,
  },
  titleWeightRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  weightBadge: {
    color: colors.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    backgroundColor: colors.accent.primaryMuted,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  sectionBody: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: 20,
    paddingLeft: 28,
  },
  legendSection: {
    marginTop: spacing[2],
    marginBottom: spacing[4],
  },
  legendHeading: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    flex: 1,
  },
  legendLabel: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  legendDesc: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
  },
  noteBox: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[4],
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.primary,
  },
  noteText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
});
