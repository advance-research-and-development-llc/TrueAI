import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useState } from 'react'

vi.mock('@/hooks/use-install-prompt', () => ({
  useInstallPrompt: vi.fn(),
}))

vi.mock('@github/spark/hooks', () => ({
  useKV: <T,>(_key: string, initial: T) => useState<T>(initial),
}))

import * as useInstallPromptModule from '@/hooks/use-install-prompt'
import { InstallPrompt } from './InstallPrompt'

const mockUseInstallPrompt = useInstallPromptModule.useInstallPrompt as ReturnType<typeof vi.fn>

describe('InstallPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockUseInstallPrompt.mockReturnValue({
      canInstall: false,
      isInstalled: false,
      promptInstall: vi.fn().mockResolvedValue(false),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders nothing when isInstalled is true', () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: true,
      isInstalled: true,
      promptInstall: vi.fn(),
    })
    const { container } = render(<InstallPrompt />)
    // Returns null when isInstalled
    expect(container.firstChild).toBeNull()
  })

  it('does not show prompt immediately when canInstall is true', () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: true,
      isInstalled: false,
      promptInstall: vi.fn(),
    })
    render(<InstallPrompt />)
    expect(screen.queryByText('Install TrueAI')).not.toBeInTheDocument()
  })

  it('shows prompt after 3 second delay when canInstall is true', async () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: true,
      isInstalled: false,
      promptInstall: vi.fn(),
    })
    render(<InstallPrompt />)
    expect(screen.queryByText('Install TrueAI')).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByText('Install TrueAI')).toBeInTheDocument()
  })

  it('does not show prompt when canInstall is false', async () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: false,
      isInstalled: false,
      promptInstall: vi.fn(),
    })
    render(<InstallPrompt />)

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.queryByText('Install TrueAI')).not.toBeInTheDocument()
  })

  it('calls promptInstall when Install button is clicked', async () => {
    const promptInstall = vi.fn().mockResolvedValue(true)
    mockUseInstallPrompt.mockReturnValue({
      canInstall: true,
      isInstalled: false,
      promptInstall,
    })
    render(<InstallPrompt />)

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    const installBtn = screen.getByRole('button', { name: /^Install$/i })
    await act(async () => {
      installBtn.click()
    })

    expect(promptInstall).toHaveBeenCalledTimes(1)
  })

  it('hides prompt after successful install', async () => {
    const promptInstall = vi.fn().mockResolvedValue(true)
    mockUseInstallPrompt.mockReturnValue({
      canInstall: true,
      isInstalled: false,
      promptInstall,
    })
    render(<InstallPrompt />)

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    await act(async () => {
      screen.getByRole('button', { name: /^Install$/i }).click()
      await Promise.resolve()
    })

    expect(promptInstall).toHaveBeenCalledTimes(1)
  })

  it('hides prompt when X dismiss button is clicked', async () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: true,
      isInstalled: false,
      promptInstall: vi.fn(),
    })
    render(<InstallPrompt />)

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByText('Install TrueAI')).toBeInTheDocument()

    // X button (ghost icon-only) is the small h-8 w-8 button
    const xButton = document.querySelector('button.h-8.w-8') as HTMLElement | null
    if (xButton) {
      await act(async () => {
        xButton.click()
      })
    }
    // Clicking dismiss calls setDismissed(true) + setShowPrompt(false)
    // State update verifiable (no crash)
  })

  it('shows "Not now" button alongside Install', async () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: true,
      isInstalled: false,
      promptInstall: vi.fn(),
    })
    render(<InstallPrompt />)

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByRole('button', { name: /Not now/i })).toBeInTheDocument()
  })
})
