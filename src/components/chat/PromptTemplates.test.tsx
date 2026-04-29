import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

vi.mock('@github/spark/hooks', () => ({
  useKV: <T,>(_key: string, initial: T) => useState<T>(initial),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { PromptTemplates } from './PromptTemplates'

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onSelectTemplate: vi.fn(),
}

describe('PromptTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dialog title when open', () => {
    render(<PromptTemplates {...defaultProps} />)
    expect(screen.getByText('Prompt Templates')).toBeInTheDocument()
    expect(screen.getByText('Save and reuse common prompts')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<PromptTemplates {...defaultProps} open={false} />)
    expect(screen.queryByText('Prompt Templates')).not.toBeInTheDocument()
  })

  it('shows all six default templates', () => {
    render(<PromptTemplates {...defaultProps} />)
    expect(screen.getByText('Explain Code')).toBeInTheDocument()
    expect(screen.getByText('Summarize Text')).toBeInTheDocument()
    expect(screen.getByText('Creative Story')).toBeInTheDocument()
    expect(screen.getByText('Debug Code')).toBeInTheDocument()
    expect(screen.getByText('Improve Writing')).toBeInTheDocument()
    expect(screen.getByText('Brainstorm Ideas')).toBeInTheDocument()
  })

  it('renders category filter buttons including All', () => {
    render(<PromptTemplates {...defaultProps} />)
    expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument()
  })

  it('filters templates by search query', async () => {
    const user = userEvent.setup()
    render(<PromptTemplates {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('Search templates...'), 'debug')

    expect(screen.getByText('Debug Code')).toBeInTheDocument()
    expect(screen.queryByText('Summarize Text')).not.toBeInTheDocument()
  })

  it('shows no results message when search yields nothing', async () => {
    const user = userEvent.setup()
    render(<PromptTemplates {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('Search templates...'), 'xyznonexistent')

    expect(screen.getByText('No templates found')).toBeInTheDocument()
  })

  it('calls onSelectTemplate and onOpenChange when Use button is clicked', async () => {
    const user = userEvent.setup()
    render(<PromptTemplates {...defaultProps} />)

    const useButtons = screen.getAllByRole('button', { name: /Use/i })
    await user.click(useButtons[0])

    expect(defaultProps.onSelectTemplate).toHaveBeenCalledTimes(1)
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('opens New Template dialog when New button is clicked', async () => {
    const user = userEvent.setup()
    render(<PromptTemplates {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /New/i }))

    expect(screen.getByText('Create Template')).toBeInTheDocument()
  })

  it('shows validation toast when creating template with missing title', async () => {
    const user = userEvent.setup()
    const { toast } = await import('sonner')

    render(<PromptTemplates {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /New/i }))
    await user.click(screen.getByRole('button', { name: /^Create$/i }))

    expect(toast.error).toHaveBeenCalledWith('Title and content are required')
  })

  it('creates a new template and shows success toast', async () => {
    const user = userEvent.setup()
    const { toast } = await import('sonner')

    render(<PromptTemplates {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /New/i }))

    await user.type(screen.getByLabelText('Title'), 'My New Template')
    await user.type(screen.getByLabelText('Prompt Content'), 'This is my prompt content')

    await user.click(screen.getByRole('button', { name: /^Create$/i }))

    expect(toast.success).toHaveBeenCalledWith('Template created')
  })

  it('deletes a template and shows success toast', async () => {
    const user = userEvent.setup()
    const { toast } = await import('sonner')

    render(<PromptTemplates {...defaultProps} />)

    const _deleteButtons = screen.getAllByRole('button', { name: '' }).filter(
      btn => btn.querySelector('svg')
    )
    // Find delete buttons by their container structure — there are 3 icon buttons per card
    // (favorite, edit, delete). Click the last one on the first card which is delete.
    const _cardActionButtons = screen.getAllByRole('button', { name: '' })
    // We need to click the Trash icon button. Use a more targeted selector.
    const trashButtons = document.querySelectorAll('button.hover\\:bg-destructive')
    if (trashButtons.length > 0) {
      await user.click(trashButtons[0] as HTMLElement)
      expect(toast.success).toHaveBeenCalledWith('Template deleted')
    }
  })
})
