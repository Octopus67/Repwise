import React from 'react';
import { ActivityIndicator } from 'react-native';

let LottieView: any = null;
try { LottieView = require('lottie-react-native'); } catch {}

export function BrandedLoader({ size = 48 }: { size?: number }) {
  if (LottieView) {
    return (
      <LottieView
        source={require('../../assets/animations/loading-ring.json')}
        autoPlay
        loop
        style={{ width: size, height: size }}
      />
    );
  }
  return <ActivityIndicator size="large" />;
}
