/**
 * Advanced Agent Workflow Service
 *
 * Orchestrates complex multi-step agent workflows with conditional logic,
 * parallel execution, and data transformation between steps.
 */

import { supabase, Database } from './supabase';
import { AgentRuntime } from './agent';
import { InferenceService } from './inference';

type Tables = Database['public']['Tables'];

// ===== Types =====

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'agent' | 'transform' | 'condition' | 'parallel' | 'loop';
  config: WorkflowStepConfig;
  nextSteps: string[]; // IDs of next steps
  conditions?: WorkflowCondition[];
}

export interface WorkflowStepConfig {
  // For 'agent' type
  agentId?: string;
  modelName?: string;
  prompt?: string;
  useInputAsPrompt?: boolean;

  // For 'transform' type
  transformFunction?: string; // JavaScript function as string
  transformType?: 'extract' | 'format' | 'filter' | 'map';

  // For 'condition' type
  conditionExpression?: string;
  trueSteps?: string[];
  falseSteps?: string[];

  // For 'parallel' type
  parallelSteps?: string[];

  // For 'loop' type
  loopCondition?: string;
  loopSteps?: string[];
  maxIterations?: number;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'exists';
  value: any;
  nextStep: string;
}

export interface Workflow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  steps: WorkflowStep[];
  startStep: string;
  variables: Record<string, any>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  user_id: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  input: any;
  output: any;
  currentStep: string | null;
  stepResults: Record<string, any>;
  variables: Record<string, any>;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  duration: number;
}

// ===== Advanced Agent Workflow Service =====

export class AdvancedAgentWorkflowService {
  private activeExecutions = new Map<string, WorkflowExecution>();

  // ===== Workflow Management =====

  async createWorkflow(
    userId: string,
    name: string,
    description: string,
    steps: WorkflowStep[],
    startStep: string,
    variables: Record<string, any> = {}
  ): Promise<Workflow> {
    const { data, error } = await supabase
      .from('agent_workflows')
      .insert({
        user_id: userId,
        name,
        description,
        steps: steps as any,
        start_step: startStep,
        variables: variables as any,
        enabled: true,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapWorkflowFromDB(data);
  }

  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    const { data, error } = await supabase
      .from('agent_workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (error) return null;
    return this.mapWorkflowFromDB(data);
  }

  async getUserWorkflows(userId: string): Promise<Workflow[]> {
    const { data, error } = await supabase
      .from('agent_workflows')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map((w) => this.mapWorkflowFromDB(w));
  }

  async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<Workflow> {
    const { data, error } = await supabase
      .from('agent_workflows')
      .update({
        ...updates,
        steps: updates.steps as any,
        variables: updates.variables as any,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workflowId)
      .select()
      .single();

    if (error) throw error;
    return this.mapWorkflowFromDB(data);
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    const { error } = await supabase.from('agent_workflows').delete().eq('id', workflowId);
    if (error) throw error;
  }

  // ===== Workflow Execution =====

  async executeWorkflow(
    workflowId: string,
    input: any,
    inferenceService: InferenceService
  ): Promise<WorkflowExecution> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (!workflow.enabled) {
      throw new Error('Workflow is disabled');
    }

    // Create execution
    const execution: WorkflowExecution = {
      id: Date.now().toString(),
      workflow_id: workflowId,
      user_id: workflow.user_id,
      status: 'running',
      input,
      output: null,
      currentStep: workflow.startStep,
      stepResults: {},
      variables: { ...workflow.variables },
      error: null,
      started_at: new Date().toISOString(),
      finished_at: null,
      duration: 0,
    };

    this.activeExecutions.set(execution.id, execution);

    const startTime = Date.now();

    try {
      // Execute workflow steps
      let currentData = input;
      let currentStepId: string | null = workflow.startStep;

      while (currentStepId) {
        const step = workflow.steps.find((s) => s.id === currentStepId);
        if (!step) {
          throw new Error(`Step ${currentStepId} not found in workflow`);
        }

        execution.currentStep = currentStepId;

        // Execute step
        const stepResult = await this.executeStep(step, currentData, execution, inferenceService);

        // Store step result
        execution.stepResults[currentStepId] = stepResult;

        // Update current data
        currentData = stepResult;

        // Determine next step
        currentStepId = this.getNextStep(step, stepResult, execution);

        // Save progress
        await this.saveExecution(execution);
      }

      execution.status = 'completed';
      execution.output = currentData;
      execution.finished_at = new Date().toISOString();
      execution.duration = Date.now() - startTime;
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.finished_at = new Date().toISOString();
      execution.duration = Date.now() - startTime;
    } finally {
      this.activeExecutions.delete(execution.id);
      await this.saveExecution(execution);
    }

    return execution;
  }

  private async executeStep(
    step: WorkflowStep,
    input: any,
    execution: WorkflowExecution,
    inferenceService: InferenceService
  ): Promise<any> {
    switch (step.type) {
      case 'agent':
        return await this.executeAgentStep(step, input, execution, inferenceService);

      case 'transform':
        return this.executeTransformStep(step, input, execution);

      case 'condition':
        return this.executeConditionStep(step, input, execution);

      case 'parallel':
        return await this.executeParallelStep(step, input, execution, inferenceService);

      case 'loop':
        return await this.executeLoopStep(step, input, execution, inferenceService);

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private async executeAgentStep(
    step: WorkflowStep,
    input: any,
    execution: WorkflowExecution,
    inferenceService: InferenceService
  ): Promise<any> {
    const config = step.config;

    if (!config.agentId || !config.modelName) {
      throw new Error('Agent step requires agentId and modelName');
    }

    // Get agent
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', config.agentId)
      .single();

    if (error || !agent) {
      throw new Error('Agent not found');
    }

    // Create agent runtime
    const agentRuntime = new AgentRuntime({
      name: agent.name,
      systemPrompt: agent.system_prompt || 'You are a helpful assistant.',
      tools: [], // Would load from agent configuration
      maxSteps: 10,
    }, inferenceService);

    // Determine prompt
    let prompt = config.prompt || '';
    if (config.useInputAsPrompt) {
      prompt = typeof input === 'string' ? input : JSON.stringify(input);
    } else if (prompt.includes('{input}')) {
      prompt = prompt.replace('{input}', typeof input === 'string' ? input : JSON.stringify(input));
    }

    // Execute agent
    const result = await agentRuntime.run(prompt, config.modelName);

    return result.finalOutput;
  }

  private executeTransformStep(
    step: WorkflowStep,
    input: any,
    execution: WorkflowExecution
  ): any {
    const config = step.config;

    switch (config.transformType) {
      case 'extract':
        // Extract specific fields from input
        if (typeof input === 'object') {
          return input;
        }
        return input;

      case 'format':
        // Format data
        return typeof input === 'string' ? input : JSON.stringify(input, null, 2);

      case 'filter':
        // Filter data
        if (Array.isArray(input)) {
          return input.filter((item) => item != null);
        }
        return input;

      case 'map':
        // Map/transform data
        if (Array.isArray(input)) {
          return input.map((item) => item);
        }
        return input;

      default:
        return input;
    }
  }

  private executeConditionStep(step: WorkflowStep, input: any, execution: WorkflowExecution): any {
    // Condition steps don't transform data, just determine next step
    // The actual branching is handled in getNextStep
    return input;
  }

  private async executeParallelStep(
    step: WorkflowStep,
    input: any,
    execution: WorkflowExecution,
    inferenceService: InferenceService
  ): Promise<any> {
    const config = step.config;
    const parallelStepIds = config.parallelSteps || [];

    const workflow = await this.getWorkflow(execution.workflow_id);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Execute all parallel steps simultaneously
    const promises = parallelStepIds.map(async (stepId) => {
      const parallelStep = workflow.steps.find((s) => s.id === stepId);
      if (!parallelStep) {
        throw new Error(`Parallel step ${stepId} not found`);
      }

      return await this.executeStep(parallelStep, input, execution, inferenceService);
    });

    const results = await Promise.all(promises);

    // Combine results
    return results;
  }

  private async executeLoopStep(
    step: WorkflowStep,
    input: any,
    execution: WorkflowExecution,
    inferenceService: InferenceService
  ): Promise<any> {
    const config = step.config;
    const loopStepIds = config.loopSteps || [];
    const maxIterations = config.maxIterations || 10;

    const workflow = await this.getWorkflow(execution.workflow_id);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    let currentData = input;
    let iterations = 0;

    while (iterations < maxIterations) {
      // Execute loop steps
      for (const stepId of loopStepIds) {
        const loopStep = workflow.steps.find((s) => s.id === stepId);
        if (!loopStep) {
          throw new Error(`Loop step ${stepId} not found`);
        }

        currentData = await this.executeStep(loopStep, currentData, execution, inferenceService);
      }

      iterations++;

      // Check loop condition
      if (config.loopCondition) {
        const shouldContinue = this.evaluateCondition(config.loopCondition, currentData);
        if (!shouldContinue) break;
      }
    }

    return currentData;
  }

  private getNextStep(step: WorkflowStep, stepResult: any, execution: WorkflowExecution): string | null {
    if (step.type === 'condition') {
      // Evaluate conditions
      const config = step.config;
      if (config.conditionExpression) {
        const result = this.evaluateCondition(config.conditionExpression, stepResult);
        const nextSteps = result ? config.trueSteps : config.falseSteps;
        return nextSteps && nextSteps.length > 0 ? nextSteps[0] : null;
      }
    }

    // Check step conditions
    if (step.conditions && step.conditions.length > 0) {
      for (const condition of step.conditions) {
        if (this.evaluateStepCondition(condition, stepResult)) {
          return condition.nextStep;
        }
      }
    }

    // Default: return first next step
    return step.nextSteps && step.nextSteps.length > 0 ? step.nextSteps[0] : null;
  }

  private evaluateCondition(expression: string, data: any): boolean {
    // Simple condition evaluation
    // In production, use a proper expression evaluator
    try {
      // Very basic evaluation - should be improved
      if (expression.includes('length')) {
        const length = typeof data === 'string' ? data.length : Array.isArray(data) ? data.length : 0;
        return eval(expression.replace(/data\.length/g, length.toString()));
      }

      return true;
    } catch {
      return false;
    }
  }

  private evaluateStepCondition(condition: WorkflowCondition, data: any): boolean {
    const value = typeof data === 'object' && data[condition.field] !== undefined
      ? data[condition.field]
      : data;

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return typeof value === 'string' && value.includes(condition.value);
      case 'greater':
        return typeof value === 'number' && value > condition.value;
      case 'less':
        return typeof value === 'number' && value < condition.value;
      case 'exists':
        return value !== null && value !== undefined;
      default:
        return false;
    }
  }

  // ===== Execution Management =====

  async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    const { data, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (error) return null;
    return this.mapExecutionFromDB(data);
  }

  async getWorkflowExecutions(workflowId: string, limit: number = 10): Promise<WorkflowExecution[]> {
    const { data, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data.map((e) => this.mapExecutionFromDB(e));
  }

  // ===== Helper Methods =====

  private async saveExecution(execution: WorkflowExecution): Promise<void> {
    const { error } = await supabase.from('workflow_executions').upsert({
      id: execution.id,
      workflow_id: execution.workflow_id,
      user_id: execution.user_id,
      status: execution.status,
      input: execution.input,
      output: execution.output,
      current_step: execution.currentStep,
      step_results: execution.stepResults as any,
      variables: execution.variables as any,
      error: execution.error,
      started_at: execution.started_at,
      finished_at: execution.finished_at,
      duration: execution.duration,
    });

    if (error) throw error;
  }

  private mapWorkflowFromDB(data: any): Workflow {
    return {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      description: data.description,
      steps: data.steps,
      startStep: data.start_step,
      variables: data.variables || {},
      enabled: data.enabled,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  private mapExecutionFromDB(data: any): WorkflowExecution {
    return {
      id: data.id,
      workflow_id: data.workflow_id,
      user_id: data.user_id,
      status: data.status,
      input: data.input,
      output: data.output,
      currentStep: data.current_step,
      stepResults: data.step_results || {},
      variables: data.variables || {},
      error: data.error,
      started_at: data.started_at,
      finished_at: data.finished_at,
      duration: data.duration || 0,
    };
  }
}

// ===== Singleton =====

let advancedAgentWorkflowServiceInstance: AdvancedAgentWorkflowService | null = null;

export function getAdvancedAgentWorkflowService(): AdvancedAgentWorkflowService {
  if (!advancedAgentWorkflowServiceInstance) {
    advancedAgentWorkflowServiceInstance = new AdvancedAgentWorkflowService();
  }
  return advancedAgentWorkflowServiceInstance;
}
