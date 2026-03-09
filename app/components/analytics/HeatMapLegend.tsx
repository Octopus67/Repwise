import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

const getLEGEND_ITEMS = (c: ThemeColors) => [
  { color: c.heatmap.untrained, label: 'Untrained' },
  { color: c.heatmap.belowMev, label: 'Below MEV' },
  { color: c.heatmap.optimal, label: 'Optimal' },
  { color: c.heatmap.nearMrv, label: 'Near MRV' },
  { color: c.heatmap.aboveMrv, label: 'Above MRV' },
];

export function HeatMapLegend() {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  return (
    <View style={styles.container}>
      {getLEGEND_ITEMS(c).map((item) => (
        <View key={item.label} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={[styles.label, { color: c.text.secondary }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
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
    color: c.text.secondary,
    fontSize: typography.size.xs,
  },
});
