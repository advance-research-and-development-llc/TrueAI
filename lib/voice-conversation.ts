/**
 * Voice Conversation Service
 *
 * Manages voice-enabled conversations with speech-to-text and text-to-speech integration.
 * Coordinates between voice input, LLM generation, and voice output for seamless voice interactions.
 */

import { supabase, Database } from './supabase';
import { getVoiceInputService, VoiceInputConfig, AudioBlob } from './voice-input';
import { getVoiceOutputService, VoiceOutputConfig } from './voice-output';
import { InferenceService } from './inference';

type Tables = Database['public']['Tables'];

// ===== Types =====

export interface VoiceConversationConfig {
  voiceInput: VoiceInputConfig;
  voiceOutput: VoiceOutputConfig;
  autoSpeak: boolean; // Automatically speak AI responses
  autoListen: boolean; // Start listening after AI response
  language: string;
}

export interface VoiceMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  text_content: string;
  audio_recording_id: string | null;
  spoken: boolean;
  created_at: string;
}

export interface VoiceConversationSession {
  id: string;
  conversation_id: string;
  config: VoiceConversationConfig;
  status: 'idle' | 'listening' | 'processing' | 'speaking';
  startedAt: Date;
  messagesCount: number;
}

export interface VoiceConversationStats {
  total_voice_messages: number;
  total_audio_duration: number;
  average_message_length: number;
  most_used_language: string;
  voice_enabled_conversations: number;
}

// ===== Voice Conversation Service =====

export class VoiceConversationService {
  private voiceInput = getVoiceInputService();
  private voiceOutput = getVoiceOutputService();
  private activeSessions = new Map<string, VoiceConversationSession>();

  private defaultConfig: VoiceConversationConfig = {
    voiceInput: {
      language: 'en-US',
      continuous: false,
      interimResults: true
    },
    voiceOutput: {
      language: 'en-US',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0
    },
    autoSpeak: true,
    autoListen: false,
    language: 'en-US'
  };

  // ===== Session Management =====

  async startVoiceSession(
    conversationId: string,
    config?: Partial<VoiceConversationConfig>
  ): Promise<VoiceConversationSession> {
    if (this.activeSessions.has(conversationId)) {
      throw new Error('Voice session already active for this conversation');
    }

    const mergedConfig = {
      ...this.defaultConfig,
      ...config,
      voiceInput: { ...this.defaultConfig.voiceInput, ...config?.voiceInput },
      voiceOutput: { ...this.defaultConfig.voiceOutput, ...config?.voiceOutput }
    };

    const session: VoiceConversationSession = {
      id: Date.now().toString(),
      conversation_id: conversationId,
      config: mergedConfig,
      status: 'idle',
      startedAt: new Date(),
      messagesCount: 0
    };

    this.activeSessions.set(conversationId, session);
    return session;
  }

  async endVoiceSession(conversationId: string): Promise<void> {
    const session = this.activeSessions.get(conversationId);
    if (!session) return;

    // Stop any ongoing voice activity
    await this.voiceInput.stopRecording().catch(() => {});
    await this.voiceOutput.stop();

    this.activeSessions.delete(conversationId);
  }

  getActiveSession(conversationId: string): VoiceConversationSession | null {
    return this.activeSessions.get(conversationId) || null;
  }

  // ===== Voice Interaction =====

  async recordAndTranscribe(
    conversationId: string,
    userId: string
  ): Promise<{ text: string; audioRecordingId: string }> {
    const session = this.activeSessions.get(conversationId);
    if (!session) {
      throw new Error('No active voice session for this conversation');
    }

    // Update session status
    session.status = 'listening';

    try {
      // Start recording
      await this.voiceInput.startRecording(session.config.voiceInput);

      // In a real implementation, you'd have UI controls to stop recording
      // For now, this is a placeholder that would be triggered by user action
      // await this.voiceInput.stopRecording() would be called by UI button

      throw new Error('Recording must be stopped by calling stopRecordingAndTranscribe()');
    } catch (error) {
      session.status = 'idle';
      throw error;
    }
  }

  async stopRecordingAndTranscribe(
    conversationId: string,
    userId: string
  ): Promise<{ text: string; audioRecordingId: string }> {
    const session = this.activeSessions.get(conversationId);
    if (!session) {
      throw new Error('No active voice session');
    }

    session.status = 'processing';

    try {
      // Stop recording and get audio
      const audioBlob = await this.voiceInput.stopRecording();

      // Transcribe audio
      const transcription = await this.transcribeAudio(audioBlob);

      // Save recording
      const recording = await this.voiceInput.saveRecording(
        userId,
        audioBlob,
        conversationId,
        transcription.transcript
      );

      session.status = 'idle';
      session.messagesCount++;

      return {
        text: transcription.transcript,
        audioRecordingId: recording.id
      };
    } catch (error) {
      session.status = 'idle';
      throw error;
    }
  }

  async speakResponse(
    conversationId: string,
    text: string
  ): Promise<void> {
    const session = this.activeSessions.get(conversationId);
    if (!session) {
      throw new Error('No active voice session');
    }

    session.status = 'speaking';

    try {
      await this.voiceOutput.speak(text, session.config.voiceOutput);
      session.status = 'idle';

      // Auto-listen after speaking if configured
      if (session.config.autoListen) {
        // Trigger listening (would be implemented in UI)
      }
    } catch (error) {
      session.status = 'idle';
      throw error;
    }
  }

  async voiceChat(
    conversationId: string,
    userId: string,
    modelName: string,
    inferenceService: InferenceService
  ): Promise<{ userText: string; assistantText: string }> {
    const session = this.activeSessions.get(conversationId);
    if (!session) {
      throw new Error('No active voice session');
    }

    // Record user input
    const { text: userText, audioRecordingId } = await this.stopRecordingAndTranscribe(
      conversationId,
      userId
    );

    // Save user message
    await this.saveVoiceMessage(conversationId, 'user', userText, audioRecordingId);

    // Get conversation history
    const messages = await this.getConversationMessages(conversationId);

    // Generate response
    session.status = 'processing';
    let assistantText = '';

    // Convert messages to a prompt string
    const prompt = messages
      .map(m => `${m.role}: ${m.text_content}`)
      .join('\n');

    assistantText = await inferenceService.generate(modelName, prompt);

    // Save assistant message
    await this.saveVoiceMessage(conversationId, 'assistant', assistantText, null);

    // Speak response if auto-speak is enabled
    if (session.config.autoSpeak) {
      await this.speakResponse(conversationId, assistantText);
    }

    session.messagesCount += 2;

    return { userText, assistantText };
  }

  // ===== Database Operations =====

  private async saveVoiceMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    textContent: string,
    audioRecordingId: string | null
  ): Promise<VoiceMessage> {
    const { data, error } = await supabase
      .from('voice_messages')
      .insert({
        conversation_id: conversationId,
        role,
        text_content: textContent,
        audio_recording_id: audioRecordingId,
        spoken: role === 'assistant' // Assistant messages are spoken
      })
      .select()
      .single();

    if (error) throw error;
    return data as VoiceMessage;
  }

  async getConversationMessages(conversationId: string): Promise<VoiceMessage[]> {
    const { data, error } = await supabase
      .from('voice_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as VoiceMessage[];
  }

  async getVoiceMessage(messageId: string): Promise<VoiceMessage | null> {
    const { data, error } = await supabase
      .from('voice_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (error) return null;
    return data as VoiceMessage;
  }

  async deleteVoiceMessage(messageId: string): Promise<void> {
    const message = await this.getVoiceMessage(messageId);
    if (!message) return;

    // Delete associated audio recording
    if (message.audio_recording_id) {
      await this.voiceInput.deleteRecording(message.audio_recording_id);
    }

    // Delete message
    const { error } = await supabase
      .from('voice_messages')
      .delete()
      .eq('id', messageId);

    if (error) throw error;
  }

  // ===== Analytics =====

  async getVoiceConversationStats(userId: string): Promise<VoiceConversationStats> {
    // Get voice messages count
    const { data: messages, error: messagesError } = await supabase
      .from('voice_messages')
      .select('id, text_content')
      .eq('conversation_id', 'any'); // In real implementation, filter by user_id through conversations

    if (messagesError) throw messagesError;

    // Get audio recordings
    const recordings = await this.voiceInput.getUserRecordings(userId);

    const totalDuration = recordings.reduce((sum, r) => sum + r.duration_seconds, 0);
    const avgLength = messages.length > 0
      ? messages.reduce((sum, m) => sum + m.text_content.length, 0) / messages.length
      : 0;

    // Get voice-enabled conversations count
    const { data: conversations, error: convError } = await supabase
      .from('voice_messages')
      .select('conversation_id')
      .eq('conversation_id', 'any'); // Filter properly in real implementation

    const uniqueConversations = new Set(conversations?.map(c => c.conversation_id) || []);

    return {
      total_voice_messages: messages.length,
      total_audio_duration: totalDuration,
      average_message_length: avgLength,
      most_used_language: 'en-US', // Would need to track this
      voice_enabled_conversations: uniqueConversations.size
    };
  }

  // ===== Utilities =====

  private async transcribeAudio(audioBlob: AudioBlob): Promise<{ transcript: string; confidence: number }> {
    // Try provider transcription first
    try {
      const result = await this.voiceInput.transcribe(audioBlob);
      return { transcript: result.transcript, confidence: result.confidence };
    } catch (error) {
      // Fallback: use external transcription service (Whisper API, etc.)
      // This would be implemented based on your preferred service
      throw new Error('Transcription service not configured. Please implement external transcription.');
    }
  }

  async pauseSpeaking(): Promise<void> {
    await this.voiceOutput.pause();

    // Update session status
    for (const [_, session] of this.activeSessions) {
      if (session.status === 'speaking') {
        session.status = 'idle';
      }
    }
  }

  async resumeSpeaking(): Promise<void> {
    await this.voiceOutput.resume();

    // Update session status
    for (const [_, session] of this.activeSessions) {
      if (session.status === 'idle') {
        session.status = 'speaking';
      }
    }
  }

  async stopSpeaking(): Promise<void> {
    await this.voiceOutput.stop();

    // Update all sessions
    for (const [_, session] of this.activeSessions) {
      if (session.status === 'speaking') {
        session.status = 'idle';
      }
    }
  }

  isVoiceSupported(): boolean {
    return this.voiceInput.isSupported() && this.voiceOutput.isSupported();
  }

  getDefaultConfig(): VoiceConversationConfig {
    return { ...this.defaultConfig };
  }

  setDefaultConfig(config: Partial<VoiceConversationConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }
}

// ===== Singleton =====

let voiceConversationServiceInstance: VoiceConversationService | null = null;

export function getVoiceConversationService(): VoiceConversationService {
  if (!voiceConversationServiceInstance) {
    voiceConversationServiceInstance = new VoiceConversationService();
  }
  return voiceConversationServiceInstance;
}
