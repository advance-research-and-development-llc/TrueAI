import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LazyTabContent } from './LazyTabContent'

describe('LazyTabContent', () => {
  it('renders children when isActive is true', () => {
    render(
      <LazyTabContent isActive tabName="tab1">
        <div>active content</div>
      </LazyTabContent>
    )
    expect(screen.getByText('active content')).toBeInTheDocument()
  })

  it('returns null when isActive is false and keepMounted is false (default)', () => {
    const { container } = render(
      <LazyTabContent isActive={false} tabName="tab1">
        <div>hidden content</div>
      </LazyTabContent>
    )
    expect(screen.queryByText('hidden content')).not.toBeInTheDocument()
    expect(container.firstChild).toBeNull()
  })

  it('renders a hidden div when isActive is false but keepMounted is true', () => {
    const { container } = render(
      <LazyTabContent isActive={false} tabName="tab1" keepMounted>
        <div>kept content</div>
      </LazyTabContent>
    )
    // The component wraps children in a display:none div
    const hiddenDiv = container.querySelector('div[style*="display: none"]')
    expect(hiddenDiv).toBeInTheDocument()
    // Children are still in the DOM, just hidden
    expect(screen.getByText('kept content')).toBeInTheDocument()
  })

  it('does not apply display:none when isActive is true, even with keepMounted', () => {
    const { container } = render(
      <LazyTabContent isActive tabName="tab1" keepMounted>
        <div>visible content</div>
      </LazyTabContent>
    )
    expect(screen.getByText('visible content')).toBeInTheDocument()
    expect(container.querySelector('div[style*="display: none"]')).not.toBeInTheDocument()
  })

  it('has the displayName "LazyTabContent"', () => {
    expect(LazyTabContent.displayName).toBe('LazyTabContent')
  })
})
