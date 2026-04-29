import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { DataSettings } from './DataSettings'
import type { AppSettings } from '@/lib/types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const defaultSettings: AppSettings = {
  autoSave: true,
  confirmDelete: true,
  keyboardShortcuts: true,
  language: 'en',
  timezone: 'UTC',
  dateFormat: 'MM/DD/YYYY',
  maxHistory: 50,
  preloadModels: false,
  theme: 'dark',
  fontSize: 14,
  density: 'comfortable',
  showTimestamps: true,
  showAvatars: true,
  compactSidebar: false,
  enableAnimations: true,
  animationSpeed: 1,
  reduceMotion: false,
  streamingEnabled: true,
  codeHighlighting: true,
  markdownEnabled: true,
  defaultTemperature: 0.7,
  defaultMaxTokens: 2000,
  autoRunAgents: false,
  showAgentThinking: true,
  agentTimeout: 120000,
  useConversationContext: true,
  contextWindowSize: 20,
  notificationsEnabled: true,
  notificationSound: true,
  notifyAgentComplete: true,
  notifyModelLoaded: false,
  notifyErrors: true,
  notifyUpdates: true,
  showToast: true,
  toastSuccess: true,
  toastInfo: true,
  analyticsEnabled: false,
  crashReportsEnabled: false,
  telemetryEnabled: false,
  localStorageEnabled: true,
  encryptData: false,
  clearDataOnExit: false,
  requireAuth: false,
  autoLockEnabled: false,
  secureMode: false,
  debugMode: false,
  devTools: false,
  experimentalFeatures: false,
  apiEndpoint: 'default',
  requestTimeout: 30000,
  retryAttempts: 3,
  cacheEnabled: true,
  offlineMode: false,
}

describe('DataSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(spark.kv.get).mockResolvedValue(undefined)
    vi.mocked(spark.kv.set).mockResolvedValue(undefined)
    vi.mocked(spark.kv.delete).mockResolvedValue(undefined)
  })

  it('renders Data Management heading', () => {
    render(<DataSettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    expect(screen.getAllByText('Data Management').length).toBeGreaterThanOrEqual(1)
  })

  it('renders Storage Usage section', () => {
    render(<DataSettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    expect(screen.getByText('Storage Usage')).toBeInTheDocument()
  })

  it('renders Backup & Restore section', () => {
    render(<DataSettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    expect(screen.getByText('Backup & Restore')).toBeInTheDocument()
  })

  it('renders Danger Zone section', () => {
    render(<DataSettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    expect(screen.getByText('Danger Zone')).toBeInTheDocument()
  })

  it('renders Export All Data button', () => {
    render(<DataSettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /export all data/i })).toBeInTheDocument()
  })

  it('renders Import Data button', () => {
    render(<DataSettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /import data/i })).toBeInTheDocument()
  })

  it('renders Clear All Data button', () => {
    render(<DataSettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /clear all data/i })).toBeInTheDocument()
  })

  it('renders estimated data size', () => {
    render(<DataSettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    expect(screen.getByText('2.4 MB')).toBeInTheDocument()
  })

  it('shows Exporting... while export is in progress', async () => {
    vi.mocked(spark.kv.get).mockImplementation(() => new Promise(() => {}))
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() })

    render(<DataSettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    const exportBtn = screen.getByRole('button', { name: /export all data/i })
    fireEvent.click(exportBtn)

    expect(await screen.findByRole('button', { name: /exporting/i })).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('Clear All Data calls spark.kv.delete and shows toast when confirmed', async () => {
    const { toast } = await import('sonner')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.stubGlobal('location', { reload: vi.fn(), href: '/' })
    vi.mocked(spark.kv.delete).mockResolvedValue(undefined)

    render(<DataSettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    const clearBtn = screen.getByRole('button', { name: /clear all data/i })

    await act(async () => {
      fireEvent.click(clearBtn)
    })

    expect(confirmSpy).toHaveBeenCalled()
    expect(spark.kv.delete).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('All data cleared')

    confirmSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('Clear All Data does nothing when confirm returns false', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<DataSettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    const clearBtn = screen.getByRole('button', { name: /clear all data/i })

    await act(async () => {
      fireEvent.click(clearBtn)
    })

    expect(spark.kv.delete).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('Clear Conversations shows info toast when no conversations exist', async () => {
    const { toast } = await import('sonner')
    vi.mocked(spark.kv.get).mockResolvedValue([])

    render(<DataSettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    const clearConvBtn = screen.getByRole('button', { name: /clear conversations/i })

    await act(async () => {
      fireEvent.click(clearConvBtn)
    })

    expect(toast.info).toHaveBeenCalledWith('No conversations to clear')
  })

  it('Clear Agents shows info toast when no agents exist', async () => {
    const { toast } = await import('sonner')
    vi.mocked(spark.kv.get).mockResolvedValue([])

    render(<DataSettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    const clearAgentsBtn = screen.getByRole('button', { name: /clear agents/i })

    await act(async () => {
      fireEvent.click(clearAgentsBtn)
    })

    expect(toast.info).toHaveBeenCalledWith('No agents to clear')
  })
})
