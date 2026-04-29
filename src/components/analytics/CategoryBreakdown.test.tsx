import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CategoryBreakdown } from './CategoryBreakdown'

describe('CategoryBreakdown', () => {
  it('shows "No data available" when data is empty', () => {
    render(<CategoryBreakdown data={[]} />)
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('renders category names', () => {
    render(
      <CategoryBreakdown
        data={[
          { type: 'Chat', count: 50 },
          { type: 'Agent', count: 30 },
        ]}
      />
    )
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Agent')).toBeInTheDocument()
  })

  it('renders counts for each category', () => {
    render(
      <CategoryBreakdown
        data={[
          { type: 'Chat', count: 50 },
          { type: 'Agent', count: 30 },
        ]}
      />
    )
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('calculates and displays percentages correctly', () => {
    render(
      <CategoryBreakdown
        data={[
          { type: 'A', count: 75 },
          { type: 'B', count: 25 },
        ]}
      />
    )
    expect(screen.getByText('(75.0%)')).toBeInTheDocument()
    expect(screen.getByText('(25.0%)')).toBeInTheDocument()
  })

  it('renders colour indicator dots for each category', () => {
    const { container } = render(
      <CategoryBreakdown
        data={[
          { type: 'X', count: 10 },
          { type: 'Y', count: 20 },
        ]}
      />
    )
    const dots = container.querySelectorAll('.w-3.h-3.rounded-full')
    expect(dots).toHaveLength(2)
  })

  it('renders progress bars for each category', () => {
    const { container } = render(
      <CategoryBreakdown
        data={[
          { type: 'Alpha', count: 40 },
          { type: 'Beta', count: 60 },
        ]}
      />
    )
    // Each category has two divs: the track and the fill
    const tracks = container.querySelectorAll('.h-2.bg-muted.rounded-full')
    expect(tracks).toHaveLength(2)
  })

  it('limits display to at most 5 items when more are provided', () => {
    const data = Array.from({ length: 8 }, (_, i) => ({
      type: `Type${i}`,
      count: 10,
    }))
    render(<CategoryBreakdown data={data} />)
    // Only 5 entries should appear
    for (let i = 0; i < 5; i++) {
      expect(screen.getByText(`Type${i}`)).toBeInTheDocument()
    }
    expect(screen.queryByText('Type5')).not.toBeInTheDocument()
    expect(screen.queryByText('Type6')).not.toBeInTheDocument()
    expect(screen.queryByText('Type7')).not.toBeInTheDocument()
  })

  it('handles a single item (100%)', () => {
    render(
      <CategoryBreakdown data={[{ type: 'Solo', count: 100 }]} />
    )
    expect(screen.getByText('(100.0%)')).toBeInTheDocument()
  })
})
