/**
 * StimulusSummary — Scrollable list of traffic light indicators for all muscles worked.
 */

import { View, ScrollView, StyleSheet } from 'react-native';
import { spacing } from '../../theme/tokens';
import { StimulusIndicator } from './StimulusIndicator';

interface MuscleData {
  muscle: string;
  hu: number;
  mev?: number;
  mav?: number;
  mrv?: number;
}

interface Props {
  muscleData: MuscleData[];
}

export function StimulusSummary({ muscleData }: Props) {
  if (muscleData.length === 0) return null;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      <View style={s.col}>
        {muscleData.map((m) => (
          <StimulusIndicator
            key={m.muscle}
            muscleGroup={m.muscle}
            currentHU={m.hu}
            mev={m.mev}
            mav={m.mav}
            mrv={m.mrv}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[2] },
  col: { gap: spacing[0.5] },
});
