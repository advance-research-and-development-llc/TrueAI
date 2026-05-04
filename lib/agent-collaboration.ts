/**
 * Agent Collaboration Service
 * Enables multi-agent workflows, task delegation, and shared context
 */

import { supabase } from './supabase';
import { Tables } from './supabase';
import { AgentRuntime } from './agent';
import { getInferenceEngine } from './inference';

export interface AgentTask {
  id: string;
  task_description: string;
  assigned_agent_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CollaborationSession {
  id: string;
  user_id: string;
  name: string;
  agent_ids: string[];
  shared_context: Record<string, any>;
  tasks: AgentTask[];
  status: 'active' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface AgentDelegationRequest {
  from_agent_id: string;
  to_agent_id: string;
  task_description: string;
  context: Record<string, any>;
}

export class AgentCollaborationService {
  /**
   * Create a new collaboration session with multiple agents
   */
  async createCollaborationSession(
    userId: string,
    name: string,
    agentIds: string[],
    initialContext: Record<string, any> = {}
  ): Promise<CollaborationSession> {
    const session: Omit<CollaborationSession, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      name,
      agent_ids: agentIds,
      shared_context: initialContext,
      tasks: [],
      status: 'active',
    };

    // For now, store in memory or local state
    // In production, this would be stored in Supabase
    const sessionId = `collab_${Date.now()}`;

    return {
      id: sessionId,
      ...session,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Delegate a task from one agent to another
   */
  async delegateTask(request: AgentDelegationRequest): Promise<AgentTask> {
    const task: AgentTask = {
      id: `task_${Date.now()}`,
      task_description: request.task_description,
      assigned_agent_id: request.to_agent_id,
      status: 'pending',
      result: null,
      error: null,
      created_at: new Date().toISOString(),
      completed_at: null,
    };

    return task;
  }

  /**
   * Execute a collaborative workflow with multiple agents
   */
  async executeCollaborativeWorkflow(
    sessionId: string,
    userQuery: string,
    ollamaUrl: string,
    modelName: string
  ): Promise<{
    results: Array<{ agent_id: string; agent_name: string; output: string }>;
    final_synthesis: string;
  }> {
    // Fetch agents for this session
    const { data: sessionAgents } = await supabase
      .from('agents')
      .select('*')
      .in('id', [sessionId]); // In real implementation, fetch from collaboration_sessions table

    if (!sessionAgents || sessionAgents.length === 0) {
      return {
        results: [],
        final_synthesis: 'No agents available for collaborative workflow',
      };
    }

    // Step 1: Break down the task into subtasks
    const coordination = await this.coordinateAgents(
      sessionId,
      userQuery,
      sessionAgents.map(a => a.id)
    );

    // Step 2: Execute agents in parallel with their assigned subtasks
    const agentTasks = coordination.agent_assignments.map(assignment => ({
      agent_id: assignment.agent_id,
      task: assignment.subtask,
      context: { original_query: userQuery, session_id: sessionId },
    }));

    const executionResults = await this.executeAgentsInParallel(
      agentTasks,
      ollamaUrl,
      modelName
    );

    // Step 3: Collect results
    const results = executionResults.map((result, idx) => ({
      agent_id: result.agent_id,
      agent_name: sessionAgents.find(a => a.id === result.agent_id)?.name || 'Unknown Agent',
      output: result.error || result.result,
    }));

    // Step 4: Synthesize results into a coherent response
    const finalSynthesis = await this.synthesizeResults(
      results,
      userQuery,
      ollamaUrl,
      modelName
    );

    return {
      results,
      final_synthesis: finalSynthesis,
    };
  }

  /**
   * Share context between agents in a session
   */
  async updateSharedContext(sessionId: string, context: Record<string, any>): Promise<void> {
    // Store shared context in Supabase
    // For now, we'll use a simple key-value approach
    // In production, create a collaboration_sessions table with JSONB context field
    try {
      // Attempt to update if exists, otherwise would need to create
      await supabase
        .from('agent_runs')
        .update({ metadata: context })
        .eq('id', sessionId);

      console.log(`Updated shared context for session ${sessionId}`);
    } catch (error) {
      console.error('Failed to update shared context:', error);
      throw error;
    }
  }

  /**
   * Get shared context for a session
   */
  async getSharedContext(sessionId: string): Promise<Record<string, any>> {
    // Fetch shared context from Supabase
    try {
      const { data, error } = await supabase
        .from('agent_runs')
        .select('metadata')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      return (data?.metadata as Record<string, any>) || {};
    } catch (error) {
      console.error('Failed to get shared context:', error);
      return {};
    }
  }

  /**
   * Coordinate agents working on the same task
   */
  async coordinateAgents(
    sessionId: string,
    task: string,
    agentIds: string[]
  ): Promise<{
    coordination_plan: string;
    agent_assignments: Array<{ agent_id: string; subtask: string }>;
  }> {
    // Simple coordination logic
    // In production, this would use a more sophisticated algorithm

    const agentAssignments = agentIds.map((agentId, index) => ({
      agent_id: agentId,
      subtask: `Subtask ${index + 1}: Handle aspect ${index + 1} of: ${task}`,
    }));

    return {
      coordination_plan: `Task divided into ${agentIds.length} subtasks, one per agent`,
      agent_assignments: agentAssignments,
    };
  }

  /**
   * Execute agents in parallel for faster processing
   */
  async executeAgentsInParallel(
    agentTasks: Array<{ agent_id: string; task: string; context: Record<string, any> }>,
    ollamaUrl: string,
    modelName: string
  ): Promise<Array<{ agent_id: string; result: string; error: string | null }>> {
    const results = await Promise.all(
      agentTasks.map(async ({ agent_id, task, context }) => {
        try {
          // Get agent configuration
          const { data: agent } = await supabase.from('agents').select('*').eq('id', agent_id).single();

          if (!agent) {
            return {
              agent_id,
              result: '',
              error: 'Agent not found',
            };
          }

          // Execute agent
          const inferenceEngine = getInferenceEngine(ollamaUrl);
          const agentRuntime = new AgentRuntime({
            name: agent.name,
            systemPrompt: agent.system_prompt || 'You are a helpful assistant.',
            tools: [], // Would load from agent.tools_enabled
            maxSteps: 5,
          }, inferenceEngine);

          const execution = await agentRuntime.run(task, modelName);

          return {
            agent_id,
            result: execution.finalOutput,
            error: null,
          };
        } catch (error) {
          return {
            agent_id,
            result: '',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return results;
  }

  /**
   * Synthesize results from multiple agents into a coherent response
   */
  async synthesizeResults(
    results: Array<{ agent_id: string; agent_name?: string; output: string }>,
    originalQuery: string,
    ollamaUrl: string,
    modelName: string
  ): Promise<string> {
    // Create a synthesis prompt
    const resultsText = results
      .map((r, idx) => `Agent ${idx + 1} (${r.agent_name || r.agent_id}):\n${r.output}`)
      .join('\n\n---\n\n');

    const synthesisPrompt = `Given the following outputs from multiple AI agents working on the same task, please synthesize a coherent, comprehensive response.

Original Query: ${originalQuery}

Agent Outputs:
${resultsText}

Please provide a unified response that combines the insights from all agents:`;

    // Use inference engine to synthesize
    const inferenceEngine = getInferenceEngine(ollamaUrl);
    const synthesis = await inferenceEngine.generate(
      modelName,
      synthesisPrompt,
      'You are a synthesis agent that combines outputs from multiple AI agents into coherent responses.',
      { temperature: 0.7 }
    );

    return synthesis;
  }

  /**
   * Detect when an agent should delegate to another agent
   */
  shouldDelegate(agentResponse: string): { should_delegate: boolean; reason: string } {
    // Simple heuristic-based detection
    const delegationKeywords = [
      'need help',
      'not my expertise',
      'should ask',
      'better suited',
      'specialized knowledge',
      'defer to',
    ];

    const lowerResponse = agentResponse.toLowerCase();
    const foundKeyword = delegationKeywords.find((keyword) => lowerResponse.includes(keyword));

    return {
      should_delegate: !!foundKeyword,
      reason: foundKeyword
        ? `Agent indicated need for delegation (keyword: "${foundKeyword}")`
        : 'No delegation needed',
    };
  }

  /**
   * Select the best agent for a given task based on agent capabilities
   */
  async selectBestAgent(task: string, availableAgents: Tables['agents']['Row'][]): Promise<string | null> {
    // Simple selection based on agent description matching
    // In production, this would use more sophisticated matching

    if (availableAgents.length === 0) return null;
    if (availableAgents.length === 1) return availableAgents[0].id;

    // Score agents based on description/name similarity to task
    const scores = availableAgents.map((agent) => {
      const agentText = `${agent.name} ${agent.description || ''}`.toLowerCase();
      const taskLower = task.toLowerCase();

      // Simple word overlap scoring
      const agentWords = new Set(agentText.split(/\s+/));
      const taskWords = taskLower.split(/\s+/);
      const overlap = taskWords.filter((word) => agentWords.has(word)).length;

      return {
        agent_id: agent.id,
        score: overlap,
      };
    });

    // Return agent with highest score
    scores.sort((a, b) => b.score - a.score);
    return scores[0].agent_id;
  }
}

let agentCollaborationServiceInstance: AgentCollaborationService | null = null;

export function getAgentCollaborationService(): AgentCollaborationService {
  if (!agentCollaborationServiceInstance) {
    agentCollaborationServiceInstance = new AgentCollaborationService();
  }
  return agentCollaborationServiceInstance;
}
