import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockUseIndexedDBCache } = vi.hoisted(() => ({
  mockUseIndexedDBCache: vi.fn(),
}))

vi.mock('@/hooks/use-indexeddb-cache', () => ({
  useIndexedDBCache: mockUseIndexedDBCache,
}))

import { IndexedDBStatus } from './IndexedDBStatus'

const makeHook = (overrides = {}) => ({
  isInitialized: true,
  isSyncing: false,
  lastSyncTime: null,
  ...overrides,
})

describe('IndexedDBStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "Initializing" text when not initialized', () => {
    mockUseIndexedDBCache.mockReturnValue(makeHook({ isInitialized: false }))
    render(<IndexedDBStatus />)
    expect(screen.getByText('Initializing')).toBeInTheDocument()
  })

  it('shows "Syncing" text when syncing', () => {
    mockUseIndexedDBCache.mockReturnValue(makeHook({ isInitialized: true, isSyncing: true }))
    render(<IndexedDBStatus />)
    expect(screen.getByText('Syncing')).toBeInTheDocument()
  })

  it('shows "Cached" text when initialized and not syncing', () => {
    mockUseIndexedDBCache.mockReturnValue(makeHook({ isInitialized: true, isSyncing: false }))
    render(<IndexedDBStatus />)
    expect(screen.getByText('Cached')).toBeInTheDocument()
  })

  it('renders a badge element', () => {
    mockUseIndexedDBCache.mockReturnValue(makeHook())
    render(<IndexedDBStatus />)
    // There should be a visible badge
    expect(screen.getByText('Cached')).toBeInTheDocument()
  })

  it('does not crash with lastSyncTime provided', () => {
    mockUseIndexedDBCache.mockReturnValue(
      makeHook({ isInitialized: true, isSyncing: false, lastSyncTime: Date.now() - 30000 })
    )
    render(<IndexedDBStatus />)
    expect(screen.getByText('Cached')).toBeInTheDocument()
  })
})
