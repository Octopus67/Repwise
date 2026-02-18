import { useRef, useCallback } from 'react';
import Svg, { Path, G } from 'react-native-svg';
import Animated, { useSharedValue, withTiming, withSequence, useAnimatedProps } from 'react-native-reanimated';
import { AnatomicalRegion, BodyOutline, VIEWBOX } from './anatomicalPaths';
import { getHeatMapColor } from '../../utils/muscleVolumeLogic';
import { colors } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface MuscleGroupVolume {
  muscle_group: string;
  effective_sets: number;
  frequency: number;
  volume_status: string;
  mev: number;
  mav: number;
  mrv: number;
}

interface BodySilhouetteProps {
  view: 'front' | 'back';
  regions: AnatomicalRegion[];
  outline: BodyOutline;
  volumeMap: Map<string, MuscleGroupVolume>;
  onRegionPress: (muscleGroup: string) => void;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Individual region with its own shared value for press animation */
function AnimatedRegion({
  region,
  color,
  baseOpacity,
  onPress,
  reduceMotion,
}: {
  region: AnatomicalRegion;
  color: string;
  baseOpacity: number;
  onPress: (id: string) => void;
  reduceMotion: boolean;
}) {
  const opacity = useSharedValue(baseOpacity);

  const animatedProps = useAnimatedProps(() => ({
    opacity: opacity.value,
  }));

  const handlePress = useCallback(() => {
    if (!reduceMotion) {
      opacity.value = withSequence(
        withTiming(0.5, { duration: 75 }),
        withTiming(baseOpacity, { duration: 75 }),
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
      <Path
        d={region.path}
        fill="transparent"
        onPress={handlePress}
      />
    </>
  );
}

export function BodySilhouette({ view, regions, outline, volumeMap, onRegionPress }: BodySilhouetteProps) {
  const reduceMotion = useReduceMotion();

  return (
    <Svg viewBox={VIEWBOX}>
      {/* Layer 1: Base outline */}
      <Path
        d={outline.path}
        fill="none"
        stroke={colors.heatmap.silhouetteStroke}
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
            <AnimatedRegion
              key={region.id}
              region={region}
              color={color}
              baseOpacity={colors.heatmap.regionOpacity}
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
            stroke={colors.heatmap.regionBorder}
            strokeWidth={0.8}
          />
        ))}
      </G>
    </Svg>
  );
}
