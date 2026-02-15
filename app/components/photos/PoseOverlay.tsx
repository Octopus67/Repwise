/**
 * PoseOverlay — renders a semi-transparent silhouette SVG on top of the
 * camera preview to guide the user into a consistent body position.
 *
 * Renders at 30% opacity, scaled proportionally to the container.
 */

import { View, Image, StyleSheet } from 'react-native';
import { PoseType } from '../../utils/progressPhotoTypes';
import { computeOverlayDimensions, poseToAssetPath } from '../../utils/poseOverlayLogic';

interface PoseOverlayProps {
  poseType: PoseType;
  containerWidth: number;
  containerHeight: number;
}

// Default aspect ratio for our SVG silhouettes (200x400 viewBox = 0.5)
const ASSET_ASPECT_RATIO = 0.5;

export function PoseOverlay({ poseType, containerWidth, containerHeight }: PoseOverlayProps) {
  const { width, height } = computeOverlayDimensions(
    containerWidth,
    containerHeight,
    ASSET_ASPECT_RATIO,
  );

  if (width <= 0 || height <= 0) return null;

  const _assetPath = poseToAssetPath(poseType);

  return (
    <View style={[styles.container, { width: containerWidth, height: containerHeight }]} pointerEvents="none">
      <View style={[styles.overlay, { width, height }]}>
        {/* SVG rendered as Image — in production use react-native-svg */}
        <Image
          source={{ uri: _assetPath }}
          style={{ width, height, opacity: 0.3 }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
