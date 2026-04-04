import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';

interface Props {
  current: number;
  total: number;
}

export function OnboardingProgress({ current, total }: Props) {
  const c = useThemeColors();
  const styles = getStyles(c);

  return (
    <View
      style={styles.container}
      accessibilityLabel={`Step ${current} of ${total}`}
      accessibilityRole="progressbar"
    >
      <View style={styles.dotsRow}>
        {Array.from({ length: total }, (_, i) => {
          const step = i + 1;
          const isCompleted = step < current;
          const isCurrent = step === current;
          return (
            <React.Fragment key={step}>
              {i > 0 && (
                <View style={[
                  styles.connector,
                  (isCompleted || isCurrent) && { backgroundColor: c.accent.primary },
                ]} />
              )}
              <View style={[
                styles.dot,
                isCompleted && { backgroundColor: c.accent.primary },
                isCurrent && { backgroundColor: c.accent.primary, width: 12, height: 12, borderRadius: 6 },
                !isCompleted && !isCurrent && { borderColor: c.border.subtle, borderWidth: 1.5 },
              ]} />
            </React.Fragment>
          );
        })}
      </View>
      <Text style={styles.stepCounter}>Step {current} of {total}</Text>
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  connector: {
    flex: 1,
    height: 1.5,
    backgroundColor: c.border.subtle,
    marginHorizontal: 2,
  },
  stepCounter: {
    color: c.text.muted,
    fontSize: typography.size.xs,
    textAlign: 'right',
    marginTop: spacing[1],
  },
});
