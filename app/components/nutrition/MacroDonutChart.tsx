import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface Props {
  protein: number;
  carbs: number;
  fat: number;
  size?: number;
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = { x: cx + r * Math.cos(startAngle), y: cy + r * Math.sin(startAngle) };
  const end = { x: cx + r * Math.cos(endAngle), y: cy + r * Math.sin(endAngle) };
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

const COLORS = { protein: '#22C55E', carbs: '#F59E0B', fat: '#EF4444' };

export function MacroDonutChart({ protein, carbs, fat, size = 120 }: Props) {
  const total = protein + carbs + fat;
  if (total === 0) return <View style={{ width: size, height: size }} />;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeW = size * 0.15;
  const GAP = 0.04; // small gap between segments

  const segments = [
    { value: protein, color: COLORS.protein },
    { value: carbs, color: COLORS.carbs },
    { value: fat, color: COLORS.fat },
  ].filter((s) => s.value > 0);

  let angle = -Math.PI / 2;

  return (
    <Svg width={size} height={size}>
      {segments.map((seg, i) => {
        const sweep = (seg.value / total) * Math.PI * 2;
        if (sweep < 0.01) return null;
        const start = angle + (i > 0 ? GAP / 2 : 0);
        const end = angle + sweep - (i < segments.length - 1 ? GAP / 2 : 0);
        angle += sweep;
        return (
          <Path
            key={i}
            d={arcPath(cx, cy, r, start, end)}
            stroke={seg.color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            fill="none"
          />
        );
      })}
    </Svg>
  );
}
