import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BulkOptimizationPanel } from './BulkOptimizationPanel'

describe('BulkOptimizationPanel', () => {
  it('renders heading', () => {
    render(
      <BulkOptimizationPanel
        models={[]}
        onApplyBundle={vi.fn()}
      />
    )
    expect(screen.getByText(/bulk optim/i)).toBeInTheDocument()
  })

  it('renders optimization bundle cards', () => {
    render(
      <BulkOptimizationPanel
        models={[]}
        onApplyBundle={vi.fn()}
      />
    )
    // Should show some bundle cards
    const cards = document.querySelectorAll('[data-slot="card"]')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('renders without crashing', () => {
    render(
      <BulkOptimizationPanel
        models={[]}
        onApplyBundle={vi.fn()}
      />
    )
    expect(document.body).toBeTruthy()
  })
})
