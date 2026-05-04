/**
 * Analytics Tab
 *
 * Provides comprehensive analytics and insights for the TrueAI platform.
 * Shows usage statistics, model performance, agent analytics, and workflow metrics.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-chart-kit';
import { TrendingUp, Activity, Zap, GitBranch, Target, Layers } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { colors } from '@/lib/theme';
import { getAnalyticsService } from '@/lib/analytics';
import type {
  OverviewMetrics,
  ModelAnalytics,
  AgentAnalytics,
  WorkflowAnalytics,
} from '@/lib/analytics';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const theme = useAppStore((state: any) => state.theme);
  const user = useAppStore((state: any) => state.user);
  const themeColors = colors[theme as 'light' | 'dark'];

  const [tab, setTab] = useState<'overview' | 'models' | 'agents' | 'workflows'>('overview');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Analytics data
  const [overviewMetrics, setOverviewMetrics] = useState<OverviewMetrics | null>(null);
  const [modelAnalytics, setModelAnalytics] = useState<ModelAnalytics[]>([]);
  const [agentAnalytics, setAgentAnalytics] = useState<AgentAnalytics[]>([]);
  const [workflowAnalytics, setWorkflowAnalytics] = useState<WorkflowAnalytics[]>([]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    header: {
      padding: 20,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: themeColors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: themeColors.textSecondary,
    },
    tabs: {
      flexDirection: 'row',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    tab: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginHorizontal: 4,
    },
    tabActive: {
      backgroundColor: themeColors.primary,
    },
    tabInactive: {
      backgroundColor: themeColors.surface,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
      marginTop: 4,
    },
    tabTextActive: {
      color: '#FFFFFF',
    },
    tabTextInactive: {
      color: themeColors.textSecondary,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: themeColors.text,
      marginTop: 20,
      marginBottom: 12,
    },
    card: {
      backgroundColor: themeColors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: themeColors.textSecondary,
      marginBottom: 8,
    },
    metricRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    metricLabel: {
      fontSize: 14,
      color: themeColors.textSecondary,
    },
    metricValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: themeColors.text,
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -6,
    },
    statCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: themeColors.surface,
      borderRadius: 12,
      padding: 16,
      margin: 6,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    statIcon: {
      marginBottom: 8,
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: themeColors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: themeColors.textSecondary,
    },
    listItem: {
      backgroundColor: themeColors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    listItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    listItemTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: themeColors.text,
      flex: 1,
    },
    listItemBadge: {
      backgroundColor: themeColors.primary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      marginLeft: 8,
    },
    listItemBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    listItemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    listItemLabel: {
      fontSize: 13,
      color: themeColors.textSecondary,
    },
    listItemValue: {
      fontSize: 13,
      fontWeight: '600',
      color: themeColors.text,
    },
    progressBar: {
      height: 6,
      backgroundColor: themeColors.border,
      borderRadius: 3,
      marginTop: 8,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: themeColors.primary,
    },
    chartContainer: {
      alignItems: 'center',
      marginVertical: 12,
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
    },
    emptyStateText: {
      fontSize: 16,
      color: themeColors.textSecondary,
      textAlign: 'center',
    },
  });

  // Load analytics data
  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user]);

  const loadAnalytics = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const analytics = getAnalyticsService();

      if (tab === 'overview') {
        const metrics = await analytics.getOverviewMetrics(user.id);
        setOverviewMetrics(metrics);
      } else if (tab === 'models') {
        const models = await analytics.getModelAnalytics(user.id, 20);
        setModelAnalytics(models);
      } else if (tab === 'agents') {
        const agents = await analytics.getAgentAnalytics(user.id, 20);
        setAgentAnalytics(agents);
      } else if (tab === 'workflows') {
        const workflows = await analytics.getWorkflowAnalytics(user.id, 20);
        setWorkflowAnalytics(workflows);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  const chartConfig = {
    backgroundColor: themeColors.surface,
    backgroundGradientFrom: themeColors.surface,
    backgroundGradientTo: themeColors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
    labelColor: (opacity = 1) => themeColors.textSecondary,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: themeColors.primary,
    },
  };

  const renderOverviewTab = () => {
    if (!overviewMetrics) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No analytics data available yet</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />
        }>
        <Text style={styles.sectionTitle}>Today&apos;s Activity</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Activity size={24} color={themeColors.primary} style={styles.statIcon} />
            <Text style={styles.statValue}>{overviewMetrics.today.messages}</Text>
            <Text style={styles.statLabel}>Messages</Text>
          </View>
          <View style={styles.statCard}>
            <Zap size={24} color={themeColors.primary} style={styles.statIcon} />
            <Text style={styles.statValue}>{overviewMetrics.today.agent_runs}</Text>
            <Text style={styles.statLabel}>Agent Runs</Text>
          </View>
          <View style={styles.statCard}>
            <GitBranch size={24} color={themeColors.primary} style={styles.statIcon} />
            <Text style={styles.statValue}>{overviewMetrics.today.workflows}</Text>
            <Text style={styles.statLabel}>Workflows</Text>
          </View>
          <View style={styles.statCard}>
            <Layers size={24} color={themeColors.primary} style={styles.statIcon} />
            <Text style={styles.statValue}>{overviewMetrics.today.ensembles}</Text>
            <Text style={styles.statLabel}>Ensembles</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>This Week</Text>
        <View style={styles.card}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Total Messages</Text>
            <Text style={styles.metricValue}>{overviewMetrics.week.messages}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Agent Runs</Text>
            <Text style={styles.metricValue}>{overviewMetrics.week.agent_runs}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Workflow Executions</Text>
            <Text style={styles.metricValue}>{overviewMetrics.week.workflows}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Ensemble Runs</Text>
            <Text style={styles.metricValue}>{overviewMetrics.week.ensembles}</Text>
          </View>
        </View>

        {overviewMetrics.mostUsedModel && (
          <>
            <Text style={styles.sectionTitle}>Most Used Model</Text>
            <View style={styles.card}>
              <Text style={[styles.metricValue, { marginBottom: 4 }]}>
                {overviewMetrics.mostUsedModel.name}
              </Text>
              <Text style={styles.metricLabel}>
                {overviewMetrics.mostUsedModel.count} times this month
              </Text>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Success Rates</Text>
        <View style={styles.card}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Agents</Text>
            <Text style={styles.metricValue}>
              {overviewMetrics.successRates.agents?.toFixed(1) || '—'}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${overviewMetrics.successRates.agents || 0}%` },
              ]}
            />
          </View>
          <View style={[styles.metricRow, { marginTop: 16 }]}>
            <Text style={styles.metricLabel}>Workflows</Text>
            <Text style={styles.metricValue}>
              {overviewMetrics.successRates.workflows?.toFixed(1) || '—'}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${overviewMetrics.successRates.workflows || 0}%` },
              ]}
            />
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderModelsTab = () => {
    if (modelAnalytics.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No model usage data yet</Text>
        </View>
      );
    }

    const topModels = modelAnalytics.slice(0, 5);
    const chartData = {
      labels: topModels.map(m => m.model_name.split('/').pop()?.substring(0, 10) || ''),
      datasets: [
        {
          data: topModels.map(m => m.usage_count),
        },
      ],
    };

    return (
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />
        }>
        <Text style={styles.sectionTitle}>Top Models Usage</Text>
        <View style={styles.chartContainer}>
          <BarChart
            data={chartData}
            width={SCREEN_WIDTH - 40}
            height={220}
            chartConfig={chartConfig}
            style={{ borderRadius: 16 }}
            yAxisLabel=""
            yAxisSuffix=""
            fromZero
          />
        </View>

        <Text style={styles.sectionTitle}>Model Details</Text>
        {modelAnalytics.map((model, index) => (
          <View key={index} style={styles.listItem}>
            <View style={styles.listItemHeader}>
              <Text style={styles.listItemTitle}>{model.model_name}</Text>
              <View style={styles.listItemBadge}>
                <Text style={styles.listItemBadgeText}>{model.usage_count}x</Text>
              </View>
            </View>
            <View style={styles.listItemRow}>
              <Text style={styles.listItemLabel}>Total Tokens</Text>
              <Text style={styles.listItemValue}>
                {model.total_tokens.toLocaleString()}
              </Text>
            </View>
            {model.last_used && (
              <View style={styles.listItemRow}>
                <Text style={styles.listItemLabel}>Last Used</Text>
                <Text style={styles.listItemValue}>
                  {new Date(model.last_used).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderAgentsTab = () => {
    if (agentAnalytics.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No agent execution data yet</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />
        }>
        <Text style={styles.sectionTitle}>Agent Performance</Text>
        {agentAnalytics.map((agent, index) => (
          <View key={index} style={styles.listItem}>
            <View style={styles.listItemHeader}>
              <Text style={styles.listItemTitle}>{agent.agent_name}</Text>
              <View style={styles.listItemBadge}>
                <Text style={styles.listItemBadgeText}>{agent.total_runs} runs</Text>
              </View>
            </View>
            <View style={styles.listItemRow}>
              <Text style={styles.listItemLabel}>Success Rate</Text>
              <Text style={[styles.listItemValue, { color: agent.success_rate > 80 ? '#4CAF50' : themeColors.text }]}>
                {agent.success_rate.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${agent.success_rate}%` }]}
              />
            </View>
            {agent.avg_steps && (
              <View style={styles.listItemRow}>
                <Text style={styles.listItemLabel}>Avg Steps</Text>
                <Text style={styles.listItemValue}>{agent.avg_steps.toFixed(1)}</Text>
              </View>
            )}
            {agent.avg_duration_ms && (
              <View style={styles.listItemRow}>
                <Text style={styles.listItemLabel}>Avg Duration</Text>
                <Text style={styles.listItemValue}>
                  {(agent.avg_duration_ms / 1000).toFixed(1)}s
                </Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderWorkflowsTab = () => {
    if (workflowAnalytics.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No workflow execution data yet</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />
        }>
        <Text style={styles.sectionTitle}>Workflow Performance</Text>
        {workflowAnalytics.map((workflow, index) => (
          <View key={index} style={styles.listItem}>
            <View style={styles.listItemHeader}>
              <Text style={styles.listItemTitle}>{workflow.workflow_name}</Text>
              <View style={styles.listItemBadge}>
                <Text style={styles.listItemBadgeText}>{workflow.total_executions} runs</Text>
              </View>
            </View>
            <View style={styles.listItemRow}>
              <Text style={styles.listItemLabel}>Success Rate</Text>
              <Text style={[styles.listItemValue, { color: workflow.success_rate > 80 ? '#4CAF50' : themeColors.text }]}>
                {workflow.success_rate.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${workflow.success_rate}%` }]}
              />
            </View>
            {workflow.avg_duration_ms && (
              <View style={styles.listItemRow}>
                <Text style={styles.listItemLabel}>Avg Duration</Text>
                <Text style={styles.listItemValue}>
                  {(workflow.avg_duration_ms / 1000).toFixed(1)}s
                </Text>
              </View>
            )}
            <View style={styles.listItemRow}>
              <Text style={styles.listItemLabel}>Success / Failed</Text>
              <Text style={styles.listItemValue}>
                {workflow.success_count} / {workflow.failure_count}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyStateText}>Please sign in to view analytics</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>Track your AI usage and performance</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'overview' ? styles.tabActive : styles.tabInactive]}
          onPress={() => setTab('overview')}>
          <TrendingUp size={20} color={tab === 'overview' ? '#FFFFFF' : themeColors.textSecondary} />
          <Text style={[styles.tabText, tab === 'overview' ? styles.tabTextActive : styles.tabTextInactive]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'models' ? styles.tabActive : styles.tabInactive]}
          onPress={() => setTab('models')}>
          <Target size={20} color={tab === 'models' ? '#FFFFFF' : themeColors.textSecondary} />
          <Text style={[styles.tabText, tab === 'models' ? styles.tabTextActive : styles.tabTextInactive]}>
            Models
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'agents' ? styles.tabActive : styles.tabInactive]}
          onPress={() => setTab('agents')}>
          <Zap size={20} color={tab === 'agents' ? '#FFFFFF' : themeColors.textSecondary} />
          <Text style={[styles.tabText, tab === 'agents' ? styles.tabTextActive : styles.tabTextInactive]}>
            Agents
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'workflows' ? styles.tabActive : styles.tabInactive]}
          onPress={() => setTab('workflows')}>
          <GitBranch size={20} color={tab === 'workflows' ? '#FFFFFF' : themeColors.textSecondary} />
          <Text style={[styles.tabText, tab === 'workflows' ? styles.tabTextActive : styles.tabTextInactive]}>
            Workflows
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : (
        <>
          {tab === 'overview' && renderOverviewTab()}
          {tab === 'models' && renderModelsTab()}
          {tab === 'agents' && renderAgentsTab()}
          {tab === 'workflows' && renderWorkflowsTab()}
        </>
      )}
    </SafeAreaView>
  );
}
