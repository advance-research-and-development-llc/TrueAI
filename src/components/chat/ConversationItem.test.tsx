import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ConversationItem } from './ConversationItem'
import type { Conversation } from '@/lib/types'

const baseConversation: Conversation = {
  id: 'conv-1',
  title: 'Test Conversation',
  model: 'gpt-4',
  createdAt: Date.now(),
  updatedAt: new Date('2024-01-15').getTime(),
}

function renderItem(props: Partial<Parameters<typeof ConversationItem>[0]> = {}) {
  const defaultProps = {
    conversation: baseConversation,
    isActive: false,
    onClick: vi.fn(),
    index: 0,
    ...props,
  }
  return render(
    <TooltipProvider>
      <ConversationItem {...defaultProps} />
    </TooltipProvider>
  )
}

describe('ConversationItem', () => {
  it('renders conversation title', () => {
    renderItem()
    expect(screen.getByText('Test Conversation')).toBeInTheDocument()
  })

  it('renders date', () => {
    renderItem()
    const dateStr = new Date(baseConversation.updatedAt).toLocaleDateString()
    expect(screen.getByText(dateStr)).toBeInTheDocument()
  })

  it('active state uses secondary variant', () => {
    renderItem({ isActive: true })
    const btn = screen.getByRole('button', { name: /test conversation/i })
    expect(btn.className).toContain('bg-secondary')
  })

  it('inactive uses ghost variant', () => {
    renderItem({ isActive: false })
    const btn = screen.getByRole('button', { name: /test conversation/i })
    expect(btn.className).not.toContain('bg-secondary')
  })

  it('pinned conversation shows pin icon', () => {
    renderItem({ conversation: { ...baseConversation, pinned: true } })
    // The pinned icon is rendered as SVG - check it exists in the DOM inside the button
    const btn = screen.getByRole('button', { name: /test conversation/i })
    expect(btn.querySelector('svg')).toBeInTheDocument()
  })

  it('calls onClick when main button clicked', async () => {
    const onClick = vi.fn()
    renderItem({ onClick })
    await userEvent.click(screen.getByRole('button', { name: /test conversation/i }))
    expect(onClick).toHaveBeenCalled()
  })

  it('calls onPin when pin button clicked without propagation', async () => {
    const onClick = vi.fn()
    const onPin = vi.fn()
    renderItem({ onClick, onPin })
    // All action buttons are rendered (opacity-0 via CSS but in DOM)
    const buttons = screen.getAllByRole('button')
    // pin button is after main button
    const pinBtn = buttons[1]
    fireEvent.click(pinBtn)
    expect(onPin).toHaveBeenCalledWith(baseConversation.id)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('calls onArchive when archive button clicked', () => {
    const onClick = vi.fn()
    const onPin = vi.fn()
    const onArchive = vi.fn()
    renderItem({ onClick, onPin, onArchive })
    // buttons: [0] main, [1] pin, [2] archive
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[2])
    expect(onArchive).toHaveBeenCalledWith(baseConversation.id)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('calls onDelete when delete button clicked', () => {
    const onClick = vi.fn()
    const onPin = vi.fn()
    const onDelete = vi.fn()
    renderItem({ onClick, onPin, onDelete })
    // buttons: [0] main, [1] pin, [2] delete
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[2])
    expect(onDelete).toHaveBeenCalledWith(baseConversation.id)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('archived conversation hides action buttons', () => {
    const onPin = vi.fn()
    renderItem({ conversation: { ...baseConversation, archived: true }, onPin })
    // Only the main button should be present (no action buttons)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
  })
})
