import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { HarnessUploadUI } from './HarnessUploadUI'
import type { CustomHarness } from '@/lib/types'

const makeHarness = (overrides: Partial<CustomHarness> = {}): CustomHarness => ({
  id: 'h1',
  name: 'Test Harness',
  description: 'A test harness',
  tools: [],
  createdAt: Date.now(),
  enabled: true,
  ...overrides,
})

describe('HarnessUploadUI', () => {
  it('renders heading', () => {
    render(
      <HarnessUploadUI
        harnesses={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onToggle={vi.fn()}
      />
    )
    expect(screen.getByText(/harness/i)).toBeInTheDocument()
  })

  it('shows empty state when no harnesses', () => {
    render(
      <HarnessUploadUI
        harnesses={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onToggle={vi.fn()}
      />
    )
    expect(screen.getByText(/no custom harnesses/i)).toBeInTheDocument()
  })

  it('renders harness name when harnesses provided', () => {
    render(
      <HarnessUploadUI
        harnesses={[makeHarness({ name: 'My Harness' })]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onToggle={vi.fn()}
      />
    )
    expect(screen.getByText('My Harness')).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    render(
      <HarnessUploadUI
        harnesses={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onToggle={vi.fn()}
      />
    )
    expect(document.body).toBeTruthy()
  })
})
