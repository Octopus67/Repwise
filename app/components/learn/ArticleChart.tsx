import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { colors, spacing, typography, radius } from '../../theme/tokens';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

interface ComparisonDatum {
  label: string;
  values: { name: string; value: number; color: string }[];
}

interface ChartConfig {
  type: 'bar' | 'comparison';
  title: string;
  subtitle?: string;
  suffix?: string;
  data: BarDatum[] | ComparisonDatum[];
}

interface ArticleChartProps {
  chartId: string;
}

// ─── Chart registry ──────────────────────────────────────────────────────────

const CHART_REGISTRY: Record<string, ChartConfig> = {
  'volume-dose-response': {
    type: 'bar',
    title: 'Weekly Sets vs Muscle Growth',
    subtitle: 'Estimated hypertrophy by weekly set volume',
    suffix: '%',
    data: [
      { label: '5 sets/wk', value: 3.9, color: colors.accent.primary },
      { label: '10 sets/wk', value: 6.8, color: colors.semantic.positive },
      { label: '15 sets/wk', value: 8.0, color: colors.semantic.warning },
      { label: '20 sets/wk', value: 8.5, color: colors.semantic.negative },
    ] as BarDatum[],
  },

  'frequency-comparison': {
    type: 'comparison',
    title: 'Training Frequency: Effect on Hypertrophy',
    subtitle: 'Effect size (Hedges\' g) for muscle growth',
    data: [
      {
        label: 'Hypertrophy Effect Size',
        values: [
          { name: '1×/week', value: 0.30, color: colors.text.muted },
          { name: '2×/week', value: 0.49, color: colors.semantic.positive },
        ],
      },
    ] as ComparisonDatum[],
  },

  'protein-threshold': {
    type: 'bar',
    title: 'Protein Intake vs Muscle Gain',
    subtitle: 'Relative gain at different daily protein intakes',
    suffix: '%',
    data: [
      { label: '0.8 g/kg', value: 40, color: colors.text.muted },
      { label: '1.2 g/kg', value: 68, color: colors.accent.primary },
      { label: '1.6 g/kg', value: 95, color: colors.semantic.positive },
      { label: '2.0 g/kg', value: 100, color: colors.semantic.positive },
      { label: '2.4 g/kg', value: 100, color: colors.semantic.warning },
    ] as BarDatum[],
  },

  'rest-intervals': {
    type: 'comparison',
    title: 'Short vs Long Rest Intervals',
    subtitle: 'Effect on strength and hypertrophy outcomes',
    data: [
      {
        label: 'Strength Gain',
        values: [
          { name: '60s rest', value: 0.34, color: colors.semantic.negative },
          { name: '2-3min rest', value: 0.63, color: colors.semantic.positive },
        ],
      },
      {
        label: 'Hypertrophy',
        values: [
          { name: '60s rest', value: 0.28, color: colors.semantic.negative },
          { name: '2-3min rest', value: 0.49, color: colors.semantic.positive },
        ],
      },
    ] as ComparisonDatum[],
  },

  'failure-proximity': {
    type: 'comparison',
    title: 'Training to Failure vs Stopping Short',
    subtitle: 'Effect size difference for hypertrophy and strength',
    data: [
      {
        label: 'Hypertrophy',
        values: [
          { name: 'To Failure', value: 0.19, color: colors.semantic.positive },
          { name: 'Not to Failure', value: 0.00, color: colors.text.muted },
        ],
      },
      {
        label: 'Strength',
        values: [
          { name: 'To Failure', value: 0.12, color: colors.accent.primary },
          { name: 'Not to Failure', value: 0.11, color: colors.text.muted },
        ],
      },
    ] as ComparisonDatum[],
  },

  'protein-timing': {
    type: 'comparison',
    title: 'Protein Timing: Does It Matter?',
    subtitle: 'Effect size on hypertrophy with vs without peri-workout timing',
    data: [
      {
        label: 'Hypertrophy',
        values: [
          { name: 'Peri-workout', value: 0.28, color: colors.accent.primary },
          { name: 'Any time', value: 0.24, color: colors.text.muted },
        ],
      },
    ] as ComparisonDatum[],
  },

  'periodization-comparison': {
    type: 'bar',
    title: 'Periodization Models vs No Plan',
    subtitle: 'Effect size for strength gains',
    data: [
      { label: 'No Plan', value: 0.54, color: colors.text.muted },
      { label: 'Linear', value: 0.78, color: colors.accent.primary },
      { label: 'Undulating', value: 0.82, color: colors.semantic.positive },
    ] as BarDatum[],
  },

  'recomp-factors': {
    type: 'bar',
    title: 'Key Factors for Body Recomposition',
    subtitle: 'Relative importance for successful recomp',
    suffix: '%',
    data: [
      { label: 'Protein 2.0+ g/kg', value: 95, color: colors.semantic.positive },
      { label: 'Moderate deficit', value: 90, color: colors.semantic.positive },
      { label: 'Resistance training', value: 85, color: colors.accent.primary },
      { label: 'Sleep 7-9h', value: 75, color: colors.semantic.warning },
      { label: 'Slow loss rate', value: 70, color: colors.semantic.warning },
    ] as BarDatum[],
  },

  'creatine-effects': {
    type: 'bar',
    title: 'Creatine Supplementation Effects',
    subtitle: 'Measured improvements with creatine monohydrate',
    data: [
      { label: 'Lean mass', value: 1.4, color: colors.semantic.positive },
      { label: 'Strength', value: 8, color: colors.semantic.positive },
      { label: 'Sprint', value: 5, color: colors.accent.primary },
      { label: 'Volume', value: 14, color: colors.semantic.positive },
    ] as BarDatum[],
  },
};

// ─── Bar Chart ───────────────────────────────────────────────────────────────

const BAR_HEIGHT = 22;
const BAR_GAP = 10;
const LABEL_WIDTH = 90;
const VALUE_WIDTH = 50;
const BAR_AREA_WIDTH = 180;

function BarChart({ data, suffix }: { data: BarDatum[]; suffix?: string }) {
  const maxVal = Math.max(...data.map((d) => d.value));
  const svgHeight = data.length * (BAR_HEIGHT + BAR_GAP) - BAR_GAP + 8;
  const svgWidth = LABEL_WIDTH + BAR_AREA_WIDTH + VALUE_WIDTH;

  return (
    <Svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
      {data.map((d, i) => {
        const y = i * (BAR_HEIGHT + BAR_GAP);
        const barWidth = maxVal > 0 ? (d.value / maxVal) * BAR_AREA_WIDTH : 0;
        const barColor = d.color ?? colors.accent.primary;

        return (
          <View key={d.label}>
            {/* Label */}
            <SvgText
              x={LABEL_WIDTH - 6}
              y={y + BAR_HEIGHT / 2 + 4}
              textAnchor="end"
              fill={colors.text.secondary}
              fontSize={11}
              fontWeight="500"
            >
              {d.label}
            </SvgText>

            {/* Bar background */}
            <Rect
              x={LABEL_WIDTH}
              y={y + 2}
              width={BAR_AREA_WIDTH}
              height={BAR_HEIGHT - 4}
              rx={4}
              fill={colors.bg.surfaceRaised}
            />

            {/* Bar fill */}
            <Rect
              x={LABEL_WIDTH}
              y={y + 2}
              width={Math.max(barWidth, 4)}
              height={BAR_HEIGHT - 4}
              rx={4}
              fill={barColor}
              opacity={0.85}
            />

            {/* Value */}
            <SvgText
              x={LABEL_WIDTH + BAR_AREA_WIDTH + 8}
              y={y + BAR_HEIGHT / 2 + 4}
              textAnchor="start"
              fill={colors.text.primary}
              fontSize={11}
              fontWeight="600"
            >
              {d.value}{suffix ?? ''}
            </SvgText>
          </View>
        );
      })}
    </Svg>
  );
}

// ─── Comparison Chart ────────────────────────────────────────────────────────

const COMP_BAR_WIDTH = 48;
const COMP_BAR_MAX_HEIGHT = 100;
const COMP_GROUP_GAP = 32;

function ComparisonChart({ data }: { data: ComparisonDatum[] }) {
  const allValues = data.flatMap((g) => g.values.map((v) => v.value));
  const maxVal = Math.max(...allValues);

  const groupCount = data.length;
  const barsPerGroup = data[0]?.values.length ?? 0;
  const groupWidth = barsPerGroup * COMP_BAR_WIDTH + (barsPerGroup - 1) * 8;
  const totalWidth = groupCount * groupWidth + (groupCount - 1) * COMP_GROUP_GAP;

  const svgHeight = COMP_BAR_MAX_HEIGHT + 48; // bars + labels
  const svgWidth = Math.max(totalWidth, 200);

  return (
    <View>
      <Svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {/* Baseline */}
        <Line
          x1={0}
          y1={COMP_BAR_MAX_HEIGHT}
          x2={svgWidth}
          y2={COMP_BAR_MAX_HEIGHT}
          stroke={colors.border.subtle}
          strokeWidth={1}
        />

        {data.map((group, gi) => {
          const groupX = gi * (groupWidth + COMP_GROUP_GAP) + (svgWidth - totalWidth) / 2;

          return (
            <View key={group.label}>
              {group.values.map((v, vi) => {
                const barX = groupX + vi * (COMP_BAR_WIDTH + 8);
                const barH = maxVal > 0 ? (v.value / maxVal) * (COMP_BAR_MAX_HEIGHT - 16) : 0;
                const barY = COMP_BAR_MAX_HEIGHT - barH;

                return (
                  <View key={v.name}>
                    {/* Value label above bar */}
                    <SvgText
                      x={barX + COMP_BAR_WIDTH / 2}
                      y={barY - 6}
                      textAnchor="middle"
                      fill={colors.text.primary}
                      fontSize={12}
                      fontWeight="600"
                    >
                      {v.value}
                    </SvgText>

                    {/* Bar */}
                    <Rect
                      x={barX}
                      y={barY}
                      width={COMP_BAR_WIDTH}
                      height={Math.max(barH, 4)}
                      rx={6}
                      fill={v.color}
                      opacity={0.85}
                    />

                    {/* Name label below */}
                    <SvgText
                      x={barX + COMP_BAR_WIDTH / 2}
                      y={COMP_BAR_MAX_HEIGHT + 16}
                      textAnchor="middle"
                      fill={colors.text.secondary}
                      fontSize={10}
                      fontWeight="500"
                    >
                      {v.name}
                    </SvgText>
                  </View>
                );
              })}

              {/* Group label */}
              <SvgText
                x={groupX + groupWidth / 2}
                y={COMP_BAR_MAX_HEIGHT + 34}
                textAnchor="middle"
                fill={colors.text.muted}
                fontSize={10}
              >
                {group.label}
              </SvgText>
            </View>
          );
        })}
      </Svg>
    </View>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ArticleChart({ chartId }: ArticleChartProps) {
  const config = CHART_REGISTRY[chartId];
  if (!config) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{config.title}</Text>
      {config.subtitle && <Text style={styles.subtitle}>{config.subtitle}</Text>}

      <View style={styles.chartArea}>
        {config.type === 'bar' && (
          <BarChart data={config.data as BarDatum[]} suffix={config.suffix} />
        )}
        {config.type === 'comparison' && (
          <ComparisonChart data={config.data as ComparisonDatum[]} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[4],
    marginVertical: spacing[4],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[1],
  },
  subtitle: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    marginBottom: spacing[3],
  },
  chartArea: {
    alignItems: 'center',
    maxHeight: 200,
  },
});
