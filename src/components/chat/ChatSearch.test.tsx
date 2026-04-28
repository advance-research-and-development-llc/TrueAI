import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatSearch } from './ChatSearch'
import type { Message, Conversation } from '@/lib/types'

const conversations: Conversation[] = [
  {
    id: 'conv-1',
    title: 'My Chat',
    model: 'gpt-4',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

const messages: Message[] = [
  {
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'user',
    content: 'Hello world this is a test message',
    timestamp: Date.now(),
  },
  {
    id: 'msg-2',
    conversationId: 'conv-1',
    role: 'assistant',
    content: 'Hello again, hello hello',
    timestamp: Date.now(),
  },
]

function renderSearch(props: Partial<Parameters<typeof ChatSearch>[0]> = {}) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    conversations,
    messages,
    onSelectMessage: vi.fn(),
    ...props,
  }
  return render(<ChatSearch {...defaults} />)
}

describe('ChatSearch', () => {
  it('renders dialog when open=true', () => {
    renderSearch()
    expect(screen.getByText('Search Conversations')).toBeInTheDocument()
  })

  it('does not render dialog content when open=false', () => {
    renderSearch({ open: false })
    expect(screen.queryByText('Search Conversations')).not.toBeInTheDocument()
  })

  it('shows prompt to type when no query entered', () => {
    renderSearch()
    expect(screen.getByText('Start typing to search')).toBeInTheDocument()
  })

  it('shows no results message when query with no matches', async () => {
    const user = userEvent.setup()
    renderSearch()
    const input = screen.getByPlaceholderText('Search messages...')
    await user.type(input, 'zzzzzzzzzzz')
    expect(screen.getByText('No messages found')).toBeInTheDocument()
  })

  it('shows results when query matches', async () => {
    const user = userEvent.setup()
    renderSearch()
    const input = screen.getByPlaceholderText('Search messages...')
    await user.type(input, 'hello')
    expect(screen.getAllByText('My Chat').length).toBeGreaterThan(0)
  })

  it('shows match count badge when result has >1 match', async () => {
    const user = userEvent.setup()
    renderSearch()
    const input = screen.getByPlaceholderText('Search messages...')
    await user.type(input, 'hello')
    // msg-2 has "hello" 3 times
    expect(screen.getByText(/matches/i)).toBeInTheDocument()
  })

  it('calls onSelectMessage and onOpenChange when result clicked', async () => {
    const user = userEvent.setup()
    const onSelectMessage = vi.fn()
    const onOpenChange = vi.fn()
    renderSearch({ onSelectMessage, onOpenChange })
    const input = screen.getByPlaceholderText('Search messages...')
    await user.type(input, 'world')
    // click the first result button
    const resultButtons = screen.getAllByRole('button').filter(
      (b) => b.textContent?.includes('My Chat')
    )
    await user.click(resultButtons[0])
    expect(onSelectMessage).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows result count text', async () => {
    const user = userEvent.setup()
    renderSearch()
    const input = screen.getByPlaceholderText('Search messages...')
    await user.type(input, 'hello')
    expect(screen.getByText(/found/i)).toBeInTheDocument()
  })

  it('X button clears the search', async () => {
    const user = userEvent.setup()
    renderSearch()
    const input = screen.getByPlaceholderText('Search messages...')
    await user.type(input, 'hello')
    expect(screen.queryByText('Start typing to search')).not.toBeInTheDocument()
    // find the clear button
    const clearBtn = screen.getAllByRole('button').find((b) => b.querySelector('svg') && !b.textContent?.trim())
    fireEvent.click(clearBtn!)
    expect(await screen.findByText('Start typing to search')).toBeInTheDocument()
  })
})
