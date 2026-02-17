import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { AnatomicalRegion, BodyOutline, VIEWBOX } from './anatomicalPaths';
import { getHeatMapColor } from '../../utils/muscleVolumeLogic';
import { colors } from '../../theme/tokens';

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

export function BodySilhouette({ view, regions, outline, volumeMap, onRegionPress }: BodySilhouetteProps) {
  const opacityRefs = useRef<Map<string, Animated.Value>>(new Map());

  const getOpacity = useCallback((id: string): Animated.Value => {
    if (!opacityRefs.current.has(id)) {
      opacityRefs.current.set(id, new Animated.Value(colors.heatmap.regionOpacity));
    }
    return opacityRefs.current.get(id)!;
  }, []);

  const handlePress = useCallback((regionId: string) => {
    const opacity = getOpacity(regionId);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 0.5, duration: 75, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: colors.heatmap.regionOpacity, duration: 75, useNativeDriver: true }),
    ]).start();
    onRegionPress(regionId);
  }, [getOpacity, onRegionPress]);

  return (
    <Svg viewBox={VIEWBOX}>
      {/* Layer 1: Base outline */}
      <Path
        d={outline.path}
        fill="none"
        stroke={colors.heatmap.silhouetteStroke}
        strokeWidth={1}
      />

      {/* Layer 2: Muscle fills */}
      <G>
        {regions.map((region) => {
          const vol = volumeMap.get(region.id);
          const color = getHeatMapColor(
            vol?.effective_sets ?? 0,
            vol?.mev ?? 0,
            vol?.mrv ?? 0,
          );
          return (
            <AnimatedPath
              key={`fill-${region.id}`}
              d={region.path}
              fill={color}
              opacity={getOpacity(region.id)}
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

      {/* Layer 4: Touch targets */}
      <G>
        {regions.map((region) => (
          <Path
            key={`touch-${region.id}`}
            d={region.path}
            fill="transparent"
            onPress={() => handlePress(region.id)}
          />
        ))}
      </G>
    </Svg>
  );
}
