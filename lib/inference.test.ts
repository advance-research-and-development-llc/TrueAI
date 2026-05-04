import { InferenceEngine, getInferenceEngine, setInferenceEngineUrl } from './inference';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('InferenceEngine', () => {
  let engine: InferenceEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new InferenceEngine('http://localhost:11434');
  });

  describe('constructor', () => {
    it('should create engine with default URL', () => {
      const defaultEngine = new InferenceEngine();
      expect(defaultEngine).toBeInstanceOf(InferenceEngine);
    });

    it('should create engine with custom URL', () => {
      const customEngine = new InferenceEngine('http://custom:8080');
      expect(customEngine).toBeInstanceOf(InferenceEngine);
    });

    it('should use default config values', () => {
      const engine = new InferenceEngine();
      expect(engine).toBeDefined();
    });

    it('should accept custom default config', () => {
      const engine = new InferenceEngine('http://localhost:11434', {
        temperature: 0.5,
        maxTokens: 1000,
      });
      expect(engine).toBeDefined();
    });
  });

  describe('checkConnectivity', () => {
    it('should return true when connection succeeds', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });

      const result = await engine.checkConnectivity();

      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        { timeout: 5000 }
      );
    });

    it('should return false when connection fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Connection refused'));

      const result = await engine.checkConnectivity();

      expect(result).toBe(false);
    });

    it('should return false on timeout', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Timeout'));

      const result = await engine.checkConnectivity();

      expect(result).toBe(false);
    });
  });

  describe('listModels', () => {
    it('should return list of model names', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          models: [
            { name: 'llama2:7b' },
            { name: 'mistral:latest' },
          ],
        },
      });

      const models = await engine.listModels();

      expect(models).toEqual(['llama2:7b', 'mistral:latest']);
    });

    it('should return empty array when no models', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { models: [] },
      });

      const models = await engine.listModels();

      expect(models).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API error'));

      const models = await engine.listModels();

      expect(models).toEqual([]);
    });

    it('should handle missing models field', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {},
      });

      const models = await engine.listModels();

      expect(models).toEqual([]);
    });
  });

  describe('pullModel', () => {
    it('should successfully pull a model', async () => {
      const mockStream: any = {
        on: jest.fn((event: string, callback: any): any => {
          if (event === 'end') {
            callback();
          }
          return mockStream;
        }),
      };

      mockedAxios.post.mockResolvedValue({
        data: mockStream,
      });

      await engine.pullModel('llama2:7b');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/pull',
        { name: 'llama2:7b', stream: true },
        { responseType: 'stream' }
      );
    });

    it('should call onProgress callback with status updates', async () => {
      const onProgress = jest.fn();
      const mockData = Buffer.from(JSON.stringify({ status: 'pulling manifest' }));

      const mockStream: any = {
        on: jest.fn((event: string, callback: any): any => {
          if (event === 'data') {
            callback(mockData);
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        }),
      };

      mockedAxios.post.mockResolvedValue({
        data: mockStream,
      });

      await engine.pullModel('llama2:7b', onProgress);

      expect(onProgress).toHaveBeenCalledWith('pulling manifest');
    });

    it('should handle errors during pull', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Pull failed'));

      await expect(engine.pullModel('nonexistent')).rejects.toThrow('Pull failed');
    });
  });

  describe('generate', () => {
    it('should generate response without system prompt', async () => {
      const mockContent = 'Hello, World!';
      const mockData = Buffer.from(
        JSON.stringify({ message: { content: mockContent }, done: true })
      );

      const mockStream: any = {
        on: jest.fn((event: string, callback: any): any => {
          if (event === 'data') {
            callback(mockData);
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        }),
      };

      mockedAxios.post.mockResolvedValue({
        data: mockStream,
      });

      const response = await engine.generate('llama2:7b', 'Hello');

      expect(response).toBe(mockContent);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          model: 'llama2:7b',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: true,
        }),
        { responseType: 'stream' }
      );
    });

    it('should include system prompt when provided', async () => {
      const mockData = Buffer.from(
        JSON.stringify({ message: { content: 'Response' }, done: true })
      );

      const mockStream: any = {
        on: jest.fn((event: string, callback: any): any => {
          if (event === 'data') {
            callback(mockData);
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        }),
      };

      mockedAxios.post.mockResolvedValue({
        data: mockStream,
      });

      await engine.generate('llama2:7b', 'Hello', 'You are helpful');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'Hello' },
          ],
        }),
        { responseType: 'stream' }
      );
    });

    it('should use custom config parameters', async () => {
      const mockData = Buffer.from(
        JSON.stringify({ message: { content: 'Response' }, done: true })
      );

      const mockStream: any = {
        on: jest.fn((event: string, callback: any): any => {
          if (event === 'data') {
            callback(mockData);
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        }),
      };

      mockedAxios.post.mockResolvedValue({
        data: mockStream,
      });

      await engine.generate('llama2:7b', 'Hello', undefined, {
        temperature: 0.5,
        topP: 0.8,
        maxTokens: 500,
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          options: expect.objectContaining({
            temperature: 0.5,
            top_p: 0.8,
            num_predict: 500,
          }),
        }),
        { responseType: 'stream' }
      );
    });

    it('should call onChunk callback for streaming', async () => {
      const onChunk = jest.fn();
      const mockData1 = Buffer.from(
        JSON.stringify({ message: { content: 'Hello ' }, done: false })
      );
      const mockData2 = Buffer.from(
        JSON.stringify({ message: { content: 'World' }, done: true })
      );

      const mockStream: any = {
        on: jest.fn((event: string, callback: any): any => {
          if (event === 'data') {
            callback(mockData1);
            callback(mockData2);
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        }),
      };

      mockedAxios.post.mockResolvedValue({
        data: mockStream,
      });

      const response = await engine.generate('llama2:7b', 'Hello', undefined, {}, onChunk);

      expect(onChunk).toHaveBeenCalledWith({ token: 'Hello ', done: false });
      expect(onChunk).toHaveBeenCalledWith({ token: 'World', done: true });
      expect(response).toBe('Hello World');
    });

    it('should handle generation errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Generation failed'));

      await expect(engine.generate('llama2:7b', 'Hello')).rejects.toThrow(
        'Generation failed'
      );
    });
  });

  describe('embeddings', () => {
    it('should generate embeddings for text', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
      mockedAxios.post.mockResolvedValue({
        data: { embedding: mockEmbedding },
      });

      const result = await engine.embeddings('llama2:7b', 'test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/embed',
        {
          model: 'llama2:7b',
          input: 'test text',
        }
      );
    });

    it('should return empty array on error', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Embedding failed'));

      const result = await engine.embeddings('llama2:7b', 'test text');

      expect(result).toEqual([]);
    });

    it('should handle missing embedding field', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {},
      });

      const result = await engine.embeddings('llama2:7b', 'test text');

      expect(result).toEqual([]);
    });
  });
});

describe('Module Functions', () => {
  describe('getInferenceEngine', () => {
    it('should return singleton instance', () => {
      const engine1 = getInferenceEngine();
      const engine2 = getInferenceEngine();

      expect(engine1).toBe(engine2);
    });

    it('should create engine with custom URL', () => {
      const engine = getInferenceEngine('http://custom:8080');
      expect(engine).toBeInstanceOf(InferenceEngine);
    });
  });

  describe('setInferenceEngineUrl', () => {
    it('should create new engine with custom URL', () => {
      setInferenceEngineUrl('http://newurl:8080');
      const engine = getInferenceEngine();
      expect(engine).toBeInstanceOf(InferenceEngine);
    });
  });
});
