import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { OfflineIndicator } from './OfflineIndicator'
import { isOffline, onOnlineStatusChange } from '@/lib/serviceWorker'

vi.mock('@/lib/serviceWorker', () => ({
  isOffline: vi.fn(() => false),
  onOnlineStatusChange: vi.fn(() => vi.fn())
}))

describe('OfflineIndicator', () => {
  let statusCallback: ((isOnline: boolean) => void) | null = null

  beforeEach(() => {
    vi.mocked(isOffline).mockReturnValue(false)
    statusCallback = null
    vi.mocked(onOnlineStatusChange).mockImplementation((cb) => {
      statusCallback = cb
      return vi.fn()
    })
  })

  it('shows nothing when online', () => {
    vi.mocked(isOffline).mockReturnValue(false)
    const { container } = render(<OfflineIndicator />)
    expect(screen.queryByText('You are offline')).not.toBeInTheDocument()
    expect(screen.queryByText('Back online!')).not.toBeInTheDocument()
    // No banner visible
    expect(container.querySelector('.fixed')).not.toBeInTheDocument()
  })

  it('shows offline banner when isOffline returns true', () => {
    vi.mocked(isOffline).mockReturnValue(true)
    render(<OfflineIndicator />)
    expect(screen.getByText('You are offline')).toBeInTheDocument()
  })

  it('shows "Working from cache" text when offline', () => {
    vi.mocked(isOffline).mockReturnValue(true)
    render(<OfflineIndicator />)
    expect(screen.getByText(/Working from cache/)).toBeInTheDocument()
  })

  it('shows "Back online!" when onOnlineStatusChange fires with isOnline=true', () => {
    vi.mocked(isOffline).mockReturnValue(false)
    render(<OfflineIndicator />)

    act(() => {
      statusCallback?.(false) // goes offline
    })
    act(() => {
      statusCallback?.(true) // comes back online
    })

    expect(screen.getByText('Back online!')).toBeInTheDocument()
  })

  it('shows reload button when offline', () => {
    vi.mocked(isOffline).mockReturnValue(true)
    render(<OfflineIndicator />)
    // The reload button contains an SVG (ArrowsClockwise icon)
    const card = screen.getByText('You are offline').closest('.fixed') ??
      document.querySelector('.fixed')
    expect(card).toBeTruthy()
    const buttons = document.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('calls window.location.reload() when reload button is clicked', () => {
    vi.mocked(isOffline).mockReturnValue(true)
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    })

    render(<OfflineIndicator />)
    const buttons = document.querySelectorAll('button')
    fireEvent.click(buttons[0])
    expect(reloadMock).toHaveBeenCalled()
  })

  it('does not show banner initially when online (no showBanner state)', () => {
    vi.mocked(isOffline).mockReturnValue(false)
    render(<OfflineIndicator />)
    expect(screen.queryByText('You are offline')).not.toBeInTheDocument()
    expect(screen.queryByText('Back online!')).not.toBeInTheDocument()
  })
})
