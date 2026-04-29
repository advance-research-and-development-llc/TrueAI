import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Radix Select stubs
beforeEach(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
      value: vi.fn().mockReturnValue(false), configurable: true,
    })
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      value: vi.fn(), configurable: true,
    })
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      value: vi.fn(), configurable: true,
    })
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: vi.fn(), configurable: true,
    })
  }
})

import { WorkflowTemplates } from './WorkflowTemplates'

describe('WorkflowTemplates', () => {
  it('renders heading', () => {
    render(<WorkflowTemplates onUseTemplate={vi.fn()} />)
    expect(screen.getByText(/workflow template/i)).toBeInTheDocument()
  })

  it('renders multiple templates', () => {
    render(<WorkflowTemplates onUseTemplate={vi.fn()} />)
    expect(screen.getByText('Content Research & Writing')).toBeInTheDocument()
  })

  it('renders search input', () => {
    render(<WorkflowTemplates onUseTemplate={vi.fn()} />)
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('filters templates by search query', () => {
    render(<WorkflowTemplates onUseTemplate={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'Content' },
    })
    expect(screen.getByText('Content Research & Writing')).toBeInTheDocument()
  })

  it('shows "No templates found" when search has no results', () => {
    render(<WorkflowTemplates onUseTemplate={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'xyznonexistent123' },
    })
    expect(screen.getByText(/no templates/i)).toBeInTheDocument()
  })

  it('renders "Use Template" buttons', () => {
    render(<WorkflowTemplates onUseTemplate={vi.fn()} />)
    const buttons = screen.getAllByRole('button', { name: /use template/i })
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('calls onUseTemplate with template object when Use Template clicked', () => {
    const onUseTemplate = vi.fn()
    render(<WorkflowTemplates onUseTemplate={onUseTemplate} />)
    const buttons = screen.getAllByRole('button', { name: /use template/i })
    fireEvent.click(buttons[0])
    expect(onUseTemplate).toHaveBeenCalledOnce()
    const arg = onUseTemplate.mock.calls[0][0]
    expect(arg.id).toBe('template-1')
  })

  it('renders category badges', () => {
    render(<WorkflowTemplates onUseTemplate={vi.fn()} />)
    const badges = document.querySelectorAll('[data-slot="badge"]')
    expect(badges.length).toBeGreaterThan(0)
  })
})
