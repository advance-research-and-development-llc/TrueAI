import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/assets', () => ({
  emptyStateFineTuning: 'mock-svg',
}))
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Radix stubs
beforeEach(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
      value: vi.fn().mockReturnValue(false), configurable: true,
    })
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: vi.fn(), configurable: true,
    })
  }
})

import { FineTuningUI } from './FineTuningUI'

describe('FineTuningUI', () => {
  it('renders heading', () => {
    render(
      <FineTuningUI
        models={[]}
        datasets={[]}
        jobs={[]}
        onCreateDataset={vi.fn()}
        onStartJob={vi.fn()}
        onDeleteDataset={vi.fn()}
        onDeleteJob={vi.fn()}
      />
    )
    expect(screen.getByText(/fine.tun/i)).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    render(
      <FineTuningUI
        models={[]}
        datasets={[]}
        jobs={[]}
        onCreateDataset={vi.fn()}
        onStartJob={vi.fn()}
        onDeleteDataset={vi.fn()}
        onDeleteJob={vi.fn()}
      />
    )
    expect(document.body).toBeTruthy()
  })
})
