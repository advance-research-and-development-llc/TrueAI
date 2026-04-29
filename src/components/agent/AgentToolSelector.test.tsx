import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AgentToolSelector } from './AgentToolSelector'
import type { AgentTool } from '@/lib/types'

describe('AgentToolSelector', () => {
  it('renders the "Available Tools" label', () => {
    render(<AgentToolSelector selectedTools={[]} onToggleTool={vi.fn()} />)
    expect(screen.getByText('Available Tools')).toBeInTheDocument()
  })

  it('shows selected count badge', () => {
    render(<AgentToolSelector selectedTools={['calculator', 'memory']} onToggleTool={vi.fn()} />)
    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })

  it('shows 0 selected when none selected', () => {
    render(<AgentToolSelector selectedTools={[]} onToggleTool={vi.fn()} />)
    expect(screen.getByText('0 selected')).toBeInTheDocument()
  })

  it('renders all 14 tools', () => {
    render(<AgentToolSelector selectedTools={[]} onToggleTool={vi.fn()} />)
    const toolNames = [
      'calculator', 'datetime', 'memory', 'web search',
      'code interpreter', 'file reader', 'json parser', 'api caller',
      'data analyzer', 'image generator', 'sentiment analyzer',
      'summarizer', 'translator', 'validator',
    ]
    toolNames.forEach(name => {
      expect(screen.getByText(new RegExp(name, 'i'))).toBeInTheDocument()
    })
  })

  it('calls onToggleTool when a tool card is clicked', () => {
    const onToggleTool = vi.fn()
    render(<AgentToolSelector selectedTools={[]} onToggleTool={onToggleTool} />)
    // Click "calculator" card
    fireEvent.click(screen.getByText(/^calculator$/i))
    expect(onToggleTool).toHaveBeenCalledWith('calculator')
  })

  it('renders selected tools with checked checkbox', () => {
    render(
      <AgentToolSelector selectedTools={['memory'] as AgentTool[]} onToggleTool={vi.fn()} />
    )
    const checkboxes = screen.getAllByRole('checkbox')
    // Find the one for "memory" — it should be checked
    const memoryCheckbox = checkboxes.find(cb => {
      const parent = cb.closest('[class*="p-4"]')
      return parent?.textContent?.includes('memory')
    })
    expect(memoryCheckbox).toBeChecked()
  })

  it('renders category group headers', () => {
    render(<AgentToolSelector selectedTools={[]} onToggleTool={vi.fn()} />)
    // Category badges appear as exact text matches in badge elements
    const allBadges = document.querySelectorAll('[data-slot="badge"]')
    const badgeTexts = Array.from(allBadges).map(b => b.textContent?.trim())
    const categories = ['computation', 'data', 'analysis', 'generation', 'communication']
    const foundCategories = categories.filter(c => badgeTexts.includes(c))
    expect(foundCategories.length).toBeGreaterThan(0)
  })
})
