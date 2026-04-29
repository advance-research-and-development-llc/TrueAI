import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LearningRateBenchmark } from './LearningRateBenchmark'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('LearningRateBenchmark', () => {
  it('renders heading', () => {
    render(
      <LearningRateBenchmark
        models={[]}
        onModelUpdate={vi.fn()}
      />
    )
    expect(screen.getByText(/learning rate/i)).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    render(
      <LearningRateBenchmark
        models={[]}
        onModelUpdate={vi.fn()}
      />
    )
    expect(document.body).toBeTruthy()
  })
})
