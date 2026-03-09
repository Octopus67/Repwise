import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { radius, spacing, typography } from '../../theme/tokens';
import { useThemeColors, ThemeColors } from '../../hooks/useThemeColors';
import { Icon } from './Icon';

interface AvatarUploadProps {
  avatarUrl: string | null;
  initial: string;
  onUpload: (uri: string) => Promise<void>;
}

export function AvatarUpload({ avatarUrl, initial, onUpload }: AvatarUploadProps) {
  const c = useThemeColors();
  const styles = getStyles(c);
  const [uploading, setUploading] = useState(false);

  const handlePress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to upload an avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    try {
      await onUpload(result.assets[0].uri);
    } catch {
      Alert.alert('Upload failed', 'Could not update avatar. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.wrapper}
      onPress={handlePress}
      disabled={uploading}
      activeOpacity={0.7}
      accessibilityLabel="Change profile photo"
      accessibilityRole="button"
    >
      <View style={styles.circle}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.image} />
        ) : (
          <Text style={styles.initial}>{initial}</Text>
        )}
        {uploading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        )}
      </View>
      <View style={styles.badge}>
        <Icon name="camera" size={12} color={c.text.primary} />
      </View>
    </TouchableOpacity>
  );
}

const getStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      alignSelf: 'center',
      marginBottom: spacing[3],
    },
    circle: {
      width: 80,
      height: 80,
      borderRadius: radius.full,
      backgroundColor: c.accent.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    image: {
      width: 80,
      height: 80,
      borderRadius: radius.full,
    },
    initial: {
      color: c.accent.primary,
      fontSize: typography.size['2xl'],
      fontWeight: typography.weight.semibold,
      lineHeight: typography.lineHeight['2xl'],
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.accent.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: c.bg.surface,
    },
  });
