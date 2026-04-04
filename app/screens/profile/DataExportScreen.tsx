import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import { downloadAsync, documentDirectory } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { spacing } from '../../theme/tokens';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { SectionHeader } from '../../components/common/SectionHeader';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import api, { API_BASE_URL } from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';

type ExportFormat = 'json' | 'csv' | 'pdf';
type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ExportRecord {
  id: string;
  format: ExportFormat;
  status: ExportStatus;
  file_size_bytes: number | null;
  error_message: string | null;
  requested_at: string;
  completed_at: string | null;
  expires_at: string | null;
  downloaded_at: string | null;
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; desc: string }[] = [
  { value: 'json', label: 'JSON', desc: 'Machine-readable, all data' },
  { value: 'csv', label: 'CSV', desc: 'Spreadsheet-compatible ZIP' },
  { value: 'pdf', label: 'PDF', desc: 'Formatted report' },
];

const POLL_INTERVAL_MS = 3000;

export function DataExportScreen() {
  const c = useThemeColors();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [history, setHistory] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('export/history');
      setHistory(res.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchHistory().finally(() => setLoading(false));
  }, [fetchHistory]);

  // Poll for pending/processing exports
  useEffect(() => {
    const hasPending = history.some(
      (e) => e.status === 'pending' || e.status === 'processing'
    );
    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(fetchHistory, POLL_INTERVAL_MS);
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [history, fetchHistory]);

  const handleRequest = async () => {
    setRequesting(true);
    setError(null);
    try {
      await api.post('export/request', { format: selectedFormat });
      await fetchHistory();
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Failed to request export. Try again later.');
      setError(msg);
    } finally {
      setRequesting(false);
    }
  };

  const handleDownload = async (exportId: string) => {
    try {
      const url = `${API_BASE_URL}/api/v1/export/download/${exportId}`;
      if (Platform.OS === 'web') {
        // For web, open authenticated URL via blob
        const res = await api.get(`export/download/${exportId}`, { responseType: 'blob' });
        const blobUrl = URL.createObjectURL(res.data);
        window.open(blobUrl, '_blank');
      } else {
        // Get auth token from api interceptor
        const token = api.defaults.headers.common['Authorization'] as string | undefined;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = token;

        const fileUri = `${documentDirectory}export_${exportId}`;
        const result = await downloadAsync(url, fileUri, { headers });
        if (result.status === 200) {
          await Sharing.shareAsync(result.uri);
        } else {
          Alert.alert('Error', 'Download failed. Please try again.');
        }
      }
    } catch {
      Alert.alert('Error', 'Could not download export.');
    }
  };

  const handleDelete = async (exportId: string) => {
    Alert.alert(
      'Delete Export',
      'Are you sure you want to delete this export? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`export/${exportId}`);
              await fetchHistory();
            } catch {
              Alert.alert('Error', 'Could not delete export.');
            }
          },
        },
      ],
    );
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusColor = (status: ExportStatus) => {
    switch (status) {
      case 'completed':
        return c.semantic.positive;
      case 'failed':
        return c.semantic.negative;
      case 'processing':
        return c.semantic.warning;
      default:
        return c.text.muted;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bg.base }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionHeader title="Data Export" />
        <Text style={[styles.subtitle, { color: c.text.secondary }]}>
          Download your personal data (GDPR Article 20). One export per 24 hours.
        </Text>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {/* Format selector */}
        <View style={styles.formatRow}>
          {FORMAT_OPTIONS.map((opt) => (
            <Card
              key={opt.value}
              style={[
                styles.formatCard,
                selectedFormat === opt.value && {
                  borderColor: c.accent.primary,
                  borderWidth: 2,
                },
              ]}
              onPress={() => setSelectedFormat(opt.value)}
            >
              <Text style={[styles.formatLabel, { color: c.text.primary }]}>{opt.label}</Text>
              <Text style={[styles.formatDesc, { color: c.text.secondary }]}>
                {opt.desc}
              </Text>
            </Card>
          ))}
        </View>

        <Button
          title={requesting ? 'Requesting…' : 'Request Export'}
          onPress={handleRequest}
          disabled={requesting}
          style={styles.requestBtn}
        />

        {/* History */}
        <SectionHeader title="Export History" />
        {history.length === 0 && !loading && (
          <Text style={[styles.empty, { color: c.text.secondary }]}>
            No exports yet.
          </Text>
        )}
        {history.map((exp) => (
          <Card key={exp.id} style={styles.historyCard}>
            <View style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.historyFormat, { color: c.text.primary }]}>
                  {exp.format.toUpperCase()}
                </Text>
                <Text style={[styles.historyDate, { color: c.text.secondary }]}>
                  {new Date(exp.requested_at).toLocaleString()}
                </Text>
                <Text style={[styles.historyStatus, { color: statusColor(exp.status) }]}>
                  {exp.status} {exp.file_size_bytes ? `· ${formatBytes(exp.file_size_bytes)}` : ''}
                </Text>
                {exp.error_message && (
                  <Text style={[styles.errorMsg, { color: c.semantic.negative }]}>
                    {exp.error_message}
                  </Text>
                )}
              </View>
              <View style={styles.actions}>
                {exp.status === 'completed' && (
                  <Button
                    title="Download"
                    onPress={() => handleDownload(exp.id)}
                    style={styles.actionBtn}
                  />
                )}
                <Button
                  title="Delete"
                  onPress={() => handleDelete(exp.id)}
                  style={styles.actionBtn}
                />
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing[4] },
  subtitle: { fontSize: 14, marginBottom: spacing[4] },
  formatRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  formatCard: { flex: 1, padding: spacing[2], alignItems: 'center' },
  formatLabel: { fontSize: 16, fontWeight: '600' },
  formatDesc: { fontSize: 11, textAlign: 'center', marginTop: 2 },
  requestBtn: { marginBottom: spacing[6] },
  empty: { textAlign: 'center', marginVertical: spacing[6] },
  historyCard: { marginBottom: spacing[2], padding: spacing[2] },
  historyRow: { flexDirection: 'row', alignItems: 'center' },
  historyFormat: { fontSize: 15, fontWeight: '600' },
  historyDate: { fontSize: 12, marginTop: 2 },
  historyStatus: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  errorMsg: { fontSize: 11, marginTop: 2 },
  actions: { gap: spacing[1] },
  actionBtn: { paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
});
