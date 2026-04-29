import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopItemsList } from './TopItemsList'

describe('TopItemsList', () => {
  it('shows "No data available" when items array is empty', () => {
    render(<TopItemsList items={[]} />)
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('renders item labels', () => {
    render(
      <TopItemsList
        items={[
          { label: 'Llama 3', value: 120 },
          { label: 'Mistral', value: 80 },
        ]}
      />
    )
    expect(screen.getByText('Llama 3')).toBeInTheDocument()
    expect(screen.getByText('Mistral')).toBeInTheDocument()
  })

  it('renders item values as badges', () => {
    render(
      <TopItemsList
        items={[
          { label: 'Model A', value: 42 },
        ]}
      />
    )
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders progress bars for each item', () => {
    const { container } = render(
      <TopItemsList
        items={[
          { label: 'First', value: 100 },
          { label: 'Second', value: 50 },
        ]}
      />
    )
    // Progress track containers
    const tracks = container.querySelectorAll('.h-1\\.5.bg-muted.rounded-full')
    expect(tracks).toHaveLength(2)
  })

  it('sets the top item to 100% width bar', () => {
    const { container } = render(
      <TopItemsList
        items={[
          { label: 'Top', value: 200 },
          { label: 'Second', value: 100 },
        ]}
      />
    )
    const fills = container.querySelectorAll('.h-full.bg-primary.rounded-full')
    // First bar should be 100%
    expect((fills[0] as HTMLElement).style.width).toBe('100%')
    // Second bar should be 50%
    expect((fills[1] as HTMLElement).style.width).toBe('50%')
  })

  it('renders separators between items (but not after the last)', () => {
    const { container } = render(
      <TopItemsList
        items={[
          { label: 'A', value: 10 },
          { label: 'B', value: 5 },
          { label: 'C', value: 1 },
        ]}
      />
    )
    // Separator count = items.length - 1
    // Shadcn Separator renders a <div role="none"> or <hr>
    const separators = container.querySelectorAll('[data-orientation]')
    expect(separators.length).toBeGreaterThanOrEqual(2)
  })

  it('handles a single item with 100% bar', () => {
    const { container } = render(
      <TopItemsList items={[{ label: 'Only', value: 999 }]} />
    )
    const fill = container.querySelector('.h-full.bg-primary.rounded-full') as HTMLElement
    expect(fill.style.width).toBe('100%')
  })
})
