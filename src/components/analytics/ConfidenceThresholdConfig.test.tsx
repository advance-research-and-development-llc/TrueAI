import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ConfidenceThresholdConfig } from './ConfidenceThresholdConfig'
import type { ThresholdConfig } from '@/lib/confidence-thresholds'
import { DEFAULT_THRESHOLDS } from '@/lib/confidence-thresholds'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('ConfidenceThresholdConfig', () => {
  it('renders heading', () => {
    render(
      <ConfidenceThresholdConfig
        config={DEFAULT_THRESHOLDS}
        onConfigChange={vi.fn()}
      />
    )
    expect(screen.getByText(/confidence threshold/i)).toBeInTheDocument()
  })

  it('renders preset buttons', () => {
    render(
      <ConfidenceThresholdConfig
        config={DEFAULT_THRESHOLDS}
        onConfigChange={vi.fn()}
      />
    )
    expect(screen.getByText('Conservative')).toBeInTheDocument()
    expect(screen.getByText('Balanced')).toBeInTheDocument()
    expect(screen.getByText('Aggressive')).toBeInTheDocument()
  })

  it('calls onConfigChange when Conservative preset clicked', () => {
    const onConfigChange = vi.fn()
    render(
      <ConfidenceThresholdConfig
        config={DEFAULT_THRESHOLDS}
        onConfigChange={onConfigChange}
      />
    )
    fireEvent.click(screen.getByText('Conservative').closest('button')!)
    expect(onConfigChange).toHaveBeenCalledOnce()
  })

  it('renders severity threshold labels', () => {
    render(
      <ConfidenceThresholdConfig
        config={DEFAULT_THRESHOLDS}
        onConfigChange={vi.fn()}
      />
    )
    expect(screen.getAllByText(/critical/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/high/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/medium/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/low/i).length).toBeGreaterThan(0)
  })

  it('renders session stats when provided', () => {
    render(
      <ConfidenceThresholdConfig
        config={DEFAULT_THRESHOLDS}
        onConfigChange={vi.fn()}
        sessionStats={{
          totalImplemented: 10,
          autoImplemented: 5,
          manualImplemented: 5,
          averageConfidence: 0.82,
        }}
      />
    )
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('shows Auto-Implement toggle', () => {
    render(
      <ConfidenceThresholdConfig
        config={DEFAULT_THRESHOLDS}
        onConfigChange={vi.fn()}
      />
    )
    expect(screen.getByText(/auto.implement/i)).toBeInTheDocument()
  })
})
