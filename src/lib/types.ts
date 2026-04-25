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
  messageCount?: number
  tags?: string[]
}

export interface Agent {
  id: string
  name: string
  goal: string
  model: string
  tools: AgentTool[]
  createdAt: number
  status: 'idle' | 'running' | 'completed' | 'error'
  schedule?: AgentSchedule
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

export interface AgentSchedule {
  enabled: boolean
  frequency: 'once' | 'daily' | 'weekly' | 'monthly'
  nextRun: number
  lastRun?: number
}

export interface ModelConfig {
  id: string
  name: string
  provider: 'ollama' | 'openai' | 'huggingface' | 'custom'
  endpoint?: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
  contextLength?: number
  quantization?: string
  size?: number
}

export interface HuggingFaceModel {
  id: string
  name: string
  author: string
  downloads: number
  likes: number
  size: number
  quantization: string
  contextLength: number
  tags: string[]
  description?: string
  downloadUrl: string
}

export interface CustomHarness {
  id: string
  name: string
  description: string
  manifestUrl?: string
  uploadUrl?: string
  tools: string[]
  createdAt: number
  enabled: boolean
}

export interface EnsembleAgent {
  id: string
  name: string
  models: string[]
  strategy: 'consensus' | 'majority' | 'first' | 'best'
  createdAt: number
  runs: EnsembleRun[]
}

export interface EnsembleRun {
  id: string
  ensembleId: string
  prompt: string
  responses: ModelResponse[]
  finalResult: string
  timestamp: number
}

export interface ModelResponse {
  modelId: string
  response: string
  confidence?: number
  responseTime: number
}

export interface KnowledgeBase {
  id: string
  name: string
  description: string
  documents: KnowledgeDocument[]
  createdAt: number
  updatedAt: number
}

export interface KnowledgeDocument {
  id: string
  title: string
  content: string
  chunks: string[]
  embeddings?: number[][]
  addedAt: number
}

export interface Notification {
  id: string
  type: 'agent_complete' | 'agent_error' | 'schedule_run' | 'info'
  title: string
  message: string
  timestamp: number
  read: boolean
  agentId?: string
  runId?: string
}

export interface ConversationAnalytics {
  totalMessages: number
  totalConversations: number
  averageResponseTime: number
  mostUsedModel: string
  messagesByDay: { date: string; count: number }[]
  topTopics: { topic: string; count: number }[]
}

export interface ModelBenchmark {
  modelId: string
  avgResponseTime: number
  avgTokensPerSecond: number
  successRate: number
  totalRuns: number
  lastRun: number
}

export interface ChatSettings {
  activeModel: string
  ollamaUrl: string
  streamingEnabled: boolean
  showTimestamps: boolean
  voiceEnabled: boolean
  notificationsEnabled: boolean
}
