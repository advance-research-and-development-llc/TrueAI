import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => true,
}))

import { MobileAgentListItem } from './MobileAgentList'
import type { Agent } from '@/lib/types'

const mockAgent: Agent = {
  id: 'agent-1',
  name: 'My Test Agent',
  goal: 'Do things',
  model: 'gpt-4o',
  tools: ['calculator'],
  createdAt: Date.now(),
  status: 'idle',
}

describe('MobileAgentListItem', () => {
  it('renders agent name', () => {
    render(
      <MobileAgentListItem
        agent={mockAgent}
        onRun={vi.fn()}
        onView={vi.fn()}
        onViewAnalytics={vi.fn()}
      />
    )
    expect(screen.getByText('My Test Agent')).toBeInTheDocument()
  })

  it('renders status badge', () => {
    render(
      <MobileAgentListItem
        agent={mockAgent}
        onRun={vi.fn()}
        onView={vi.fn()}
        onViewAnalytics={vi.fn()}
      />
    )
    expect(screen.getByText('idle')).toBeInTheDocument()
  })

  it('calls onView when card is clicked', () => {
    const onView = vi.fn()
    render(
      <MobileAgentListItem
        agent={mockAgent}
        onRun={onView}
        onView={onView}
        onViewAnalytics={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('My Test Agent'))
    expect(onView).toHaveBeenCalled()
  })

  it('renders run button', () => {
    render(
      <MobileAgentListItem
        agent={mockAgent}
        onRun={vi.fn()}
        onView={vi.fn()}
        onViewAnalytics={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument()
  })

  it('calls onRun with agent id when Run button clicked', () => {
    const onRun = vi.fn()
    render(
      <MobileAgentListItem
        agent={mockAgent}
        onRun={onRun}
        onView={vi.fn()}
        onViewAnalytics={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /run/i }))
    expect(onRun).toHaveBeenCalledWith('agent-1')
  })

  it('renders running status with pulse animation class', () => {
    const runningAgent = { ...mockAgent, status: 'running' as const }
    render(
      <MobileAgentListItem
        agent={runningAgent}
        onRun={vi.fn()}
        onView={vi.fn()}
        onViewAnalytics={vi.fn()}
      />
    )
    expect(screen.getByText('running')).toBeInTheDocument()
  })
})
