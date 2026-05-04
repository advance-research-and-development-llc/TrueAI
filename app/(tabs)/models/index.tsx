import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  Text,
} from 'react-native';
import { Download, Trash2, Search } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';
import { getInferenceEngine } from '@/lib/inference';
import { supabase } from '@/lib/supabase';
import { huggingFaceService, HuggingFaceModel } from '@/lib/huggingface';

export default function ModelsScreen() {
  const theme = useAppStore((state) => state.theme);
  const themeColors = colors[theme];
  const ollamaUrl = useAppStore((state) => state.ollamaUrl);
  const userId = useAppStore((state) => state.userId);
  const models = useAppStore((state) => state.models);
  const addModel = useAppStore((state) => state.addModel);
  const removeModel = useAppStore((state) => state.removeModel);

  const [tab, setTab] = useState<'installed' | 'ollama' | 'huggingface'>('installed');
  const [loading, setLoading] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [huggingFaceModels, setHuggingFaceModels] = useState<HuggingFaceModel[]>([]);
  const [search, setSearch] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  const inferenceEngine = getInferenceEngine(ollamaUrl);

  useEffect(() => {
    if (tab === 'ollama') {
      loadOllamaModels();
    } else if (tab === 'huggingface') {
      loadHuggingFaceModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (userId) {
      loadInstalledModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadInstalledModels = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase.from('models').select('*').eq('user_id', userId);
      if (error) throw error;
      const store = useAppStore.getState();
      store.setModels(data || []);
    } catch (error) {
      console.error('Error loading models:', error);
    }
  };

  const loadOllamaModels = async () => {
    setLoading(true);
    try {
      const modelNames = await inferenceEngine.listModels();
      setOllamaModels(modelNames);
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to Ollama server');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadHuggingFaceModels = async () => {
    setLoading(true);
    try {
      const models = await huggingFaceService.searchModels(search || '', {
        limit: 30,
        filter: 'gguf',
        sort: 'downloads',
      });
      setHuggingFaceModels(models);
    } catch (error) {
      Alert.alert('Error', 'Failed to load HuggingFace models');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePullModel = async (modelName: string) => {
    if (!userId) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    setLoading(true);
    try {
      await inferenceEngine.pullModel(modelName, (status) => {
        setDownloadProgress((prev) => ({
          ...prev,
          [modelName]: Math.random() * 100,
        }));
      });

      const { data, error } = await supabase
        .from('models')
        .insert({
          user_id: userId,
          name: modelName,
          source: 'ollama',
          status: 'available',
          metadata: { pulled_at: new Date().toISOString() },
        })
        .select()
        .single();

      if (error) throw error;
      if (data) addModel(data);
      Alert.alert('Success', `Model ${modelName} downloaded`);
    } catch (error) {
      Alert.alert('Error', 'Failed to download model');
      console.error(error);
    } finally {
      setLoading(false);
      setDownloadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[modelName];
        return newProgress;
      });
    }
  };

  const handleDeleteModel = async (modelId: string, modelName: string) => {
    Alert.alert('Delete Model', `Are you sure you want to delete ${modelName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('models').delete().eq('id', modelId);
            if (error) throw error;
            removeModel(modelId);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete model');
            console.error(error);
          }
        },
      },
    ]);
  };

  const handleDownloadHuggingFaceModel = async (model: HuggingFaceModel) => {
    if (!userId) {
      Alert.alert('Error', 'Please log in to download models');
      return;
    }

    Alert.alert(
      'Download Model',
      `Download ${model.name}?\n\nNote: This will download the model metadata. For full model download, you'll need to implement file download functionality with expo-file-system.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: async () => {
            try {
              setLoading(true);

              // Get model files
              const files = await huggingFaceService.getModelFiles(model.id);

              // For now, just save model metadata to database
              // In production, you would download the actual GGUF files using expo-file-system
              const { data, error } = await supabase
                .from('models')
                .insert({
                  user_id: userId,
                  name: model.name,
                  source: 'huggingface',
                  status: 'metadata_only',
                  metadata: {
                    author: model.author,
                    downloads: model.downloads,
                    tags: model.tags,
                    files: files.map(f => ({ name: f.rfilename, size: f.size })),
                    added_at: new Date().toISOString(),
                  },
                })
                .select()
                .single();

              if (error) throw error;
              if (data) addModel(data);

              Alert.alert(
                'Success',
                `Model metadata saved. To download the full model files, implement file download with expo-file-system and FileSystem.downloadAsync().`
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to save model metadata');
              console.error(error);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderInstalledModels = () => {
    return (
      <FlatList
        data={models.filter((m) =>
          m.name.toLowerCase().includes(search.toLowerCase())
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[styles.modelCard, { backgroundColor: themeColors.surface }]}>
            <View style={styles.modelInfo}>
              <Text style={[styles.modelName, { color: themeColors.text }]}>{item.name}</Text>
              <Text style={[styles.modelSource, { color: themeColors.textSecondary }]}>
                {item.source} • {item.status}
              </Text>
              {item.quantization && (
                <Text style={[styles.quantization, { color: themeColors.textTertiary }]}>
                  {item.quantization}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => handleDeleteModel(item.id, item.name)}
              style={[styles.deleteButton, { backgroundColor: colors[theme].error + '20' }]}>
              <Trash2 color={colors[theme].error} size={18} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
            No models installed yet
          </Text>
        }
      />
    );
  };

  const renderOllamaModels = () => {
    const filteredModels = ollamaModels.filter((m) =>
      m.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <FlatList
        data={filteredModels}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[styles.modelCard, { backgroundColor: themeColors.surface }]}>
            <View style={styles.modelInfo}>
              <Text style={[styles.modelName, { color: themeColors.text }]}>{item}</Text>
              <Text style={[styles.modelSource, { color: themeColors.textSecondary }]}>
                Available on Ollama
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handlePullModel(item)}
              disabled={loading}
              style={[
                styles.downloadButton,
                { backgroundColor: themeColors.primary, opacity: loading ? 0.5 : 1 },
              ]}>
              {downloadProgress[item] !== undefined ? (
                <ActivityIndicator color="#fff" size={18} />
              ) : (
                <Download color="#fff" size={18} />
              )}
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
            {loading ? 'Loading models...' : 'No models found'}
          </Text>
        }
      />
    );
  };

  const renderHuggingFaceModels = () => {
    const filteredModels = huggingFaceModels.filter((m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.modelId.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <FlatList
        data={filteredModels}
        keyExtractor={(item) => item.modelId}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[styles.modelCard, { backgroundColor: themeColors.surface }]}>
            <View style={styles.modelInfo}>
              <Text style={[styles.modelName, { color: themeColors.text }]}>
                {item.name}
              </Text>
              <Text style={[styles.modelSource, { color: themeColors.textSecondary }]}>
                {item.author} • {item.downloads} downloads
              </Text>
              <Text style={[styles.quantization, { color: themeColors.textTertiary }]}>
                {item.tags.slice(0, 3).join(', ')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleDownloadHuggingFaceModel(item)}
              style={[
                styles.downloadButton,
                { backgroundColor: themeColors.primary },
              ]}>
              <Download color="#fff" size={18} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
            {loading ? 'Loading models...' : 'No models found'}
          </Text>
        }
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>Models</Text>
      </View>

      <View style={[styles.tabBar, { backgroundColor: themeColors.surface }]}>
        {(['installed', 'ollama', 'huggingface'] as const).map((tabName) => (
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

      <View style={[styles.searchContainer, { backgroundColor: themeColors.surface }]}>
        <Search color={themeColors.textTertiary} size={18} />
        <TextInput
          style={[styles.searchInput, { color: themeColors.text }]}
          placeholder="Search..."
          placeholderTextColor={themeColors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {tab === 'installed' && renderInstalledModels()}
      {tab === 'ollama' && renderOllamaModels()}
      {tab === 'huggingface' && renderHuggingFaceModels()}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  modelSource: {
    fontSize: 12,
  },
  quantization: {
    fontSize: 11,
    marginTop: spacing.xs,
  },
  downloadButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
