import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { colors, spacing, typography, radius } from '../../theme/tokens';

interface PRItem {
  type: 'weight' | 'reps' | 'volume' | 'e1rm';
  exerciseName: string;
  value: string;
}

interface PRBannerProps {
  prs: PRItem[];
  visible: boolean;
  onDismiss: () => void;
}

const PR_TYPE_LABELS: Record<string, string> = {
  weight: '🏋️ Weight PR',
  reps: '💪 Rep PR',
  volume: '📊 Volume PR',
  e1rm: '🎯 e1RM PR',
};

export function PRBanner({ prs, visible, onDismiss }: PRBannerProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible && prs.length > 0) {
      // Animate in
      Animated.spring(scale, {
        toValue: 1,
        damping: 12,
        stiffness: 200,
        useNativeDriver: true,
      }).start();

      // Auto-dismiss after 3s
      dismissTimer.current = setTimeout(() => {
        onDismiss();
      }, 3000);
    } else {
      scale.setValue(0);
    }

    return () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
    };
  }, [visible, prs]);

  if (!visible || prs.length === 0) return null;

  return (
    <TouchableOpacity
      style={styles.overlay}
      activeOpacity={1}
      onPress={onDismiss}
    >
      <Animated.View style={[styles.banner, { transform: [{ scale }] }]}>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.title}>New Personal Record!</Text>
        {prs.map((pr, i) => (
          <View key={i} style={styles.prRow}>
            <Text style={styles.prType}>
              {PR_TYPE_LABELS[pr.type] ?? pr.type}
            </Text>
            <Text style={styles.prExercise}>{pr.exerciseName}</Text>
            <Text style={styles.prValue}>{pr.value}</Text>
          </View>
        ))}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  banner: {
    backgroundColor: colors.bg.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.premium.gold,
    padding: spacing[6],
    alignItems: 'center',
    minWidth: 260,
    maxWidth: 320,
  },
  trophy: {
    fontSize: 40,
    marginBottom: spacing[2],
  },
  title: {
    color: colors.premium.gold,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginBottom: spacing[3],
  },
  prRow: {
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  prType: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  prExercise: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  prValue: {
    color: colors.premium.gold,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },
});
