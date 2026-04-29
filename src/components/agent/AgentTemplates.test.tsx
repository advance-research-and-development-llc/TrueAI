import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AgentTemplates } from './AgentTemplates'

describe('AgentTemplates', () => {
  it('renders heading', () => {
    render(<AgentTemplates onSelectTemplate={vi.fn()} />)
    expect(screen.getByText('Agent Templates')).toBeInTheDocument()
  })

  it('renders all 8 templates', () => {
    render(<AgentTemplates onSelectTemplate={vi.fn()} />)
    expect(screen.getByText('Research Assistant')).toBeInTheDocument()
    expect(screen.getByText('Data Analyst')).toBeInTheDocument()
    expect(screen.getByText('Code Reviewer')).toBeInTheDocument()
    expect(screen.getByText('Content Creator')).toBeInTheDocument()
    expect(screen.getByText('Multi-Language Translator')).toBeInTheDocument()
    expect(screen.getByText('Sentiment Analyzer')).toBeInTheDocument()
    expect(screen.getByText('API Orchestrator')).toBeInTheDocument()
    expect(screen.getByText('General Assistant')).toBeInTheDocument()
  })

  it('renders "Use Template" buttons for each template', () => {
    render(<AgentTemplates onSelectTemplate={vi.fn()} />)
    const buttons = screen.getAllByRole('button', { name: /use template/i })
    expect(buttons).toHaveLength(8)
  })

  it('calls onSelectTemplate with the correct template when button is clicked', () => {
    const onSelectTemplate = vi.fn()
    render(<AgentTemplates onSelectTemplate={onSelectTemplate} />)
    const buttons = screen.getAllByRole('button', { name: /use template/i })
    fireEvent.click(buttons[0])
    expect(onSelectTemplate).toHaveBeenCalledOnce()
    const arg = onSelectTemplate.mock.calls[0][0]
    expect(arg.id).toBe('research-assistant')
    expect(arg.name).toBe('Research Assistant')
  })

  it('calls onSelectTemplate with different template for second button', () => {
    const onSelectTemplate = vi.fn()
    render(<AgentTemplates onSelectTemplate={onSelectTemplate} />)
    const buttons = screen.getAllByRole('button', { name: /use template/i })
    fireEvent.click(buttons[1])
    expect(onSelectTemplate.mock.calls[0][0].id).toBe('data-analyst')
  })

  it('renders category badges', () => {
    render(<AgentTemplates onSelectTemplate={vi.fn()} />)
    // productivity appears for Research Assistant and General Assistant
    const productivityBadges = screen.getAllByText('productivity')
    expect(productivityBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('renders tool badges', () => {
    render(<AgentTemplates onSelectTemplate={vi.fn()} />)
    // "web search" comes from 'web_search' tool in research-assistant
    expect(screen.getAllByText(/web search/i).length).toBeGreaterThan(0)
  })

  it('shows "+N" badge when template has more than 4 tools', () => {
    render(<AgentTemplates onSelectTemplate={vi.fn()} />)
    // Research assistant has 5 tools, general-assistant has 10
    const plusBadges = screen.getAllByText(/^\+\d+$/)
    expect(plusBadges.length).toBeGreaterThan(0)
  })
})
