/**
 * Voice Input Service
 *
 * Provides speech-to-text capabilities for voice input in conversations.
 * Supports multiple speech recognition providers and real-time transcription.
 */

import { supabase, Database } from './supabase';

type Tables = Database['public']['Tables'];

// ===== Types =====

export interface VoiceInputConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives?: Array<{
    transcript: string;
    confidence: number;
  }>;
}

export interface AudioRecording {
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
}

export interface VoiceInputProvider {
  startRecording(config: VoiceInputConfig): Promise<void>;
  stopRecording(): Promise<AudioBlob>;
  transcribe(audioBlob: AudioBlob): Promise<TranscriptionResult>;
  isSupported(): boolean;
}

export interface AudioBlob {
  data: Blob | string; // Blob for web, base64 for native
  mimeType: string;
  duration: number;
}

// ===== Web Speech API Provider =====

class WebSpeechProvider implements VoiceInputProvider {
  private recognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;

  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  async startRecording(config: VoiceInputConfig): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Speech recognition not supported in this browser');
    }

    // Initialize Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = config.continuous ?? true;
    this.recognition.interimResults = config.interimResults ?? true;
    this.recognition.lang = config.language ?? 'en-US';
    this.recognition.maxAlternatives = config.maxAlternatives ?? 3;

    // Start audio recording for storage
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    this.audioChunks = [];
    this.startTime = Date.now();

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
    this.recognition.start();
  }

  async stopRecording(): Promise<AudioBlob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const duration = (Date.now() - this.startTime) / 1000;

        resolve({
          data: audioBlob,
          mimeType: 'audio/webm',
          duration
        });

        // Clean up
        if (this.mediaRecorder && this.mediaRecorder.stream) {
          this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
      };

      this.mediaRecorder.stop();
      if (this.recognition) {
        this.recognition.stop();
      }
    });
  }

  async transcribe(audioBlob: AudioBlob): Promise<TranscriptionResult> {
    // Note: Web Speech API transcribes in real-time during recording
    // This method is for compatibility with the interface
    // In practice, you'd listen to recognition.onresult during recording

    return {
      transcript: '',
      confidence: 0,
      isFinal: true,
      alternatives: []
    };
  }
}

// ===== Expo Audio Provider (React Native) =====

class ExpoAudioProvider implements VoiceInputProvider {
  private recording: any = null;
  private startTime: number = 0;

  isSupported(): boolean {
    // Check if running in Expo environment
    try {
      return typeof require('expo-av') !== 'undefined';
    } catch {
      return false;
    }
  }

  async startRecording(config: VoiceInputConfig): Promise<void> {
    try {
      const { Audio } = require('expo-av');

      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Audio recording permission not granted');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.startTime = Date.now();
      await this.recording.startAsync();
    } catch (error) {
      throw new Error(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async stopRecording(): Promise<AudioBlob> {
    if (!this.recording) {
      throw new Error('No active recording');
    }

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      const duration = (Date.now() - this.startTime) / 1000;

      // Read file as base64
      const { FileSystem } = require('expo-file-system');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return {
        data: base64,
        mimeType: 'audio/m4a',
        duration
      };
    } catch (error) {
      throw new Error(`Failed to stop recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async transcribe(audioBlob: AudioBlob): Promise<TranscriptionResult> {
    // Note: Transcription requires an external service like OpenAI Whisper, AssemblyAI, etc.
    // This implementation provides a framework for integration

    // For now, return a mock result that can be replaced with actual API calls
    // To integrate a real service:
    // 1. Add API key to environment variables
    // 2. Use axios to POST audioBlob.data to the transcription service
    // 3. Parse and return the response

    // Mock implementation for testing/development
    const mockTranscription: TranscriptionResult = {
      transcript: '[Audio transcription not configured. Please integrate an external transcription service like OpenAI Whisper or AssemblyAI]',
      confidence: 0.0,
      isFinal: true,
      alternatives: []
    };

    // Example integration with OpenAI Whisper API (commented out):
    /*
    const formData = new FormData();
    formData.append('file', {
      uri: audioBlob.data,
      type: audioBlob.mimeType,
      name: 'audio.m4a'
    });
    formData.append('model', 'whisper-1');

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'multipart/form-data'
      }
    });

    return {
      text: response.data.text,
      confidence: 1.0,
      language: response.data.language || 'en',
      words: [],
      segments: []
    };
    */

    return mockTranscription;
  }
}

// ===== Voice Input Service =====

export class VoiceInputService {
  private provider: VoiceInputProvider;
  private currentRecording: {
    startTime: Date;
    config: VoiceInputConfig;
    transcriptBuffer: string[];
  } | null = null;

  constructor(provider?: VoiceInputProvider) {
    // Auto-detect provider
    if (provider) {
      this.provider = provider;
    } else if (new WebSpeechProvider().isSupported()) {
      this.provider = new WebSpeechProvider();
    } else if (new ExpoAudioProvider().isSupported()) {
      this.provider = new ExpoAudioProvider();
    } else {
      throw new Error('No supported voice input provider found');
    }
  }

  async startRecording(config: VoiceInputConfig = {}): Promise<void> {
    if (this.currentRecording) {
      throw new Error('Recording already in progress');
    }

    this.currentRecording = {
      startTime: new Date(),
      config,
      transcriptBuffer: []
    };

    await this.provider.startRecording(config);
  }

  async stopRecording(): Promise<AudioBlob> {
    if (!this.currentRecording) {
      throw new Error('No active recording');
    }

    const audioBlob = await this.provider.stopRecording();
    this.currentRecording = null;

    return audioBlob;
  }

  async transcribe(audioBlob: AudioBlob): Promise<TranscriptionResult> {
    return await this.provider.transcribe(audioBlob);
  }

  async saveRecording(
    userId: string,
    audioBlob: AudioBlob,
    conversationId?: string,
    transcription?: string
  ): Promise<AudioRecording> {
    // Upload audio to storage
    const audioUrl = await this.uploadAudio(userId, audioBlob);

    // Save to database
    const { data, error } = await supabase
      .from('audio_recordings')
      .insert({
        user_id: userId,
        conversation_id: conversationId || null,
        audio_url: audioUrl,
        duration_seconds: audioBlob.duration,
        transcription: transcription || null,
        transcription_confidence: null,
        language: 'en-US',
        status: transcription ? 'completed' : 'processing'
      })
      .select()
      .single();

    if (error) throw error;
    return data as AudioRecording;
  }

  private async uploadAudio(userId: string, audioBlob: AudioBlob): Promise<string> {
    const filename = `${userId}/${Date.now()}.${audioBlob.mimeType.split('/')[1]}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('audio-recordings')
      .upload(filename, audioBlob.data, {
        contentType: audioBlob.mimeType,
        upsert: false
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('audio-recordings')
      .getPublicUrl(filename);

    return urlData.publicUrl;
  }

  async getRecording(recordingId: string): Promise<AudioRecording | null> {
    const { data, error } = await supabase
      .from('audio_recordings')
      .select('*')
      .eq('id', recordingId)
      .single();

    if (error) return null;
    return data as AudioRecording;
  }

  async getUserRecordings(
    userId: string,
    conversationId?: string
  ): Promise<AudioRecording[]> {
    let query = supabase
      .from('audio_recordings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data as AudioRecording[];
  }

  async deleteRecording(recordingId: string): Promise<void> {
    // Get recording to find audio URL
    const recording = await this.getRecording(recordingId);
    if (!recording) throw new Error('Recording not found');

    // Delete from storage
    const path = recording.audio_url.split('/audio-recordings/')[1];
    if (path) {
      await supabase.storage
        .from('audio-recordings')
        .remove([path]);
    }

    // Delete from database
    const { error } = await supabase
      .from('audio_recordings')
      .delete()
      .eq('id', recordingId);

    if (error) throw error;
  }

  isSupported(): boolean {
    return this.provider.isSupported();
  }
}

// ===== Singleton =====

let voiceInputServiceInstance: VoiceInputService | null = null;

export function getVoiceInputService(): VoiceInputService {
  if (!voiceInputServiceInstance) {
    voiceInputServiceInstance = new VoiceInputService();
  }
  return voiceInputServiceInstance;
}
