import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { spacing, typography } from '../../theme/tokens';
import { triggerHaptic } from '../../hooks/useHaptics';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

// Conditionally import Swipeable — only available on native
let Swipeable: any = null;
if (Platform.OS !== 'web') {
  try {
    Swipeable = require('react-native-gesture-handler').Swipeable;
  } catch {
    // gesture handler not available
  }
}

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
}

function DeleteAction({ onDelete }: { onDelete: () => void }) {
  return (
    <TouchableOpacity style={getStyles().deleteAction} onPress={onDelete} activeOpacity={0.7}>
      <Text style={getStyles().deleteText}>Delete</Text>
    </TouchableOpacity>
  );
}

export function SwipeableRow({ children, onDelete }: SwipeableRowProps) {
  const c = useThemeColors();
  const styles = getThemedStyles(c);
  const swipeableRef = useRef<any>(null);

  // Web fallback: render children without swipe
  if (Platform.OS === 'web' || !Swipeable) {
    return <View>{children}</View>;
  }

  const renderRightActions = () => (
    <DeleteAction
      onDelete={() => {
        swipeableRef.current?.close();
        onDelete();
      }}
    />
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      onSwipeableWillOpen={() => triggerHaptic('medium')}
    >
      {children}
    </Swipeable>
  );
}

/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  deleteAction: {
    backgroundColor: c.semantic.negative,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  deleteText: {
    color: c.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});
