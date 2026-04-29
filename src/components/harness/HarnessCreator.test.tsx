import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { HarnessCreator } from './HarnessCreator'
import type { HarnessManifest } from '@/lib/types'

const makeHarness = (overrides: Partial<HarnessManifest> = {}): HarnessManifest => ({
  id: 'h1',
  name: 'Test Harness',
  description: 'A test harness',
  version: '1.0.0',
  author: 'Test Author',
  tools: [],
  ...overrides,
})

describe('HarnessCreator', () => {
  it('renders heading', () => {
    render(
      <HarnessCreator
        harnesses={[]}
        onCreateHarness={vi.fn()}
        onDeleteHarness={vi.fn()}
        onExportHarness={vi.fn()}
      />
    )
    expect(screen.getByText(/harness/i)).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    render(
      <HarnessCreator
        harnesses={[]}
        onCreateHarness={vi.fn()}
        onDeleteHarness={vi.fn()}
        onExportHarness={vi.fn()}
      />
    )
    expect(document.body).toBeTruthy()
  })

  it('renders harness names when harnesses provided', () => {
    const harnesses = [makeHarness({ name: 'My Harness' })]
    render(
      <HarnessCreator
        harnesses={harnesses}
        onCreateHarness={vi.fn()}
        onDeleteHarness={vi.fn()}
        onExportHarness={vi.fn()}
      />
    )
    expect(screen.getByText('My Harness')).toBeInTheDocument()
  })
})
