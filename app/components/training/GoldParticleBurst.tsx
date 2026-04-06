import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { colors } from '../../theme/tokens';

const PARTICLE_COUNT = 15;
const PARTICLE_SIZE = 8;
const GOLD = colors.gradientArrays.premium[0];

interface Particle {
  angle: number;
  distance: number;
  damping: number;
  stiffness: number;
}

const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
  angle: Math.random() * Math.PI * 2,
  distance: 40 + Math.random() * 60,
  damping: 8 + Math.random() * 7,
  stiffness: 80 + Math.random() * 40,
}));

function ParticleView({ p }: { p: Particle }) {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    progress.value = withSpring(1, { damping: p.damping, stiffness: p.stiffness });
    opacity.value = withTiming(0, { duration: 500 });
    return () => { cancelAnimation(progress); cancelAnimation(opacity); };
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: Math.cos(p.angle) * p.distance * progress.value },
      { translateY: Math.sin(p.angle) * p.distance * progress.value },
    ],
  }));

  return <Animated.View style={[styles.particle, style]} />;
}

export function GoldParticleBurst() {
  return (
    <Animated.View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => (
        <ParticleView key={i} p={p} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    width: PARTICLE_SIZE,
    height: PARTICLE_SIZE,
    borderRadius: PARTICLE_SIZE / 2,
    backgroundColor: GOLD,
  },
});
