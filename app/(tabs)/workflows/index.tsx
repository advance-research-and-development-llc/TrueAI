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
} from 'react-native';
import { GitBranch, PlayCircle, Eye, Trash2 } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { colors, spacing, typography } from '@/lib/theme';
import { getInferenceEngine } from '@/lib/inference';
import { getAdvancedAgentWorkflowService } from '@/lib/advanced-agent-workflow';

export default function WorkflowsScreen() {
  const theme = useAppStore((state) => state.theme);
  const themeColors = colors[theme];
  const ollamaUrl = useAppStore((state) => state.ollamaUrl);
  const userId = useAppStore((state) => state.userId);

  const [tab, setTab] = useState<'workflows' | 'executions'>('workflows');
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);

  const inferenceEngine = getInferenceEngine(ollamaUrl);
  const workflowService = getAdvancedAgentWorkflowService();

  useEffect(() => {
    if (userId) {
      if (tab === 'workflows') {
        loadWorkflows();
      } else if (tab === 'executions' && selectedWorkflow) {
        loadExecutions(selectedWorkflow.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId]);

  const loadWorkflows = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const wfs = await workflowService.getUserWorkflows(userId);
      setWorkflows(wfs);
      if (wfs.length > 0 && !selectedWorkflow) {
        setSelectedWorkflow(wfs[0]);
      }
    } catch (error) {
      console.error('Error loading workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExecutions = async (workflowId: string) => {
    setLoading(true);
    try {
      const execs = await workflowService.getWorkflowExecutions(workflowId, 20);
      setExecutions(execs);
    } catch (error) {
      console.error('Error loading executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteWorkflow = async (workflow: any) => {
    Alert.prompt(
      'Execute Workflow',
      `Enter input for "${workflow.name}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Execute',
          onPress: async (input: any) => {
            setLoading(true);
            try {
              const result = await workflowService.executeWorkflow(
                workflow.id,
                input || '',
                inferenceEngine
              );

              Alert.alert(
                'Workflow Complete',
                `Status: ${result.status}\nDuration: ${(result.duration / 1000).toFixed(1)}s`,
                [{ text: 'View Executions', onPress: () => setTab('executions') }, { text: 'OK' }]
              );

              if (tab === 'executions') {
                loadExecutions(workflow.id);
              }
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to execute workflow');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      'plain-text',
      ''
    );
  };

  const handleDeleteWorkflow = async (workflowId: string, workflowName: string) => {
    Alert.alert('Delete Workflow', `Are you sure you want to delete "${workflowName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await workflowService.deleteWorkflow(workflowId);
            loadWorkflows();
          } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete workflow');
          }
        },
      },
    ]);
  };

  const renderWorkflowsTab = () => (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {loading ? (
        <ActivityIndicator size="large" color={themeColors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={workflows}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.workflowCard, { backgroundColor: themeColors.surface }]}>
              <View style={styles.workflowHeader}>
                <GitBranch color={themeColors.primary} size={24} />
                <View style={styles.workflowInfo}>
                  <Text style={[styles.workflowName, { color: themeColors.text }]}>{item.name}</Text>
                  {item.description && (
                    <Text style={[styles.workflowDescription, { color: themeColors.textSecondary }]}>
                      {item.description}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.workflowMeta}>
                <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                  {item.steps.length} steps
                </Text>
                <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                  Start: {item.startStep}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: item.enabled ? themeColors.success : themeColors.textTertiary },
                  ]}>
                  <Text style={styles.statusText}>{item.enabled ? 'Enabled' : 'Disabled'}</Text>
                </View>
              </View>

              <View style={styles.workflowActions}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: themeColors.primary }]}
                  onPress={() => handleExecuteWorkflow(item)}
                  disabled={loading}>
                  <PlayCircle color="#fff" size={16} />
                  <Text style={styles.actionText}>Execute</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: themeColors.accent }]}
                  onPress={() => {
                    setSelectedWorkflow(item);
                    setTab('executions');
                  }}>
                  <Eye color="#fff" size={16} />
                  <Text style={styles.actionText}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: themeColors.error }]}
                  onPress={() => handleDeleteWorkflow(item.id, item.name)}>
                  <Trash2 color="#fff" size={16} />
                  <Text style={styles.actionText}>Delete</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.workflowDate, { color: themeColors.textTertiary }]}>
                Created: {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              No workflows created yet. Workflows must be created programmatically.
            </Text>
          }
        />
      )}
    </View>
  );

  const renderExecutionsTab = () => (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {!selectedWorkflow ? (
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
          Select a workflow to view its executions.
        </Text>
      ) : (
        <>
          <View style={[styles.executionHeader, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.executionTitle, { color: themeColors.text }]}>
              Executions for: {selectedWorkflow.name}
            </Text>
            <TouchableOpacity
              style={[styles.refreshButton, { backgroundColor: themeColors.primary }]}
              onPress={() => loadExecutions(selectedWorkflow.id)}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.refreshText}>Refresh</Text>
              )}
            </TouchableOpacity>
          </View>

          {loading && executions.length === 0 ? (
            <ActivityIndicator size="large" color={themeColors.primary} style={styles.loader} />
          ) : (
            <FlatList
              data={executions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isExpanded = expandedExecution === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.executionCard, { backgroundColor: themeColors.surface }]}
                    onPress={() => setExpandedExecution(isExpanded ? null : item.id)}>
                    <View style={styles.executionCardHeader}>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              item.status === 'completed'
                                ? themeColors.success
                                : item.status === 'failed'
                                ? themeColors.error
                                : themeColors.warning,
                          },
                        ]}>
                        <Text style={styles.statusText}>{item.status}</Text>
                      </View>
                      <Text style={[styles.executionTime, { color: themeColors.textSecondary }]}>
                        {new Date(item.started_at).toLocaleString()}
                      </Text>
                    </View>

                    <View style={styles.executionStats}>
                      <Text style={[styles.statText, { color: themeColors.textSecondary }]}>
                        Duration: {(item.duration / 1000).toFixed(1)}s
                      </Text>
                      <Text style={[styles.statText, { color: themeColors.textSecondary }]}>
                        Current Step: {item.currentStep || 'N/A'}
                      </Text>
                      <Text style={[styles.statText, { color: themeColors.textSecondary }]}>
                        Steps: {Object.keys(item.stepResults || {}).length}
                      </Text>
                    </View>

                    {isExpanded && (
                      <View style={styles.executionDetails}>
                        {item.input && (
                          <>
                            <Text style={[styles.detailTitle, { color: themeColors.text }]}>Input:</Text>
                            <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
                              {typeof item.input === 'string' ? item.input : JSON.stringify(item.input)}
                            </Text>
                          </>
                        )}

                        {item.output && (
                          <>
                            <Text style={[styles.detailTitle, { color: themeColors.text }]}>Output:</Text>
                            <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
                              {typeof item.output === 'string' ? item.output : JSON.stringify(item.output)}
                            </Text>
                          </>
                        )}

                        {item.error && (
                          <>
                            <Text style={[styles.detailTitle, { color: themeColors.error }]}>Error:</Text>
                            <Text style={[styles.errorText, { color: themeColors.error }]}>
                              {item.error}
                            </Text>
                          </>
                        )}

                        {item.stepResults && Object.keys(item.stepResults).length > 0 && (
                          <>
                            <Text style={[styles.detailTitle, { color: themeColors.text }]}>
                              Step Results:
                            </Text>
                            {Object.entries(item.stepResults).map(([stepId, result]: [string, any]) => (
                              <View
                                key={stepId}
                                style={[
                                  styles.stepResult,
                                  { backgroundColor: themeColors.background },
                                ]}>
                                <Text style={[styles.stepId, { color: themeColors.primary }]}>
                                  {stepId}
                                </Text>
                                <Text
                                  style={[styles.stepOutput, { color: themeColors.textSecondary }]}
                                  numberOfLines={2}>
                                  {typeof result === 'string' ? result : JSON.stringify(result)}
                                </Text>
                              </View>
                            ))}
                          </>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                  No executions for this workflow yet.
                </Text>
              }
            />
          )}
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      {/* Tab Navigation */}
      <View style={[styles.tabBar, { backgroundColor: themeColors.surface }]}>
        <TouchableOpacity
          style={[styles.tab, tab === 'workflows' && { borderBottomColor: themeColors.primary }]}
          onPress={() => setTab('workflows')}>
          <GitBranch
            color={tab === 'workflows' ? themeColors.primary : themeColors.textSecondary}
            size={20}
          />
          <Text
            style={[
              styles.tabText,
              { color: tab === 'workflows' ? themeColors.primary : themeColors.textSecondary },
            ]}>
            Workflows
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'executions' && { borderBottomColor: themeColors.primary }]}
          onPress={() => setTab('executions')}>
          <PlayCircle
            color={tab === 'executions' ? themeColors.primary : themeColors.textSecondary}
            size={20}
          />
          <Text
            style={[
              styles.tabText,
              { color: tab === 'executions' ? themeColors.primary : themeColors.textSecondary },
            ]}>
            Executions
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {tab === 'workflows' && renderWorkflowsTab()}
      {tab === 'executions' && renderExecutionsTab()}
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
  loader: {
    marginTop: spacing.xl,
  },
  workflowCard: {
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: 8,
  },
  workflowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  workflowInfo: {
    flex: 1,
  },
  workflowName: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  workflowDescription: {
    ...typography.small,
  },
  workflowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  metaText: {
    ...typography.small,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  workflowActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    borderRadius: 8,
    gap: spacing.xs,
  },
  actionText: {
    color: '#fff',
    ...typography.small,
    fontWeight: '600',
  },
  workflowDate: {
    ...typography.caption,
  },
  executionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  executionTitle: {
    ...typography.h4,
    flex: 1,
  },
  refreshButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  refreshText: {
    color: '#fff',
    ...typography.small,
    fontWeight: '600',
  },
  executionCard: {
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: 8,
  },
  executionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  executionTime: {
    ...typography.small,
  },
  executionStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  statText: {
    ...typography.small,
  },
  executionDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  detailTitle: {
    ...typography.body,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  detailText: {
    ...typography.small,
  },
  errorText: {
    ...typography.small,
  },
  stepResult: {
    padding: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.xs,
  },
  stepId: {
    ...typography.small,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  stepOutput: {
    ...typography.small,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
});
