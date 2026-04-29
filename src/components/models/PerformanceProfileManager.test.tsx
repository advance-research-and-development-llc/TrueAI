import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PerformanceProfileManager } from './PerformanceProfileManager'
import type { ModelParameters } from '@/lib/types'

const mockParams: ModelParameters = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
}

describe('PerformanceProfileManager', () => {
  it('renders heading', () => {
    render(
      <PerformanceProfileManager
        profiles={[]}
        currentModelParams={mockParams}
        currentModelId="model-1"
        onCreateProfile={vi.fn()}
        onApplyProfile={vi.fn()}
        onDeleteProfile={vi.fn()}
        onAutoTune={vi.fn()}
      />
    )
    expect(screen.getByText(/performance profile/i)).toBeInTheDocument()
  })

  it('renders empty state when no profiles', () => {
    render(
      <PerformanceProfileManager
        profiles={[]}
        currentModelParams={mockParams}
        currentModelId="model-1"
        onCreateProfile={vi.fn()}
        onApplyProfile={vi.fn()}
        onDeleteProfile={vi.fn()}
        onAutoTune={vi.fn()}
      />
    )
    expect(screen.getByText(/no profiles/i)).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    render(
      <PerformanceProfileManager
        profiles={[]}
        currentModelParams={mockParams}
        currentModelId="model-1"
        onCreateProfile={vi.fn()}
        onApplyProfile={vi.fn()}
        onDeleteProfile={vi.fn()}
        onAutoTune={vi.fn()}
      />
    )
    expect(document.body).toBeTruthy()
  })
})
