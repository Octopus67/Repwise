/**
 * GuidedCameraView — wraps expo-camera with a PoseOverlay layer.
 *
 * Renders the camera preview with the selected pose silhouette overlay.
 * Handles capture and returns the photo URI via onCapture callback.
 */

import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { PoseType } from '../../utils/progressPhotoTypes';
import { PoseOverlay } from './PoseOverlay';

interface GuidedCameraViewProps {
  poseType: PoseType;
  onCapture: (uri: string) => void;
  onCancel: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CAMERA_HEIGHT = SCREEN_WIDTH * 1.33;

export function GuidedCameraView({ poseType, onCapture, onCancel }: GuidedCameraViewProps) {
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Camera access is required for progress photos.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        onCapture(photo.uri);
      }
    } catch {
      // Camera capture failed — user can retry
    } finally {
      setCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        />
        <PoseOverlay
          poseType={poseType}
          containerWidth={SCREEN_WIDTH}
          containerHeight={CAMERA_HEIGHT}
        />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
          onPress={handleCapture}
          disabled={capturing}
          activeOpacity={0.7}
        >
          {capturing ? (
            <ActivityIndicator color={colors.text.inverse} size="small" />
          ) : (
            <View style={styles.captureInner} />
          )}
        </TouchableOpacity>

        <View style={{ width: 60 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.base,
    padding: spacing[4],
  },
  cameraContainer: {
    width: SCREEN_WIDTH,
    height: CAMERA_HEIGHT,
    overflow: 'hidden',
  },
  camera: {
    width: SCREEN_WIDTH,
    height: CAMERA_HEIGHT,
  },
  controls: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnDisabled: {
    opacity: 0.5,
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.text.primary,
  },
  cancelBtn: {
    width: 60,
    padding: spacing[2],
  },
  cancelText: {
    color: colors.accent.primary,
    fontSize: typography.size.base,
  },
  permText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  permBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    marginBottom: spacing[2],
  },
  permBtnText: {
    color: colors.text.inverse,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});
