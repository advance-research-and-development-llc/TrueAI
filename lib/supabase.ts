import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Database = {
  public: {
    Tables: {
      conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          model_id: string | null;
          agent_id: string | null;
          system_prompt: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          title: string;
          model_id?: string | null;
          agent_id?: string | null;
          system_prompt?: string | null;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          tool_calls: Record<string, any> | null;
          tool_results: Record<string, any> | null;
          timestamp: string;
        };
        Insert: {
          conversation_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          tool_calls?: Record<string, any> | null;
          tool_results?: Record<string, any> | null;
        };
      };
      models: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          source: 'ollama' | 'huggingface' | 'local';
          model_type: string;
          size_bytes: number | null;
          status: string;
          local_path: string | null;
          remote_url: string | null;
          quantization: string | null;
          context_length: number;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          name: string;
          source: 'ollama' | 'huggingface' | 'local';
          model_type?: string;
          size_bytes?: number | null;
          status?: string;
          local_path?: string | null;
          remote_url?: string | null;
          quantization?: string | null;
          context_length?: number;
          metadata?: Record<string, any>;
        };
      };
      agents: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          system_prompt: string | null;
          tools_enabled: string[];
          harness_ids: string[];
          config_json: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          name: string;
          description?: string | null;
          system_prompt?: string | null;
          tools_enabled?: string[];
          harness_ids?: string[];
          config_json?: Record<string, any>;
        };
      };
      extensions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          harness_type: string;
          repo_url: string | null;
          version: string;
          installed_at: string;
          enabled: boolean;
          manifest_json: Record<string, any>;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          name: string;
          harness_type: string;
          repo_url?: string | null;
          version: string;
          enabled?: boolean;
          manifest_json: Record<string, any>;
          metadata?: Record<string, any>;
        };
      };
      agent_runs: {
        Row: {
          id: string;
          agent_id: string;
          conversation_id: string | null;
          status: 'running' | 'completed' | 'failed' | 'stopped';
          steps_json: Record<string, any>[];
          final_output: string | null;
          error_message: string | null;
          started_at: string;
          finished_at: string | null;
          total_steps: number;
        };
        Insert: {
          agent_id: string;
          conversation_id?: string | null;
          status?: 'running' | 'completed' | 'failed' | 'stopped';
          steps_json?: Record<string, any>[];
          final_output?: string | null;
          error_message?: string | null;
          total_steps?: number;
        };
      };
      knowledge_bases: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          type: 'document' | 'text' | 'conversation' | 'neuron_packet';
          status: 'active' | 'processing' | 'error';
          document_count: number;
          chunk_count: number;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          name: string;
          description?: string | null;
          type: 'document' | 'text' | 'conversation' | 'neuron_packet';
          status?: 'active' | 'processing' | 'error';
          document_count?: number;
          chunk_count?: number;
          metadata?: Record<string, any>;
        };
      };
      knowledge_documents: {
        Row: {
          id: string;
          knowledge_base_id: string;
          filename: string;
          file_type: string;
          file_size: number;
          status: 'pending' | 'processing' | 'completed' | 'error';
          error_message: string | null;
          chunk_count: number;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          knowledge_base_id: string;
          filename: string;
          file_type: string;
          file_size: number;
          status?: 'pending' | 'processing' | 'completed' | 'error';
          error_message?: string | null;
          chunk_count?: number;
          metadata?: Record<string, any>;
        };
      };
      knowledge_chunks: {
        Row: {
          id: string;
          knowledge_base_id: string;
          document_id: string | null;
          content: string;
          chunk_index: number;
          embedding: number[] | null;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          knowledge_base_id: string;
          document_id?: string | null;
          content: string;
          chunk_index: number;
          embedding?: number[] | null;
          metadata?: Record<string, any>;
        };
      };
      memories: {
        Row: {
          id: string;
          user_id: string;
          type: 'conversation' | 'preference' | 'fact' | 'instruction';
          content: string;
          embedding: number[];
          metadata: Record<string, any>;
          importance: number;
          created_at: string;
          last_accessed: string;
          access_count: number;
        };
        Insert: {
          user_id: string;
          type: 'conversation' | 'preference' | 'fact' | 'instruction';
          content: string;
          embedding: number[];
          metadata?: Record<string, any>;
          importance?: number;
          last_accessed?: string;
          access_count?: number;
        };
      };
      audio_recordings: {
        Row: {
          id: string;
          user_id: string;
          conversation_id: string | null;
          audio_url: string;
          duration_seconds: number;
          transcription: string | null;
          transcription_confidence: number | null;
          language: string;
          status: 'recording' | 'processing' | 'completed' | 'error';
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          conversation_id?: string | null;
          audio_url: string;
          duration_seconds: number;
          transcription?: string | null;
          transcription_confidence?: number | null;
          language?: string;
          status?: 'recording' | 'processing' | 'completed' | 'error';
          error_message?: string | null;
        };
      };
      voice_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: 'user' | 'assistant';
          text_content: string;
          audio_recording_id: string | null;
          spoken: boolean;
          created_at: string;
        };
        Insert: {
          conversation_id: string;
          role: 'user' | 'assistant';
          text_content: string;
          audio_recording_id?: string | null;
          spoken?: boolean;
        };
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          preference_type: string;
          preferences: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          preference_type: string;
          preferences: Record<string, any>;
        };
      };
      ensemble_results: {
        Row: {
          id: string;
          user_id: string;
          strategy: string;
          models: string[];
          prompt: string;
          individual_responses: Record<string, any>[];
          combined_response: string;
          total_duration: number;
          total_tokens: number;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          user_id: string;
          strategy: string;
          models: string[];
          prompt: string;
          individual_responses: Record<string, any>[];
          combined_response: string;
          total_duration: number;
          total_tokens: number;
          metadata: Record<string, any>;
        };
      };
      model_comparisons: {
        Row: {
          id: string;
          user_id: string;
          models: string[];
          task: Record<string, any>;
          benchmarks: Record<string, any>[];
          winner: string | null;
          summary: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          models: string[];
          task: Record<string, any>;
          benchmarks: Record<string, any>[];
          winner: string | null;
          summary: string;
        };
      };
      model_benchmarks: {
        Row: {
          id: string;
          user_id: string;
          model: string;
          task: string;
          prompt: string;
          response: string;
          metrics: Record<string, any>;
          created_at: string;
        };
        Insert: {
          user_id: string;
          model: string;
          task: string;
          prompt: string;
          response: string;
          metrics: Record<string, any>;
        };
      };
      scheduled_agent_tasks: {
        Row: {
          id: string;
          user_id: string;
          agent_id: string;
          name: string;
          description: string | null;
          schedule_type: 'once' | 'interval' | 'cron' | 'daily' | 'weekly' | 'monthly';
          schedule_config: Record<string, any>;
          task_input: string;
          model_name: string;
          enabled: boolean;
          last_run: string | null;
          next_run: string | null;
          run_count: number;
          status: 'pending' | 'running' | 'completed' | 'failed' | 'disabled';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          agent_id: string;
          name: string;
          description?: string | null;
          schedule_type: 'once' | 'interval' | 'cron' | 'daily' | 'weekly' | 'monthly';
          schedule_config: Record<string, any>;
          task_input: string;
          model_name: string;
          enabled?: boolean;
          next_run?: string | null;
          run_count?: number;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'disabled';
        };
      };
      scheduled_task_executions: {
        Row: {
          id: string;
          scheduled_task_id: string;
          agent_id: string;
          status: 'running' | 'completed' | 'failed' | 'timeout';
          started_at: string;
          finished_at: string | null;
          output: string | null;
          error: string | null;
          steps_count: number;
          duration: number;
        };
        Insert: {
          scheduled_task_id: string;
          agent_id: string;
          status: 'running' | 'completed' | 'failed' | 'timeout';
          started_at: string;
          finished_at?: string | null;
          output?: string | null;
          error?: string | null;
          steps_count?: number;
          duration?: number;
        };
      };
      agent_workflows: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          steps: Record<string, any>[];
          start_step: string;
          variables: Record<string, any>;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          name: string;
          description?: string | null;
          steps: Record<string, any>[];
          start_step: string;
          variables?: Record<string, any>;
          enabled?: boolean;
        };
      };
      workflow_executions: {
        Row: {
          id: string;
          workflow_id: string;
          user_id: string;
          status: 'running' | 'completed' | 'failed' | 'paused';
          input: any;
          output: any;
          current_step: string | null;
          step_results: Record<string, any>;
          variables: Record<string, any>;
          error: string | null;
          started_at: string;
          finished_at: string | null;
          duration: number;
        };
        Insert: {
          workflow_id: string;
          user_id: string;
          status: 'running' | 'completed' | 'failed' | 'paused';
          input: any;
          output?: any;
          current_step?: string | null;
          step_results?: Record<string, any>;
          variables?: Record<string, any>;
          error?: string | null;
          started_at: string;
          finished_at?: string | null;
          duration?: number;
        };
      };
    };
  };
};

export type Tables = Database['public']['Tables'];
