import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/assets', () => ({
  emptyStateQuantization: 'mock-svg',
}))

import { QuantizationTools } from './QuantizationTools'

describe('QuantizationTools', () => {
  it('renders heading', () => {
    render(
      <QuantizationTools
        models={[]}
        jobs={[]}
        onStartJob={vi.fn()}
        onDeleteJob={vi.fn()}
        onDownloadModel={vi.fn()}
      />
    )
    expect(screen.getByText(/quantization/i)).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    render(
      <QuantizationTools
        models={[]}
        jobs={[]}
        onStartJob={vi.fn()}
        onDeleteJob={vi.fn()}
        onDownloadModel={vi.fn()}
      />
    )
    expect(document.body).toBeTruthy()
  })
})
