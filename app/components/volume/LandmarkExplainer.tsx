/**
 * LandmarkExplainer — Modal explaining each volume landmark with practical advice.
 */

import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ModalContainer } from '../common/ModalContainer';
import { colors, spacing, typography } from '../../theme/tokens';

export type LandmarkKey = 'mv' | 'mev' | 'mav' | 'mrv';

export interface LandmarkExplainerProps {
  landmark: LandmarkKey;
  onClose: () => void;
  visible: boolean;
}

interface LandmarkInfo {
  title: string;
  color: string;
  description: string;
  advice: string;
  citation: string;
}

const LANDMARK_INFO: Record<LandmarkKey, LandmarkInfo> = {
  mv: {
    title: 'Minimum Volume (MV)',
    color: colors.text.muted,
    description:
      'The lowest amount of training volume needed to maintain your current muscle mass. Below this, you risk losing gains.',
    advice:
      'During deload weeks or high-stress periods, aim for at least MV to preserve muscle while recovering.',
    citation: 'Israetel, Hoffmann & Smith — Scientific Principles of Hypertrophy Training',
  },
  mev: {
    title: 'Minimum Effective Volume (MEV)',
    color: colors.semantic.warning,
    description:
      'The minimum volume needed to stimulate measurable muscle growth. This is where hypertrophy begins.',
    advice:
      'Start mesocycles near MEV and progressively increase. If you\'re consistently below MEV, add 1-2 sets per week.',
    citation: 'Schoenfeld et al. (2017) — Dose-response relationship between weekly resistance training volume and increases in muscle mass',
  },
  mav: {
    title: 'Maximum Adaptive Volume (MAV)',
    color: colors.semantic.positive,
    description:
      'The volume range producing the best hypertrophy response relative to fatigue. This is your sweet spot.',
    advice:
      'Spend most of your training weeks in the MAV range. This maximizes growth while keeping fatigue manageable.',
    citation: 'Israetel, Hoffmann & Smith — Scientific Principles of Hypertrophy Training',
  },
  mrv: {
    title: 'Maximum Recoverable Volume (MRV)',
    color: colors.semantic.negative,
    description:
      'The highest volume you can recover from. Exceeding MRV leads to overtraining, excessive fatigue, and potential regression.',
    advice:
      'Only approach MRV at the end of a mesocycle before deloading. If you\'re consistently above MRV, reduce volume immediately.',
    citation: 'Helms, Cronin & Storey (2020) — Application of the Repetitions in Reserve-Based Rating of Perceived Exertion Scale',
  },
};

export function LandmarkExplainer({ landmark, onClose, visible }: LandmarkExplainerProps) {
  const info = LANDMARK_INFO[landmark];

  return (
    <ModalContainer
      visible={visible}
      onClose={onClose}
      title={info.title}
      testID="landmark-explainer-modal"
    >
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.colorBadge, { backgroundColor: info.color + '20' }]}>
          <Text style={[styles.colorBadgeText, { color: info.color }]}>{info.title}</Text>
        </View>

        <Text style={styles.sectionTitle}>What is it?</Text>
        <Text style={styles.body}>{info.description}</Text>

        <Text style={styles.sectionTitle}>Practical Advice</Text>
        <Text style={styles.body}>{info.advice}</Text>

        <Text style={styles.citation}>{info.citation}</Text>
      </ScrollView>
    </ModalContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    maxHeight: 400,
  },
  colorBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 9999,
    marginBottom: spacing[4],
  },
  colorBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[1],
    marginTop: spacing[3],
  },
  body: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  citation: {
    color: colors.text.muted,
    fontSize: typography.size.xs - 1,
    fontStyle: 'italic',
    marginTop: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
});
