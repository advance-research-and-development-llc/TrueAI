/**
 * Conversation Insights Service
 * Provides analytics and insights for conversations
 */

import { supabase } from './supabase';
import { Tables } from './supabase';

export interface ConversationInsights {
  conversation_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  user_message_count: number;
  assistant_message_count: number;
  system_message_count: number;
  total_characters: number;
  average_message_length: number;
  conversation_duration: number; // milliseconds
  messages_per_hour: number;
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  key_moments: Array<{
    message_id: string;
    content: string;
    importance: number;
    timestamp: string;
  }>;
}

export interface UserConversationPatterns {
  user_id: string;
  total_conversations: number;
  total_messages: number;
  average_conversation_length: number;
  most_active_time: string;
  favorite_topics: string[];
  conversation_frequency: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  model_usage: Record<string, number>;
  agent_usage: Record<string, number>;
}

export interface ConversationComparison {
  conversation_a: ConversationInsights;
  conversation_b: ConversationInsights;
  similarities: string[];
  differences: string[];
  recommendation: string;
}

export class ConversationInsightsService {
  /**
   * Get detailed insights for a conversation
   */
  async getConversationInsights(conversationId: string): Promise<ConversationInsights | null> {
    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) return null;

    // Get all messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });

    if (msgError || !messages) return null;

    // Calculate basic stats
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    const systemMessages = messages.filter((m) => m.role === 'system');
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    const avgLength = messages.length > 0 ? totalChars / messages.length : 0;

    // Calculate duration
    const startTime = new Date(messages[0]?.timestamp || conversation.created_at).getTime();
    const endTime = new Date(messages[messages.length - 1]?.timestamp || conversation.updated_at).getTime();
    const duration = endTime - startTime;
    const hours = duration / (1000 * 60 * 60);
    const messagesPerHour = hours > 0 ? messages.length / hours : 0;

    // Extract topics (simple keyword extraction)
    const topics = this.extractTopics(messages.map((m) => m.content).join(' '));

    // Analyze sentiment (simple heuristic)
    const sentiment = this.analyzeSentiment(messages.map((m) => m.content).join(' '));

    // Identify key moments (longest messages or messages with questions)
    const keyMoments = messages
      .filter((m) => m.role === 'assistant' && m.content.length > 200)
      .slice(0, 5)
      .map((m) => ({
        message_id: m.id,
        content: m.content.substring(0, 100) + '...',
        importance: m.content.length / 1000,
        timestamp: m.timestamp,
      }));

    return {
      conversation_id: conversationId,
      title: conversation.title,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
      message_count: messages.length,
      user_message_count: userMessages.length,
      assistant_message_count: assistantMessages.length,
      system_message_count: systemMessages.length,
      total_characters: totalChars,
      average_message_length: avgLength,
      conversation_duration: duration,
      messages_per_hour: messagesPerHour,
      topics,
      sentiment,
      key_moments: keyMoments,
    };
  }

  /**
   * Get user conversation patterns
   */
  async getUserConversationPatterns(userId: string): Promise<UserConversationPatterns | null> {
    // Get all conversations
    const { data: conversations } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!conversations || conversations.length === 0) return null;

    // Get all messages
    const conversationIds = conversations.map((c) => c.id);
    const { data: allMessages } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', conversationIds);

    if (!allMessages) return null;

    // Calculate patterns
    const totalMessages = allMessages.length;
    const avgConvLength = conversations.length > 0 ? totalMessages / conversations.length : 0;

    // Calculate conversation frequency
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyConvs = conversations.filter((c) => new Date(c.created_at) > dayAgo).length;
    const weeklyConvs = conversations.filter((c) => new Date(c.created_at) > weekAgo).length;
    const monthlyConvs = conversations.filter((c) => new Date(c.created_at) > monthAgo).length;

    // Model usage
    const modelUsage: Record<string, number> = {};
    conversations.forEach((c) => {
      if (c.model_id) {
        modelUsage[c.model_id] = (modelUsage[c.model_id] || 0) + 1;
      }
    });

    // Agent usage
    const agentUsage: Record<string, number> = {};
    conversations.forEach((c) => {
      if (c.agent_id) {
        agentUsage[c.agent_id] = (agentUsage[c.agent_id] || 0) + 1;
      }
    });

    // Find most active time (hour of day)
    const hourCounts: Record<number, number> = {};
    allMessages.forEach((m) => {
      const hour = new Date(m.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const mostActiveHour = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || '12';

    // Extract favorite topics
    const allContent = allMessages.map((m) => m.content).join(' ');
    const favoriteTopics = this.extractTopics(allContent).slice(0, 5);

    return {
      user_id: userId,
      total_conversations: conversations.length,
      total_messages: totalMessages,
      average_conversation_length: avgConvLength,
      most_active_time: `${mostActiveHour}:00`,
      favorite_topics: favoriteTopics,
      conversation_frequency: {
        daily: dailyConvs,
        weekly: weeklyConvs,
        monthly: monthlyConvs,
      },
      model_usage: modelUsage,
      agent_usage: agentUsage,
    };
  }

  /**
   * Compare two conversations
   */
  async compareConversations(conversationIdA: string, conversationIdB: string): Promise<ConversationComparison | null> {
    const [insightsA, insightsB] = await Promise.all([
      this.getConversationInsights(conversationIdA),
      this.getConversationInsights(conversationIdB),
    ]);

    if (!insightsA || !insightsB) return null;

    // Find similarities
    const similarities: string[] = [];
    const differences: string[] = [];

    // Compare message counts
    if (Math.abs(insightsA.message_count - insightsB.message_count) < 5) {
      similarities.push('Similar message counts');
    } else {
      differences.push(
        `Different message counts: ${insightsA.message_count} vs ${insightsB.message_count}`
      );
    }

    // Compare topics
    const commonTopics = insightsA.topics.filter((t) => insightsB.topics.includes(t));
    if (commonTopics.length > 0) {
      similarities.push(`Common topics: ${commonTopics.join(', ')}`);
    }

    // Compare sentiment
    if (insightsA.sentiment === insightsB.sentiment) {
      similarities.push(`Same sentiment: ${insightsA.sentiment}`);
    } else {
      differences.push(`Different sentiment: ${insightsA.sentiment} vs ${insightsB.sentiment}`);
    }

    // Generate recommendation
    let recommendation = 'These conversations cover ';
    if (similarities.length > differences.length) {
      recommendation += 'similar topics and styles.';
    } else {
      recommendation += 'different topics and approaches.';
    }

    return {
      conversation_a: insightsA,
      conversation_b: insightsB,
      similarities,
      differences,
      recommendation,
    };
  }

  /**
   * Get conversation timeline
   */
  async getConversationTimeline(
    conversationId: string
  ): Promise<Array<{ timestamp: string; event: string; details: string }>> {
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });

    if (!messages) return [];

    return messages.map((m) => ({
      timestamp: m.timestamp,
      event: m.role === 'user' ? 'User Message' : 'Assistant Response',
      details: m.content.substring(0, 50) + (m.content.length > 50 ? '...' : ''),
    }));
  }

  /**
   * Simple topic extraction (keyword frequency)
   */
  private extractTopics(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'should',
      'could',
      'can',
      'may',
      'might',
      'must',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
      'what',
      'which',
      'who',
      'when',
      'where',
      'why',
      'how',
    ]);

    const wordCounts: Record<string, number> = {};
    words.forEach((word) => {
      const cleaned = word.replace(/[^a-z]/g, '');
      if (cleaned.length > 3 && !stopWords.has(cleaned)) {
        wordCounts[cleaned] = (wordCounts[cleaned] || 0) + 1;
      }
    });

    return Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Simple sentiment analysis (heuristic-based)
   */
  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' | 'mixed' {
    const positive = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'love', 'like', 'best'];
    const negative = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'worst', 'poor', 'wrong'];

    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    words.forEach((word) => {
      if (positive.some((p) => word.includes(p))) positiveCount++;
      if (negative.some((n) => word.includes(n))) negativeCount++;
    });

    if (positiveCount > negativeCount * 1.5) return 'positive';
    if (negativeCount > positiveCount * 1.5) return 'negative';
    if (positiveCount > 0 && negativeCount > 0) return 'mixed';
    return 'neutral';
  }
}

let conversationInsightsServiceInstance: ConversationInsightsService | null = null;

export function getConversationInsightsService(): ConversationInsightsService {
  if (!conversationInsightsServiceInstance) {
    conversationInsightsServiceInstance = new ConversationInsightsService();
  }
  return conversationInsightsServiceInstance;
}
