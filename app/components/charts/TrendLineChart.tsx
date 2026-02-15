import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableWithoutFeedback } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { colors, spacing, typography } from '../../theme/tokens';

const CHART_WIDTH = Dimensions.get('window').width - spacing[4] * 2 - spacing[4] * 2; // screen padding + card padding
const CHART_HEIGHT = 160;
const PADDING = { top: 16, right: 12, bottom: 28, left: 44 };

interface DataPoint {
  date: string;
  value: number;
}

interface TrendLineChartProps {
  data: DataPoint[];
  color: string;
  targetLine?: number;
  suffix?: string;
  emptyMessage?: string;
  /** Optional secondary data series rendered as a solid overlay line */
  secondaryData?: DataPoint[];
  /** Color for the secondary data series (defaults to color) */
  secondaryColor?: string;
  /** If true, primary data renders as dots with reduced opacity instead of a line */
  primaryAsDots?: boolean;
}

export function TrendLineChart({
  data,
  color,
  targetLine,
  suffix = '',
  emptyMessage,
  secondaryData,
  secondaryColor,
  primaryAsDots,
}: TrendLineChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const { points, yMin, yMax, xLabels, yLabels, plotWidth, plotHeight } = useMemo(() => {
    if (data.length === 0) {
      return { points: '', yMin: 0, yMax: 0, xLabels: [], yLabels: [], plotWidth: 0, plotHeight: 0 };
    }

    const values = data.map((d) => d.value);
    let min = Math.min(...values);
    let max = Math.max(...values);

    // Include secondary data in range if provided
    if (secondaryData && secondaryData.length > 0) {
      const secValues = secondaryData.map((d) => d.value);
      min = Math.min(min, ...secValues);
      max = Math.max(max, ...secValues);
    }

    // Include target line in range if provided
    if (targetLine != null) {
      min = Math.min(min, targetLine);
      max = Math.max(max, targetLine);
    }

    // Add 10% padding to range
    const range = max - min || 1;
    min = min - range * 0.05;
    max = max + range * 0.05;

    const pw = CHART_WIDTH - PADDING.left - PADDING.right;
    const ph = CHART_HEIGHT - PADDING.top - PADDING.bottom;

    const pts = data
      .map((d, i) => {
        const x = PADDING.left + (data.length === 1 ? pw / 2 : (i / (data.length - 1)) * pw);
        const y = PADDING.top + ph - ((d.value - min) / (max - min)) * ph;
        return `${x},${y}`;
      })
      .join(' ');

    // X-axis labels: show first, middle, last dates
    const xl: { x: number; label: string }[] = [];
    const labelIndices = data.length <= 3
      ? data.map((_, i) => i)
      : [0, Math.floor(data.length / 2), data.length - 1];
    labelIndices.forEach((idx) => {
      const x = PADDING.left + (data.length === 1 ? pw / 2 : (idx / (data.length - 1)) * pw);
      const d = new Date(data[idx].date + 'T00:00:00');
      xl.push({ x, label: `${d.getMonth() + 1}/${d.getDate()}` });
    });

    // Y-axis labels: 3 ticks
    const yl: { y: number; label: string }[] = [];
    for (let i = 0; i <= 2; i++) {
      const val = min + (i / 2) * (max - min);
      const y = PADDING.top + ph - (i / 2) * ph;
      yl.push({ y, label: val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val).toString() });
    }

    return { points: pts, yMin: min, yMax: max, xLabels: xl, yLabels: yl, plotWidth: pw, plotHeight: ph };
  }, [data, targetLine, secondaryData]);

  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage || 'No data for this period'}</Text>
      </View>
    );
  }

  const handlePress = (evt: any) => {
    const locationX = evt.nativeEvent.locationX;
    const pw = CHART_WIDTH - PADDING.left - PADDING.right;
    const relX = locationX - PADDING.left;
    const idx = Math.round((relX / pw) * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setSelectedIndex(clamped === selectedIndex ? null : clamped);
  };

  const targetY =
    targetLine != null && yMax !== yMin
      ? PADDING.top + plotHeight - ((targetLine - yMin) / (yMax - yMin)) * plotHeight
      : null;

  const selectedPoint = selectedIndex != null ? data[selectedIndex] : null;
  const selectedX =
    selectedIndex != null
      ? PADDING.left + (data.length === 1 ? plotWidth / 2 : (selectedIndex / (data.length - 1)) * plotWidth)
      : 0;
  const selectedY =
    selectedIndex != null && yMax !== yMin
      ? PADDING.top + plotHeight - ((data[selectedIndex].value - yMin) / (yMax - yMin)) * plotHeight
      : 0;

  return (
    <View>
      <TouchableWithoutFeedback onPress={handlePress}>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Y-axis labels */}
          {yLabels.map((tick, i) => (
            <SvgText
              key={`y-${i}`}
              x={PADDING.left - 6}
              y={tick.y + 4}
              textAnchor="end"
              fill={colors.text.muted}
              fontSize={10}
            >
              {tick.label}
            </SvgText>
          ))}

          {/* Grid lines */}
          {yLabels.map((tick, i) => (
            <Line
              key={`grid-${i}`}
              x1={PADDING.left}
              y1={tick.y}
              x2={PADDING.left + plotWidth}
              y2={tick.y}
              stroke={colors.border.subtle}
              strokeWidth={1}
            />
          ))}

          {/* Target line (dashed) */}
          {targetY != null && (
            <Line
              x1={PADDING.left}
              y1={targetY}
              x2={PADDING.left + plotWidth}
              y2={targetY}
              stroke={colors.semantic.warning}
              strokeWidth={1.5}
              strokeDasharray="6,4"
            />
          )}

          {/* Primary data — line or dots depending on primaryAsDots */}
          {primaryAsDots ? (
            // Render as individual dots with reduced opacity
            data.map((d, i) => {
              const x = PADDING.left + (data.length === 1 ? plotWidth / 2 : (i / (data.length - 1)) * plotWidth);
              const y = PADDING.top + plotHeight - ((d.value - yMin) / (yMax - yMin)) * plotHeight;
              return (
                <Circle
                  key={`dot-${i}`}
                  cx={x}
                  cy={y}
                  r={3}
                  fill={color}
                  opacity={0.4}
                />
              );
            })
          ) : (
            <Polyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Secondary data series (e.g., EMA trend line) */}
          {secondaryData && secondaryData.length >= 2 && (() => {
            const secPoints = secondaryData
              .map((d, i) => {
                const x = PADDING.left + (secondaryData.length === 1 ? plotWidth / 2 : (i / (secondaryData.length - 1)) * plotWidth);
                const y = PADDING.top + plotHeight - ((d.value - yMin) / (yMax - yMin)) * plotHeight;
                return `${x},${y}`;
              })
              .join(' ');
            return (
              <Polyline
                points={secPoints}
                fill="none"
                stroke={secondaryColor ?? color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })()}

          {/* Selected point indicator */}
          {selectedIndex != null && (
            <>
              <Circle cx={selectedX} cy={selectedY} r={5} fill={color} />
              <Circle cx={selectedX} cy={selectedY} r={3} fill={colors.bg.surface} />
            </>
          )}

          {/* X-axis labels */}
          {xLabels.map((tick, i) => (
            <SvgText
              key={`x-${i}`}
              x={tick.x}
              y={CHART_HEIGHT - 4}
              textAnchor="middle"
              fill={colors.text.muted}
              fontSize={10}
            >
              {tick.label}
            </SvgText>
          ))}
        </Svg>
      </TouchableWithoutFeedback>

      {/* Tooltip */}
      {selectedPoint && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipDate}>
            {new Date(selectedPoint.date + 'T00:00:00').toLocaleDateString()}
          </Text>
          <Text style={[styles.tooltipValue, { color }]}>
            {selectedPoint.value.toFixed(1)}{suffix}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: typography.size.base,
    textAlign: 'center',
  },
  tooltip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
    paddingTop: spacing[2],
  },
  tooltipDate: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
  },
  tooltipValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});
