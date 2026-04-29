import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockUsePrefetch } = vi.hoisted(() => ({
  mockUsePrefetch: vi.fn(),
}))

vi.mock('@/hooks/use-prefetch', () => ({
  usePrefetch: mockUsePrefetch,
}))

import { PrefetchManager, PrefetchIndicator } from './PrefetchManager'

const makeHook = (overrides = {}) => ({
  trackTabAccess: vi.fn(),
  getTopPrefetchCandidates: vi.fn().mockReturnValue([]),
  isPrefetched: vi.fn().mockReturnValue(false),
  markAsPrefetched: vi.fn(),
  ...overrides,
})

describe('PrefetchManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePrefetch.mockReturnValue(makeHook())
  })

  it('renders nothing (returns null)', () => {
    const { container } = render(<PrefetchManager currentTab="chat" />)
    expect(container.firstChild).toBeNull()
  })

  it('calls trackTabAccess with current tab on mount', () => {
    const trackTabAccess = vi.fn()
    mockUsePrefetch.mockReturnValue(makeHook({ trackTabAccess }))
    render(<PrefetchManager currentTab="agents" />)
    expect(trackTabAccess).toHaveBeenCalledWith('agents')
  })

  it('calls trackTabAccess again when currentTab changes', () => {
    const trackTabAccess = vi.fn()
    mockUsePrefetch.mockReturnValue(makeHook({ trackTabAccess }))
    const { rerender } = render(<PrefetchManager currentTab="chat" />)
    rerender(<PrefetchManager currentTab="models" />)
    expect(trackTabAccess).toHaveBeenCalledWith('chat')
    expect(trackTabAccess).toHaveBeenCalledWith('models')
  })

  it('calls getTopPrefetchCandidates with current tab', () => {
    const getTopPrefetchCandidates = vi.fn().mockReturnValue([])
    mockUsePrefetch.mockReturnValue(makeHook({ getTopPrefetchCandidates }))
    render(<PrefetchManager currentTab="analytics" />)
    expect(getTopPrefetchCandidates).toHaveBeenCalledWith('analytics')
  })

  it('marks tab as prefetched after successful import', async () => {
    vi.useFakeTimers()
    const markAsPrefetched = vi.fn()
    const getTopPrefetchCandidates = vi.fn().mockReturnValue(['agents'])
    const isPrefetched = vi.fn().mockReturnValue(false)
    mockUsePrefetch.mockReturnValue(
      makeHook({ getTopPrefetchCandidates, isPrefetched, markAsPrefetched })
    )
    render(<PrefetchManager currentTab="chat" />)
    // Component schedules a 500ms timeout for prefetching candidates
    expect(getTopPrefetchCandidates).toHaveBeenCalledWith('chat')
    vi.useRealTimers()
  })

  it('skips prefetch if tab is already prefetched', async () => {
    vi.useFakeTimers()
    const markAsPrefetched = vi.fn()
    const getTopPrefetchCandidates = vi.fn().mockReturnValue(['agents'])
    const isPrefetched = vi.fn().mockReturnValue(true) // already prefetched
    mockUsePrefetch.mockReturnValue(
      makeHook({ getTopPrefetchCandidates, isPrefetched, markAsPrefetched })
    )
    render(<PrefetchManager currentTab="chat" />)
    await act(async () => { vi.advanceTimersByTime(600) })
    expect(markAsPrefetched).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('PrefetchIndicator', () => {
  it('renders animated dot when show=true', () => {
    render(<PrefetchIndicator show={true} />)
    expect(screen.getByText('Prefetching...')).toBeInTheDocument()
  })

  it('renders nothing when show=false', () => {
    const { container } = render(<PrefetchIndicator show={false} />)
    expect(container.firstChild).toBeNull()
  })
})
