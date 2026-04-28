import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from './ChatInput'

describe('ChatInput', () => {
  const onSend = vi.fn()
  const onStop = vi.fn()

  beforeEach(() => {
    onSend.mockClear()
    onStop.mockClear()
  })

  it('renders textarea', () => {
    render(<ChatInput onSend={onSend} />)
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument()
  })

  it('renders send button disabled when empty', () => {
    const { container } = render(<ChatInput onSend={onSend} />)
    const btn = container.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(btn).toBeDisabled()
  })

  it('enables send button when text entered', async () => {
    const user = userEvent.setup()
    const { container } = render(<ChatInput onSend={onSend} />)
    const textarea = screen.getByPlaceholderText('Type your message...')
    await user.type(textarea, 'hello')
    const btn = container.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(btn).not.toBeDisabled()
  })

  it('calls onSend on form submit', async () => {
    const user = userEvent.setup()
    const { container } = render(<ChatInput onSend={onSend} />)
    const textarea = screen.getByPlaceholderText('Type your message...')
    await user.type(textarea, 'hello world')
    const btn = container.querySelector('button[type="submit"]') as HTMLButtonElement
    await user.click(btn)
    expect(onSend).toHaveBeenCalledWith('hello world')
  })

  it('calls onSend on Enter key', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={onSend} />)
    const textarea = screen.getByPlaceholderText('Type your message...')
    await user.type(textarea, 'hello')
    await user.keyboard('{Enter}')
    expect(onSend).toHaveBeenCalledWith('hello')
  })

  it('Shift+Enter does NOT submit', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={onSend} />)
    const textarea = screen.getByPlaceholderText('Type your message...')
    await user.type(textarea, 'hello')
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('shows char count when input exceeds 100 chars', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={onSend} />)
    const textarea = screen.getByPlaceholderText('Type your message...')
    const longText = 'a'.repeat(101)
    await user.type(textarea, longText)
    expect(screen.getByText('101')).toBeInTheDocument()
  })

  it('shows stop button when isStreaming and onStop provided', () => {
    const { container } = render(<ChatInput onSend={onSend} isStreaming onStop={onStop} />)
    // stop button is type="button" with destructive variant (bg-destructive)
    const stopBtn = container.querySelector('button[type="button"].bg-destructive, button[type="button"][class*="bg-destructive"]')
    expect(stopBtn).toBeInTheDocument()
  })

  it('calls onStop when stop button clicked', async () => {
    const user = userEvent.setup()
    const { container } = render(<ChatInput onSend={onSend} isStreaming onStop={onStop} />)
    const stopBtn = container.querySelector('button[type="button"][class*="bg-destructive"]') as HTMLButtonElement
    await user.click(stopBtn)
    expect(onStop).toHaveBeenCalled()
  })

  it('textarea is disabled when disabled=true', () => {
    render(<ChatInput onSend={onSend} disabled />)
    expect(screen.getByPlaceholderText('Type your message...')).toBeDisabled()
  })
})
