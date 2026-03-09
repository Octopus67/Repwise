import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon, IconName } from '../common/Icon';

/** Map achievement icon strings from the backend to available Icon names and colors */
function getAchievementIcon(iconStr: string): IconName {
  if (iconStr.includes('bench') || iconStr.includes('squat') || iconStr.includes('dl') || iconStr.includes('deadlift')) return 'dumbbell';
  if (iconStr.includes('streak')) return 'flame';
  if (iconStr.includes('vol')) return 'lightning';
  if (iconStr.includes('nutr')) return 'utensils';
  return 'star';
}

function getAchievementColor(iconStr: string): string {
  const c = useThemeColors();
  if (iconStr.includes('bench') || iconStr.includes('squat') || iconStr.includes('dl') || iconStr.includes('deadlift')) return c.macro.protein;
  if (iconStr.includes('streak')) return c.semantic.warning;
  if (iconStr.includes('vol')) return '#8B5CF6';
  if (iconStr.includes('nutr')) return c.macro.calories;
  return c.accent.primary;
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
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const categoryColor = getAchievementColor(definition.icon);
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
      <View style={[styles.iconCircle, unlocked ? { backgroundColor: categoryColor + '20' } : styles.iconLocked]}>
        <Icon
          name={getAchievementIcon(definition.icon)}
          size={20}
          color={unlocked ? categoryColor : c.text.muted}
        />
      </View>
      <Text style={[styles.title, !unlocked && styles.titleLocked]} numberOfLines={1}>
        {definition.title}
      </Text>
      {unlocked && unlockedAt ? (
        <Text style={[styles.date, { color: c.text.muted }]}>
          {new Date(unlockedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Text>
      ) : (
        <View style={[styles.progressTrack, { backgroundColor: c.bg.surfaceRaised }]}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: c.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: spacing[3],
    alignItems: 'center',
    margin: spacing[1],
  },
  cardUnlocked: {
    borderColor: c.accent.primaryMuted,
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
    backgroundColor: c.accent.primaryMuted,
  },
  iconLocked: {
    backgroundColor: c.bg.surfaceRaised,
  },
  title: {
    color: c.text.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  titleLocked: {
    color: c.text.muted,
  },
  date: {
    color: c.text.muted,
    fontSize: 10,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: c.bg.surfaceRaised,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: c.accent.primary,
    borderRadius: 2,
  },
});
