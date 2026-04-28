import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatExportDialog } from './ChatExportDialog'
import type { Conversation, Message } from '@/lib/types'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { toast } from 'sonner'

// ─── fixtures ────────────────────────────────────────────────────────────────

const makeConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'conv-1',
  title: 'My Chat',
  model: 'llama3',
  createdAt: new Date('2024-01-01').getTime(),
  updatedAt: new Date('2024-01-01').getTime(),
  systemPrompt: 'Be helpful.',
  ...overrides,
})

const makeMessage = (
  role: 'user' | 'assistant',
  content: string,
  overrides: Partial<Message> = {}
): Message => ({
  id: `msg-${Math.random()}`,
  conversationId: 'conv-1',
  role,
  content,
  timestamp: new Date('2024-01-01T12:00:00Z').getTime(),
  ...overrides,
})

const defaultMessages: Message[] = [
  makeMessage('user', 'Hello there'),
  makeMessage('assistant', 'Hi! How can I help?'),
]

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  conversation: makeConversation(),
  messages: defaultMessages,
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Prevent the anchor click from triggering real navigation in jsdom. */
function mockDownload() {
  const createObjectURL = vi.fn(() => 'blob:fake-url')
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true })
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return { createObjectURL, revokeObjectURL, clickSpy }
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('ChatExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the dialog title when open', () => {
    render(<ChatExportDialog {...defaultProps} />)
    expect(screen.getByText('Export Conversation')).toBeInTheDocument()
  })

  it('renders the export format selector', () => {
    render(<ChatExportDialog {...defaultProps} />)
    expect(screen.getByText('Export Format')).toBeInTheDocument()
  })

  it('renders the Include Timestamps toggle', () => {
    render(<ChatExportDialog {...defaultProps} />)
    expect(screen.getByText('Include Timestamps')).toBeInTheDocument()
  })

  it('renders the Include Metadata toggle', () => {
    render(<ChatExportDialog {...defaultProps} />)
    expect(screen.getByText('Include Metadata')).toBeInTheDocument()
  })

  it('shows the correct message count in the preview section', () => {
    render(<ChatExportDialog {...defaultProps} />)
    expect(screen.getByText(`${defaultMessages.length} messages will be exported`)).toBeInTheDocument()
  })

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<ChatExportDialog {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('clicking Export triggers a download and shows a success toast', async () => {
    const { clickSpy } = mockDownload()
    const user = userEvent.setup()
    render(<ChatExportDialog {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /Export/i }))
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Chat exported successfully')
  })

  it('clicking Export closes the dialog via onOpenChange(false)', async () => {
    mockDownload()
    const user = userEvent.setup()
    render(<ChatExportDialog {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /Export/i }))
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('uses a .txt filename when the txt format is selected (default)', async () => {
    const { clickSpy } = mockDownload()
    const user = userEvent.setup()
    render(<ChatExportDialog {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /Export/i }))
    // The filename is set as the download attribute on the created anchor element
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toMatch(/\.txt$/)
  })

  it('does not render when open is false', () => {
    render(<ChatExportDialog {...defaultProps} open={false} />)
    expect(screen.queryByText('Export Conversation')).not.toBeInTheDocument()
  })
})
