import React, { useState } from 'react';
import { Image, ImageProps, View, StyleSheet } from 'react-native';

export function FallbackImage({ style, ...props }: Omit<ImageProps, 'onError'>) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <View style={[styles.fallback, style]} />;
  }

  return <Image {...props} style={style} onError={() => setHasError(true)} />;
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a2e' },
});
