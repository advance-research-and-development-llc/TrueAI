import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopItemsList } from './TopItemsList'

const items = [
  { label: 'Item Alpha', value: 100 },
  { label: 'Item Beta', value: 60 },
  { label: 'Item Gamma', value: 30 },
]

describe('TopItemsList', () => {
  it('shows "No data available" when items array is empty', () => {
    render(<TopItemsList items={[]} />)
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('renders all item labels', () => {
    render(<TopItemsList items={items} />)
    expect(screen.getByText('Item Alpha')).toBeInTheDocument()
    expect(screen.getByText('Item Beta')).toBeInTheDocument()
    expect(screen.getByText('Item Gamma')).toBeInTheDocument()
  })

  it('renders item values as badges', () => {
    render(<TopItemsList items={items} />)
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('renders progress bar for each item', () => {
    const { container } = render(<TopItemsList items={items} />)
    const bars = container.querySelectorAll('.bg-primary')
    expect(bars.length).toBe(items.length)
  })

  it('top item has 100% width progress bar', () => {
    const { container } = render(<TopItemsList items={items} />)
    const bars = container.querySelectorAll('.bg-primary')
    expect((bars[0] as HTMLElement).style.width).toBe('100%')
  })

  it('second item bar is proportional to max', () => {
    const { container } = render(<TopItemsList items={items} />)
    const bars = container.querySelectorAll('.bg-primary')
    expect((bars[1] as HTMLElement).style.width).toBe('60%')
  })

  it('renders single item without error', () => {
    render(<TopItemsList items={[{ label: 'Only One', value: 42 }]} />)
    expect(screen.getByText('Only One')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders separators between items (not after last)', () => {
    const { container } = render(<TopItemsList items={items} />)
    // Separator is rendered between items, so count = items.length - 1
    const separators = container.querySelectorAll('[data-slot="separator-root"]')
    expect(separators.length).toBe(items.length - 1)
  })
})
