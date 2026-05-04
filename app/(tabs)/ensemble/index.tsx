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
  ScrollView,
} from 'react-native';
import { Layers, PlayCircle, Clock, Award } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { colors, spacing, typography } from '@/lib/theme';
import { getInferenceEngine } from '@/lib/inference';
import { getMultiModelEnsembleService } from '@/lib/multi-model-ensemble';

const STRATEGIES = [
  {
    id: 'parallel',
    name: 'Parallel',
    description: 'Run all models simultaneously, view all responses side-by-side',
    icon: '⚡',
  },
  {
    id: 'sequential',
    name: 'Sequential',
    description: 'Each model refines the previous model\'s output',
    icon: '🔄',
  },
  {
    id: 'voting',
    name: 'Voting',
    description: 'Multiple models vote, consensus wins',
    icon: '🗳️',
  },
  {
    id: 'weighted',
    name: 'Weighted',
    description: 'Combine responses with different weights per model',
    icon: '⚖️',
  },
  {
    id: 'best-of-n',
    name: 'Best-of-N',
    description: 'Generate N responses, automatically select the best',
    icon: '🏆',
  },
];

export default function EnsembleScreen() {
  const theme = useAppStore((state) => state.theme);
  const themeColors = colors[theme];
  const ollamaUrl = useAppStore((state) => state.ollamaUrl);
  const userId = useAppStore((state) => state.userId);
  const models = useAppStore((state) => state.models);

  const [tab, setTab] = useState<'run' | 'history'>('run');
  const [loading, setLoading] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState(STRATEGIES[0]);
  const [prompt, setPrompt] = useState('');
  const [votingThreshold, setVotingThreshold] = useState('0.6');
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [ensembleResults, setEnsembleResults] = useState<any[]>([]);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const inferenceEngine = getInferenceEngine(ollamaUrl);
  const ensembleService = getMultiModelEnsembleService();

  useEffect(() => {
    if (tab === 'history' && userId) {
      loadEnsembleResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId]);

  useEffect(() => {
    // Initialize weights when models change
    const newWeights: Record<string, string> = {};
    selectedModels.forEach((model) => {
      newWeights[model] = weights[model] || '1.0';
    });
    setWeights(newWeights);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModels]);

  const loadEnsembleResults = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const results = await ensembleService.getEnsembleResults(userId, 20);
      setEnsembleResults(results);
    } catch (error) {
      console.error('Error loading ensemble results:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleModelSelection = (modelName: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelName) ? prev.filter((m) => m !== modelName) : [...prev, modelName]
    );
  };

  const handleRunEnsemble = async () => {
    if (selectedModels.length < 2) {
      Alert.alert('Error', 'Please select at least 2 models for ensemble');
      return;
    }

    if (!prompt.trim()) {
      Alert.alert('Error', 'Please enter a prompt');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    setLoading(true);
    try {
      const config: any = {
        models: selectedModels,
        strategy: selectedStrategy.id,
      };

      if (selectedStrategy.id === 'voting') {
        config.votingThreshold = parseFloat(votingThreshold);
      } else if (selectedStrategy.id === 'weighted') {
        const weightsNum: Record<string, number> = {};
        selectedModels.forEach((model) => {
          weightsNum[model] = parseFloat(weights[model] || '1.0');
        });
        config.weights = weightsNum;
      }

      const result = await ensembleService.runEnsemble(
        prompt,
        config,
        inferenceEngine,
        userId
      );

      Alert.alert(
        'Ensemble Complete',
        `Strategy: ${selectedStrategy.name}\nModels: ${selectedModels.length}\nDuration: ${(result.totalDuration / 1000).toFixed(1)}s`,
        [
          { text: 'View History', onPress: () => setTab('history') },
          { text: 'OK' },
        ]
      );

      // Clear prompt and reload history
      setPrompt('');
      if (tab === 'history') {
        loadEnsembleResults();
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to run ensemble');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleResultExpansion = (resultId: string) => {
    setExpandedResults((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  };

  const renderRunTab = () => (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Prompt Input */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Enter Prompt</Text>
        <TextInput
          style={[
            styles.promptInput,
            {
              backgroundColor: themeColors.surface,
              color: themeColors.text,
              borderColor: themeColors.border,
            },
          ]}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Enter your prompt here..."
          placeholderTextColor={themeColors.textTertiary}
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Model Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
          Select Models ({selectedModels.length} selected)
        </Text>
        <View style={styles.modelGrid}>
          {models.map((model: any) => (
            <TouchableOpacity
              key={model.id}
              style={[
                styles.modelCard,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: selectedModels.includes(model.name)
                    ? themeColors.primary
                    : themeColors.border,
                  borderWidth: 2,
                },
              ]}
              onPress={() => toggleModelSelection(model.name)}>
              <Text style={[styles.modelName, { color: themeColors.text }]}>{model.name}</Text>
              {selectedModels.includes(model.name) && (
                <View style={[styles.selectedBadge, { backgroundColor: themeColors.primary }]}>
                  <Text style={styles.selectedText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Strategy Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Select Strategy</Text>
        {STRATEGIES.map((strategy) => (
          <TouchableOpacity
            key={strategy.id}
            style={[
              styles.strategyCard,
              {
                backgroundColor: themeColors.surface,
                borderColor:
                  selectedStrategy.id === strategy.id ? themeColors.primary : themeColors.border,
                borderWidth: 2,
              },
            ]}
            onPress={() => setSelectedStrategy(strategy)}>
            <Text style={styles.strategyIcon}>{strategy.icon}</Text>
            <View style={styles.strategyInfo}>
              <Text style={[styles.strategyName, { color: themeColors.text }]}>
                {strategy.name}
              </Text>
              <Text style={[styles.strategyDescription, { color: themeColors.textTertiary }]}>
                {strategy.description}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Strategy Config */}
      {selectedStrategy.id === 'voting' && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Voting Threshold (0-1)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: themeColors.surface,
                color: themeColors.text,
                borderColor: themeColors.border,
              },
            ]}
            value={votingThreshold}
            onChangeText={setVotingThreshold}
            keyboardType="numeric"
            placeholder="0.6"
            placeholderTextColor={themeColors.textTertiary}
          />
        </View>
      )}

      {selectedStrategy.id === 'weighted' && selectedModels.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Model Weights</Text>
          {selectedModels.map((model) => (
            <View key={model} style={styles.weightRow}>
              <Text style={[styles.weightLabel, { color: themeColors.text }]}>{model}:</Text>
              <TextInput
                style={[
                  styles.weightInput,
                  {
                    backgroundColor: themeColors.surface,
                    color: themeColors.text,
                    borderColor: themeColors.border,
                  },
                ]}
                value={weights[model] || '1.0'}
                onChangeText={(value) => setWeights({ ...weights, [model]: value })}
                keyboardType="numeric"
                placeholder="1.0"
                placeholderTextColor={themeColors.textTertiary}
              />
            </View>
          ))}
        </View>
      )}

      {/* Run Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: themeColors.primary },
            loading && styles.buttonDisabled,
          ]}
          onPress={handleRunEnsemble}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <PlayCircle color="#fff" size={20} />
              <Text style={styles.buttonText}>Run Ensemble</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderHistoryTab = () => (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {loading ? (
        <ActivityIndicator size="large" color={themeColors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={ensembleResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isExpanded = expandedResults.has(item.id);
            return (
              <TouchableOpacity
                style={[styles.historyCard, { backgroundColor: themeColors.surface }]}
                onPress={() => toggleResultExpansion(item.id)}>
                <View style={styles.historyHeader}>
                  <View style={styles.historyTitleRow}>
                    <Text style={[styles.historyStrategy, { color: themeColors.primary }]}>
                      {STRATEGIES.find((s) => s.id === item.strategy)?.icon || '🎯'}{' '}
                      {item.strategy}
                    </Text>
                    <Text style={[styles.historyModels, { color: themeColors.textSecondary }]}>
                      {item.models.length} models
                    </Text>
                  </View>
                  <Text
                    style={[styles.historyPrompt, { color: themeColors.text }]}
                    numberOfLines={isExpanded ? undefined : 2}>
                    {item.prompt}
                  </Text>
                </View>

                {isExpanded && (
                  <View style={styles.historyDetails}>
                    <View style={styles.detailRow}>
                      <Clock color={themeColors.textSecondary} size={16} />
                      <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
                        Duration: {(item.totalDuration / 1000).toFixed(1)}s
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Award color={themeColors.textSecondary} size={16} />
                      <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
                        Tokens: {item.totalTokens}
                      </Text>
                    </View>

                    <Text style={[styles.responseTitle, { color: themeColors.text }]}>
                      Combined Response:
                    </Text>
                    <Text style={[styles.responseText, { color: themeColors.textSecondary }]}>
                      {item.combinedResponse}
                    </Text>

                    <Text style={[styles.responseTitle, { color: themeColors.text }]}>
                      Individual Responses:
                    </Text>
                    {item.individualResponses.map((resp: any, idx: number) => (
                      <View
                        key={idx}
                        style={[
                          styles.individualResponse,
                          { backgroundColor: themeColors.background },
                        ]}>
                        <Text style={[styles.responseModel, { color: themeColors.primary }]}>
                          {resp.model}
                        </Text>
                        <Text
                          style={[styles.responseText, { color: themeColors.textSecondary }]}>
                          {resp.response}
                        </Text>
                        <Text style={[styles.responseMeta, { color: themeColors.textTertiary }]}>
                          {resp.tokensUsed} tokens • {(resp.duration / 1000).toFixed(1)}s
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={[styles.historyDate, { color: themeColors.textTertiary }]}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              No ensemble results yet. Run an ensemble to see results here.
            </Text>
          }
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      {/* Tab Navigation */}
      <View style={[styles.tabBar, { backgroundColor: themeColors.surface }]}>
        <TouchableOpacity
          style={[styles.tab, tab === 'run' && { borderBottomColor: themeColors.primary }]}
          onPress={() => setTab('run')}>
          <PlayCircle color={tab === 'run' ? themeColors.primary : themeColors.textSecondary} size={20} />
          <Text
            style={[
              styles.tabText,
              { color: tab === 'run' ? themeColors.primary : themeColors.textSecondary },
            ]}>
            Run
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'history' && { borderBottomColor: themeColors.primary }]}
          onPress={() => setTab('history')}>
          <Layers color={tab === 'history' ? themeColors.primary : themeColors.textSecondary} size={20} />
          <Text
            style={[
              styles.tabText,
              { color: tab === 'history' ? themeColors.primary : themeColors.textSecondary },
            ]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {tab === 'run' && renderRunTab()}
      {tab === 'history' && renderHistoryTab()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: spacing.xs,
  },
  tabText: {
    ...typography.body,
    fontWeight: '600',
  },
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  promptInput: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 100,
    ...typography.body,
  },
  modelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modelCard: {
    padding: spacing.md,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    position: 'relative',
  },
  modelName: {
    ...typography.body,
    fontWeight: '600',
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  strategyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  strategyIcon: {
    fontSize: 32,
  },
  strategyInfo: {
    flex: 1,
  },
  strategyName: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  strategyDescription: {
    ...typography.small,
  },
  input: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    ...typography.body,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  weightLabel: {
    ...typography.body,
    flex: 1,
  },
  weightInput: {
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    width: 80,
    ...typography.body,
  },
  buttonContainer: {
    padding: spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: 8,
    gap: spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    ...typography.body,
    fontWeight: '600',
  },
  loader: {
    marginTop: spacing.xl,
  },
  historyCard: {
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: 8,
  },
  historyHeader: {
    marginBottom: spacing.sm,
  },
  historyTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  historyStrategy: {
    ...typography.body,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  historyModels: {
    ...typography.small,
  },
  historyPrompt: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  historyDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  detailText: {
    ...typography.small,
  },
  responseTitle: {
    ...typography.body,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  responseText: {
    ...typography.small,
    marginBottom: spacing.sm,
  },
  individualResponse: {
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  responseModel: {
    ...typography.small,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  responseMeta: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  historyDate: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
});
