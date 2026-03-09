import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { typography, radius, spacing, motion } from '../../theme/tokens';
import { springs } from '../../theme/tokens';
import { Icon } from './Icon';
import { useThemeColors, getThemeColors, ThemeColors } from '../../hooks/useThemeColors';

interface ModalContainerProps {
  visible: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  children: React.ReactNode;
  testID?: string;
  closeButtonTestID?: string;
}

const isWeb = Platform.OS === 'web';

export function ModalContainer({
  visible,
  onClose,
  title,
  children,
  testID,
  closeButtonTestID,
}: ModalContainerProps) {
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(300);
  const themeColors = useThemeColors();

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 150) {
        translateY.value = withTiming(600, { duration: motion.duration.default }, () => {
          runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0, springs.snappy);
      }
    });

  useEffect(() => {
    if (visible) {
      if (isWeb) {
        scale.value = withTiming(1, { duration: motion.duration.default, easing: Easing.out(Easing.ease) });
        opacity.value = withTiming(1, { duration: motion.duration.default, easing: Easing.out(Easing.ease) });
      } else {
        translateY.value = withTiming(0, { duration: motion.duration.moderate, easing: Easing.out(Easing.ease) });
        opacity.value = withTiming(1, { duration: motion.duration.moderate, easing: Easing.out(Easing.ease) });
      }
    } else {
      if (isWeb) {
        scale.value = withTiming(0.95, { duration: motion.duration.quick, easing: Easing.in(Easing.ease) });
        opacity.value = withTiming(0, { duration: motion.duration.quick, easing: Easing.in(Easing.ease) });
      } else {
        translateY.value = withTiming(300, { duration: motion.duration.default, easing: Easing.in(Easing.ease) });
        opacity.value = withTiming(0, { duration: motion.duration.default, easing: Easing.in(Easing.ease) });
      }
    }
  // scale, opacity, translateY are stable shared value refs — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const webContentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const mobileContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (isWeb) {
    return (
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
        <Pressable style={getStyles().webOverlay} onPress={onClose}>
          <Animated.View style={[getStyles().backdrop, { backgroundColor: themeColors.bg.overlay }, backdropStyle]} pointerEvents="none" />
          <Animated.View style={[getStyles().webDialog, { backgroundColor: themeColors.bg.surface, borderColor: themeColors.border.default }, webContentStyle]} testID={testID}>
            <Pressable onPress={(e) => e.stopPropagation()} style={{ flex: 1 }}>
              <View style={getStyles().header}>
                {typeof title === 'string' ? (
                  <Text style={[getStyles().title, { color: themeColors.text.primary }]}>{title}</Text>
                ) : (
                  <View style={getStyles().titleRow}>{title}</View>
                )}
                <TouchableOpacity onPress={onClose} hitSlop={8} style={{ padding: 8 }} testID={closeButtonTestID}>
                  <Icon name="close" size={18} color={themeColors.text.secondary} />
                </TouchableOpacity>
              </View>
              {children}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={getStyles().mobileOverlay}>
        <Animated.View style={[getStyles().backdrop, { backgroundColor: themeColors.bg.overlay }, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[getStyles().mobileSheet, { backgroundColor: themeColors.bg.surface, borderColor: themeColors.border.default }, mobileContentStyle]} testID={testID}>
            <View style={getStyles().dragHandleContainer}>
              <View style={[getStyles().dragHandle, { backgroundColor: themeColors.bg.surfaceRaised }]} />
            </View>
            <View style={getStyles().header}>
              {typeof title === 'string' ? (
                <Text style={[getStyles().title, { color: themeColors.text.primary }]}>{title}</Text>
              ) : (
                <View style={getStyles().titleRow}>{title}</View>
              )}
              <TouchableOpacity onPress={onClose} hitSlop={8} style={{ padding: 8, zIndex: 30 }} testID={closeButtonTestID}>
                <Icon name="close" size={18} color={themeColors.text.secondary} />
              </TouchableOpacity>
            </View>
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

/** Lazy styles for module-level helpers */
function getStyles() { return getThemedStyles(getThemeColors()); }

const getThemedStyles = (c: ThemeColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.bg.overlay,
  },
  webOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webDialog: {
    maxWidth: 480,
    width: '90%',
    backgroundColor: c.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border.default,
    padding: spacing[6],
    maxHeight: '85%',
  },
  mobileOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  mobileSheet: {
    backgroundColor: c.bg.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: c.border.default,
    padding: spacing[6],
    paddingTop: spacing[2],
    maxHeight: '90%',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.bg.surfaceRaised,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: c.text.primary,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
  },
  closeButton: {},
});
