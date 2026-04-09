import { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback, GestureResponderEvent, Platform, useWindowDimensions } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { computeChartA11yLabel } from '../../utils/chartAccessibility';

const AnimatedPolyline = Platform.OS === 'web' ? Polyline : Animated.createAnimatedComponent(Polyline);

const CHART_HEIGHT = 160;
const PADDING = { top: spacing[4], right: spacing[3], bottom: 28, left: 44 };

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
  label?: string;
  /** Optional secondary data series rendered as a solid overlay line */
  secondaryData?: DataPoint[];
  /** Color for the secondary data series (defaults to color) */
  secondaryColor?: string;
  /** If true, primary data renders as dots with reduced opacity instead of a line */
  primaryAsDots?: boolean;
  /** Indices of PR (personal record) data points to mark with a star */
  prIndices?: number[];
  /** Optional legend for dual-series charts */
  legend?: Array<{color: string; label: string}>;
}

export function TrendLineChart({
  data,
  color,
  targetLine,
  suffix = '',
  emptyMessage,
  label,
  secondaryData,
  secondaryColor,
  primaryAsDots,
  prIndices,
  legend,
}: TrendLineChartProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const chartHeight = isLandscape ? Math.round(CHART_HEIGHT * 1.5) : CHART_HEIGHT;
  const CHART_WIDTH = windowWidth - spacing[4] * 2 - spacing[4] * 2;

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

    // Guard against division by zero when all values are identical
    if (max === min) {
      const epsilon = Math.abs(max) * 0.1 || 1;
      min = max - epsilon;
      max = max + epsilon;
    }

    const pw = CHART_WIDTH - PADDING.left - PADDING.right;
    const ph = chartHeight - PADDING.top - PADDING.bottom;

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
  }, [data, targetLine, secondaryData, CHART_WIDTH, chartHeight]);

  // Estimate total path length for draw-in animation
  const pathLength = useMemo(() => {
    if (data.length < 2) return 0;
    const pw = CHART_WIDTH - PADDING.left - PADDING.right;
    const ph = chartHeight - PADDING.top - PADDING.bottom;
    let len = 0;
    for (let i = 1; i < data.length; i++) {
      const dx = pw / (data.length - 1);
      const dy = ((data[i].value - data[i - 1].value) / ((yMax - yMin) || 1)) * ph;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }, [data, yMax, yMin, CHART_WIDTH, chartHeight]);

  // Polygon points for gradient area fill (line path + bottom corners)
  const areaPolygonPoints = useMemo(() => {
    if (!points || data.length < 2) return '';
    const pw = CHART_WIDTH - PADDING.left - PADDING.right;
    const bottomY = PADDING.top + (chartHeight - PADDING.top - PADDING.bottom);
    const firstX = PADDING.left;
    const lastX = PADDING.left + pw;
    return `${firstX},${bottomY} ${points} ${lastX},${bottomY}`;
  }, [points, data.length, CHART_WIDTH, chartHeight]);

  // Draw-in animation
  const dashOffset = useSharedValue(pathLength || 1000);
  useEffect(() => {
    if (pathLength > 0) {
      dashOffset.value = pathLength;
      dashOffset.value = withTiming(0, { duration: 800 });
    }
  }, [pathLength]);

  // Fade-in on data change
  const chartOpacity = useSharedValue(1);
  useEffect(() => {
    chartOpacity.value = 0.3;
    chartOpacity.value = withTiming(1, { duration: 300 });
  }, [data]);

  const chartFadeStyle = useAnimatedStyle(() => ({
    opacity: chartOpacity.value,
  }));

  const animatedLineProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  if (data.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height: chartHeight }]}>
        <Text style={[styles.emptyText, { color: c.text.muted }]}>{emptyMessage || 'No data for this period'}</Text>
      </View>
    );
  }

  const handlePress = (evt: GestureResponderEvent) => {
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
    <Animated.View style={chartFadeStyle}>
      <TouchableWithoutFeedback onPress={handlePress}>
        <View accessibilityRole="image" accessibilityLabel={computeChartA11yLabel(data, suffix || '', label || 'Chart')}>
        <Svg width={CHART_WIDTH} height={chartHeight}>
          {/* Y-axis labels */}
          {yLabels.map((tick, i) => (
            <SvgText
              key={`y-${i}`}
              x={PADDING.left - 6}
              y={tick.y + 4}
              textAnchor="end"
              fill={c.text.muted}
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
              stroke={c.border.subtle}
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
              stroke={c.semantic.warning}
              strokeWidth={1.5}
              strokeDasharray="6,4"
            />
          )}

          {/* Gradient area fill */}
          {!primaryAsDots && areaPolygonPoints && (
            <>
              <Defs>
                <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={color} stopOpacity="0.3" />
                  <Stop offset="1" stopColor={color} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Polygon points={areaPolygonPoints} fill="url(#areaGrad)" />
            </>
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
            <AnimatedPolyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={pathLength > 0 ? pathLength : undefined}
              animatedProps={Platform.OS === 'web' ? undefined : animatedLineProps}
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
              <Circle cx={selectedX} cy={selectedY} r={3} fill={c.bg.surface} />
            </>
          )}

          {/* PR markers */}
          {prIndices && prIndices.map((idx) => {
            if (idx < 0 || idx >= data.length) return null;
            const px = PADDING.left + (data.length === 1 ? plotWidth / 2 : (idx / (data.length - 1)) * plotWidth);
            const py = PADDING.top + plotHeight - ((data[idx].value - yMin) / (yMax - yMin)) * plotHeight;
            return <Circle key={`pr-${idx}`} cx={px} cy={py - 8} r={4} fill={c.semantic.warning} />;
          })}

          {/* X-axis labels */}
          {xLabels.map((tick, i) => (
            <SvgText
              key={`x-${i}`}
              x={tick.x}
              y={chartHeight - 4}
              textAnchor="middle"
              fill={c.text.muted}
              fontSize={10}
            >
              {tick.label}
            </SvgText>
          ))}
        </Svg>
        </View>
      </TouchableWithoutFeedback>

      {/* Tooltip positioned near selected point */}
      {selectedPoint && (
        <View style={{ position: 'relative', height: 24 }}>
          <View style={[styles.tooltip, { position: 'absolute', left: Math.max(0, Math.min(selectedX - 60, CHART_WIDTH - 120)) }]}>
            <Text style={[styles.tooltipDate, { color: c.text.secondary }]}>
              {new Date(selectedPoint.date + 'T00:00:00').toLocaleDateString()}
            </Text>
            <Text style={[styles.tooltipValue, { color }]}>
              {selectedPoint.value.toFixed(1)}{suffix}
            </Text>
          </View>
        </View>
      )}

      {/* Legend for dual-series */}
      {legend && legend.length > 0 && (
        <View style={styles.legendRow}>
          {legend.map((item, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={[styles.legendLabel, { color: c.text.secondary }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  emptyContainer: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: c.text.muted,
    fontSize: typography.size.base,
    textAlign: 'center',
    lineHeight: typography.lineHeight.base,
  },
  tooltip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingTop: spacing[1],
  },
  tooltipDate: {
    color: c.text.secondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  tooltipValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.sm,
    fontVariant: [...typography.numeric.fontVariant],
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[4],
    paddingTop: spacing[2],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
  },
});
