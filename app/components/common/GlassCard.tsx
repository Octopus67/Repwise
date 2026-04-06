import React, { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { radius } from '../../theme/tokens';

let BlurView: React.ComponentType<any> | null = null;
try { BlurView = require('expo-blur').BlurView; } catch { /* expo-blur unavailable */ }

interface GlassCardProps {
  children: ReactNode;
  style?: ViewStyle;
  intensity?: number;
  tint?: 'dark' | 'light';
}

export function GlassCard({ children, style, intensity = 15, tint = 'dark' }: GlassCardProps) {
  const canBlur = BlurView && Platform.OS !== 'web';
  return (
    <View style={[styles.wrapper, !canBlur && styles.fallback, style]}>
      {canBlur && <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
