/**
 * Multi-Model Ensemble Service
 *
 * Runs multiple AI models in parallel or sequence and combines their results
 * for improved accuracy, consensus-based decisions, and diverse perspectives.
 */

import { supabase, Database } from './supabase';
import { InferenceService } from './inference';

type Tables = Database['public']['Tables'];

// ===== Types =====

export interface EnsembleConfig {
  models: string[];
  strategy: 'parallel' | 'sequential' | 'voting' | 'weighted' | 'best-of-n';
  weights?: Record<string, number>; // For weighted strategy
  votingThreshold?: number; // For voting strategy (0-1)
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface ModelResponse {
  model: string;
  response: string;
  tokensUsed: number;
  duration: number;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface EnsembleResult {
  id: string;
  strategy: string;
  models: string[];
  prompt: string;
  individualResponses: ModelResponse[];
  combinedResponse: string;
  totalDuration: number;
  totalTokens: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface EnsembleStrategy {
  execute(
    prompt: string,
    models: string[],
    inferenceService: InferenceService,
    config: EnsembleConfig
  ): Promise<EnsembleResult>;
}

// ===== Strategies =====

class ParallelStrategy implements EnsembleStrategy {
  async execute(
    prompt: string,
    models: string[],
    inferenceService: InferenceService,
    config: EnsembleConfig
  ): Promise<EnsembleResult> {
    const startTime = Date.now();
    const responses: ModelResponse[] = [];

    // Run all models in parallel
    const promises = models.map(async (model) => {
      const modelStart = Date.now();
      let response = '';
      let tokens = 0;

      try {
        response = await inferenceService.generate(model, prompt);
        // Approximate token count from response length
        tokens = Math.ceil(response.length / 4);

        return {
          model,
          response,
          tokensUsed: tokens,
          duration: Date.now() - modelStart,
        };
      } catch (error) {
        return {
          model,
          response: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          tokensUsed: 0,
          duration: Date.now() - modelStart,
        };
      }
    });

    responses.push(...(await Promise.all(promises)));

    // Combine responses (simple concatenation for parallel)
    const combinedResponse = this.combineResponses(responses);

    return {
      id: Date.now().toString(),
      strategy: 'parallel',
      models,
      prompt,
      individualResponses: responses,
      combinedResponse,
      totalDuration: Date.now() - startTime,
      totalTokens: responses.reduce((sum, r) => sum + r.tokensUsed, 0),
      metadata: { strategy: 'parallel' },
      created_at: new Date().toISOString(),
    };
  }

  private combineResponses(responses: ModelResponse[]): string {
    return responses
      .map((r, i) => `**Model ${i + 1} (${r.model}):**\n${r.response}`)
      .join('\n\n---\n\n');
  }
}

class SequentialStrategy implements EnsembleStrategy {
  async execute(
    prompt: string,
    models: string[],
    inferenceService: InferenceService,
    config: EnsembleConfig
  ): Promise<EnsembleResult> {
    const startTime = Date.now();
    const responses: ModelResponse[] = [];
    let context = prompt;

    // Run models sequentially, each building on the previous
    for (const model of models) {
      const modelStart = Date.now();
      let response = '';
      let tokens = 0;

      try {
        response = await inferenceService.generate(model, context);
        // Approximate token count from response length
        tokens = Math.ceil(response.length / 4);

        responses.push({
          model,
          response,
          tokensUsed: tokens,
          duration: Date.now() - modelStart,
        });

        // Next model sees previous response
        context = `${prompt}\n\nPrevious response: ${response}\n\nPlease refine or improve this response:`;
      } catch (error) {
        responses.push({
          model,
          response: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          tokensUsed: 0,
          duration: Date.now() - modelStart,
        });
        break;
      }
    }

    // Final response is the last model's output
    const combinedResponse = responses[responses.length - 1]?.response || '';

    return {
      id: Date.now().toString(),
      strategy: 'sequential',
      models,
      prompt,
      individualResponses: responses,
      combinedResponse,
      totalDuration: Date.now() - startTime,
      totalTokens: responses.reduce((sum, r) => sum + r.tokensUsed, 0),
      metadata: { strategy: 'sequential', iterations: responses.length },
      created_at: new Date().toISOString(),
    };
  }
}

class VotingStrategy implements EnsembleStrategy {
  async execute(
    prompt: string,
    models: string[],
    inferenceService: InferenceService,
    config: EnsembleConfig
  ): Promise<EnsembleResult> {
    const startTime = Date.now();
    const responses: ModelResponse[] = [];

    // Get responses from all models
    const promises = models.map(async (model) => {
      const modelStart = Date.now();
      let response = '';
      let tokens = 0;

      try {
        response = await inferenceService.generate(model, prompt);
        // Approximate token count from response length
        tokens = Math.ceil(response.length / 4);

        return {
          model,
          response,
          tokensUsed: tokens,
          duration: Date.now() - modelStart,
        };
      } catch (error) {
        return {
          model,
          response: '',
          tokensUsed: 0,
          duration: Date.now() - modelStart,
        };
      }
    });

    responses.push(...(await Promise.all(promises)));

    // Find consensus or most common response
    const combinedResponse = this.findConsensus(responses, config.votingThreshold || 0.5);

    return {
      id: Date.now().toString(),
      strategy: 'voting',
      models,
      prompt,
      individualResponses: responses,
      combinedResponse,
      totalDuration: Date.now() - startTime,
      totalTokens: responses.reduce((sum, r) => sum + r.tokensUsed, 0),
      metadata: {
        strategy: 'voting',
        threshold: config.votingThreshold,
        consensus: this.calculateConsensus(responses),
      },
      created_at: new Date().toISOString(),
    };
  }

  private findConsensus(responses: ModelResponse[], threshold: number): string {
    // Simple similarity-based consensus
    // In production, use semantic similarity
    const validResponses = responses.filter((r) => r.response.length > 0);

    if (validResponses.length === 0) {
      return 'No valid responses from models.';
    }

    // For now, return the longest response (most detailed)
    // Could be improved with semantic similarity analysis
    return validResponses.reduce((longest, current) =>
      current.response.length > longest.response.length ? current : longest
    ).response;
  }

  private calculateConsensus(responses: ModelResponse[]): number {
    // Calculate similarity between responses
    // Simplified: return 1.0 if all responses similar, 0.0 if all different
    const validResponses = responses.filter((r) => r.response.length > 0);
    if (validResponses.length <= 1) return 1.0;

    // Simple heuristic: check if responses have similar length and keywords
    const avgLength =
      validResponses.reduce((sum, r) => sum + r.response.length, 0) / validResponses.length;
    const lengthVariance = validResponses.reduce(
      (sum, r) => sum + Math.abs(r.response.length - avgLength),
      0
    );

    return Math.max(0, 1 - lengthVariance / (avgLength * validResponses.length));
  }
}

class WeightedStrategy implements EnsembleStrategy {
  async execute(
    prompt: string,
    models: string[],
    inferenceService: InferenceService,
    config: EnsembleConfig
  ): Promise<EnsembleResult> {
    const startTime = Date.now();
    const responses: ModelResponse[] = [];
    const weights = config.weights || {};

    // Normalize weights
    const totalWeight = models.reduce((sum, model) => sum + (weights[model] || 1), 0);
    const normalizedWeights = models.reduce(
      (acc, model) => {
        acc[model] = (weights[model] || 1) / totalWeight;
        return acc;
      },
      {} as Record<string, number>
    );

    // Get responses from all models
    const promises = models.map(async (model) => {
      const modelStart = Date.now();
      let response = '';
      let tokens = 0;

      try {
        response = await inferenceService.generate(model, prompt);
        // Approximate token count from response length
        tokens = Math.ceil(response.length / 4);

        return {
          model,
          response,
          tokensUsed: tokens,
          duration: Date.now() - modelStart,
          confidence: normalizedWeights[model],
        };
      } catch (error) {
        return {
          model,
          response: '',
          tokensUsed: 0,
          duration: Date.now() - modelStart,
          confidence: 0,
        };
      }
    });

    responses.push(...(await Promise.all(promises)));

    // Combine responses with weights
    const combinedResponse = this.weightedCombine(responses, normalizedWeights);

    return {
      id: Date.now().toString(),
      strategy: 'weighted',
      models,
      prompt,
      individualResponses: responses,
      combinedResponse,
      totalDuration: Date.now() - startTime,
      totalTokens: responses.reduce((sum, r) => sum + r.tokensUsed, 0),
      metadata: { strategy: 'weighted', weights: normalizedWeights },
      created_at: new Date().toISOString(),
    };
  }

  private weightedCombine(
    responses: ModelResponse[],
    weights: Record<string, number>
  ): string {
    // Sort by weight (highest first)
    const sorted = responses.sort((a, b) => (weights[b.model] || 0) - (weights[a.model] || 0));

    // Present responses with weight indicators
    return sorted
      .map(
        (r) =>
          `**${r.model}** (weight: ${((weights[r.model] || 0) * 100).toFixed(0)}%):\n${r.response}`
      )
      .join('\n\n---\n\n');
  }
}

class BestOfNStrategy implements EnsembleStrategy {
  async execute(
    prompt: string,
    models: string[],
    inferenceService: InferenceService,
    config: EnsembleConfig
  ): Promise<EnsembleResult> {
    const startTime = Date.now();
    const responses: ModelResponse[] = [];

    // Get responses from all models
    const promises = models.map(async (model) => {
      const modelStart = Date.now();
      let response = '';
      let tokens = 0;

      try {
        response = await inferenceService.generate(model, prompt);
        // Approximate token count from response length
        tokens = Math.ceil(response.length / 4);

        return {
          model,
          response,
          tokensUsed: tokens,
          duration: Date.now() - modelStart,
        };
      } catch (error) {
        return {
          model,
          response: '',
          tokensUsed: 0,
          duration: Date.now() - modelStart,
        };
      }
    });

    responses.push(...(await Promise.all(promises)));

    // Select best response (currently by length, could use quality metrics)
    const bestResponse = this.selectBest(responses);

    return {
      id: Date.now().toString(),
      strategy: 'best-of-n',
      models,
      prompt,
      individualResponses: responses,
      combinedResponse: bestResponse.response,
      totalDuration: Date.now() - startTime,
      totalTokens: responses.reduce((sum, r) => sum + r.tokensUsed, 0),
      metadata: {
        strategy: 'best-of-n',
        selectedModel: bestResponse.model,
        allModelsAttempted: models.length,
      },
      created_at: new Date().toISOString(),
    };
  }

  private selectBest(responses: ModelResponse[]): ModelResponse {
    // Select best based on response quality heuristics
    const validResponses = responses.filter((r) => r.response.length > 0);

    if (validResponses.length === 0) {
      return { model: 'none', response: 'No valid responses', tokensUsed: 0, duration: 0 };
    }

    // Score based on length, coherence, and speed
    const scored = validResponses.map((r) => ({
      response: r,
      score: this.scoreResponse(r),
    }));

    // Return highest scoring response
    return scored.reduce((best, current) => (current.score > best.score ? current : best)).response;
  }

  private scoreResponse(response: ModelResponse): number {
    // Simple scoring: balance length and speed
    const lengthScore = Math.min(response.response.length / 500, 1); // Favor longer (up to 500 chars)
    const speedScore = 1 / (1 + response.duration / 1000); // Favor faster responses

    return lengthScore * 0.7 + speedScore * 0.3;
  }
}

// ===== Multi-Model Ensemble Service =====

export class MultiModelEnsembleService {
  private strategies: Record<string, EnsembleStrategy> = {
    parallel: new ParallelStrategy(),
    sequential: new SequentialStrategy(),
    voting: new VotingStrategy(),
    weighted: new WeightedStrategy(),
    'best-of-n': new BestOfNStrategy(),
  };

  async runEnsemble(
    prompt: string,
    config: EnsembleConfig,
    inferenceService: InferenceService,
    userId?: string
  ): Promise<EnsembleResult> {
    const strategy = this.strategies[config.strategy];
    if (!strategy) {
      throw new Error(`Unknown strategy: ${config.strategy}`);
    }

    const result = await strategy.execute(prompt, config.models, inferenceService, config);

    // Save result if userId provided
    if (userId) {
      await this.saveEnsembleResult(userId, result);
    }

    return result;
  }

  private async saveEnsembleResult(userId: string, result: EnsembleResult): Promise<void> {
    const { error } = await supabase.from('ensemble_results').insert({
      user_id: userId,
      strategy: result.strategy,
      models: result.models,
      prompt: result.prompt,
      individual_responses: result.individualResponses as any,
      combined_response: result.combinedResponse,
      total_duration: result.totalDuration,
      total_tokens: result.totalTokens,
      metadata: result.metadata,
    });

    if (error) throw error;
  }

  async getEnsembleResults(userId: string, limit: number = 10): Promise<EnsembleResult[]> {
    const { data, error } = await supabase
      .from('ensemble_results')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      strategy: row.strategy,
      models: row.models,
      prompt: row.prompt,
      individualResponses: row.individual_responses as ModelResponse[],
      combinedResponse: row.combined_response,
      totalDuration: row.total_duration,
      totalTokens: row.total_tokens,
      metadata: row.metadata,
      created_at: row.created_at,
    }));
  }

  async getEnsembleResult(resultId: string): Promise<EnsembleResult | null> {
    const { data, error } = await supabase
      .from('ensemble_results')
      .select('*')
      .eq('id', resultId)
      .single();

    if (error) return null;

    return {
      id: data.id,
      strategy: data.strategy,
      models: data.models,
      prompt: data.prompt,
      individualResponses: data.individual_responses as ModelResponse[],
      combinedResponse: data.combined_response,
      totalDuration: data.total_duration,
      totalTokens: data.total_tokens,
      metadata: data.metadata,
      created_at: data.created_at,
    };
  }

  getAvailableStrategies(): string[] {
    return Object.keys(this.strategies);
  }
}

// ===== Singleton =====

let multiModelEnsembleServiceInstance: MultiModelEnsembleService | null = null;

export function getMultiModelEnsembleService(): MultiModelEnsembleService {
  if (!multiModelEnsembleServiceInstance) {
    multiModelEnsembleServiceInstance = new MultiModelEnsembleService();
  }
  return multiModelEnsembleServiceInstance;
}
