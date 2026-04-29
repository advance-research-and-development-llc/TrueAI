import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Stub Radix Select pointer-capture/scrollIntoView for jsdom
beforeEach(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
      value: vi.fn().mockReturnValue(false),
      configurable: true,
    })
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: vi.fn(),
      configurable: true,
    })
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { AgentConfigPanel } from './AgentConfigPanel'
import type { Agent } from '@/lib/types'
import { toast } from 'sonner'

const mockAgent: Agent = {
  id: 'agent-1',
  name: 'Test Agent',
  goal: 'Do something useful',
  model: 'gpt-4o',
  tools: ['calculator'],
  createdAt: Date.now(),
  status: 'idle',
  maxIterations: 10,
  temperature: 0.7,
  systemPrompt: '',
  priority: 'normal',
}

describe('AgentConfigPanel', () => {
  it('renders "Configure Agent" title', () => {
    render(<AgentConfigPanel agent={mockAgent} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Configure Agent')).toBeInTheDocument()
  })

  it('renders description with agent name', () => {
    render(<AgentConfigPanel agent={mockAgent} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/advanced settings for test agent/i)).toBeInTheDocument()
  })

  it('shows the General tab by default', () => {
    render(<AgentConfigPanel agent={mockAgent} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('Test Agent')).toBeInTheDocument()
  })

  it('shows all four tab labels', () => {
    render(<AgentConfigPanel agent={mockAgent} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('tab', { name: /general/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /tools/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /advanced/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /capabilities/i })).toBeInTheDocument()
  })

  it('renders agent name in input field', () => {
    render(<AgentConfigPanel agent={mockAgent} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('Test Agent')).toBeInTheDocument()
  })

  it('renders agent goal in textarea', () => {
    render(<AgentConfigPanel agent={mockAgent} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('Do something useful')).toBeInTheDocument()
  })

  it('updates name when input changes', () => {
    render(<AgentConfigPanel agent={mockAgent} onSave={vi.fn()} onClose={vi.fn()} />)
    const input = screen.getByDisplayValue('Test Agent')
    fireEvent.change(input, { target: { value: 'New Name' } })
    expect(screen.getByDisplayValue('New Name')).toBeInTheDocument()
  })

  it('calls onSave and onClose when Save button clicked', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<AgentConfigPanel agent={mockAgent} onSave={onSave} onClose={onClose} />)
    const saveButtons = screen.getAllByRole('button').filter(b =>
      /save/i.test(b.textContent || '')
    )
    fireEvent.click(saveButtons[0])
    expect(onSave).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows success toast after save', () => {
    render(<AgentConfigPanel agent={mockAgent} onSave={vi.fn()} onClose={vi.fn()} />)
    const saveButtons = screen.getAllByRole('button').filter(b =>
      /save/i.test(b.textContent || '')
    )
    fireEvent.click(saveButtons[0])
    expect(toast.success).toHaveBeenCalledWith('Agent configuration saved')
  })

  it('calls onClose when Close button clicked', () => {
    const onClose = vi.fn()
    render(<AgentConfigPanel agent={mockAgent} onSave={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('passes updated name in onSave argument', () => {
    const onSave = vi.fn()
    render(<AgentConfigPanel agent={mockAgent} onSave={onSave} onClose={vi.fn()} />)
    const input = screen.getByDisplayValue('Test Agent')
    fireEvent.change(input, { target: { value: 'Updated Agent' } })
    const saveButtons = screen.getAllByRole('button').filter(b =>
      /save/i.test(b.textContent || '')
    )
    fireEvent.click(saveButtons[0])
    expect(onSave.mock.calls[0][0].name).toBe('Updated Agent')
  })
})
