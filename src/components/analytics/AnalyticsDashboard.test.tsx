import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const { mockUseAnalytics } = vi.hoisted(() => ({
  mockUseAnalytics: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({
  useAnalytics: mockUseAnalytics,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { AnalyticsDashboard } from './AnalyticsDashboard'

describe('AnalyticsDashboard', () => {
  it('renders without crashing when analytics is undefined', () => {
    mockUseAnalytics.mockReturnValue(undefined)
    render(<AnalyticsDashboard />)
    // Should render the dashboard container
    expect(screen.getByText(/analytics/i)).toBeInTheDocument()
  })

  it('renders with empty analytics hook', () => {
    mockUseAnalytics.mockReturnValue({
      getMetrics: vi.fn().mockResolvedValue(null),
      events: [],
      sessions: [],
      clearData: vi.fn(),
    })
    render(<AnalyticsDashboard />)
    expect(document.body).toBeTruthy()
  })

  it('renders tab navigation', () => {
    mockUseAnalytics.mockReturnValue({
      getMetrics: vi.fn().mockResolvedValue(null),
      events: [],
      sessions: [],
      clearData: vi.fn(),
    })
    render(<AnalyticsDashboard />)
    // Should have tab buttons visible
    const tabList = document.querySelector('[role="tablist"]')
    expect(tabList).toBeTruthy()
  })
})
