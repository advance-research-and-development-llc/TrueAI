/**
 * Advanced Memory System
 * Provides semantic memory storage and retrieval for conversations
 * Enables long-term memory, user preferences, and context-aware suggestions
 */

import { supabase } from './supabase';
import { EmbeddingService } from './embeddings';
import { Tables } from './supabase';

export interface Memory {
  id: string;
  user_id: string;
  type: 'conversation' | 'preference' | 'fact' | 'instruction';
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
  importance: number; // 0-1 scale
  created_at: string;
  last_accessed: string;
  access_count: number;
}

export interface MemoryQuery {
  query: string;
  type?: Memory['type'];
  limit?: number;
  minImportance?: number;
  similarityThreshold?: number;
}

export interface MemoryResult {
  memory: Memory;
  similarity: number;
}

export class AdvancedMemoryService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Store a memory with semantic embedding
   */
  async storeMemory(
    userId: string,
    content: string,
    type: Memory['type'],
    metadata: Record<string, any> = {},
    importance: number = 0.5
  ): Promise<Memory> {
    // Generate embedding for the content
    const embeddingResult = await this.embeddingService.generateEmbedding(content);

    const memory = {
      user_id: userId,
      type,
      content,
      embedding: embeddingResult.embedding,
      metadata,
      importance,
      last_accessed: new Date().toISOString(),
      access_count: 0,
    };

    const { data, error } = await supabase.from('memories').insert(memory).select().single();

    if (error) throw error;
    return data as Memory;
  }

  /**
   * Query memories using semantic search
   */
  async queryMemories(userId: string, query: MemoryQuery): Promise<MemoryResult[]> {
    const { query: queryText, type, limit = 10, minImportance = 0, similarityThreshold = 0.3 } = query;

    // Generate embedding for query
    const queryEmbedding = await this.embeddingService.generateEmbedding(queryText);

    // Get all memories for user (filtered by type if specified)
    let queryBuilder = supabase.from('memories').select('*').eq('user_id', userId).gte('importance', minImportance);

    if (type) {
      queryBuilder = queryBuilder.eq('type', type);
    }

    const { data: memories, error } = await queryBuilder;

    if (error) throw error;
    if (!memories || memories.length === 0) return [];

    // Calculate similarities
    const results: MemoryResult[] = memories
      .map((memory: any) => {
        const similarity = EmbeddingService.cosineSimilarity(queryEmbedding.embedding, memory.embedding);
        return {
          memory: memory as Memory,
          similarity,
        };
      })
      .filter((result) => result.similarity >= similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // Update access counts
    for (const result of results) {
      await this.updateAccessCount(result.memory.id);
    }

    return results;
  }

  /**
   * Get memories by type
   */
  async getMemoriesByType(userId: string, type: Memory['type'], limit: number = 50): Promise<Memory[]> {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as Memory[]) || [];
  }

  /**
   * Update memory importance based on usage
   */
  async updateImportance(memoryId: string, importance: number): Promise<void> {
    const { error } = await supabase.from('memories').update({ importance }).eq('id', memoryId);

    if (error) throw error;
  }

  /**
   * Update access count and last accessed time
   */
  private async updateAccessCount(memoryId: string): Promise<void> {
    const { data: memory } = await supabase.from('memories').select('access_count').eq('id', memoryId).single();

    if (memory) {
      await supabase
        .from('memories')
        .update({
          access_count: (memory.access_count || 0) + 1,
          last_accessed: new Date().toISOString(),
        })
        .eq('id', memoryId);
    }
  }

  /**
   * Delete old, unimportant memories (memory pruning)
   */
  async pruneMemories(userId: string, maxAge: number = 90, minImportance: number = 0.3): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);

    const { data, error } = await supabase
      .from('memories')
      .delete()
      .eq('user_id', userId)
      .lt('importance', minImportance)
      .lt('last_accessed', cutoffDate.toISOString())
      .select();

    if (error) throw error;
    return data?.length || 0;
  }

  /**
   * Store a conversation snippet as memory
   */
  async storeConversationMemory(
    userId: string,
    conversationId: string,
    userMessage: string,
    assistantMessage: string,
    importance: number = 0.5
  ): Promise<Memory> {
    const content = `User: ${userMessage}\nAssistant: ${assistantMessage}`;

    return this.storeMemory(
      userId,
      content,
      'conversation',
      {
        conversation_id: conversationId,
        user_message: userMessage,
        assistant_message: assistantMessage,
      },
      importance
    );
  }

  /**
   * Store a user preference
   */
  async storePreference(userId: string, preference: string, value: any): Promise<Memory> {
    const content = `${preference}: ${JSON.stringify(value)}`;

    return this.storeMemory(userId, content, 'preference', { preference, value }, 0.8);
  }

  /**
   * Get relevant context for a conversation
   */
  async getConversationContext(
    userId: string,
    currentMessage: string,
    limit: number = 5
  ): Promise<{ memories: MemoryResult[]; context: string }> {
    const memories = await this.queryMemories(userId, {
      query: currentMessage,
      type: 'conversation',
      limit,
      similarityThreshold: 0.4,
    });

    const context = memories.map((m, idx) => `[Memory ${idx + 1}] ${m.memory.content}`).join('\n\n');

    return { memories, context };
  }

  /**
   * Learn from conversation and extract important facts
   */
  async extractAndStoreImportantFacts(
    userId: string,
    conversationId: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<Memory[]> {
    const storedMemories: Memory[] = [];

    // Simple heuristic: store longer assistant responses as potential facts
    for (const message of messages) {
      if (message.role === 'assistant' && message.content.length > 100) {
        // Check if it contains factual information (heuristic)
        if (
          message.content.includes('is') ||
          message.content.includes('are') ||
          message.content.includes('means') ||
          message.content.includes('refers to')
        ) {
          const memory = await this.storeMemory(
            userId,
            message.content,
            'fact',
            { conversation_id: conversationId, source: 'conversation' },
            0.6
          );
          storedMemories.push(memory);
        }
      }
    }

    return storedMemories;
  }
}

let advancedMemoryServiceInstance: AdvancedMemoryService | null = null;

export function getAdvancedMemoryService(): AdvancedMemoryService {
  if (!advancedMemoryServiceInstance) {
    advancedMemoryServiceInstance = new AdvancedMemoryService();
  }
  return advancedMemoryServiceInstance;
}
