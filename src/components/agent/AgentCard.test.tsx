import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentCard } from './AgentCard'
import type { Agent } from '@/lib/types'

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    goal: 'Do something useful',
    model: 'llama3.2',
    tools: [],
    createdAt: Date.now(),
    status: 'idle',
    ...overrides,
  }
}

describe('AgentCard', () => {
  const onRun = vi.fn()
  const onDelete = vi.fn()
  const onView = vi.fn()
  const onFeedback = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders agent name and goal', () => {
    render(
      <AgentCard
        agent={makeAgent()}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
      />
    )
    expect(screen.getByText('Test Agent')).toBeInTheDocument()
    expect(screen.getByText('Do something useful')).toBeInTheDocument()
  })

  it('renders the idle status badge', () => {
    render(
      <AgentCard
        agent={makeAgent({ status: 'idle' })}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
      />
    )
    expect(screen.getByText('idle')).toBeInTheDocument()
  })

  it('renders the running status badge', () => {
    render(
      <AgentCard
        agent={makeAgent({ status: 'running' })}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
      />
    )
    expect(screen.getByText('running')).toBeInTheDocument()
  })

  it('renders the completed status badge', () => {
    render(
      <AgentCard
        agent={makeAgent({ status: 'completed' })}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
      />
    )
    expect(screen.getByText('completed')).toBeInTheDocument()
  })

  it('renders the error status badge', () => {
    render(
      <AgentCard
        agent={makeAgent({ status: 'error' })}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
      />
    )
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('shows "No tools configured" when agent has no tools', () => {
    render(
      <AgentCard
        agent={makeAgent({ tools: [] })}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
      />
    )
    expect(screen.getByText('No tools configured')).toBeInTheDocument()
  })

  it('renders tool badges when agent has tools', () => {
    render(
      <AgentCard
        agent={makeAgent({ tools: ['calculator', 'datetime'] })}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
      />
    )
    expect(screen.getByText('calculator')).toBeInTheDocument()
    expect(screen.getByText('datetime')).toBeInTheDocument()
  })

  it('calls onView when the card body is clicked', async () => {
    const user = userEvent.setup()
    render(
      <AgentCard
        agent={makeAgent()}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
      />
    )
    await user.click(screen.getByText('Test Agent'))
    expect(onView).toHaveBeenCalledWith('agent-1')
  })

  it('calls onRun when Run button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <AgentCard
        agent={makeAgent()}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
      />
    )
    await user.click(screen.getByRole('button', { name: /^Run$/i }))
    expect(onRun).toHaveBeenCalledWith('agent-1')
  })

  it('Run button is disabled when agent is running', () => {
    render(
      <AgentCard
        agent={makeAgent({ status: 'running' })}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
      />
    )
    expect(screen.getByRole('button', { name: /Running\.\.\./i })).toBeDisabled()
  })

  it('shows delete confirmation dialog when trash button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <AgentCard
        agent={makeAgent()}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
      />
    )
    // Find the trash/delete button by its destructive styling class
    const deleteBtn = document.querySelector(
      'button.text-destructive'
    ) as HTMLElement
    await user.click(deleteBtn)
    expect(screen.getByText('Delete Agent?')).toBeInTheDocument()
    expect(screen.getByText(/Are you sure you want to delete "Test Agent"/)).toBeInTheDocument()
  })

  it('calls onDelete after confirming deletion', async () => {
    const user = userEvent.setup()
    render(
      <AgentCard
        agent={makeAgent()}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
      />
    )
    const deleteBtn = document.querySelector('button.text-destructive') as HTMLElement
    await user.click(deleteBtn)

    const confirmBtn = screen.getByRole('button', { name: /^Delete$/i })
    await user.click(confirmBtn)

    expect(onDelete).toHaveBeenCalledWith('agent-1')
  })

  it('does not call onDelete when deletion is cancelled', async () => {
    const user = userEvent.setup()
    render(
      <AgentCard
        agent={makeAgent()}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
      />
    )
    const deleteBtn = document.querySelector('button.text-destructive') as HTMLElement
    await user.click(deleteBtn)

    await user.click(screen.getByRole('button', { name: /Cancel/i }))

    expect(onDelete).not.toHaveBeenCalled()
  })

  it('shows feedback button only when onFeedback provided, hasRecentRun=true, status=completed', () => {
    render(
      <AgentCard
        agent={makeAgent({ status: 'completed' })}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
        onFeedback={onFeedback}
        hasRecentRun
      />
    )
    // The feedback button contains a ChatCircle icon but no text label
    // Find it by checking for the outline border-accent class
    const feedbackBtn = document.querySelector('button.border-accent') as HTMLElement
    expect(feedbackBtn).toBeInTheDocument()
  })

  it('does not show feedback button when status is not completed', () => {
    render(
      <AgentCard
        agent={makeAgent({ status: 'idle' })}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
        onFeedback={onFeedback}
        hasRecentRun
      />
    )
    expect(document.querySelector('button.border-accent')).not.toBeInTheDocument()
  })

  it('calls onFeedback when feedback button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <AgentCard
        agent={makeAgent({ status: 'completed' })}
        onRun={onRun}
        onDelete={onDelete}
        onView={onView}
        onFeedback={onFeedback}
        hasRecentRun
      />
    )
    const feedbackBtn = document.querySelector('button.border-accent') as HTMLElement
    await user.click(feedbackBtn)
    expect(onFeedback).toHaveBeenCalledWith('agent-1')
  })
})
