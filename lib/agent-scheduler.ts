/**
 * Agent Scheduler Service
 *
 * Schedules agents to run at specific times or intervals for background tasks,
 * automated workflows, and periodic operations.
 */

import { supabase, Database } from './supabase';
import { AgentRuntime } from './agent';
import { InferenceService } from './inference';

type Tables = Database['public']['Tables'];

// ===== Types =====

export interface ScheduledAgentTask {
  id: string;
  user_id: string;
  agent_id: string;
  name: string;
  description: string | null;
  schedule_type: 'once' | 'interval' | 'cron' | 'daily' | 'weekly' | 'monthly';
  schedule_config: ScheduleConfig;
  task_input: string;
  model_name: string;
  enabled: boolean;
  last_run: string | null;
  next_run: string | null;
  run_count: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'disabled';
  created_at: string;
  updated_at: string;
}

export interface ScheduleConfig {
  // For 'once' type
  runAt?: string; // ISO timestamp

  // For 'interval' type
  intervalMinutes?: number;

  // For 'cron' type
  cronExpression?: string;

  // For 'daily' type
  timeOfDay?: string; // HH:MM format

  // For 'weekly' type
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  weeklyTime?: string; // HH:MM format

  // For 'monthly' type
  dayOfMonth?: number; // 1-31
  monthlyTime?: string; // HH:MM format

  // Common options
  maxRuns?: number; // Stop after N runs
  timeout?: number; // Timeout in seconds
  retryOnFailure?: boolean;
  maxRetries?: number;
}

export interface ScheduledTaskExecution {
  id: string;
  scheduled_task_id: string;
  agent_id: string;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  started_at: string;
  finished_at: string | null;
  output: string | null;
  error: string | null;
  steps_count: number;
  duration: number;
}

// ===== Agent Scheduler Service =====

export class AgentSchedulerService {
  private runningTasks = new Map<string, NodeJS.Timeout>();
  private activeExecutions = new Map<string, ScheduledTaskExecution>();

  // ===== Task Management =====

  async createScheduledTask(
    userId: string,
    agentId: string,
    name: string,
    scheduleType: ScheduledAgentTask['schedule_type'],
    scheduleConfig: ScheduleConfig,
    taskInput: string,
    modelName: string,
    description?: string
  ): Promise<ScheduledAgentTask> {
    const nextRun = this.calculateNextRun(scheduleType, scheduleConfig);

    const { data, error } = await supabase
      .from('scheduled_agent_tasks')
      .insert({
        user_id: userId,
        agent_id: agentId,
        name,
        description: description || null,
        schedule_type: scheduleType,
        schedule_config: scheduleConfig as any,
        task_input: taskInput,
        model_name: modelName,
        enabled: true,
        next_run: nextRun,
        run_count: 0,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data as ScheduledAgentTask;
  }

  async updateScheduledTask(
    taskId: string,
    updates: Partial<ScheduledAgentTask>
  ): Promise<ScheduledAgentTask> {
    const { data, error } = await supabase
      .from('scheduled_agent_tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return data as ScheduledAgentTask;
  }

  async deleteScheduledTask(taskId: string): Promise<void> {
    // Stop if running
    this.stopTask(taskId);

    const { error } = await supabase.from('scheduled_agent_tasks').delete().eq('id', taskId);

    if (error) throw error;
  }

  async getScheduledTask(taskId: string): Promise<ScheduledAgentTask | null> {
    const { data, error } = await supabase
      .from('scheduled_agent_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) return null;
    return data as ScheduledAgentTask;
  }

  async getUserScheduledTasks(
    userId: string,
    includeDisabled: boolean = false
  ): Promise<ScheduledAgentTask[]> {
    let query = supabase
      .from('scheduled_agent_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!includeDisabled) {
      query = query.eq('enabled', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data as ScheduledAgentTask[];
  }

  async enableTask(taskId: string): Promise<void> {
    await this.updateScheduledTask(taskId, {
      enabled: true,
      status: 'pending',
    });
  }

  async disableTask(taskId: string): Promise<void> {
    this.stopTask(taskId);
    await this.updateScheduledTask(taskId, {
      enabled: false,
      status: 'disabled',
    });
  }

  // ===== Execution Management =====

  async executeTask(
    taskId: string,
    inferenceService: InferenceService
  ): Promise<ScheduledTaskExecution> {
    const task = await this.getScheduledTask(taskId);
    if (!task) {
      throw new Error('Scheduled task not found');
    }

    // Check if already running
    if (this.activeExecutions.has(taskId)) {
      throw new Error('Task is already running');
    }

    // Get agent configuration
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', task.agent_id)
      .single();

    if (agentError || !agent) {
      throw new Error('Agent not found');
    }

    // Create execution record
    const execution: ScheduledTaskExecution = {
      id: Date.now().toString(),
      scheduled_task_id: taskId,
      agent_id: task.agent_id,
      status: 'running',
      started_at: new Date().toISOString(),
      finished_at: null,
      output: null,
      error: null,
      steps_count: 0,
      duration: 0,
    };

    this.activeExecutions.set(taskId, execution);

    // Update task status
    await this.updateScheduledTask(taskId, {
      status: 'running',
      last_run: execution.started_at,
    });

    // Execute agent
    const startTime = Date.now();
    try {
      const agentRuntime = new AgentRuntime({
        name: agent.name,
        systemPrompt: agent.system_prompt || 'You are a helpful assistant.',
        tools: [], // Would load from agent configuration
        maxSteps: 10,
      }, inferenceService);

      const result = await agentRuntime.run(task.task_input, task.model_name);

      execution.status = 'completed';
      execution.output = result.finalOutput;
      execution.steps_count = result.steps.length;
      execution.finished_at = new Date().toISOString();
      execution.duration = Date.now() - startTime;

      // Update task
      const nextRun = this.calculateNextRun(task.schedule_type, task.schedule_config);
      await this.updateScheduledTask(taskId, {
        status: 'completed',
        next_run: nextRun,
        run_count: task.run_count + 1,
      });
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.finished_at = new Date().toISOString();
      execution.duration = Date.now() - startTime;

      await this.updateScheduledTask(taskId, {
        status: 'failed',
      });

      // Retry if configured
      if (task.schedule_config.retryOnFailure) {
        // Schedule retry (implementation would go here)
      }
    } finally {
      this.activeExecutions.delete(taskId);

      // Save execution record
      await this.saveExecution(execution);

      // Check if max runs reached
      if (task.schedule_config.maxRuns && task.run_count + 1 >= task.schedule_config.maxRuns) {
        await this.disableTask(taskId);
      }
    }

    return execution;
  }

  async getTaskExecutions(taskId: string, limit: number = 10): Promise<ScheduledTaskExecution[]> {
    const { data, error } = await supabase
      .from('scheduled_task_executions')
      .select('*')
      .eq('scheduled_task_id', taskId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data as ScheduledTaskExecution[];
  }

  async getExecution(executionId: string): Promise<ScheduledTaskExecution | null> {
    const { data, error } = await supabase
      .from('scheduled_task_executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (error) return null;
    return data as ScheduledTaskExecution;
  }

  // ===== Scheduler Control =====

  startScheduler(inferenceService: InferenceService): void {
    // Check for due tasks every minute
    const checkInterval = setInterval(async () => {
      await this.checkAndExecuteDueTasks(inferenceService);
    }, 60000); // 1 minute

    this.runningTasks.set('scheduler', checkInterval);
  }

  stopScheduler(): void {
    const interval = this.runningTasks.get('scheduler');
    if (interval) {
      clearInterval(interval);
      this.runningTasks.delete('scheduler');
    }
  }

  private async checkAndExecuteDueTasks(inferenceService: InferenceService): Promise<void> {
    // Get all enabled tasks that are due
    const { data: tasks, error } = await supabase
      .from('scheduled_agent_tasks')
      .select('*')
      .eq('enabled', true)
      .lte('next_run', new Date().toISOString());

    if (error || !tasks || tasks.length === 0) return;

    // Execute each due task
    for (const task of tasks) {
      try {
        await this.executeTask(task.id, inferenceService);
      } catch (error) {
        console.error(`Failed to execute scheduled task ${task.id}:`, error);
      }
    }
  }

  private stopTask(taskId: string): void {
    const timeout = this.runningTasks.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.runningTasks.delete(taskId);
    }
  }

  // ===== Helper Methods =====

  private calculateNextRun(
    scheduleType: ScheduledAgentTask['schedule_type'],
    config: ScheduleConfig
  ): string {
    const now = new Date();

    switch (scheduleType) {
      case 'once':
        return config.runAt || now.toISOString();

      case 'interval':
        const intervalMs = (config.intervalMinutes || 60) * 60 * 1000;
        return new Date(now.getTime() + intervalMs).toISOString();

      case 'daily':
        const [hours, minutes] = (config.timeOfDay || '00:00').split(':').map(Number);
        const nextDaily = new Date(now);
        nextDaily.setHours(hours, minutes, 0, 0);
        if (nextDaily <= now) {
          nextDaily.setDate(nextDaily.getDate() + 1);
        }
        return nextDaily.toISOString();

      case 'weekly':
        const targetDay = config.dayOfWeek || 0;
        const currentDay = now.getDay();
        const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
        const [wHours, wMinutes] = (config.weeklyTime || '00:00').split(':').map(Number);
        const nextWeekly = new Date(now);
        nextWeekly.setDate(nextWeekly.getDate() + daysUntilTarget);
        nextWeekly.setHours(wHours, wMinutes, 0, 0);
        return nextWeekly.toISOString();

      case 'monthly':
        const targetDate = config.dayOfMonth || 1;
        const [mHours, mMinutes] = (config.monthlyTime || '00:00').split(':').map(Number);
        const nextMonthly = new Date(now);
        nextMonthly.setDate(targetDate);
        nextMonthly.setHours(mHours, mMinutes, 0, 0);
        if (nextMonthly <= now) {
          nextMonthly.setMonth(nextMonthly.getMonth() + 1);
        }
        return nextMonthly.toISOString();

      case 'cron':
        // Cron expression parsing would go here
        // For now, default to 1 hour
        return new Date(now.getTime() + 3600000).toISOString();

      default:
        return now.toISOString();
    }
  }

  private async saveExecution(execution: ScheduledTaskExecution): Promise<void> {
    const { error } = await supabase.from('scheduled_task_executions').insert({
      scheduled_task_id: execution.scheduled_task_id,
      agent_id: execution.agent_id,
      status: execution.status,
      started_at: execution.started_at,
      finished_at: execution.finished_at,
      output: execution.output,
      error: execution.error,
      steps_count: execution.steps_count,
      duration: execution.duration,
    });

    if (error) throw error;
  }

  // ===== Statistics =====

  async getSchedulerStats(userId: string): Promise<{
    totalTasks: number;
    enabledTasks: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
  }> {
    const tasks = await this.getUserScheduledTasks(userId, true);
    const totalTasks = tasks.length;
    const enabledTasks = tasks.filter((t) => t.enabled).length;

    // Get execution stats
    const { data: executions, error } = await supabase
      .from('scheduled_task_executions')
      .select('*')
      .in(
        'scheduled_task_id',
        tasks.map((t) => t.id)
      );

    if (error) {
      return {
        totalTasks,
        enabledTasks,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageDuration: 0,
      };
    }

    const totalExecutions = executions?.length || 0;
    const successfulExecutions = executions?.filter((e) => e.status === 'completed').length || 0;
    const failedExecutions = executions?.filter((e) => e.status === 'failed').length || 0;
    const averageDuration =
      totalExecutions > 0
        ? executions.reduce((sum, e) => sum + (e.duration || 0), 0) / totalExecutions
        : 0;

    return {
      totalTasks,
      enabledTasks,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageDuration,
    };
  }
}

// ===== Singleton =====

let agentSchedulerServiceInstance: AgentSchedulerService | null = null;

export function getAgentSchedulerService(): AgentSchedulerService {
  if (!agentSchedulerServiceInstance) {
    agentSchedulerServiceInstance = new AgentSchedulerService();
  }
  return agentSchedulerServiceInstance;
}
