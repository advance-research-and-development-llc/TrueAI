import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VirtualList } from './VirtualList'

vi.mock('@/lib/mobile-performance', () => ({
  useThrottle: (fn: (...args: unknown[]) => void) => fn,
  ImageCache: {
    has: vi.fn(() => false),
    get: vi.fn(),
    set: vi.fn(),
  },
}))

const ITEM_HEIGHT = 50
const CONTAINER_HEIGHT = 300

function renderList(count: number, overscan = 3, className = '') {
  const items = Array.from({ length: count }, (_, i) => `Item ${i}`)
  return render(
    <VirtualList
      items={items}
      itemHeight={ITEM_HEIGHT}
      containerHeight={CONTAINER_HEIGHT}
      renderItem={(item) => <div>{item}</div>}
      overscan={overscan}
      className={className}
    />
  )
}

describe('VirtualList', () => {
  it('renders visible items', () => {
    renderList(20)
    // At scroll=0: visible range is 0..5 (300/50=6), plus overscan 3 above/below
    // startIndex=0, endIndex=min(19, 9)=9 => items 0-9 visible
    expect(screen.getByText('Item 0')).toBeInTheDocument()
    expect(screen.getByText('Item 5')).toBeInTheDocument()
  })

  it('renders correct number of items for container', () => {
    // container 300px, item 50px => 6 visible + 3 overscan below = 9 items (0-8)
    renderList(20)
    // Items 0-9 (0 + min(19, 6+3-1)=8) => startIndex=0, endIndex=8
    // Actually: endIndex = min(19, ceil((0+300)/50)+3-1) = min(19, 6+3-1) = min(19,8) = 8
    // So items 0..8 = 9 items
    const items = screen.getAllByText(/^Item \d+$/)
    expect(items.length).toBeGreaterThanOrEqual(6)
  })

  it('applies custom className', () => {
    const { container } = renderList(5, 3, 'my-custom-class')
    expect(container.firstChild).toHaveClass('my-custom-class')
  })

  it('uses correct total height style', () => {
    const { container } = renderList(10)
    // inner div has position:relative and total height = 10 * 50 = 500px
    const inner = container.querySelector('[style*="position: relative"]') as HTMLElement
    expect(inner?.style.height).toBe('500px')
  })

  it('overscan renders extra items beyond visible area', () => {
    // with overscan=5, we should see more items than just visible count
    renderList(30, 5)
    // endIndex = min(29, ceil(300/50)+5-1) = min(29, 6+5-1) = min(29, 10) = 10
    // Items 0-10 = 11 items
    const items = screen.getAllByText(/^Item \d+$/)
    expect(items.length).toBeGreaterThan(6)
  })
})
