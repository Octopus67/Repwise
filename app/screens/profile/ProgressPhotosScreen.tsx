/**
 * ProgressPhotosScreen — enhanced with guided pose overlays, lighting
 * reminders, timeline slider, and auto-aligned comparison.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Icon } from '../../components/common/Icon';
import api from '../../services/api';
import { PhotoMeta, PhotoPathMap, PoseType } from '../../utils/progressPhotoTypes';
import { PoseSelector } from '../../components/photos/PoseSelector';
import { LightingReminder } from '../../components/photos/LightingReminder';
import { GuidedCameraView } from '../../components/photos/GuidedCameraView';
import { TimelineSlider } from '../../components/photos/TimelineSlider';
import { AlignedComparison } from '../../components/photos/AlignedComparison';

const PHOTO_DIR = `${FileSystem.documentDirectory}progress_photos/`;
const STORAGE_KEY = 'progress_photo_paths';
const MAX_PHOTO_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

type CaptureStep = 'idle' | 'pose_select' | 'lighting' | 'camera';
type ViewMode = 'timeline' | 'comparison';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function ProgressPhotosScreen() {
  const navigation = useNavigation();
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [pathMap, setPathMap] = useState<PhotoPathMap>({});
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);

  // Capture flow state
  const [captureStep, setCaptureStep] = useState<CaptureStep>('idle');
  const [selectedPose, setSelectedPose] = useState<PoseType>('front_relaxed');

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [poseFilter, setPoseFilter] = useState<PoseType | 'all'>('all');
  const [compareLeft, setCompareLeft] = useState<PhotoMeta | null>(null);
  const [compareRight, setCompareRight] = useState<PhotoMeta | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [photosRes, storedPaths] = await Promise.all([
        api.get('progress-photos?limit=100'),
        AsyncStorage.getItem(STORAGE_KEY),
      ]);
      setPhotos(photosRes.data?.items ?? []);
      setPathMap(storedPaths ? JSON.parse(storedPaths) : {});
    } catch (err) {
      console.error('[ProgressPhotos] Failed to load data:', err);
      Alert.alert('Error', 'Failed to load progress photos');
    } finally {
      setLoading(false);
    }
  };

  const ensurePhotoDir = async () => {
    const dirInfo = await FileSystem.getInfoAsync(PHOTO_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
    }
  };

  const savePhotoLocally = async (sourceUri: string): Promise<string> => {
    await ensurePhotoDir();
    const filename = `${generateUUID()}.jpg`;
    const destUri = `${PHOTO_DIR}${filename}`;
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    return destUri;
  };

  const updatePathMap = async (photoId: string, fileUri: string) => {
    const updated = { ...pathMap, [photoId]: fileUri };
    setPathMap(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  // --- Capture flow handlers ---

  const startCapture = () => {
    setCaptureStep('pose_select');
  };

  const handlePoseSelect = (pose: PoseType) => {
    setSelectedPose(pose);
    setCaptureStep('lighting');
  };

  const handleLightingDismiss = () => {
    setCaptureStep('camera');
  };

  const handleLightingDontShowAgain = () => {
    // Preference already persisted by LightingReminder component
  };

  const handleCancelCapture = () => {
    setCaptureStep('idle');
  };

  const handleCameraCapture = async (uri: string) => {
    setCaptureStep('idle');
    setCapturing(true);
    try {
      // Validate file size before saving
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      if (fileInfo.exists && 'size' in fileInfo && typeof fileInfo.size === 'number') {
        if (fileInfo.size > MAX_PHOTO_SIZE_BYTES) {
          Alert.alert(
            'Photo too large',
            `Photo must be under ${MAX_PHOTO_SIZE_BYTES / (1024 * 1024)}MB. Please try again with a lower resolution.`,
          );
          return;
        }
      }

      const localUri = await savePhotoLocally(uri);
      const today = new Date().toISOString().split('T')[0];
      const { data } = await api.post('progress-photos', {
        capture_date: today,
        pose_type: selectedPose,
      });
      await updatePathMap(data.id, localUri);
      await loadData();
    } catch (err) {
      console.error('[ProgressPhotos] Failed to save photo:', err);
      Alert.alert('Error', 'Failed to save progress photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  // --- Comparison handlers ---

  const handleCompare = useCallback((left: PhotoMeta, right: PhotoMeta) => {
    setCompareLeft(left);
    setCompareRight(right);
    setViewMode('comparison');
  }, []);

  const handleDismissComparison = useCallback(() => {
    setViewMode('timeline');
    setCompareLeft(null);
    setCompareRight(null);
  }, []);

  // --- Camera view (full screen) ---
  if (captureStep === 'camera') {
    return (
      <GuidedCameraView
        poseType={selectedPose}
        onCapture={handleCameraCapture}
        onCancel={handleCancelCapture}
      />
    );
  }

  // --- Comparison view (full screen) ---
  if (viewMode === 'comparison' && compareLeft && compareRight) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AlignedComparison
          leftPhoto={compareLeft}
          rightPhoto={compareRight}
          pathMap={pathMap}
          onDismiss={handleDismissComparison}
        />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Progress Photos</Text>
        <View style={{ width: 60 }} />
      </View>

      {photos.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}><Icon name="camera" /></Text>
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.emptySubtitle}>
            Take your first progress photo to start tracking your transformation.
          </Text>
        </View>
      ) : (
        <TimelineSlider
          photos={photos}
          pathMap={pathMap}
          onCompare={handleCompare}
          poseFilter={poseFilter}
          onPoseFilterChange={setPoseFilter}
        />
      )}

      {/* Pose selector modal */}
      <PoseSelector
        visible={captureStep === 'pose_select'}
        onSelect={handlePoseSelect}
        onCancel={handleCancelCapture}
      />

      {/* Lighting reminder modal */}
      <LightingReminder
        visible={captureStep === 'lighting'}
        onDismiss={handleLightingDismiss}
        onDontShowAgain={handleLightingDontShowAgain}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, capturing && styles.fabDisabled]}
        onPress={startCapture}
        disabled={capturing}
        activeOpacity={0.8}
      >
        {capturing ? (
          <ActivityIndicator color={colors.text.inverse} size="small" />
        ) : (
          <Text style={styles.fabText}>+</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backBtn: { width: 60 },
  backText: { color: colors.accent.primary, fontSize: typography.size.base },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing[4] },
  emptyTitle: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    lineHeight: typography.size.base * typography.lineHeight.relaxed,
  },
  fab: {
    position: 'absolute',
    bottom: spacing[8],
    right: spacing[4],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabDisabled: { opacity: 0.6 },
  fabText: {
    color: colors.text.inverse,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    marginTop: -2,
  },
});
