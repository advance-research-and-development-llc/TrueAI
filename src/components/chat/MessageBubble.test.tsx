import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from './MessageBubble'
import type { Message } from '@/lib/types'

vi.mock('./MessageActions', () => ({ MessageActions: () => null }))

const baseMessage: Message = {
  id: 'msg-1',
  conversationId: 'conv-1',
  role: 'user',
  content: 'Hello world',
  timestamp: new Date('2024-01-15T10:30:00').getTime(),
}

describe('MessageBubble', () => {
  it('renders user message content', () => {
    render(<MessageBubble message={baseMessage} />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders assistant message content', () => {
    const msg: Message = { ...baseMessage, role: 'assistant', content: 'Hi there!' }
    render(<MessageBubble message={msg} />)
    expect(screen.getByText('Hi there!')).toBeInTheDocument()
  })

  it('user message container has flex-row-reverse class', () => {
    const { container } = render(<MessageBubble message={baseMessage} />)
    const flexDiv = container.querySelector('.flex.flex-row-reverse')
    expect(flexDiv).toBeInTheDocument()
  })

  it('shows streaming cursor when isStreaming is true', () => {
    const { container } = render(<MessageBubble message={baseMessage} isStreaming />)
    // streaming cursor is a span with inline-block w-2 h-4
    const cursor = container.querySelector('.inline-block.w-2.h-4')
    expect(cursor).toBeInTheDocument()
  })

  it('does not show streaming cursor when not streaming', () => {
    const { container } = render(<MessageBubble message={baseMessage} />)
    const cursor = container.querySelector('.inline-block.w-2.h-4')
    expect(cursor).not.toBeInTheDocument()
  })

  it('displays message timestamp', () => {
    render(<MessageBubble message={baseMessage} />)
    const time = new Date(baseMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    expect(screen.getByText(new RegExp(time))).toBeInTheDocument()
  })

  it('shows model when message.model is set', () => {
    const msg: Message = { ...baseMessage, model: 'gpt-4o' }
    render(<MessageBubble message={msg} />)
    expect(screen.getByText(/gpt-4o/)).toBeInTheDocument()
  })

  it('avatar shows User icon for user role', () => {
    const { container } = render(<MessageBubble message={baseMessage} />)
    const avatar = container.querySelector('.bg-accent.text-accent-foreground')
    expect(avatar).toBeInTheDocument()
  })

  it('avatar shows Robot icon for assistant role', () => {
    const msg: Message = { ...baseMessage, role: 'assistant' }
    const { container } = render(<MessageBubble message={msg} />)
    const avatar = container.querySelector('.bg-primary.text-primary-foreground')
    expect(avatar).toBeInTheDocument()
  })
})
