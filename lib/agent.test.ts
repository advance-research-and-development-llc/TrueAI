import { AgentRuntime, getBuiltInTools, ToolDefinition, AgentConfig } from './agent';
import { InferenceEngine } from './inference';

// Mock the InferenceEngine
jest.mock('./inference');
jest.mock('./supabase');

describe('AgentRuntime', () => {
  let mockInferenceEngine: jest.Mocked<InferenceEngine>;
  let agentConfig: AgentConfig;

  beforeEach(() => {
    mockInferenceEngine = {
      generate: jest.fn(),
    } as any;

    agentConfig = {
      name: 'Test Agent',
      systemPrompt: 'You are a helpful assistant',
      maxSteps: 5,
      temperature: 0.7,
      tools: [],
    };
  });

  describe('constructor', () => {
    it('should create an agent runtime with config', () => {
      const agent = new AgentRuntime(agentConfig, mockInferenceEngine);
      expect(agent).toBeInstanceOf(AgentRuntime);
    });
  });

  describe('executeStep', () => {
    it('should execute a step and return final answer when no tool is used', async () => {
      const agent = new AgentRuntime(agentConfig, mockInferenceEngine);
      mockInferenceEngine.generate.mockResolvedValue('This is my final answer.');

      const step = await agent.executeStep('What is 2+2?', 'test-model');

      expect(step.action).toBe('final_answer');
      expect(step.observation).toBe('This is my final answer.');
      expect(step.stepNumber).toBe(1);
      expect(mockInferenceEngine.generate).toHaveBeenCalledWith(
        'test-model',
        expect.any(String),
        'You are a helpful assistant',
        { temperature: 0.7 }
      );
    });

    it('should parse and execute tool call', async () => {
      const mockTool: ToolDefinition = {
        name: 'calculator',
        description: 'Performs calculations',
        parameters: {},
        handler: jest.fn().mockResolvedValue('{"result": 4}'),
      };

      agentConfig.tools = [mockTool];
      const agent = new AgentRuntime(agentConfig, mockInferenceEngine);

      mockInferenceEngine.generate.mockResolvedValue(
        'TOOL: calculator\nINPUT: {"expression": "2+2"}'
      );

      const step = await agent.executeStep('What is 2+2?', 'test-model');

      expect(step.action).toBe('tool_call');
      expect(step.toolName).toBe('calculator');
      expect(step.toolInput).toEqual({ expression: '2+2' });
      expect(step.observation).toBe('{"result": 4}');
      expect(mockTool.handler).toHaveBeenCalledWith({ expression: '2+2' });
    });

    it('should handle tool not found error', async () => {
      const agent = new AgentRuntime(agentConfig, mockInferenceEngine);

      mockInferenceEngine.generate.mockResolvedValue(
        'TOOL: nonexistent\nINPUT: {}'
      );

      const step = await agent.executeStep('Test', 'test-model');

      expect(step.action).toBe('tool_call');
      expect(step.observation).toBe('Tool nonexistent not found');
    });

    it('should handle tool execution error', async () => {
      const mockTool: ToolDefinition = {
        name: 'failing_tool',
        description: 'A tool that fails',
        parameters: {},
        handler: jest.fn().mockRejectedValue(new Error('Tool failed')),
      };

      agentConfig.tools = [mockTool];
      const agent = new AgentRuntime(agentConfig, mockInferenceEngine);

      mockInferenceEngine.generate.mockResolvedValue(
        'TOOL: failing_tool\nINPUT: {}'
      );

      const step = await agent.executeStep('Test', 'test-model');

      expect(step.observation).toBe('Error executing tool: Tool failed');
    });

    it('should increment step number correctly', async () => {
      const agent = new AgentRuntime(agentConfig, mockInferenceEngine);
      mockInferenceEngine.generate.mockResolvedValue('Answer');

      const step1 = await agent.executeStep('Question 1', 'test-model');
      const step2 = await agent.executeStep('Question 2', 'test-model');

      expect(step1.stepNumber).toBe(1);
      expect(step2.stepNumber).toBe(2);
    });
  });

  describe('run', () => {
    it('should complete when final answer is reached', async () => {
      const agent = new AgentRuntime(agentConfig, mockInferenceEngine);
      mockInferenceEngine.generate.mockResolvedValue('Final answer');

      const result = await agent.run('Test question', 'test-model');

      expect(result.finalOutput).toBe('Final answer');
      expect(result.steps.length).toBe(1);
    });

    it('should stop at max steps', async () => {
      agentConfig.maxSteps = 3;
      const agent = new AgentRuntime(agentConfig, mockInferenceEngine);

      const mockTool: ToolDefinition = {
        name: 'test_tool',
        description: 'Test',
        parameters: {},
        handler: jest.fn().mockResolvedValue('tool result'),
      };
      agentConfig.tools = [mockTool];

      mockInferenceEngine.generate.mockResolvedValue(
        'TOOL: test_tool\nINPUT: {}'
      );

      const result = await agent.run('Test question', 'test-model');

      expect(result.finalOutput).toBe('Max steps reached');
      expect(result.steps.length).toBe(3);
    });

    it('should reset steps before running', async () => {
      const agent = new AgentRuntime(agentConfig, mockInferenceEngine);
      mockInferenceEngine.generate.mockResolvedValue('Answer');

      await agent.run('Question 1', 'test-model');
      const result = await agent.run('Question 2', 'test-model');

      expect(result.steps.length).toBe(1);
    });
  });

  describe('getSteps', () => {
    it('should return all steps', async () => {
      const agent = new AgentRuntime(agentConfig, mockInferenceEngine);
      mockInferenceEngine.generate.mockResolvedValue('Answer');

      await agent.executeStep('Test', 'test-model');
      const steps = agent.getSteps();

      expect(steps.length).toBe(1);
      expect(steps[0].stepNumber).toBe(1);
    });
  });

  describe('reset', () => {
    it('should clear all state', async () => {
      const agent = new AgentRuntime(agentConfig, mockInferenceEngine);
      mockInferenceEngine.generate.mockResolvedValue('Answer');

      await agent.executeStep('Test', 'test-model');
      agent.reset();
      const steps = agent.getSteps();

      expect(steps.length).toBe(0);
    });
  });
});

describe('Built-in Tools', () => {
  describe('getBuiltInTools', () => {
    it('should return array of built-in tools', () => {
      const tools = getBuiltInTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should include calculator tool', () => {
      const tools = getBuiltInTools();
      const calculator = tools.find((t) => t.name === 'calculator');
      expect(calculator).toBeDefined();
      expect(calculator?.description).toContain('mathematical');
    });

    it('should include datetime tool', () => {
      const tools = getBuiltInTools();
      const datetime = tools.find((t) => t.name === 'datetime');
      expect(datetime).toBeDefined();
    });

    it('should include memory_save tool', () => {
      const tools = getBuiltInTools();
      const memory = tools.find((t) => t.name === 'memory_save');
      expect(memory).toBeDefined();
    });
  });

  describe('calculator tool', () => {
    it('should evaluate simple math expression', async () => {
      const tools = getBuiltInTools();
      const calculator = tools.find((t) => t.name === 'calculator')!;

      const result = await calculator.handler({ expression: '2 + 2' });
      const parsed = JSON.parse(result);

      expect(parsed.result).toBe(4);
    });

    it('should handle complex expressions', async () => {
      const tools = getBuiltInTools();
      const calculator = tools.find((t) => t.name === 'calculator')!;

      const result = await calculator.handler({ expression: '(10 + 5) * 2' });
      const parsed = JSON.parse(result);

      expect(parsed.result).toBe(30);
    });

    it('should return error for invalid expression', async () => {
      const tools = getBuiltInTools();
      const calculator = tools.find((t) => t.name === 'calculator')!;

      const result = await calculator.handler({ expression: 'invalid' });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
    });
  });

  describe('datetime tool', () => {
    it('should return ISO format by default', async () => {
      const tools = getBuiltInTools();
      const datetime = tools.find((t) => t.name === 'datetime')!;

      const result = await datetime.handler({});
      const parsed = JSON.parse(result);

      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should return unix timestamp', async () => {
      const tools = getBuiltInTools();
      const datetime = tools.find((t) => t.name === 'datetime')!;

      const result = await datetime.handler({ format: 'unix' });
      const parsed = JSON.parse(result);

      expect(typeof parsed.timestamp).toBe('number');
      expect(parsed.timestamp).toBeGreaterThan(0);
    });

    it('should return readable format', async () => {
      const tools = getBuiltInTools();
      const datetime = tools.find((t) => t.name === 'datetime')!;

      const result = await datetime.handler({ format: 'readable' });
      const parsed = JSON.parse(result);

      expect(typeof parsed.timestamp).toBe('string');
      expect(parsed.timestamp.length).toBeGreaterThan(0);
    });
  });

  describe('memory_save tool', () => {
    it('should save key-value pair', async () => {
      const tools = getBuiltInTools();
      const memory = tools.find((t) => t.name === 'memory_save')!;

      const result = await memory.handler({ key: 'test', value: 'data' });
      const parsed = JSON.parse(result);

      expect(parsed.saved).toBe(true);
      expect(parsed.key).toBe('test');
    });
  });
});
