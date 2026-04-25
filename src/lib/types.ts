export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  model?: string
}

export interface Conversation {
  id: string
  title: string
  systemPrompt?: string
  model: string
  createdAt: number
  updatedAt: number
}

export interface Agent {
  id: string
  name: string
  goal: string
  model: string
  tools: AgentTool[]
  createdAt: number
  status: 'idle' | 'running' | 'completed' | 'error'
}

export type AgentTool = 'calculator' | 'datetime' | 'memory' | 'web_search'

export interface AgentRun {
  id: string
  agentId: string
  startedAt: number
  completedAt?: number
  status: 'running' | 'completed' | 'error'
  steps: AgentStep[]
  result?: string
  error?: string
}

export interface AgentStep {
  id: string
  type: 'planning' | 'tool_call' | 'observation' | 'decision'
  content: string
  toolName?: string
  toolInput?: string
  toolOutput?: string
  timestamp: number
}

export interface ModelConfig {
  id: string
  name: string
  provider: 'ollama' | 'openai' | 'custom'
  endpoint?: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
}

export interface ChatSettings {
  activeModel: string
  ollamaUrl: string
  streamingEnabled: boolean
  showTimestamps: boolean
}
