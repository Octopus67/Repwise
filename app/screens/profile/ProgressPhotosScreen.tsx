/**
 * ProgressPhotosScreen — Simple photo gallery with upload/camera.
 * Max 20 photos per user. Shows date and photo grid.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  FlatList, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { documentDirectory, getInfoAsync, makeDirectoryAsync, copyAsync, deleteAsync } from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, typography, shadows } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import api from '../../services/api';

const PHOTO_DIR = `${documentDirectory ?? ''}progress_photos/`;
const STORAGE_KEY = 'progress_photo_paths';
const MAX_PHOTOS = 20;

interface PhotoEntry {
  id: string;
  capture_date: string;
  created_at: string;
}

export function ProgressPhotosScreen() {
  const c = useThemeColors();
  const navigation = useNavigation();
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [pathMap, setPathMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, stored] = await Promise.all([
        api.get('progress-photos?limit=100'),
        AsyncStorage.getItem(STORAGE_KEY),
      ]);
      setPhotos(res.data?.items ?? []);
      setPathMap(stored ? JSON.parse(stored) : {});
    } catch {
      Alert.alert('Error', 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const saveLocally = async (uri: string): Promise<string> => {
    const dir = await getInfoAsync(PHOTO_DIR);
    if (!dir.exists) await makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
    const name = `${Date.now()}.jpg`;
    const dest = `${PHOTO_DIR}${name}`;
    await copyAsync({ from: uri, to: dest });
    return dest;
  };

  const handleAdd = async (source: 'camera' | 'library') => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit Reached', `Maximum ${MAX_PHOTOS} photos allowed. Delete older photos to add new ones.`);
      return;
    }

    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: 'images',
      quality: 0.8,
      allowsEditing: false,
    };

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);

    if (result.canceled || !result.assets?.[0]) return;

    setSaving(true);
    try {
      const localUri = await saveLocally(result.assets[0].uri);
      const today = new Date().toISOString().split('T')[0];
      const { data } = await api.post('progress-photos', { capture_date: today });
      const updated = { ...pathMap, [data.id]: localUri };
      setPathMap(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      await loadData();
    } catch {
      Alert.alert('Error', 'Failed to save photo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (photo: PhotoEntry) => {
    Alert.alert('Delete Photo', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`progress-photos/${photo.id}`);
            const local = pathMap[photo.id];
            if (local) {
              await deleteAsync(local, { idempotent: true }).catch(() => {});
              const updated = { ...pathMap };
              delete updated[photo.id];
              setPathMap(updated);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            }
            await loadData();
          } catch {
            Alert.alert('Error', 'Failed to delete photo');
          }
        },
      },
    ]);
  };

  const showAddOptions = () => {
    Alert.alert('Add Photo', 'Choose source', [
      { text: 'Camera', onPress: () => handleAdd('camera') },
      { text: 'Photo Library', onPress: () => handleAdd('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderPhoto = ({ item }: { item: PhotoEntry }) => {
    const uri = pathMap[item.id];
    return (
      <TouchableOpacity style={[styles.photoCard, { backgroundColor: c.bg.surface, borderColor: c.border.subtle }]} onLongPress={() => handleDelete(item)} activeOpacity={0.8}>
        {uri ? (
          <Image source={{ uri }} style={[styles.photoImage, { backgroundColor: c.bg.surfaceRaised }]} />
        ) : (
          <View style={[styles.photoPlaceholder, { backgroundColor: c.bg.surfaceRaised }]}>
            <Text style={[styles.placeholderText, { color: c.text.muted }]}>No local file</Text>
          </View>
        )}
        <Text style={[styles.photoDate, { color: c.text.secondary }]}>{item.capture_date}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={c.accent.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.base }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: c.border.subtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: c.accent.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.text.primary }]}>Progress Photos</Text>
        <Text style={[styles.count, { color: c.text.muted }]}>{photos.length}/{MAX_PHOTOS}</Text>
      </View>

      {photos.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: c.text.primary }]}>No photos yet</Text>
          <Text style={[styles.emptySubtitle, { color: c.text.secondary }]}>Take your first progress photo to start tracking your transformation.</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
        />
      )}

      <TouchableOpacity style={[styles.fab, saving && styles.fabDisabled]} onPress={showAddOptions} disabled={saving} activeOpacity={0.8}>
        {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.fabText}>+</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.base },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  backBtn: { width: 60, minHeight: 44, justifyContent: 'center' },
  backText: { color: colors.accent.primary, fontSize: typography.size.base },
  title: { color: colors.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
  count: { color: colors.text.muted, fontSize: typography.size.sm, width: 60, textAlign: 'right' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[8] },
  emptyTitle: { color: colors.text.primary, fontSize: typography.size.xl, fontWeight: typography.weight.semibold, marginBottom: spacing[2] },
  emptySubtitle: { color: colors.text.secondary, fontSize: typography.size.base, textAlign: 'center', lineHeight: 22 },
  grid: { padding: spacing[3] },
  gridRow: { gap: spacing[3] },
  photoCard: { flex: 1, marginBottom: spacing[3], borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.bg.surface, borderWidth: 1, borderColor: colors.border.subtle },
  photoImage: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.bg.surfaceRaised },
  photoPlaceholder: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.bg.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: colors.text.muted, fontSize: typography.size.xs },
  photoDate: { color: colors.text.secondary, fontSize: typography.size.xs, textAlign: 'center', paddingVertical: spacing[2] },
  fab: { position: 'absolute', bottom: spacing[8], right: spacing[4], width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.accent.primary, alignItems: 'center', justifyContent: 'center', ...shadows.md },
  fabDisabled: { opacity: 0.5 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: typography.weight.bold },
});
