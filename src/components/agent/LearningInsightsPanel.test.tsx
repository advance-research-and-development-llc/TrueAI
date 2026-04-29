import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LearningInsightsPanel } from './LearningInsightsPanel'
import type { Agent, AgentLearningMetrics, LearningInsight } from '@/lib/types'

const mockAgent: Agent = {
  id: 'agent-1',
  name: 'Learning Agent',
  goal: 'Improve',
  model: 'gpt-4o',
  tools: [],
  createdAt: Date.now(),
  status: 'idle',
}

const makeInsight = (overrides: Partial<LearningInsight> = {}): LearningInsight => ({
  id: 'i1',
  type: 'recommendation',
  title: 'Test Insight',
  description: 'Insight description',
  confidence: 0.85,
  actionable: true,
  applied: false,
  createdAt: Date.now(),
  ...overrides,
})

const makeMetrics = (overrides: Partial<AgentLearningMetrics> = {}): AgentLearningMetrics => ({
  agentId: 'agent-1',
  totalRuns: 10,
  averageRating: 3.5,
  improvementRate: 12.5,
  commonIssues: [],
  toolEffectiveness: [],
  parameterTrends: {
    temperature: { value: 0.7, trend: 'stable' },
    maxIterations: { value: 10, trend: 'improving' },
  },
  learningInsights: [],
  lastUpdated: Date.now(),
  ...overrides,
})

describe('LearningInsightsPanel', () => {
  it('renders "Learning Metrics" heading', () => {
    render(
      <LearningInsightsPanel
        agent={mockAgent}
        metrics={makeMetrics()}
        onApplyInsight={vi.fn()}
        onTriggerLearning={vi.fn()}
      />
    )
    expect(screen.getByText('Learning Metrics')).toBeInTheDocument()
  })

  it('shows agent name', () => {
    render(
      <LearningInsightsPanel
        agent={mockAgent}
        metrics={makeMetrics()}
        onApplyInsight={vi.fn()}
        onTriggerLearning={vi.fn()}
      />
    )
    expect(screen.getByText(/learning agent/i)).toBeInTheDocument()
  })

  it('displays total runs count', () => {
    render(
      <LearningInsightsPanel
        agent={mockAgent}
        metrics={makeMetrics({ totalRuns: 25 })}
        onApplyInsight={vi.fn()}
        onTriggerLearning={vi.fn()}
      />
    )
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('displays average rating', () => {
    render(
      <LearningInsightsPanel
        agent={mockAgent}
        metrics={makeMetrics({ averageRating: 4.2 })}
        onApplyInsight={vi.fn()}
        onTriggerLearning={vi.fn()}
      />
    )
    expect(screen.getByText('4.2')).toBeInTheDocument()
  })

  it('calls onTriggerLearning when "Analyze & Learn" clicked', () => {
    const onTriggerLearning = vi.fn()
    render(
      <LearningInsightsPanel
        agent={mockAgent}
        metrics={makeMetrics({ totalRuns: 5 })}
        onApplyInsight={vi.fn()}
        onTriggerLearning={onTriggerLearning}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /analyze & learn/i }))
    expect(onTriggerLearning).toHaveBeenCalledOnce()
  })

  it('disables "Analyze & Learn" when totalRuns < 3', () => {
    render(
      <LearningInsightsPanel
        agent={mockAgent}
        metrics={makeMetrics({ totalRuns: 2 })}
        onApplyInsight={vi.fn()}
        onTriggerLearning={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /analyze & learn/i })).toBeDisabled()
  })

  it('shows "Learning..." text when isLearning is true', () => {
    render(
      <LearningInsightsPanel
        agent={mockAgent}
        metrics={makeMetrics()}
        onApplyInsight={vi.fn()}
        onTriggerLearning={vi.fn()}
        isLearning={true}
      />
    )
    expect(screen.getByText(/learning\.\.\./i)).toBeInTheDocument()
  })

  it('renders insights when provided', () => {
    const insights = [
      makeInsight({ id: 'i1', title: 'Insight Alpha' }),
      makeInsight({ id: 'i2', title: 'Insight Beta' }),
    ]
    render(
      <LearningInsightsPanel
        agent={mockAgent}
        metrics={makeMetrics({ learningInsights: insights })}
        onApplyInsight={vi.fn()}
        onTriggerLearning={vi.fn()}
      />
    )
    expect(screen.getByText('Insight Alpha')).toBeInTheDocument()
    expect(screen.getByText('Insight Beta')).toBeInTheDocument()
  })

  it('calls onApplyInsight when Apply button clicked on an insight', () => {
    const onApplyInsight = vi.fn()
    const insights = [makeInsight({ id: 'i1', title: 'Apply me', applied: false })]
    render(
      <LearningInsightsPanel
        agent={mockAgent}
        metrics={makeMetrics({ learningInsights: insights })}
        onApplyInsight={onApplyInsight}
        onTriggerLearning={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /apply/i }))
    expect(onApplyInsight).toHaveBeenCalledOnce()
  })
})
