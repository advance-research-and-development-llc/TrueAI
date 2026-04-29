import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock asset imports
vi.mock('@/assets', () => ({
  emptyStateEnsemble: 'mock-ensemble-svg',
}))

import { EnsembleManager } from './EnsembleManager'
import type { EnsembleAgent } from '@/lib/types'

const makeEnsemble = (overrides: Partial<EnsembleAgent> = {}): EnsembleAgent => ({
  id: 'e1',
  name: 'Test Ensemble',
  models: ['gpt-4o', 'gpt-4o-mini'],
  strategy: 'consensus',
  createdAt: Date.now(),
  runs: [],
  ...overrides,
})

describe('EnsembleManager', () => {
  it('renders empty state when no ensembles', () => {
    render(
      <EnsembleManager
        ensembles={[]}
        onCreateEnsemble={vi.fn()}
        onRunEnsemble={vi.fn()}
        onDeleteEnsemble={vi.fn()}
      />
    )
    expect(screen.getByText('No ensembles configured')).toBeInTheDocument()
  })

  it('shows Create Ensemble button in empty state', () => {
    render(
      <EnsembleManager
        ensembles={[]}
        onCreateEnsemble={vi.fn()}
        onRunEnsemble={vi.fn()}
        onDeleteEnsemble={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /create ensemble/i })).toBeInTheDocument()
  })

  it('calls onCreateEnsemble when Create button clicked in empty state', () => {
    const onCreateEnsemble = vi.fn()
    render(
      <EnsembleManager
        ensembles={[]}
        onCreateEnsemble={onCreateEnsemble}
        onRunEnsemble={vi.fn()}
        onDeleteEnsemble={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /create ensemble/i }))
    expect(onCreateEnsemble).toHaveBeenCalledOnce()
  })

  it('renders ensemble card when ensembles provided', () => {
    const ensembles = [makeEnsemble({ name: 'My Ensemble' })]
    render(
      <EnsembleManager
        ensembles={ensembles}
        onCreateEnsemble={vi.fn()}
        onRunEnsemble={vi.fn()}
        onDeleteEnsemble={vi.fn()}
      />
    )
    expect(screen.getByText('My Ensemble')).toBeInTheDocument()
  })

  it('shows heading when ensembles are present', () => {
    const ensembles = [makeEnsemble()]
    render(
      <EnsembleManager
        ensembles={ensembles}
        onCreateEnsemble={vi.fn()}
        onRunEnsemble={vi.fn()}
        onDeleteEnsemble={vi.fn()}
      />
    )
    expect(screen.getByText('Multi-Model Ensemble')).toBeInTheDocument()
  })

  it('calls onDeleteEnsemble when delete button clicked', () => {
    const onDeleteEnsemble = vi.fn()
    const ensembles = [makeEnsemble({ id: 'e1' })]
    render(
      <EnsembleManager
        ensembles={ensembles}
        onCreateEnsemble={vi.fn()}
        onRunEnsemble={vi.fn()}
        onDeleteEnsemble={onDeleteEnsemble}
      />
    )
    const deleteBtn = screen.getByRole('button', { name: /delete/i })
    fireEvent.click(deleteBtn)
    expect(onDeleteEnsemble).toHaveBeenCalledWith('e1')
  })
})
