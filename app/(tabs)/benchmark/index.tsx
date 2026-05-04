import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Text,
  ScrollView,
} from 'react-native';
import { Target, PlayCircle, BarChart3, TrendingUp } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { colors, spacing, typography } from '@/lib/theme';
import { getInferenceEngine } from '@/lib/inference';
import { getModelComparisonService, BENCHMARK_TASKS } from '@/lib/model-comparison';

export default function BenchmarkScreen() {
  const theme = useAppStore((state) => state.theme);
  const themeColors = colors[theme];
  const ollamaUrl = useAppStore((state) => state.ollamaUrl);
  const userId = useAppStore((state) => state.userId);
  const models = useAppStore((state) => state.models);

  const [tab, setTab] = useState<'run' | 'results' | 'stats'>('run');
  const [loading, setLoading] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedTask, setSelectedTask] = useState(BENCHMARK_TASKS[0]);
  const [comparisonResults, setComparisonResults] = useState<any[]>([]);
  const [modelStats, setModelStats] = useState<any[]>([]);

  const inferenceEngine = getInferenceEngine(ollamaUrl);
  const comparisonService = getModelComparisonService();

  useEffect(() => {
    if (tab === 'results' && userId) {
      loadComparisonResults();
    } else if (tab === 'stats' && userId) {
      loadModelStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId]);

  const loadComparisonResults = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const results = await comparisonService.getComparisons(userId, 10);
      setComparisonResults(results);
    } catch (error) {
      console.error('Error loading comparison results:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadModelStats = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const uniqueModels = [...new Set(models.map((m: any) => m.name))];
      const statsPromises = uniqueModels.map((modelName: string) =>
        comparisonService.getModelPerformanceStats(modelName, userId)
      );
      const stats = await Promise.all(statsPromises);
      setModelStats(stats.filter((s) => s !== null));
    } catch (error) {
      console.error('Error loading model stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleModelSelection = (modelName: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelName) ? prev.filter((m) => m !== modelName) : [...prev, modelName]
    );
  };

  const handleRunBenchmark = async () => {
    if (selectedModels.length === 0) {
      Alert.alert('Error', 'Please select at least one model');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    setLoading(true);
    try {
      const result = await comparisonService.compareModels(
        selectedModels,
        selectedTask,
        inferenceEngine,
        userId
      );

      Alert.alert(
        'Benchmark Complete',
        `Winner: ${result.winner}\n\n${result.summary.substring(0, 200)}...`,
        [{ text: 'View Results', onPress: () => setTab('results') }, { text: 'OK' }]
      );

      loadComparisonResults();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to run benchmark');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunFullSuite = async () => {
    if (selectedModels.length === 0) {
      Alert.alert('Error', 'Please select at least one model');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    Alert.alert(
      'Run Full Benchmark Suite',
      `This will run ${BENCHMARK_TASKS.length} tasks on ${selectedModels.length} model(s). This may take several minutes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run',
          onPress: async () => {
            setLoading(true);
            try {
              const results = await comparisonService.runFullBenchmarkSuite(
                selectedModels,
                inferenceEngine,
                userId
              );

              Alert.alert(
                'Full Suite Complete',
                `Completed ${results.length} benchmark comparisons`,
                [{ text: 'View Results', onPress: () => setTab('results') }, { text: 'OK' }]
              );

              loadComparisonResults();
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to run suite');
              console.error(error);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderRunTab = () => (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Model Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Select Models to Compare</Text>
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
                <View
                  style={[styles.selectedBadge, { backgroundColor: themeColors.primary }]}>
                  <Text style={styles.selectedText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Task Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Select Benchmark Task</Text>
        {BENCHMARK_TASKS.map((task) => (
          <TouchableOpacity
            key={task.id}
            style={[
              styles.taskCard,
              {
                backgroundColor: themeColors.surface,
                borderColor:
                  selectedTask.id === task.id ? themeColors.primary : themeColors.border,
                borderWidth: 2,
              },
            ]}
            onPress={() => setSelectedTask(task)}>
            <Text style={[styles.taskName, { color: themeColors.text }]}>{task.name}</Text>
            <Text style={[styles.taskCategory, { color: themeColors.textSecondary }]}>
              {task.category}
            </Text>
            <Text style={[styles.taskDescription, { color: themeColors.textTertiary }]}>
              {task.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: themeColors.primary },
            loading && styles.buttonDisabled,
          ]}
          onPress={handleRunBenchmark}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <PlayCircle color="#fff" size={20} />
              <Text style={styles.buttonText}>Run Benchmark</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: themeColors.accent },
            loading && styles.buttonDisabled,
          ]}
          onPress={handleRunFullSuite}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Target color="#fff" size={20} />
              <Text style={styles.buttonText}>Run Full Suite</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderResultsTab = () => (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {loading ? (
        <ActivityIndicator size="large" color={themeColors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={comparisonResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.resultCard, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.resultTitle, { color: themeColors.text }]}>
                {item.task.name}
              </Text>
              <Text style={[styles.resultWinner, { color: themeColors.success }]}>
                Winner: {item.winner}
              </Text>
              <Text style={[styles.resultModels, { color: themeColors.textSecondary }]}>
                Models: {item.models.join(', ')}
              </Text>
              <Text
                style={[styles.resultSummary, { color: themeColors.textTertiary }]}
                numberOfLines={3}>
                {item.summary}
              </Text>
              <Text style={[styles.resultDate, { color: themeColors.textTertiary }]}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              No benchmark results yet. Run a benchmark to see results here.
            </Text>
          }
        />
      )}
    </View>
  );

  const renderStatsTab = () => (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {loading ? (
        <ActivityIndicator size="large" color={themeColors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={modelStats}
          keyExtractor={(item) => item.model}
          renderItem={({ item }) => (
            <View style={[styles.statsCard, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.statsModel, { color: themeColors.text }]}>{item.model}</Text>
              <View style={styles.statsRow}>
                <Text style={[styles.statsLabel, { color: themeColors.textSecondary }]}>
                  Avg Score:
                </Text>
                <Text style={[styles.statsValue, { color: themeColors.primary }]}>
                  {item.averageScore.toFixed(1)}/100
                </Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={[styles.statsLabel, { color: themeColors.textSecondary }]}>
                  Avg Speed:
                </Text>
                <Text style={[styles.statsValue, { color: themeColors.primary }]}>
                  {item.averageTokensPerSecond.toFixed(1)} t/s
                </Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={[styles.statsLabel, { color: themeColors.textSecondary }]}>
                  Total Runs:
                </Text>
                <Text style={[styles.statsValue, { color: themeColors.text }]}>
                  {item.totalRuns}
                </Text>
              </View>
              {item.strengthCategories.length > 0 && (
                <View style={styles.categoryContainer}>
                  <Text style={[styles.categoryTitle, { color: themeColors.success }]}>
                    Strengths:
                  </Text>
                  <Text style={[styles.categoryText, { color: themeColors.textSecondary }]}>
                    {item.strengthCategories.join(', ')}
                  </Text>
                </View>
              )}
              {item.weaknessCategories.length > 0 && (
                <View style={styles.categoryContainer}>
                  <Text style={[styles.categoryTitle, { color: themeColors.warning }]}>
                    Weaknesses:
                  </Text>
                  <Text style={[styles.categoryText, { color: themeColors.textSecondary }]}>
                    {item.weaknessCategories.join(', ')}
                  </Text>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              No statistics available. Run benchmarks to build performance stats.
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
          style={[styles.tab, tab === 'results' && { borderBottomColor: themeColors.primary }]}
          onPress={() => setTab('results')}>
          <BarChart3 color={tab === 'results' ? themeColors.primary : themeColors.textSecondary} size={20} />
          <Text
            style={[
              styles.tabText,
              { color: tab === 'results' ? themeColors.primary : themeColors.textSecondary },
            ]}>
            Results
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'stats' && { borderBottomColor: themeColors.primary }]}
          onPress={() => setTab('stats')}>
          <TrendingUp color={tab === 'stats' ? themeColors.primary : themeColors.textSecondary} size={20} />
          <Text
            style={[
              styles.tabText,
              { color: tab === 'stats' ? themeColors.primary : themeColors.textSecondary },
            ]}>
            Stats
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {tab === 'run' && renderRunTab()}
      {tab === 'results' && renderResultsTab()}
      {tab === 'stats' && renderStatsTab()}
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
  taskCard: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  taskName: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  taskCategory: {
    ...typography.caption,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  taskDescription: {
    ...typography.small,
  },
  buttonContainer: {
    padding: spacing.md,
    gap: spacing.sm,
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
  resultCard: {
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: 8,
  },
  resultTitle: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  resultWinner: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  resultModels: {
    ...typography.small,
    marginBottom: spacing.xs,
  },
  resultSummary: {
    ...typography.small,
    marginBottom: spacing.xs,
  },
  resultDate: {
    ...typography.caption,
  },
  statsCard: {
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: 8,
  },
  statsModel: {
    ...typography.h4,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statsLabel: {
    ...typography.body,
  },
  statsValue: {
    ...typography.body,
    fontWeight: '600',
  },
  categoryContainer: {
    marginTop: spacing.sm,
  },
  categoryTitle: {
    ...typography.small,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  categoryText: {
    ...typography.small,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
});
