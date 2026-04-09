import { useCallback } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Path, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, withTiming, withSequence, useAnimatedProps } from 'react-native-reanimated';
import { AnatomicalRegion, BodyOutline, VIEWBOX_FRONT, VIEWBOX_BACK } from './anatomicalPathsV2';
import { getHeatMapColor, getWNSHeatMapColor } from '../../utils/muscleVolumeLogic';
import { colors } from '../../theme/tokens';
import { useThemeColors, getThemeColors } from '../../hooks/useThemeColors';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { haptic } from '../../utils/haptics';
import type { MuscleGroupVolume } from '../../types/analytics';

const isWeb = Platform.OS === 'web';

interface BodySilhouetteProps {
  view: 'front' | 'back';
  regions: AnatomicalRegion[];
  outline: BodyOutline;
  volumeMap: Map<string, MuscleGroupVolume>;
  onRegionPress: (muscleGroup: string) => void;
  isWNS?: boolean;
}

const AnimatedPath = isWeb ? Path : Animated.createAnimatedComponent(Path);

interface RegionProps {
  region: AnatomicalRegion;
  color: string;
  baseOpacity: number;
  onPress: (id: string) => void;
  reduceMotion: boolean;
}

/** Web: plain SVG, no Reanimated hooks */
function WebRegion({ region, color, baseOpacity, onPress }: RegionProps) {
  const handlePress = useCallback(() => onPress(region.id), [onPress, region.id]);
  return (
    <>
      <Path d={region.path} fill={color} opacity={baseOpacity} />
      <Path d={region.path} fill="transparent" onPress={handlePress} />
    </>
  );
}

/** Native: animated opacity on press with haptic feedback */
function NativeRegion({ region, color, baseOpacity, onPress, reduceMotion }: RegionProps) {
  const opacity = useSharedValue(baseOpacity);
  const strokeW = useSharedValue(0.8);

  const animatedProps = useAnimatedProps(() => ({
    opacity: opacity.value,
  }));

  const animatedBorderProps = useAnimatedProps(() => ({
    strokeWidth: strokeW.value,
  }));

  const handlePress = useCallback(() => {
    haptic.selection();
    if (!reduceMotion) {
      opacity.value = withSequence(
        withTiming(1, { duration: 75 }),
        withTiming(baseOpacity, { duration: 150 }),
      );
      strokeW.value = withSequence(
        withTiming(2.5, { duration: 75 }),
        withTiming(0.8, { duration: 150 }),
      );
    }
    onPress(region.id);
  }, [reduceMotion, baseOpacity, onPress, region.id]);

  return (
    <>
      <AnimatedPath
        d={region.path}
        fill={color}
        animatedProps={animatedProps}
      />
      <AnimatedPath
        d={region.path}
        fill="none"
        stroke={color}
        animatedProps={animatedBorderProps}
      />
      <Path
        d={region.path}
        fill="transparent"
        onPress={handlePress}
      />
    </>
  );
}

const RegionComponent = isWeb ? WebRegion : NativeRegion;

/** Lighten a hex color by mixing with white */
function lighten(hex: string, amount = 0.3): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + Math.round((255 - ((n >> 16) & 0xff)) * amount));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round((255 - ((n >> 8) & 0xff)) * amount));
  const b = Math.min(255, (n & 0xff) + Math.round((255 - (n & 0xff)) * amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function BodySilhouette({ view, regions, outline, volumeMap, onRegionPress, isWNS }: BodySilhouetteProps) {
  const c = useThemeColors();
  const reduceMotion = useReduceMotion();

  /** Get heatmap color for a volume entry, handling both WNS and standard. */
  const regionColor = (vol: MuscleGroupVolume | undefined, wns?: boolean): string => {
    const hu = vol?.hypertrophy_units ?? 0;
    const sets = vol?.effective_sets ?? 0;
    const mev = vol?.mev ?? 0;
    const mrv = vol?.mrv ?? 0;
    if (wns && hu > 0) {
      if (mev > 0 && mrv > 0) {
        return getWNSHeatMapColor(hu, { mv: 0, mev, mav_low: vol?.mav ?? 0, mav_high: vol?.mav ?? 0, mrv });
      }
      const tc = getThemeColors();
      return hu < 3 ? tc.heatmap.belowMev : hu < 8 ? tc.heatmap.optimal : hu < 12 ? tc.heatmap.nearMrv : tc.heatmap.aboveMrv;
    }
    return getHeatMapColor(sets, mev, mrv);
  };

  const a11ySummary = regions
    .filter(r => volumeMap.has(r.id))
    .slice(0, 5)
    .map(r => {
      const v = volumeMap.get(r.id)!;
      const val = isWNS ? `${(v.hypertrophy_units ?? 0).toFixed(1)} HU` : `${Math.round(v.effective_sets)} sets`;
      return `${r.id}: ${val}`;
    })
    .join(', ');

  return (
    <View accessibilityRole="image" accessibilityLabel={`Muscle volume heatmap. ${a11ySummary || 'No data'}`}>
    <Svg viewBox={view === 'front' ? VIEWBOX_FRONT : VIEWBOX_BACK} width="100%" height={480}>
      {/* Gradient definitions for each active region */}
      <Defs>
        {regions.map((region) => {
          const vol = volumeMap.get(region.id);
          const color = regionColor(vol, isWNS);
          return (
            <LinearGradient key={`grad-${region.id}`} id={`muscleGrad-${region.id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={lighten(color, 0.25)} />
              <Stop offset="1" stopColor={color} />
            </LinearGradient>
          );
        })}
      </Defs>

      {/* Layer 1: Base outline */}
      <Path
        d={outline.path}
        fill="none"
        stroke={c.heatmap.regionBorder}
        strokeWidth={0.5}
      />

      {/* Layer 2: Glow effect for active regions */}
      <G opacity={0.35}>
        {regions.map((region) => {
          const vol = volumeMap.get(region.id);
          const active = isWNS ? (vol?.hypertrophy_units ?? 0) > 0 : (vol?.effective_sets ?? 0) > 0;
          if (!active) return null;
          const glowColor = regionColor(vol, isWNS);
          return (
            <Path
              key={`glow-${region.id}`}
              d={region.path}
              fill={glowColor}
              stroke={glowColor}
              strokeWidth={3}
            />
          );
        })}
      </G>

      {/* Layer 3: Muscle fills with gradients + touch targets */}
      <G>
        {regions.map((region) => {
          const vol = volumeMap.get(region.id);
          const active = isWNS ? (vol?.hypertrophy_units ?? 0) > 0 : (vol?.effective_sets ?? 0) > 0;
          const fillColor = regionColor(vol, isWNS);
          return (
            <RegionComponent
              key={region.id}
              region={region}
              color={active ? `url(#muscleGrad-${region.id})` : fillColor}
              baseOpacity={c.heatmap.regionOpacity}
              onPress={onRegionPress}
              reduceMotion={reduceMotion}
            />
          );
        })}
      </G>

      {/* Layer 4: Region borders */}
      <G>
        {regions.map((region) => (
          <Path
            key={`border-${region.id}`}
            d={region.path}
            fill="none"
            stroke={c.heatmap.regionBorder}
            strokeWidth={0.8}
          />
        ))}
      </G>
    </Svg>
    </View>
  );
}
