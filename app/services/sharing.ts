/**
 * Sharing Service — capture workout cards as images, share, and save to gallery.
 *
 * Uses react-native-view-shot for capture, expo-sharing for share sheet,
 * and expo-media-library for saving to gallery.
 */

import { Platform, Alert } from 'react-native';
import type { RefObject } from 'react';
import type ViewShot from 'react-native-view-shot';

/**
 * Capture a ViewShot ref as a temporary PNG file URI.
 */
export async function captureWorkoutAsImage(
  viewShotRef: RefObject<ViewShot | null>,
): Promise<string | null> {
  try {
    if (!viewShotRef.current?.capture) return null;
    const uri = await viewShotRef.current.capture();
    return uri ?? null;
  } catch {
    return null;
  }
}

/**
 * Open the native share sheet with a captured image.
 */
export async function shareImage(uri: string): Promise<boolean> {
  try {
    const Sharing = await import('expo-sharing');
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
      return false;
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share Workout',
      UTI: 'public.png',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Save an image URI to the device's media library.
 * Requests permission if not already granted.
 */
export async function saveImageToGallery(uri: string): Promise<boolean> {
  try {
    const MediaLibrary = await import('expo-media-library');
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant photo library access in Settings to save images.',
      );
      return false;
    }
    await MediaLibrary.saveToLibraryAsync(uri);
    return true;
  } catch {
    Alert.alert('Error', 'Failed to save image to gallery.');
    return false;
  }
}
