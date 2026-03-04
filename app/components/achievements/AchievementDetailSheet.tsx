import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { ModalContainer } from '../common/ModalContainer';
import { Icon, IconName } from '../common/Icon';
import { colors, spacing, typography, radius, glowShadow } from '../../theme/tokens';

interface AchievementDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  achievement: {
    id: string;
    title: string;
    description: string;
    category: string;
    threshold: number;
    unlocked: boolean;
    unlocked_at?: string;
    progress: number; // 0.0 to 1.0
    current_value?: number;
    icon?: string;
  } | null;
}

function getAchievementIcon(iconStr: string): IconName {
  if (iconStr.includes('bench') || iconStr.includes('squat') || iconStr.includes('dl') || iconStr.includes('deadlift')) return 'dumbbell';
  if (iconStr.includes('streak')) return 'flame';
  if (iconStr.includes('vol')) return 'lightning';
  if (iconStr.includes('nutr')) return 'utensils';
  return 'star';
}

function getAchievementColor(iconStr: string): string {
  if (iconStr.includes('bench') || iconStr.includes('squat') || iconStr.includes('dl') || iconStr.includes('deadlift')) return colors.macro.protein;
  if (iconStr.includes('streak')) return colors.semantic.warning;
  if (iconStr.includes('vol')) return '#8B5CF6';
  if (iconStr.includes('nutr')) return colors.macro.calories;
  return colors.accent.primary;
}

function formatProgressText(category: string, currentValue: number | undefined, threshold: number, progress: number, unlocked: boolean): string {
  const formatNumber = (num: number) => num.toLocaleString();
  
  if (unlocked) {
    if (category === 'pr_badge') return `Unlocked at ${formatNumber(currentValue || threshold)}kg`;
    if (category === 'streak') return `Achieved ${formatNumber(threshold)} day streak`;
    if (category === 'volume') return `Reached ${formatNumber(threshold)}kg lifetime volume`;
    if (category === 'nutrition') return `Achieved ${formatNumber(threshold)} day compliance streak`;
    return 'Unlocked';
  }

  const current = currentValue || Math.floor(progress * threshold);
  if (category === 'pr_badge') return `Current max: ${formatNumber(current)}kg / Target: ${formatNumber(threshold)}kg`;
  if (category === 'streak') return `Current streak: ${formatNumber(current)} days / Target: ${formatNumber(threshold)} days`;
  if (category === 'volume') return `Lifetime volume: ${formatNumber(current)}kg / Target: ${formatNumber(threshold)}kg`;
  if (category === 'nutrition') return `Compliance streak: ${formatNumber(current)} days / Target: ${formatNumber(threshold)} days`;
  return `${Math.round(progress * 100)}%`;
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    pr_badge: 'PR Badge',
    streak: 'Streak',
    volume: 'Volume',
    nutrition: 'Nutrition',
  };
  return labels[category] || category;
}

export function AchievementDetailSheet({ visible, onClose, achievement }: AchievementDetailSheetProps) {
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    if (visible && achievement) {
      progressWidth.value = withTiming(achievement.progress * 100, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progressWidth.value = 0;
    }
  }, [visible, achievement?.progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  if (!achievement) return null;

  const categoryColor = getAchievementColor(achievement.icon || '');
  const iconName = getAchievementIcon(achievement.icon || '');
  const progressText = formatProgressText(
    achievement.category,
    achievement.current_value,
    achievement.threshold,
    achievement.progress,
    achievement.unlocked
  );

  return (
    <ModalContainer
      visible={visible}
      onClose={onClose}
      title=""
      testID="achievement-detail-sheet"
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[
            styles.iconCircle,
            achievement.unlocked && { backgroundColor: categoryColor + '20' },
            achievement.unlocked && glowShadow(categoryColor, 8, 0.2)
          ]}>
            <Icon
              name={iconName}
              size={32}
              color={achievement.unlocked ? categoryColor : colors.text.muted}
            />
          </View>
          <Text style={styles.title}>{achievement.title}</Text>
          <Text style={styles.category}>{getCategoryLabel(achievement.category)}</Text>
          {achievement.unlocked && achievement.unlocked_at && (
            <View style={styles.unlockedRow}>
              <Icon name="check" size={14} color={colors.semantic.positive} />
              <Text style={styles.unlockedDate}>
                Unlocked {new Date(achievement.unlocked_at).toLocaleDateString(undefined, { 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </View>
          )}
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <Animated.View 
              style={[
                styles.progressFill, 
                { backgroundColor: achievement.unlocked ? categoryColor : colors.accent.primary },
                achievement.unlocked && glowShadow(categoryColor, 4, 0.3),
                progressStyle
              ]} 
            />
          </View>
          <Text style={styles.progressText}>{progressText}</Text>
        </View>

        {/* Description */}
        <View style={styles.descriptionSection}>
          <Text style={styles.descriptionTitle}>About this achievement</Text>
          <Text style={styles.description}>{achievement.description}</Text>
          {!achievement.unlocked && (
            <Text style={styles.requirement}>
              You need {Math.ceil((1 - achievement.progress) * achievement.threshold)} more to unlock this
            </Text>
          )}
        </View>

        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </ModalContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing[2],
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bg.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  category: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  unlockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  unlockedDate: {
    fontSize: typography.size.sm,
    color: colors.semantic.positive,
    fontWeight: typography.weight.medium,
  },
  progressSection: {
    marginBottom: spacing[6],
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: typography.size.base,
    color: colors.text.secondary,
    textAlign: 'center',
    fontWeight: typography.weight.medium,
  },
  descriptionSection: {
    marginBottom: spacing[6],
  },
  descriptionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  description: {
    fontSize: typography.size.base,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.base,
    marginBottom: spacing[3],
  },
  requirement: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  closeButton: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
});