/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import userEvent from '@testing-library/user-event'

vi.mock('@/assets', () => ({
  emptyStateModels: 'mock-models-svg',
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { GGUFLibrary } from './GGUFLibrary'
import type { GGUFModel } from '@/lib/types'

// Radix Select pointer-capture stubs
beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false
    HTMLElement.prototype.setPointerCapture = () => {}
    HTMLElement.prototype.releasePointerCapture = () => {}
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {}
  }
})

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
        onImport={vi.fn()}
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
        onImport={vi.fn()}
        onDeleteModel={vi.fn()}
      />
    )
    expect(screen.getByText('Llama-3-8B')).toBeInTheDocument()
  })

  it('renders search input', () => {
    render(
      <GGUFLibrary
        models={[makeModel()]}
        onImport={vi.fn()}
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
        onImport={vi.fn()}
        onDeleteModel={vi.fn()}
      />
    )
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'xyznonexistent' },
    })
    expect(screen.getByText('No Models Found')).toBeInTheDocument()
  })

  it('shows the Import button in the header', () => {
    render(
      <GGUFLibrary models={[]} onImport={vi.fn()} onDeleteModel={vi.fn()} />
    )
    expect(
      screen.getAllByRole('button', { name: /import \.gguf file/i }).length,
    ).toBeGreaterThan(0)
  })

  it('clicking the Import button calls onImport', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn()
    render(
      <GGUFLibrary models={[]} onImport={onImport} onDeleteModel={vi.fn()} />
    )
    const buttons = screen.getAllByRole('button', { name: /import \.gguf file/i })
    await user.click(buttons[0])
    expect(onImport).toHaveBeenCalledTimes(1)
  })

  it('disables the Import button while isImporting=true', () => {
    render(
      <GGUFLibrary
        models={[]}
        onImport={vi.fn()}
        onDeleteModel={vi.fn()}
        isImporting
      />
    )
    const button = screen.getByRole('button', { name: /importing/i })
    expect(button).toBeDisabled()
  })

  it('renders the free-space line when freeBytes is provided', () => {
    render(
      <GGUFLibrary
        models={[]}
        onImport={vi.fn()}
        onDeleteModel={vi.fn()}
        freeBytes={5 * 1024 * 1024 * 1024}
      />
    )
    expect(screen.getByText(/Available storage/)).toBeInTheDocument()
    expect(screen.getByText(/5\.00 GB/)).toBeInTheDocument()
  })

  it('does NOT render free-space line when freeBytes is null/undefined', () => {
    render(
      <GGUFLibrary
        models={[]}
        onImport={vi.fn()}
        onDeleteModel={vi.fn()}
        freeBytes={null}
      />
    )
    expect(screen.queryByText(/Available storage/)).not.toBeInTheDocument()
  })

  it('renders quantization badge', () => {
    const models = [makeModel({ quantization: 'Q4_K_M' })]
    render(
      <GGUFLibrary models={models} onImport={vi.fn()} onDeleteModel={vi.fn()} />
    )
    expect(screen.getByText('Q4_K_M')).toBeInTheDocument()
  })

  it('clicking model card shows Model Details panel', async () => {
    const user = userEvent.setup()
    const models = [makeModel()]
    render(<GGUFLibrary models={models} onImport={vi.fn()} onDeleteModel={vi.fn()} />)
    await user.click(screen.getByText('Llama-3-8B'))
    expect(screen.getByText('Model Details')).toBeInTheDocument()
  })

  it('model details shows filename', async () => {
    const user = userEvent.setup()
    const models = [makeModel({ filename: 'llama-3-8b.gguf' })]
    render(<GGUFLibrary models={models} onImport={vi.fn()} onDeleteModel={vi.fn()} />)
    await user.click(screen.getByText('Llama-3-8B'))
    expect(screen.getAllByText('llama-3-8b.gguf').length).toBeGreaterThan(0)
  })

  it('model details shows context length', async () => {
    const user = userEvent.setup()
    const models = [makeModel({ contextLength: 4096 })]
    render(<GGUFLibrary models={models} onImport={vi.fn()} onDeleteModel={vi.fn()} />)
    await user.click(screen.getByText('Llama-3-8B'))
    expect(screen.getByText('4,096 tokens')).toBeInTheDocument()
  })

  it('clicking the trash icon calls onDeleteModel', async () => {
    const user = userEvent.setup()
    const onDeleteModel = vi.fn()
    const models = [makeModel()]
    render(
      <GGUFLibrary
        models={models}
        onImport={vi.fn()}
        onDeleteModel={onDeleteModel}
      />
    )
    await user.click(screen.getByText('Llama-3-8B'))
    const deleteBtn = screen.getByRole('button', { name: /delete model/i })
    await user.click(deleteBtn)
    expect(onDeleteModel).toHaveBeenCalledWith('m1')
  })

  it('clicking "Set active" calls onSetActive', async () => {
    const user = userEvent.setup()
    const onSetActive = vi.fn()
    const models = [makeModel()]
    render(
      <GGUFLibrary
        models={models}
        onImport={vi.fn()}
        onDeleteModel={vi.fn()}
        onSetActive={onSetActive}
      />
    )
    await user.click(screen.getByText('Llama-3-8B'))
    await user.click(screen.getByRole('button', { name: /set active/i }))
    expect(onSetActive).toHaveBeenCalledWith('m1')
  })

  it('does NOT render "Set active" button when onSetActive prop is omitted', async () => {
    const user = userEvent.setup()
    const models = [makeModel()]
    render(<GGUFLibrary models={models} onImport={vi.fn()} onDeleteModel={vi.fn()} />)
    await user.click(screen.getByText('Llama-3-8B'))
    expect(screen.queryByRole('button', { name: /set active/i })).not.toBeInTheDocument()
  })

  it('shows "No Model Selected" when no card is clicked', () => {
    render(<GGUFLibrary models={[makeModel()]} onImport={vi.fn()} onDeleteModel={vi.fn()} />)
    expect(screen.getByText('No Model Selected')).toBeInTheDocument()
  })

  it('filters by quantization in search', () => {
    const models = [
      makeModel({ id: 'm1', name: 'Llama', quantization: 'Q4_K_M' }),
      makeModel({ id: 'm2', name: 'Mistral', quantization: 'Q8_0' }),
    ]
    render(<GGUFLibrary models={models} onImport={vi.fn()} onDeleteModel={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Q8_0' } })
    expect(screen.queryByText('Llama')).not.toBeInTheDocument()
    expect(screen.getByText('Mistral')).toBeInTheDocument()
  })

  it('clearing the externally-removed selected model resets the details panel', () => {
    const initial = [makeModel({ id: 'm1' })]
    const { rerender } = render(
      <GGUFLibrary models={initial} onImport={vi.fn()} onDeleteModel={vi.fn()} />,
    )
    fireEvent.click(screen.getByText('Llama-3-8B'))
    expect(screen.getByText('Model Details')).toBeInTheDocument()
    // Re-render without that model — details panel must clear.
    rerender(
      <GGUFLibrary models={[]} onImport={vi.fn()} onDeleteModel={vi.fn()} />,
    )
    expect(screen.queryByText('Model Details')).not.toBeInTheDocument()
  })
})
