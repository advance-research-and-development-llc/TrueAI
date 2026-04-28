import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LazyErrorBoundary } from './LazyErrorBoundary'

// A child component that always throws so we can trigger the error boundary.
function BrokenChild(): never {
  throw new Error('Child failure')
}

// Helper to suppress the expected React error boundary console.error noise.
function suppressConsoleError() {
  return vi.spyOn(console, 'error').mockImplementation(() => {})
}

describe('LazyErrorBoundary', () => {
  it('renders children normally when there is no error', () => {
    render(
      <LazyErrorBoundary>
        <div>working content</div>
      </LazyErrorBoundary>
    )
    expect(screen.getByText('working content')).toBeInTheDocument()
  })

  it('renders error UI when a child throws', () => {
    const spy = suppressConsoleError()
    render(
      <LazyErrorBoundary>
        <BrokenChild />
      </LazyErrorBoundary>
    )
    expect(screen.getByText(/Failed to Load/)).toBeInTheDocument()
    spy.mockRestore()
  })

  it('shows the default component name when none is specified', () => {
    const spy = suppressConsoleError()
    render(
      <LazyErrorBoundary>
        <BrokenChild />
      </LazyErrorBoundary>
    )
    expect(screen.getByText('Component Failed to Load')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('shows the custom componentName in the error heading', () => {
    const spy = suppressConsoleError()
    render(
      <LazyErrorBoundary componentName="MyWidget">
        <BrokenChild />
      </LazyErrorBoundary>
    )
    expect(screen.getByText('MyWidget Failed to Load')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('shows the custom fallbackMessage when provided', () => {
    const spy = suppressConsoleError()
    render(
      <LazyErrorBoundary fallbackMessage="Custom error message">
        <BrokenChild />
      </LazyErrorBoundary>
    )
    expect(screen.getByText('Custom error message')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('shows the default fallback message when none is specified', () => {
    const spy = suppressConsoleError()
    render(
      <LazyErrorBoundary>
        <BrokenChild />
      </LazyErrorBoundary>
    )
    expect(screen.getByText(/Unable to load this component/)).toBeInTheDocument()
    spy.mockRestore()
  })

  it('shows a Technical Details section with the error message', () => {
    const spy = suppressConsoleError()
    render(
      <LazyErrorBoundary>
        <BrokenChild />
      </LazyErrorBoundary>
    )
    expect(screen.getByText('Technical Details')).toBeInTheDocument()
    expect(screen.getByText('Child failure')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('renders a Retry button in the error state', () => {
    const spy = suppressConsoleError()
    render(
      <LazyErrorBoundary>
        <BrokenChild />
      </LazyErrorBoundary>
    )
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
    spy.mockRestore()
  })

  it('resets error state and re-renders children when Retry is clicked', async () => {
    // Use a component whose throw behaviour can be toggled.
    let shouldThrow = true
    function ToggleChild() {
      if (shouldThrow) throw new Error('toggled error')
      return <div>recovered</div>
    }

    const spy = suppressConsoleError()
    const user = userEvent.setup()

    render(
      <LazyErrorBoundary>
        <ToggleChild />
      </LazyErrorBoundary>
    )

    // Error state shown
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()

    // Fix the child so it no longer throws, then click Retry
    shouldThrow = false
    await user.click(screen.getByRole('button', { name: /Retry/i }))

    expect(screen.getByText('recovered')).toBeInTheDocument()
    spy.mockRestore()
  })
})
