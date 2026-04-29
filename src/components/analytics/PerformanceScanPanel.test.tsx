import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPerformanceScanner } = vi.hoisted(() => ({
  mockPerformanceScanner: {
    loadScanHistory: vi.fn().mockResolvedValue(undefined),
    scan: vi.fn().mockResolvedValue({
      id: 'scan-1',
      timestamp: Date.now(),
      insights: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
      score: 85,
      metadata: {},
    }),
    getScanHistory: vi.fn().mockReturnValue([]),
  },
}))

vi.mock('@/lib/performance-scanner', () => ({
  performanceScanner: mockPerformanceScanner,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { PerformanceScanPanel } from './PerformanceScanPanel'

describe('PerformanceScanPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders heading', () => {
    render(
      <PerformanceScanPanel
        events={[]}
        models={[]}
        profiles={[]}
        onApplyOptimizations={vi.fn()}
      />
    )
    expect(screen.getByText(/performance scan/i)).toBeInTheDocument()
  })

  it('shows "Run Scan" button', () => {
    render(
      <PerformanceScanPanel
        events={[]}
        models={[]}
        profiles={[]}
        onApplyOptimizations={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /run scan/i })).toBeInTheDocument()
  })

  it('calls performanceScanner.scan when Run Scan clicked', async () => {
    render(
      <PerformanceScanPanel
        events={[]}
        models={[]}
        profiles={[]}
        onApplyOptimizations={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /run scan/i }))
    await waitFor(() => expect(mockPerformanceScanner.scan).toHaveBeenCalledOnce())
  })
})
