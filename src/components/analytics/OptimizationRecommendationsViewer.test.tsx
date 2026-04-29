import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OptimizationRecommendationsViewer } from './OptimizationRecommendationsViewer'

describe('OptimizationRecommendationsViewer', () => {
  it('renders heading', () => {
    render(
      <OptimizationRecommendationsViewer
        insights={[]}
        autoTuneRecommendations={[]}
        models={[]}
        appliedInsights={new Set()}
        onApplyInsight={vi.fn()}
        onApplyAutoTune={vi.fn()}
        onApplyAll={vi.fn()}
      />
    )
    expect(screen.getByText(/optimization recommendations/i)).toBeInTheDocument()
  })

  it('renders empty state when no insights', () => {
    render(
      <OptimizationRecommendationsViewer
        insights={[]}
        autoTuneRecommendations={[]}
        models={[]}
        appliedInsights={new Set()}
        onApplyInsight={vi.fn()}
        onApplyAutoTune={vi.fn()}
        onApplyAll={vi.fn()}
      />
    )
    expect(screen.getByText(/no recommendations/i)).toBeInTheDocument()
  })

  it('shows "Apply All" button', () => {
    render(
      <OptimizationRecommendationsViewer
        insights={[]}
        autoTuneRecommendations={[]}
        models={[]}
        appliedInsights={new Set()}
        onApplyInsight={vi.fn()}
        onApplyAutoTune={vi.fn()}
        onApplyAll={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /apply all/i })).toBeInTheDocument()
  })

  it('calls onApplyAll when Apply All clicked', () => {
    const onApplyAll = vi.fn()
    render(
      <OptimizationRecommendationsViewer
        insights={[]}
        autoTuneRecommendations={[]}
        models={[]}
        appliedInsights={new Set()}
        onApplyInsight={vi.fn()}
        onApplyAutoTune={vi.fn()}
        onApplyAll={onApplyAll}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /apply all/i }))
    expect(onApplyAll).toHaveBeenCalledOnce()
  })
})
