import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('renders the illustration image with alt text matching title', () => {
    render(
      <EmptyState
        illustration="/empty.svg"
        title="Nothing here yet"
      />
    )
    const img = screen.getByAltText('Nothing here yet')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/empty.svg')
  })

  it('renders the title text', () => {
    render(
      <EmptyState
        illustration="/empty.svg"
        title="No conversations"
      />
    )
    expect(screen.getByText('No conversations')).toBeInTheDocument()
  })

  it('renders the description when provided', () => {
    render(
      <EmptyState
        illustration="/empty.svg"
        title="No results"
        description="Try adjusting your search terms."
      />
    )
    expect(screen.getByText('Try adjusting your search terms.')).toBeInTheDocument()
  })

  it('does not render description element when not provided', () => {
    const { container } = render(
      <EmptyState
        illustration="/empty.svg"
        title="No data"
      />
    )
    // Only the title paragraph should be present (description is conditional)
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(1)
  })

  it('renders the action slot when provided', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <EmptyState
        illustration="/empty.svg"
        title="Empty"
        action={<button onClick={onClick}>Create First</button>}
      />
    )
    const btn = screen.getByRole('button', { name: 'Create First' })
    expect(btn).toBeInTheDocument()
    await user.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies sm size class to illustration', () => {
    render(
      <EmptyState
        illustration="/empty.svg"
        title="Small"
        size="sm"
      />
    )
    const img = screen.getByAltText('Small')
    expect(img.className).toContain('w-24')
    expect(img.className).toContain('h-24')
  })

  it('applies md size class to illustration (default)', () => {
    render(
      <EmptyState
        illustration="/empty.svg"
        title="Medium"
      />
    )
    const img = screen.getByAltText('Medium')
    expect(img.className).toContain('w-32')
    expect(img.className).toContain('h-32')
  })

  it('applies lg size class to illustration', () => {
    render(
      <EmptyState
        illustration="/empty.svg"
        title="Large"
        size="lg"
      />
    )
    const img = screen.getByAltText('Large')
    expect(img.className).toContain('w-48')
    expect(img.className).toContain('h-48')
  })

  it('applies custom className to the container', () => {
    const { container } = render(
      <EmptyState
        illustration="/empty.svg"
        title="Custom"
        className="my-custom-class"
      />
    )
    expect(container.firstChild).toHaveClass('my-custom-class')
  })
})
