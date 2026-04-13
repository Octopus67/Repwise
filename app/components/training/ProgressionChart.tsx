import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { TrendLineChart } from '../charts/TrendLineChart';
import { Card } from '../common/Card';

interface ProgressionChartProps {
  e1rmData: { date: string; value: number }[];
  volumeData: { date: string; value: number }[];
  unitLabel: string;
}

type ChartMode = 'e1rm' | 'volume';

export function ProgressionChart({ e1rmData, volumeData, unitLabel }: ProgressionChartProps) {
  const c = useThemeColors();
  const s = getStyles(c);
  const [mode, setMode] = useState<ChartMode>('e1rm');

  const data = mode === 'e1rm' ? e1rmData : volumeData;
  const suffix = mode === 'e1rm' ? ` ${unitLabel}` : ` ${unitLabel}`;
  const label = mode === 'e1rm' ? 'Estimated 1RM' : 'Volume';

  if (data.length === 0) {
    return (
      <Card style={s.card}>
        <Text style={[s.emptyText, { color: c.text.muted }]}>No data yet</Text>
      </Card>
    );
  }

  return (
    <Card style={s.card}>
      <View style={s.toggleRow}>
        <TouchableOpacity
          style={[s.toggleBtn, mode === 'e1rm' && { backgroundColor: c.accent.primaryMuted }]}
          onPress={() => setMode('e1rm')}
        >
          <Text style={[s.toggleText, { color: mode === 'e1rm' ? c.accent.primary : c.text.muted }]}>E1RM</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggleBtn, mode === 'volume' && { backgroundColor: c.accent.primaryMuted }]}
          onPress={() => setMode('volume')}
        >
          <Text style={[s.toggleText, { color: mode === 'volume' ? c.accent.primary : c.text.muted }]}>Volume</Text>
        </TouchableOpacity>
      </View>
      {data.length === 1 ? (
        <View style={s.singlePoint}>
          <Text style={[s.singleValue, { color: c.text.primary }]}>{data[0].value}{suffix}</Text>
          <Text style={[s.singleDate, { color: c.text.muted }]}>{data[0].date}</Text>
        </View>
      ) : (
        <TrendLineChart data={data} color={c.accent.primary} suffix={suffix} emptyMessage="No data yet" />
      )}
    </Card>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  card: { marginBottom: spacing[3] },
  toggleRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  toggleBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.sm },
  toggleText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  emptyText: { textAlign: 'center', paddingVertical: spacing[6], fontSize: typography.size.base },
  singlePoint: { alignItems: 'center', paddingVertical: spacing[4] },
  singleValue: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold },
  singleDate: { fontSize: typography.size.sm, marginTop: spacing[1] },
});
