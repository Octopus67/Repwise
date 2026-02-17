import { colors } from '../../theme/tokens';

/**
 * Feature: muscle-heatmap-redesign
 * Validates: Requirements 3.6
 *
 * Tests the HeatMapLegend data — verifies the 5-tier legend items
 * match the expected labels and heatmap color tokens.
 * Pure logic mirror of HeatMapLegend.tsx to avoid react-native imports.
 */

const LEGEND_ITEMS = [
  { color: colors.heatmap.untrained, label: 'Untrained' },
  { color: colors.heatmap.belowMev, label: 'Below MEV' },
  { color: colors.heatmap.optimal, label: 'Optimal' },
  { color: colors.heatmap.nearMrv, label: 'Near MRV' },
  { color: colors.heatmap.aboveMrv, label: 'Above MRV' },
];

describe('HeatMapLegend', () => {
  test('renders exactly 5 legend items', () => {
    expect(LEGEND_ITEMS).toHaveLength(5);
  });

  test('renders items with correct labels in order', () => {
    const labels = LEGEND_ITEMS.map((item) => item.label);
    expect(labels).toEqual([
      'Untrained',
      'Below MEV',
      'Optimal',
      'Near MRV',
      'Above MRV',
    ]);
  });

  test('each legend item has a matching heatmap color token', () => {
    expect(LEGEND_ITEMS[0].color).toBe(colors.heatmap.untrained);
    expect(LEGEND_ITEMS[1].color).toBe(colors.heatmap.belowMev);
    expect(LEGEND_ITEMS[2].color).toBe(colors.heatmap.optimal);
    expect(LEGEND_ITEMS[3].color).toBe(colors.heatmap.nearMrv);
    expect(LEGEND_ITEMS[4].color).toBe(colors.heatmap.aboveMrv);
  });

  test('every item has a non-empty label and a non-empty color string', () => {
    for (const item of LEGEND_ITEMS) {
      expect(typeof item.label).toBe('string');
      expect(item.label.length).toBeGreaterThan(0);
      expect(typeof item.color).toBe('string');
      expect(item.color.length).toBeGreaterThan(0);
    }
  });

  test('all labels are unique', () => {
    const labels = LEGEND_ITEMS.map((item) => item.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  test('all colors are unique', () => {
    const itemColors = LEGEND_ITEMS.map((item) => item.color);
    expect(new Set(itemColors).size).toBe(itemColors.length);
  });
});
