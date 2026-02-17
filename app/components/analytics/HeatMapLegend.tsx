import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';

const LEGEND_ITEMS = [
  { color: colors.heatmap.untrained, label: 'Untrained' },
  { color: colors.heatmap.belowMev, label: 'Below MEV' },
  { color: colors.heatmap.optimal, label: 'Optimal' },
  { color: colors.heatmap.nearMrv, label: 'Near MRV' },
  { color: colors.heatmap.aboveMrv, label: 'Above MRV' },
];

export function HeatMapLegend() {
  return (
    <View style={styles.container}>
      {LEGEND_ITEMS.map((item) => (
        <View key={item.label} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[3],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
  },
});
