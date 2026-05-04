/**
 * Real-time Subscriptions Service
 * Provides real-time updates for messages, conversations, and presence using Supabase
 */

import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Tables } from './supabase';

export type MessageCallback = (message: Tables['messages']['Row']) => void;
export type ConversationCallback = (conversation: Tables['conversations']['Row']) => void;
export type PresenceCallback = (presence: PresenceState) => void;

export interface PresenceState {
  user_id: string;
  online_at: string;
  status: 'online' | 'away' | 'offline';
}

export interface ExecutionUpdate {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  current_step?: string;
  progress?: number;
  updated_at: string;
}

export type ExecutionCallback = (update: ExecutionUpdate) => void;

export class RealtimeService {
  private messageChannel: RealtimeChannel | null = null;
  private conversationChannel: RealtimeChannel | null = null;
  private presenceChannel: RealtimeChannel | null = null;
  private executionChannels: Map<string, RealtimeChannel> = new Map();

  /**
   * Subscribe to real-time message updates for a conversation
   */
  subscribeToMessages(conversationId: string, callback: MessageCallback): () => void {
    this.messageChannel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callback(payload.new as Tables['messages']['Row']);
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      if (this.messageChannel) {
        supabase.removeChannel(this.messageChannel);
        this.messageChannel = null;
      }
    };
  }

  /**
   * Subscribe to conversation updates for a user
   */
  subscribeToConversations(userId: string, callback: ConversationCallback): () => void {
    this.conversationChannel = supabase
      .channel(`conversations:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // All events: INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            callback({ ...payload.old, deleted: true } as any);
          } else {
            callback(payload.new as Tables['conversations']['Row']);
          }
        }
      )
      .subscribe();

    return () => {
      if (this.conversationChannel) {
        supabase.removeChannel(this.conversationChannel);
        this.conversationChannel = null;
      }
    };
  }

  /**
   * Subscribe to user presence (online/offline status)
   */
  subscribeToPresence(roomId: string, userId: string, callback: PresenceCallback): () => void {
    this.presenceChannel = supabase.channel(`presence:${roomId}`);

    // Track presence
    this.presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = this.presenceChannel?.presenceState();
        if (state) {
          Object.values(state).forEach((presences: any) => {
            presences.forEach((presence: any) => {
              callback(presence);
            });
          });
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((presence: any) => {
          callback(presence);
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((presence: any) => {
          callback({ ...presence, status: 'offline' });
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.presenceChannel?.track({
            user_id: userId,
            online_at: new Date().toISOString(),
            status: 'online',
          });
        }
      });

    return () => {
      if (this.presenceChannel) {
        supabase.removeChannel(this.presenceChannel);
        this.presenceChannel = null;
      }
    };
  }

  /**
   * Broadcast a typing indicator
   */
  async broadcastTyping(conversationId: string, userId: string, isTyping: boolean): Promise<void> {
    const channel = supabase.channel(`typing:${conversationId}`);

    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event: 'typing',
          payload: { user_id: userId, is_typing: isTyping },
        });
      }
    });
  }

  /**
   * Subscribe to typing indicators
   */
  subscribeToTyping(
    conversationId: string,
    callback: (payload: { user_id: string; is_typing: boolean }) => void
  ): () => void {
    const channel = supabase
      .channel(`typing:${conversationId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        callback(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Update user presence status
   */
  async updatePresenceStatus(roomId: string, status: 'online' | 'away' | 'offline'): Promise<void> {
    if (this.presenceChannel) {
      await this.presenceChannel.track({
        status,
        online_at: new Date().toISOString(),
      });
    }
  }

  /**
   * Subscribe to workflow execution updates
   */
  subscribeToWorkflowExecution(executionId: string, callback: ExecutionCallback): () => void {
    const channelName = `workflow_execution_${executionId}`;

    if (this.executionChannels.has(channelName)) {
      return () => this.unsubscribeExecution(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workflow_executions',
          filter: `id=eq.${executionId}`,
        },
        (payload) => {
          const update: ExecutionUpdate = {
            id: payload.new.id,
            status: payload.new.status,
            current_step: payload.new.current_step,
            progress: this.calculateWorkflowProgress(payload.new),
            updated_at: payload.new.updated_at || new Date().toISOString(),
          };
          callback(update);
        }
      )
      .subscribe();

    this.executionChannels.set(channelName, channel);
    return () => this.unsubscribeExecution(channelName);
  }

  /**
   * Subscribe to scheduled task execution updates
   */
  subscribeToTaskExecution(executionId: string, callback: ExecutionCallback): () => void {
    const channelName = `task_execution_${executionId}`;

    if (this.executionChannels.has(channelName)) {
      return () => this.unsubscribeExecution(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scheduled_task_executions',
          filter: `id=eq.${executionId}`,
        },
        (payload) => {
          const update: ExecutionUpdate = {
            id: payload.new.id,
            status: payload.new.status,
            current_step: payload.new.current_step,
            progress: this.calculateTaskProgress(payload.new),
            updated_at: payload.new.updated_at || new Date().toISOString(),
          };
          callback(update);
        }
      )
      .subscribe();

    this.executionChannels.set(channelName, channel);
    return () => this.unsubscribeExecution(channelName);
  }

  /**
   * Subscribe to agent run updates
   */
  subscribeToAgentRun(runId: string, callback: ExecutionCallback): () => void {
    const channelName = `agent_run_${runId}`;

    if (this.executionChannels.has(channelName)) {
      return () => this.unsubscribeExecution(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_runs',
          filter: `id=eq.${runId}`,
        },
        (payload) => {
          const update: ExecutionUpdate = {
            id: payload.new.id,
            status: payload.new.status,
            current_step: payload.new.current_step,
            progress: this.calculateAgentProgress(payload.new),
            updated_at: payload.new.updated_at || new Date().toISOString(),
          };
          callback(update);
        }
      )
      .subscribe();

    this.executionChannels.set(channelName, channel);
    return () => this.unsubscribeExecution(channelName);
  }

  /**
   * Unsubscribe from a specific execution channel
   */
  private async unsubscribeExecution(channelName: string): Promise<void> {
    const channel = this.executionChannels.get(channelName);
    if (channel) {
      await supabase.removeChannel(channel);
      this.executionChannels.delete(channelName);
    }
  }

  /**
   * Calculate workflow execution progress (0-100)
   */
  private calculateWorkflowProgress(execution: any): number {
    if (execution.status === 'completed') return 100;
    if (execution.status === 'failed' || execution.status === 'timeout') return 0;

    // Estimate based on current step
    if (execution.current_step && execution.total_steps) {
      return Math.round((execution.current_step / execution.total_steps) * 100);
    }

    if (execution.status === 'running') return 50;
    return 0;
  }

  /**
   * Calculate task execution progress (0-100)
   */
  private calculateTaskProgress(execution: any): number {
    if (execution.status === 'completed') return 100;
    if (execution.status === 'failed' || execution.status === 'timeout') return 0;
    if (execution.status === 'running') return 50;
    return 0;
  }

  /**
   * Calculate agent run progress (0-100)
   */
  private calculateAgentProgress(run: any): number {
    if (run.status === 'completed') return 100;
    if (run.status === 'failed' || run.status === 'timeout') return 0;

    // Estimate based on steps
    if (Array.isArray(run.steps) && run.steps.length > 0) {
      const estimatedSteps = 7;
      const currentSteps = run.steps.length;
      return Math.min(Math.round((currentSteps / estimatedSteps) * 100), 95);
    }

    if (run.status === 'running') return 25;
    return 0;
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    if (this.messageChannel) {
      supabase.removeChannel(this.messageChannel);
      this.messageChannel = null;
    }
    if (this.conversationChannel) {
      supabase.removeChannel(this.conversationChannel);
      this.conversationChannel = null;
    }
    if (this.presenceChannel) {
      supabase.removeChannel(this.presenceChannel);
      this.presenceChannel = null;
    }
    // Unsubscribe from all execution channels
    this.executionChannels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.executionChannels.clear();
  }
}

let realtimeServiceInstance: RealtimeService | null = null;

export function getRealtimeService(): RealtimeService {
  if (!realtimeServiceInstance) {
    realtimeServiceInstance = new RealtimeService();
  }
  return realtimeServiceInstance;
}
