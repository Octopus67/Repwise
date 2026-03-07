/**
 * VolumeTrendChart — Line chart showing volume trend with landmark reference lines.
 *
 * Uses react-native-svg directly (same pattern as ArticleChart.tsx).
 * victory-native v41 requires @shopify/react-native-skia which is not in the project;
 * raw SVG keeps the dependency footprint minimal.
 */

import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Line as SvgLine, Circle, Text as SvgText, Polyline } from 'react-native-svg';
import { colors, spacing, typography } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { WNSLandmarks } from '../../types/volume';

export interface TrendPoint {
  week: string;
  volume: number;
}

export interface VolumeTrendChartProps {
  trend: TrendPoint[];
  landmarks: WNSLandmarks;
}

const CHART_W = 280;
const CHART_H = 140;
const PAD = { top: 12, right: 16, bottom: 24, left: 32 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

const LANDMARK_STYLES: { key: keyof WNSLandmarks; label: string; color: string; dash?: string }[] = [
  { key: 'mev', label: 'MEV', color: colors.semantic.warning, dash: '4,3' },
  { key: 'mav_high', label: 'MAV', color: colors.semantic.positive, dash: '4,3' },
  { key: 'mrv', label: 'MRV', color: colors.semantic.negative, dash: '4,3' },
];

function formatWeekLabel(week: string): string {
  const d = new Date(week + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function VolumeTrendChart({ trend, landmarks }: VolumeTrendChartProps) {
  const c = useThemeColors();
  if (!trend.length) {
    return (
      <View style={styles.empty} accessibilityLabel="Not enough data for trend chart">
        <Text style={[styles.emptyText, { color: c.text.muted }]}>Not enough data yet</Text>
      </View>
    );
  }

  const volumes = trend.map((t) => t.volume);
  const yMax = Math.max(landmarks.mrv * 1.2, ...volumes) || 1;
  const yMin = 0;

  const xScale = (i: number) => PAD.left + (i / Math.max(trend.length - 1, 1)) * PLOT_W;
  const yScale = (v: number) => PAD.top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H;

  const points = trend.map((t, i) => `${xScale(i)},${yScale(t.volume)}`).join(' ');

  return (
    <View
      style={styles.container}
      accessibilityLabel={`Volume trend chart. ${trend.length} weeks of data`}
      accessibilityRole="image"
    >
      <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
        {/* Landmark reference lines */}
        {LANDMARK_STYLES.map(({ key, label, color, dash }) => {
          const y = yScale(landmarks[key]);
          if (y < PAD.top || y > PAD.top + PLOT_H) return null;
          return (
            <G key={key}>
              <SvgLine
                x1={PAD.left}
                y1={y}
                x2={PAD.left + PLOT_W}
                y2={y}
                stroke={color}
                strokeWidth={1}
                strokeDasharray={dash}
                opacity={0.6}
              />
              <SvgText
                x={PAD.left + PLOT_W + 2}
                y={y + 3}
                fill={color}
                fontSize={8}
                fontWeight="600"
              >
                {label}
              </SvgText>
            </G>
          );
        })}

        {/* Volume line */}
        <Polyline
          points={points}
          fill="none"
          stroke={c.accent.primary}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {trend.map((t, i) => (
          <Circle
            key={t.week}
            cx={xScale(i)}
            cy={yScale(t.volume)}
            r={3}
            fill={c.accent.primary}
          />
        ))}

        {/* X-axis labels */}
        {trend.map((t, i) => (
          <SvgText
            key={`x-${t.week}`}
            x={xScale(i)}
            y={CHART_H - 4}
            textAnchor="middle"
            fill={c.text.muted}
            fontSize={8}
          >
            {formatWeekLabel(t.week)}
          </SvgText>
        ))}

        {/* Y-axis labels */}
        {[0, Math.round(yMax / 2), Math.round(yMax)].map((v) => (
          <SvgText
            key={`y-${v}`}
            x={PAD.left - 4}
            y={yScale(v) + 3}
            textAnchor="end"
            fill={c.text.muted}
            fontSize={8}
          >
            {v}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing[2],
  },
  empty: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
  },
});
