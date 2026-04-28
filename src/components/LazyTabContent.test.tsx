import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LazyTabContent } from './LazyTabContent'

describe('LazyTabContent', () => {
  it('renders children when isActive=true', () => {
    render(
      <LazyTabContent isActive tabName="home">
        <span>Hello Content</span>
      </LazyTabContent>
    )
    expect(screen.getByText('Hello Content')).toBeInTheDocument()
  })

  it('returns null when isActive=false and keepMounted=false', () => {
    const { container } = render(
      <LazyTabContent isActive={false} keepMounted={false} tabName="home">
        <span>Hidden Content</span>
      </LazyTabContent>
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders hidden div when isActive=false and keepMounted=true', () => {
    const { container } = render(
      <LazyTabContent isActive={false} keepMounted tabName="home">
        <span>Mounted Content</span>
      </LazyTabContent>
    )
    const hidden = container.querySelector('[style*="display: none"]')
    expect(hidden).toBeInTheDocument()
    expect(hidden).toContainElement(screen.getByText('Mounted Content'))
  })

  it('children visible when active', () => {
    render(
      <LazyTabContent isActive tabName="chat">
        <p>Visible</p>
      </LazyTabContent>
    )
    expect(screen.getByText('Visible')).toBeInTheDocument()
  })

  it('content hidden when keepMounted=false and not active', () => {
    const { container } = render(
      <LazyTabContent isActive={false} keepMounted={false} tabName="chat">
        <p>Gone</p>
      </LazyTabContent>
    )
    expect(screen.queryByText('Gone')).not.toBeInTheDocument()
    expect(container.firstChild).toBeNull()
  })
})
