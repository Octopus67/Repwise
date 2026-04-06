import { useCallback } from 'react';
import { Platform } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import Animated, { useSharedValue, withTiming, withSequence, useAnimatedProps } from 'react-native-reanimated';
import { AnatomicalRegion, BodyOutline, VIEWBOX } from './anatomicalPaths';
import { getHeatMapColor } from '../../utils/muscleVolumeLogic';
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

export function BodySilhouette({ view, regions, outline, volumeMap, onRegionPress }: BodySilhouetteProps) {
  const c = useThemeColors();
  const reduceMotion = useReduceMotion();

  return (
    <Svg viewBox={VIEWBOX}>
      {/* Layer 1: Base outline */}
      <Path
        d={outline.path}
        fill="none"
        stroke={c.heatmap.silhouetteStroke}
        strokeWidth={1}
      />

      {/* Layer 2: Muscle fills + touch targets */}
      <G>
        {regions.map((region) => {
          const vol = volumeMap.get(region.id);
          const color = getHeatMapColor(
            vol?.effective_sets ?? 0,
            vol?.mev ?? 0,
            vol?.mrv ?? 0,
          );
          return (
            <RegionComponent
              key={region.id}
              region={region}
              color={color}
              baseOpacity={c.heatmap.regionOpacity}
              onPress={onRegionPress}
              reduceMotion={reduceMotion}
            />
          );
        })}
      </G>

      {/* Layer 3: Region borders */}
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
  );
}
