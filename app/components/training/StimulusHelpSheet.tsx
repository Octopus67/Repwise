/**
 * StimulusHelpSheet — Bottom sheet explaining traffic light colors.
 * Triggered by an ℹ️ info button.
 */

import { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';

const LEGEND = [
  { color: '#22C55E', shape: '●', emoji: '🟢', label: 'Green', desc: "You've done enough for this muscle to grow" },
  { color: '#F59E0B', shape: '◆', emoji: '🟡', label: 'Yellow', desc: 'Getting close — a few more sets would be ideal' },
  { color: '#EF4444', shape: '▲', emoji: '🔴', label: 'Red', desc: "You've done a lot — more sets may hurt recovery" },
  { color: '#6B7280', shape: '○', emoji: '⚪', label: 'Gray', desc: 'Not enough yet — keep going' },
];

interface Props {
  hasCustomLandmarks?: boolean;
}

export function StimulusHelpSheet({ hasCustomLandmarks }: Props) {
  const ref = useRef<BottomSheet>(null);
  const c = useThemeColors();
  const open = useCallback(() => ref.current?.expand(), []);

  return (
    <>
      <TouchableOpacity onPress={open} accessibilityLabel="Stimulus guide info" accessibilityRole="button" hitSlop={8}>
        <Text style={{ fontSize: typography.size.md }}>ℹ️</Text>
      </TouchableOpacity>

      <BottomSheet ref={ref} index={-1} snapPoints={['40%']} enablePanDownToClose
        backgroundStyle={{ backgroundColor: c.bg.surface }} handleIndicatorStyle={{ backgroundColor: c.border.default }}>
        <BottomSheetView style={s.content}>
          <Text style={[s.title, { color: c.text.primary }]}>Stimulus Guide</Text>
          {LEGEND.map((item) => (
            <View key={item.label} style={s.row} accessibilityLabel={`${item.label}: ${item.desc}`}>
              <Text style={[s.shape, { color: item.color }]}>{item.shape}</Text>
              <View style={s.textCol}>
                <Text style={[s.label, { color: c.text.primary }]}>{item.label}</Text>
                <Text style={[s.desc, { color: c.text.muted }]}>{item.desc}</Text>
              </View>
            </View>
          ))}
          {!hasCustomLandmarks && (
            <Text style={[s.note, { color: c.text.muted }]}>
              Using recommended defaults — customize in Settings
            </Text>
          )}
        </BottomSheetView>
      </BottomSheet>
    </>
  );
}

const s = StyleSheet.create({
  content: { padding: spacing[4], gap: spacing[3] },
  title: { fontSize: typography.size.md, fontWeight: typography.weight.semibold },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  shape: { fontSize: 14, width: 16, textAlign: 'center' },
  textCol: { flex: 1 },
  label: { fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  desc: { fontSize: typography.size.xs, marginTop: 2 },
  note: { fontSize: typography.size.xs, fontStyle: 'italic', marginTop: spacing[2], textAlign: 'center' },
});
