import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AgentPerformanceMonitor } from './AgentPerformanceMonitor'
import type { Agent, AgentRun } from '@/lib/types'

const mockAgent: Agent = {
  id: 'agent-1',
  name: 'Test Agent',
  goal: 'Do things',
  model: 'gpt-4o',
  tools: [],
  createdAt: Date.now(),
  status: 'idle',
}

const makeRun = (overrides: Partial<AgentRun> = {}): AgentRun => ({
  id: `run-${Math.random()}`,
  agentId: 'agent-1',
  startedAt: Date.now() - 5000,
  completedAt: Date.now(),
  status: 'completed',
  steps: [],
  tokensUsed: 100,
  ...overrides,
})

describe('AgentPerformanceMonitor', () => {
  it('renders heading', () => {
    render(<AgentPerformanceMonitor agent={mockAgent} runs={[]} />)
    expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
  })

  it('shows 0 total runs when no runs', () => {
    render(<AgentPerformanceMonitor agent={mockAgent} runs={[]} />)
    // Total Runs cell should be 0
    expect(screen.getByText('Total Runs').closest('div')!.nextElementSibling?.textContent).toBe('0')
  })

  it('shows correct total run count', () => {
    const runs = [makeRun(), makeRun(), makeRun()]
    render(<AgentPerformanceMonitor agent={mockAgent} runs={runs} />)
    expect(screen.getByText('Total Runs').closest('div')!.nextElementSibling?.textContent).toBe('3')
  })

  it('calculates success rate from completed runs', () => {
    const runs = [
      makeRun({ status: 'completed' }),
      makeRun({ status: 'completed' }),
      makeRun({ status: 'error' }),
    ]
    render(<AgentPerformanceMonitor agent={mockAgent} runs={runs} />)
    // 2/3 = 66.7% — may appear twice (metric + progress bar), use getAllByText
    const matches = screen.getAllByText('66.7%')
    expect(matches.length).toBeGreaterThan(0)
  })

  it('shows 0.0% success rate when all runs errored', () => {
    const runs = [
      makeRun({ status: 'error' }),
      makeRun({ status: 'error' }),
    ]
    render(<AgentPerformanceMonitor agent={mockAgent} runs={runs} />)
    const matches = screen.getAllByText('0.0%')
    expect(matches.length).toBeGreaterThan(0)
  })

  it('only counts runs for the current agent', () => {
    const runs = [
      makeRun({ agentId: 'agent-1', status: 'completed' }),
      makeRun({ agentId: 'other-agent', status: 'completed' }),
    ]
    render(<AgentPerformanceMonitor agent={mockAgent} runs={runs} />)
    // Only 1 run for agent-1
    expect(screen.getByText('Total Runs').closest('div')!.nextElementSibling?.textContent).toBe('1')
  })

  it('renders without crashing when runs is empty', () => {
    render(<AgentPerformanceMonitor agent={mockAgent} runs={[]} />)
    expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
  })
})
