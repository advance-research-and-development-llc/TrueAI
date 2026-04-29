import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { CollaborativeAgentManager } from './CollaborativeAgentManager'
import type { Agent } from '@/lib/types'

const makeAgent = (overrides: Partial<Agent> = {}): Agent => ({
  id: `agent-${Math.random()}`,
  name: 'Test Agent',
  goal: 'Do things',
  model: 'gpt-4o',
  tools: [],
  createdAt: Date.now(),
  status: 'idle',
  ...overrides,
})

describe('CollaborativeAgentManager', () => {
  it('renders heading', () => {
    render(
      <CollaborativeAgentManager
        agents={[]}
        onRunCollaboration={vi.fn()}
      />
    )
    expect(screen.getByText(/collaborative/i)).toBeInTheDocument()
  })

  it('renders agent list', () => {
    const agents = [
      makeAgent({ id: 'a1', name: 'Agent Alpha' }),
      makeAgent({ id: 'a2', name: 'Agent Beta' }),
    ]
    render(
      <CollaborativeAgentManager
        agents={agents}
        onRunCollaboration={vi.fn()}
      />
    )
    expect(screen.getByText('Agent Alpha')).toBeInTheDocument()
    expect(screen.getByText('Agent Beta')).toBeInTheDocument()
  })

  it('excludes running agents from available list', () => {
    const agents = [
      makeAgent({ id: 'a1', name: 'Idle Agent', status: 'idle' }),
      makeAgent({ id: 'a2', name: 'Running Agent', status: 'running' }),
    ]
    render(
      <CollaborativeAgentManager
        agents={agents}
        onRunCollaboration={vi.fn()}
      />
    )
    expect(screen.getByText('Idle Agent')).toBeInTheDocument()
    expect(screen.queryByText('Running Agent')).not.toBeInTheDocument()
  })

  it('shows error toast when less than 2 agents selected and Run clicked', async () => {
    const { toast } = await import('sonner')
    const agents = [makeAgent({ id: 'a1', name: 'Only Agent' })]
    render(
      <CollaborativeAgentManager
        agents={agents}
        onRunCollaboration={vi.fn()}
      />
    )
    // Select only 1 agent
    fireEvent.click(screen.getByText('Only Agent'))
    // Try to run
    const runBtn = screen.getByRole('button', { name: /run collaboration/i })
    fireEvent.click(runBtn)
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Select at least 2 agents for collaboration')
    )
  })

  it('shows "New Collaboration" button', () => {
    render(
      <CollaborativeAgentManager
        agents={[]}
        onRunCollaboration={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /new collaboration/i })).toBeInTheDocument()
  })
})
