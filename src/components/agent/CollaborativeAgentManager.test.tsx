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

  it('renders agent list in dialog', () => {
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
    // Open dialog - button is enabled because 2 agents available
    fireEvent.click(screen.getByRole('button', { name: /new collaboration/i }))
    expect(screen.getByText('Agent Alpha')).toBeInTheDocument()
    expect(screen.getByText('Agent Beta')).toBeInTheDocument()
  })

  it('excludes running agents from available list in dialog', () => {
    const agents = [
      makeAgent({ id: 'a1', name: 'Idle Agent One', status: 'idle' }),
      makeAgent({ id: 'a2', name: 'Idle Agent Two', status: 'idle' }),
      makeAgent({ id: 'a3', name: 'Running Agent', status: 'running' }),
    ]
    render(
      <CollaborativeAgentManager
        agents={agents}
        onRunCollaboration={vi.fn()}
      />
    )
    // Open dialog - 2 available idle agents
    fireEvent.click(screen.getByRole('button', { name: /new collaboration/i }))
    expect(screen.getByText('Idle Agent One')).toBeInTheDocument()
    expect(screen.getByText('Idle Agent Two')).toBeInTheDocument()
    expect(screen.queryByText('Running Agent')).not.toBeInTheDocument()
  })

  it('disables New Collaboration button when fewer than 2 agents available', () => {
    const agents = [makeAgent({ id: 'a1', name: 'Only Agent', status: 'idle' })]
    render(
      <CollaborativeAgentManager
        agents={agents}
        onRunCollaboration={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /new collaboration/i })).toBeDisabled()
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
