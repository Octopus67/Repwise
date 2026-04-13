import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { spacing } from '../../../theme/tokens';
import { EmptyState } from '../../../components/common/EmptyState';
import { Skeleton } from '../../../components/common/Skeleton';
import { Icon } from '../../../components/common/Icon';
import { VolumeLandmarksCard } from '../../../components/volume/VolumeLandmarksCard';
import type { WNSMuscleVolume } from '../../../types/volume';

interface VolumeTabProps {
  volumeFlagEnabled: boolean;
  volumeLoading: boolean;
  volumeLandmarks: WNSMuscleVolume[];
}

export function VolumeTab({ volumeFlagEnabled, volumeLoading, volumeLandmarks }: VolumeTabProps) {
  if (!volumeFlagEnabled) {
    return <EmptyState icon={<Icon name="chart" />} title="Coming soon" description="Volume landmarks are not yet available for your account" />;
  }

  if (volumeLoading) {
    return (
      <View style={styles.skeletonContainer}>
        <Skeleton width="100%" height={140} borderRadius={8} />
        <Skeleton width="100%" height={140} borderRadius={8} />
        <Skeleton width="100%" height={140} borderRadius={8} />
      </View>
    );
  }

  if (volumeLandmarks.length === 0) {
    return <EmptyState icon={<Icon name="chart" />} title="No volume data" description="Start logging workouts to see your volume landmarks" />;
  }

  return (
    <FlatList
      data={volumeLandmarks}
      keyExtractor={(mg) => mg.muscle_group}
      renderItem={({ item: mg }) => (
        <VolumeLandmarksCard
          muscleGroup={mg.muscle_group}
          currentVolume={mg.hypertrophy_units ?? mg.net_stimulus ?? 0}
          landmarks={mg.landmarks}
          trend={mg.trend?.map((t) => ({ week: t.week, volume: t.volume })) ?? []}
          status={mg.status}
        />
      )}
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  skeletonContainer: { marginTop: spacing[4], gap: spacing[3] },
});
