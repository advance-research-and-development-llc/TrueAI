export type Framework = 'vanilla' | 'react' | 'vue' | 'svelte'

export interface AppProject {
  id: string
  name: string
  description: string
  prompt: string
  framework: Framework
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
  language: 'typescript' | 'javascript' | 'html' | 'css' | 'json' | 'jsx' | 'tsx' | 'vue' | 'svelte'
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
  frameworks: Framework[]
}

export interface FrameworkConfig {
  id: Framework
  name: string
  description: string
  icon: string
  color: string
  fileStructure: {
    path: string
    language: AppFile['language']
    required: boolean
  }[]
  buildInstructions: string[]
  features: string[]
}
