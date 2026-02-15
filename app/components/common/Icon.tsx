import Svg, { Path, Circle, Line, Rect, Polyline } from 'react-native-svg';
import { colors } from '../../theme/tokens';

export type IconName =
  // Activity/Fitness
  | 'flame'
  | 'muscle'
  | 'target'
  | 'lightning'
  | 'dumbbell'
  | 'scale'
  | 'chair'
  | 'walk'
  | 'run'
  | 'brain'
  // Nutrition
  | 'utensils'
  | 'lunchbox'
  | 'droplet'
  | 'wheat'
  | 'meat'
  | 'salad'
  | 'egg'
  // UI Actions
  | 'check'
  | 'close'
  | 'edit'
  | 'lock'
  | 'warning'
  | 'search'
  | 'lightbulb'
  | 'clipboard'
  | 'camera'
  | 'chart'
  | 'book'
  | 'gear'
  | 'star'
  | 'star-outline'
  | 'chat'
  | 'mail'
  | 'moon'
  | 'eye'
  | 'eye-off'
  // Water tracker
  | 'droplet-filled'
  | 'droplet-empty';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color = colors.text.secondary }: IconProps) {
  const sw = 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {renderIcon(name, color, sw)}
    </Svg>
  );
}

function renderIcon(name: IconName, color: string, sw: number) {
  switch (name) {
    // ─── Activity / Fitness ────────────────────────────────────────────

    case 'flame':
      return (
        <Path
          d="M12 2c0 4-4 6-4 10a4 4 0 008 0c0-4-4-6-4-10z"
          stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
        />
      );

    case 'muscle':
      return (
        <>
          <Path
            d="M4 15c0-3 2-5 4-5s3 1 4 1 2-1 4-1 4 2 4 5"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M4 15c-1 0-2-1-2-2s1-2 2-2M20 15c1 0 2-1 2-2s-1-2-2-2"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Line x1="9" y1="15" x2="9" y2="19" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="15" y1="15" x2="15" y2="19" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </>
      );

    case 'target':
      return (
        <>
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="6" stroke={color} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="2" stroke={color} strokeWidth={sw} />
        </>
      );

    case 'lightning':
      return (
        <Path
          d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
          stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
        />
      );

    case 'dumbbell':
      return (
        <>
          <Line x1="6" y1="12" x2="18" y2="12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Rect x="2" y="9" width="4" height="6" rx="1" stroke={color} strokeWidth={sw} />
          <Rect x="18" y="9" width="4" height="6" rx="1" stroke={color} strokeWidth={sw} />
        </>
      );

    case 'scale':
      return (
        <>
          <Line x1="12" y1="3" x2="12" y2="21" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Path
            d="M5 7l7-4 7 4"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M2 12c0-2 1.5-3.5 3-5l0 0c1.5 1.5 3 3 3 5a3 3 0 01-6 0z"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M16 12c0-2 1.5-3.5 3-5l0 0c1.5 1.5 3 3 3 5a3 3 0 01-6 0z"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      );

    case 'chair':
      return (
        <>
          <Path
            d="M5 11V5a2 2 0 012-2h10a2 2 0 012 2v6"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Rect x="3" y="11" width="18" height="4" rx="1" stroke={color} strokeWidth={sw} />
          <Line x1="6" y1="15" x2="6" y2="21" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="18" y1="15" x2="18" y2="21" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </>
      );

    case 'walk':
      return (
        <>
          <Circle cx="13" cy="4" r="1.5" stroke={color} strokeWidth={sw} />
          <Path
            d="M10 21l2-7 3 3v5M14 14l2-3-3-3-3 1-2 4"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      );

    case 'run':
      return (
        <>
          <Circle cx="14" cy="4" r="1.5" stroke={color} strokeWidth={sw} />
          <Path
            d="M6 21l3-7 4 2 4-5M17 10l-4-3-4 1-2 4"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M17 10l2-1"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      );

    case 'brain':
      return (
        <Path
          d="M12 2a5 5 0 00-4.8 3.6A4 4 0 004 9.5a4 4 0 00.7 5.3A3.5 3.5 0 005 18a3.5 3.5 0 003.5 3.5c.8 0 1.5-.2 2.1-.6.4.1.9.1 1.4.1s1 0 1.4-.1c.6.4 1.3.6 2.1.6A3.5 3.5 0 0019 18a3.5 3.5 0 00.3-3.2A4 4 0 0020 9.5a4 4 0 00-3.2-3.9A5 5 0 0012 2z"
          stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
        />
      );

    // ─── Nutrition ──────────────────────────────────────────────────────

    case 'utensils':
      return (
        <>
          <Path
            d="M3 3v7a3 3 0 003 3h0V21"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Line x1="3" y1="7" x2="9" y2="7" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Path
            d="M9 3v7a3 3 0 01-3 3"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M18 3v5a3 3 0 01-3 3h0v10"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M21 3v5a3 3 0 01-3 3"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      );

    case 'lunchbox':
      return (
        <>
          <Rect x="3" y="6" width="18" height="14" rx="2" stroke={color} strokeWidth={sw} />
          <Line x1="3" y1="13" x2="21" y2="13" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="12" y1="6" x2="12" y2="13" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Path
            d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      );

    case 'droplet':
      return (
        <Path
          d="M12 2c0 0-6 7-6 11a6 6 0 0012 0c0-4-6-11-6-11z"
          stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
        />
      );

    case 'wheat':
      return (
        <>
          <Path
            d="M12 21V10"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M8 10c2 0 4 2 4 4M16 10c-2 0-4 2-4 4"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M7 7c2 0 4 1.5 5 3M17 7c-2 0-4 1.5-5 3"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M8 4c2 0 3.5 1.5 4 3M16 4c-2 0-3.5 1.5-4 3"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      );

    case 'meat':
      return (
        <>
          <Path
            d="M15 3a6 6 0 00-6 6c0 4 3 7 6 9 3-2 6-5 6-9a6 6 0 00-6-6z"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M9 9c-2 0-4 1-5 3s0 5 2 6"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Circle cx="14" cy="9" r="1" stroke={color} strokeWidth={sw} />
        </>
      );

    case 'salad':
      return (
        <>
          <Path
            d="M3 14h18a8 8 0 01-8 8H11a8 8 0 01-8-8z"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M8 14c0-3 1-5 4-6M16 14c0-3-1-5-4-6"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M12 8V3"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
          <Path
            d="M9 5c0-1.5 1.3-3 3-3s3 1.5 3 3"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      );

    case 'egg':
      return (
        <>
          <Circle cx="12" cy="14" r="8" stroke={color} strokeWidth={sw} />
          <Circle cx="12" cy="14" r="3" stroke={color} strokeWidth={sw} />
          <Path
            d="M8 3l2 3M16 3l-2 3"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      );

    // ─── UI Actions ─────────────────────────────────────────────────────

    case 'check':
      return (
        <Polyline
          points="4 12 9 17 20 6"
          stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          fill="none"
        />
      );

    case 'close':
      return (
        <>
          <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </>
      );

    case 'edit':
      return (
        <>
          <Path
            d="M17 3a2.83 2.83 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      );

    case 'lock':
      return (
        <>
          <Rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth={sw} />
          <Path
            d="M8 11V7a4 4 0 018 0v4"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      );

    case 'warning':
      return (
        <>
          <Path
            d="M10.3 3.2L1.7 18a2 2 0 001.7 3h17.2a2 2 0 001.7-3L13.7 3.2a2 2 0 00-3.4 0z"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Line x1="12" y1="9" x2="12" y2="13" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Circle cx="12" cy="17" r="0.5" stroke={color} strokeWidth={sw} />
        </>
      );

    case 'search':
      return (
        <>
          <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={sw} />
          <Line x1="16" y1="16" x2="21" y2="21" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </>
      );

    case 'lightbulb':
      return (
        <>
          <Path
            d="M9 18h6M10 22h4"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      );

    case 'clipboard':
      return (
        <>
          <Rect x="5" y="3" width="14" height="18" rx="2" stroke={color} strokeWidth={sw} />
          <Path
            d="M9 3h6a1 1 0 011 1v1H8V4a1 1 0 011-1z"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Line x1="9" y1="10" x2="15" y2="10" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="9" y1="14" x2="13" y2="14" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </>
      );

    case 'camera':
      return (
        <>
          <Path
            d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Circle cx="12" cy="13" r="4" stroke={color} strokeWidth={sw} />
        </>
      );

    case 'chart':
      return (
        <>
          <Line x1="18" y1="20" x2="18" y2="10" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="12" y1="20" x2="12" y2="4" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="6" y1="20" x2="6" y2="14" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </>
      );

    case 'book':
      return (
        <>
          <Path
            d="M2 4a2 2 0 012-2h5a3 3 0 013 3v17a2 2 0 00-2-2H4a2 2 0 01-2-2V4z"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M22 4a2 2 0 00-2-2h-5a3 3 0 00-3 3v17a2 2 0 012-2h6a2 2 0 002-2V4z"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      );

    case 'gear':
      return (
        <>
          <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={sw} />
          <Path
            d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.6.77 1.02 1.51 1.08H21a2 2 0 010 4h-.09c-.74.06-1.25.48-1.51 1.08z"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      );

    case 'star':
      return (
        <Path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"
          stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
        />
      );

    case 'star-outline':
      return (
        <Path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"
          stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          fill="none"
        />
      );

    case 'chat':
      return (
        <Path
          d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
          stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
        />
      );

    case 'mail':
      return (
        <>
          <Rect x="2" y="4" width="20" height="16" rx="2" stroke={color} strokeWidth={sw} />
          <Polyline
            points="22 4 12 13 2 4"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
            fill="none"
          />
        </>
      );

    case 'moon':
      return (
        <Path
          d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
          stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
        />
      );

    case 'eye':
      return (
        <>
          <Path
            d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={sw} />
        </>
      );

    case 'eye-off':
      return (
        <>
          <Path
            d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M14.12 14.12a3 3 0 01-4.24-4.24"
            stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          />
          <Line x1="1" y1="1" x2="23" y2="23" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </>
      );

    // ─── Water Tracker ──────────────────────────────────────────────────

    case 'droplet-filled':
      return (
        <Path
          d="M12 2c0 0-6 7-6 11a6 6 0 0012 0c0-4-6-11-6-11z"
          stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
          fill={color} fillOpacity={0.25}
        />
      );

    case 'droplet-empty':
      return (
        <Circle
          cx="12" cy="12" r="8"
          stroke={color} strokeWidth={sw}
        />
      );

    default:
      return null;
  }
}
