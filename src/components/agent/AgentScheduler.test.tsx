import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Stub Radix Select pointer-capture for jsdom
beforeEach(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
      value: vi.fn().mockReturnValue(false),
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

import { AgentScheduler } from './AgentScheduler'
import type { Agent } from '@/lib/types'
import { toast } from 'sonner'

const mockAgent: Agent = {
  id: 'agent-1',
  name: 'Scheduled Agent',
  goal: 'Run periodically',
  model: 'gpt-4o',
  tools: [],
  createdAt: Date.now(),
  status: 'idle',
  schedule: undefined,
}

describe('AgentScheduler', () => {
  it('renders heading', () => {
    render(<AgentScheduler agent={mockAgent} onUpdateSchedule={vi.fn()} />)
    expect(screen.getByText(/schedule/i)).toBeInTheDocument()
  })

  it('renders Enable Schedule switch', () => {
    render(<AgentScheduler agent={mockAgent} onUpdateSchedule={vi.fn()} />)
    // Switch is a Radix Switch
    const switches = document.querySelectorAll('[data-slot="switch"]')
    expect(switches.length).toBeGreaterThan(0)
  })

  it('shows "Scheduling disabled" when not enabled', () => {
    render(<AgentScheduler agent={mockAgent} onUpdateSchedule={vi.fn()} />)
    expect(screen.getByText(/scheduling disabled/i)).toBeInTheDocument()
  })

  it('calls onUpdateSchedule with agent id when Save clicked', () => {
    const onUpdateSchedule = vi.fn()
    render(<AgentScheduler agent={mockAgent} onUpdateSchedule={onUpdateSchedule} />)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onUpdateSchedule).toHaveBeenCalledOnce()
    expect(onUpdateSchedule.mock.calls[0][0]).toBe('agent-1')
  })

  it('shows success toast when saved', () => {
    render(<AgentScheduler agent={mockAgent} onUpdateSchedule={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(toast.success).toHaveBeenCalledWith('Schedule updated successfully')
  })

  it('renders time input', () => {
    render(<AgentScheduler agent={mockAgent} onUpdateSchedule={vi.fn()} />)
    expect(screen.getByDisplayValue('09:00')).toBeInTheDocument()
  })

  it('renders frequency selector', () => {
    render(<AgentScheduler agent={mockAgent} onUpdateSchedule={vi.fn()} />)
    // Select trigger should be present
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
