import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// HardwareOptimizer uses useKV from @github/spark/hooks
// The global spark mock in test setup covers this

import { HardwareOptimizer } from './HardwareOptimizer'

describe('HardwareOptimizer', () => {
  it('renders heading', () => {
    render(<HardwareOptimizer />)
    expect(screen.getByText(/hardware optim/i)).toBeInTheDocument()
  })

  it('renders Scan Hardware button', () => {
    render(<HardwareOptimizer />)
    expect(screen.getByRole('button', { name: /scan hardware/i })).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    render(<HardwareOptimizer />)
    expect(document.body).toBeTruthy()
  })
})
