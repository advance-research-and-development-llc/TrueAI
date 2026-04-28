import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { AnimatedCard } from './AnimatedCard'

describe('AnimatedCard', () => {
  it('renders children', () => {
    render(<AnimatedCard>Hello Card</AnimatedCard>)
    expect(screen.getByText('Hello Card')).toBeInTheDocument()
  })

  it('accepts ref', () => {
    const ref = createRef<HTMLDivElement>()
    render(<AnimatedCard ref={ref}>Content</AnimatedCard>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('applies custom className', () => {
    const { container } = render(<AnimatedCard className="my-custom">Content</AnimatedCard>)
    expect(container.firstChild).toHaveClass('my-custom')
  })

  it('renders with hover=false prop', () => {
    const { container } = render(<AnimatedCard hover={false}>Content</AnimatedCard>)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('delay prop accepted without crashing', () => {
    const { container } = render(<AnimatedCard delay={0.5}>Content</AnimatedCard>)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders as a div element', () => {
    const { container } = render(<AnimatedCard>Div Test</AnimatedCard>)
    expect(container.querySelector('div')).toBeInTheDocument()
  })
})
