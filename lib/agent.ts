import { InferenceEngine } from './inference';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (params: any) => Promise<string>;
}

export interface AgentStep {
  stepNumber: number;
  action: string;
  toolName?: string;
  toolInput?: any;
  observation: string;
  timestamp: number;
}

export interface AgentConfig {
  name: string;
  systemPrompt: string;
  maxSteps: number;
  temperature?: number;
  tools: ToolDefinition[];
}

export class AgentRuntime {
  private config: AgentConfig;
  private inferenceEngine: InferenceEngine;
  private steps: AgentStep[] = [];
  private thoughts: string[] = [];
  private conversationHistory: string[] = [];

  constructor(config: AgentConfig, inferenceEngine: InferenceEngine) {
    this.config = config;
    this.inferenceEngine = inferenceEngine;
  }

  private buildToolsContext(): string {
    return this.config.tools
      .map(
        (tool) =>
          `Tool: ${tool.name}\nDescription: ${tool.description}\nParameters: ${JSON.stringify(tool.parameters)}`
      )
      .join('\n\n');
  }

  private parseToolCall(response: string): { toolName: string; toolInput: any } | null {
    const toolPattern = /TOOL:\s*(\w+)\s*\nINPUT:\s*([\s\S]*?)(?=\n|$)/;
    const match = response.match(toolPattern);

    if (match) {
      try {
        return {
          toolName: match[1],
          toolInput: JSON.parse(match[2]),
        };
      } catch {}
    }
    return null;
  }

  async executeStep(userInput: string, modelName: string): Promise<AgentStep> {
    const stepNumber = this.steps.length + 1;
    const toolContext = this.buildToolsContext();

    const promptTemplate = `You are a helpful AI agent. You have the following tools available:

${toolContext}

To use a tool, respond in this exact format:
TOOL: <tool_name>
INPUT: <json_parameters>

If you don't need to use a tool, just provide your final answer.

Previous conversation:
${this.conversationHistory.join('\n')}

Current user request: ${userInput}

Please think step by step and decide if you need to use a tool or provide a direct answer.`;

    const response = await this.inferenceEngine.generate(
      modelName,
      promptTemplate,
      this.config.systemPrompt,
      { temperature: this.config.temperature || 0.7 }
    );

    this.conversationHistory.push(`User: ${userInput}`);
    this.conversationHistory.push(`Assistant: ${response}`);

    const toolCall = this.parseToolCall(response);
    let observation = '';

    if (toolCall) {
      const tool = this.config.tools.find((t) => t.name === toolCall.toolName);
      if (tool) {
        try {
          observation = await tool.handler(toolCall.toolInput);
        } catch (error) {
          observation = `Error executing tool: ${error instanceof Error ? error.message : String(error)}`;
        }
      } else {
        observation = `Tool ${toolCall.toolName} not found`;
      }
    } else {
      observation = response;
    }

    const step: AgentStep = {
      stepNumber,
      action: toolCall ? 'tool_call' : 'final_answer',
      toolName: toolCall?.toolName,
      toolInput: toolCall?.toolInput,
      observation,
      timestamp: Date.now(),
    };

    this.steps.push(step);
    return step;
  }

  async run(userInput: string, modelName: string): Promise<{ steps: AgentStep[]; finalOutput: string }> {
    this.steps = [];
    this.thoughts = [];

    for (let i = 0; i < this.config.maxSteps; i++) {
      const step = await this.executeStep(userInput, modelName);

      if (step.action === 'final_answer') {
        return {
          steps: this.steps,
          finalOutput: step.observation,
        };
      }
    }

    return {
      steps: this.steps,
      finalOutput: 'Max steps reached',
    };
  }

  getSteps(): AgentStep[] {
    return this.steps;
  }

  reset(): void {
    this.steps = [];
    this.thoughts = [];
    this.conversationHistory = [];
  }
}

const builtInTools: Record<string, ToolDefinition> = {
  calculator: {
    name: 'calculator',
    description: 'Performs mathematical calculations',
    parameters: {
      expression: { type: 'string', description: 'Math expression to evaluate' },
    },
    handler: async (params) => {
      try {
        const result = Function('"use strict"; return (' + params.expression + ')')();
        return JSON.stringify({ result });
      } catch (error) {
        return JSON.stringify({ error: String(error) });
      }
    },
  },
  datetime: {
    name: 'datetime',
    description: 'Gets current date and time information',
    parameters: {
      format: { type: 'string', description: 'Format type: iso, unix, readable' },
    },
    handler: async (params) => {
      const now = new Date();
      const formats: Record<string, any> = {
        iso: now.toISOString(),
        unix: now.getTime(),
        readable: now.toString(),
      };
      return JSON.stringify({ timestamp: formats[params.format || 'iso'] });
    },
  },
  memory_save: {
    name: 'memory_save',
    description: 'Save information to working memory',
    parameters: {
      key: { type: 'string', description: 'Memory key' },
      value: { type: 'string', description: 'Memory value' },
    },
    handler: async (params) => {
      return JSON.stringify({ saved: true, key: params.key });
    },
  },
};

export function getBuiltInTools(): ToolDefinition[] {
  return Object.values(builtInTools);
}
