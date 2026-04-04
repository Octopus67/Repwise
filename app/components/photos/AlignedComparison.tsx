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
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
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
  const c = useThemeColors();
  const styles = getThemedStyles(c);
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
      const leftUri = pathMap[leftPhoto.id] || leftPhoto.image_url;
      const rightUri = pathMap[rightPhoto.id] || rightPhoto.image_url;

      if (!leftAlign && leftUri) {
        leftAlign = await computeAlignment(leftUri);
        // PATCH to backend for caching
        try {
          await api.patch(`progress-photos/${leftPhoto.id}`, { alignment_data: leftAlign });
        } catch (err) { console.warn('[AlignedComparison] left alignment cache failed:', String(err)); }
      }

      if (!rightAlign && rightUri) {
        rightAlign = await computeAlignment(rightUri);
        try {
          await api.patch(`progress-photos/${rightPhoto.id}`, { alignment_data: rightAlign });
        } catch (err) { console.warn('[AlignedComparison] right alignment cache failed:', String(err)); }
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

  const leftUri = pathMap[leftPhoto.id] || leftPhoto.image_url;
  const rightUri = pathMap[rightPhoto.id] || rightPhoto.image_url;
  const leftInfo = formatPhotoInfo(leftPhoto);
  const rightInfo = formatPhotoInfo(rightPhoto);

  return (
    <View style={[getStyles().container, { backgroundColor: c.bg.base }]}>
      <View style={getStyles().header}>
        <Text style={[getStyles().title, { color: c.text.primary }]}>Compare</Text>
        <TouchableOpacity onPress={onDismiss}>
          <Text style={[getStyles().dismissText, { color: c.text.secondary }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={getStyles().loadingContainer}>
          <ActivityIndicator color={c.accent.primary} size="large" />
          <Text style={[getStyles().loadingText, { color: c.text.secondary }]}>Aligning photos...</Text>
        </View>
      ) : (
        <View style={getStyles().row}>
          <ComparisonSide uri={leftUri} info={leftInfo} transform={leftTransform} />
          <ComparisonSide uri={rightUri} info={rightInfo} transform={rightTransform} />
        </View>
      )}
    </View>
  );
}

interface ComparisonSideProps {
  uri: string | null | undefined;
  info: { dateLabel: string; weightLabel: string | null };
  transform: ImageTransform;
}

function ComparisonSide({ uri, info, transform }: ComparisonSideProps) {
  const c = useThemeColors();
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
    <View style={[getStyles().side, { backgroundColor: c.bg.surface }]}>
      <View style={getStyles().photoClip}>
        {uri ? (
          <Image source={{ uri }} style={imageStyle} resizeMode="cover" />
        ) : (
          <View style={[getStyles().photoPlaceholder, { width: SIDE_WIDTH, height: PHOTO_HEIGHT }]}>
            <Text style={[getStyles().placeholderText, { color: c.text.muted }]}>No photo</Text>
          </View>
        )}
      </View>
      <View style={getStyles().infoRow}>
        <Text style={[getStyles().dateText, { color: c.text.primary }]}>{info.dateLabel}</Text>
        {info.weightLabel && <Text style={[getStyles().weightText, { color: c.accent.primary }]}>{info.weightLabel}</Text>}
      </View>
    </View>
  );
}

/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg.base,
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
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  dismissText: {
    color: c.text.secondary,
    fontSize: typography.size.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: c.text.secondary,
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
    backgroundColor: c.bg.surface,
  },
  photoClip: {
    width: SIDE_WIDTH,
    height: PHOTO_HEIGHT,
    overflow: 'hidden',
  },
  photoPlaceholder: {
    backgroundColor: c.bg.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: c.text.muted,
    fontSize: typography.size.sm,
  },
  infoRow: {
    padding: spacing[2],
    alignItems: 'center',
  },
  dateText: {
    color: c.text.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  weightText: {
    color: c.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    marginTop: 2,
  },
});
