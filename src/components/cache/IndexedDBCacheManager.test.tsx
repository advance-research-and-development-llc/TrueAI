import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockUseIndexedDBCache } = vi.hoisted(() => ({
  mockUseIndexedDBCache: vi.fn(),
}))

vi.mock('@/hooks/use-indexeddb-cache', () => ({
  useIndexedDBCache: mockUseIndexedDBCache,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { IndexedDBCacheManager } from './IndexedDBCacheManager'
import { toast } from 'sonner'

const makeHook = (overrides = {}) => ({
  isInitialized: true,
  isSyncing: false,
  lastSyncTime: null,
  syncToCache: vi.fn().mockResolvedValue(undefined),
  getCacheStats: vi.fn().mockResolvedValue({
    conversations: 5,
    messages: 42,
    totalSize: 1024 * 512,
    lastCleanup: undefined,
  }),
  cleanupCache: vi.fn().mockResolvedValue(undefined),
  clearCache: vi.fn().mockResolvedValue(undefined),
  exportCache: vi.fn().mockResolvedValue(undefined),
  importCache: vi.fn().mockResolvedValue(undefined),
  ...overrides,
})

describe('IndexedDBCacheManager', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    confirmSpy.mockRestore()
  })

  it('renders heading', () => {
    mockUseIndexedDBCache.mockReturnValue(makeHook())
    render(<IndexedDBCacheManager />)
    expect(screen.getByText('IndexedDB Cache')).toBeInTheDocument()
  })

  it('shows "Active" status when initialized', async () => {
    mockUseIndexedDBCache.mockReturnValue(makeHook({ isInitialized: true }))
    render(<IndexedDBCacheManager />)
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument())
  })

  it('shows "Initializing..." when not initialized', () => {
    mockUseIndexedDBCache.mockReturnValue(
      makeHook({ isInitialized: false, getCacheStats: vi.fn() })
    )
    render(<IndexedDBCacheManager />)
    expect(screen.getByText('Initializing...')).toBeInTheDocument()
  })

  it('loads stats on mount when initialized', async () => {
    const getCacheStats = vi.fn().mockResolvedValue({
      conversations: 3,
      messages: 10,
      totalSize: 0,
      lastCleanup: undefined,
    })
    mockUseIndexedDBCache.mockReturnValue(makeHook({ getCacheStats }))
    render(<IndexedDBCacheManager />)
    await waitFor(() => expect(getCacheStats).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument())
  })

  it('calls syncToCache on Sync Now click and shows success toast', async () => {
    const syncToCache = vi.fn().mockResolvedValue(undefined)
    mockUseIndexedDBCache.mockReturnValue(makeHook({ syncToCache }))
    render(<IndexedDBCacheManager />)
    await waitFor(() => expect(screen.getByRole('button', { name: /sync now/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /sync now/i }))
    await waitFor(() => expect(syncToCache).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Cache synced successfully')
    )
  })

  it('shows error toast when sync fails', async () => {
    const syncToCache = vi.fn().mockRejectedValue(new Error('fail'))
    mockUseIndexedDBCache.mockReturnValue(makeHook({ syncToCache }))
    render(<IndexedDBCacheManager />)
    await waitFor(() => expect(screen.getByRole('button', { name: /sync now/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /sync now/i }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to sync cache')
    )
  })

  it('calls cleanupCache on Cleanup click and shows success toast', async () => {
    const cleanupCache = vi.fn().mockResolvedValue(undefined)
    mockUseIndexedDBCache.mockReturnValue(makeHook({ cleanupCache }))
    render(<IndexedDBCacheManager />)
    await waitFor(() => expect(screen.getByRole('button', { name: /cleanup/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /cleanup/i }))
    await waitFor(() => expect(cleanupCache).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Cache cleaned up successfully')
    )
  })

  it('calls clearCache on Clear All click after confirm', async () => {
    const clearCache = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockUseIndexedDBCache.mockReturnValue(makeHook({ clearCache }))
    render(<IndexedDBCacheManager />)
    await waitFor(() => expect(screen.getByRole('button', { name: /clear all/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    await waitFor(() => expect(clearCache).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Cache cleared successfully')
    )
  })

  it('does not call clearCache if user cancels confirm', async () => {
    const clearCache = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    mockUseIndexedDBCache.mockReturnValue(makeHook({ clearCache }))
    render(<IndexedDBCacheManager />)
    await waitFor(() => expect(screen.getByRole('button', { name: /clear all/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(clearCache).not.toHaveBeenCalled()
  })

  it('calls exportCache on Export click and shows success toast', async () => {
    const exportCache = vi.fn().mockResolvedValue(undefined)
    mockUseIndexedDBCache.mockReturnValue(makeHook({ exportCache }))
    render(<IndexedDBCacheManager />)
    await waitFor(() => expect(screen.getByRole('button', { name: /export/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() => expect(exportCache).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Cache exported successfully')
    )
  })

  it('shows "Syncing..." badge when isSyncing is true', async () => {
    mockUseIndexedDBCache.mockReturnValue(makeHook({ isSyncing: true }))
    render(<IndexedDBCacheManager />)
    expect(screen.getByText('Syncing...')).toBeInTheDocument()
  })

  it('shows "Ready" badge when not syncing and not justSynced', async () => {
    mockUseIndexedDBCache.mockReturnValue(makeHook({ isSyncing: false }))
    render(<IndexedDBCacheManager />)
    await waitFor(() => expect(screen.getByText('Ready')).toBeInTheDocument())
  })

  it('displays last sync time when provided', async () => {
    const lastSyncTime = Date.now()
    mockUseIndexedDBCache.mockReturnValue(makeHook({ lastSyncTime }))
    render(<IndexedDBCacheManager />)
    await waitFor(() => {
      // The time string from toLocaleTimeString will appear in the "Last Sync" row
      expect(screen.queryByText('Never')).not.toBeInTheDocument()
    })
  })

  it('shows "Never" for last sync when lastSyncTime is null', async () => {
    mockUseIndexedDBCache.mockReturnValue(makeHook({ lastSyncTime: null }))
    render(<IndexedDBCacheManager />)
    await waitFor(() => expect(screen.getByText('Never')).toBeInTheDocument())
  })

  it('shows "Synced" badge briefly after sync', async () => {
    const syncToCache = vi.fn().mockResolvedValue(undefined)
    mockUseIndexedDBCache.mockReturnValue(makeHook({ syncToCache }))
    render(<IndexedDBCacheManager />)
    await waitFor(() => expect(screen.getByRole('button', { name: /sync now/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /sync now/i }))
    await waitFor(() => expect(syncToCache).toHaveBeenCalledOnce())
    // After sync the "Synced" badge should appear briefly
    await waitFor(() => expect(screen.getByText('Synced')).toBeInTheDocument(), { timeout: 3000 })
  })
})
