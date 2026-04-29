import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivacySettings } from './PrivacySettings'
import type { AppSettings } from '@/lib/types'

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
  analyticsEnabled: true,
  crashReportsEnabled: true,
  telemetryEnabled: true,
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

describe('PrivacySettings', () => {
  it('renders Privacy & Security Settings heading', () => {
    render(<PrivacySettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    expect(screen.getByText('Privacy & Security Settings')).toBeInTheDocument()
  })

  it('renders Privacy section', () => {
    render(<PrivacySettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    expect(screen.getByText('Privacy')).toBeInTheDocument()
  })

  it('renders Data Storage section', () => {
    render(<PrivacySettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    expect(screen.getByText('Data Storage')).toBeInTheDocument()
  })

  it('renders Security section', () => {
    render(<PrivacySettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    expect(screen.getByText('Security')).toBeInTheDocument()
  })

  it('renders "Your Data is Private" notice', () => {
    render(<PrivacySettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    expect(screen.getByText('Your Data is Private')).toBeInTheDocument()
  })

  it('shows analyticsEnabled switch as checked when true', () => {
    render(<PrivacySettings settings={defaultSettings} onSettingsChange={vi.fn()} />)
    const analyticsSwitch = screen.getByRole('switch', { name: /usage analytics/i })
    expect(analyticsSwitch).toHaveAttribute('data-state', 'checked')
  })

  it('calls onSettingsChange with updated analyticsEnabled when toggled', () => {
    const onChange = vi.fn()
    render(<PrivacySettings settings={defaultSettings} onSettingsChange={onChange} />)
    const analyticsSwitch = screen.getByRole('switch', { name: /usage analytics/i })
    fireEvent.click(analyticsSwitch)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ analyticsEnabled: false }))
  })

  it('calls onSettingsChange with updated crashReportsEnabled when toggled', () => {
    const onChange = vi.fn()
    render(<PrivacySettings settings={defaultSettings} onSettingsChange={onChange} />)
    const crashSwitch = screen.getByRole('switch', { name: /crash reports/i })
    fireEvent.click(crashSwitch)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ crashReportsEnabled: false }))
  })

  it('calls onSettingsChange with updated telemetryEnabled when toggled', () => {
    const onChange = vi.fn()
    render(<PrivacySettings settings={defaultSettings} onSettingsChange={onChange} />)
    const telemetrySwitch = screen.getByRole('switch', { name: /performance telemetry/i })
    fireEvent.click(telemetrySwitch)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ telemetryEnabled: false }))
  })

  it('calls onSettingsChange with updated localStorageEnabled when toggled', () => {
    const onChange = vi.fn()
    render(<PrivacySettings settings={defaultSettings} onSettingsChange={onChange} />)
    const localStorageSwitch = screen.getByRole('switch', { name: /local data storage/i })
    fireEvent.click(localStorageSwitch)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ localStorageEnabled: false }))
  })

  it('calls onSettingsChange with updated encryptData when toggled', () => {
    const onChange = vi.fn()
    render(<PrivacySettings settings={defaultSettings} onSettingsChange={onChange} />)
    const encryptSwitch = screen.getByRole('switch', { name: /encrypt stored data/i })
    fireEvent.click(encryptSwitch)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ encryptData: true }))
  })

  it('calls onSettingsChange with updated clearDataOnExit when toggled', () => {
    const onChange = vi.fn()
    render(<PrivacySettings settings={defaultSettings} onSettingsChange={onChange} />)
    const clearSwitch = screen.getByRole('switch', { name: /clear data on exit/i })
    fireEvent.click(clearSwitch)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ clearDataOnExit: true }))
  })

  it('calls onSettingsChange with updated requireAuth when toggled', () => {
    const onChange = vi.fn()
    render(<PrivacySettings settings={defaultSettings} onSettingsChange={onChange} />)
    const authSwitch = screen.getByRole('switch', { name: /require authentication/i })
    fireEvent.click(authSwitch)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ requireAuth: true }))
  })

  it('calls onSettingsChange with updated autoLockEnabled when toggled', () => {
    const onChange = vi.fn()
    render(<PrivacySettings settings={defaultSettings} onSettingsChange={onChange} />)
    const lockSwitch = screen.getByRole('switch', { name: /auto-lock on idle/i })
    fireEvent.click(lockSwitch)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ autoLockEnabled: true }))
  })

  it('calls onSettingsChange with updated secureMode when toggled', () => {
    const onChange = vi.fn()
    render(<PrivacySettings settings={defaultSettings} onSettingsChange={onChange} />)
    const secureModeSwitch = screen.getByRole('switch', { name: /secure mode/i })
    fireEvent.click(secureModeSwitch)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ secureMode: true }))
  })
})
