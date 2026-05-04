/**
 * Voice Output Service
 *
 * Provides text-to-speech capabilities for voice output in conversations.
 * Supports multiple TTS providers and voice customization.
 */

import { supabase } from './supabase';

// ===== Types =====

export interface VoiceOutputConfig {
  voice?: string;
  language?: string;
  rate?: number; // 0.1 to 10
  pitch?: number; // 0 to 2
  volume?: number; // 0 to 1
}

export interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
  provider: 'web' | 'system' | 'cloud';
}

export interface SpeechPlayback {
  id: string;
  text: string;
  config: VoiceOutputConfig;
  status: 'playing' | 'paused' | 'stopped' | 'completed';
  currentTime: number;
  duration: number;
}

export interface VoiceOutputProvider {
  speak(text: string, config: VoiceOutputConfig): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  getAvailableVoices(): Promise<Voice[]>;
  isSupported(): boolean;
}

// ===== Web Speech Synthesis Provider =====

class WebSpeechSynthesisProvider implements VoiceOutputProvider {
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isPaused: boolean = false;

  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'speechSynthesis' in window;
  }

  async speak(text: string, config: VoiceOutputConfig): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Speech synthesis not supported in this browser');
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);

      // Apply configuration
      if (config.voice) {
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.name === config.voice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      if (config.language) utterance.lang = config.language;
      if (config.rate !== undefined) utterance.rate = config.rate;
      if (config.pitch !== undefined) utterance.pitch = config.pitch;
      if (config.volume !== undefined) utterance.volume = config.volume;

      // Set up event handlers
      utterance.onend = () => {
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = (event) => {
        this.currentUtterance = null;
        reject(new Error(`Speech synthesis error: ${event.error}`));
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }

  async pause(): Promise<void> {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      this.isPaused = true;
    }
  }

  async resume(): Promise<void> {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      this.isPaused = false;
    }
  }

  async stop(): Promise<void> {
    window.speechSynthesis.cancel();
    this.currentUtterance = null;
    this.isPaused = false;
  }

  async getAvailableVoices(): Promise<Voice[]> {
    return new Promise((resolve) => {
      const voices = window.speechSynthesis.getVoices();

      if (voices.length > 0) {
        resolve(this.mapVoices(voices));
      } else {
        // Voices might not be loaded yet
        window.speechSynthesis.onvoiceschanged = () => {
          const loadedVoices = window.speechSynthesis.getVoices();
          resolve(this.mapVoices(loadedVoices));
        };
      }
    });
  }

  private mapVoices(voices: SpeechSynthesisVoice[]): Voice[] {
    return voices.map(voice => ({
      id: voice.voiceURI,
      name: voice.name,
      language: voice.lang,
      gender: this.guessGender(voice.name),
      provider: 'web' as const
    }));
  }

  private guessGender(voiceName: string): 'male' | 'female' | 'neutral' {
    const lowerName = voiceName.toLowerCase();
    if (lowerName.includes('male') && !lowerName.includes('female')) return 'male';
    if (lowerName.includes('female')) return 'female';
    return 'neutral';
  }
}

// ===== Expo Speech Provider (React Native) =====

class ExpoSpeechProvider implements VoiceOutputProvider {
  private isSpeaking: boolean = false;

  isSupported(): boolean {
    try {
      return typeof require('expo-speech') !== 'undefined';
    } catch {
      return false;
    }
  }

  async speak(text: string, config: VoiceOutputConfig): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Expo Speech not available');
    }

    const Speech = require('expo-speech');

    return new Promise((resolve, reject) => {
      const options = {
        language: config.language || 'en-US',
        pitch: config.pitch || 1,
        rate: config.rate || 1,
        voice: config.voice,
        onDone: () => {
          this.isSpeaking = false;
          resolve();
        },
        onError: (error: Error) => {
          this.isSpeaking = false;
          reject(error);
        }
      };

      this.isSpeaking = true;
      Speech.speak(text, options);
    });
  }

  async pause(): Promise<void> {
    if (!this.isSupported()) return;
    const Speech = require('expo-speech');
    await Speech.pause();
  }

  async resume(): Promise<void> {
    if (!this.isSupported()) return;
    const Speech = require('expo-speech');
    await Speech.resume();
  }

  async stop(): Promise<void> {
    if (!this.isSupported()) return;
    const Speech = require('expo-speech');
    await Speech.stop();
    this.isSpeaking = false;
  }

  async getAvailableVoices(): Promise<Voice[]> {
    if (!this.isSupported()) return [];

    const Speech = require('expo-speech');
    const voices = await Speech.getAvailableVoicesAsync();

    return voices.map((voice: any) => ({
      id: voice.identifier,
      name: voice.name,
      language: voice.language,
      gender: voice.quality === 'Enhanced' ? 'neutral' : 'neutral',
      provider: 'system' as const
    }));
  }
}

// ===== Voice Output Service =====

export class VoiceOutputService {
  private provider: VoiceOutputProvider;
  private currentPlayback: SpeechPlayback | null = null;
  private defaultConfig: VoiceOutputConfig = {
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    language: 'en-US'
  };

  constructor(provider?: VoiceOutputProvider) {
    // Auto-detect provider
    if (provider) {
      this.provider = provider;
    } else if (new WebSpeechSynthesisProvider().isSupported()) {
      this.provider = new WebSpeechSynthesisProvider();
    } else if (new ExpoSpeechProvider().isSupported()) {
      this.provider = new ExpoSpeechProvider();
    } else {
      throw new Error('No supported voice output provider found');
    }
  }

  async speak(text: string, config: VoiceOutputConfig = {}): Promise<void> {
    const mergedConfig = { ...this.defaultConfig, ...config };

    this.currentPlayback = {
      id: Date.now().toString(),
      text,
      config: mergedConfig,
      status: 'playing',
      currentTime: 0,
      duration: this.estimateDuration(text, mergedConfig.rate || 1)
    };

    try {
      await this.provider.speak(text, mergedConfig);
      if (this.currentPlayback) {
        this.currentPlayback.status = 'completed';
      }
    } catch (error) {
      if (this.currentPlayback) {
        this.currentPlayback.status = 'stopped';
      }
      throw error;
    } finally {
      this.currentPlayback = null;
    }
  }

  async speakMessageStream(
    textGenerator: AsyncGenerator<string>,
    config: VoiceOutputConfig = {}
  ): Promise<void> {
    // Speak text as it arrives from a stream (e.g., LLM generation)
    const sentences: string[] = [];
    let buffer = '';

    for await (const chunk of textGenerator) {
      buffer += chunk;

      // Look for sentence boundaries
      const sentenceMatch = buffer.match(/[.!?]+\s+/);
      if (sentenceMatch) {
        const sentence = buffer.slice(0, sentenceMatch.index! + sentenceMatch[0].length);
        buffer = buffer.slice(sentenceMatch.index! + sentenceMatch[0].length);

        // Speak the sentence
        await this.speak(sentence.trim(), config);
      }
    }

    // Speak remaining text
    if (buffer.trim()) {
      await this.speak(buffer.trim(), config);
    }
  }

  async pause(): Promise<void> {
    if (this.currentPlayback && this.currentPlayback.status === 'playing') {
      await this.provider.pause();
      this.currentPlayback.status = 'paused';
    }
  }

  async resume(): Promise<void> {
    if (this.currentPlayback && this.currentPlayback.status === 'paused') {
      await this.provider.resume();
      this.currentPlayback.status = 'playing';
    }
  }

  async stop(): Promise<void> {
    await this.provider.stop();
    if (this.currentPlayback) {
      this.currentPlayback.status = 'stopped';
      this.currentPlayback = null;
    }
  }

  async getAvailableVoices(): Promise<Voice[]> {
    return await this.provider.getAvailableVoices();
  }

  getCurrentPlayback(): SpeechPlayback | null {
    return this.currentPlayback;
  }

  setDefaultConfig(config: VoiceOutputConfig): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  getDefaultConfig(): VoiceOutputConfig {
    return { ...this.defaultConfig };
  }

  private estimateDuration(text: string, rate: number): number {
    // Rough estimate: average reading speed is ~150 words per minute
    const words = text.split(/\s+/).length;
    const baseMinutes = words / 150;
    const adjustedMinutes = baseMinutes / rate;
    return adjustedMinutes * 60; // convert to seconds
  }

  isSupported(): boolean {
    return this.provider.isSupported();
  }

  // User preferences

  async saveUserVoicePreferences(
    userId: string,
    preferences: VoiceOutputConfig
  ): Promise<void> {
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        preference_type: 'voice_output',
        preferences: preferences as any
      });

    if (error) throw error;
  }

  async getUserVoicePreferences(userId: string): Promise<VoiceOutputConfig | null> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('preferences')
      .eq('user_id', userId)
      .eq('preference_type', 'voice_output')
      .single();

    if (error) return null;
    return data?.preferences as VoiceOutputConfig;
  }
}

// ===== Singleton =====

let voiceOutputServiceInstance: VoiceOutputService | null = null;

export function getVoiceOutputService(): VoiceOutputService {
  if (!voiceOutputServiceInstance) {
    voiceOutputServiceInstance = new VoiceOutputService();
  }
  return voiceOutputServiceInstance;
}
