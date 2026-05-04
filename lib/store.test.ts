import { useAppStore, loadAppState } from './store';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage');
const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      userId: null,
      theme: 'dark',
      ollamaUrl: 'http://localhost:11434',
      activeModelId: null,
      activeConversationId: null,
      conversations: [],
      messages: [],
      models: [],
      agents: [],
      extensions: [],
    });
    jest.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should have correct default values', () => {
      const state = useAppStore.getState();

      expect(state.userId).toBeNull();
      expect(state.theme).toBe('dark');
      expect(state.ollamaUrl).toBe('http://localhost:11434');
      expect(state.activeModelId).toBeNull();
      expect(state.activeConversationId).toBeNull();
      expect(state.conversations).toEqual([]);
      expect(state.messages).toEqual([]);
      expect(state.models).toEqual([]);
      expect(state.agents).toEqual([]);
      expect(state.extensions).toEqual([]);
    });
  });

  describe('setUserId', () => {
    it('should set user ID and persist to storage', () => {
      useAppStore.getState().setUserId('user123');

      expect(useAppStore.getState().userId).toBe('user123');
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith('userId', 'user123');
    });

    it('should remove user ID from storage when set to null', () => {
      useAppStore.getState().setUserId(null);

      expect(useAppStore.getState().userId).toBeNull();
      expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith('userId');
    });
  });

  describe('setTheme', () => {
    it('should set theme to light', () => {
      useAppStore.getState().setTheme('light');

      expect(useAppStore.getState().theme).toBe('light');
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith('theme', 'light');
    });

    it('should set theme to dark', () => {
      useAppStore.getState().setTheme('dark');

      expect(useAppStore.getState().theme).toBe('dark');
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
    });
  });

  describe('setOllamaUrl', () => {
    it('should set and persist Ollama URL', () => {
      useAppStore.getState().setOllamaUrl('http://custom:11434');

      expect(useAppStore.getState().ollamaUrl).toBe('http://custom:11434');
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith('ollamaUrl', 'http://custom:11434');
    });
  });

  describe('setActiveModelId', () => {
    it('should set and persist active model ID', () => {
      useAppStore.getState().setActiveModelId('model123');

      expect(useAppStore.getState().activeModelId).toBe('model123');
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith('activeModelId', 'model123');
    });
  });

  describe('setActiveConversationId', () => {
    it('should set and persist active conversation ID', () => {
      useAppStore.getState().setActiveConversationId('conv123');

      expect(useAppStore.getState().activeConversationId).toBe('conv123');
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith('activeConversationId', 'conv123');
    });
  });

  describe('Conversations', () => {
    const mockConversation: any = {
      id: 'conv1',
      user_id: 'user1',
      title: 'Test Conversation',
      model_id: 'model1',
      agent_id: null,
      system_prompt: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    it('should set conversations', () => {
      useAppStore.getState().setConversations([mockConversation]);

      expect(useAppStore.getState().conversations).toEqual([mockConversation]);
    });

    it('should add conversation to beginning', () => {
      const conv2 = { ...mockConversation, id: 'conv2', title: 'Second' };
      useAppStore.getState().setConversations([mockConversation]);
      useAppStore.getState().addConversation(conv2);

      const conversations = useAppStore.getState().conversations;
      expect(conversations[0]).toEqual(conv2);
      expect(conversations[1]).toEqual(mockConversation);
    });

    it('should remove conversation and related messages', () => {
      const message: any = {
        id: 'msg1',
        conversation_id: 'conv1',
        role: 'user',
        content: 'Hello',
        tool_calls: null,
        tool_results: null,
        timestamp: '2024-01-01',
      };

      useAppStore.getState().setConversations([mockConversation]);
      useAppStore.getState().setMessages([message]);
      useAppStore.getState().removeConversation('conv1');

      expect(useAppStore.getState().conversations).toEqual([]);
      expect(useAppStore.getState().messages).toEqual([]);
    });

    it('should update conversation', () => {
      useAppStore.getState().setConversations([mockConversation]);
      useAppStore.getState().updateConversation('conv1', { title: 'Updated Title' });

      expect(useAppStore.getState().conversations[0].title).toBe('Updated Title');
    });

    it('should clear all conversations and messages', () => {
      useAppStore.getState().setConversations([mockConversation]);
      useAppStore.getState().setMessages([{} as any]);
      useAppStore.getState().clearConversations();

      expect(useAppStore.getState().conversations).toEqual([]);
      expect(useAppStore.getState().messages).toEqual([]);
    });
  });

  describe('Messages', () => {
    const mockMessage: any = {
      id: 'msg1',
      conversation_id: 'conv1',
      role: 'user',
      content: 'Hello',
      tool_calls: null,
      tool_results: null,
      timestamp: '2024-01-01',
    };

    it('should set messages', () => {
      useAppStore.getState().setMessages([mockMessage]);

      expect(useAppStore.getState().messages).toEqual([mockMessage]);
    });

    it('should add message to end', () => {
      const msg2 = { ...mockMessage, id: 'msg2', content: 'Second' };
      useAppStore.getState().setMessages([mockMessage]);
      useAppStore.getState().addMessage(msg2);

      const messages = useAppStore.getState().messages;
      expect(messages[0]).toEqual(mockMessage);
      expect(messages[1]).toEqual(msg2);
    });

    it('should remove message', () => {
      useAppStore.getState().setMessages([mockMessage]);
      useAppStore.getState().removeMessage('msg1');

      expect(useAppStore.getState().messages).toEqual([]);
    });
  });

  describe('Models', () => {
    const mockModel: any = {
      id: 'model1',
      user_id: 'user1',
      name: 'llama2:7b',
      source: 'ollama',
      model_type: 'llm',
      size_bytes: 4000000000,
      status: 'ready',
      local_path: null,
      remote_url: null,
      quantization: 'q4',
      context_length: 4096,
      metadata: {},
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    it('should set models', () => {
      useAppStore.getState().setModels([mockModel]);

      expect(useAppStore.getState().models).toEqual([mockModel]);
    });

    it('should add model to beginning', () => {
      const model2 = { ...mockModel, id: 'model2', name: 'mistral' };
      useAppStore.getState().setModels([mockModel]);
      useAppStore.getState().addModel(model2);

      const models = useAppStore.getState().models;
      expect(models[0]).toEqual(model2);
    });

    it('should remove model', () => {
      useAppStore.getState().setModels([mockModel]);
      useAppStore.getState().removeModel('model1');

      expect(useAppStore.getState().models).toEqual([]);
    });

    it('should update model', () => {
      useAppStore.getState().setModels([mockModel]);
      useAppStore.getState().updateModel('model1', { status: 'downloading' });

      expect(useAppStore.getState().models[0].status).toBe('downloading');
    });
  });

  describe('Agents', () => {
    const mockAgent: any = {
      id: 'agent1',
      user_id: 'user1',
      name: 'Test Agent',
      description: 'An agent for testing',
      system_prompt: 'You are helpful',
      tools_enabled: ['calculator'],
      harness_ids: [],
      config_json: {},
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    it('should set agents', () => {
      useAppStore.getState().setAgents([mockAgent]);

      expect(useAppStore.getState().agents).toEqual([mockAgent]);
    });

    it('should add agent to beginning', () => {
      const agent2 = { ...mockAgent, id: 'agent2', name: 'Second Agent' };
      useAppStore.getState().setAgents([mockAgent]);
      useAppStore.getState().addAgent(agent2);

      const agents = useAppStore.getState().agents;
      expect(agents[0]).toEqual(agent2);
    });

    it('should remove agent', () => {
      useAppStore.getState().setAgents([mockAgent]);
      useAppStore.getState().removeAgent('agent1');

      expect(useAppStore.getState().agents).toEqual([]);
    });

    it('should update agent', () => {
      useAppStore.getState().setAgents([mockAgent]);
      useAppStore.getState().updateAgent('agent1', { name: 'Updated Agent' });

      expect(useAppStore.getState().agents[0].name).toBe('Updated Agent');
    });
  });

  describe('Extensions', () => {
    const mockExtension: any = {
      id: 'ext1',
      user_id: 'user1',
      name: 'Test Extension',
      harness_type: 'test',
      repo_url: 'https://github.com/test/ext',
      version: '1.0.0',
      installed_at: '2024-01-01',
      enabled: true,
      manifest_json: {},
      metadata: {},
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    it('should set extensions', () => {
      useAppStore.getState().setExtensions([mockExtension]);

      expect(useAppStore.getState().extensions).toEqual([mockExtension]);
    });

    it('should add extension to beginning', () => {
      const ext2 = { ...mockExtension, id: 'ext2', name: 'Second Extension' };
      useAppStore.getState().setExtensions([mockExtension]);
      useAppStore.getState().addExtension(ext2);

      const extensions = useAppStore.getState().extensions;
      expect(extensions[0]).toEqual(ext2);
    });

    it('should remove extension', () => {
      useAppStore.getState().setExtensions([mockExtension]);
      useAppStore.getState().removeExtension('ext1');

      expect(useAppStore.getState().extensions).toEqual([]);
    });

    it('should update extension', () => {
      useAppStore.getState().setExtensions([mockExtension]);
      useAppStore.getState().updateExtension('ext1', { enabled: false });

      expect(useAppStore.getState().extensions[0].enabled).toBe(false);
    });
  });
});

describe('loadAppState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.setState({
      userId: null,
      theme: 'dark',
      ollamaUrl: 'http://localhost:11434',
      activeModelId: null,
      activeConversationId: null,
      conversations: [],
      messages: [],
      models: [],
      agents: [],
      extensions: [],
    });
  });

  it('should load saved theme', async () => {
    mockedAsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'theme') return Promise.resolve('light');
      return Promise.resolve(null);
    });

    await loadAppState();

    expect(useAppStore.getState().theme).toBe('light');
  });

  it('should load saved ollama URL', async () => {
    mockedAsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'ollamaUrl') return Promise.resolve('http://custom:11434');
      return Promise.resolve(null);
    });

    await loadAppState();

    expect(useAppStore.getState().ollamaUrl).toBe('http://custom:11434');
  });

  it('should load saved active model ID', async () => {
    mockedAsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'activeModelId') return Promise.resolve('model123');
      return Promise.resolve(null);
    });

    await loadAppState();

    expect(useAppStore.getState().activeModelId).toBe('model123');
  });

  it('should load saved active conversation ID', async () => {
    mockedAsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'activeConversationId') return Promise.resolve('conv123');
      return Promise.resolve(null);
    });

    await loadAppState();

    expect(useAppStore.getState().activeConversationId).toBe('conv123');
  });

  it('should handle null values', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(null);

    await loadAppState();

    // Should retain default values
    expect(useAppStore.getState().theme).toBe('dark');
    expect(useAppStore.getState().ollamaUrl).toBe('http://localhost:11434');
  });

  it('should load all values at once', async () => {
    mockedAsyncStorage.getItem.mockImplementation((key) => {
      const values: Record<string, string> = {
        theme: 'light',
        ollamaUrl: 'http://custom:11434',
        activeModelId: 'model123',
        activeConversationId: 'conv123',
      };
      return Promise.resolve(values[key] || null);
    });

    await loadAppState();

    expect(useAppStore.getState().theme).toBe('light');
    expect(useAppStore.getState().ollamaUrl).toBe('http://custom:11434');
    expect(useAppStore.getState().activeModelId).toBe('model123');
    expect(useAppStore.getState().activeConversationId).toBe('conv123');
  });
});
