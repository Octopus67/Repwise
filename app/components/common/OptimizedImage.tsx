// Utility for image optimization. Import where needed (e.g., progress photos, avatar upload).
import React, { useState } from 'react';
import { Image, View, Text, StyleSheet, type ImageSourcePropType, type StyleProp, type ImageStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useThemeColors } from '../../hooks/useThemeColors';

interface OptimizedImageProps {
  source: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  placeholder?: ImageSourcePropType;
  accessibilityLabel?: string;
}

export function OptimizedImage({ source, style, placeholder, accessibilityLabel }: OptimizedImageProps) {
  const c = useThemeColors();
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <View style={style}>
      {!loaded && (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: c.bg.surface }]}
          accessibilityElementsHidden
        />
      )}
      {errored ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg.surface, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: c.text.muted, fontSize: 12 }}>⚠️</Text>
        </View>
      ) : (
      <Animated.View entering={loaded ? FadeIn.duration(200) : undefined} style={StyleSheet.absoluteFill}>
        <Image
          source={source}
          style={[StyleSheet.absoluteFill, { resizeMode: 'cover' }]}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="image"
        />
      </Animated.View>
      )}
    </View>
  );
}
