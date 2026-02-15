import React from 'react';
import Svg, { Path, Rect, Line, Circle, Ellipse } from 'react-native-svg';

interface MuscleGroupIconProps {
  muscleGroup: string;
  size?: number;
  color?: string;
}

export function MuscleGroupIcon({ muscleGroup, size = 24, color = '#FFFFFF' }: MuscleGroupIconProps) {
  const sw = size < 24 ? 1.5 : 2;

  switch (muscleGroup) {
    case 'chest':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 8c0-1 1.5-3 4-3s4 3 4 5"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Path
            d="M20 8c0-1-1.5-3-4-3s-4 3-4 5"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Path
            d="M4 8c0 3 2 6 8 9c6-3 8-6 8-9"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </Svg>
      );

    case 'back':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3v18"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Path
            d="M12 5L6 10l-1 8"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M12 5l6 5 1 8"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M8 13l4 2 4-2"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </Svg>
      );

    case 'shoulders':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 8v10"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Path
            d="M8 12H4c0-4 3-7 8-7s8 3 8 7h-4"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Circle cx={5} cy={13} r={2.5} stroke={color} strokeWidth={sw} />
          <Circle cx={19} cy={13} r={2.5} stroke={color} strokeWidth={sw} />
        </Svg>
      );

    case 'biceps':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M16 4c0 0-1 3-1 6s2 5 2 5"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M14 4c0 0 1 3 1 6s-2 5-2 5"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M13 15l-2 5"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Path
            d="M17 15l2 5"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Path
            d="M12 7c-1-1.5-3-2-4-1"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
        </Svg>
      );

    case 'triceps':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M8 4v8c0 2 1 4 2 5l1 4"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M14 4v8c0 2-1 4-2 5l-1 4"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M9 9h4"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
        </Svg>
      );

    case 'quads':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M8 3c-1 4-2 9-1 13l1 5"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M16 3c1 4 2 9 1 13l-1 5"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M12 3v13"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Path
            d="M8 3h8"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
        </Svg>
      );

    case 'hamstrings':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M8 3c-1 5-1.5 10-1 14l1 4"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M16 3c1 5 1.5 10 1 14l-1 4"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M8 3h8"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Path
            d="M9 10c2 1 4 1 6 0"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Path
            d="M9 15c2 1 4 1 6 0"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
        </Svg>
      );

    case 'glutes':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 8c0 5 3 10 8 13c5-3 8-8 8-13"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M12 8v10"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Path
            d="M4 8c1-3 4-5 8-5s7 2 8 5"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </Svg>
      );

    case 'calves':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 2c-1 3-2 6-1.5 10c.5 3 .5 6 1 9"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M15 2c1 3 2 6 1.5 10c-.5 3-.5 6-1 9"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M8.5 21h7"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
        </Svg>
      );

    case 'abs':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect
            x={6} y={3} width={12} height={18} rx={3}
            stroke={color} strokeWidth={sw}
          />
          <Line x1={12} y1={3} x2={12} y2={21} stroke={color} strokeWidth={sw} />
          <Line x1={6} y1={8} x2={18} y2={8} stroke={color} strokeWidth={sw} />
          <Line x1={6} y1={13} x2={18} y2={13} stroke={color} strokeWidth={sw} />
          <Line x1={7} y1={18} x2={17} y2={18} stroke={color} strokeWidth={sw} />
        </Svg>
      );

    case 'traps':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3L4 11v4l8-4 8 4v-4L12 3z"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M12 11v7"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Circle cx={12} cy={4} r={2} stroke={color} strokeWidth={sw} />
        </Svg>
      );

    case 'forearms':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M8 3c-.5 4-1 9 0 13l1 5"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M15 3c.5 4 1 9 0 13l-1 5"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M8 3h7"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Ellipse cx={11.5} cy={7} rx={3} ry={1.5} stroke={color} strokeWidth={sw} />
        </Svg>
      );

    case 'full_body':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={4} r={2.5} stroke={color} strokeWidth={sw} />
          <Path
            d="M12 7v6"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Path
            d="M12 13l-4 8"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Path
            d="M12 13l4 8"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Path
            d="M12 9l-5 3"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Path
            d="M12 9l5 3"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
        </Svg>
      );

    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={sw} />
          <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={sw} />
        </Svg>
      );
  }
}
