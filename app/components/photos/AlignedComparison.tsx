/**
 * AlignedComparison — side-by-side photo comparison with auto-alignment.
 *
 * Replaces the old PhotoComparison for comparison mode. Computes alignment
 * transforms to center-align and scale-match two photos for accurate
 * visual comparison.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { AlignmentData, ImageTransform, PhotoMeta, PhotoPathMap } from '../../utils/progressPhotoTypes';
import { alignForComparison, computeAlignment } from '../../utils/autoAlignLogic';
import { formatPhotoInfo } from '../../utils/timelineLogic';
import api from '../../services/api';

interface AlignedComparisonProps {
  leftPhoto: PhotoMeta;
  rightPhoto: PhotoMeta;
  pathMap: PhotoPathMap;
  onDismiss: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDE_WIDTH = (SCREEN_WIDTH - spacing[4] * 2 - spacing[2]) / 2;
const PHOTO_HEIGHT = SIDE_WIDTH * 1.5;

const IDENTITY_TRANSFORM: ImageTransform = { translateX: 0, translateY: 0, scale: 1 };

export function AlignedComparison({
  leftPhoto,
  rightPhoto,
  pathMap,
  onDismiss,
}: AlignedComparisonProps) {
  const [leftTransform, setLeftTransform] = useState<ImageTransform>(IDENTITY_TRANSFORM);
  const [rightTransform, setRightTransform] = useState<ImageTransform>(IDENTITY_TRANSFORM);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    alignPhotos();
  }, [leftPhoto.id, rightPhoto.id]);

  const alignPhotos = async () => {
    setLoading(true);
    try {
      let leftAlign = leftPhoto.alignment_data;
      let rightAlign = rightPhoto.alignment_data;

      // Compute alignment for photos missing it
      const leftUri = pathMap[leftPhoto.id];
      const rightUri = pathMap[rightPhoto.id];

      if (!leftAlign && leftUri) {
        leftAlign = await computeAlignment(leftUri);
        // PATCH to backend for caching
        try {
          await api.patch(`progress-photos/${leftPhoto.id}`, { alignment_data: leftAlign });
        } catch { /* non-critical */ }
      }

      if (!rightAlign && rightUri) {
        rightAlign = await computeAlignment(rightUri);
        try {
          await api.patch(`progress-photos/${rightPhoto.id}`, { alignment_data: rightAlign });
        } catch { /* non-critical */ }
      }

      // Compute transforms if both alignments available
      if (leftAlign && rightAlign) {
        const transforms = alignForComparison(leftAlign, rightAlign);
        setLeftTransform(transforms.leftTransform);
        setRightTransform(transforms.rightTransform);
      }
      // else: fall back to center-aligned (identity transforms)
    } catch {
      // Fallback: center-aligned display
    } finally {
      setLoading(false);
    }
  };

  const leftUri = pathMap[leftPhoto.id];
  const rightUri = pathMap[rightPhoto.id];
  const leftInfo = formatPhotoInfo(leftPhoto);
  const rightInfo = formatPhotoInfo(rightPhoto);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Compare</Text>
        <TouchableOpacity onPress={onDismiss}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent.primary} size="large" />
          <Text style={styles.loadingText}>Aligning photos...</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <ComparisonSide uri={leftUri} info={leftInfo} transform={leftTransform} />
          <ComparisonSide uri={rightUri} info={rightInfo} transform={rightTransform} />
        </View>
      )}
    </View>
  );
}

interface ComparisonSideProps {
  uri: string | undefined;
  info: { dateLabel: string; weightLabel: string | null };
  transform: ImageTransform;
}

function ComparisonSide({ uri, info, transform }: ComparisonSideProps) {
  const imageStyle = {
    width: SIDE_WIDTH,
    height: PHOTO_HEIGHT,
    transform: [
      { translateX: transform.translateX * SIDE_WIDTH },
      { translateY: transform.translateY * PHOTO_HEIGHT },
      { scale: transform.scale },
    ],
  };

  return (
    <View style={styles.side}>
      <View style={styles.photoClip}>
        {uri ? (
          <Image source={{ uri }} style={imageStyle} resizeMode="cover" />
        ) : (
          <View style={[styles.photoPlaceholder, { width: SIDE_WIDTH, height: PHOTO_HEIGHT }]}>
            <Text style={styles.placeholderText}>No photo</Text>
          </View>
        )}
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.dateText}>{info.dateLabel}</Text>
        {info.weightLabel && <Text style={styles.weightText}>{info.weightLabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
    paddingTop: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[4],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  dismissText: {
    color: colors.text.secondary,
    fontSize: typography.size.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    marginTop: spacing[2],
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  side: {
    width: SIDE_WIDTH,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bg.surface,
  },
  photoClip: {
    width: SIDE_WIDTH,
    height: PHOTO_HEIGHT,
    overflow: 'hidden',
  },
  photoPlaceholder: {
    backgroundColor: colors.bg.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
  },
  infoRow: {
    padding: spacing[2],
    alignItems: 'center',
  },
  dateText: {
    color: colors.text.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  weightText: {
    color: colors.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    marginTop: 2,
  },
});
