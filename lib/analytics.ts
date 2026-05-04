/**
 * Analytics Service
 *
 * Provides analytics and statistics aggregation for the TrueAI platform.
 * Calculates metrics for messages, agents, workflows, ensembles, and benchmarks.
 */

import { supabase } from './supabase';

export interface AnalyticsSnapshot {
  id: string;
  user_id: string;
  snapshot_type: 'daily' | 'weekly' | 'monthly';
  snapshot_date: string;

  // Message statistics
  total_messages: number;
  total_tokens: number;
  avg_response_time_ms: number | null;

  // Model usage
  model_usage: Record<string, number>;
  most_used_model: string | null;

  // Agent statistics
  total_agent_runs: number;
  agent_success_rate: number | null;
  avg_agent_steps: number | null;

  // Workflow statistics
  total_workflow_executions: number;
  workflow_success_rate: number | null;
  avg_workflow_duration_ms: number | null;

  // Ensemble statistics
  total_ensemble_runs: number;
  ensemble_strategy_usage: Record<string, number>;

  // Benchmark statistics
  total_benchmarks: number;
  benchmark_completion_rate: number | null;

  created_at: string;
}

export interface OverviewMetrics {
  today: {
    messages: number;
    agent_runs: number;
    workflows: number;
    ensembles: number;
  };
  week: {
    messages: number;
    agent_runs: number;
    workflows: number;
    ensembles: number;
  };
  month: {
    messages: number;
    agent_runs: number;
    workflows: number;
    ensembles: number;
  };
  mostUsedModel: {
    name: string;
    count: number;
  } | null;
  avgResponseTime: number | null;
  successRates: {
    agents: number | null;
    workflows: number | null;
  };
}

export interface ModelAnalytics {
  model_name: string;
  usage_count: number;
  avg_response_time_ms: number | null;
  total_tokens: number;
  success_rate: number | null;
  last_used: string | null;
}

export interface AgentAnalytics {
  agent_id: string;
  agent_name: string;
  total_runs: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  avg_steps: number | null;
  avg_duration_ms: number | null;
  last_run: string | null;
}

export interface WorkflowAnalytics {
  workflow_id: string;
  workflow_name: string;
  total_executions: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  avg_duration_ms: number | null;
  avg_steps: number | null;
  last_execution: string | null;
}

class AnalyticsService {
  /**
   * Get overview metrics for dashboard
   */
  async getOverviewMetrics(userId: string): Promise<OverviewMetrics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get message counts
    const { count: todayMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString());

    const { count: weekMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', weekAgo.toISOString());

    const { count: monthMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', monthAgo.toISOString());

    // Get agent run counts
    const { count: todayRuns } = await supabase
      .from('agent_runs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString());

    const { count: weekRuns } = await supabase
      .from('agent_runs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', weekAgo.toISOString());

    const { count: monthRuns } = await supabase
      .from('agent_runs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', monthAgo.toISOString());

    // Get workflow execution counts
    const { count: todayWorkflows } = await supabase
      .from('workflow_executions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('started_at', today.toISOString());

    const { count: weekWorkflows } = await supabase
      .from('workflow_executions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('started_at', weekAgo.toISOString());

    const { count: monthWorkflows } = await supabase
      .from('workflow_executions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('started_at', monthAgo.toISOString());

    // Get ensemble run counts
    const { count: todayEnsembles } = await supabase
      .from('ensemble_results')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString());

    const { count: weekEnsembles } = await supabase
      .from('ensemble_results')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', weekAgo.toISOString());

    const { count: monthEnsembles } = await supabase
      .from('ensemble_results')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', monthAgo.toISOString());

    // Get most used model
    const { data: messages } = await supabase
      .from('messages')
      .select('model')
      .eq('user_id', userId)
      .eq('role', 'assistant')
      .not('model', 'is', null)
      .gte('created_at', monthAgo.toISOString());

    let mostUsedModel: { name: string; count: number } | null = null;
    if (messages && messages.length > 0) {
      const modelCounts: Record<string, number> = {};
      messages.forEach(msg => {
        if (msg.model) {
          modelCounts[msg.model] = (modelCounts[msg.model] || 0) + 1;
        }
      });
      const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0];
      if (topModel) {
        mostUsedModel = { name: topModel[0], count: topModel[1] };
      }
    }

    // Calculate success rates
    const { data: agentRuns } = await supabase
      .from('agent_runs')
      .select('status')
      .eq('user_id', userId)
      .gte('created_at', monthAgo.toISOString());

    let agentSuccessRate: number | null = null;
    if (agentRuns && agentRuns.length > 0) {
      const successful = agentRuns.filter(r => r.status === 'completed').length;
      agentSuccessRate = (successful / agentRuns.length) * 100;
    }

    const { data: workflowExecs } = await supabase
      .from('workflow_executions')
      .select('status')
      .eq('user_id', userId)
      .gte('started_at', monthAgo.toISOString());

    let workflowSuccessRate: number | null = null;
    if (workflowExecs && workflowExecs.length > 0) {
      const successful = workflowExecs.filter(w => w.status === 'completed').length;
      workflowSuccessRate = (successful / workflowExecs.length) * 100;
    }

    // Calculate average response time from message timestamps
    let avgResponseTime: number | null = null;
    const { data: conversationMessages } = await supabase
      .from('messages')
      .select('role, created_at, conversation_id')
      .eq('user_id', userId)
      .gte('created_at', monthAgo.toISOString())
      .order('conversation_id', { ascending: true })
      .order('created_at', { ascending: true });

    if (conversationMessages && conversationMessages.length > 1) {
      const responseTimes: number[] = [];

      // Calculate time between user message and next assistant message
      for (let i = 0; i < conversationMessages.length - 1; i++) {
        const currentMsg = conversationMessages[i];
        const nextMsg = conversationMessages[i + 1];

        // Check if current is user and next is assistant in same conversation
        if (
          currentMsg.role === 'user' &&
          nextMsg.role === 'assistant' &&
          currentMsg.conversation_id === nextMsg.conversation_id
        ) {
          const userTime = new Date(currentMsg.created_at).getTime();
          const assistantTime = new Date(nextMsg.created_at).getTime();
          const responseTime = assistantTime - userTime;

          // Only include reasonable response times (< 5 minutes)
          if (responseTime > 0 && responseTime < 300000) {
            responseTimes.push(responseTime);
          }
        }
      }

      if (responseTimes.length > 0) {
        const sum = responseTimes.reduce((acc, time) => acc + time, 0);
        avgResponseTime = Math.round(sum / responseTimes.length);
      }
    }

    return {
      today: {
        messages: todayMessages || 0,
        agent_runs: todayRuns || 0,
        workflows: todayWorkflows || 0,
        ensembles: todayEnsembles || 0,
      },
      week: {
        messages: weekMessages || 0,
        agent_runs: weekRuns || 0,
        workflows: weekWorkflows || 0,
        ensembles: weekEnsembles || 0,
      },
      month: {
        messages: monthMessages || 0,
        agent_runs: monthRuns || 0,
        workflows: monthWorkflows || 0,
        ensembles: monthEnsembles || 0,
      },
      mostUsedModel,
      avgResponseTime,
      successRates: {
        agents: agentSuccessRate,
        workflows: workflowSuccessRate,
      },
    };
  }

  /**
   * Get model-specific analytics
   */
  async getModelAnalytics(userId: string, limit = 20): Promise<ModelAnalytics[]> {
    const { data: messages } = await supabase
      .from('messages')
      .select('model, created_at, tokens')
      .eq('user_id', userId)
      .eq('role', 'assistant')
      .not('model', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (!messages || messages.length === 0) {
      return [];
    }

    // Group by model
    const modelStats: Record<string, {
      count: number;
      totalTokens: number;
      lastUsed: string;
    }> = {};

    messages.forEach(msg => {
      if (!msg.model) return;

      if (!modelStats[msg.model]) {
        modelStats[msg.model] = {
          count: 0,
          totalTokens: 0,
          lastUsed: msg.created_at,
        };
      }

      modelStats[msg.model].count++;
      modelStats[msg.model].totalTokens += msg.tokens || 0;

      if (msg.created_at > modelStats[msg.model].lastUsed) {
        modelStats[msg.model].lastUsed = msg.created_at;
      }
    });

    // Convert to array and sort by usage
    const analytics: ModelAnalytics[] = Object.entries(modelStats)
      .map(([model_name, stats]) => ({
        model_name,
        usage_count: stats.count,
        avg_response_time_ms: null,
        total_tokens: stats.totalTokens,
        success_rate: null,
        last_used: stats.lastUsed,
      }))
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, limit);

    return analytics;
  }

  /**
   * Get agent-specific analytics
   */
  async getAgentAnalytics(userId: string, limit = 20): Promise<AgentAnalytics[]> {
    const { data: runs } = await supabase
      .from('agent_runs')
      .select('agent_id, status, steps, created_at, completed_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (!runs || runs.length === 0) {
      return [];
    }

    // Fetch agent names
    const agentIds = Array.from(new Set(runs.map(r => r.agent_id)));
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name')
      .in('id', agentIds);

    const agentNameMap = new Map(agents?.map(a => [a.id, a.name]) || []);

    // Group by agent
    const agentStats: Record<string, {
      runs: typeof runs;
      name: string;
    }> = {};

    runs.forEach(run => {
      if (!agentStats[run.agent_id]) {
        agentStats[run.agent_id] = {
          runs: [],
          name: agentNameMap.get(run.agent_id) || run.agent_id,
        };
      }
      agentStats[run.agent_id].runs.push(run);
    });

    // Calculate statistics
    const analytics: AgentAnalytics[] = Object.entries(agentStats)
      .map(([agent_id, stats]) => {
        const successCount = stats.runs.filter(r => r.status === 'completed').length;
        const failureCount = stats.runs.filter(r => r.status === 'failed').length;
        const totalRuns = stats.runs.length;

        const stepsArray = stats.runs
          .filter(r => Array.isArray(r.steps))
          .map(r => r.steps.length);
        const avgSteps = stepsArray.length > 0
          ? stepsArray.reduce((a, b) => a + b, 0) / stepsArray.length
          : null;

        const durations = stats.runs
          .filter(r => r.completed_at && r.created_at)
          .map(r => new Date(r.completed_at!).getTime() - new Date(r.created_at).getTime());
        const avgDuration = durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : null;

        const lastRun = stats.runs[0]?.created_at || null;

        return {
          agent_id,
          agent_name: stats.name,
          total_runs: totalRuns,
          success_count: successCount,
          failure_count: failureCount,
          success_rate: totalRuns > 0 ? (successCount / totalRuns) * 100 : 0,
          avg_steps: avgSteps,
          avg_duration_ms: avgDuration,
          last_run: lastRun,
        };
      })
      .sort((a, b) => b.total_runs - a.total_runs)
      .slice(0, limit);

    return analytics;
  }

  /**
   * Get workflow-specific analytics
   */
  async getWorkflowAnalytics(userId: string, limit = 20): Promise<WorkflowAnalytics[]> {
    const { data: executions } = await supabase
      .from('workflow_executions')
      .select('workflow_id, status, current_step, started_at, completed_at')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1000);

    if (!executions || executions.length === 0) {
      return [];
    }

    // Fetch workflow names and definitions
    const workflowIds = Array.from(new Set(executions.map(e => e.workflow_id)));
    const { data: workflows } = await supabase
      .from('workflows')
      .select('id, name, steps')
      .in('id', workflowIds);

    const workflowDataMap = new Map(workflows?.map(w => [w.id, { name: w.name, steps: w.steps }]) || []);

    // Group by workflow
    const workflowStats: Record<string, {
      executions: typeof executions;
      name: string;
      avgSteps: number | null;
    }> = {};

    executions.forEach(exec => {
      if (!workflowStats[exec.workflow_id]) {
        const workflowData = workflowDataMap.get(exec.workflow_id);
        workflowStats[exec.workflow_id] = {
          executions: [],
          name: workflowData?.name || exec.workflow_id,
          avgSteps: workflowData?.steps ? (Array.isArray(workflowData.steps) ? workflowData.steps.length : null) : null,
        };
      }
      workflowStats[exec.workflow_id].executions.push(exec);
    });

    // Calculate statistics
    const analytics: WorkflowAnalytics[] = Object.entries(workflowStats)
      .map(([workflow_id, stats]) => {
        const successCount = stats.executions.filter(e => e.status === 'completed').length;
        const failureCount = stats.executions.filter(e => e.status === 'failed').length;
        const totalExecutions = stats.executions.length;

        const durations = stats.executions
          .filter(e => e.completed_at && e.started_at)
          .map(e => new Date(e.completed_at!).getTime() - new Date(e.started_at).getTime());
        const avgDuration = durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : null;

        const lastExecution = stats.executions[0]?.started_at || null;

        return {
          workflow_id,
          workflow_name: stats.name,
          total_executions: totalExecutions,
          success_count: successCount,
          failure_count: failureCount,
          success_rate: totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0,
          avg_duration_ms: avgDuration,
          avg_steps: stats.avgSteps,
          last_execution: lastExecution,
        };
      })
      .sort((a, b) => b.total_executions - a.total_executions)
      .slice(0, limit);

    return analytics;
  }

  /**
   * Create or update daily analytics snapshot
   */
  async createDailySnapshot(userId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate daily metrics
    const metrics = await this.getOverviewMetrics(userId);

    const snapshot: Partial<AnalyticsSnapshot> = {
      user_id: userId,
      snapshot_type: 'daily',
      snapshot_date: today.toISOString().split('T')[0],
      total_messages: metrics.today.messages,
      total_agent_runs: metrics.today.agent_runs,
      total_workflow_executions: metrics.today.workflows,
      total_ensemble_runs: metrics.today.ensembles,
      agent_success_rate: metrics.successRates.agents,
      workflow_success_rate: metrics.successRates.workflows,
    };

    // Upsert snapshot
    await supabase
      .from('analytics_snapshots')
      .upsert(snapshot, {
        onConflict: 'user_id,snapshot_type,snapshot_date',
      });
  }

  /**
   * Log user activity
   */
  async logActivity(
    userId: string,
    activityType: string,
    resourceType?: string,
    resourceId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await supabase
      .from('user_activity_log')
      .insert({
        user_id: userId,
        activity_type: activityType,
        resource_type: resourceType,
        resource_id: resourceId,
        metadata: metadata || {},
      });
  }

  /**
   * Get recent activity for user
   */
  async getRecentActivity(userId: string, limit = 50): Promise<any[]> {
    const { data } = await supabase
      .from('user_activity_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }
}

// Singleton instance
let analyticsServiceInstance: AnalyticsService | null = null;

export function getAnalyticsService(): AnalyticsService {
  if (!analyticsServiceInstance) {
    analyticsServiceInstance = new AnalyticsService();
  }
  return analyticsServiceInstance;
}
