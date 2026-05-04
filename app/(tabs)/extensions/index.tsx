import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Switch,
  Text,
  TextInput,
  Modal,
} from 'react-native';
import { Trash2, Plus } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

interface HarnessManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  tools: string[];
  harness_type: string;
}

const EXAMPLE_HARNESSES = [
  {
    id: 'code-assistant',
    name: 'Code Assistant',
    description: 'Tools for code execution, file management, and GitHub integration',
    version: '1.0.0',
    repo_url: 'https://github.com/example/harness-code-assistant',
  },
  {
    id: 'research-agent',
    name: 'Research Agent',
    description: 'Web search, note-taking, and citation tools for research',
    version: '1.0.0',
    repo_url: 'https://github.com/example/harness-research-agent',
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    description: 'CSV parsing, charting, and data analysis tools',
    version: '1.0.0',
    repo_url: 'https://github.com/example/harness-data-analyst',
  },
];

export default function ExtensionsScreen() {
  const theme = useAppStore((state) => state.theme);
  const themeColors = colors[theme];
  const userId = useAppStore((state) => state.userId);
  const extensions = useAppStore((state) => state.extensions);
  const addExtension = useAppStore((state) => state.addExtension);
  const removeExtension = useAppStore((state) => state.removeExtension);
  const updateExtension = useAppStore((state) => state.updateExtension);

  const [tab, setTab] = useState<'installed' | 'browse' | 'upload'>('installed');
  const [loading, setLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [customVersion, setCustomVersion] = useState('1.0.0');

  useEffect(() => {
    if (userId) {
      loadExtensions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadExtensions = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase.from('extensions').select('*').eq('user_id', userId);
      if (error) throw error;
      const store = useAppStore.getState();
      store.setExtensions(data || []);
    } catch (error) {
      console.error('Error loading extensions:', error);
    }
  };

  const handleInstallHarness = async (harness: typeof EXAMPLE_HARNESSES[0]) => {
    if (!userId) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    setLoading(true);
    try {
      const manifest: HarnessManifest = {
        name: harness.name,
        version: harness.version,
        description: harness.description,
        author: 'Example Author',
        harness_type: harness.id,
        tools: [],
      };

      const { data, error } = await supabase
        .from('extensions')
        .insert({
          user_id: userId,
          name: harness.name,
          harness_type: harness.id,
          repo_url: harness.repo_url,
          version: harness.version,
          manifest_json: manifest,
          enabled: true,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) addExtension(data);
      Alert.alert('Success', `${harness.name} installed`);
    } catch (error) {
      Alert.alert('Error', 'Failed to install harness');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExtension = async (id: string, enabled: boolean) => {
    try {
      const { error } = await supabase.from('extensions').update({ enabled: !enabled }).eq('id', id);
      if (error) throw error;
      updateExtension(id, { enabled: !enabled });
    } catch (error) {
      Alert.alert('Error', 'Failed to update extension');
      console.error(error);
    }
  };

  const handleDeleteExtension = async (id: string, name: string) => {
    Alert.alert('Delete Extension', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('extensions').delete().eq('id', id);
            if (error) throw error;
            removeExtension(id);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete extension');
            console.error(error);
          }
        },
      },
    ]);
  };

  const handleUploadCustomHarness = async () => {
    if (!userId) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    if (!customUrl || !customName) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const manifest: HarnessManifest = {
        name: customName,
        version: customVersion,
        description: 'Custom harness uploaded via URL',
        author: 'Custom',
        harness_type: customName.toLowerCase().replace(/\s+/g, '-'),
        tools: [],
      };

      const { data, error } = await supabase
        .from('extensions')
        .insert({
          user_id: userId,
          name: customName,
          harness_type: manifest.harness_type,
          repo_url: customUrl,
          version: customVersion,
          manifest_json: manifest,
          enabled: true,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) addExtension(data);

      setUploadModalVisible(false);
      setCustomUrl('');
      setCustomName('');
      setCustomVersion('1.0.0');

      Alert.alert('Success', `${customName} uploaded successfully`);
    } catch (error) {
      Alert.alert('Error', 'Failed to upload harness');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderInstalledExtensions = () => {
    return (
      <FlatList
        data={extensions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[styles.extensionCard, { backgroundColor: themeColors.surface }]}>
            <View style={styles.extensionInfo}>
              <Text style={[styles.extensionName, { color: themeColors.text }]}>{item.name}</Text>
              <Text style={[styles.extensionVersion, { color: themeColors.textSecondary }]}>
                v{item.version}
              </Text>
              {item.manifest_json?.description && (
                <Text style={[styles.extensionDesc, { color: themeColors.textTertiary }]}>
                  {item.manifest_json.description}
                </Text>
              )}
            </View>
            <View style={styles.extensionActions}>
              <Switch
                value={item.enabled}
                onValueChange={() => handleToggleExtension(item.id, item.enabled)}
                trackColor={{ false: themeColors.border, true: themeColors.primary }}
              />
              <TouchableOpacity
                onPress={() => handleDeleteExtension(item.id, item.name)}
                style={[styles.deleteButton, { backgroundColor: colors[theme].error + '20' }]}>
                <Trash2 color={colors[theme].error} size={18} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
            No extensions installed yet
          </Text>
        }
      />
    );
  };

  const renderBrowseHarnesses = () => {
    return (
      <FlatList
        data={EXAMPLE_HARNESSES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[styles.harnessCard, { backgroundColor: themeColors.surface }]}>
            <View style={styles.harnessInfo}>
              <Text style={[styles.harnesName, { color: themeColors.text }]}>{item.name}</Text>
              <Text style={[styles.harnessDesc, { color: themeColors.textSecondary }]}>
                {item.description}
              </Text>
              <Text style={[styles.harnessVersion, { color: themeColors.textTertiary }]}>
                v{item.version}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleInstallHarness(item)}
              disabled={loading || extensions.some((e) => e.harness_type === item.id)}
              style={[
                styles.installButton,
                {
                  backgroundColor: extensions.some((e) => e.harness_type === item.id)
                    ? themeColors.textTertiary
                    : themeColors.primary,
                },
              ]}>
              <Text style={styles.installButtonText}>
                {extensions.some((e) => e.harness_type === item.id) ? 'Installed' : 'Install'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />
    );
  };

  const renderUploadCustom = () => {
    return (
      <View style={styles.uploadContainer}>
        <Text style={[styles.uploadTitle, { color: themeColors.text }]}>
          Upload Custom Harness
        </Text>
        <Text style={[styles.uploadDesc, { color: themeColors.textSecondary }]}>
          Add your own custom harness by providing a GitHub repository URL or manifest JSON.
        </Text>

        <TouchableOpacity
          onPress={() => setUploadModalVisible(true)}
          style={[styles.uploadButton, { backgroundColor: themeColors.primary }]}>
          <Plus color="#fff" size={20} />
          <Text style={styles.uploadButtonText}>Add Custom Harness</Text>
        </TouchableOpacity>

        <View style={styles.instructions}>
          <Text style={[styles.instructionsTitle, { color: themeColors.text }]}>
            How to create a custom harness:
          </Text>
          <Text style={[styles.instructionsText, { color: themeColors.textSecondary }]}>
            1. Create a GitHub repository with a harness manifest
          </Text>
          <Text style={[styles.instructionsText, { color: themeColors.textSecondary }]}>
            2. Follow the harness development guide in documentation
          </Text>
          <Text style={[styles.instructionsText, { color: themeColors.textSecondary }]}>
            3. Provide the repository URL or manifest JSON above
          </Text>
        </View>

        <Modal
          visible={uploadModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setUploadModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                Add Custom Harness
              </Text>

              <TextInput
                style={[styles.input, { color: themeColors.text, borderColor: themeColors.border }]}
                placeholder="Harness Name *"
                placeholderTextColor={themeColors.textTertiary}
                value={customName}
                onChangeText={setCustomName}
              />

              <TextInput
                style={[styles.input, { color: themeColors.text, borderColor: themeColors.border }]}
                placeholder="Repository URL or Manifest URL *"
                placeholderTextColor={themeColors.textTertiary}
                value={customUrl}
                onChangeText={setCustomUrl}
              />

              <TextInput
                style={[styles.input, { color: themeColors.text, borderColor: themeColors.border }]}
                placeholder="Version (e.g., 1.0.0)"
                placeholderTextColor={themeColors.textTertiary}
                value={customVersion}
                onChangeText={setCustomVersion}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setUploadModalVisible(false)}
                  style={[styles.modalButton, { backgroundColor: themeColors.border }]}>
                  <Text style={[styles.modalButtonText, { color: themeColors.text }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleUploadCustomHarness}
                  disabled={loading}
                  style={[
                    styles.modalButton,
                    { backgroundColor: themeColors.primary, opacity: loading ? 0.5 : 1 },
                  ]}>
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                    {loading ? 'Uploading...' : 'Upload'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>Extensions</Text>
      </View>

      <View style={[styles.tabBar, { backgroundColor: themeColors.surface }]}>
        {(['installed', 'browse', 'upload'] as const).map((tabName) => (
          <TouchableOpacity
            key={tabName}
            style={[
              styles.tab,
              tab === tabName && { borderBottomColor: themeColors.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setTab(tabName)}>
            <Text
              style={[
                styles.tabLabel,
                { color: tab === tabName ? themeColors.primary : themeColors.textSecondary },
              ]}>
                {tabName.charAt(0).toUpperCase() + tabName.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'installed' && renderInstalledExtensions()}
      {tab === 'browse' && renderBrowseHarnesses()}
      {tab === 'upload' && renderUploadCustom()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  extensionCard: {
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  extensionInfo: {
    flex: 1,
  },
  extensionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  extensionVersion: {
    fontSize: 12,
  },
  extensionDesc: {
    fontSize: 11,
    marginTop: spacing.xs,
  },
  extensionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  harnessCard: {
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  harnessInfo: {
    marginBottom: spacing.md,
  },
  harnesName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  harnessDesc: {
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  harnessVersion: {
    fontSize: 11,
  },
  installButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  installButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  uploadContainer: {
    padding: spacing.lg,
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  uploadDesc: {
    fontSize: 14,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    marginTop: spacing.md,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  instructionsText: {
    fontSize: 14,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    padding: spacing.xl,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
