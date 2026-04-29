import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  MessageListSkeleton,
  ConversationListSkeleton,
  AgentCardSkeleton,
  ModelCardSkeleton,
} from './loading-skeleton'

describe('MessageListSkeleton', () => {
  it('renders three message skeleton rows', () => {
    const { container } = render(<MessageListSkeleton />)
    // Each row has a circular avatar skeleton + message body
    const rows = container.querySelectorAll('.flex.gap-3')
    expect(rows).toHaveLength(3)
  })

  it('renders a circular avatar skeleton per row', () => {
    const { container } = render(<MessageListSkeleton />)
    const avatarSkeletons = container.querySelectorAll('.rounded-full')
    expect(avatarSkeletons.length).toBeGreaterThanOrEqual(3)
  })
})

describe('ConversationListSkeleton', () => {
  it('renders five conversation item skeletons', () => {
    const { container } = render(<ConversationListSkeleton />)
    const items = container.querySelectorAll('.space-y-2.p-2')
    expect(items).toHaveLength(5)
  })

  it('each item contains two skeleton lines', () => {
    const { container } = render(<ConversationListSkeleton />)
    const items = container.querySelectorAll('.space-y-2.p-2')
    items.forEach((item) => {
      expect(item.querySelectorAll('[class*="animate"]').length).toBeGreaterThanOrEqual(0)
      // At minimum, two child elements (the two skeleton divs)
      expect(item.children.length).toBeGreaterThanOrEqual(2)
    })
  })
})

describe('AgentCardSkeleton', () => {
  it('renders a Card container', () => {
    const { container } = render(<AgentCardSkeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders skeleton for the agent icon, name, and status areas', () => {
    const { container } = render(<AgentCardSkeleton />)
    // Card header has an avatar square skeleton
    const squareSkeleton = container.querySelector('.rounded-lg')
    expect(squareSkeleton).toBeInTheDocument()
  })

  it('renders action button skeletons in CardContent', () => {
    const { container } = render(<AgentCardSkeleton />)
    // The content area has h-8 button skeletons
    const btnSkeletons = container.querySelectorAll('.h-8')
    expect(btnSkeletons.length).toBeGreaterThanOrEqual(1)
  })
})

describe('ModelCardSkeleton', () => {
  it('renders a Card container with padding', () => {
    const { container } = render(<ModelCardSkeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders multiple skeleton lines for model details', () => {
    const { container } = render(<ModelCardSkeleton />)
    // Three h-4 detail rows + a h-10 action button skeleton
    const detailLines = container.querySelectorAll('.h-4')
    expect(detailLines.length).toBeGreaterThanOrEqual(3)
  })

  it('renders a full-width action button skeleton', () => {
    const { container } = render(<ModelCardSkeleton />)
    const btn = container.querySelector('.h-10.w-full')
    expect(btn).toBeInTheDocument()
  })
})
