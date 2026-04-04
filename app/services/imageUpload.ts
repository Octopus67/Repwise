// Utility for image optimization. Import where needed (e.g., progress photos, avatar upload).
// Required: npx expo install expo-image-manipulator
import * as ImageManipulator from 'expo-image-manipulator';

export async function compressImage(uri: string, maxWidth = 1920): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    return uri; // fallback to original if compression fails
  }
}
