import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/assets', () => ({
  emptyStateModels: 'mock-models-svg',
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { GGUFLibrary } from './GGUFLibrary'
import type { GGUFModel } from '@/lib/types'

const makeModel = (overrides: Partial<GGUFModel> = {}): GGUFModel => ({
  id: 'm1',
  name: 'Llama-3-8B',
  filename: 'llama-3-8b.gguf',
  path: '/models/llama-3-8b.gguf',
  size: 4 * 1024 * 1024 * 1024,
  quantization: 'Q4_K_M',
  architecture: 'llama',
  contextLength: 4096,
  downloadedAt: Date.now(),
  metadata: { format: 'GGUF' },
  ...overrides,
})

describe('GGUFLibrary', () => {
  it('renders empty state when no models', () => {
    render(
      <GGUFLibrary
        models={[]}
        onAddModel={vi.fn()}
        onDeleteModel={vi.fn()}
      />
    )
    expect(screen.getByText('No Models Found')).toBeInTheDocument()
  })

  it('renders model name when models provided', () => {
    const models = [makeModel({ name: 'Llama-3-8B' })]
    render(
      <GGUFLibrary
        models={models}
        onAddModel={vi.fn()}
        onDeleteModel={vi.fn()}
      />
    )
    expect(screen.getByText('Llama-3-8B')).toBeInTheDocument()
  })

  it('renders search input', () => {
    render(
      <GGUFLibrary
        models={[makeModel()]}
        onAddModel={vi.fn()}
        onDeleteModel={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('filters models by search query', () => {
    const models = [
      makeModel({ id: 'm1', name: 'Llama-3-8B' }),
      makeModel({ id: 'm2', name: 'Mistral-7B' }),
    ]
    render(
      <GGUFLibrary
        models={models}
        onAddModel={vi.fn()}
        onDeleteModel={vi.fn()}
      />
    )
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'xyznonexistent' },
    })
    // With a non-matching query, no models should be found
    expect(screen.getByText('No Models Found')).toBeInTheDocument()
  })

  it('shows Add Model button', () => {
    render(
      <GGUFLibrary
        models={[]}
        onAddModel={vi.fn()}
        onDeleteModel={vi.fn()}
      />
    )
    expect(screen.getAllByRole('button', { name: /add model/i }).length).toBeGreaterThan(0)
  })

  it('renders quantization badge', () => {
    const models = [makeModel({ quantization: 'Q4_K_M' })]
    render(
      <GGUFLibrary
        models={models}
        onAddModel={vi.fn()}
        onDeleteModel={vi.fn()}
      />
    )
    expect(screen.getByText('Q4_K_M')).toBeInTheDocument()
  })
})
