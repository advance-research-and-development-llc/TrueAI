import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EnhancedLoader } from './EnhancedLoader'

describe('EnhancedLoader', () => {
  it('renders without crashing', () => {
    const { container } = render(<EnhancedLoader />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders message when provided', () => {
    render(<EnhancedLoader message="Loading data..." />)
    expect(screen.getByText('Loading data...')).toBeInTheDocument()
  })

  it('does not render message when not provided', () => {
    render(<EnhancedLoader />)
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
  })

  it('sm size applies correct classes', () => {
    const { container } = render(<EnhancedLoader size="sm" />)
    expect(container.querySelector('.h-6.w-6')).toBeInTheDocument()
  })

  it('md size (default) applies correct classes', () => {
    const { container } = render(<EnhancedLoader />)
    expect(container.querySelector('.h-10.w-10')).toBeInTheDocument()
  })

  it('lg size applies correct classes', () => {
    const { container } = render(<EnhancedLoader size="lg" />)
    expect(container.querySelector('.h-16.w-16')).toBeInTheDocument()
  })

  it('has 3 animated dots', () => {
    const { container } = render(<EnhancedLoader />)
    const dots = container.querySelectorAll('.rounded-full.bg-accent')
    expect(dots).toHaveLength(3)
  })
})
