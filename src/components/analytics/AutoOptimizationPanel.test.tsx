import { render, screen, fireEvent } from '@testing-library/react'
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

import { AutoOptimizationPanel } from './AutoOptimizationPanel'
import { DEFAULT_THRESHOLDS } from '@/lib/confidence-thresholds'

beforeEach(() => {
  mockUseAnalytics.mockReturnValue({
    events: [],
    getMetrics: vi.fn().mockResolvedValue(null),
  })
})

describe('AutoOptimizationPanel', () => {
  it('renders without crashing', () => {
    render(
      <AutoOptimizationPanel
        models={[]}
        profiles={[]}
        onApplyOptimization={vi.fn()}
        onApplyAutoTune={vi.fn()}
        onCreateProfile={vi.fn()}
        thresholdConfig={DEFAULT_THRESHOLDS}
        onThresholdConfigChange={vi.fn()}
      />
    )
    expect(document.body).toBeTruthy()
  })

  it('renders heading text', () => {
    render(
      <AutoOptimizationPanel
        models={[]}
        profiles={[]}
        onApplyOptimization={vi.fn()}
        onApplyAutoTune={vi.fn()}
        onCreateProfile={vi.fn()}
      />
    )
    expect(screen.getByText(/auto.optim|intelligent optim/i)).toBeInTheDocument()
  })
})
