import { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import Animated, {
  FadeIn,
  ZoomIn,
} from 'react-native-reanimated';
import { colors, spacing, typography, radius, letterSpacing as ls } from '../../theme/tokens';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';

interface NewlyUnlocked {
  achievement_id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
}

interface CelebrationModalProps {
  achievements: NewlyUnlocked[];
  visible: boolean;
  onDismiss: () => void;
}

export function CelebrationModal({
  achievements,
  visible,
  onDismiss,
}: CelebrationModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!visible || achievements.length === 0) return null;

  const current = achievements[currentIndex] ?? achievements[0];
  const isLast = currentIndex >= achievements.length - 1;

  const handleNext = () => {
    if (isLast) {
      setCurrentIndex(0);
      onDismiss();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Animated.View
          entering={ZoomIn.duration(300)}
          style={styles.card}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View entering={FadeIn.delay(100)} style={styles.content}>
              <View style={styles.iconCircle}>
                <Icon name="trophy" size={32} color={colors.accent.primary} />
              </View>
              <Text style={styles.congrats}>Achievement Unlocked!</Text>
              <Text style={styles.title}>{current.title}</Text>
              <Text style={styles.description}>{current.description}</Text>
              {achievements.length > 1 && (
                <Text style={styles.counter}>
                  {currentIndex + 1} of {achievements.length}
                </Text>
              )}
              <Button
                title={isLast ? 'Done' : 'Next'}
                onPress={handleNext}
                style={styles.button}
              />
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[6],
    width: '85%',
    maxWidth: 360,
  },
  content: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  congrats: {
    color: colors.accent.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: ls.wider,
    marginBottom: spacing[2],
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  description: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  counter: {
    color: colors.text.muted,
    fontSize: typography.size.sm,
    marginBottom: spacing[3],
  },
  button: {
    alignSelf: 'stretch',
    width: '100%',
  },
});
