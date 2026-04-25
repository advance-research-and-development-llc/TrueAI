export interface AppProject {
  id: string
  name: string
  description: string
  prompt: string
  createdAt: number
  updatedAt: number
  status: 'creating' | 'ready' | 'building' | 'testing' | 'error'
  files: AppFile[]
  previewUrl?: string
  testResults?: TestResult[]
  buildLog?: string[]
  error?: string
}

export interface AppFile {
  path: string
  content: string
  language: 'typescript' | 'javascript' | 'html' | 'css' | 'json'
  size: number
}

export interface TestResult {
  id: string
  name: string
  status: 'pass' | 'fail' | 'pending'
  duration: number
  error?: string
  timestamp: number
}

export interface BuildStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  startTime?: number
  endTime?: number
  logs: string[]
}

export interface AppTemplate {
  id: string
  name: string
  description: string
  category: 'productivity' | 'game' | 'utility' | 'social' | 'creative' | 'data'
  preview: string
  basePrompt: string
}
