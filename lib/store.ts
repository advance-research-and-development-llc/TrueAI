import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from './supabase';

type Tables = Database['public']['Tables'];

export interface AppState {
  userId: string | null;
  theme: 'light' | 'dark';
  ollamaUrl: string;
  activeModelId: string | null;
  activeConversationId: string | null;
  activeKnowledgeBaseIds: string[];
  conversations: Tables['conversations']['Row'][];
  messages: Tables['messages']['Row'][];
  models: Tables['models']['Row'][];
  agents: Tables['agents']['Row'][];
  extensions: Tables['extensions']['Row'][];
  knowledgeBases: Tables['knowledge_bases']['Row'][];

  setUserId: (id: string | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setOllamaUrl: (url: string) => void;
  setActiveModelId: (id: string | null) => void;
  setActiveConversationId: (id: string | null) => void;
  setActiveKnowledgeBaseIds: (ids: string[]) => void;
  setConversations: (conversations: Tables['conversations']['Row'][]) => void;
  setMessages: (messages: Tables['messages']['Row'][]) => void;
  setModels: (models: Tables['models']['Row'][]) => void;
  setAgents: (agents: Tables['agents']['Row'][]) => void;
  setExtensions: (extensions: Tables['extensions']['Row'][]) => void;
  setKnowledgeBases: (knowledgeBases: Tables['knowledge_bases']['Row'][]) => void;

  addConversation: (conversation: Tables['conversations']['Row']) => void;
  addMessage: (message: Tables['messages']['Row']) => void;
  addModel: (model: Tables['models']['Row']) => void;
  addAgent: (agent: Tables['agents']['Row']) => void;
  addExtension: (extension: Tables['extensions']['Row']) => void;
  addKnowledgeBase: (knowledgeBase: Tables['knowledge_bases']['Row']) => void;

  removeConversation: (id: string) => void;
  removeMessage: (id: string) => void;
  removeModel: (id: string) => void;
  removeAgent: (id: string) => void;
  removeExtension: (id: string) => void;
  removeKnowledgeBase: (id: string) => void;

  updateConversation: (id: string, updates: Partial<Tables['conversations']['Row']>) => void;
  updateModel: (id: string, updates: Partial<Tables['models']['Row']>) => void;
  updateAgent: (id: string, updates: Partial<Tables['agents']['Row']>) => void;
  updateExtension: (id: string, updates: Partial<Tables['extensions']['Row']>) => void;
  updateKnowledgeBase: (id: string, updates: Partial<Tables['knowledge_bases']['Row']>) => void;

  clearConversations: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  userId: null,
  theme: 'dark',
  ollamaUrl: 'http://localhost:11434',
  activeModelId: null,
  activeConversationId: null,
  activeKnowledgeBaseIds: [],
  conversations: [],
  messages: [],
  models: [],
  agents: [],
  extensions: [],
  knowledgeBases: [],

  setUserId: (id) => {
    set({ userId: id });
    if (id) {
      AsyncStorage.setItem('userId', id);
    } else {
      AsyncStorage.removeItem('userId');
    }
  },

  setTheme: (theme) => {
    set({ theme });
    AsyncStorage.setItem('theme', theme);
  },

  setOllamaUrl: (url) => {
    set({ ollamaUrl: url });
    AsyncStorage.setItem('ollamaUrl', url);
  },

  setActiveModelId: (id) => {
    set({ activeModelId: id });
    if (id) {
      AsyncStorage.setItem('activeModelId', id);
    }
  },

  setActiveConversationId: (id) => {
    set({ activeConversationId: id });
    if (id) {
      AsyncStorage.setItem('activeConversationId', id);
    }
  },

  setActiveKnowledgeBaseIds: (ids) => {
    set({ activeKnowledgeBaseIds: ids });
    AsyncStorage.setItem('activeKnowledgeBaseIds', JSON.stringify(ids));
  },

  setConversations: (conversations) => set({ conversations }),
  setMessages: (messages) => set({ messages }),
  setModels: (models) => set({ models }),
  setAgents: (agents) => set({ agents }),
  setExtensions: (extensions) => set({ extensions }),
  setKnowledgeBases: (knowledgeBases) => set({ knowledgeBases }),

  addConversation: (conversation) => {
    set({ conversations: [conversation, ...get().conversations] });
  },

  addMessage: (message) => {
    set({ messages: [...get().messages, message] });
  },

  addModel: (model) => {
    set({ models: [model, ...get().models] });
  },

  addAgent: (agent) => {
    set({ agents: [agent, ...get().agents] });
  },

  addExtension: (extension) => {
    set({ extensions: [extension, ...get().extensions] });
  },

  addKnowledgeBase: (knowledgeBase) => {
    set({ knowledgeBases: [knowledgeBase, ...get().knowledgeBases] });
  },

  removeConversation: (id) => {
    set({
      conversations: get().conversations.filter((c) => c.id !== id),
      messages: get().messages.filter((m) => m.conversation_id !== id),
    });
  },

  removeMessage: (id) => {
    set({ messages: get().messages.filter((m) => m.id !== id) });
  },

  removeModel: (id) => {
    set({ models: get().models.filter((m) => m.id !== id) });
  },

  removeAgent: (id) => {
    set({ agents: get().agents.filter((a) => a.id !== id) });
  },

  removeExtension: (id) => {
    set({ extensions: get().extensions.filter((e) => e.id !== id) });
  },

  removeKnowledgeBase: (id) => {
    set({ knowledgeBases: get().knowledgeBases.filter((kb) => kb.id !== id) });
  },

  updateConversation: (id, updates) => {
    set({
      conversations: get().conversations.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    });
  },

  updateModel: (id, updates) => {
    set({
      models: get().models.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    });
  },

  updateAgent: (id, updates) => {
    set({
      agents: get().agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    });
  },

  updateExtension: (id, updates) => {
    set({
      extensions: get().extensions.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    });
  },

  updateKnowledgeBase: (id, updates) => {
    set({
      knowledgeBases: get().knowledgeBases.map((kb) => (kb.id === id ? { ...kb, ...updates } : kb)),
    });
  },

  clearConversations: () => {
    set({ conversations: [], messages: [] });
  },
}));

export async function loadAppState(): Promise<void> {
  const [theme, ollamaUrl, activeModelId, activeConversationId] = await Promise.all([
    AsyncStorage.getItem('theme'),
    AsyncStorage.getItem('ollamaUrl'),
    AsyncStorage.getItem('activeModelId'),
    AsyncStorage.getItem('activeConversationId'),
  ]);

  const store = useAppStore.getState();
  if (theme) store.setTheme(theme as 'light' | 'dark');
  if (ollamaUrl) store.setOllamaUrl(ollamaUrl);
  if (activeModelId) store.setActiveModelId(activeModelId);
  if (activeConversationId) store.setActiveConversationId(activeConversationId);
}
