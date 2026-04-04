import * as FileSystem from 'expo-file-system/legacy';
import api from './api';

interface UploadResult {
  r2Key: string;
}

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function inferContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  return map[ext ?? ''] ?? 'image/jpeg';
}

export async function uploadProgressPhoto(
  localUri: string,
  filename: string,
  contentType?: string,
): Promise<UploadResult> {
  contentType = contentType ?? inferContentType(filename);
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new Error(`Invalid content type: ${contentType}. Allowed: ${ALLOWED_TYPES.join(', ')}`);
  }

  const fileInfo = await FileSystem.getInfoAsync(localUri);
  if (fileInfo.exists && 'size' in fileInfo && fileInfo.size && fileInfo.size > MAX_PHOTO_SIZE_BYTES) {
    throw new Error(`File too large (${Math.round(fileInfo.size / 1024 / 1024)}MB). Maximum size is 10MB.`);
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data } = await api.post('progress-photos/upload-url', {
      filename,
      content_type: contentType,
    });

    let uploadResult: FileSystem.FileSystemUploadResult;
    try {
      uploadResult = await FileSystem.uploadAsync(data.upload_url, localUri, {
        httpMethod: 'PUT',
        headers: { 'Content-Type': contentType },
      });
    } catch (e) {
      // Retry once on network errors
      if (attempt === 0) continue;
      throw new Error(`Upload failed: network error`);
    }

    if (uploadResult.status >= 200 && uploadResult.status < 300) {
      return { r2Key: data.key };
    }

    // Retry once on 403 (expired pre-signed URL) or 5xx (server error)
    if (attempt === 0 && (uploadResult.status === 403 || uploadResult.status >= 500)) continue;

    throw new Error(`Upload failed with status ${uploadResult.status}`);
  }
  throw new Error('Upload failed after retry');
}
