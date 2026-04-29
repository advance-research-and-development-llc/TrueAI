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
    expect(screen.getByText(/performance/i)).toBeInTheDocument()
  })

  it('shows 0 total runs when no runs', () => {
    render(<AgentPerformanceMonitor agent={mockAgent} runs={[]} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('shows correct total run count', () => {
    const runs = [makeRun(), makeRun(), makeRun()]
    render(<AgentPerformanceMonitor agent={mockAgent} runs={runs} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('calculates success rate from completed runs', () => {
    const runs = [
      makeRun({ status: 'completed' }),
      makeRun({ status: 'completed' }),
      makeRun({ status: 'error' }),
    ]
    render(<AgentPerformanceMonitor agent={mockAgent} runs={runs} />)
    // 2/3 = 66.7%
    expect(screen.getByText(/66\.7%|67%/i)).toBeInTheDocument()
  })

  it('shows 0% success rate when all runs errored', () => {
    const runs = [
      makeRun({ status: 'error' }),
      makeRun({ status: 'error' }),
    ]
    render(<AgentPerformanceMonitor agent={mockAgent} runs={runs} />)
    expect(screen.getByText(/0%|0\.0%/)).toBeInTheDocument()
  })

  it('only counts runs for the current agent', () => {
    const runs = [
      makeRun({ agentId: 'agent-1', status: 'completed' }),
      makeRun({ agentId: 'other-agent', status: 'completed' }),
    ]
    render(<AgentPerformanceMonitor agent={mockAgent} runs={runs} />)
    // Only 1 run for agent-1
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('renders without crashing when runs is empty', () => {
    render(<AgentPerformanceMonitor agent={mockAgent} runs={[]} />)
    expect(screen.getByText('Test Agent')).toBeInTheDocument()
  })
})
