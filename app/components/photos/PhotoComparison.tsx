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
import { colors, radius, spacing, typography } from '../../theme/tokens';

const STORAGE_KEY = 'progress_photo_paths';
const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDE_WIDTH = (SCREEN_WIDTH - spacing[4] * 2 - spacing[2]) / 2;
const PHOTO_HEIGHT = SIDE_WIDTH * 1.5;
const SWIPE_THRESHOLD = 50;

interface PhotoMeta {
  id: string;
  capture_date: string;
  bodyweight_kg: number | null;
  pose_type: string;
}

interface PhotoPathMap {
  [photoId: string]: string;
}

interface PhotoComparisonProps {
  photos: PhotoMeta[];
  pathMap: PhotoPathMap;
}

export function PhotoComparison({ photos, pathMap }: PhotoComparisonProps) {
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
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No photos to compare yet.</Text>
      </View>
    );
  }

  const leftDate = sortedDates[leftIndex];
  const rightDate = sortedDates[rightIndex];

  const leftPhoto = photos.find((p) => p.capture_date === leftDate);
  const rightPhoto = photos.find((p) => p.capture_date === rightDate);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Compare</Text>
      <View style={styles.row}>
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
  const fileUri = photo ? pathMap[photo.id] : undefined;
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
    <View style={styles.side} {...panResponder.panHandlers}>
      {fileUri && !hasImageError ? (
        <Image
          source={{ uri: fileUri }}
          style={styles.photo}
          resizeMode="cover"
          onError={() => photo && onImageError(photo.id)}
        />
      ) : (
        <View style={[styles.photo, styles.placeholder]}>
          <Text style={styles.placeholderText}>
            {hasImageError ? 'Failed to load photo' : 'No photo for this date'}
          </Text>
        </View>
      )}
      <View style={styles.dateRow}>
        <TouchableOpacity
          onPress={() => onNavigate(-1)}
          disabled={!canGoBack}
          style={styles.navBtn}
        >
          <Text style={[styles.navText, !canGoBack && styles.navDisabled]}>‹</Text>
        </TouchableOpacity>
        <View style={styles.dateInfo}>
          <Text style={styles.dateText}>{dateLabel}</Text>
          {weightLabel && <Text style={styles.weightText}>{weightLabel}</Text>}
        </View>
        <TouchableOpacity
          onPress={() => onNavigate(1)}
          disabled={!canGoForward}
          style={styles.navBtn}
        >
          <Text style={[styles.navText, !canGoForward && styles.navDisabled]}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
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
    backgroundColor: colors.bg.surface,
  },
  photo: {
    width: SIDE_WIDTH,
    height: PHOTO_HEIGHT,
    backgroundColor: colors.bg.surfaceRaised,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
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
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    color: colors.accent.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },
  navDisabled: {
    color: colors.text.muted,
    opacity: 0.4,
  },
  dateInfo: {
    alignItems: 'center',
    flex: 1,
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
  emptyContainer: {
    padding: spacing[8],
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: typography.size.base,
  },
});
