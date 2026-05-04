import axios from 'axios';

export interface InferenceConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  repeatPenalty?: number;
}

export interface StreamChunk {
  token: string;
  done: boolean;
}

export class InferenceEngine {
  private ollamaUrl: string;
  private defaultConfig: InferenceConfig;

  constructor(ollamaUrl: string = 'http://localhost:11434', defaultConfig: InferenceConfig = {}) {
    this.ollamaUrl = ollamaUrl;
    this.defaultConfig = {
      temperature: defaultConfig.temperature ?? 0.7,
      topP: defaultConfig.topP ?? 0.9,
      topK: defaultConfig.topK ?? 40,
      maxTokens: defaultConfig.maxTokens ?? 2000,
      repeatPenalty: defaultConfig.repeatPenalty ?? 1.1,
    };
  }

  async checkConnectivity(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`);
      return response.data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      console.error('Error listing Ollama models:', error);
      return [];
    }
  }

  async pullModel(modelName: string, onProgress?: (status: string) => void): Promise<void> {
    try {
      const response = await axios.post(
        `${this.ollamaUrl}/api/pull`,
        { name: modelName, stream: true },
        { responseType: 'stream' }
      );

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          const line = chunk.toString('utf-8').trim();
          if (line) {
            try {
              const data = JSON.parse(line);
              onProgress?.(data.status || '');
            } catch {}
          }
        });
        response.data.on('end', () => resolve());
        response.data.on('error', reject);
      });
    } catch (error) {
      console.error('Error pulling model:', error);
      throw error;
    }
  }

  async generate(
    modelName: string,
    prompt: string,
    systemPrompt?: string,
    config?: Partial<InferenceConfig>,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<string> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const messages: { role: string; content: string }[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    try {
      const response = await axios.post(
        `${this.ollamaUrl}/api/chat`,
        {
          model: modelName,
          messages,
          stream: true,
          options: {
            temperature: finalConfig.temperature,
            top_p: finalConfig.topP,
            top_k: finalConfig.topK,
            num_predict: finalConfig.maxTokens,
            repeat_penalty: finalConfig.repeatPenalty,
          },
        },
        { responseType: 'stream' }
      );

      let fullResponse = '';

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          const line = chunk.toString('utf-8').trim();
          if (line) {
            try {
              const data = JSON.parse(line);
              if (data.message?.content) {
                fullResponse += data.message.content;
                onChunk?.({ token: data.message.content, done: data.done || false });
              }
            } catch {}
          }
        });
        response.data.on('end', () => resolve(fullResponse));
        response.data.on('error', reject);
      });
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  async embeddings(modelName: string, text: string): Promise<number[]> {
    try {
      const response = await axios.post(`${this.ollamaUrl}/api/embed`, {
        model: modelName,
        input: text,
      });
      return response.data.embedding || [];
    } catch (error) {
      console.error('Error generating embeddings:', error);
      return [];
    }
  }
}

let inferenceEngine: InferenceEngine;

export function getInferenceEngine(ollamaUrl?: string): InferenceEngine {
  if (!inferenceEngine) {
    inferenceEngine = new InferenceEngine(ollamaUrl);
  }
  return inferenceEngine;
}

export function setInferenceEngineUrl(url: string): void {
  inferenceEngine = new InferenceEngine(url);
}

// Type alias for backwards compatibility
export type InferenceService = InferenceEngine;
