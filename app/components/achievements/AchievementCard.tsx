import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { Icon, IconName } from '../common/Icon';

/** Map achievement icon strings from the backend to available Icon names */
function getAchievementIcon(iconStr: string): IconName {
  if (iconStr.includes('bench') || iconStr.includes('squat') || iconStr.includes('dl') || iconStr.includes('deadlift')) return 'dumbbell';
  if (iconStr.includes('streak')) return 'flame';
  if (iconStr.includes('vol')) return 'lightning';
  if (iconStr.includes('nutr')) return 'utensils';
  return 'star';
}

interface AchievementCardProps {
  definition: {
    id: string;
    title: string;
    description: string;
    icon: string;
    threshold: number;
  };
  unlocked: boolean;
  unlockedAt?: string | null;
  progress?: number | null;
  onPress?: () => void;
}

export function AchievementCard({
  definition,
  unlocked,
  unlockedAt,
  progress,
  onPress,
}: AchievementCardProps) {
  const progressPct = Math.min(Math.max((progress ?? 0) * 100, 0), 100);

  return (
    <TouchableOpacity
      style={[styles.card, unlocked && styles.cardUnlocked]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
      accessibilityLabel={`${definition.title} — ${unlocked ? 'Unlocked' : `${Math.round(progressPct)}% progress`}`}
      accessibilityRole="button"
    >
      <View style={[styles.iconCircle, unlocked ? styles.iconUnlocked : styles.iconLocked]}>
        <Icon
          name={getAchievementIcon(definition.icon)}
          size={20}
          color={unlocked ? colors.accent.primary : colors.text.muted}
        />
      </View>
      <Text style={[styles.title, !unlocked && styles.titleLocked]} numberOfLines={1}>
        {definition.title}
      </Text>
      {unlocked && unlockedAt ? (
        <Text style={styles.date}>
          {new Date(unlockedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Text>
      ) : (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[3],
    alignItems: 'center',
    margin: spacing[1],
  },
  cardUnlocked: {
    borderColor: colors.accent.primaryMuted,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  iconUnlocked: {
    backgroundColor: colors.accent.primaryMuted,
  },
  iconLocked: {
    backgroundColor: colors.bg.surfaceRaised,
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  titleLocked: {
    color: colors.text.muted,
  },
  date: {
    color: colors.text.muted,
    fontSize: 10,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
    borderRadius: 2,
  },
});
