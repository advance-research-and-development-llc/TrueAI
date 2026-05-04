/**
 * Conversation Management Service
 * Provides advanced conversation features including search, branching, export/import
 */

import { supabase } from './supabase';
import { Tables } from './supabase';

export interface ConversationSummary {
  id: string;
  title: string;
  message_count: number;
  first_message: string;
  last_message: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationExport {
  conversation: Tables['conversations']['Row'];
  messages: Tables['messages']['Row'][];
  metadata: {
    exported_at: string;
    app_version: string;
  };
}

export interface ConversationBranch {
  id: string;
  parent_conversation_id: string;
  branch_point_message_id: string;
  title: string;
  created_at: string;
}

export class ConversationManagementService {
  /**
   * Search conversations by content or title
   */
  async searchConversations(userId: string, searchQuery: string, limit: number = 20): Promise<ConversationSummary[]> {
    // Get conversations
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .ilike('title', `%${searchQuery}%`)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (convError) throw convError;
    if (!conversations) return [];

    // Get message counts and first/last messages for each conversation
    const summaries: ConversationSummary[] = [];

    for (const conv of conversations) {
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('timestamp', { ascending: true });

      if (messages && messages.length > 0) {
        summaries.push({
          id: conv.id,
          title: conv.title,
          message_count: messages.length,
          first_message: messages[0].content.substring(0, 100),
          last_message: messages[messages.length - 1].content.substring(0, 100),
          created_at: conv.created_at,
          updated_at: conv.updated_at,
        });
      }
    }

    return summaries;
  }

  /**
   * Search messages within conversations
   */
  async searchMessages(
    userId: string,
    searchQuery: string,
    limit: number = 50
  ): Promise<Array<Tables['messages']['Row'] & { conversation_title: string }>> {
    // Get user's conversations
    const { data: conversations } = await supabase.from('conversations').select('id, title').eq('user_id', userId);

    if (!conversations) return [];

    const conversationMap = new Map(conversations.map((c) => [c.id, c.title]));

    // Search messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .in(
        'conversation_id',
        conversations.map((c) => c.id)
      )
      .ilike('content', `%${searchQuery}%`)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    if (!messages) return [];

    return messages.map((m) => ({
      ...m,
      conversation_title: conversationMap.get(m.conversation_id) || 'Unknown',
    }));
  }

  /**
   * Export a conversation to JSON
   */
  async exportConversation(conversationId: string): Promise<ConversationExport> {
    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError) throw convError;

    // Get all messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });

    if (msgError) throw msgError;

    return {
      conversation,
      messages: messages || [],
      metadata: {
        exported_at: new Date().toISOString(),
        app_version: '1.0.0',
      },
    };
  }

  /**
   * Import a conversation from JSON
   */
  async importConversation(userId: string, exportData: ConversationExport): Promise<string> {
    // Create new conversation
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: `${exportData.conversation.title} (imported)`,
        model_id: exportData.conversation.model_id,
        agent_id: exportData.conversation.agent_id,
        system_prompt: exportData.conversation.system_prompt,
      })
      .select()
      .single();

    if (convError) throw convError;

    // Insert messages
    const messagesToInsert = exportData.messages.map((msg) => ({
      conversation_id: newConv.id,
      role: msg.role,
      content: msg.content,
      tool_calls: msg.tool_calls,
      tool_results: msg.tool_results,
    }));

    const { error: msgError } = await supabase.from('messages').insert(messagesToInsert);

    if (msgError) throw msgError;

    return newConv.id;
  }

  /**
   * Create a conversation branch from a specific message
   */
  async createBranch(
    userId: string,
    parentConversationId: string,
    branchPointMessageId: string,
    newTitle: string
  ): Promise<string> {
    // Get parent conversation
    const { data: parentConv, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', parentConversationId)
      .single();

    if (convError) throw convError;

    // Get messages up to branch point
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', parentConversationId)
      .order('timestamp', { ascending: true });

    if (msgError) throw msgError;
    if (!messages) throw new Error('No messages found');

    // Find branch point index
    const branchPointIndex = messages.findIndex((m) => m.id === branchPointMessageId);
    if (branchPointIndex === -1) throw new Error('Branch point message not found');

    // Create new conversation
    const { data: newConv, error: newConvError } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: newTitle,
        model_id: parentConv.model_id,
        agent_id: parentConv.agent_id,
        system_prompt: parentConv.system_prompt,
      })
      .select()
      .single();

    if (newConvError) throw newConvError;

    // Copy messages up to and including branch point
    const messagesToCopy = messages.slice(0, branchPointIndex + 1).map((msg) => ({
      conversation_id: newConv.id,
      role: msg.role,
      content: msg.content,
      tool_calls: msg.tool_calls,
      tool_results: msg.tool_results,
    }));

    const { error: copyError } = await supabase.from('messages').insert(messagesToCopy);

    if (copyError) throw copyError;

    return newConv.id;
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(
    conversationId: string
  ): Promise<{
    total_messages: number;
    user_messages: number;
    assistant_messages: number;
    system_messages: number;
    average_message_length: number;
    total_characters: number;
  }> {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId);

    if (error) throw error;
    if (!messages) {
      return {
        total_messages: 0,
        user_messages: 0,
        assistant_messages: 0,
        system_messages: 0,
        average_message_length: 0,
        total_characters: 0,
      };
    }

    const stats = {
      total_messages: messages.length,
      user_messages: messages.filter((m) => m.role === 'user').length,
      assistant_messages: messages.filter((m) => m.role === 'assistant').length,
      system_messages: messages.filter((m) => m.role === 'system').length,
      average_message_length: 0,
      total_characters: 0,
    };

    stats.total_characters = messages.reduce((sum, m) => sum + m.content.length, 0);
    stats.average_message_length = stats.total_messages > 0 ? Math.round(stats.total_characters / stats.total_messages) : 0;

    return stats;
  }

  /**
   * Delete conversation and all its messages
   */
  async deleteConversation(conversationId: string): Promise<void> {
    // Delete messages first
    const { error: msgError } = await supabase.from('messages').delete().eq('conversation_id', conversationId);

    if (msgError) throw msgError;

    // Delete conversation
    const { error: convError } = await supabase.from('conversations').delete().eq('id', conversationId);

    if (convError) throw convError;
  }

  /**
   * Get recent conversations with message previews
   */
  async getRecentConversations(userId: string, limit: number = 10): Promise<ConversationSummary[]> {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    if (!conversations) return [];

    const summaries: ConversationSummary[] = [];

    for (const conv of conversations) {
      const { data: messages } = await supabase
        .from('messages')
        .select('content, timestamp')
        .eq('conversation_id', conv.id)
        .order('timestamp', { ascending: true });

      if (messages && messages.length > 0) {
        summaries.push({
          id: conv.id,
          title: conv.title,
          message_count: messages.length,
          first_message: messages[0].content.substring(0, 100),
          last_message: messages[messages.length - 1].content.substring(0, 100),
          created_at: conv.created_at,
          updated_at: conv.updated_at,
        });
      }
    }

    return summaries;
  }
}

let conversationManagementServiceInstance: ConversationManagementService | null = null;

export function getConversationManagementService(): ConversationManagementService {
  if (!conversationManagementServiceInstance) {
    conversationManagementServiceInstance = new ConversationManagementService();
  }
  return conversationManagementServiceInstance;
}
