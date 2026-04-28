import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ServiceWorkerUpdate } from './ServiceWorkerUpdate'

vi.mock('@/lib/serviceWorker', () => ({
  skipWaiting: vi.fn(),
}))

import { skipWaiting } from '@/lib/serviceWorker'

const mockSkipWaiting = skipWaiting as ReturnType<typeof vi.fn>

function makeReg(waiting: object | null = null) {
  return {
    waiting,
    installing: null,
    addEventListener: vi.fn(),
  }
}

function mockSW(reg: object) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(reg), controller: {} },
    configurable: true,
    writable: true,
  })
}

describe('ServiceWorkerUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Provide a no-op SW so the 'serviceWorker' in navigator check passes
    // but the ready promise resolves to a reg with no waiting worker.
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(makeReg(null)), controller: {} },
      configurable: true,
      writable: true,
    })
  })

  it('renders nothing initially (no waiting worker)', async () => {
    render(<ServiceWorkerUpdate />)
    // Give the ready promise time to resolve
    await Promise.resolve()
    expect(screen.queryByText('Update available')).not.toBeInTheDocument()
  })

  it('does not show update banner when there is no waiting worker', async () => {
    render(<ServiceWorkerUpdate />)
    await Promise.resolve()
    expect(screen.queryByRole('button', { name: /update/i })).not.toBeInTheDocument()
  })

  it('shows update banner when waiting SW detected', async () => {
    const mockWaiting = { postMessage: vi.fn() }
    mockSW(makeReg(mockWaiting))

    render(<ServiceWorkerUpdate />)
    await waitFor(() => {
      expect(screen.getByText('Update available')).toBeInTheDocument()
    })
    expect(screen.getByText('A new version is ready to install')).toBeInTheDocument()
  })

  it('clicking Later hides the banner', async () => {
    const mockWaiting = { postMessage: vi.fn() }
    mockSW(makeReg(mockWaiting))

    render(<ServiceWorkerUpdate />)
    await waitFor(() => {
      expect(screen.getByText('Update available')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /later/i }))

    await waitFor(() => {
      expect(screen.queryByText('Update available')).not.toBeInTheDocument()
    })
  })

  it('clicking Update calls skipWaiting and reloads', async () => {
    const mockWaiting = { postMessage: vi.fn() }
    mockSW(makeReg(mockWaiting))

    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      configurable: true,
      writable: true,
    })

    render(<ServiceWorkerUpdate />)
    await waitFor(() => {
      expect(screen.getByText('Update available')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /^update$/i }))
    expect(mockSkipWaiting).toHaveBeenCalled()
    expect(reloadMock).toHaveBeenCalled()
  })
})
