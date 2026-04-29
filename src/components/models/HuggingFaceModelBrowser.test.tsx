import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const { mockSearchModels, mockGetPopular } = vi.hoisted(() => ({
  mockSearchModels: vi.fn(),
  mockGetPopular: vi.fn(),
}))

vi.mock('@/lib/huggingface', () => ({
  searchHuggingFaceModels: mockSearchModels,
  downloadModel: vi.fn(),
  formatBytes: (bytes: number) => `${bytes} B`,
  getPopularGGUFModels: mockGetPopular,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { HuggingFaceModelBrowser } from './HuggingFaceModelBrowser'
import type { HuggingFaceModel } from '@/lib/types'

const mockModels: HuggingFaceModel[] = [
  {
    id: 'llama-8b',
    name: 'Llama-3-8B-GGUF',
    author: 'meta-llama',
    downloads: 50000,
    likes: 1000,
    size: 4 * 1024 * 1024 * 1024,
    quantization: 'Q4_K_M',
    contextLength: 4096,
    tags: ['llama', 'gguf'],
    downloadUrl: 'https://huggingface.co/llama-3-8b',
  },
]

describe('HuggingFaceModelBrowser', () => {
  it('renders heading', () => {
    mockGetPopular.mockResolvedValue(mockModels)
    render(<HuggingFaceModelBrowser onDownload={vi.fn()} />)
    expect(screen.getByText(/HuggingFace/i)).toBeInTheDocument()
  })

  it('renders search input', () => {
    mockGetPopular.mockResolvedValue([])
    render(<HuggingFaceModelBrowser onDownload={vi.fn()} />)
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('renders popular models on load', async () => {
    mockGetPopular.mockResolvedValue(mockModels)
    render(<HuggingFaceModelBrowser onDownload={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByText('Llama-3-8B-GGUF')).toBeInTheDocument()
    )
  })

  it('renders without crashing when popular models empty', async () => {
    mockGetPopular.mockResolvedValue([])
    render(<HuggingFaceModelBrowser onDownload={vi.fn()} />)
    await waitFor(() => expect(mockGetPopular).toHaveBeenCalledOnce())
    expect(document.body).toBeTruthy()
  })
})
