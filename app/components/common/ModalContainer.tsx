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
  Easing,
} from 'react-native-reanimated';
import { colors, typography, radius, spacing, motion } from '../../theme/tokens';
import { Icon } from './Icon';

interface ModalContainerProps {
  visible: boolean;
  onClose: () => void;
  title: string;
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
        <Pressable style={styles.webOverlay} onPress={onClose}>
          <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
          <Animated.View style={[styles.webDialog, webContentStyle]} testID={testID}>
            <Pressable onPress={(e) => e.stopPropagation()} style={{ flex: 1 }}>
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={8} style={{ padding: 8 }} testID={closeButtonTestID}>
                  <Icon name="close" size={18} color={colors.text.secondary} />
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
      <View style={styles.mobileOverlay}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.mobileSheet, mobileContentStyle]} testID={testID}>
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={{ padding: 8, zIndex: 30 }} testID={closeButtonTestID}>
              <Icon name="close" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  webOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webDialog: {
    maxWidth: 480,
    width: '90%',
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[6],
    maxHeight: '85%',
  },
  mobileOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  mobileSheet: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border.default,
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
    backgroundColor: colors.bg.surfaceRaised,
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
    color: colors.text.primary,
  },
  closeButton: {},
});
