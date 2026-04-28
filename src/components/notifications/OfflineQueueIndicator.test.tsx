import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OfflineQueueIndicator } from './OfflineQueueIndicator'

vi.mock('@/hooks/use-offline-queue', () => ({
  useOfflineQueue: vi.fn(),
}))

import { useOfflineQueue } from '@/hooks/use-offline-queue'

const mockUseOfflineQueue = useOfflineQueue as ReturnType<typeof vi.fn>

describe('OfflineQueueIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when online and no queued items', () => {
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 0, failedCount: 0, isOnline: true, isSyncing: false, sync: vi.fn(),
    })
    const { container } = render(<OfflineQueueIndicator />)
    expect(container.firstChild).toBeNull()
  })

  it('renders button when offline', () => {
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 0, failedCount: 0, isOnline: false, isSyncing: false, sync: vi.fn(),
    })
    render(<OfflineQueueIndicator />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('renders button when there are pending items', () => {
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 3, failedCount: 0, isOnline: true, isSyncing: false, sync: vi.fn(),
    })
    render(<OfflineQueueIndicator />)
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders badge with total count (pending + failed)', () => {
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 2, failedCount: 1, isOnline: true, isSyncing: false, sync: vi.fn(),
    })
    render(<OfflineQueueIndicator />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('button is disabled when offline', () => {
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 1, failedCount: 0, isOnline: false, isSyncing: false, sync: vi.fn(),
    })
    render(<OfflineQueueIndicator />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('button is disabled while syncing', () => {
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 1, failedCount: 0, isOnline: true, isSyncing: true, sync: vi.fn(),
    })
    render(<OfflineQueueIndicator />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls sync when button clicked', async () => {
    const sync = vi.fn().mockResolvedValue(undefined)
    mockUseOfflineQueue.mockReturnValue({
      pendingCount: 2, failedCount: 0, isOnline: true, isSyncing: false, sync,
    })
    render(<OfflineQueueIndicator />)
    fireEvent.click(screen.getByRole('button'))
    expect(sync).toHaveBeenCalled()
  })
})
