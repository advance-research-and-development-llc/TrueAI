import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FeedbackDialog } from './FeedbackDialog'
import type { AgentRun } from '@/lib/types'

const mockAgentRun: AgentRun = {
  id: 'run-1',
  agentId: 'agent-1',
  startedAt: Date.now() - 5000,
  completedAt: Date.now(),
  status: 'completed',
  steps: [],
  result: 'Done',
}

describe('FeedbackDialog', () => {
  it('renders dialog when open', () => {
    render(
      <FeedbackDialog
        open={true}
        onOpenChange={vi.fn()}
        agentRun={mockAgentRun}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Provide Agent Feedback')).toBeInTheDocument()
  })

  it('does not render dialog when closed', () => {
    render(
      <FeedbackDialog
        open={false}
        onOpenChange={vi.fn()}
        agentRun={mockAgentRun}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.queryByText('Provide Agent Feedback')).not.toBeInTheDocument()
  })

  it('renders 5 star rating buttons', () => {
    render(
      <FeedbackDialog
        open={true}
        onOpenChange={vi.fn()}
        agentRun={mockAgentRun}
        onSubmit={vi.fn()}
      />
    )
    const starButtons = screen.getAllByRole('button').filter(b =>
      b.className.includes('focus:ring-primary')
    )
    expect(starButtons).toHaveLength(5)
  })

  it('renders accuracy, efficiency, relevance sliders', () => {
    render(
      <FeedbackDialog
        open={true}
        onOpenChange={vi.fn()}
        agentRun={mockAgentRun}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Accuracy')).toBeInTheDocument()
    expect(screen.getByText('Efficiency')).toBeInTheDocument()
    expect(screen.getByText('Relevance')).toBeInTheDocument()
  })

  it('renders issue type checkboxes', () => {
    render(
      <FeedbackDialog
        open={true}
        onOpenChange={vi.fn()}
        agentRun={mockAgentRun}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Incorrect Result')).toBeInTheDocument()
    expect(screen.getByText('Missing Information')).toBeInTheDocument()
    expect(screen.getByText('Wrong Tool Used')).toBeInTheDocument()
    expect(screen.getByText('Timeout')).toBeInTheDocument()
    expect(screen.getByText('Other')).toBeInTheDocument()
  })

  it('renders Submit Feedback button', () => {
    render(
      <FeedbackDialog
        open={true}
        onOpenChange={vi.fn()}
        agentRun={mockAgentRun}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeInTheDocument()
  })

  it('calls onSubmit with correct runId and agentId when submitted', () => {
    const onSubmit = vi.fn()
    render(
      <FeedbackDialog
        open={true}
        onOpenChange={vi.fn()}
        agentRun={mockAgentRun}
        onSubmit={onSubmit}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit.mock.calls[0][0].runId).toBe('run-1')
    expect(onSubmit.mock.calls[0][0].agentId).toBe('agent-1')
  })

  it('submits with default rating of 3', () => {
    const onSubmit = vi.fn()
    render(
      <FeedbackDialog
        open={true}
        onOpenChange={vi.fn()}
        agentRun={mockAgentRun}
        onSubmit={onSubmit}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(onSubmit.mock.calls[0][0].rating).toBe(3)
  })

  it('calls onOpenChange(false) when Cancel clicked', () => {
    const onOpenChange = vi.fn()
    render(
      <FeedbackDialog
        open={true}
        onOpenChange={onOpenChange}
        agentRun={mockAgentRun}
        onSubmit={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows issue description textarea when an issue is selected', () => {
    render(
      <FeedbackDialog
        open={true}
        onOpenChange={vi.fn()}
        agentRun={mockAgentRun}
        onSubmit={vi.fn()}
      />
    )
    // Click "Incorrect Result" card (not the checkbox directly)
    fireEvent.click(screen.getByText('Incorrect Result').closest('[class*="cursor-pointer"]')!)
    expect(screen.getByPlaceholderText(/provide details about this issue/i)).toBeInTheDocument()
  })

  it('shows rating label text for default rating 3', () => {
    render(
      <FeedbackDialog
        open={true}
        onOpenChange={vi.fn()}
        agentRun={mockAgentRun}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Good')).toBeInTheDocument()
  })
})
