import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LazyTabContent } from './LazyTabContent'

describe('LazyTabContent', () => {
  it('renders null when not active and keepMounted is false (default)', () => {
    const { container } = render(
      <LazyTabContent isActive={false} tabName="test">
        <div>Hidden Content</div>
      </LazyTabContent>
    )
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument()
  })

  it('renders null when not active and keepMounted is explicitly false', () => {
    const { container } = render(
      <LazyTabContent isActive={false} tabName="test" keepMounted={false}>
        <div>Hidden Content</div>
      </LazyTabContent>
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders a hidden div when not active but keepMounted is true', () => {
    const { container } = render(
      <LazyTabContent isActive={false} tabName="test" keepMounted>
        <div>Kept Content</div>
      </LazyTabContent>
    )
    const hiddenDiv = container.firstChild as HTMLElement
    expect(hiddenDiv).toBeInTheDocument()
    expect(hiddenDiv.style.display).toBe('none')
    // Children are in the DOM (for keep-alive semantics)
    expect(screen.getByText('Kept Content')).toBeInTheDocument()
  })

  it('renders children visibly when active', () => {
    render(
      <LazyTabContent isActive={true} tabName="chat">
        <div>Active Content</div>
      </LazyTabContent>
    )
    expect(screen.getByText('Active Content')).toBeInTheDocument()
  })

  it('renders children when active and keepMounted is true', () => {
    render(
      <LazyTabContent isActive={true} tabName="chat" keepMounted>
        <div>Active Keep Content</div>
      </LazyTabContent>
    )
    expect(screen.getByText('Active Keep Content')).toBeInTheDocument()
  })

  it('has displayName LazyTabContent', () => {
    expect(LazyTabContent.displayName).toBe('LazyTabContent')
  })

  it('re-renders when isActive transitions from true to false', () => {
    const { rerender } = render(
      <LazyTabContent isActive={true} tabName="tab1">
        <div>Content</div>
      </LazyTabContent>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()

    rerender(
      <LazyTabContent isActive={false} tabName="tab1">
        <div>Content</div>
      </LazyTabContent>
    )
    // keepMounted=false (default), so content should be removed
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('re-renders without error when tabName changes', () => {
    const { rerender } = render(
      <LazyTabContent isActive={true} tabName="tab1">
        <div>Tab A</div>
      </LazyTabContent>
    )
    expect(screen.getByText('Tab A')).toBeInTheDocument()

    // AnimatePresence mode="wait" defers enter until exit completes.
    // Just verify no crash on tabName change.
    expect(() =>
      rerender(
        <LazyTabContent isActive={true} tabName="tab2">
          <div>Tab B</div>
        </LazyTabContent>
      )
    ).not.toThrow()
  })
})
