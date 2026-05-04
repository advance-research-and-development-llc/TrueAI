/**
 * Model Comparison Service
 *
 * Compares different AI models on various tasks and metrics.
 * Helps users select the best model for their use case.
 */

import { supabase, Database } from './supabase';
import { InferenceService } from './inference';

type Tables = Database['public']['Tables'];

// ===== Types =====

export interface BenchmarkTask {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: 'reasoning' | 'coding' | 'creative' | 'factual' | 'conversation';
  expectedOutputType: 'text' | 'code' | 'json' | 'list';
  scoringCriteria: string[];
}

export interface ModelBenchmark {
  model: string;
  task: string;
  prompt: string;
  response: string;
  metrics: {
    duration: number;
    tokensGenerated: number;
    tokensPerSecond: number;
    score: number; // 0-100
    qualityScore: number; // 0-100
    speedScore: number; // 0-100
  };
  timestamp: string;
}

export interface ModelComparison {
  id: string;
  user_id: string;
  models: string[];
  task: BenchmarkTask;
  benchmarks: ModelBenchmark[];
  winner: string | null;
  summary: string;
  created_at: string;
}

export interface ModelPerformanceStats {
  model: string;
  totalRuns: number;
  averageScore: number;
  averageDuration: number;
  averageTokensPerSecond: number;
  strengthCategories: string[];
  weaknessCategories: string[];
}

// ===== Benchmark Tasks =====

export const BENCHMARK_TASKS: BenchmarkTask[] = [
  {
    id: 'reasoning-logic',
    name: 'Logical Reasoning',
    description: 'Tests logical deduction and problem-solving',
    prompt:
      'If all roses are flowers and some flowers fade quickly, can we conclude that some roses fade quickly? Explain your reasoning step by step.',
    category: 'reasoning',
    expectedOutputType: 'text',
    scoringCriteria: ['correctness', 'clarity', 'step-by-step reasoning'],
  },
  {
    id: 'coding-algorithm',
    name: 'Algorithm Implementation',
    description: 'Tests coding ability and algorithmic thinking',
    prompt:
      'Write a Python function to find the longest palindromic substring in a given string. Include time complexity analysis.',
    category: 'coding',
    expectedOutputType: 'code',
    scoringCriteria: ['correctness', 'efficiency', 'code quality', 'explanation'],
  },
  {
    id: 'creative-story',
    name: 'Creative Writing',
    description: 'Tests creative and narrative abilities',
    prompt:
      'Write a short story (150 words) about a robot who learns to paint. Make it emotional and engaging.',
    category: 'creative',
    expectedOutputType: 'text',
    scoringCriteria: ['creativity', 'coherence', 'emotional impact', 'length appropriateness'],
  },
  {
    id: 'factual-history',
    name: 'Factual Knowledge',
    description: 'Tests factual accuracy and knowledge',
    prompt:
      'Explain the causes and consequences of the French Revolution in 3 concise paragraphs.',
    category: 'factual',
    expectedOutputType: 'text',
    scoringCriteria: ['accuracy', 'completeness', 'clarity', 'organization'],
  },
  {
    id: 'conversation-empathy',
    name: 'Conversational Empathy',
    description: 'Tests conversational and empathetic responses',
    prompt:
      "I'm feeling overwhelmed with work and don't know where to start. Can you help me prioritize?",
    category: 'conversation',
    expectedOutputType: 'text',
    scoringCriteria: ['empathy', 'helpfulness', 'actionability', 'tone'],
  },
];

// ===== Model Comparison Service =====

export class ModelComparisonService {
  async benchmarkModel(
    model: string,
    task: BenchmarkTask,
    inferenceService: InferenceService
  ): Promise<ModelBenchmark> {
    const startTime = Date.now();
    let response = '';
    let tokens = 0;

    try {
      response = await inferenceService.generate(model, task.prompt);
      // Approximate token count from response length
      tokens = Math.ceil(response.length / 4);
    } catch (error) {
      response = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    const duration = Date.now() - startTime;
    const tokensPerSecond = duration > 0 ? (tokens / duration) * 1000 : 0;

    // Score the response
    const qualityScore = this.scoreQuality(response, task);
    const speedScore = this.scoreSpeed(tokensPerSecond);
    const overallScore = qualityScore * 0.7 + speedScore * 0.3;

    return {
      model,
      task: task.id,
      prompt: task.prompt,
      response,
      metrics: {
        duration,
        tokensGenerated: tokens,
        tokensPerSecond,
        score: Math.round(overallScore),
        qualityScore: Math.round(qualityScore),
        speedScore: Math.round(speedScore),
      },
      timestamp: new Date().toISOString(),
    };
  }

  async compareModels(
    models: string[],
    task: BenchmarkTask,
    inferenceService: InferenceService,
    userId?: string
  ): Promise<ModelComparison> {
    const benchmarks: ModelBenchmark[] = [];

    // Run benchmark for each model
    for (const model of models) {
      const benchmark = await this.benchmarkModel(model, task, inferenceService);
      benchmarks.push(benchmark);
    }

    // Determine winner
    const winner = benchmarks.reduce((best, current) =>
      current.metrics.score > best.metrics.score ? current : best
    ).model;

    // Generate summary
    const summary = this.generateComparisonSummary(benchmarks, task);

    const comparison: ModelComparison = {
      id: Date.now().toString(),
      user_id: userId || 'anonymous',
      models,
      task,
      benchmarks,
      winner,
      summary,
      created_at: new Date().toISOString(),
    };

    // Save if userId provided
    if (userId) {
      await this.saveComparison(comparison);
    }

    return comparison;
  }

  async runFullBenchmarkSuite(
    models: string[],
    inferenceService: InferenceService,
    userId?: string
  ): Promise<ModelComparison[]> {
    const comparisons: ModelComparison[] = [];

    for (const task of BENCHMARK_TASKS) {
      const comparison = await this.compareModels(models, task, inferenceService, userId);
      comparisons.push(comparison);
    }

    return comparisons;
  }

  async getModelPerformanceStats(
    model: string,
    userId: string
  ): Promise<ModelPerformanceStats | null> {
    const { data, error } = await supabase
      .from('model_benchmarks')
      .select('*')
      .eq('user_id', userId)
      .eq('model', model);

    if (error || !data || data.length === 0) return null;

    // Calculate statistics
    const totalRuns = data.length;
    const averageScore =
      data.reduce((sum, b) => sum + b.metrics.score, 0) / totalRuns;
    const averageDuration =
      data.reduce((sum, b) => sum + b.metrics.duration, 0) / totalRuns;
    const averageTokensPerSecond =
      data.reduce((sum, b) => sum + b.metrics.tokensPerSecond, 0) / totalRuns;

    // Analyze strengths and weaknesses by category
    const categoryScores: Record<string, number[]> = {};
    for (const benchmark of data) {
      const task = BENCHMARK_TASKS.find((t) => t.id === benchmark.task);
      if (task) {
        if (!categoryScores[task.category]) {
          categoryScores[task.category] = [];
        }
        categoryScores[task.category].push(benchmark.metrics.score);
      }
    }

    const categoryAverages = Object.entries(categoryScores).map(([category, scores]) => ({
      category,
      average: scores.reduce((sum, s) => sum + s, 0) / scores.length,
    }));

    const sorted = categoryAverages.sort((a, b) => b.average - a.average);
    const strengthCategories = sorted.slice(0, 2).map((c) => c.category);
    const weaknessCategories = sorted.slice(-2).map((c) => c.category);

    return {
      model,
      totalRuns,
      averageScore,
      averageDuration,
      averageTokensPerSecond,
      strengthCategories,
      weaknessCategories,
    };
  }

  async getComparisons(userId: string, limit: number = 10): Promise<ModelComparison[]> {
    const { data, error } = await supabase
      .from('model_comparisons')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      models: row.models,
      task: row.task as BenchmarkTask,
      benchmarks: row.benchmarks as ModelBenchmark[],
      winner: row.winner,
      summary: row.summary,
      created_at: row.created_at,
    }));
  }

  async recommendModel(
    category: BenchmarkTask['category'],
    userId: string
  ): Promise<string | null> {
    // Get all benchmarks for this category
    const { data, error } = await supabase
      .from('model_benchmarks')
      .select('*')
      .eq('user_id', userId);

    if (error || !data) return null;

    // Filter by category
    const categoryBenchmarks = data.filter((b) => {
      const task = BENCHMARK_TASKS.find((t) => t.id === b.task);
      return task?.category === category;
    });

    if (categoryBenchmarks.length === 0) return null;

    // Find model with highest average score in this category
    const modelScores: Record<string, number[]> = {};
    for (const benchmark of categoryBenchmarks) {
      if (!modelScores[benchmark.model]) {
        modelScores[benchmark.model] = [];
      }
      modelScores[benchmark.model].push(benchmark.metrics.score);
    }

    const modelAverages = Object.entries(modelScores).map(([model, scores]) => ({
      model,
      average: scores.reduce((sum, s) => sum + s, 0) / scores.length,
    }));

    const best = modelAverages.reduce((best, current) =>
      current.average > best.average ? current : best
    );

    return best.model;
  }

  // ===== Private Methods =====

  private scoreQuality(response: string, task: BenchmarkTask): number {
    // Simple heuristic scoring
    let score = 50; // Base score

    // Length check
    if (response.length < 50) {
      score -= 20;
    } else if (response.length > 100) {
      score += 10;
    }

    // Check for error messages
    if (response.includes('Error:') || response.includes('error')) {
      score -= 30;
    } else {
      score += 10;
    }

    // Category-specific scoring
    switch (task.category) {
      case 'coding':
        if (response.includes('def ') || response.includes('function')) {
          score += 15;
        }
        if (response.includes('complexity') || response.includes('O(')) {
          score += 10;
        }
        break;

      case 'creative':
        // Check for narrative elements
        if (response.split('.').length > 3) {
          score += 10;
        }
        break;

      case 'reasoning':
        if (response.includes('step') || response.includes('therefore')) {
          score += 15;
        }
        break;

      case 'factual':
        if (response.split('\n').length > 2) {
          score += 10;
        }
        break;
    }

    return Math.min(100, Math.max(0, score));
  }

  private scoreSpeed(tokensPerSecond: number): number {
    // Score based on tokens per second
    // Typical range: 10-100 tokens/second
    if (tokensPerSecond >= 50) return 100;
    if (tokensPerSecond >= 30) return 80;
    if (tokensPerSecond >= 20) return 60;
    if (tokensPerSecond >= 10) return 40;
    return 20;
  }

  private generateComparisonSummary(
    benchmarks: ModelBenchmark[],
    task: BenchmarkTask
  ): string {
    const sorted = benchmarks.sort((a, b) => b.metrics.score - a.metrics.score);
    const winner = sorted[0];
    const fastest = benchmarks.reduce((fastest, current) =>
      current.metrics.tokensPerSecond > fastest.metrics.tokensPerSecond ? current : fastest
    );

    let summary = `**Task:** ${task.name}\n\n`;
    summary += `**Winner:** ${winner.model} (score: ${winner.metrics.score}/100)\n`;
    summary += `**Fastest:** ${fastest.model} (${fastest.metrics.tokensPerSecond.toFixed(1)} tokens/sec)\n\n`;

    summary += `**Rankings:**\n`;
    sorted.forEach((b, i) => {
      summary += `${i + 1}. ${b.model} - Score: ${b.metrics.score}, Speed: ${b.metrics.tokensPerSecond.toFixed(1)} t/s\n`;
    });

    return summary;
  }

  private async saveComparison(comparison: ModelComparison): Promise<void> {
    // Save comparison
    const { error: compError } = await supabase.from('model_comparisons').insert({
      user_id: comparison.user_id,
      models: comparison.models,
      task: comparison.task as any,
      benchmarks: comparison.benchmarks as any,
      winner: comparison.winner,
      summary: comparison.summary,
    });

    if (compError) throw compError;

    // Save individual benchmarks
    const benchmarkInserts = comparison.benchmarks.map((b) => ({
      user_id: comparison.user_id,
      model: b.model,
      task: b.task,
      prompt: b.prompt,
      response: b.response,
      metrics: b.metrics as any,
    }));

    const { error: benchError } = await supabase
      .from('model_benchmarks')
      .insert(benchmarkInserts);

    if (benchError) throw benchError;
  }

  getBenchmarkTasks(): BenchmarkTask[] {
    return [...BENCHMARK_TASKS];
  }

  getTasksByCategory(category: BenchmarkTask['category']): BenchmarkTask[] {
    return BENCHMARK_TASKS.filter((t) => t.category === category);
  }
}

// ===== Singleton =====

let modelComparisonServiceInstance: ModelComparisonService | null = null;

export function getModelComparisonService(): ModelComparisonService {
  if (!modelComparisonServiceInstance) {
    modelComparisonServiceInstance = new ModelComparisonService();
  }
  return modelComparisonServiceInstance;
}
