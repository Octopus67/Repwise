import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useNetInfo } from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function OfflineBanner() {
  const { isConnected } = useNetInfo();
  const insets = useSafeAreaInsets();

  if (isConnected !== false) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      style={[styles.banner, { paddingTop: insets.top + 4 }]}
    >
      <Text style={styles.text}>No internet connection</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#e67e22',
    paddingBottom: 6,
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
