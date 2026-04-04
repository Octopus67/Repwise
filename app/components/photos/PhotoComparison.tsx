import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  GestureResponderEvent,
  PanResponder,
} from 'react-native';
import { radius, spacing, typography, opacityScale } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

const STORAGE_KEY = 'progress_photo_paths';
const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDE_WIDTH = (SCREEN_WIDTH - spacing[4] * 2 - spacing[2]) / 2;
const PHOTO_HEIGHT = SIDE_WIDTH * 1.5;
const SWIPE_THRESHOLD = 50;

import type { PhotoMeta, PhotoPathMap } from '../../utils/progressPhotoTypes';

interface PhotoComparisonProps {
  photos: PhotoMeta[];
  pathMap: PhotoPathMap;
}

export function PhotoComparison({ photos, pathMap }: PhotoComparisonProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const sortedDates = useMemo(() => {
    const unique = [...new Set(photos.map((p) => p.capture_date))];
    return unique.sort();
  }, [photos]);

  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(Math.max(sortedDates.length - 1, 0));
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (sortedDates.length > 0) {
      setLeftIndex(0);
      setRightIndex(Math.max(sortedDates.length - 1, 0));
    }
  }, [sortedDates.length]);

  const navigateLeft = useCallback(
    (direction: -1 | 1) => {
      setLeftIndex((prev) => {
        const next = prev + direction;
        if (next < 0 || next >= sortedDates.length) return prev;
        return next;
      });
    },
    [sortedDates.length],
  );

  const navigateRight = useCallback(
    (direction: -1 | 1) => {
      setRightIndex((prev) => {
        const next = prev + direction;
        if (next < 0 || next >= sortedDates.length) return prev;
        return next;
      });
    },
    [sortedDates.length],
  );

  if (sortedDates.length === 0) {
    return (
      <View style={getStyles().emptyContainer}>
        <Text style={[getStyles().emptyText, { color: c.text.muted }]}>No photos to compare yet.</Text>
      </View>
    );
  }

  const leftDate = sortedDates[leftIndex];
  const rightDate = sortedDates[rightIndex];

  const leftPhoto = photos.find((p) => p.capture_date === leftDate);
  const rightPhoto = photos.find((p) => p.capture_date === rightDate);

  return (
    <View style={getStyles().container}>
      <Text style={[getStyles().title, { color: c.text.primary }]}>Compare</Text>
      <View style={getStyles().row}>
        <ComparisonSide
          date={leftDate}
          photo={leftPhoto}
          pathMap={pathMap}
          canGoBack={leftIndex > 0}
          canGoForward={leftIndex < sortedDates.length - 1}
          onNavigate={navigateLeft}
          imageErrors={imageErrors}
          onImageError={(id) => setImageErrors((prev) => ({ ...prev, [id]: true }))}
        />
        <ComparisonSide
          date={rightDate}
          photo={rightPhoto}
          pathMap={pathMap}
          canGoBack={rightIndex > 0}
          canGoForward={rightIndex < sortedDates.length - 1}
          onNavigate={navigateRight}
          imageErrors={imageErrors}
          onImageError={(id) => setImageErrors((prev) => ({ ...prev, [id]: true }))}
        />
      </View>
    </View>
  );
}

interface ComparisonSideProps {
  date: string;
  photo: PhotoMeta | undefined;
  pathMap: PhotoPathMap;
  canGoBack: boolean;
  canGoForward: boolean;
  onNavigate: (direction: -1 | 1) => void;
  imageErrors: Record<string, boolean>;
  onImageError: (photoId: string) => void;
}

function ComparisonSide({
  date,
  photo,
  pathMap,
  canGoBack,
  canGoForward,
  onNavigate,
  imageErrors,
  onImageError,
}: ComparisonSideProps) {
  const c = useThemeColors();
  const fileUri = photo ? (pathMap[photo.id] || photo.image_url) : undefined;
  const hasImageError = photo ? imageErrors[photo.id] === true : false;
  const dateLabel = new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const weightLabel = photo?.bodyweight_kg
    ? `${photo.bodyweight_kg.toFixed(1)}kg`
    : null;

  const handleSwipe = useCallback(
    (dx: number) => {
      if (dx < -SWIPE_THRESHOLD && canGoForward) {
        onNavigate(1);
      } else if (dx > SWIPE_THRESHOLD && canGoBack) {
        onNavigate(-1);
      }
    },
    [canGoBack, canGoForward, onNavigate],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 10,
        onPanResponderRelease: (_, gestureState) => {
          handleSwipe(gestureState.dx);
        },
      }),
    [handleSwipe],
  );

  return (
    <View style={[getStyles().side, { backgroundColor: c.bg.surface }]} {...panResponder.panHandlers}>
      {fileUri && !hasImageError ? (
        <Image
          source={{ uri: fileUri }}
          style={[getStyles().photo, { backgroundColor: c.bg.surfaceRaised }]}
          resizeMode="cover"
          onError={() => photo && onImageError(photo.id)}
        />
      ) : (
        <View style={[getStyles().photo, getStyles().placeholder]}>
          <Text style={[getStyles().placeholderText, { color: c.text.muted }]}>
            {hasImageError ? 'Failed to load photo' : 'No photo for this date'}
          </Text>
        </View>
      )}
      <View style={getStyles().dateRow}>
        <TouchableOpacity
          onPress={() => onNavigate(-1)}
          disabled={!canGoBack}
          style={getStyles().navBtn}
        >
          <Text style={[getStyles().navText, !canGoBack && getStyles().navDisabled]}>‹</Text>
        </TouchableOpacity>
        <View style={getStyles().dateInfo}>
          <Text style={[getStyles().dateText, { color: c.text.primary }]}>{dateLabel}</Text>
          {weightLabel && <Text style={[getStyles().weightText, { color: c.accent.primary }]}>{weightLabel}</Text>}
        </View>
        <TouchableOpacity
          onPress={() => onNavigate(1)}
          disabled={!canGoForward}
          style={getStyles().navBtn}
        >
          <Text style={[getStyles().navText, !canGoForward && getStyles().navDisabled]}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  title: {
    color: c.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.lg,
    marginBottom: spacing[3],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  side: {
    width: SIDE_WIDTH,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: c.bg.surface,
  },
  photo: {
    width: SIDE_WIDTH,
    height: PHOTO_HEIGHT,
    backgroundColor: c.bg.surfaceRaised,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: c.text.muted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
    paddingHorizontal: spacing[2],
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
  },
  navBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    color: c.accent.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.xl,
  },
  navDisabled: {
    color: c.text.muted,
    opacity: opacityScale.disabled,
  },
  dateInfo: {
    alignItems: 'center',
    flex: 1,
  },
  dateText: {
    color: c.text.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.xs,
  },
  weightText: {
    color: c.accent.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.xs,
    marginTop: spacing[0.5],
  },
  emptyContainer: {
    padding: spacing[8],
    alignItems: 'center',
  },
  emptyText: {
    color: c.text.muted,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
  },
});
