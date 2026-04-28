import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CategoryBreakdown } from './CategoryBreakdown'

const data = [
  { type: 'conversation', count: 50 },
  { type: 'agent', count: 30 },
  { type: 'workflow', count: 20 },
]

describe('CategoryBreakdown', () => {
  it('shows "No data available" when data array is empty', () => {
    render(<CategoryBreakdown data={[]} />)
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('renders category type labels', () => {
    render(<CategoryBreakdown data={data} />)
    expect(screen.getByText('conversation')).toBeInTheDocument()
    expect(screen.getByText('agent')).toBeInTheDocument()
    expect(screen.getByText('workflow')).toBeInTheDocument()
  })

  it('renders item counts', () => {
    render(<CategoryBreakdown data={data} />)
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('renders percentage labels', () => {
    render(<CategoryBreakdown data={data} />)
    // 50/100 = 50.0%, 30/100 = 30.0%, 20/100 = 20.0%
    expect(screen.getByText('(50.0%)')).toBeInTheDocument()
    expect(screen.getByText('(30.0%)')).toBeInTheDocument()
    expect(screen.getByText('(20.0%)')).toBeInTheDocument()
  })

  it('renders color dot for each item', () => {
    const { container } = render(<CategoryBreakdown data={data} />)
    const dots = container.querySelectorAll('.w-3.h-3.rounded-full')
    expect(dots.length).toBe(data.length)
  })

  it('renders progress bars for each item', () => {
    const { container } = render(<CategoryBreakdown data={data} />)
    const bars = container.querySelectorAll('.h-2.bg-muted')
    expect(bars.length).toBe(data.length)
  })

  it('renders at most 5 items when more than 5 provided', () => {
    const manyItems = Array.from({ length: 8 }, (_, i) => ({
      type: `type-${i}`,
      count: 10
    }))
    render(<CategoryBreakdown data={manyItems} />)
    expect(screen.getByText('type-0')).toBeInTheDocument()
    expect(screen.getByText('type-4')).toBeInTheDocument()
    expect(screen.queryByText('type-5')).not.toBeInTheDocument()
  })

  it('renders single item correctly', () => {
    render(<CategoryBreakdown data={[{ type: 'only', count: 1 }]} />)
    expect(screen.getByText('only')).toBeInTheDocument()
    expect(screen.getByText('(100.0%)')).toBeInTheDocument()
  })
})
