/**
 * Agent Run Visualization Service
 * Provides replay and visualization of agent execution steps
 */

import { supabase } from './supabase';
import { Tables } from './supabase';

export interface AgentStepVisualization {
  stepNumber: number;
  action: string;
  toolName?: string;
  toolInput?: any;
  observation: string;
  timestamp: number;
  duration?: number;
  status: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
}

export interface AgentRunVisualization {
  id: string;
  agent_id: string;
  agent_name: string;
  conversation_id: string | null;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  steps: AgentStepVisualization[];
  final_output: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  total_steps: number;
  total_duration: number;
  metrics: {
    tool_calls: number;
    successful_steps: number;
    failed_steps: number;
    average_step_duration: number;
  };
}

export interface AgentRunTimeline {
  start_time: number;
  end_time: number;
  total_duration: number;
  steps: Array<{
    step_number: number;
    start: number;
    end: number;
    duration: number;
    label: string;
  }>;
}

export class AgentVisualizationService {
  /**
   * Get agent run with visualization data
   */
  async getAgentRun(runId: string): Promise<AgentRunVisualization | null> {
    const { data: run, error: runError } = await supabase
      .from('agent_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (runError || !run) return null;

    // Get agent info
    const { data: agent } = await supabase.from('agents').select('name').eq('id', run.agent_id).single();

    // Process steps
    const steps: AgentStepVisualization[] = run.steps_json.map((step: any, index: number) => ({
      stepNumber: index + 1,
      action: step.action || 'unknown',
      toolName: step.toolName,
      toolInput: step.toolInput,
      observation: step.observation || '',
      timestamp: step.timestamp || Date.now(),
      duration: step.duration,
      status: step.error ? 'error' : 'completed',
      error: step.error,
    }));

    // Calculate metrics
    const toolCalls = steps.filter((s) => s.toolName).length;
    const successfulSteps = steps.filter((s) => s.status === 'completed').length;
    const failedSteps = steps.filter((s) => s.status === 'error').length;
    const totalDuration = steps.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgStepDuration = steps.length > 0 ? totalDuration / steps.length : 0;

    const startTime = new Date(run.started_at).getTime();
    const endTime = run.finished_at ? new Date(run.finished_at).getTime() : Date.now();

    return {
      id: run.id,
      agent_id: run.agent_id,
      agent_name: agent?.name || 'Unknown Agent',
      conversation_id: run.conversation_id,
      status: run.status,
      steps,
      final_output: run.final_output,
      error_message: run.error_message,
      started_at: run.started_at,
      finished_at: run.finished_at,
      total_steps: run.total_steps,
      total_duration: endTime - startTime,
      metrics: {
        tool_calls: toolCalls,
        successful_steps: successfulSteps,
        failed_steps: failedSteps,
        average_step_duration: avgStepDuration,
      },
    };
  }

  /**
   * Get timeline for agent run
   */
  async getAgentRunTimeline(runId: string): Promise<AgentRunTimeline | null> {
    const visualization = await this.getAgentRun(runId);
    if (!visualization) return null;

    const startTime = new Date(visualization.started_at).getTime();
    const endTime = visualization.finished_at
      ? new Date(visualization.finished_at).getTime()
      : Date.now();

    const timelineSteps = visualization.steps.map((step, index) => {
      const stepStart = step.timestamp;
      const stepDuration = step.duration || 1000; // Default 1 second if not specified
      const stepEnd = stepStart + stepDuration;

      return {
        step_number: step.stepNumber,
        start: stepStart - startTime,
        end: stepEnd - startTime,
        duration: stepDuration,
        label: step.toolName ? `Tool: ${step.toolName}` : step.action,
      };
    });

    return {
      start_time: startTime,
      end_time: endTime,
      total_duration: endTime - startTime,
      steps: timelineSteps,
    };
  }

  /**
   * Get all runs for an agent
   */
  async getAgentRuns(agentId: string, limit: number = 20): Promise<AgentRunVisualization[]> {
    const { data: runs, error } = await supabase
      .from('agent_runs')
      .select('*')
      .eq('agent_id', agentId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error || !runs) return [];

    const visualizations = await Promise.all(runs.map((run) => this.getAgentRun(run.id)));

    return visualizations.filter((v): v is AgentRunVisualization => v !== null);
  }

  /**
   * Get recent agent runs across all agents
   */
  async getRecentAgentRuns(userId: string, limit: number = 10): Promise<AgentRunVisualization[]> {
    // Get user's agents
    const { data: agents } = await supabase.from('agents').select('id').eq('user_id', userId);

    if (!agents || agents.length === 0) return [];

    const agentIds = agents.map((a) => a.id);

    const { data: runs, error } = await supabase
      .from('agent_runs')
      .select('*')
      .in('agent_id', agentIds)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error || !runs) return [];

    const visualizations = await Promise.all(runs.map((run) => this.getAgentRun(run.id)));

    return visualizations.filter((v): v is AgentRunVisualization => v !== null);
  }

  /**
   * Get agent run statistics
   */
  async getAgentStatistics(
    agentId: string
  ): Promise<{
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    average_duration: number;
    total_steps: number;
    average_steps: number;
  }> {
    const { data: runs } = await supabase.from('agent_runs').select('*').eq('agent_id', agentId);

    if (!runs || runs.length === 0) {
      return {
        total_runs: 0,
        successful_runs: 0,
        failed_runs: 0,
        average_duration: 0,
        total_steps: 0,
        average_steps: 0,
      };
    }

    const successfulRuns = runs.filter((r) => r.status === 'completed').length;
    const failedRuns = runs.filter((r) => r.status === 'failed').length;
    const totalSteps = runs.reduce((sum, r) => sum + r.total_steps, 0);

    // Calculate average duration
    const durations = runs
      .filter((r) => r.finished_at)
      .map((r) => new Date(r.finished_at!).getTime() - new Date(r.started_at).getTime());
    const avgDuration = durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;

    return {
      total_runs: runs.length,
      successful_runs: successfulRuns,
      failed_runs: failedRuns,
      average_duration: avgDuration,
      total_steps: totalSteps,
      average_steps: runs.length > 0 ? totalSteps / runs.length : 0,
    };
  }

  /**
   * Compare multiple agent runs
   */
  async compareAgentRuns(runIds: string[]): Promise<{
    runs: AgentRunVisualization[];
    comparison: {
      fastest_run: string;
      slowest_run: string;
      most_steps: string;
      least_steps: string;
    };
  }> {
    const runs = await Promise.all(runIds.map((id) => this.getAgentRun(id)));
    const validRuns = runs.filter((r): r is AgentRunVisualization => r !== null);

    if (validRuns.length === 0) {
      return {
        runs: [],
        comparison: {
          fastest_run: '',
          slowest_run: '',
          most_steps: '',
          least_steps: '',
        },
      };
    }

    const sorted = [...validRuns].sort((a, b) => a.total_duration - b.total_duration);
    const bySteps = [...validRuns].sort((a, b) => b.total_steps - a.total_steps);

    return {
      runs: validRuns,
      comparison: {
        fastest_run: sorted[0].id,
        slowest_run: sorted[sorted.length - 1].id,
        most_steps: bySteps[0].id,
        least_steps: bySteps[bySteps.length - 1].id,
      },
    };
  }

  /**
   * Export agent run as JSON
   */
  async exportAgentRun(runId: string): Promise<string> {
    const visualization = await this.getAgentRun(runId);
    if (!visualization) throw new Error('Agent run not found');

    return JSON.stringify(visualization, null, 2);
  }
}

let agentVisualizationServiceInstance: AgentVisualizationService | null = null;

export function getAgentVisualizationService(): AgentVisualizationService {
  if (!agentVisualizationServiceInstance) {
    agentVisualizationServiceInstance = new AgentVisualizationService();
  }
  return agentVisualizationServiceInstance;
}
