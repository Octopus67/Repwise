/**
 * ProgressPhotoGrid — 2-column grid for progress photos with add/delete.
 * Handles image picker permissions and compression.
 */

import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Image,
  Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { documentDirectory, getInfoAsync, makeDirectoryAsync, copyAsync, deleteAsync } from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, typography, shadows } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Icon } from '../common/Icon';

const PHOTO_DIR = `${documentDirectory ?? ''}measurement_photos/`;
const STORAGE_KEY = 'measurement_photo_paths';
const MAX_PHOTOS = 30;
const COLUMN_GAP = spacing[3];
const SCREEN_PADDING = spacing[3];
const PHOTO_WIDTH = (Dimensions.get('window').width - SCREEN_PADDING * 2 - COLUMN_GAP) / 2;

export interface PhotoItem {
  id: string;
  uri: string;
  date: string;
}

interface ProgressPhotoGridProps {
  photos: PhotoItem[];
  onPhotosChange: (photos: PhotoItem[]) => void;
  loading?: boolean;
}

async function ensureDir(): Promise<void> {
  const info = await getInfoAsync(PHOTO_DIR);
  if (!info.exists) await makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
}

async function requestPermission(type: 'camera' | 'library'): Promise<boolean> {
  const result = type === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!result.granted) {
    Alert.alert(
      'Permission Required',
      `Please grant ${type === 'camera' ? 'camera' : 'photo library'} access in Settings.`,
    );
    return false;
  }
  return true;
}

export function ProgressPhotoGrid({ photos, onPhotosChange, loading }: ProgressPhotoGridProps) {
  const c = useThemeColors();
  const [saving, setSaving] = useState(false);

  const handleAdd = useCallback(async (source: 'camera' | 'library') => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit Reached', `Maximum ${MAX_PHOTOS} photos. Delete older ones to add new.`);
      return;
    }

    const hasPermission = await requestPermission(source);
    if (!hasPermission) return;

    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: 'images',
      quality: 0.7, // compression
      allowsEditing: false,
    };

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);

    if (result.canceled || !result.assets?.[0]) return;

    setSaving(true);
    try {
      await ensureDir();
      const name = `${Date.now()}.jpg`;
      const dest = `${PHOTO_DIR}${name}`;
      await copyAsync({ from: result.assets[0].uri, to: dest });

      const newPhoto: PhotoItem = {
        id: name,
        uri: dest,
        date: new Date().toISOString().split('T')[0],
      };

      const updated = [newPhoto, ...photos];
      onPhotosChange(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      Alert.alert('Error', 'Failed to save photo');
    } finally {
      setSaving(false);
    }
  }, [photos, onPhotosChange]);

  const handleDelete = useCallback((photo: PhotoItem) => {
    Alert.alert('Delete Photo', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAsync(photo.uri, { idempotent: true }).catch(() => {});
            const updated = photos.filter((p) => p.id !== photo.id);
            onPhotosChange(updated);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          } catch {
            Alert.alert('Error', 'Failed to delete photo');
          }
        },
      },
    ]);
  }, [photos, onPhotosChange]);

  const showAddOptions = useCallback(() => {
    Alert.alert('Add Photo', 'Choose source', [
      { text: 'Camera', onPress: () => handleAdd('camera') },
      { text: 'Photo Library', onPress: () => handleAdd('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [handleAdd]);

  const renderItem = ({ item }: { item: PhotoItem }) => (
    <TouchableOpacity
      style={[styles.photoCard, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]}
      onLongPress={() => handleDelete(item)}
      activeOpacity={0.8}
      accessibilityLabel={`Progress photo from ${item.date}. Long press to delete.`}
      accessibilityRole="image"
    >
      <Image source={{ uri: item.uri }} style={[styles.photoImage, { backgroundColor: c.bg.surfaceRaised }]} />
      <Text style={[styles.photoDate, { color: c.text.secondary }]}>{item.date}</Text>
    </TouchableOpacity>
  );

  const renderAddButton = () => (
    <TouchableOpacity
      style={[styles.addCard, { backgroundColor: c.accent.primaryMuted, borderColor: c.accent.primary }]}
      onPress={showAddOptions}
      disabled={saving}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Add progress photo"
    >
      {saving ? (
        <ActivityIndicator color={c.accent.primary} size="small" />
      ) : (
        <>
          <Icon name="camera" size={24} color={c.accent.primary} />
          <Text style={[styles.addText, { color: c.accent.primary }]}>Add Photo</Text>
        </>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={c.accent.primary} size="large" />
      </View>
    );
  }

  const gridData = [{ id: '__add__', uri: '', date: '' } as PhotoItem, ...photos];

  return (
    <FlatList
      data={gridData}
      renderItem={({ item }) =>
        item.id === '__add__' ? renderAddButton() : renderItem({ item })
      }
      keyExtractor={(item) => item.id}
      numColumns={2}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={styles.gridRow}
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  grid: { paddingVertical: spacing[2] },
  gridRow: { gap: COLUMN_GAP },
  photoCard: {
    flex: 1, marginBottom: spacing[3], borderRadius: radius.md,
    overflow: 'hidden', backgroundColor: colors.bg.surface,
    borderWidth: 1, borderColor: colors.border.subtle,
  },
  photoImage: {
    width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.bg.surfaceRaised,
  },
  photoDate: {
    color: colors.text.secondary, fontSize: typography.size.xs,
    textAlign: 'center', paddingVertical: spacing[2],
  },
  addCard: {
    flex: 1, aspectRatio: 3 / 4, marginBottom: spacing[3],
    borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed',
    borderColor: colors.accent.primary, backgroundColor: colors.accent.primaryMuted,
    alignItems: 'center', justifyContent: 'center', gap: spacing[2],
  },
  addText: {
    color: colors.accent.primary, fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  loadingWrap: {
    height: 200, alignItems: 'center', justifyContent: 'center',
  },
});
