import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import { Card } from '../common/Card';
import { Icon } from '../common/Icon';
import { Skeleton } from '../common/Skeleton';
import { spacing, typography, radius } from '../../theme/tokens';
import { useThemeColors, type ThemeColors } from '../../hooks/useThemeColors';
import { useStepCount } from '../../hooks/useStepCount';

function StepCountCardComponent() {
  const c = useThemeColors();
  const s = getThemedStyles(c);
  const { steps, stepGoal, setStepGoal, loading, permissionDenied, unavailable } = useStepCount();

  // Long-press to change step goal via native prompt
  const handleLongPress = useCallback(() => {
    if (Platform.OS !== 'ios') return;
    Alert.prompt(
      'Step Goal',
      'Enter your daily step goal (min 1000):',
      (input) => {
        const parsed = parseInt(input, 10);
        if (!isNaN(parsed) && parsed >= 1000) setStepGoal(parsed);
      },
      'plain-text',
      String(stepGoal),
      'number-pad',
    );
  }, [stepGoal, setStepGoal]);

  if (unavailable) return null;

  if (loading) {
    return (
      <Card variant="flat" style={s.card}>
        <Skeleton width="50%" height={16} />
      </Card>
    );
  }

  if (permissionDenied) {
    return (
      <Card variant="flat" style={s.card}>
        <View style={s.header}>
          <Icon name="lightning" size={16} color={c.text.muted} />
          <Text style={s.title}>Steps</Text>
        </View>
        <Text style={s.muted}>Enable Motion &amp; Fitness in Settings</Text>
      </Card>
    );
  }

  const current = steps ?? 0;
  const progress = Math.min(current / stepGoal, 1);

  return (
    <Card variant="flat" style={s.card} onLongPress={handleLongPress}>
      <View style={s.header}>
        <Icon name="lightning" size={16} color={c.accent.primary} />
        <Text style={s.title}>{current.toLocaleString()} steps</Text>
        <Text style={s.goal}>/ {stepGoal.toLocaleString()}</Text>
      </View>
      <View style={s.barBg}>
        <View style={[s.barFill, { width: `${progress * 100}%`, backgroundColor: c.accent.primary }]} />
      </View>
    </Card>
  );
}

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  card: { marginTop: spacing[3] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  title: { color: c.text.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold, lineHeight: typography.lineHeight.sm },
  goal: { color: c.text.muted, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm },
  muted: { color: c.text.muted, fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm },
  barBg: { height: 6, backgroundColor: c.bg.surfaceRaised, borderRadius: radius.full, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: radius.full },
});

export const StepCountCard = React.memo(StepCountCardComponent);
