import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LearningRateDashboard } from './LearningRateDashboard'

describe('LearningRateDashboard', () => {
  it('renders heading', () => {
    render(
      <LearningRateDashboard
        models={[]}
        fineTuningJobs={[]}
        onUpdateJobLearningRate={vi.fn()}
      />
    )
    expect(screen.getByText(/learning rate dashboard/i)).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    render(
      <LearningRateDashboard
        models={[]}
        fineTuningJobs={[]}
        onUpdateJobLearningRate={vi.fn()}
      />
    )
    expect(document.body).toBeTruthy()
  })
})
